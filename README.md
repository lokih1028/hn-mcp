# hn-mcp

Hacker News as a knowledge base for AI agents. An MCP server that gives Claude Code
(or any MCP client) about 4.8 million HN stories since 2006 in a local DuckDB index,
plus live access to comment threads and this week's stories.

把 Hacker News 二十年的帖子变成 AI Agent 的知识库：本地 DuckDB 索引（约 480 万条 story）
+ 实时评论树和最新帖子。适合技术选型调研、趋势分析、内容选题。

## Tools

| Tool | What it does | Source |
|---|---|---|
| `search_stories` | Title search (whole words, `"phrases"`, `prefix*`), filter by period, score, domain | local index |
| `topic_trend` | Mentions of up to 8 terms per year/month, normalized per 1,000 stories | local index |
| `domain_report` | A site's HN track record: volume by year, score stats, best stories | local index |
| `on_this_day` | Top stories posted on this calendar day in every year | local index |
| `run_sql` | One sandboxed, read-only DuckDB `SELECT` over the `stories` table | local index |
| `get_thread` | A story's comment tree in HN ranking order, as plain text | live (Algolia + HN API) |
| `search_recent` | Stories from the last N days | live (Algolia) |
| `index_status` | What the local index covers | local index |

Example prompts once it is installed:

- "Before I adopt Bun, what has HN said about it since 2022? Summarize the top 3 threads."
- "Chart rust vs go vs zig on HN per year."
- "How does substack.com perform on HN compared to medium.com?"
- "What were the top HN stories on this day 10 and 15 years ago?"

## Install

Requires [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/lokih1028/hn-mcp && cd hn-mcp
uv sync
uv run hn-mcp sync            # builds the story index, ~20 min, ~380 MB
```

`sync` reads only the story columns from the
[open-index/hacker-news](https://huggingface.co/datasets/open-index/hacker-news)
Parquet archive (12 GB in full), one file per month, into `~/.hn-mcp/stories/`.
Run it again later to fetch new months; `--from 2020-01` limits the range.
Set `HN_MCP_DATA` to keep the index somewhere else.

Register with Claude Code:

```bash
claude mcp add hn -s user -- uv --directory /path/to/hn-mcp run hn-mcp
```

Or in any MCP client config:

```json
{
  "mcpServers": {
    "hn": {
      "command": "uv",
      "args": ["--directory", "/path/to/hn-mcp", "run", "hn-mcp"],
      "env": { "HN_MCP_DATA": "/path/to/data" }
    }
  }
}
```

## Notes

- Deleted and dead (flagged/spam) stories are left out of the index.
- The archive can lag behind HN; `index_status` shows where the local index ends and
  `search_recent` covers the gap.
- `run_sql` runs on a DuckDB connection that can only read the index folder: no other
  file access, no extensions, one `SELECT` statement per call.
- Comments are not stored locally; `get_thread` fetches them live, so it needs network.

## Development

```bash
uv run pytest
```

## License and data

Code: MIT. Data: the open-index/hacker-news dataset is published under
[ODC-BY](https://opendatacommons.org/licenses/by/1-0/); content belongs to its
Hacker News authors. Attribute the dataset if you republish derived data.
