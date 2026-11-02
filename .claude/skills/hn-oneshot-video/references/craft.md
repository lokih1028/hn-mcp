# 通用技术做法与踩过的坑

适用于所有主体类型。每条都写了原因，换新题材时按原因判断是否适用。参考代码：`videos/src/spike/TeardownShot.tsx`。

## 渲染架构

- **不用 @react-three/fiber**：直接用 three.js 的 `WebGLRenderer` 画到一个 `<canvas>` 上。场景在 `useMemo` 里同步建好。Canvas 贴图用系统字体（Verdana/Arial/Courier New/Georgia），不需要等字体加载。
- 每帧在组件函数体里根据 `frame` 摆好物体和相机（纯函数，同一帧永远得到同样画面），然后在 `useLayoutEffect` 里 `composer.render()`。渲染器在挂载用的 `useLayoutEffect` 里创建，声明顺序要排在每帧渲染的 effect 之前。
- 需要每帧变化的贴图（打字、页面旋转）：每帧重画那块 canvas，再设 `texture.needsUpdate = true`。内容只能由 `frame` 决定。
- 必须开 `preserveDrawingBuffer: true`，否则 Remotion 截图可能是空的。
- 2 倍超采样：横屏时 canvas 实际尺寸 3840×2160，CSS 显示 1920×1080，不需要再开 MSAA。`useStage` 和 `makeRig` 会按画幅自动设置。
- 后期用 `postprocessing` 库，顺序如下：
  - `DepthOfFieldEffect`：`cocMaterial.focusDistance` 设为相机到目标的距离，`focusRange` 和 `bokehScale` 跟着关键帧变。
  - `BloomEffect`：阈值 0.93、强度 0.2。再高就会把亮屏和金属高光炸成白块。
  - `NoiseEffect`：颗粒强度 0.09。
  - 暗角和标题后面的渐变用 CSS 叠层来做。
- 色调映射用 `THREE.NeutralToneMapping`，输出 sRGB。

## 材质与光

- **任何屏幕都必须自发光**：`color: #000` 加 `emissiveMap`，`emissiveIntensity ≈ 0.78`，再加 clearcoat 当玻璃反光。如果用 `map` 让灯光照亮屏幕，主光一打整块屏就炸白，字全看不清。
- **灯挂在主体上**（`root.add(light)`），不挂在世界坐标里。这样镜头绕着转时光影不变，看起来是镜头在动，而不是物体在灯下转。
- 环境光用 `RoomEnvironment` 经 PMREM 生成，`environmentIntensity ≈ 0.55`。主光用暖色并投阴影，背面放冷色轮廓光，侧面加弱暖色补光。
- 阴影用 `VSMShadowMap`，`radius ≈ 9`、`blurSamples ≈ 20`。PCFSoft 的阴影边缘太硬，投到地面上会像一块黑色实物。
- 拉丝金属的粗糙度不要低于 0.45 左右，否则会出现炸白的高光块。

## 构图（横屏 16:9）

以后一律做横屏。下面前两条来自用户反馈；竖屏时代的经验见各主体参考文件。

- **屏幕类主体可以整屏模拟**：镜头正对屏幕，让屏幕恰好铺满画面，观众看到的就是当年那块屏幕本身，然后再连续后拉，露出设备和环境（用户的建议）。
- **屏幕不能太亮**：自发光大约 0.45–0.5。大面积白色页面要再降一些，让屏幕和周围实物的亮度接近（barrel roll 因屏幕刺眼被扣分）。
- 主体要占满画面，定格全景时大约占画面宽度的 60% 以上。另一侧留给标注。
- 标题在左上角，不要和主体抢位置；主体放在画面中间偏右，标注在左侧排成一列（`Callout.x`）。系列标题块大约占左上角到 y≈330 px，所以标注列要从标题下方开始，否则会压到标题上（用竖屏镜头直接出横屏时就压上了）。
- 揭示阶段横向展开更自然：图层左右排开，零件水平爆炸开来。
- 标注指向的东西在那一刻必须**真的看得见**，被遮住的不要标。
- 标注放在暗处，白字不要压在亮面上，所有标注都加深色 text-shadow。先渲最后一帧，看清每个锚点投影后的位置，再手动给每个标签定 dx/dy，避免互相挤。
- 标题要等背景变暗后再淡入。开场特写阶段只放一个小胶囊字幕。
- 给主体一个和故事相关的环境，比如拆解用修理垫、网页用当年的书桌。不要用空的黑背景。

## 渲染与检查

- 渲染方式由 `remotion.config.ts` 自动选择：有 GPU 用 `angle`（本机走 Direct3D11、RTX 3070），没有 GPU 的 Linux 用 `swangle`（CPU 软件渲染，画面一致，慢约 15 倍）。可以用 `HN_GL` 环境变量强制指定。`GpuProbe` 会打印 `UNMASKED_RENDERER_WEBGL`，用来确认实际走的是哪一种。视频编码（x264）始终在 CPU 上做。
- CPU 渲染很慢，所以检查画面时更要先渲关键帧静帧，确认没问题再渲整片。
- Remotion 自带的 ffmpeg 没有 fps/select/scale/tile 滤镜。抽帧用 `-ss <秒> -frames:v 1`，拼图用 PIL，见 `scripts/contact_sheet.py`。
- 单帧检查用 `remotion still --frame=N`，大约 14 秒出一张（含打包时间）。
