# Project Context

You are helping me build a software product. This document is the full context.
Read it before proposing anything. When a decision has real tradeoffs, lay them
out and let me choose rather than picking silently. Be honest about what's hard;
don't just build the easy parts.

## What we're building

A system that captures the **context around a codebase** — not just what the
code does, but *why it's shaped that way* — and turns it into structured data
that an AI can use to rewrite (migrate) the codebase into another language
without losing intent.

## The core insight

When an AI or a person rewrites a codebase into another language, they only see
*what the code does*. The most valuable knowledge is invisible in the source:
the edge case someone patched after a 3am outage, the retry logic that exists
because of a decision made two years ago, the "this looks wrong but it's
load-bearing" code. A naive port faithfully reproduces bugs and silently drops
hard-won fixes, because it never had that context.

So we capture the connected history — as a graph linking four things:

- **Incidents** — what broke
- **Code changes** (commits / PRs) — what caused or fixed them
- **Decisions** (ADR-style) — the rationale and tradeoffs behind changes
- **Root causes** — why the bug happened

At migration time, for each module we retrieve its connected subgraph and feed
it to the model alongside the source, so the rewrite preserves intent.

## The hard problem (do not lose sight of this)

Storing this data is trivial. The thing that makes or breaks the product is
**capture and freshness**. Engineers hate documenting "why," so systems like
this rot into stale, untrusted data (the classic "observability decay loop").

Therefore the whole game is making capture *nearly automatic*:
- Infer links from `git blame` + PR/commit references ("fixes #123",
  "implements ADR-7") rather than asking people to draw them.
- Have a model *draft* structured root causes from postmortems + diffs, for
  one-click human confirmation.
- Never require anyone to write essays. Cheap capture beats perfect capture.

Every inferred link carries provenance (who/what drew it, a confidence score, a
status of inferred→confirmed/rejected, and the evidence used) so the UI can say
"guessed at 0.6 — confirm or reject," and so we can later filter to only trusted
edges when feeding context to a migration.

## Landscape / positioning

Both halves exist separately — plenty of AI code-migration tools, and an
emerging category of decision/incident knowledge graphs — but nobody has
assembled them *specifically to power a rewrite*. That gap is the opening.

Open strategic question (decide early, it shapes everything): is this a one-shot
**migration tool** (high-value but rarely needed, data assembled in a panic), or
a **continuously useful context graph** (onboarding, debugging, fewer repeat
incidents) with migration as one payoff? The continuous framing is a much easier
business to sustain because daily use keeps the data fresh.

## Scope: build the wedge, not the platform

Don't build the whole product. Build the capture-and-link layer over ONE real
codebase and prove that the captured context measurably improves an AI task (a
migration, or even just code explanation) versus no context. If it does, we have
a wedge. If it doesn't, we learned that cheaply.

Phases:
- **Phase 0** — Scope: pick one repo + one concrete task; define a success
  metric now (e.g. "N edge-case fixes preserved that a context-free port drops").
- **Phase 1** — Data model + ingestion. *(DONE — see below.)*
- **Phase 2** — Automatic linking (the hard, valuable core): incident→cause
  commit via blame + fix references; change→decision via PR/commit refs;
  incident→root cause via an LLM draft. Confidence score on every inferred edge.
- **Phase 3** — Capture UX: a lightweight "why?" prompt at PR-open time;
  one-click confirm/correct on every AI-drafted link.
- **Phase 4** — Retrieval + the test: pull a module's connected subgraph, run
  the task with and without it, compare.
- **Phase 5** — Evaluate honestly against the Phase 0 metric.

Critical-path risk lives in Phases 2 and 3, not 1 and 4.

## Tech stack and principles

- **Python, Django + DRF, PostgreSQL.** Chosen because the workload is
  relational-graph modeling + API/webhook ingestion + text parsing + LLM calls,
  all of which suit this stack — not merely familiarity.
- **Relational, not a graph DB (yet).** Entities as tables, typed edges as join
  tables. Postgres handles this at prototype scale and keeps referential
  integrity. Reach for a graph DB only if deep multi-hop traversal becomes the
  bottleneck *after* the premise is proven.
- **Idempotent ingestion everywhere.** Every externally-sourced row has a natural
  unique key so re-running backfill or replaying webhooks updates rather than
  duplicates.
- **Do NOT let the migration target leak into the tool's own stack.** What
  language the product helps people migrate *to* is unrelated to what the tool
  is written in. The tool is a data-ingestion-and-retrieval app.

## Data model (Phase 1 — already designed and validated)

Entities (each hangs off a `Repository`): `Decision`, `CodeChange` (commit/PR),
`CodeEntity` (file/module/class/function), `Incident`, `RootCause`.

Edges:
- `CodeChange --implements--> Decision` — inferred edge table, with provenance.
- `Incident --caused_by--> CodeChange` — inferred edge table, with provenance.
- `CodeChange --affects--> CodeEntity` — factual, straight from the diff.
- `RootCause --explains--> Incident` — plain FK (an incident may have several
  contributing causes).
- `Decision --supersedes--> Decision` — self-referential FK.

Inferred edges share a base carrying: `source` (heuristic / llm / human),
`confidence` (float 0–1, CHECK-constrained), `status` (inferred / confirmed /
rejected), `evidence` (JSONB), and reviewer fields. Root causes carry the same
provenance because they're usually LLM-drafted then human-confirmed.

The Django models and generated Postgres schema for this already exist.

## Input point (GitHub)

GitHub is the first ingestion adapter (the model has a `provider` field because
incidents often come from PagerDuty / incident.io / Jira, not GitHub).

- **Prototype:** a command/endpoint that takes a repo URL + personal access
  token, clones it, and runs a one-time **backfill** — walk history for
  commits/diffs (from the clone), layer PR/issue metadata from the API.
- **Production:** a **GitHub App** (scoped tokens, higher limits, webhooks). A
  webhook endpoint ingests `push` / `pull_request` / `issues` events
  incrementally. Verify the webhook signature before trusting any payload.
- **Keep a persistent local clone** of each repo and `git fetch` on push — it's
  what makes `git blame` (and therefore the Phase 2 linker) possible without
  fighting API rate limits.

## Current status

Phase 1 is done: the data model is built, migrates cleanly, and a sample
incident→change→decision→root-cause traversal works. **Next up is Phase 2 — the
automatic incident-to-commit linker** — the part that decides whether the whole
idea works.

## How to help me

Start by confirming you understand the idea and then help with whatever I ask
next. Prefer small, verifiable steps. Flag the hard/risky parts explicitly
instead of glossing them. When you make an assumption, state it.
