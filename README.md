# pi-harness-config

Shared pi agent home. One repo, many machines.

**Do not freestyle KEEP / compaction / tscg.** Those go through HIL (`hil/HANDOFF.md` + `hil/ledger.md`). Runtime policy: `HARNESS.md` + `APPEND_SYSTEM.md`.

This file is current context only. Session logs hold history.

## Sync this machine

The git clone is **not** the live agent. Pi reads `~/.pi/agent/` (and `~/.pi/settings.json`). `./install.sh` copies the repo into those dirs. `git pull` alone does nothing to the running agent.

```bash
cd ~/Projects/pi-harness-config && git pull && ./install.sh && ./scripts/harness-doctor.sh
```

Then restart pi.

Agent copy-paste prompt:

```
Apply the pi-harness-config master to this machine's live pi config.
The clone (~/Projects/pi-harness-config) is not live. Pi reads ~/.pi/agent/ and ~/.pi/settings.json.
1. cd ~/Projects/pi-harness-config && git pull
2. ./install.sh   # this is the apply step — copies repo into ~/.pi/agent/ and syncs ~/.pi/settings.json packages
3. ./scripts/harness-doctor.sh  # fix every FAIL
4. Tell the user to restart pi
Do not add packages that are not in packages.lock.json. models.json input may only be "text" or "image". Provider and model routing stay machine-local. git pull without install.sh is not a sync.
```

`--check` is dry-run (compare only). `--skip-packages` skips `pi install`.

### Ship a local tweak to the repo (and other machines)

The apply flow above goes **repo → this machine**. When you instead tweak
something **on this machine** (edit a script, skill, or
`HARNESS.md`/`APPEND_SYSTEM.md`/`AGENTS.md` inside `~/.pi/agent`) and want it
on other machines, capture it back into the repo, commit, push, then apply:

```bash
cd ~/Projects/pi-harness-config
./scripts/capture-live-tweak.sh            # dry-run: shows what differs
./scripts/capture-live-tweak.sh --apply    # copies live ~/.pi/agent -> repo
git add -A && git commit -m "tweak: <describe>" && git push origin master
# on each other machine:
cd ~/Projects/pi-harness-config && git pull && ./install.sh && ./scripts/harness-doctor.sh
```

Use the script instead of hand-copying — it only touches repo-owned source
(scripts/, patches/, bundled-skills/, HARNESS/APPEND_SYSTEM/AGENTS,
packages.lock.json) and deliberately **excludes machine-local files**
(settings.json provider/model/thinking, models.json, model-thinking.json,
pi-smart-btw.json, auth.json, memory/, npm/, tscg.json). That boundary is what
keeps a multi-machine repo from drifting into loops.

**Never run git commands in `~/.pi`** — it is the live agent parent, not the
clone. The pre-push guard blocks pushes from there; use the Projects clone.


## How the agent works

You do not need slash commands. Ask for the work.

- **One step or a question** — the agent just answers or does it.
- **More than one step** (a fix, a feature, several files) — the agent does the work and verifies it with shell checks.
- Long sessions compact automatically. Do not tweak KEEP / tscg.
- On compact, the host writes `.scratch/HANDOFF.md` so the next shift can resume.
- If the work splits into independent lanes, the agent uses `workflow()` (fresh session per worker).

## Skills we keep

Only these live under `~/.pi/agent/skills/`. Extra dirs are pruned on install.

- `smart-read` — how to open files (size limits belong in the tool, not the skill)
- `harness-doctor` — `./scripts/harness-doctor.sh` (includes context-rot analysis)
- `graph-engineering` — optional; design a `workflow()` DAG
- `shard-security` — optional; sandbox / creds

Slash-only (not in this repo, not auto-loaded, not pruned): `impeccable`, `last30days`, `teach`, `writing-for-agents`. Invoke with `/skill:name`.

Dropped: ce-lite, poor-mans-distill, triage, wait-what.

Ponytail is a git package, not this list.


## Updating

`pi update --all` updates pi and npm extensions but **NOT** the lean-ctx Rust binary.
The binary has its own updater. Always use the unified wrapper:
```bash
~/.pi/agent/scripts/update-all.sh           # full update: pi + extensions + lean-ctx binary + skills + sync check
~/.pi/agent/scripts/update-all.sh --check    # version sync check only
```
This closes a gap that caused 495 MCP bridge errors across 121 sessions (Jul-Aug 2026):
the npm package (3.9.18) and binary (3.9.15) drifted, causing protocol-mismatch failures.
The preflight check in `harness-doctor/scripts/preflight.py` catches this drift.

After `pi update --extensions`, patches are re-applied automatically by `install.sh`
(via `scripts/apply-package-patches.sh`). This includes the pi-lean-ctx MCP bridge
resilience patch (force-reconnect on internal errors, strips "Please retry" text).

## What lives where

| Source | Live dest |
|--------|-----------|
| `settings.json` | `~/.pi/agent/settings.json` **and** `~/.pi/settings.json` (packages stay in lockstep; provider/model/thinking stay local) |
| `packages.lock.json` | allowlist + pins. Extra live packages are pruned on install. |
| `models.json` | **not in the repo.** Machine-local. Venice (and others) stay here. |
| `scripts/`, `patches/` | `~/.pi/agent/` |
| `bundled-skills/` | `~/.pi/agent/skills/` |
| `HARNESS.md`, `APPEND_SYSTEM.md`, `AGENTS.md` | `~/.pi/agent/` |
| `lean-ctx/config.toml` | `~/.config/lean-ctx/config.toml` (runtime) and `~/.pi/agent/lean-ctx/config.toml` |
| `lean-ctx/pi-config.json` | `~/.pi/agent/extensions/pi-lean-ctx/config.json` |
| `lean-ctx/env.tuning.sh` | `~/.config/lean-ctx/env.tuning.sh` |

The lean-ctx **binary** (`~/.local/bin/lean-ctx`) is NOT installed by this repo. It is
a standalone Rust binary distributed via GitHub releases. Install it with:
```bash
curl -fsSL https://github.com/yvgude/lean-ctx/releases/latest/download/lean-ctx-x86_64-unknown-linux-gnu.tar.gz | tar xz -C ~/.local/bin/
lean-ctx init --agent pi --mode replace
```
Then keep it updated with `~/.pi/agent/scripts/update-all.sh`.

`install.sh --check` ignores `lastChangelogVersion` (pi writes it). `~/.config/lean-ctx/config.toml` is runtime-owned.

## Essential packages

Only these stay in `settings.json` / `packages.lock.json`:

- `@ogulcancelik/pi-model-thinking` — thinking levels
- `context-mode` — MCP / context-mode
- `pi-lean-ctx` — tool surface
- `pi-slim` — slim runtime
- `pi-tscg` — compaction (HIL-locked)
- `@quintinshaw/pi-dynamic-workflows` — workflows
- `@samfp/pi-essentials` — session UX
- `@narumitw/pi-btw` — `/btw` side-thread
- `git:github.com/kartikkabadi/pi-handoff` — `/handoff` session handoff
- `@howaboua/pi-skill-model-facing-api-design` — skill
- `git:github.com/DietrichGebert/ponytail` — ponytail mode (git, not in the npm lock)

Anything else on a machine is dropped on the next `./install.sh`. Live version pins for allowlisted names are kept.

## models.json

Pi schema: each model's `input` is `"text"` and/or `"image"` only. Do not add `audio` or `video`. `harness-doctor.sh` fails if you do.

Venice: fetch `https://api.venice.ai/api/v1/models`, map into the existing shape, clamp `input`.

## Locked knobs

KEEP / compaction / tscg: `hil/HANDOFF.md`. Do not edit those files because a session feels slow.

## Cleanup (2026-08-15)

Removed ~5,800 lines of over-engineered extensions and scripts:

- **ce-lite shield/auditor/tests** (1,402 lines) — reinvented CI/CD for a single-user agent session. Git + tests + the task prompt already do this.
- **rot-sentinel** (345 lines) — loop/error/stall detector. Reinvents pi's built-in compaction and retry.
- **prune-core + transcript-pruner** (492 lines) — transcript pruning. Pi's native compaction (`reserveTokens: 24000, keepRecentTokens: 20000`) handles this.
- **session-index + runtime-discipline** (245 lines) — session indexing and runtime bans. Pi has built-in session management and tool controls.
- **enforce-tool-profile** (.ts + .sh + systemd timer, 516 lines) — tool profile enforcement. The `config.toml` `tool_profile` setting is sufficient.
- **unattended-loop.mjs** (619 lines) — supervisor with rot detection. The simple `unattended-loop.sh` shell loop suffices.
- **base64_bench.py** (556 lines) — hand-rolled morse-code encoder for a token-counting benchmark.
- **workload-deterministic.mjs** (505 lines) — tested speculative pruning edge cases for code that no longer exists.

The `extensions` array in `settings.json` is now empty — pi's built-in compaction handles everything the deleted code did.

**Other machines:** `git pull && ./install.sh` prunes the dead files automatically (they're in the OBSOLETE array). The `enforce-tool-profile` systemd timer is also disabled and removed. Check `~/.pi/agent/settings.json` — if it still has an `extensions` array referencing deleted files, clear it or re-run `./install.sh`.
