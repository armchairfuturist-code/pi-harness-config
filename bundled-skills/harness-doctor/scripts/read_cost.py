#!/usr/bin/env python3
"""Read-cost panel: count ctx_read calls, bytes, miss rate, boring-format hits.

Scans ~/.pi/agent/sessions/*/*.jsonl for ctx_read tool results and produces
a panel measuring read-tool efficiency.  Use before/after smart-read adoption
to quantify impact.

Baseline (2026-08-10): 3073 reads, 185 errors (6.0%), 10 binary hits detected.

Usage:
    python3 ~/.pi/agent/skills/harness-doctor/scripts/read_cost.py [--days N] [--session FILE]
"""
import json, glob, os, sys, statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta

SESSIONS_DIR = os.path.expanduser("~/.pi/agent/sessions")

# Boring/binary extensions that should never be raw-read
BORING_EXT = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".sqlite", ".db", ".ipynb",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp",
    ".min.js", ".map", ".lock", ".bin", ".dat", ".so", ".o", ".exe",
    ".woff", ".woff2", ".ttf", ".eot", ".ico",
}

# Extensions that are always safe to raw-read
SAFE_EXT = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".md", ".txt", ".json", ".yaml",
    ".yml", ".toml", ".sh", ".bash", ".zsh", ".rs", ".go", ".java", ".kt",
    ".swift", ".rb", ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".scala",
    ".clj", ".ex", ".exs", ".erl", ".sql", ".css", ".scss", ".html", ".htm",
    ".xml", ".csv", ".tsv", ".ini", ".cfg", ".conf", ".env", ".gitignore",
    ".dockerfile", ".makefile", ".r", ".lua", ".vim", ".el", ".fnl",
}

DEVICE_PATHS = {"/dev", "/proc/kcore", "/proc/sysrq-trigger", "/sys/kernel"}


def extract_path(text: str) -> str:
    """Best-effort extract a file path from ctx_read result text."""
    # Error format: "could not read /path" or "file not found: /path"
    for prefix in ["could not read ", "file not found: ", "Error: could not read "]:
        if text.startswith(prefix):
            return text[len(prefix):].split(" — ")[0].split("\n")[0].strip()
    # Cleared format: "[cleared: ctx_read /path — N chars; ...]"
    if "[cleared: ctx_read " in text:
        seg = text.split("[cleared: ctx_read ")[1].split(" — ")[0]
        return seg.strip()
    # Normal read: first line often contains the path or it's in content
    return ""


def get_extension(path: str) -> str:
    """Get extension, handling compound extensions like .min.js."""
    if not path:
        return ""
    lower = path.lower()
    for compound in [".min.js", ".min.css", ".test.js", ".spec.ts"]:
        if lower.endswith(compound):
            return compound
    _, ext = os.path.splitext(lower)
    return ext


def is_boring(path: str, ext: str) -> bool:
    if ext in BORING_EXT:
        return True
    if any(skip in path for skip in [
        "node_modules/", ".git/", "dist/", "build/", "__pycache__/",
        ".next/", "target/", ".cache/", "package-lock.json", "yarn.lock",
        "pnpm-lock.yaml", "Cargo.lock", ".map",
    ]):
        return True
    return False


def is_device_path(path: str) -> bool:
    return any(path.startswith(d) for d in DEVICE_PATHS)


def scan_session(filepath: str):
    """Yield ctx_read result dicts from a session JSONL."""
    with open(filepath) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("type") != "message":
                continue
            msg = d.get("message", {})
            if msg.get("role") != "toolResult" or msg.get("toolName") != "ctx_read":
                continue

            content = msg.get("content", [])
            text = ""
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and isinstance(block.get("text"), str):
                        text += block["text"]
            elif isinstance(content, str):
                text = content

            is_error = msg.get("isError", False)
            is_compressed = text.startswith("[cleared:")

            yield {
                "text": text,
                "bytes": len(text.encode("utf-8", errors="replace")),
                "is_error": is_error,
                "is_compressed": is_compressed,
                "path": extract_path(text),
                "ts": d.get("timestamp", ""),
            }


def main():
    days = None
    session_file = None
    for i, arg in enumerate(sys.argv[1:], 1):
        if arg == "--days" and i < len(sys.argv) - 1:
            days = int(sys.argv[i + 1])
        elif arg == "--session" and i < len(sys.argv) - 1:
            session_file = sys.argv[i + 1]

    if session_file:
        files = [session_file]
    else:
        files = sorted(glob.glob(f"{SESSIONS_DIR}/*/*.jsonl"), key=os.path.getmtime, reverse=True)
        if days:
            cutoff = datetime.now() - timedelta(days=days)
            files = [f for f in files if datetime.fromtimestamp(os.path.getmtime(f)) >= cutoff]

    if not files:
        print("No session files found.")
        return

    # Collect metrics
    total = 0
    errors = 0
    compressed = 0
    total_bytes = 0
    compressed_bytes = 0
    ext_counter = Counter()
    boring_hits = 0
    device_hits = 0
    path_counter = Counter()
    session_read_counts = []
    per_session = []

    for sf in files:
        session_reads = 0
        for r in scan_session(sf):
            total += 1
            session_reads += 1
            total_bytes += r["bytes"]

            ext = get_extension(r["path"])
            if ext:
                ext_counter[ext] += 1

            if r["path"]:
                path_counter[r["path"]] += 1

            if r["is_error"]:
                errors += 1
            if r["is_compressed"]:
                compressed += 1
                compressed_bytes += r["bytes"]
            if is_boring(r["path"], ext):
                boring_hits += 1
            if is_device_path(r["path"]):
                device_hits += 1

        if session_reads > 0:
            session_read_counts.append(session_reads)
            per_session.append((os.path.basename(sf), session_reads))

    # Compute stats
    avg_bytes = total_bytes / total if total else 0
    error_rate = errors / total * 100 if total else 0
    compress_rate = compressed / total * 100 if total else 0
    median_bytes = statistics.median([r["bytes"] for r in scan_session(files[0])]) if files and total else 0

    # Collect all result bytes for median
    all_bytes = []
    for sf in files:
        for r in scan_session(sf):
            all_bytes.append(r["bytes"])
    median_bytes = statistics.median(all_bytes) if all_bytes else 0

    # Output panel
    print("=" * 60)
    print("READ-COST PANEL")
    print("=" * 60)
    print(f"Sessions scanned:     {len(files)}")
    print(f"Total ctx_read calls: {total}")
    print()

    print("--- Volume ---")
    print(f"Total result bytes:   {total_bytes:,} ({total_bytes/1024:.1f} KB)")
    print(f"Avg bytes/read:       {avg_bytes:.0f}")
    print(f"Median bytes/read:    {median_bytes:.0f}")
    print(f"Compressed (cleared): {compressed} ({compress_rate:.1f}%) — {compressed_bytes:,} bytes")
    if compressed:
        print(f"  Compression ratio:  {compressed_bytes/total_bytes*100:.1f}% of total bytes")
    print()

    print("--- Error / Miss ---")
    print(f"Errors:               {errors} ({error_rate:.1f}%)")
    print(f"Boring-format hits:   {boring_hits}")
    print(f"Device path hits:     {device_hits}")
    print()

    print("--- Extension distribution (top 15) ---")
    for ext, count in ext_counter.most_common(15):
        flag = " ⚠" if ext in BORING_EXT else ""
        print(f"  {ext or '(none)':<15} {count:>5} ({count/total*100:.1f}%){flag}")
    print()

    print("--- Top read paths (top 10) ---")
    for path, count in path_counter.most_common(10):
        flag = " ⚠" if is_boring(path, get_extension(path)) else ""
        print(f"  {count:>3}x  {path[:70]}{flag}")
    print()

    print("--- Sessions with most reads (top 5) ---")
    per_session.sort(key=lambda x: x[1], reverse=True)
    for name, count in per_session[:5]:
        print(f"  {count:>4}  {name[:50]}")
    print()

    # Health verdict
    print("--- Verdict ---")
    issues = []
    if error_rate > 5:
        issues.append(f"High miss rate ({error_rate:.1f}%) — use did-you-mean on file-not-found")
    if boring_hits > 0:
        issues.append(f"{boring_hits} boring-format reads — use structured extractors")
    if device_hits > 0:
        issues.append(f"{device_hits} device-path reads — block /dev, /proc/kcore")
    if compress_rate < 20 and total > 50:
        issues.append(f"Low compression ({compress_rate:.1f}%) — pruner may not be catching reads")
    if not issues:
        print("  ✓ All read metrics within healthy thresholds")
    else:
        for issue in issues:
            print(f"  ⚠ {issue}")
    print("=" * 60)


if __name__ == "__main__":
    main()
