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
something **on this machine** (edit an extension, script, skill, or
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
(extensions/, scripts/, patches/, bundled-skills/, HARNESS/APPEND_SYSTEM/AGENTS,
packages.lock.json) and deliberately **excludes machine-local files**
(settings.json provider/model/thinking, models.json, model-thinking.json,
pi-smart-btw.json, auth.json, memory/, npm/, tscg.json). That boundary is what
keeps a multi-machine repo from drifting into loops.

**Never run git commands in `~/.pi`** — it is the live agent parent, not the
clone. The pre-push guard blocks pushes from there; use the Projects clone.


## CE-lite (how the agent works)

You do not need slash commands. Ask for the work.

**One step or a question** — the agent just answers or does it.

**More than one step** (a fix, a feature, several files) — the agent states a few yes/no checks, does the work, and a **shield** proves those checks. The statusline shows `ce 2/3`. Green means done. Red means fix the failed check.

You never type `ce_open`, `ce_audit`, or `ce_close`.

What happens without you asking:

- Long sessions compact automatically. Do not tweak KEEP / tscg.
- On compact, the host writes `.scratch/HANDOFF.md` so the next shift can resume.
- When the shield goes green, a line is appended to `~/.pi/memory/solutions.md`.
- If the work splits into independent lanes, the agent uses `workflow()` (fresh session per worker).

Details for agents: `bundled-skills/ce-lite/SKILL.md`.

## Skills we keep

Only these live under `~/.pi/agent/skills/`. Extra dirs are pruned on install.

- `ce-lite` — how the agent ships work
- `smart-read` — how to open files (size limits belong in the tool, not the skill)
- `harness-doctor` — `./scripts/harness-doctor.sh`
- `context-rot-forensics` — post-hoc session log analysis (runtime is `rot-sentinel.ts`)
- `graph-engineering` — optional; design a `workflow()` DAG
- `shard-security` — optional; sandbox / creds

Slash-only (not in this repo, not auto-loaded, not pruned): `impeccable`, `last30days`, `teach`, `writing-for-agents`. Invoke with `/skill:name`.

Dropped: poor-mans-distill, triage, wait-what.

Ponytail is a git package, not this list.


## What lives where

| Source | Live dest |
|--------|-----------|
| `settings.json` | `~/.pi/agent/settings.json` **and** `~/.pi/settings.json` (packages stay in lockstep; provider/model/thinking stay local) |
| `packages.lock.json` | allowlist + pins. Extra live packages are pruned on install. |
| `models.json` | **not in the repo.** Machine-local. Venice (and others) stay here. |
| `extensions/`, `scripts/`, `patches/` | `~/.pi/agent/` |
| `bundled-skills/` | `~/.pi/agent/skills/` |
| `HARNESS.md`, `APPEND_SYSTEM.md`, `AGENTS.md` | `~/.pi/agent/` |

`install.sh --check` ignores `lastChangelogVersion` (pi writes it). `~/.config/lean-ctx/config.toml` is runtime-owned; the tool-profile pin is enforced by `scripts/enforce-tool-profile.sh`, not by byte-diff.

## Essential packages

Only these stay in `settings.json` / `packages.lock.json`:

- `@ogulcancelik/pi-model-thinking` — thinking levels
- `context-mode` — MCP / context-mode
- `pi-lean-ctx` — tool surface
- `pi-slim` — slim runtime
- `pi-tscg` — compaction (HIL-locked)
- `@quintinshaw/pi-dynamic-workflows` — workflows
- `@samfp/pi-essentials` — session UX
- `@howaboua/pi-smart-btw` — `/btw`
- `@howaboua/pi-skill-model-facing-api-design` — skill
- `git:github.com/DietrichGebert/ponytail` — ponytail mode (git, not in the npm lock)

Anything else on a machine is dropped on the next `./install.sh`. Live version pins for allowlisted names are kept.

## models.json

Pi schema: each model's `input` is `"text"` and/or `"image"` only. Do not add `audio` or `video`. `harness-doctor.sh` fails if you do.

Venice: fetch `https://api.venice.ai/api/v1/models`, map into the existing shape, clamp `input`.

## Locked knobs

KEEP / compaction / tscg: `hil/HANDOFF.md`. Do not edit those files because a session feels slow.
