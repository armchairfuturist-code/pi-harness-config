# skillopt-pi — scored gate for ce-lite

The live orchestrator is **ce-lite**. This directory is not a second router.

## Why Sleep nights are the wrong default
SkillOpt-Sleep's Pi backend hardcodes `pi -p --no-tools` and judges **reply
text**. Harvested chores (GEO audit, models.json sync) then score ~0.18 and the
gate correctly rejects. Turning tools on would still not see whether a file
check passed.

## The path that can actually score this harness
`eval.py` runs `pi -p` **with tools** in a temp workspace, then applies the
same filesystem `check` as `scorer.py`. Injected skill = `bundled-skills/ce-lite/SKILL.md`.

```bash
python3 skillopt-pi/eval.py --dry-run          # setup+check only
python3 skillopt-pi/eval.py --only t0-lookup-multiply
python3 skillopt-pi/eval.py                    # full suite (calls pi)
```

*Done (eval):* each task has a yes/no workspace check; Lookup must not mutate
(t0 empty-rollout pass); Contract/Simple require the agent to change files.
Baseline 2026-08-12: **7/7** after fixing t3's path mismatch (was 6/7).

## Train target
`bundled-skills/ce-lite/SKILL.md`. `seed-skill.md` is fallback overlay only.

## What is here
- `tasks.json` — Lookup / Simple / Contract + `check`
- `scorer.py` — empty-workspace baseline (no LLM)
- `eval.py` — pi-with-tools + filesystem score (the SkillOpt *evaluate* half)
- `fixtures/multiply/` — T3 bug

## Remaining (train half)
Sleep's optimizer can propose edits; **this** eval is the gate, not Sleep's
text judge. Do not `skillopt-sleep adopt` from harvested nights. A later
step is to feed `eval.py`'s score into SkillOpt's accept/reject. Two
optimizers at once is still thrash — run eval, then one bounded edit.
