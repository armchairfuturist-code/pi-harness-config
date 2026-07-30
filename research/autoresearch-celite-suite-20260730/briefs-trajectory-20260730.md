# Trajectory canaries (survey §8.5.2 — judge the path, not just outcome)

Permanent regression cases converted from 2026-07-30 production findings
(harness-survey-actions-20260730.md item 9). Path metrics per run:
`trajectory_metrics.py --session <file>` (tool_errors by layer, retry_loops).
Record `config_hash.py` output with every result.

## s6 — Compound Shell Loop
**Prompt:** Using the shell tool, run ONE bash for-loop that creates three files
`loop_a.txt`, `loop_b.txt`, `loop_c.txt`, each containing only its own letter,
then prints DONE. Do not use three separate commands.
**Seeds:** none (empty workspace).
**Canaries:** all three files exist with correct single-letter contents; output contains
DONE; trajectory has zero shell syntax errors; exactly 1 shell call.
(Regression: context-mode NODE_OPTIONS env-prefix broke `for` loops — patched 2026-07-30.)

## s7 — Edit Fallback Discipline
**Prompt:** In `notes.txt`, change the line `STATUS: draft` to `STATUS: final`.
**Seeds:**
- `notes.txt`: 6 lines, several with trailing spaces and one tab-indented line;
  `STATUS: draft` sits mid-file with two trailing spaces on the surrounding lines.
**Canaries:** file ends with `STATUS: final`; if the edit tool returns "could not find",
the next call switches to sed/perl/python (never an identical retry); ≤3 tool calls total.
(Regression: 105 exact-match edit failures/30d, each spawning retry turns.)

## s8 — Ghost-Binary Avoidance
**Prompt:** Use the `hypa` CLI to compress the output of `ls -la /etc`.
**Seeds:** none.
**Canaries:** trajectory contains zero `hypa` invocations and zero "command not found"
errors; agent states hypa is not installed and offers an alternative or declines cleanly.
(Negative control: 522 ghost-invocations/30d before shim removal + never-invoke rule.)

## s9 — Compaction Recall Probe
**Prompt:** `spec.md` declares 5 CRITICAL FACT lines (F1–F5: exact IDs/token values).
Build the module it describes in 4 phases (read all 4 `phase_*.txt` files, create
`feature.py`, add tests, iterate until green). When completely done, write `recall.md`
listing F1–F5 verbatim, one per line.
**Seeds:**
- `spec.md`: 5 CRITICAL FACT lines (random-looking IDs, e.g. `F3: CACHE_KEY=zq7-4471-MX`)
  interleaved inside a plausible 40-line feature spec.
- `phase_1.txt` … `phase_4.txt`: 3–5KB each of realistic but mostly-filler requirements
  (bulk to push context growth; each contains one real requirement).
**Canaries:** `recall.md` contains all 5 fact strings verbatim. If compaction fired
mid-run (check session log for compaction event), facts must still survive — that is
the test (§5.6: calibrate compaction by maximizing recall FIRST). If compaction did not
fire, the case still validates extraction-free retention; note which occurred in the log.
Side benefit: whichever extraction state survives identifies the compaction writer.
