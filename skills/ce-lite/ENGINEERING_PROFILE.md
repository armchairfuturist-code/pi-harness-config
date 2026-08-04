# Engineering profile router

This reference only classifies engineering risk. CE-lite owns contracts, evidence matrices, delegation, verification, and delivery.

Choose the highest matching mode from observed blast radius—not task labels:

- **Critical** when failure could expose secrets, bypass a security boundary, corrupt persistent/production data, cause financial or material user harm, break a public compatibility contract, impair production availability, or trigger an external action that is difficult to reverse. A CI, deployment, or release edit is Critical only when it can produce one of these effects.
- **Lightweight** only when all are true: the change is local and readily reversible; affects one bounded component; preserves public contracts and persistent data; has no security, credential, production, migration, dependency-resolution, or release effect; and has a focused verification method.
- **Standard** otherwise. A bug fix is Lightweight, Standard, or Critical according to these effects.

Load exactly one sibling reference:
- Lightweight → `ENGINEERING_LIGHTWEIGHT.md`
- Standard → `ENGINEERING_STANDARD.md`
- Critical → `ENGINEERING_CRITICAL.md`

Reclassify before further mutation when scope or evidence reveals a higher mode. A failed baseline is recorded as pre-existing; a failed post-change check returns to diagnosis; an external blocker gets evidence, owner, and one resumable next action.

Completion: the recorded mode cites the specific matching condition, and only that mode reference is loaded.
