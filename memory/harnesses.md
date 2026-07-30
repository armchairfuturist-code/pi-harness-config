# Harness Inventory — verified 2026-07-29

## Active harnesses (3)
- **pi** — @earendil-works/pi-coding-agent, fnm node v24 global, config `~/.pi`. Goal: token efficiency (lean-ctx + context-mode stack).
- **codex** — opencodex fork (@bitkyc08/opencodex 2.7.39, bins `codex`/`ocx`/`opencodex`): `~/.local/bin/codex` shim → `codex.opencodex-real`; app-server :10100; config `~/.codex` + `~/.opencodex`; desktop app `/opt/codex-desktop` (`~/.config/Codex`). Goal: general/full-feature (LifeOS candidate).
- **reasonix** v1.18.0-preview.1 — config/plugin-driven multi-model coding agent, fnm global bin `reasonix`, config `~/.reasonix` (config.toml, memory/, projects/, skills/). Modes: interactive, print, run, review, serve (HTTP+SSE), acp.

## Adjacent tooling (not harnesses)
- lean-ctx v3.9.8, context-mode, impeccable skill (`~/.impeccable`, `~/.agents`), herdr 0.7.5 (unverified). hypa — NOT installed (npm target gone; broken shim removed 2026-07-30; `~/.hypa` is data residue). Do NOT invoke hypa: 522 command-not-found failures in 30 days came from agents trying it.
- **pi add-ons REMOVED 2026-07-30**: `~/.pi-lens` (533M), `~/.pi-glla`, `~/.pi-meter`, `~/.autoresearch-pi` — verified unreferenced by settings/extensions/skills/rc/systemd before deletion. Also pruned: compact-backups, readcache, tmp session dirs, .bak files, empty `.agents`/`projects-memory` dirs.

## Ghosts / residue — NOT installed
- **omp + rtk + headroom — REMOVED 2026-07-30**: `omp`/`rtk`/`rtkr`/`headroom`/`audit-upgrade` binaries, `~/.omp`, `~/.rtk-data`, `~/.config/rtk`, `~/.headroom`, audit-upgrade systemd units, and headroom env blocks in .bashrc/.zshrc/.profile all deleted. Do not assume they exist; reinstall per-harness only on explicit ask.
- `~/.copilot` (no binary)
- `~/.cursor` — DELETED 2026-07-29 (lean-ctx/impeccable artifact; Cursor never existed)
- Empty npm scope dirs in fnm node_modules: `@gitlawb`, `@google`, `@opencode-ai` = uninstall residue, not packages.

## Detection — enumerate, never name-match
Authoritative sources on this machine:
1. `ls ~/.local/share/fnm/node-versions/*/installation/bin` (npm globals)
2. `ls ~/.local/bin` (FULL listing — never pipe through head)
3. Cross-ref: binary + own `~/.<name>` config dir = harness candidate
4. Verify each unknown with `--help` before classifying
5. `lean-ctx status`/`doctor` as cross-check only — it has its own catalog bias

## Maintenance rules
1. After any install/remove: re-run detection, update this file.
2. Decline non-existent harness targets in installers (`.cursor` ghost made agents believe Cursor existed).
3. npm uninstalls leave empty `@scope` dirs — ignore them, they are not tools.
