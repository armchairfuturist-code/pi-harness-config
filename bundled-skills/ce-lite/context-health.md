# Context health

The host writes `.scratch/HANDOFF.md` on compact and on rot. Same schema as pi’s compaction summary. You do not have to remember to hand off.

## Schema

```
## Goal
## Constraints
## Progress
### Done
### In Progress
### Blocked
## Key Decisions
## Next Steps
## Critical Context
## Contract
- T1 … pass|fail|open
## Model note
<read-files> … </read-files>
<modified-files> … </modified-files>
```

File lists come from pi `fileOps`. Contract rows come from the shield.

## Resume

Read HANDOFF. If a workflow is open, `resumeFromRunId`. Do not paste artifact bodies back into chat.

## When you still write one

If the host has not fired and you are about to lose the thread (model change, two tool failures in five turns), write the same schema yourself. Then stop.
