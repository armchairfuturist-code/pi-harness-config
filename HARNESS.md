# Pi agent harness contract

Source of truth for **agent-home** behavior. Installed/live path: `~/.pi/agent/HARNESS.md`.
Project/workspace maps belong in `AGENTS.md` (short). `APPEND_SYSTEM.md` is a thin CE-lite strip only.

## Skills policy

| Class | Rule |
|-------|------|
| **Always available** | All on-disk skills under `skills/` may load when invoked / matched |
| **On-demand / manual** | Large skills (e.g. `last30days`) are **not always-on context**. They cost tokens only when the skill is actually loaded/used. Do not deny them solely for SKILL.md size. |
| **Denied** | None by default. Prefer slim entry files over denylists when a skill is truly always-injected. |

- CE-lite orchestrates triggers (`APPEND_SYSTEM.md`).
- `last30days` tools also ship via package; skill entry is OK to enable because load is manual/on-demand.
- Keep top-level `SKILL.md` files lean when practical; move bulk to `references/` for maintainability (not because idle size burns tokens).

### Skill triage (high level)

| Always useful | On-demand | Meta / audit |
|---------------|-----------|--------------|
| ce-lite, better-harness | last30days, invest-optimizer, research skills | harness-doctor, poor-mans-distill, context-rot-forensics, shard-security, graph-engineering |
| pi-dynamic-workflows (pkg) | domain skills under skills/ | codebase-audit via workflow tool |

## Tool execution policy

1. Prefer `ctx_read` / `ctx_edit` / `ctx_execute` / `ctx_batch_execute` / `ctx_grep` / `ctx_find` / `ctx_ls` over raw shell.
2. Never `python -c`, `python3 -c`, or shell heredoc into interpreters. Write a script file, then run it.
3. On edit "could not find": **never** retry identical text. Re-read the slice; or `sed`/`perl` via shell only when allowed.
4. After multi-file edits: cheap verify (search, JSON parse, targeted test) before done.
5. After first shell allowlist block: switch strategy; do not loop the same blocked shape.
6. `lean-ctx allow` only for rare audited commands.

## Runtime discipline (enforced)

Extension `extensions/runtime-discipline.ts` injects systemPrompt nudges when:

1. **Allowlist / interpreter block** — after lean-ctx permanent blocks (`python -c`, heredoc, etc.). Recovery: script file + ctx_* tools; never identical retry.
2. **Edit miss** — after edit/ctx_edit context failures. Recovery: re-read slice; never identical old_string retry; cheap verify after multi-file edits.
3. **Long session** — after 60 minutes, 24 user turns, or 3+ compactions: require status block (status/done_so_far/files/next/verify). On close: end checklist with verify artifact.

Disable: `PI_RUNTIME_DISCIPLINE=0`. Thresholds: `PI_LONG_SESSION_MS`, `PI_LONG_SESSION_TURNS`, `PI_LONG_SESSION_COMPACTS`.

## Extensions (enabled)

settings.extensions should include:

- pi-essentials: auto-session-name, auto-title, clipboard-image, compact-header, image-context-pruner, markdown-viewer
- local: transcript-pruner, tool-trimmer, session-index, invest-tools, **runtime-discipline**

If an extension is documented here, it must appear in `settings.json`. No half-wired paths.

## Session hygiene

- Sessions >60 minutes or 3+ compactions: mid-flight status + end checklist (done/blocked, files, verify).
- Do not claim completion without a verification artifact when changes were made.
- session-index writes extractive summaries under `memory/sessions/` on shutdown — keep that enabled.

## Git / versioning

Track harness **intent**, not runtime debris.

| Track | Ignore |
|-------|--------|
| settings.json, HARNESS.md, AGENTS.md, APPEND_SYSTEM.md | sessions/ |
| skills/** (text sources) | skills/**/assets/ (media binaries) |
| agents/**, extensions source/config | npm/, node_modules/, .pi/, agent/git/ |
| context-prune/** | .env*, logs, dist/build, __pycache__ |

## Preflight

Run before committing harness changes:

```bash
~/.pi/agent/scripts/harness-preflight.sh
```

Checks: settings.json parse, no blanket `!**` skills deny, HARNESS/APPEND present, extension paths resolve, skills dirs exist.

## Inventory

Regenerate after skill/extension/settings mutations:

```bash
python3 ~/.pi/agent/skills/harness-doctor/scripts/inventory.py
```

Writes `harness-inventory.json`. Optional — may be gitignored; command is the source of truth.
