# Context-tooling alternatives vs live pi config

**Date:** 2026-08-10 · **Assessor:** agent session (research + live-config audit)
**References evaluated against:** [lean-ctx v3.9.18](https://github.com/yvgude/lean-ctx/releases/tag/v3.9.18) + [pi-tscg 0.2.4](https://pi.dev/packages/pi-tscg)
**Stack under test:** live `~/.pi` (pi-coding-agent 0.84.x), repo `~/Projects/pi-harness-config` @ `eb66486`

## TL;DR

The live stack already covers every capability axis the researched alternatives
sell. Net-new candidates worth considering: **agentmemory** (cross-harness
memory), **pi-readseek** (anchor-verified structural reads; heavy overlap with
lean-ctx), **@tscg/mcp-proxy** (non-pi harnesses only). Everything else is
redundant, wrong-runtime, or Claude-Code-specific. Two REAL findings came out of
verification, not the research: a broken lean-ctx tool-profile watchdog, and a
`ctx_read` byte-fidelity anomaly in the pi-lean-ctx bridge.

## Live stack (deployed ~/.pi/agent, package lock 2026-08-10)

| Layer | Component | Covers |
|---|---|---|
| Read/context engine | pi-lean-ctx 3.9.18 (replace, toolProfile lean, MCP bridge ON, 5 admin tools disabled) | 10 read modes, read cache (~13 tok re-reads), shell compression (95+ patterns), tree-sitter, session memory (CCP), savings ledger |
| Tool-result/schema | pi-tscg 0.2.4 (aggressive, `aggressiveMaxDescChars=20`, stripParamDesc; patched: deep recursive truncation) + @tscg/core 1.4.3 | schema −8–50%, result head/tail truncation, prompt-cache awareness |
| Context window | context-mode 1.0.169 (patched: admin schemas removed) | sandboxed exec (98% reduction), intent-filtered FTS5 KB, session continuity (SQLite) |
| Prefix/cache | pi-cache-optimizer 2.8.2 (ex pi-deepseek-cache-optimizer) | stable prefix ordering, DeepSeek auto-cache, `prompt_cache_key` fallback, footer stats |
| Session hygiene | transcript-pruner (DEDUP/STALE/CLEAR, KEEP=3), session-index, runtime-discipline, rot-sentinel | spent-result pruning, extractive cross-session index, recovery guidance, context-rot detection |
| Prompt floor | pi-slim, @samfp/pi-essentials, model-thinking, HARNESS/APPEND_SYSTEM | trimmed system prompt, 4.0–4.1k floor, terse directives |
| Verification | bench/probe.sh, bench/semantic-canary.sh, harness-preflight.sh | fixed overhead, semantic behavior (read/search/edit), config/patch/watchdog closure |

## Candidate verdicts (research 2026-08-10)

| Candidate | What it is | Verdict on this stack |
|---|---|---|
| TSCG family (@tscg/core, @tscg/mcp-proxy, @tscg/tool-optimizer, @tscg/openclaw) | deterministic schema compression engine + adapters | Already have core via pi-tscg (aggressive + patched). mcp-proxy only relevant for non-pi harnesses' MCP catalogs → optional |
| tokenfold (snchimata) | lossless provider-neutral compression + receipts (CLI/lib/proxy/MCP) | Compression axes already owned (TSCG/lean-ctx); receipts duplicate lean-ctx ledger. Not a pure reporting metric in general, but ≈0 net value here → skip |
| leanctx SDK (jia-gao) | LLMLingua-2 prompt compression, Python | Lossy ML compression on code vs your deterministic ceilings; wrong runtime → skip |
| LLMLingua (microsoft) | prompt compression research | Lossy, not harness-integrated → skip |
| ashlar | dedup tool reads + output trim + savings tracking | Covered by lean-ctx read cache + transcript-pruner → skip |
| jettison | repo map + read pruning + prose compression | Covered by lean-ctx map/signatures/density modes → skip |
| JaimeJunr/context-engine | Claude Code/MCP drop-in token saver + BM25/PageRank maps | Claude-Code-targeted, redundant → skip |
| repomix / gitingest / code2prompt | one-shot repo packing | Orthogonal to a live read tool → skip |
| graphify | codebase→knowledge-graph skill | Overlaps lean-ctx property graph + graph-engineering skill → skip |
| goldfish / dexterity / repolens / RepoMap-AI / repomap | token-budgeted repo maps | lean-ctx map/signatures + BM25 graph cover → skip |
| Pruner / permafrost / claude-code-cache-fix / ostk-cache | Claude-Code(-proxy) cache fixes | No Anthropic/Claude Code; cache work already owned by pi-cache-optimizer (+ DeepSeek) → skip |
| mem0 / letta / langmem / basic-memory | general memory frameworks | Framework weight; pi memory covered by lean-ctx CCP + context-mode SQLite + pi-continue → skip |
| claude-mem | session-memory compression (CC/OpenCode/OpenClaw) | No pi adapter; agentmemory is the cross-agent alternative → skip |
| pi-memory | pi-native qmd semantic memory | Redundant with context-mode FTS5 + lean-ctx memory → skip |
| pi-rtk-optimizer | RTK rewrite + output compaction | Requires `rtk` binary (deliberately removed 2026-07-30); lean-ctx ctx_shell + pi-tscg Lever 2 already compact → skip |
| repoprompt-ce | macOS context-engineering app + MCP CLI | macOS-native, different audience → skip |

### Consider (genuinely new, with caveats)

1. **agentmemory** (rohitg00, 26.8k★) — the one real gap: memory is per-harness
   (lean-ctx CCP in pi; reasonix own; codex fork none). agentmemory is explicitly
   multi-agent (pi, OpenCode, Codex, Hermes, OpenClaw, MCP), benchmark-backed
   (retrieval + ~170K tok/yr vs 19.5M paste). Caveat: always-on injection; past
   always-on additions destabilized (lean-ctx footers 07-29, prune explosion).
   Gate with bench/semantic-canary + probe before/after.
2. **pi-readseek** (jarkkojs) — LINE:HASH-anchored ops, hash-verified edits
   (stale-anchor rejection, plan_hash). Differentiator vs lean-ctx: relational
   invariant guard on write-after-partial-read. Cost: ~8 tool schemas; core repo
   archived (continues at gitlab.com/jarkkojs/readseek). Optional.
3. **@tscg/mcp-proxy** — only if non-pi harnesses (codex fork app-server,
   reasonix) consume large MCP catalogs.

## Verification evidence — 2026-08-10

### harness-preflight.sh (repo @ eb66486 vs live ~/.pi/agent)
- All checks **OK** except:
- **BAD tool profile drift: runtime=power repo=lean — run 'lean-ctx tools lean'**
- Analysis: CLI profile vocabulary is `minimal|standard|power` only
  (`lean-ctx tools <profile>` help, 3.9.18). `tool_profile = "lean"` in
  `lean-ctx/config.toml` is a **bridge-only** value (pi-config.json toolProfile),
  which the CLI ignores → runtime stays `power` (83 tools). The watchdog as
  written can never pass while config.toml holds `lean` → **HIL decision needed**:
  either pin a CLI-valid profile in config.toml or change the watchdog to read
  the pi bridge profile. Note: pi's per-turn schema cost is controlled by the
  bridge toolProfile (lean), not the CLI state, so this is likely a false alarm
  for the 4k-token floor — verify before "fixing".

### bench/semantic-canary.sh — FAILED (read case)
- Failure is a **canary assertion flake, not a harness regression**:
  - Model DID call `ctx_read` (session evidence: `chatcmpl-tool-*`,
    `"toolName":"ctx_read"`, source `lean-ctx-bridge`, mode `full`).
  - Assertion greps **case-sensitive** `'alpha needle omega'` against the final
    reply `'Alpha needle omega.'` → never matches.
- But the capture exposed a real anomaly: the wire tool result sent to the API
  was `Alpha needle omega.` while the file was `alpha needle omega\n`
  (hexdump-verified). CLI `lean-ctx read` IS byte-faithful (probe). So the
  **pi-lean-ctx MCP bridge ctx_read result is not byte-faithful** (capitalizes,
  adds period, strips newline) for prose inputs. Low impact for code, but this
  is exactly the "trust the bytes" invariant class the canary exists to catch.
  → HIL ticket: probe bridge ctx_read fidelity with a mixed-case fixture and
  hexdump the captured request; fix assertion case-sensitivity in the same pass.

### Config drift (repo vs live)
- **REAL:** `settings.json` + `model-thinking.json` pin glm-5.2 thinking `high`
  (repo); live runs `xhigh` (defaultThinkingLevel xhigh). config_hash: repo
  `b1f41d078d31` vs live `baf617e9fd45` (memory baseline `7aec62dd4a62` stale).
  Decide: commit xhigh or revert live to high.
- **NOT drift (verified against git history / repo pins):**
  - `aggressiveMaxDescChars=20` = current HIL state (Iter-12 KEEP,
    ef10fd4 2026-08-08; supersedes 5 and 30). consolidated.md note ("5 optimal")
    is stale.
  - `enableMcp: true` = pinned in repo `lean-ctx/pi-config.json` (matches
    deployed). The "bridge-off is load-bearing" memory note predates it.

## Reproduce

```bash
cd ~/Projects/pi-harness-config
PI_AGENT_HOME=/home/alex/.pi/agent bash scripts/harness-preflight.sh
bash bench/semantic-canary.sh            # 3 LLM calls, ~2-8 min, uses local OI proxy :4599
bash bench/probe.sh                      # fixed overhead
# fidelity probe (non-LLM):
printf 'alpha needle omega\n' > /tmp/x.txt && lean-ctx read /tmp/x.txt
```

**Sources:** GitHub/npm/pi.dev metadata + READMEs fetched 2026-08-10; live
evidence from preflight/canary captures (`.scratch/captures/semantic-1786364992-93112`).
