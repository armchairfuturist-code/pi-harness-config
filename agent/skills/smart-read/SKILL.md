---
name: smart-read
description: "Read-tool discipline: probe before dumping, extract structured formats, locate on miss, block device paths. Prevents context bleed from binary/boring/jumbo reads."
---
# Smart Read

ctx_read is the #1 context-byte source (~48% per harness-doctor audit). This skill
prevents wasted context from binary, boring-format, jumbo, and missed-path reads.

## Before ctx_read on unknown/untrusted paths

**1. Probe first** — cheap stat before expensive read:
```
ctx_shell: file <path> && stat --format=%s <path> && wc -l <path>
```
Classify by result:
- **Binary** (file says binary/data/image/PDF) → use extractor, never raw ctx_read
- **Structured** (.json/.yaml/.xml/.csv) → ctx_read is fine if small; use `jq`/`yq` for targeted extraction if large
- **Jumbo** (>50KB) → use `offset`/`limit` window or `mode=map`/`mode=signatures` first
- **Text/code** → ctx_read directly

**2. Boring formats — use the right extractor:**

| Extension | Extractor | Never raw-read? |
|---|---|---|
| .pdf | `pdftotext <path> -` | yes |
| .docx/.pptx | `pandoc -t plain <path>` or unzip + grep document.xml | yes |
| .xlsx | `python3 -c "import openpyxl..."` or `ssconvert` to CSV | yes |
| .sqlite/.db | `sqlite3 <path> .dump` or `.tables` + `.schema` | yes |
| .ipynb | `jq '.cells[].source' <path>` | yes |
| .png/.jpg/.svg | `exiftool <path>` or describe from metadata | yes |
| .min.js/.map | `mode=signatures` or targeted grep | yes |
| .lock / package-lock.json | grep for specific package, never full read | yes |
| .bin/.dat/.so/.o | hexdump/strings if needed | yes |

**3. Skip list** — never ctx_read unless explicitly required:
- `node_modules/` `.git/` `dist/` `build/` `__pycache__/` `.next/` `target/`
- `*.lock` `package-lock.json` `yarn.lock` `pnpm-lock.yaml` `Cargo.lock`
- `*.min.js` `*.min.css` `*.map`
- Cache dirs: `.cache/` `.turbo/` `coverage/` `.nyc_output/`

**4. Structural modes** — prefer before raw read:
- `mode=map` — directory tree / file outline (use for unknown dirs)
- `mode=signatures` — function/class signatures (use for large source files)
- `mode=full` — only when you need complete content AND file is text + <50KB

## On file-not-found (did-you-mean)

When ctx_read returns "could not find" or "file not found":
1. **Stop** — do not retry the same path
2. **Locate** — `ctx_find` (glob) or `ctx_ls` (parent dir) to find the real path
3. **Retry** with the corrected path

This eliminates the 6% miss rate (185/3073 reads, 2026-08-10 baseline).

## Device blocklist

Never read: `/dev/*`, `/proc/kcore`, `/proc/sysrq-trigger`, `/sys/kernel/*`
These can hang or dump kernel memory.

## Before ctx_edit (read-before-write invariant)

You must hold a current `ctx_read` (post-last-edit) of the target file in-view
before calling `ctx_edit`. If the read was pruned from context, re-read first.
This prevents stale-buffer edits.
