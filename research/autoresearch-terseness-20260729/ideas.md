# Ideas backlog — terseness campaign

Mutation surface: `candidates/APPEND_SYSTEM.md` ONLY (363 bytes baseline, ~90 tok).
Rationale: lanes run one-shot tasks that ce-lite classifies as simple; SKILL.md is not
loaded, so only the global hook phrasing is in play. (A future campaign on non-trivial
multi-phase tasks could target SKILL.md turn-economy phrasing.)

1. [ ] baseline — live APPEND_SYSTEM.md verbatim
2. [ ] terseness directive: "Be terse: no preamble, no recap, no markdown headers unless asked, no emoji. Answer in <=60 words unless the task requires more."
3. [ ] turn-economy directive: "Minimize round-trips: batch independent tool calls; never re-read or re-verify what you just wrote; when the task is done, stop."
4. [ ] combined 2+3
5. [ ] hard output budget: "<=30 words for simple tasks"
6. [ ] negative control: drop the workflow clause (expect ~no change on this suite — validates measurement sensitivity)
7. [ ] winner + "never apologize, never self-congratulate"
