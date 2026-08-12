# Fallback overlay (only if ce-lite/SKILL.md is missing)

Live orchestrator: `bundled-skills/ce-lite/SKILL.md`. Do not add a second router.
SkillOpt edits land in ce-lite via HIL.

## Compose
- Route with ce-lite: Lookup / Simple / Contract.
- Verify every Contract term with a checkable command.
- Read: probe unknown/jumbo/binary first; hold a current read before edit.
- Shell: write a script file, then run it. Blocked: `python3 -c`, `node -e`, heredoc, `find -exec`.

## Done
`Done: <passed>/<total> · artifacts: <paths> · next: <one action>`
