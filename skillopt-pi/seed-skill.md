# Pi coding — seed skill

## Approach
- Route: trivial/read-only → answer directly; 2+ steps or edits → small plan, then act.
- Read before edit; verify after edit with the cheapest parse/test/run.

## Shell
- Never inline `python3 -c` / `node -e`, heredocs, or `find -exec`. Write a script file, then run it.
- After a policy block, change approach; never retry the identical command.

## Output
- Final line: `Done: <passed>/<total> · artifacts: <paths> · next: <one action>`.
