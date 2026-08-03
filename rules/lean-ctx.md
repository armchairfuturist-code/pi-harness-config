<!-- lean-ctx-rules -->
<!-- version: 9 — CLI mode, MCP bridge off -->
Real tool surface (the only ctx_* tools that exist): ctx_read, ctx_shell, ctx_ls, ctx_find, ctx_grep, ctx_edit, lean_ctx.
NOT installed: ctx_compose, ctx_patch, ctx_tree, ctx_glob, ctx_callgraph, ctx_session, ctx_knowledge. Never call them — use lean_ctx CLI instead.

Mapping:
- Read file → ctx_read(path, mode). Orient: mode=signatures|map. Full content: mode=full. Never cat/less.
- Search content → ctx_grep. Files by glob → ctx_find. List dir → ctx_ls.
- Shell → ctx_shell. Side effects only (build, test, install, git, run). Output compressed; if redacted, read the tee-log path it prints. raw=true = uncompressed.
- Edit → native edit first (TUI diff). ctx_edit only for cache-coherence/race guards; bridge is off, it may error → fall back to native edit.
- New file → native write.
- Knowledge store, doctor, stats, anything missing → lean_ctx CLI (e.g. lean-ctx knowledge recall <q>).

Parallel: fire independent reads in the same turn.
Compression is reversible: re-read the shown path or raw=true. Never re-read line-by-line.

OUTPUT: concise. Fragments over sentences. No filler, no hedging, no echoing tool output, show only changed code.
<!-- /lean-ctx-rules -->

<!-- DEAD FILE NOTICE — 2026-08-03 -->
<!-- This file is NOT loaded by any mechanism. Pi only loads AGENTS.md/CLAUDE.md -->
<!-- (context files) and APPEND_SYSTEM.md (system prompt append). No code in -->
<!-- pi-core, pi-lean-ctx, or context-mode reads ~/.pi/rules/. -->
<!-- Not in install.sh's manifest. Kept for historical reference only. -->
<!-- The pi-lean-ctx EXTENSION is alive and working — this file is not it. -->
<!-- See patches/README.md for the distinction. -->
