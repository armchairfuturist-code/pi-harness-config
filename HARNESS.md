# Pi agent harness contract

Installed to `~/.pi/agent/HARNESS.md`. Project-level guidance stays in `AGENTS.md` (workspace map).

## Skills policy

- On-disk skills under `skills/` are in-policy **except** `last30days` until its `SKILL.md` is slimmed (~217KB is too large to always-load).
- `settings.json` → `skills: ["!**/last30days/**"]`. Do **not** reintroduce blanket `!**`.
- CE-lite is the default orchestrator (`APPEND_SYSTEM.md` triggers).
- last30days **tools** may still come from the package; deny only the fat skill entry until slimmed (~5–8KB top-level + `references/`).

## Tool execution policy

1. Prefer `ctx_read` / `ctx_edit` / `ctx_execute` / `ctx_batch_execute` / `ctx_grep` / `ctx_find` / `ctx_ls` over raw shell.
2. Never `python -c`, `python3 -c`, or shell heredoc into interpreters. Write a script file, then run it.
3. On edit "could not find" / context miss: **never** retry identical text. Re-read the exact slice, then edit; or fall back to `sed`/`perl` via shell only when policy allows.
4. After multi-file edits: cheap verify (search, JSON parse, targeted test) before claiming done.
5. After the first shell allowlist block: switch strategy; do not loop the same blocked shape.
6. `lean-ctx allow` only for rare audited commands.

## Git / versioning (this repo)

Track harness **intent** in this repo; live machine paths are `~/.pi/agent` via `install.sh`.

| Track in repo | Do not commit |
|---------------|---------------|
| `APPEND_SYSTEM.md`, `HARNESS.md`, skills, extensions source | sessions, npm caches |
| `settings.json` (template; install optional) | secrets, `models.json`, auth |
| workflows, lean-ctx configs, memory notes | binary assets, `.env` |

`settings.json` is **optional** on install (`./install.sh --settings`) because provider/model differ per machine. Skills filter should stay shared.

## Session hygiene

- Sessions >60 minutes or 3+ compactions: mid-flight status + end checklist (done/blocked, files, verify).
- Do not claim completion without a verification artifact when changes were made.
