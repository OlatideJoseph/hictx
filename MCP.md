# hictx MCP server

Exposes hictx's captured context as tools any AI coding agent can call **while it
works** — so the agent gets the invisible "why" (decisions, past incidents, root
causes) before it modifies, reviews, or ports a file.

## Tools
- `list_repositories()` — repos hictx has captured.
- `get_file_context(repository, path)` — the decisions a file implements, the
  incidents a change to it caused, and their root causes. **Call before editing/porting a file.**
- `get_file_story(repository, path)` — the file's history (changes + decisions/incidents).
- `get_repo_story(repository)` — the repo's notable history, chronologically.
- `find_files(repository, query)` — locate a file path before the calls above.

## Run it
```bash
cd workload
uv run python manage.py mcp_serve      # speaks MCP over stdio
```

## Register with an agent

**Claude Code:**
```bash
claude mcp add hictx -- uv run --directory /ABS/PATH/TO/hictx/workload python manage.py mcp_serve
```

**Any client (`.mcp.json` / config):**
```json
{
  "mcpServers": {
    "hictx": {
      "command": "uv",
      "args": ["run", "--directory", "/ABS/PATH/TO/hictx/workload", "python", "manage.py", "mcp_serve"],
      "env": { "PYTHONUTF8": "1" }
    }
  }
}
```

The server reads the same database the web app writes to, so connect a repo in the
app first (Connect tab / `ingest_repo`), then the agent can query its context.

## Why this matters
It turns hictx from a dashboard you open into a context layer your agent queries on
every task — the delivery mechanism for the product's core promise ("feed the model
the why so the rewrite preserves intent"). It's also the cheapest way to prove that
promise: the same agent, with vs. without the hictx tools, on a real change.
