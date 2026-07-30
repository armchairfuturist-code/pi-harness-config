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
