# Better Harness Task-Loop Report

## At a Glance

- Loop Effectiveness: 43/100 (changes only after comparable later task outcomes)
- Asset Health / Repair Progress: 0/100 (0 verified, 0 partial, 10 pending)
- Demonstrated autonomy radius: not observed (not observed; not observed confidence)
- Strongest loop: Not enough evidence difference to name one.
- Largest observed leak: Use the priority moves; no single loop is uniquely weakest.
- Top expected gain: No priority benefit is available in this evidence boundary.

## What You Can Rely On Today

- Blanket skills denylist removed; only last30days remains denied until slimmed.
- HARNESS.md + AGENTS.md + tightened APPEND_SYSTEM.md give a real written contract.
- Remote pi-harness-config master includes the skills unlock and HARNESS install path.
- Local git now tracks hundreds of agent intent files (skills/settings/extensions source) instead of a near-empty tree.
- CE-lite triggers and better-harness remain available as the audit/optimize spine.

## What You Gain Next

- No priority Harness move is available in this evidence boundary.



### Why these moves matter

### HARNESS.md is live contract but not tracked or installed from local gitignore
- Priority: High · Evidence: not observed in this boundary
- Reason: HARNESS.md exists on the live agent and is referenced by APPEND_SYSTEM.md, and the remote repo install path ships it, but the local home-relative-path gitignore/tracking still leaves HARNESS.md out of the nested agent tree commit surface. Clone/install consumers can drift from the machine that authored the P0 fix.
- Expected Output:
  1. Concrete output not supplied.

### last30days skill still huge and still denied — slim unfinished
- Priority: High · Evidence: not observed in this boundary
- Reason: skills/last30days/SKILL.md remains about 217KB and settings still deny the tree. Project pass also flagged a large last30days asset tree tracked in git (media/binaries on the order of megabytes). Enabling without slim will blow context; keeping denied blocks CE-lite last30days workflows that expect the skill.
- Expected Output:
  1. Concrete output not supplied.

### No harness validation gate (hooks/CI/preflight) for settings and skills
- Priority: High · Evidence: not observed in this boundary
- Reason: P0 fixed content but not enforcement. There is still no CI, core.hooksPath, Makefile check, or package test wiring for harness changes. A bad skills filter or broken extension path can ship again without a gate. harness-doctor exists as a skill only.
- Expected Output:
  1. Concrete output not supplied.

### Shell allowlist friction and edit misses persist in session evidence
- Priority: High · Evidence: not observed in this boundary
- Reason: Independent session sampling still shows shell-heavy traffic (ctx_shell leading), dozens of allowlist-style blocks, and edit-context misses across the window. Policy text now exists, but runtime behavior has not yet proven a sustained drop—only one short post-fix sample window is available.
- Expected Output:
  1. Concrete output not supplied.

### Long sessions still unreviewed with high failure mass
- Priority: High · Evidence: not observed in this boundary
- Reason: Lead and session evidence still mark outcome review required: multiple long sessions (including multi-hour threads with dozens of failures) and reviewedActiveLongCount=0. Structured completion evidence remains weak versus conversational handoffs.
- Expected Output:
  1. Concrete output not supplied.

### Local extensions on disk are not enabled in settings.extensions
- Priority: Medium · Evidence: not observed in this boundary
- Reason: agent/extensions contains tool-trimmer, session-index, invest-tools, pi-lean-ctx and others, while settings.extensions mostly points at pi-essentials under npm plus transcript-pruner. AGENTS.md documents local extensions that are not actually enabled—dead surface and dual-path confusion.
- Expected Output:
  1. Concrete output not supplied.

### harness-inventory.json stale since 2026-07-30
- Priority: Medium · Evidence: not observed in this boundary
- Reason: Architecture inventory on disk is still timestamped 2026-07-30, before the skills unlock and HARNESS addition. Evidence packets under-count assets relative to the live tree, which misleads optimize/audit loops.
- Expected Output:
  1. Concrete output not supplied.

### Triple policy surface risk: APPEND_SYSTEM + HARNESS + AGENTS
- Priority: Medium · Evidence: not observed in this boundary
- Reason: Three durable prose surfaces now describe overlapping policy. Without a single source of truth, future edits will drift (already seen when HARNESS landed on remote while local AGENTS also holds tool rules).
- Expected Output:
  1. Concrete output not supplied.

### Untracked nested agent/git mirror and last30days media risk disk/git bloat
- Priority: Medium · Evidence: not observed in this boundary
- Reason: Project pass reported an untracked agent/git nested mirror on the order of hundreds of MB and last30days asset weight in tracking. This threatens backups, git operations, and accidental commits.
- Expected Output:
  1. Concrete output not supplied.

### Custom agents and skill triage still thin relative to 48 skills
- Priority: Low · Evidence: not observed in this boundary
- Reason: agents/ still only has Explore.md while about 48 skills sit on disk. Without a short triage index (always-on vs on-demand vs denied), routing stays CE-lite-trigger-only and generalist.
- Expected Output:
  1. Concrete output not supplied.

## Five Lifecycle Dimensions

| Dimension | What the evidence proves | Evidence boundary | Summary | Boundary / blocker |
| --- | --- | --- | --- | --- |
| Task Understanding | Not observed yet | not observed in this boundary | AGENTS.md and HARNESS.md now exist and skills are unlocked, so entry guidance is much better than the prior audit. Residual gaps: HARNESS tracking/install consistency, triple policy surfaces, and thin skill triage. | not observed |
| Controlled Execution | Not observed yet | not observed in this boundary | Blanket skill deny is gone, but sessions remain shell-heavy with allowlist friction and local extensions half-wired. Policy text is ahead of proven runtime behavior change. | not observed |
| Change Validation | Not observed yet | not observed in this boundary | Still the weakest area: no preflight/CI/hooks for harness edits, and edit-context misses continue in session evidence without a forced verify step. | not observed |
| Reliable Delivery | Not observed yet | not observed in this boundary | Long sessions still lack outcome review; last30days remains a denied fat skill; git/disk bloat risks remain around mirrors and media assets. | not observed |
| Learning Capture | Not observed yet | not observed in this boundary | Contracts improved capture of intent, but inventory is stale, long-session reviews are still required/unreviewed, and policy ownership across three files risks drift. | not observed |

## The 15 Small Checks

| Dimension | Small check | What the evidence proves | Evidence boundary |
| --- | --- | --- | --- |


## Evidence and Boundaries

- Episode coverage: 0 episodes, 0 edited, 0 closed, 0 repaired-and-passed
- Model: agent-work-loop-v4
- Session selection: not observed; 0 sessions analyzed of 0 eligible sessions; not observed confidence
- Delivery grades observed: not observed
- Source gaps: not observed
- Learning comparison: Not observed; 0 declared intervention(s)
