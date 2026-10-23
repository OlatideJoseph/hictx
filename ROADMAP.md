# hictx — what it is, and what's missing

## What it is
**hictx ("history context") captures *why* a codebase is the way it is** — not what the
code does — and makes it queryable. It mines git history + GitHub (mostly automatically)
into a connected graph of four things:

- **Incidents** — what broke
- **Code changes** — the commits/PRs that caused or fixed them
- **Decisions** — ADRs / the rationale behind changes
- **Root causes** — why a bug happened

…linked by typed, provenance-tagged edges (`caused_by`, `implements`, `affects`,
`supersedes`). It serves that context back as a **Graph** (the connected core), a
**Review** queue (confirm/reject inferred links), and a **Story** (timeline + AI
narrative) for a whole repo or a single file.

**The payoff:** when an AI (or a new engineer) rewrites, migrates, debugs, or onboards
onto a codebase, they get the invisible knowledge — the 3am-outage fix, the retry logic
that exists because of a decision two years ago — instead of silently dropping it.

## Built so far
Phases 1–5 scaffolding; clone-based ingestion; GitHub issues + PR adapters; ADR
ingestion; SZZ-lite incident→commit linker; change→decision linker + LLM link-drafter;
Phase-4 retrieval; a React frontend (Connect / Review / Graph / Story) with a provider-
agnostic LLM layer (Anthropic / OpenAI / Gemini); and an **MCP server** that exposes the
captured context as tools any AI coding agent can call (`get_file_context`, `get_file_story`,
`get_repo_story`, `find_files`). ~129 backend tests.

## What's missing (prioritized, honest)

### 1. The premise is still unproven with a real number  ← most important
The Phase-5 evaluation (does captured context *measurably* improve an AI task, with vs.
without) has the machinery but **no real LLM-judged result on a real repo**. This is the
single thing that validates the whole idea. Needs: a provider key, a real target repo,
and a defined metric (e.g. "N edge-case fixes preserved that a context-free port drops").

### 2. Capture density is thin
Automatic change→decision linking is sparse on real repos (korifi: 3 of 26 ADR mentions),
and the keyword drafter is noisy. The LLM drafter should help but is **untested on real
data**. Capture/freshness is the make-or-break; it's the weakest link.

### 3. No freshness / live sync
One-shot backfill only. **No GitHub App or webhooks** for incremental push / PR / issue
events, and no webhook signature verification. Data goes stale — the exact decay the
product exists to fight.

### 4. Half the graph is often empty
`caused_by` / incident edges need an issue source (GitHub issues / PagerDuty / incident.io
/ Jira). Many repos' issues are deleted (httpx) or that integration isn't built, so the
incident half frequently doesn't populate.

### 5. Not productionized
API is `AllowAny` (no auth / multi-tenancy). SQLite + a background **thread** (not
Postgres + a durable worker); sessions aren't durable across restart. No deployment / CI.
LLM generation is synchronous in the request (bounded, but should move to a worker).

### 6. The migration payoff is delivered via MCP, not yet a workbench
Phase-4 retrieval now reaches AI agents through the **MCP server** (see MCP.md) — the
context is queryable at coding time. What's still missing: an in-app rewrite/explanation
*workbench* for humans, and a measured result that using the MCP tools actually improves
agent output (this is the same unproven premise as #1 — now easy to test: same agent,
with vs. without the hictx MCP tools).

### Smaller / polish
- Per-file story curation and the graph view get noisy at scale.
- Logo flat/mono variants; PNG/ICO export.
- Root-cause LLM drafting isn't surfaced in the connect flow.

## The strategic question (decide early)
Is this a one-shot **migration tool** (high-value, rarely needed, data assembled in a
panic) or a **continuously-useful context graph** (onboarding, debugging, fewer repeat
incidents) with migration as one payoff? The build has leaned toward the continuous
framing (Story, onboarding) — the more defensible business — while the migration wedge
remains the unvalidated bet.
