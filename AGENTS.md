# 给 AI 代理的说明（Codex 等）

这个仓库只有一件事：`src/hn_mcp/` 里的 Hacker News MCP 服务器，和它使用的本地故事索引。功能和工具列表见 `README.md`。所有回复用简体中文。

## 在云端（Linux）运行需要准备的东西

### 1. 运行环境

- Python ≥ 3.12 和 [uv](https://docs.astral.sh/uv/)。在仓库根目录运行 `uv sync`。
- 不需要 GPU，也不需要 Node。

### 2. 故事索引

索引约 421 MB，不在仓库里（`.gitignore` 排除了 `/data/`），需要自己准备：

```bash
HN_MCP_DATA=$PWD/data uv run hn-mcp sync
```

- 仓库的 GitHub Release 里有预构建的索引快照（`hn-index.zip`，约 420 MB，数据截至 2026-11-02）。第一次 sync 会直接下载它，再从 Algolia 补上之后的几天，几分钟就能完成。
- 只有加 `--no-snapshot` 时，才会从 Hugging Face 数据集 `open-index/hacker-news` 从头构建，要好几个小时。
- 不设 `HN_MCP_DATA` 时，索引默认放在 `~/.hn-mcp/`。
- 日常保持新鲜：`uv run hn-mcp sync --live-only`。

### 3. 联网

下面这些步骤要联网：安装依赖（PyPI）、下载索引快照（GitHub Release）、补最近几天的数据（Algolia）、`get_thread` 和 `search_recent` 实时查询（Algolia 和 HN API）。如果运行阶段默认断网，把 `uv sync` 和 `sync` 放到环境初始化脚本里做。

## 验证

```bash
uv sync
uv run pytest -q
HN_MCP_DATA=$PWD/data uv run hn-mcp sync
```

## 历史

这个仓库曾经带过一套「HN 上的今天」纯代码视频流程（Remotion + three.js，目录 `videos/` 和 skill `hn-oneshot-video`），后来整体移除，只保留 MCP。需要找回时，查看标签 `video-pipeline-final`：

```bash
git checkout video-pipeline-final
```
