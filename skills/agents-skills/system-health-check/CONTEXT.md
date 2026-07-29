# System Health Check — Domain Glossary

## Core

- **Drift probe** — An atomic check that measures a single dimension of the system against a known reference. Produces exactly one outcome. Example: "Does context-mode respond (ctx stats)?"
- **Drift anchor** — The reference state a probe compares against on each run. Usually a timestamped snapshot (baseline file). Not updated without explicit consent.
- **Drift correction** — An auto-remediation step that restores a drifting component to its expected state. Only attempted when the repair is idempotent, the failure is unambiguous, and no data can be lost. If any of the three is uncertain → flag-only.
- **Drift report** — The output document (/tmp/system-health-brief.md) aggregating all probe outcomes and any corrections applied.

## Outcome

Every probe produces exactly one outcome:

- **pass** — the measured value matches the drift anchor within threshold.
- **fail** — the measured value deviates beyond the threshold, or the component is in an unexpected state (dead, missing, corrupt).
- **unknown** — the probe could not determine the state (binary missing, permissions, network unreachable).
- **corrected** — the probe found a failure and the drift correction was applied successfully. The measured value is now within threshold.
- **conflict** — the probe found contradictory evidence (git repo both dirty and behind upstream, config file valid but semantically inconsistent).

## Structure

- **Probe set** — A named group of related drift probes, sharing a concern (e.g. MCP health, config integrity). Passes if every probe in the set passes or corrects without unknown/conflict. Failures are reported individually within the set so the reader sees exactly which probe failed.
- **Checkpoint** — The point after completing a probe set where the agent verifies all probes in that set have been recorded before moving to the next. Not a pause — a completion gate.

## Deprecated

- **Dimension** → superseded by Probe Set. A "dimension" mixed categories, probes, and procedures into one concept. No longer used.
- **Baseline** → superseded by Drift Anchor. "Baseline" implied a statistical window (average over time), but the current implementation is a single timestamped snapshot. Drift anchor is precise.
- **Auto-remediate** → superseded by Drift Correction. The old term described intent; the new term describes what actually happens (restoring a known-good state).
