# skillopt-pi — scored gate for ce-lite (SEED)

The live orchestrator is **ce-lite**. This directory is not a second router.
It is the offline *evaluate* contract: deterministic tasks that score a ce-lite
edit the same way SkillOpt's held-out gate scores a skill.

Session-driven training is already wired: `scripts/skillopt-sleep-nightly.sh`
targets `ce-lite/SKILL.md`. Use this path only after that loop has proven the
gate on live traffic. Two optimizers at once is thrash.

## Train target
`bundled-skills/ce-lite/SKILL.md` — not `seed-skill.md`. The seed is a fallback
overlay if that file is missing.

## What is here
- `tasks.json` — Lookup / Simple / Contract tasks. Each has a `route` tag and a
  `check` command (exit 0 = pass).
- `scorer.py` — runs each `check` in a clean temp workspace. No LLM, no network.
- `seed-skill.md` — fallback overlay (compose with ce-lite; do not fork it).
- `fixtures/multiply/` — T3 bug fixture.

## Remaining work (later)
1. `pi_exec` backend in the SkillOpt checkout (model on sleep `PiCliBackend`).
2. `skillopt/envs/pi_coding/` adapter + YAML pointing `--target-skill-path` at
   `bundled-skills/ce-lite/SKILL.md`.
3. Gate score = mean task pass rate, plus this repo's canaries.
4. Fold a trained artifact back into ce-lite only via HIL.

*Done (this scaffold):* tasks tagged by ce-lite route; scorer runs; train target
named; no second orchestrator in `seed-skill.md`.
