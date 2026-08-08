#!/usr/bin/env python3
"""Harness inventory: enumerate harnesses, providers, credentials, pi stack.

Authoritative detection per memory/harnesses.md rules:
1. fnm npm globals, 2. full ~/.local/bin listing, 3. binary + ~/.<name> config dir,
4. --help for unknowns (skipped here — report-only, no classification of new tools).
"""
import json, os, re, subprocess, sys, glob, time

HOME = os.path.expanduser("~")
SNAP = f"{HOME}/.pi/agent/harness-inventory.json"

# name -> (candidate binaries, candidate config dirs)
HARNESS_CANDIDATES = {
    "pi":       (["pi"], [".pi"]),
    "codex":    (["codex", "ocx", "opencodex"], [".codex", ".opencodex"]),
    "reasonix": (["reasonix"], [".reasonix"]),
    "mimocode": (["mimocode", "mimo"], [".mimocode"]),
    "omp":      (["omp"], [".omp"]),          # removed 2026-07-30
    "cursor":   (["cursor"], [".cursor"]),    # ghost
}
GHOST_KNOWN = {"omp", "rtk", "rtkr", "headroom", "audit-upgrade", "cursor", "hypa"}


def which(binname):
    for d in os.environ.get("PATH", "").split(":"):
        p = os.path.join(d, binname)
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None


def npm_globals():
    out = []
    for d in glob.glob(f"{HOME}/.local/share/fnm/node-versions/*/installation/lib/node_modules"):
        for e in os.listdir(d):
            if e.startswith("@"):
                out.extend(f"{e}/{s}" for s in os.listdir(os.path.join(d, e)))
            elif not e.startswith("."):
                out.append(e)
    return sorted(out)


def local_bins():
    d = f"{HOME}/.local/bin"
    return sorted(os.listdir(d)) if os.path.isdir(d) else []


def detect_harnesses():
    rows = []
    for name, (bins, dirs) in HARNESS_CANDIDATES.items():
        found_bins = {b: which(b) for b in bins if which(b)}
        found_dirs = {d: f"{HOME}/{d}" for d in dirs if os.path.isdir(f"{HOME}/{d}")}
        status = "active" if (found_bins and found_dirs) else \
                 "partial" if (found_bins or found_dirs) else "absent"
        if name in GHOST_KNOWN and status != "active":
            status = "ghost(expected-absent)"
        rows.append({"name": name, "status": status, "binaries": found_bins, "config_dirs": found_dirs})
    for b in local_bins():
        if b in GHOST_KNOWN:
            rows.append({"name": b, "status": "GHOST-BINARY-PRESENT", "binaries": {b: which(b)}, "config_dirs": {}})
    return rows


def pi_providers():
    p = f"{HOME}/.pi/agent/models.json"
    if not os.path.exists(p):
        return {}
    d = json.load(open(p))
    return {name: {"baseUrl": v.get("baseUrl"), "api": v.get("api"),
                   "models": len(v.get("models", []))}
            for name, v in d.get("providers", {}).items()}


def reasonix_providers():
    p = f"{HOME}/.reasonix/config.toml"
    if not os.path.exists(p):
        return {}
    txt = open(p).read()
    out = {}
    for block in re.split(r'(?m)^\[\[providers\]\]\s*$', txt)[1:]:
        body = re.split(r'(?m)^\[(?!\[providers\]\])', block)[0]
        name = re.search(r'(?m)^name\s*=\s*"([^"]+)"', body)
        url = re.search(r'(?m)^base_url\s*=\s*"([^"]+)"', body)
        key = re.search(r'(?m)^api_key_env\s*=\s*"([^"]+)"', body)
        if name:
            out[name.group(1)] = {"base_url": url.group(1) if url else None,
                                  "api_key_env": key.group(1) if key else None}
    return out


def codex_surface():
    p = f"{HOME}/.codex/config.toml"
    if not os.path.exists(p):
        return {}
    txt = open(p).read()
    url = re.search(r'(?m)^openai_base_url\s*=\s*"([^"]+)"', txt)
    cat = re.search(r'(?m)^model_catalog_json\s*=\s*"([^"]+)"', txt)
    return {"openai_base_url": url.group(1) if url else None,
            "catalog": cat.group(1) if cat else None,
            "note": "proxied via app-server; providers live in catalog, not edited by provider_ops"}


def env_credentials():
    out = {}
    for f in sorted(glob.glob(f"{HOME}/.config/env.d/*.sh")):
        names = re.findall(r'(?m)^export\s+([A-Z_][A-Z0-9_]*)', open(f).read())
        out[os.path.basename(f)] = names
    return out


def pi_stack():
    s = json.load(open(f"{HOME}/.pi/agent/settings.json"))
    skills = sorted(os.listdir(f"{HOME}/.pi/agent/skills"))
    exts = sorted(os.listdir(f"{HOME}/.pi/agent/extensions"))
    return {"packages": s.get("packages", []), "extensions": s.get("extensions", []),
            "skills": skills, "local_extension_files": exts,
            "defaultProvider": s.get("defaultProvider"), "defaultModel": s.get("defaultModel")}


def main():
    inv = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "harnesses": detect_harnesses(),
        "providers": {"pi": pi_providers(), "reasonix": reasonix_providers(), "codex": codex_surface()},
        "credentials_env_d": env_credentials(),
        "npm_globals": npm_globals(),
        "pi_stack": pi_stack(),
    }
    os.makedirs(os.path.dirname(SNAP), exist_ok=True)
    prev = json.load(open(SNAP)) if os.path.exists(SNAP) else None

    print("== Harnesses ==")
    for h in inv["harnesses"]:
        print(f"  {h['name']:<10} {h['status']}")
    print("== Providers ==")
    for src, ps in inv["providers"].items():
        if isinstance(ps, dict):
            for name, meta in ps.items():
                if not isinstance(meta, dict):
                    print(f"  [{src}] {name}: {meta}")
                    continue
                detail = meta.get("baseUrl") or meta.get("base_url") or meta.get("openai_base_url") or ""
                print(f"  [{src}] {name} {detail}")
    print("== Credentials (env.d) ==")
    for f, names in inv["credentials_env_d"].items():
        print(f"  {f}: {', '.join(names)}")
    print(f"== pi stack: {len(inv['pi_stack']['packages'])} packages, "
          f"{len(inv['pi_stack']['skills'])} skills, "
          f"{len(inv['pi_stack']['extensions'])} extensions ==")

    if "--verify" in sys.argv and prev:
        print("== Drift vs previous snapshot ==")
        drift = []
        for key in ("harnesses", "providers", "credentials_env_d", "npm_globals"):
            if inv[key] != prev.get(key):
                drift.append(key)
        print("  " + (", ".join(drift) if drift else "none"))

    json.dump(inv, open(SNAP, "w"), indent=2)
    print(f"snapshot -> {SNAP}")


if __name__ == "__main__":
    main()
