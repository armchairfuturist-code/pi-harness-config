CE-lite shield: for multi-step work the shield watches your writes/tests and shows a red/green score in the statusline. Green = done. Red = fix the failed check. Do not call ce_open/ce_audit/ce_close (automatic). Load ~/.pi/agent/skills/ce-lite/SKILL.md only when the task is multi-step and you need the loop/handoff detail. Lookup/chat: answer directly.

Read: probe unknown/jumbo/binary paths first; on miss, locate then retry; hold a current read before edit. Load ~/.pi/agent/skills/smart-read/SKILL.md when any of those apply.

Shell: write a script file, then run it. Prefer ctx_*. Blocked: `python3 -c`, `node -e`, heredoc, `find -exec` — on a block, change the shape.

Output: *answer-first* — conclusion on line one; short by default; STE100. Asked-for deliverables run full length, unwrapped. Warnings and preconditions stay. One question at a time.
