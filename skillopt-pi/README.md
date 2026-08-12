# skillopt-pi — offline benchmark-driven skill training (SEED, later/harder)

Status: **scaffold only.** The session-driven path (SkillOpt-Sleep) is already
wired in `scripts/skillopt-sleep-nightly.sh`. This directory is the *offline*
counterpart: a pi coding benchmark env for the paper-style `skillopt/` CLI
(`skillopt-train`), which trains a skill against fixed, scored tasks instead of
harvested sessions.

## Why this exists
- `poor-mans-distill` proved session-trace → few-shot *works* but is manual and
  keyword-classifier-limited. SkillOpt-Sleep replaces it for daily use.
- For a *reproducible, benchmark-defined* ce-lite/smart-read skill (comparable
  across model epochs), SkillOpt's `skillopt/envs/<name>/` needs a pi env:
  tasks + a deterministic scorer + a `pi_exec` backend.

## What is here
- `tasks.json` — 6 deterministic pi coding tasks (from this repo's own A/B set:
  list-files, fix-multiply-bug+changelog, add-function, grep-locate, rename,
  add-changelog-entry). Each has a `check` shell command (exit 0 = pass).
- `scorer.py` — runs each task's `check` in a clean temp workspace and returns
  per-task pass/fail + aggregate score (the SkillOpt env `evaluate` contract).
- `seed-skill.md` — starting skill (ce-lite routing + read/verify discipline).
- `fixtures/multiply/` — the T3 bug fixture (multiply returns wrong result).

## Remaining work (to make it a real SkillOpt env)
1. Add a `pi_exec` backend in the SkillOpt checkout (`skillopt/model/pi_backend.py`
   modeled on `codex_backend.py` / the sleep `PiCliBackend`): run `pi -p` with the
   seed skill injected, collect the final message, run the task `check`.
2. Add `skillopt/envs/pi_coding/` (adapter + dataloader + rollout + YAML) using
   `tasks.json` + `scorer.py`; register in `skillopt/model/__init__.py` + configs.
3. Train: `skillopt-train --config configs/pi_coding/default.yaml` with a
   gate score = mean task pass rate; keep the repo canaries as the acceptance bar.
4. Fold the trained `best_skill.md` back into `bundled-skills/ce-lite/` only via
   the HIL gate (probe + semantic-canary + trajectory_metrics green).

Do NOT run this path until the session-driven SkillOpt-Sleep loop has proven the
gate metric on real traffic. Two optimizers at once is thrash.
