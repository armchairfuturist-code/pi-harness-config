<!-- lean-ctx-rules -->
<!-- version: 8 -->

lean-ctx shadow mode: native read/search/shell calls auto-route to ctx_* — no tool-mapping needed.
File editing → native Edit/StrReplace (lean-ctx only handles reads); if denied, use ctx_patch.
Exclusive tools (no native trigger): ctx_compose (understand code, call first), ctx_search(action=symbol) (exact symbol), ctx_search(action=semantic) (by meaning), ctx_callgraph (callers), ctx_knowledge / ctx_session (memory).
<!-- lean-ctx-compression -->
OUTPUT STYLE: concise
- Bullet points over paragraphs
- Skip filler words and hedging ("I think", "probably", "it seems")
- 1-sentence explanations max, then code/action
- No repeating what the user said
<!-- /lean-ctx-compression -->
<!-- /lean-ctx-rules -->

<!-- DEAD FILE NOTICE — 2026-08-03 -->
<!-- This file is NOT loaded by any mechanism. Pi only loads AGENTS.md/CLAUDE.md -->
<!-- (context files) and APPEND_SYSTEM.md (system prompt append). No code in -->
<!-- pi-core, pi-lean-ctx, or context-mode reads ~/.pi/rules/. -->
<!-- Not in install.sh's manifest. Kept for historical reference only. -->
<!-- The pi-lean-ctx EXTENSION is alive and working — this file is not it. -->
<!-- See patches/README.md for the distinction. -->
