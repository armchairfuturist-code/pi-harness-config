# lean-ctx Upstream Issues — Probe Evidence

Source repo: https://github.com/yvgude/lean-ctx (Apache 2.0, v3.9.18)
Probe date: 2026-08-10
Prober: pi-harness-config (armchairfuturist-code)

---

## Issue 1: Add per-line character clamp (third ceiling)

### Summary
ctx_read has two ceilings — a line window (`limit`) and a token ceiling (TSCG). It's missing a
per-line character clamp. A single minified line that sits inside the line window can eat the
entire token budget, returning one unusable mega-string.

### Reproduction
```
# Create a 15,700-byte single-line file
echo 'var app=' > mega.js
python3 -c "print('var a0=function(b,c){return b+c+0};' * 300, end='', file=open('/dev/stdout'))" >> mega.js
echo ';app.run();' >> mega.js
# ctx_read mega.js → entire 15,700 bytes returned, only truncated by TSCG at token level
```

### Expected
Per-line clamp at ~2,000 chars. When a line exceeds the clamp:
- Truncate the line to the clamp limit
- Append a marker: ` […] line N truncated at 2000/N chars`
- Provide a resume hint: `offset=N` (byte offset or char offset into the line)

### Actual
Entire 15,700-char line returned. TSCG truncates at ~5K tokens but the resume hint says
"use lines=" which is meaningless for a single-line file.

### Why it matters
This is the exact failure mode described in harness-engineering literature: "one minified line
that sits comfortably inside the 2,000-line window and, on its own, eats the entire byte budget."
The model gets a single unusable mega-string that displaced everything it actually needed to see.
No log shows it — just a turn where the model got nothing useful and paid full price.

### Suggested implementation
Add a `max_line_chars` config (default 2000) to the read path. When streaming chunks, track the
current line's char count. If it exceeds `max_line_chars`, truncate, append marker, and provide
a char-offset resume hint. This is a bounded change in the read path, independent of the existing
line-window and token-ceiling logic.

---

## Issue 2: Notebook (.ipynb) rendering — return tagged cells, not raw JSON

### Summary
ctx_read returns .ipynb files as raw JSON soup: base64 blobs, per-character source arrays,
and large cell outputs (e.g. a 15,000-char dataframe dump) come through verbatim.

### Reproduction
```
# Create a notebook with a 15K-char cell output
python3 -c "
import json
nb = {'cells': [
    {'cell_type': 'code', 'source': ['import pandas as pd\n'],
     'outputs': [{'output_type': 'stream', 'text': ['x' * 15000]}]},
    {'cell_type': 'markdown', 'source': ['# Title']},
], 'metadata': {}, 'nbformat': 4, 'nbformat_minor': 5}
json.dump(nb, open('notebook.ipynb','w'))
"
# ctx_read notebook.ipynb → full 15,274 chars of raw JSON including the 15K blob
```

### Expected
Parse the .ipynb JSON and return tagged cells:
```
[Cell 1 — code]
import pandas as pd

[Cell 1 — output (stream, 15000 chars)]
[jq hint: .cells[0].outputs[0].text | jq to extract]

[Cell 2 — markdown]
# Title
```
- Cell outputs > 10,000 chars → replace with a jq pointer, not the full content
- Plots (image/png outputs) → attach as image or note "plot image, N bytes"
- Source arrays → join into readable strings

### Actual
Raw JSON returned. The 15,000-char "xxx..." blob is included verbatim, eating the read budget.

### Why it matters
Anyone doing data work in notebooks pays for the entire dataframe in tokens. The model can still
reason about the notebook structure, but doesn't need to see every byte of a 15K output blob.
This is a major token sink for data-work sessions.

### Suggested implementation
Add `src/core/extractors/ipynb.rs` following the existing `csv.rs` / `eml.rs` pattern. Parse the
JSON, render cells as tagged sections, gate large outputs behind jq pointers.

---

## Issue 3: Device blocklist — refuse /dev/* and /proc/* before I/O

### Summary
ctx_read has no device blocklist. `/dev/zero` caused a runtime error ("Invalid string length")
rather than a clean refusal. `/dev/null` was caught by the project-root boundary, not a device
check. If the project root were `/`, nothing would stop `/dev/zero` from hanging the session.

### Reproduction
```
ctx_read /dev/zero   → "Invalid string length" (runtime crash, not refusal)
ctx_read /dev/urandom → "Invalid string length" (same)
ctx_read /dev/null    → caught by project-root boundary (accidental, not device blocklist)
ctx_read /proc/kcore  → EACCES (OS protection, not lean-ctx)
```

### Expected
Refuse by name before any I/O, with a clear note:
```
/dev/zero — device file, refused (not readable as text)
```
Blocklist: `/dev/zero`, `/dev/urandom`, `/dev/random`, `/dev/stdin`, `/dev/stdout`, `/dev/stderr`,
`/proc/<pid>/fd/*`, `/proc/kcore`, `/proc/sysrq-trigger`, `/sys/kernel/*`

### Actual
Runtime errors or accidental boundary catches. `/dev/zero` specifically crashes with
"Invalid string length" because it reads an unbounded stream of null bytes.

### Why it matters
A read tool that hangs on /dev/zero is a denial of service you shipped yourself. No extension
check or workspace boundary catches this when cwd is `/`. The refusal should happen before any
file descriptor is opened.

### Suggested implementation
Add a device-path check at the top of the read path, before `File::open()`. Match against a
static blocklist of device paths. Return a short note (not an Error: prefix) explaining the refusal.

---

## Issue 4: Extend Unicode filename repair to NFD/NFC and curly quotes

### Summary
ctx_read already repairs NARROW NO-BREAK SPACE (U+202F) ↔ regular space — great. But it doesn't
repair NFD/NFC normalization or curly ↔ straight quote variants. These are invisible-to-the-model
failures where the tool must repair, not the agent.

### Reproduction
```
# File stored with NFD-decomposed name (macOS default)
open("café.txt")  # stored as NFD: caf + combining accent + .txt
# Query with NFC (composed): café.txt → "could not read" (NOT FOUND)
# Query with NFD: same bytes → found

# File stored with curly quote (macOS Finder rename)
open("it's_a_file.txt")  # stored with U+2019 (RIGHT SINGLE QUOTATION MARK)
# Query with straight quote: it's_a_file.txt → "could not read" (NOT FOUND)
```

### Probe results
| Repair type | Works? | Evidence |
|---|---|---|
| Narrow no-break space (U+202F) ↔ regular space | ✅ YES | Queried with regular space, file had U+202F, found it |
| NFD ↔ NFC normalization | ❌ NO | Queried café.txt (NFC), file stored as NFD, not found |
| Curly quote (U+2019) ↔ straight quote (U+0027) | ❌ NO | Queried it's, file had it's, not found |

### Expected
Before returning "could not find", retry these candidate spellings:
1. NFD → NFC normalization (and vice versa)
2. Curly quote (U+2018, U+2019) ↔ straight quote (U+0027)
3. NFD + curly quote (combined)
Each re-checked against the workspace boundary.

### Actual
Only the narrow-space repair works. NFD and curly-quote queries fail with "could not read".

### Why it matters
macOS stores filenames NFD-decomposed by default. Finder renames turn `'` into `'`. The model
reads the path off the screen, retypes it faithfully, gets "file not found", and no amount of
reasoning recovers because the difference isn't rendered. You can burn an entire session on this.
The narrow-space repair already proves lean-ctx has the infrastructure for this — extending it
to NFD/NFC and curly quotes is incremental.

### Suggested implementation
Extend the existing Unicode repair path (where narrow-space is handled) to also try:
- `unicodedata.normalize('NFC', path)` and `unicodedata.normalize('NFD', path)`
- Replace U+2018/U+2019 with U+0027 and vice versa
- Combined NFD + curly quote variants
7 candidate spellings total, each re-checked against the workspace boundary.

---

## Issue 5 (minor): SVG classified as binary — should be text/XML

### Summary
ctx_read classifies .svg files as binary and returns a mime note instead of the content. SVG is
XML text that the model can read and edit.

### Reproduction
```
echo '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>' > test.svg
ctx_read test.svg → mime note (not the XML content)
```

### Expected
SVG files are returned as text (they're XML). The model can read, reason about, and edit them.

### Actual
Returned as a binary mime note.

### Suggested implementation
Add `.svg` to the text/XML extension allowlist in the binary detection logic. One-line fix.

---

## Prioritization

| # | Issue | Impact | Effort |
|---|---|---|---|
| 1 | Per-line clamp | High — prevents mega-line context bleed | Medium |
| 2 | Notebook rendering | High — major token sink for data work | Medium |
| 3 | Device blocklist | Medium — prevents DoS, unlikely in practice | Small |
| 4 | Unicode NFD/curly repair | High — invisible failures, model can't self-repair | Small |
| 5 | SVG classification | Low — minor false positive | Trivial |

Issues 3, 4, and 5 are small enough to bundle into a single PR.
Issues 1 and 2 are independent and should be separate PRs.
