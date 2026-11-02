---
name: hn-oneshot-video
description: 制作「HN 上的今天」横屏短视频的现行流程：从当天的 HN 历史里挑一条普通人有记忆的新闻，找到它最认得出的主体（硬件实物、当年的软件界面、看不见的机制过程、历史场景），用 three.js 纯代码高精度做出来，在 Remotion 里拍成 16:9 横屏一镜到底短片（开场特写当天 HN 首页 → 全貌 → 揭示动作 → 定格全景加标注）。只要用户提到 HN 日更视频、HN 上的今天、一镜到底、纯代码视频、把某条 HN 新闻做成视频，或要求"按 iPhone X / barrel roll 那条的做法再做一条"，就使用本 skill。
---

# HN 上的今天 · 一镜到底纯代码短片

产出：`videos/out/shots/<日期>-<slug>/<slug>.mp4`，**1920×1080 横屏（16:9）**、30fps、12–15 秒，一镜到底，纯代码渲染：没有 AI 图、图片素材、3D 模型文件，也没有版权音乐。所有回复和画面文字都用简体中文。

**一律做横屏**。这是用户在第二条（barrel roll，7.5 分）之后定下的：横屏能让画面整个就是一块电脑屏幕，全屏复现当年的效果，也更容易同时放下主体和标注。在 `Root.tsx` 注册 composition 时用 `videos/src/shots/common/stage.ts` 里的 `LANDSCAPE`（1920×1080、30fps）。前两条（iPhone X、barrel roll）是竖屏做的，参考它们的代码时注意画幅不同。

## 为什么这样做（先读）

- **观众与目的**：面向 X、小红书、视频号上的泛科技爱好者和普通刷短视频的人。目的是涨粉、让人转发收藏、建立个人品牌。观众看完应该有两种反应："原来那年大家在聊这个"的怀旧感，和"这个视频怎么做的"的惊艳感。
- **惊艳从哪来**：awesome-opus5-5-videos 里真正的爆款（机械表、1857 野战炮、心脏、QR 码讲解）有一个共同点：**主体一眼认得出，精度高到不像代码，文字只是小标签**。用户否掉过的版本全是反面：文字当主角、隧道/粒子/辉光、黑底糊弄、抽象意象。
- **一镜到底**靠画面里的东西在变（拆开、打开、翻转、展开），镜头连续运动，不剪切、不淡入淡出。
- **评判权在用户**：不要自己给自己打分。做完把成片交给用户，同时如实列出自己已经看到的瑕疵。

## 四条通用原则（每种主体都适用）

1. **认得出的主体**：观众不看字也知道画的是什么。
2. **精度来自细节密度和真实数据**：当天真实的 HN 首页、真实型号、真实参数、当年的真实样式。
3. **有一个揭示动作**：把主体"打开"给观众看，比如拆机、把页面拆成图层、把过程展开，这是一镜到底的戏剧核心。
4. **四个节拍**：钩子（当天 HN 首页特写，高亮那一条）→ 全貌 → 揭示 → 定格全景加标注。开场用当天 HN 首页是系列的固定招牌。

## 主体类型

先判断这条新闻属于哪一类，再读对应的参考文件。标了"未验证"的类型只有原则，还没有成片证明过：做的时候按原则来，并在交付时说明这是这一类的第一条。

| 类型 | 适合的新闻 | 揭示动作 | 状态 | 参考 |
|---|---|---|---|---|
| 硬件实物 | 新手机/电脑/设备、拆解 | 拆开、打开、爆炸图 | 已验证（iPhone X，用户评 7/10） | `references/subjects/hardware.md` |
| 软件界面 | 网站/App 发布、彩蛋、改版、关停 | 还原当年界面 → 让它动起来 → 拆成图层 | 已出片，待评分（barrel roll） | `references/subjects/interface.md` |
| 机制过程 | 算法、协议、开源工具、科研 | 把看不见的过程画出来 | 未验证 | `references/subjects/process-scene.md` |
| 场景事件 | 发布会、事故、诉讼、历史时刻 | 走进场景，揭示关键物件 | 未验证 | `references/subjects/process-scene.md` |

## 流程

### 1. 选题

```bash
cd videos && uv run python scripts/daily.py prepare                    # 今天
cd videos && uv run python scripts/daily.py prepare --date 2026-11-03
```

运行后得到 `out/daily/<日期>/candidates.json`，里面是往年每一年当天的前 3 条。挑选时按以下顺序考虑：

1. 能找到一个认得出的主体（任意一类）。
2. 大众有怀旧感，而不是只有程序员才知道。
3. 有可揭示的东西。
4. 分数和评论数只作参考。

一期可以只做一条。挑好后先给自己写一份"镜头单"：主体是什么、属于哪一类、真实事实（日期、参数、来龙去脉）、要还原的标志性细节、四个节拍各拍什么。事实拿不准就上网查，不要编。

### 2. 准备真实数据

```bash
uv run python .claude/skills/hn-oneshot-video/scripts/frontpage.py --date 2011-11-03 --until 21:30 --out videos/src/shots/<日期>-<slug>/frontpage.json
```

在 `G:\Hacker\hn-mcp` 根目录运行，脚本读本地索引 `data/stories/`。开场钩子画面要用这份数据。

### 3. 搭建主体

在 `videos/src/shots/<日期>-<slug>/` 下新建目录。复用 `videos/src/shots/common/`（`camera.ts` 镜头样条、`stage.ts` 渲染器/后期/灯光、`Overlay.tsx` 标注和系列标题）、`videos/src/spike/geometry.ts`（圆角板 `slab`、平面 `flatRect`、排线 `ribbon`、确定性随机 `rng`）和已有镜头的写法，不要从零写。具体怎么做看对应主体类型的参考文件。渲染架构、材质、灯光等通用技术和踩过的坑在 `references/craft.md`，搭建前读一遍。

品牌标志：只在叙事必需时作为历史画面的一部分出现（例如还原当年的网页），不拿来做装饰。交付时向用户说明用到了哪些品牌元素，平台风险由用户判断。

### 4. 静帧先行

在 `Root.tsx` 里注册 composition，先只渲关键帧：

```bash
cd videos
npx remotion still src/index.ts <CompositionId> out/shots/<slug>/k<帧号>.png --frame=<帧号>
```

挑 4–7 个关键时刻拼成联系表，对照 `references/review.md` 逐条检查，每轮只改看到的问题。

### 5. 镜头与动画

以 14 秒为例的时间轴：

| 时间 | 节拍 | 要点 |
|---|---|---|
| 0–3s | 钩子 | 当天 HN 首页铺满画面（就像观众自己的屏幕），高亮那一条；底部用小胶囊字幕写日期 |
| 3–5s | 全貌 | 主体完整出现，带环境；背景变暗后标题再淡入 |
| 5–9s | 揭示 | 主体的揭示动作；镜头同时推近，掠过最精彩的细节 |
| 9–14s | 定格 | 退到全景，标注逐条画线出现，镜头缓慢漂移 |

镜头用关键帧加 Hermite 样条（见 `videos/src/spike/shot.ts`），这样镜头不会在关键帧上停顿。标注每帧都把 3D 锚点投影到屏幕上，再用 SVG 画引线。

### 6. 渲染

```bash
cd videos
npx remotion render src/index.ts <CompositionId> out/shots/<slug>/<slug>.mp4 --crf=20 --concurrency=4
```

不要在命令里加 `--gl`，`remotion.config.ts` 会自动选择渲染方式：

- **有 GPU**（本机 RTX 3070、Windows、macOS）：用 `angle`，WebGL 跑在显卡上，14 秒的片子 1–2 分钟渲完。
- **没有 GPU**（例如云端 Linux 容器里没有 `/dev/dri`）：自动改用 `swangle`，也就是 SwiftShader 的 CPU 软件渲染。画面和 GPU 一致（实测平均像素差不到 1），只是慢大约 15 倍：30 帧约 5 分半，14 秒的片子约 1 小时。
- 要强制某一种，用环境变量 `HN_GL=swangle` 或 `HN_GL=angle`。命令行的 `--gl=...` 优先级最高。
- 想确认实际用的是哪一种，渲一下 `GpuProbe` 这个 composition，并加上 `--log=verbose`：RENDERER 里出现 NVIDIA 是 GPU，出现 SwiftShader 是 CPU。文件要小于 30 MB，超了就把 `--crf` 调到 22–26。

### 7. 自检后交付

```bash
uv run --with pillow python .claude/skills/hn-oneshot-video/scripts/contact_sheet.py videos/out/shots/<slug>/<slug>.mp4 --count 20
```

看联系表，检查连续性和穿帮，然后用 SendUserFile 把 MP4 发给用户。交付时说明这几点：

- 镜头节拍
- 用了哪些真实数据
- 自己已经看到的瑕疵，具体到秒
- 用到的品牌元素
- 渲染耗时

由用户打分。用户打完分后，把结论（分数、扣分点）写回对应主体类型的参考文件，并更新上面表格里的状态。

## 不要做的事

- 不要用 AI 生图/生视频、图片素材、下载的 3D 模型、HDRI 文件。`RoomEnvironment` 是代码生成的环境光，可以用。
- 不要在成片里放音乐，音乐在发布时到平台上加。
- 不要上传或发布视频。
- 不要套用 vibe-knowledge-code-video 之类的通用模板套路。
