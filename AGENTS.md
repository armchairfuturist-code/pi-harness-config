# Projects Workspace
No monorepo, no shared locks. Subdirs are independent git repos.

## Output Contract
Terse by default. Answer/code first, no preamble, fragments over sentences, ≤120 words unless asked for more. Full contract: `~/.claude/CLAUDE.md` (overrides verbose task briefs).

## Projects
| Dir | Stack | Test | Lint/Type | Deploy |
|---|---|---|---|---|
| `Investment-Engine/` | Py 3.11+ MCP | `pytest -q` | `ruff check` | Docker (stdio MCP) |
| `Investment-Engine/web/` | Next.js (see gotcha) | — | — | — |
| `bio-orchestrator/` | Py 3.10 Streamlit | `pytest` | `ruff check` | — |
| `novel-writer-harness/` | Py 3.10 CLI | `pytest -v` | — | — |
| `FALA/` | Py 3.10 CLI | `pytest -v` | `ruff check` + `mypy` | — (local CLI) |
| `ArmchairFuturistLanding/` | Next 16, TS | `vitest` | `tsc --noEmit` | Firebase |
| `mindscape-site/` | Next 16, TS | `vitest run` | `eslint` | Cloud Run |
| `rooted-leader-site/` | React 19, TS | `vitest` | — | Firebase |
| `resume-pipeline/` | Node/Puppeteer util | — (no tests) | — | — |

## Conventions
- **Per-project context:** Read local `AGENTS.md` and check `docs/agents/` first.
- **Agent Skill framework:** Subprojects use the `setup-matt-pocock-skills` pattern (canonical triage labels, GH Issues tracker, `CONTEXT.md` + `docs/adr/`).
- **Python:** Each dir manages its own `.venv`. Install via `pip install -e ".[dev]"` (or `-r requirements.txt`), except where noted.
- **Web:** Run `npm ci && npm run build` for a build check.
- **Git/GitHub:** Use `gh` CLI. Commit as `Alex Myers <alex@thearmchairfuturist.com>`.

## Gotchas
- `Investment-Engine`: CI installs `[dev]` only (skips heavy non-test extras). It has a **separate Next.js frontend** in `Investment-Engine/web/` whose `AGENTS.md` warns: "this is NOT the Next.js you know — read `node_modules/next/dist/docs/` before editing." Heed this for any web changes.
- `bio-orchestrator`: No CI — tests never run automatically. Optional extras `[llm]`/`[methylation]`/`[pdf]` (install `[all]` for everything). Root `*.json` (bloodwork, dna_markers, etc.) are example fixtures, not real data.
- `novel-writer-harness`: Runs from source — never installed; every `storyforge.py` and test does `sys.path.insert(0, ...)`. Requires `CROFAI_API_KEY` env var at startup.
- `FALA`: `pip install -r requirements.txt`, then separately `pip install piper-tts` for optional voice (not in requirements). `.env` auto-loads; needs `FALA_API_KEY` (free Groq) to run. Lint via `scripts/lint.sh`.
- `ArmchairFuturistLanding`: Deploy takes ~3-4 min (GCP build). Do not interrupt.
- `mindscape-site`: Run `scripts/cloudflare-zone-setup.sh` once, not in CI. E2E suite is `npm run test:e2e` (Playwright); `build` typechecks via `next build`, not a separate tsc script.
- `rooted-leader-site`: Build runs `scripts/fetch-substack.mjs` before `vite build`.
- `resume-pipeline/`: Standalone `resume-to-pdf.js` — `node resume-to-pdf.js <input.md> [output.pdf]`. Needs `puppeteer` and a cached Chrome; no package.json or tests.

@HYPA.md

## Session Guardrail
Every assistant turn re-sends the entire conversation as input, so session cost grows quadratically with turn count. A 400-turn session costs ~160,000x a 1-turn session in input tokens. When this session exceeds 50 assistant turns, STOP and suggest to the user: "This session is getting long (N turns). Consider running /handoff to start a fresh session — it will save significant token cost. Shall I /handoff now?" If the user agrees, run /handoff. If they decline, continue but re-suggest at 100 turns. This is not optional.
