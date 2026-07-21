# ADR 0001 — Probe Model for Drift Detection

**Status**: Accepted  
**Date**: 2026-06-30  
**Context**: [CONTEXT.md](../CONTEXT.md)

## Problem

The original health check used "dimensions" as its organizing concept — a
mixed bag where categories, individual checks, procedures, and configuration
all lived under one label. This made it unclear:

- What to do when a single check in a dimension failed (whole dimension fails?)
- How to add a new check (new dimension? new sub-item?)
- How the agent knew it was done (no completion criteria between dimensions)
- What language to use for outcomes ("dead", "drifted", "healthy" used
  interchangeably)

## Decision

Adopt a **probe model** built around drift detection:

- **Drift probe** — an atomic, single-concern check that produces exactly one
  outcome: `pass`, `fail`, `unknown`, or `conflict`.
- **Probe set** — a named group of related probes sharing a concern. Passes
  when every probe in the set passes without unknowns or conflicts. Failures
  are reported individually within the set.
- **Drift anchor** — a timestamped reference state that probes compare
  against. Not updated without explicit human confirmation.
- **Drift correction** — auto-remediation attempted only when the repair is
  idempotent, the failure is unambiguous, and no data is lost. Otherwise:
  flag only.
- **Drift report** — the output document. One line when all nominal;
  structured table when drift is detected.

## Rationale

Three concerns drove this:

1. **Completion criteria.** Without knowing when a probe set is "done", the
   agent can skip checks or stop early. Each probe set now has a checkable
   completion criterion ("every probe in this set has an outcome recorded").
2. **Outcome consistency.** Before, "dead", "drifted", "stale", "missing",
   and "unreachable" were all used to mean different failure modes at
   different sites. Four discrete outcomes collapse that space and make
   aggregation across probe sets mechanical.
3. **Config vs procedure separation.** Thresholds, paths, and known facts
   live in `REFERENCE.md`. The skill body has only the execution model.
   Changing a temperature threshold doesn't require editing the agent
   instructions — it's a data change.

## Tradeoffs considered

**Flat list of probes (no grouping).** Simpler to write, but the number of
probes will grow (10+ currently, likely 15+ over time). Without grouping
there is no way to say "MCP health is fine" — only 3 individual MCP probe
outcomes. Grouping adds a level of indirection but makes the report readable.

**Dimension model (status quo).** Already shown to be ambiguous — "dimension"
contained everything from one-line curl checks to multi-step config audits.
The word didn't recruit useful priors from the agent's training. Replaced.

**Drift as the leading word.** "Drift" recruits a specific pretrained concept
(detection against a known reference) more consistently than "health" (which
is vague) or "compliance" (which implies policy, not system state). The
tradeoff is that drift implies a continuous process, while the check is
discrete — but this is fine because each run re-anchors against the same
snapshot, making the discrete check a drift measurement.

## Consequences

- Probes now have a uniform interface: input (reference value, current value,
  threshold) → output (one of 4 outcomes).
- Adding a new probe means: define the measurement, define the threshold,
  declare which probe set it belongs to. No new agent logic needed.
- The drift anchor file needs a `failure_count` field per MCP server for the
  3-strikes escalation rule.
- The old "Dimension" vocabulary is deprecated in all docs. CONTEXT.md
  records the mapping for readers of old briefs.
