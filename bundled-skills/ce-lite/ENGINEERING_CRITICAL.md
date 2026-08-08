# Critical engineering

Use the Contract base route and all Standard controls in `ENGINEERING_STANDARD.md`, then add the controls below. Load Standard now.

1. **Blast radius** — identify affected users, systems, data, trust boundaries, compatibility contracts, and worst credible failure modes.
2. **Containment and recovery** — define rollback trigger, reversible staging path, rollback/recovery procedure, and direct recovery proof. For migrations, prove compatibility and data integrity across the transition.
3. **Security and operational proof** — add applicable threat, authorization, secret-handling, destructive-operation, performance, deployment, smoke, observability, and recovery checks to the evidence matrix.
4. **Independent challenge** — run adversarial review in a context separate from implementation review. Resolve every blocking safety, security, integrity, compatibility, and rollback finding.
5. **Irreversible boundary** — prepare and verify the reversible staged result first. Immediately before an irreversible or production-affecting external action, present evidence and residual risk and obtain explicit operator approval.
6. **Post-action evidence** — directly observe smoke/health, integrity, and recovery indicators. Report merge, deployment, release, acceptance, and rollback only when each has direct evidence.

When critical risk emerges, contain exposure, update the contract and recovery plan, then continue from the earliest affected control. If approval is declined, preserve the verified staged result and record the precise operator next step.

Completion: Standard completion holds; critical failure modes have containment and recovery evidence; both reviews have no blocking finding; and any external action is either directly verified or remains explicitly staged.
