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

# Install the pinned default package set once (see packages.lock.json).
pi install npm:@ogulcancelik/pi-model-thinking@0.1.0 \
  npm:@plannotator/pi-extension@0.25.1 npm:cc-safety-net@1.0.6 \
  npm:context-mode@1.0.169 npm:pi-autoresearch@1.6.2 \
  npm:pi-cache-graph@1.0.2 npm:pi-cache-optimizer@2.8.0 \
  npm:pi-context-usage@1.0.2 npm:pi-continue@0.9.3 \
  npm:pi-herdr-btw@0.3.0 npm:pi-lean-ctx@3.9.17 \
  npm:pi-slim@0.2.1 npm:pi-tscg@0.2.4 \
  npm:@quintinshaw/pi-dynamic-workflows@3.5.0 \
  npm:@samfp/pi-essentials@0.2.3

./install.sh                 # deploy generic kernel; preserve live provider/model
./install.sh --settings      # use repo provider/model defaults too
./scripts/harness-preflight.sh
```

## Verify

```fish
./install.sh --check --settings
./scripts/harness-preflight.sh
./bench/probe.sh
./bench/semantic-canary.sh
```

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
- `scripts/` — install, patch, profile, and validation tools
- `bench/` — isolated probe, capture proxy, and semantic canaries
- `research/` — historical evidence; not injected into idle prompts

Historical token figures in `research/` describe their recorded configuration. They are evidence, not promises for current master or another model.
