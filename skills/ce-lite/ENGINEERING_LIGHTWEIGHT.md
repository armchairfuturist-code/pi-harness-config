# Lightweight engineering

Use the Simple base route unless ambiguity or multiple steps independently require Contract.

1. Read the nearest project guidance, affected implementation, and focused tests or validation command.
2. Record or observe the focused pre-change result when feasible; distinguish a pre-existing failure.
3. Make one bounded, reversible change. For a behavior bug, first reproduce the failure with an automated check when feasible.
4. Run the focused check on the final state and inspect the diff/status for unrelated, generated, secret, or debug material.
5. Report changed paths, check result, and residual risk.

Escalate to Standard when the change expands beyond one bounded component, changes dependencies or shared behavior, lacks focused proof, or requires coordinated steps.

Completion: focused proof passes on the final state, the diff is bounded to the requested behavior, and the reported paths and evidence match the workspace.
