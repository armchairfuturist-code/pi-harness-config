# Gather-judge split

Disclosed from `SKILL.md`. Read when a contract term requires judgment over gathered evidence — not just a build-check.

The problem: when the same context gathers evidence and evaluates it, the gatherer's framing leaks into the judgment. The gatherer searched here, not there; formed a hypothesis; cherry-picked. The judge inherits that bias.

The split enforces separation architecturally: the verifier IS the judge, but operates in a fresh context that sees only evidence packets, never the gatherers' reasoning.

## When to use

- Financial calls, architecture choices, risk assessments.
- "Should we" questions with conflicting evidence.
- Any decision where the person gathering evidence must not be the same context evaluating it.

For simple build-verification (did the code pass tests, does the file match the spec), the standard same-context reviewer pass in step 6 is fine.

## How to run

Run the `gather-judge-split` workflow (`~/Projects/pi-harness-config/workflows/saved/gather-judge-split.js`) via `workflow({ script: <file>, args: { question, context } })`.

The workflow enforces the split:
1. **Gather** — cheap model (tier `small` → mercury-2 / gemini-flash) gathers evidence-only packets in parallel. Each packet is structured `{ subtask_id, data_points, raw_notes }`. The gatherers' `decisions` field is enforced empty — violations stripped.
2. **Judge** — strong model (tier `big` → GLM-5.2 / kimi-k3) judges the packets in a fresh context. The judge never sees gatherer prompts, search paths, or intermediate hypotheses — only the structured packets.
3. **Verify** — medium model adversarially verifies the judgment against the evidence.
