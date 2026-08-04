# Standard engineering

Use the Contract base route.

Add these controls to CE-lite's terms and evidence matrix:

1. **Authoritative state** — maintain `.scratch/WORKSTATE.md` with objective, mode rationale, scope, term IDs, evidence matrix, baseline, decisions/deviations, risks, changed paths, workflow run ID, and next action. Reference journals, ADRs, tickets, and handoffs instead of copying them.
2. **Survey and baseline** — read project guidance, affected implementation/tests/interfaces, dependency or schema definitions, generated-file boundaries, and prior decisions. Record the narrowest meaningful pre-change command and isolate pre-existing failures.
3. **Isolation and slices** — use an isolated branch/worktree when supported. Implement the smallest coherent vertical slice. For behavior changes, demonstrate red, make it green, then refactor while green. Give shared files one owner.
4. **Layered proof** — run focused regression; affected unit/integration/contract tests; applicable typecheck/lint/format/build; then broader regression proportional to blast radius. Inspect final diff/status for unintended changes.
5. **Fresh review** — provide a fresh context with contract, evidence matrix, diff/change summary, conventions, and relevant files. It checks correctness, scope, tests, maintainability, compatibility, and security. Resolve blocking findings and repeat affected checks.
6. **Truthful landing** — follow project commit/PR/version conventions. Separate engineering-check completion from human UAT when acceptance depends on taste, business judgment, unavailable credentials, or inaccessible behavior. Update work state and durable records.

When a new requirement appears, add or revise its term/evidence row and re-plan. Record an out-of-scope bug once; keep current scope unless it blocks proof. On interruption, update work state and handoff.

Completion: every CE-lite term passes on final-state evidence, required layers pass, fresh review has no blocking finding, and `.scratch/WORKSTATE.md` names either the completed state or one immediate next action.
