# Pi Harness Config

A measured, generic Pi configuration that maximizes useful capability while minimizing fixed prompt cost. The default kernel contains tools used across ordinary coding sessions; domain research and deep harness auditing are optional profiles.

## Design rules

1. Every fixed token must serve most sessions.
2. Skills and documentation stay on disk and load lazily; registered tool schemas are the main idle cost.
3. Event-specific guidance is injected only after the event, not carried in the permanent system prompt.
4. Benchmarks use a temporary HOME, snapshotted pinned packages, a vendored capture proxy, and an exact tool inventory.
5. Published numbers name commit, date, model/tokenizer, package lock, patch state, repetitions, and loaded tools.

## Default kernel

- CE-lite: thin plain-language orchestrator.
- context-mode + pi-lean-ctx: file, shell, execution, indexing, and retrieval.
- pi-dynamic-workflows: research/review/fan-out when work genuinely decomposes.
- pi-slim + pi-tscg: system/tool-schema compression. The default description floor is 30 characters; lower values require semantic-canary evidence.
- transcript-pruner: DEDUP, STALE, and CLEAR; measured long-session savings with no fixed schema cost.
- session-index: extractive cross-session summaries without an LLM call.
- runtime-discipline: failure-triggered recovery guidance and a cache-stable UI handoff reminder.
- small cache, continuation, safety, and usage packages listed in `settings.json`; six UI-only pi-essentials extensions are loaded by explicit path so its tool extensions do not auto-register.

The default deliberately excludes recent-discourse schemas, durable harness-reporting packages, MCP expansion, context-mode admin tools, and every domain-specific tool.

## Optional profiles

```fish
./scripts/profile.sh enable research  # last30days tools; adds fixed schemas
./scripts/profile.sh disable research
./scripts/profile.sh enable audit     # Better Harness slash-command review
./scripts/profile.sh disable audit
```

Profiles are functional additions, not default-kernel claims. Re-run the probe after enabling one.

## Install

```fish
git clone https://github.com/armchairfuturist-code/pi-harness-config
cd pi-harness-config
./install.sh                        # install packages + deploy kernel; preserve live provider/model
./scripts/harness-preflight.sh
```

`install.sh` reads `packages.lock.json` and runs `pi install` with exact
pinned versions, then copies all config, extensions, skills, and patches into
`~/.pi/agent/`, removes obsolete files, and applies the version-gated patches.

Flags:
- `--settings` — also overwrite provider/model with repo defaults
- `--skip-packages` — skip `pi install` (use when packages are already installed)
- `--check` — dry-run: report drift without writing

### Editing this repo (sync direction)
The **top level of this repo is the source of truth.** `install.sh` deploys it into
`~/.pi/agent/` — the *live* harness runtime, which is not committed (it holds generated
`sessions/`, `npm/`, `node_modules/`, etc.).

- **To change config:** edit the top-level source (`extensions/`, `memory/`, `settings.json`,
  `skills/`, …), re-deploy with `./install.sh --skip-packages`, verify with
  `./scripts/harness-preflight.sh`, then commit + push. Do not edit `~/.pi/agent/` directly —
  a later `install.sh` would overwrite it.
- **If you edited `~/.pi/agent/` live:** copy the file back to the matching top-level path
  first, then deploy. Example: `cp ~/.pi/agent/extensions/transcript-pruner.ts extensions/transcript-pruner.ts`
- **Runtime env vars** (pruner + lean-ctx tuning) are machine-level shell exports, not agent
  config — see [`lean-ctx/env.tuning.sh`](lean-ctx/env.tuning.sh).

## After `pi update --all`

`pi update` overwrites patched files in `node_modules/`. Re-apply patches:

```fish
./install.sh --skip-packages    # re-deploys config + re-applies patches
./scripts/harness-preflight.sh  # verify patches are present
```

If preflight reports a missing patch, the upstream source shape changed.
Update the patch anchors in `patches/` and the version in `packages.lock.json`.

## Verify

```fish
./install.sh --check --settings
./scripts/harness-preflight.sh
./bench/probe.sh
./bench/semantic-canary.sh
```

## Token floor

Measured with `Lilac/zai-org/glm-5.2` through a cold-gated capture proxy.
"Reply with exactly: OK" single-request floor (input + cacheRead + cacheWrite).

| Config | Tokens | Tools | Date | Source |
|---|---|---|---|---|
| OMP v16.4.3 | ~16,800 | 11 | 2026-07-22 | `docs/wayfinder-agents-optimization.md` |
| Pi pre-CE-lite | 5,789 | ~25 | 2026-07-27 | commit `c9cd69f` message |
| Pi CE-lite baseline | 4,014 | ~22 | 2026-07-27 | commit `c9cd69f` |
| Pi drifted master | 5,750 | 31 | 2026-08-05 | commit `93ec746` |
| **Pi optimized (this repo)** | **3,757** | **17** | **2026-08-05** | **commit `68a7080`** |

OMP figure is per-request average across a 3-request task (different
methodology — multi-request total / 3). All Pi figures are single-request
floors with identical probe methodology.

**Result: 3,757 tokens — 78% below OMP, 6% below prior CE-lite best, 35% below drifted master.**

The probe writes raw captures and manifests under `.scratch/` (gitignored). It fails unless exactly one request succeeds and the payload excludes domain, research-profile, and context-admin schemas.

## Extensions

| Extension | Fixed schema cost | Value |
|---|---:|---|
| transcript-pruner | none | Reduces repeated/stale/spent tool results in long sessions |
| session-index | none | Cross-session retrieval pointers without model calls |
| runtime-discipline | none until triggered | Recovery guidance after actual failures; UI-only long-session reminder |

## Repository map

- `settings.json` — generic default profile
- `profiles/` — optional package profiles
- `packages.lock.json` — expected package versions
- `APPEND_SYSTEM.md` — thin CE-lite hook
- `HARNESS.md` — reusable policy source of truth
- `extensions/` — generic local extensions only
- `lean-ctx/` — lean-ctx config; `env.tuning.sh` holds the machine-level shell exports
  (transcript-pruner + ephemeral-firewall tuning) applied via your shell rc
- `scripts/` — install, patch, profile, and validation tools
- `bench/` — isolated probe, capture proxy, and semantic canaries
- `research/` — historical evidence; not injected into idle prompts

Historical token figures in `research/` describe their recorded configuration. They are evidence, not promises for current master or another model.
