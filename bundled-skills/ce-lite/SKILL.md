---
name: ce-lite
description: "Multi-step shipping: grill if fuzzy, checkable contract, shield proves it. Lookup and one-step work skip the loop."
---

# CE-lite

Host does proof, compact, handoff, and compound. You do the work.

## Route

1. **Lookup** — answer from memory or existing files. No contract.
2. **Simple** — one step, unambiguous, low-consequence. Do it. No contract.
3. **Contract** — two or more steps, a deliverable, or irreversible. Run the loop.

Novice: ask for the work. Do not type `/skill`, `ce_open`, or `/compact`.

## Contract loop

1. **Grill** if fuzzy. One question at a time. Default and move. See `grilling.md`.
2. **Terms** — 2–5 yes/no checks. Path exists or command exits 0. No judgment terms. The shield records writes/tests and audits on settle. Do not call `ce_open` / `ce_audit` / `ce_close`.
3. **Diagnose, then execute**
   - Neither high → stay here.
   - Context high → selective read, then continue. Host writes HANDOFF on compact/rot.
   - Action high, terms do not share writes → `workflow()`. Fresh session per `agent()`.
   - Both → `workflow()`; isolation/worktree only if a lane must not share cwd.
   - Judgment (review, “is this good”) → `gather-judge.md`. Never a shield term.
4. **Verify** — statusline is the score. Green = closed. Red = fix the failed check. A follow-up with `reason: no open contract` means already closed; continue the user task.
5. **Compound** — host appends to `~/.pi/memory/solutions.md` on green. You may add one line. Do not invent another store.

**Footer:** `Done: n/m · artifacts: … · risks: … · next: …`  
Counts come from the shield. Do not claim Done if the statusline is red.

## Worker safety

No destroy, force-push, or mass-rewrite without consent. Stay in declared paths. No creds, cookies, or remote social. If a worker must exceed scope, stop and report.

## Load only when needed

- `grilling.md` — fuzzy goal
- `gather-judge.md` — judgment over evidence
- `context-health.md` — HANDOFF schema (host writes it)
- `wayfinding.md` — resume / tickets / memory
- `reference.md` — worker result fields, workflow authoring

TDD when the change is logic: tests before the implementation.

## Self-test (first load)

`grilling.md`, `gather-judge.md`, `context-health.md`, `wayfinding.md`, `reference.md` must exist next to this file. If one is missing, use this file alone and say so.
