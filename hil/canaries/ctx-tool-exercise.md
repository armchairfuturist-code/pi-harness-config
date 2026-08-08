# Canary: ctx-tool exercise

> A single-turn canary task that exercises the context-mode tools (ctx_search, ctx_read,
> ctx_index, ctx_grep, ctx_ls, ctx_find). The config-overhead study couldn't test tool removal
> because the bench workload didn't use ctx tools. This canary fixes that.

## Brief

```
Using the context-mode tools available to you, do the following:

1. List the contents of the current directory using ctx_ls.
2. Find all Python files using ctx_find with pattern "**/*.py".
3. Read the first 20 lines of the first Python file found using ctx_read.
4. Search for the pattern "def " across all Python files using ctx_grep.
5. Index the current directory using ctx_index.
6. Search the indexed content for "class " using ctx_search.

Report: how many Python files did you find? How many contained a "def " pattern?
What was the first function name you found?
```

## What it tests

- ctx_ls, ctx_find, ctx_read, ctx_grep, ctx_index, ctx_search all function correctly
- Tool results are parsed and used by the agent (not just called blindly)
- The agent can compose multiple tools in sequence

## Canary checks

1. ctx_ls was called (capture shows tool call)
2. ctx_find was called with pattern "**/*.py"
3. ctx_read was called
4. ctx_grep was called with pattern "def "
5. ctx_index was called
6. ctx_search was called with query containing "class"
7. The response mentions a count of Python files (a number)
8. The response mentions at least one function name

## Why this matters

The config-overhead study (2026-07-28) found that context-mode tools cost 1,757 tokens of surface
but couldn't determine if they were load-bearing because "the bench workload doesn't exercise ctx
tools." This canary exercises them directly. If you remove context-mode tools and this canary
fails, the removal is rejected. If it passes, the tools may be removable for workloads that don't
need them.

## Measurement

Run through the proxy with `PI_BENCH_LABEL="canary-ctx-tools"`. Capture should show 6+ tool calls.
The agent's response should contain file counts and function names.
