# 01 — Inventory local corpus

Type: task
Status: resolved
Blocked by:

## Question

What is the current Pi harness surface area and what actually gets used?

Produce a cited inventory artifact under `research/wayfinder/` that covers:

1. **Live** `~/.pi/agent`: packages, extensions, skills, rules, agents, settings/compaction, tool surface
2. **This repo** `pi-harness-config` (current iteration / GitHub baseline weight)
3. **Session evidence** under `~/.pi/agent/sessions` — approximate skill/tool/package touch frequency where recoverable
4. **Historical notes** across home/Projects (grep broadly: harness, pi-config, optimization, progressive disclosure, wayfinder) — list paths + one-line gist; **weight newer + pi-harness-config over older attempts**
5. **Always-on cost hooks**: how to run `bench/probe.sh` / measure fixed overhead on live config; record baseline method (number can be filled when probe is run)

Output: `research/wayfinder/01-inventory-local-corpus.md` with keep-kill *candidates* (not final decisions) and open measurement gaps.

This unblocks topology and keep/kill grilling; it does not decide the architecture.

## Answer

Inventory complete. Artifact: [`research/wayfinder/01-inventory-local-corpus.md`](../../../research/wayfinder/01-inventory-local-corpus.md)

**Gist:** Live runtime = 17 packages, 7 extensions, 26 matt skills, delegate+herdr-btw, no domain skills loaded. Sessions (~809) show implement/research/goal/loop more than full matt chains. Probe method documented; baseline number still a gap. Keep/kill candidates listed — not decided.
