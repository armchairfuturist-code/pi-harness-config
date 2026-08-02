# Model Distillation Applied to Agent Harnesses — Research Assessment

**For:** pi coding-agent user (GLM-5.2 primary; Venice mercury-2/gemini-3-5-flash/kimi-k3; TokenRouter).
**Date:** 2026-08-02
**Source signals:** Digg cluster "Model Distillation Techniques Extend to Agent Harnesses" (Jul 31); Dettmers 10M-token eval-harness announcement (Jul 30); chrisliu298/awesome-on-policy-distillation (600★, 469 entries); ruvnet/metaharness (535★, learning-loop harness scaffold).

---

## 1. What "distilling an agent from code traces" actually means

Two distinct things are conflated in the discourse, and they have very different
cost profiles:

**(A) Weight-level distillation (the academic meaning).** A small "student"
model is fine-tuned so its token-level output distribution matches a large
"teacher" model on the same inputs. The 2026 state of the art is **on-policy
distillation (OPD)**: the student generates trajectories from *its own* policy,
and a teacher provides dense per-token supervision (KL/log-prob rewards) on
those student-visited prefixes. As of 2026 this is a standard post-training
primitive at Zhipu (GLM-5), DeepSeek (V4), Alibaba (Qwen3), Xiaomi (MiMo),
NVIDIA (Nemotron). The awesome-on-policy-distillation list has 469 entries, the
bulk from 2026, with well-characterized failure modes: instability, diversity
collapse, tokenizer mismatch, length-exploitation shortcuts.

"From code traces" specifically means: the training data is *agent session
trajectories* (input state → tool-call → next state), not plain text. The teacher
is the strong model (e.g. GLM-5.2) that produced the successful traces; the
student is a small open-weight model (e.g. a 7B/8B Qwen or Mistral) learning to
imitate the *action policy* — which tool to call, with what arguments, given the
context. This is functionally **behavioral cloning with a distillation loss**,
sometimes bootstrapped into RL (the teacher's agreement becomes a reward).

**(B) Trace-level distillation (the "poor man's" meaning).** No weights change.
You curate the best input→best-action pairs from successful sessions and reuse
them as **few-shot demonstrations** in a system prompt, or as a retrieved
skill-context. This is what's actually feasible for a solo dev *today*, and it
captures a large fraction of the behavioral transfer at ~0% of the cost. The
Digg cluster's "simplify agent harnesses and train agents from code traces on
isolated tasks" leans toward (B)-then-(A): start by isolating tasks and curating
traces, then optionally fine-tune.

## 2. Feasibility for a solo dev on a Linux box

**Weight-level (A): feasible but gated on hardware, and marginal payoff for this user.**
- OPD/SFT of a 7B student needs a forward+backward over the teacher's logits
  *and* the student's — realistically an A100 80GB or 2× A6000, or LoRA on a
  single 24GB GPU for a 7B target with a *hosted* teacher (you call GLM-5.2's
  API for teacher logits and only train the student locally). The hosted-teacher
  trick is the solo-dev path: teacher = API (GLM-5.2/Venice), student = local
  LoRA on a 7B. No cluster, but you need one decent GPU and a lot of API spend
  on teacher inference for the trace corpus.
- The corpus problem is the real gate. Good distillation needs thousands of
  high-quality trajectories. This user has **37 sessions → 100 usable pairs**
  (measured, see SKILL.md). That's 1-2 orders of magnitude short of what's
  needed to fine-tune a stable action policy. OPD papers report failure modes
  (diversity collapse, myopic per-token supervision) precisely at small data.
  Conclusion: fine-tuning is *technically* solo-feasible (hosted-teacher + LoRA)
  but **not yet justified by the data this user has**.

**Trace-level (B): feasible today, zero new hardware, and already implemented.**
See `~/.pi/scripts/poor_mans_distill.py` and the `poor-mans-distill` skill. It
runs in seconds, extracts 100 ranked pairs, and produces a few-shot digest.

## 3. The poor-man's path (implemented and measured)

The script extracts, per session: the user intent → the assistant's first
tool-call sequence → a heuristic outcome score → a task-type label. Outputs:
`distilled_traces.jsonl`, `fewshot_digest.md` (top 25), `route_shortcuts.md`.

**Honest measurement:** the few-shot extraction is a clear **keep** — top traces
are genuine high-quality demonstrations (error-fix→ctx_grep+ctx_shell,
install→batch-execute). The **route-shortcut mining is a discard-for-now**: zero
task-types reach ≥70% routing confidence at ≥3 instances. The harness's routing
is simply not deterministic enough at 37 sessions to hard-code. Re-run after the
corpus grows; the script flags the threshold automatically.

## 4. Distilling the *harness itself* (route hard-coding)

This is the metaharness / "simplify agent harnesses" angle: if ce-lite's routing
*always* picks workflow X for task Y, delete the router and hard-code the
shortcut. Measured answer for this user: **not yet**. The trace data shows
diffuse routing (18-50% dominance per task-type). Two reasons it's premature:

1. **Sample size.** 37 sessions is a sketch, not a distribution. Hard-coding a
   shortcut now would encode noise and brittleness.
2. **Router value is on the tail.** ce-lite's routing earns its keep on
   ambiguous/novel tasks, exactly the ones that *don't* concentrate. The
   high-frequency head (error-fix, install) is where a shortcut *would* help,
   but those are also where the model already does fine without one.

**When to revisit:** once a task-type crosses ~100 instances *and* ≥80%
route-dominance, lift that route into a deterministic pre-route in the harness
(basically a cached classifier). The script is the instrument for that decision.

## 5. The Dettmers 10M-token eval harness

The Jul-30 Digg signal says Dettmers announced a 10M-token eval harness for
open-weight models, aimed at evaluating long-context providers. **I could not
locate a shipped repo** — it's an announcement, and Dettmers' public GitHub
(bitsandbytes lineage) doesn't yet host it. Treat it as forthcoming, not
installable.

**How the user would use such a tool for their GLM-5.2 / Venice setup, once it
ships (and the available proxy today):**
- The point of a 10M-token eval is to stress *needle-in-a-haystack at scale* —
  does the provider still retrieve/ reason correctly when context is huge? For
  this user that maps directly to: "when I dump a whole project + 37 sessions
  into context, does GLM-5.2 via TokenRouter still route/edit correctly, or does
  Venice mercury-2 degrade less?" A 10M-token harness answers that empirically.
- **Available today, as a stand-in:** EleutherAI `lm-evaluation-harness`
  (surfaced in research) supports long-context tasks (RULER, LongBench,
  needle-in-a-haystack) and can point at any OpenAI-compatible endpoint. The
  user's Venice and TokenRouter providers are OpenAI-compatible, so they can
  run RULER/LongBench against GLM-5.2, mercury-2, gemini-3-5-flash, kimi-k3
  *right now* and get a real long-context leaderboard for their own stack —
  without waiting for Dettmers' harness.
- **Concrete first step:** `pip install lm-eval`, point `--model openai` at the
  Venice base URL with the kimi-k3 key, run `lm_eval --tasks ruler/ruvr
  --limit 50`. Compare effective-context accuracy across the four providers.
  This is the high-leverage long-context question for this user and it's
  runnable today.

## 6. Investment-Engine MCP — could distillation produce a cheaper specialist?

This is the most promising *specific* application, and it's a (B)-shaped win,
not an (A)-shaped one:

- Investment-Engine is a Python MCP with a narrow, repeated surface (the same
  tool schemas, the same kinds of edits). That's exactly where few-shot
  demonstration transfers well: the action space is small and the context is
  stereotyped.
- **Cheaper than full ce-lite orchestration?** Yes, conditionally. If you slice
  the distilled traces to *only* Investment-Engine sessions (the script needs a
  `--cwd-filter` flag — currently tags by session file, easy to add), you get a
  domain few-shot bank. Feed it to the *cheapest* competent model (gemini-3-5-
  flash or kimi-k3 via Venice) as a specialist prompt, and skip the full
  orchestrator for that project's routine edits. The cost delta is real: one
  cheap-model call with good few-shots vs. a multi-step ce-lite loop.
- **The catch:** this only beats orchestration on *routine* edits. Novel
  Investment-Engine work (new schema, debugging a subtle MCP transport bug)
  still wants the full harness + strong model. So the specialist is a *fast
  path*, not a replacement — exactly the "isolated task" framing from the Digg
  cluster.
- **Fine-tuning a real Investment-Engine specialist (A)** is *not* worth it yet:
  you'd need hundreds of curated IE traces; you have a handful. Revisit only if
  IE session volume grows 10×.

## 7. Effort/payoff ranking for this user vs. the other surfaces

| path | effort | payoff | verdict |
|------|--------|--------|---------|
| Poor-man's few-shot bank (B) — *done* | 1 day | medium, immediate | **do it** |
| Long-context provider eval via lm-eval (RULER/LongBench) | 1 day | high, one-time | **do it next** |
| Investment-Engine specialist fast-path (B, cwd-sliced) | 2 days | medium-high, recurring | **do it** once IE traces tagged |
| Harness route hard-coding | 1 day | low now | **defer** (re-measure at 100+ sessions/type) |
| Weight-level OPD of a 7B student (A) | 2-4 wks + GPU/API spend | low at current data | **skip** until corpus 10× larger |
| Dettmers 10M-token harness | n/a (not shipped) | high when available | **watch**; use lm-eval in the meantime |

**Bottom line:** the realistic, honest play for this user is the poor-man's
trace-level distillation (implemented, measured, keep) plus a one-time
long-context eval of their provider stack via EleutherAI's harness. Weight-level
distillation is a real technique and the OPD literature is mature, but this
user's trace corpus is 1-2 orders of magnitude too small to justify the GPU/API
cost — the few-shot bank captures most of the behavioral value at ~0% of it. The
harness-route hard-coding idea is sound in principle but the data says "not yet."

## Artifacts

- `~/.pi/scripts/poor_mans_distill.py` — extraction + route-mining (run anytime)
- `~/.pi/scripts/_research_distill.py` — the research/scrape helper (disposable)
- `~/.pi/agent/skills/poor-mans-distill/SKILL.md` — the skill (measure/keep/discard)
- `~/.pi/agent/skills/poor-mans-distill/{distilled_traces.jsonl,fewshot_digest.md,route_shortcuts.md}` — generated outputs
