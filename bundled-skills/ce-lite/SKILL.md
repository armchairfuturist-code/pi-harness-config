---
name: ce-lite
description: "Automatic shield proves multi-step work. Lookup and one-step work skip the loop."
---

# CE-lite

The shield is automatic: it watches your writes and passing tests, turns them
into mechanical checks, and audits on settle. The statusline shows the score.
Green = done. Red = fix the failed check, then settle again.

- Do not call `ce_open` / `ce_audit` / `ce_close` — the shield does it.
- Do not claim Done when the statusline is red.
- A follow-up `reason: no open contract` means already closed; continue the task.

Host does proof, compact, handoff, and compound. You do the work.

## Load only when needed

- `grilling.md` — fuzzy goal: one question at a time
- `gather-judge.md` — judgment over evidence
- `context-health.md` — HANDOFF schema (host writes it)
- `wayfinding.md` — multi-session tickets / resume
- `reference.md` — worker result fields, workflow authoring

Footer: `Done: n/m · artifacts: … · risks: … · next: …`
