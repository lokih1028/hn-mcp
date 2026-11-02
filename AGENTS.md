# 给 AI 代理的说明（Codex 等）

这个仓库有两部分：

- `src/hn_mcp/`：Hacker News 数据的 MCP 服务器和本地故事索引。
- `videos/`：用 Remotion + three.js 纯代码制作的「HN 上的今天」短视频。

做视频的完整流程、标准和经验，都在 `.claude/skills/hn-oneshot-video/SKILL.md` 和它的 `references/` 目录里。要做视频，先读这两处。所有回复和画面文字都用简体中文。

## 在云端（Linux、没有 GPU）运行需要补全的东西

下面这些仓库里没有，或者只在作者的 Windows 机器上验证过，请自行安装和补全。

### 1. 运行环境

- Python ≥ 3.12 和 [uv](https://docs.astral.sh/uv/)。在仓库根目录运行 `uv sync`。
- Node ≥ 20.19。在 `videos/` 目录运行 `npm ci`。
- 不需要单独安装 ffmpeg，Remotion 自带。用 `npx remotion ffmpeg` / `npx remotion ffprobe` 调用。

### 2. 渲染用的浏览器

- Remotion 用 Chrome Headless Shell 渲染。在 `videos/` 里运行 `npx remotion browser ensure` 下载它，需要联网。
- Linux 上还要装它依赖的系统库。以 Remotion 官方文档 "Linux dependencies" 为准。Debian/Ubuntu 上大致是：
  `libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2`

### 3. 没有 GPU 时用 CPU 渲染（已支持）

- `videos/remotion.config.ts` 会自动选择：Linux 上没有 `/dev/dri` 时用 `swangle`（SwiftShader，CPU 软件渲染）。画面和 GPU 渲染一致，只是慢大约 15 倍：30 帧约 5 分半，一条 14 秒的片子约 1 小时。
- 想强制某一种，设 `HN_GL=swangle` 或 `HN_GL=angle`。不要在渲染命令里写死 `--gl=angle`。
- 确认实际用的是哪一种：运行 `npx remotion still src/index.ts GpuProbe out/gpu.png --log=verbose`，日志里 RENDERER 出现 SwiftShader 就是 CPU。

### 4. 字体

画面里的 Canvas 贴图（2011 年的网页、芯片丝印、便利贴、代码卡）用的是 Windows 系统字体，Linux 上默认没有：

- Arial、Verdana、Georgia、Courier New、Comic Sans MS：装 `ttf-mscorefonts-installer`（Debian/Ubuntu，需要同意微软字体许可）即可补齐。
- Segoe UI、Segoe Print、Consolas：没有可自由安装的包，会自动换成别的字体。浏览器外框、便利贴、代码卡的字形会和原片略有不同，但不影响渲染。
- 中文字体 Noto Sans SC 和等宽字体 JetBrains Mono 由 `@remotion/google-fonts` 在渲染时从 Google Fonts 下载，所以**渲染时要能访问 fonts.googleapis.com 和 fonts.gstatic.com**。

### 5. HN 故事索引（选题和导出当天首页要用）

- 索引约 421 MB，不在仓库里（`.gitignore` 里排除了 `/data/`）。要自己构建：

  ```bash
  HN_MCP_DATA=$PWD/data uv run hn-mcp sync
  ```

  构建结果写到 `data/stories/`，`videos/scripts/daily.py` 和 skill 里的脚本都从这里读。
- 仓库**没有发布预构建的索引快照**（GitHub release 里没有 `hn-index.zip`），所以第一次 sync 会从 Hugging Face 数据集 `open-index/hacker-news` 读存档，再从 Algolia（hn.algolia.com）逐天补最近一年的数据。会很慢，需要联网。
- 只想重新渲染已有的两条视频的话，不需要索引：它们用到的当天首页数据已经在仓库里（`videos/src/spike/frontpage-2017-11-03.json`、`videos/src/shots/2011-11-03-barrel-roll/frontpage.json`）。

### 6. 联网

这几步要联网：

- npm 和 PyPI 安装依赖
- 下载 Chrome Headless Shell
- 渲染时从 Google Fonts 下载字体
- 构建索引时访问 Hugging Face 和 Algolia

如果你的运行阶段默认断网，安装和 sync 放到环境初始化脚本里做；渲染阶段至少要放行 Google Fonts 的两个域名。

### 7. Windows 写法

`videos/README.md` 里有些命令写的是 `../.venv/Scripts/python.exe`，这是 Windows 的路径，Linux 上一律改用 `uv run python`。skill 里的命令已经是跨平台写法。

### 8. 不要用的旧东西

- `videos/scripts/daily.py images`（调用 grok-cli 生图）是已经放弃的旧流程，不需要安装 grok-cli。现在只用 `daily.py prepare` 生成候选。
- `videos/src/episode/`、`tunnel/`、`rings/` 是被否掉的原型，只是保留着，不要拿来做新视频。隧道原型（`TimeTunnel`）用的 AI 图片已从仓库删除，这个 composition 现在渲染不出来，属于正常情况。

## 验证环境是否跑通

```bash
uv sync
cd videos
npm ci
npx remotion browser ensure
npx remotion still src/index.ts GpuProbe out/gpu.png --log=verbose          # 云端应看到 SwiftShader
npx remotion still src/index.ts BarrelRoll out/check.png --frame=300        # 一帧，CPU 上十几秒
npx remotion render src/index.ts BarrelRoll out/barrel-roll.mp4 --crf=20    # 整片，CPU 上约 1 小时
```

已有的 composition：`TeardownShot`（iPhone X 拆解）和 `BarrelRoll`（Do a barrel roll），各 14 秒，都是竖屏。以后新做的一律是 1920×1080 横屏，见 skill。
