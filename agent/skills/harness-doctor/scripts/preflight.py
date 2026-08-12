#!/usr/bin/env python3
"""Pre-flight readiness check (survey §8.3): validate environment, providers,
binaries, and config BEFORE a suite/session spends tokens — so setup failures
aren't misattributed to the model.

Catches hypa-class failures (broken shims), dead providers, missing extension
files, unparsable configs. Exit 0 = green, 1 = any FAIL.
"""
import json, os, re, socket, sys, urllib.request, urllib.error
from pathlib import Path

HOME = os.path.expanduser("~")
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((ok, name, detail))


def http_alive(url, timeout=4):
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=timeout):
            return True, "200"
    except urllib.error.HTTPError as e:
        return True, f"HTTP {e.code} (reachable)"
    except Exception as e:
        return False, str(e)[:80]


def providers():
    p = f"{HOME}/.pi/agent/models.json"
    d = json.load(open(p))
    for name, v in d.get("providers", {}).items():
        url = v.get("baseUrl")
        if url:
            ok, det = http_alive(url)
            check(f"provider pi/{name} {url}", ok, det)
    rx = f"{HOME}/.reasonix/config.toml"
    if os.path.exists(rx):
        for m in re.finditer(r'(?m)^base_url\s*=\s*"([^"]+)"', open(rx).read()):
            ok, det = http_alive(m.group(1))
            check(f"provider reasonix {m.group(1)}", ok, det)


def broken_shims():
    import glob as globmod
    bindir = f"{HOME}/.local/bin"
    for f in sorted(os.listdir(bindir)):
        p = os.path.join(bindir, f)
        if not os.path.isfile(p) or os.path.getsize(p) > 8192:
            continue
        try:
            txt = open(p, errors="ignore").read()
        except Exception:
            continue
        if not txt.startswith("#!"):
            continue
        optional, exec_targets = set(), []
        for ln in txt.splitlines():
            for m in re.finditer(r"\[\s+-[fe]\s+[^\]]*?(/(?:home|usr|opt)[^\s\]\"']+)", ln):
                optional.add(m.group(1))
            if re.search(r'(^|\s)exec\s', ln):
                exec_targets += re.findall(r'(/(?:home|usr|opt)/[^\s"\']+)', ln)
        def resolve(t):
            if "$" in t:
                return True
            if "*" in t:
                return bool(globmod.glob(t))
            return os.path.exists(t)
        missing = [t for t in exec_targets if t not in optional and not resolve(t)]
        if missing:
            check(f"shim ~/.local/bin/{f}", False, f"exec target missing: {missing[0]}")


def harness_binaries():
    for b in ("pi", "codex", "reasonix", "lean-ctx", "context-mode"):
        found = any(os.path.isfile(os.path.join(d, b)) and os.access(os.path.join(d, b), os.X_OK)
                    for d in os.environ.get("PATH", "").split(":"))
        check(f"binary {b} on PATH", found)


def configs():
    for p in (f"{HOME}/.pi/agent/settings.json", f"{HOME}/.pi/agent/models.json",
              f"{HOME}/.pi/agent/npm/package.json"):
        try:
            json.load(open(p))
            check(f"parse {os.path.basename(p)}", True)
        except Exception as e:
            check(f"parse {os.path.basename(p)}", False, str(e)[:60])
    s = json.load(open(f"{HOME}/.pi/agent/settings.json"))
    for ext in s.get("extensions", []):
        p = os.path.expanduser(ext)
        check(f"extension exists {os.path.basename(p)}", os.path.exists(p), p if not os.path.exists(p) else "")


def env_credentials():
    env_d = Path(f"{HOME}/.config/env.d")
    if not env_d.is_dir():
        print("env.d: absent (ok)")
        return
    for f in sorted(os.listdir(env_d)):
        p = f"{HOME}/.config/env.d/{f}"
        names = re.findall(r'(?m)^export\s+([A-Z_][A-Z0-9_]*)', open(p).read())
        for n in names:
            check(f"credential ${n} ({f})", os.path.exists(p),
                  "set in env" if n in os.environ else "file present, not in this process env")


def bench_rig():
    check("bench probe.sh present", os.path.exists(f"{HOME}/Projects/pi-harness-config/bench/probe.sh"))


def main():
    providers()
    broken_shims()
    harness_binaries()
    configs()
    env_credentials()
    bench_rig()
    fails = [r for r in RESULTS if not r[0]]
    for ok, name, detail in RESULTS:
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  — {detail}" if detail and not ok else ""))
    print(f"\npreflight: {len(RESULTS) - len(fails)}/{len(RESULTS)} green"
          + (f", {len(fails)} FAIL" if fails else ""))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
