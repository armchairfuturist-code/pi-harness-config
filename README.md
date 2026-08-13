# pi-harness-config

Shared pi agent home. One repo, many machines.

**Do not freestyle KEEP / compaction / tscg.** Those go through HIL (`hil/HANDOFF.md` + `hil/ledger.md`). Runtime policy: `HARNESS.md` + `APPEND_SYSTEM.md`.

This file is current context only. Session logs hold history.

## Sync this machine

```bash
cd ~/Projects/pi-harness-config && git pull && ./install.sh && ./scripts/harness-doctor.sh
```

Agent copy-paste prompt:

```
Sync this machine to the pi-harness-config master: cd into the clone, git pull, run ./install.sh, then ./scripts/harness-doctor.sh. Fix every FAIL. Do not add packages that are not in packages.lock.json. models.json input may only be "text" or "image". Provider and model routing stay machine-local.
```

`--check` is dry-run. `--skip-packages` skips `pi install`.

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
