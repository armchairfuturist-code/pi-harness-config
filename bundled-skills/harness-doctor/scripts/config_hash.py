#!/usr/bin/env python3
"""Harness-config hash (survey §8.6.1): scores are properties of the model–harness
pair — record this hash in every benchmark result; any config change = re-run canaries.
Usage: config_hash.py [--verbose] -> prints 12-char hash.
"""
import hashlib, json, os, sys

HOME = os.path.expanduser("~")
INPUTS = [
    f"{HOME}/.pi/agent/settings.json",
    f"{HOME}/.pi/agent/models.json",
    f"{HOME}/.pi/agent/APPEND_SYSTEM.md",
    f"{HOME}/.pi/tscg.json",
    f"{HOME}/.pi/agent/npm/package.json",
]


def main():
    h = hashlib.sha256()
    parts = []
    for p in INPUTS:
        if os.path.exists(p):
            data = open(p, "rb").read()
            parts.append((os.path.basename(p), hashlib.md5(data).hexdigest()[:8]))
            h.update(os.path.basename(p).encode() + b"\0" + data + b"\0")
    ext_dir = f"{HOME}/.pi/agent/extensions"
    if os.path.isdir(ext_dir):
        for f in sorted(os.listdir(ext_dir)):
            fp = os.path.join(ext_dir, f)
            if os.path.isfile(fp):
                data = open(fp, "rb").read()
                parts.append((f"ext/{f}", hashlib.md5(data).hexdigest()[:8]))
                h.update(f.encode() + b"\0" + data + b"\0")
    print(f"config-hash: {h.hexdigest()[:12]}")
    if "--verbose" in sys.argv:
        for name, mh in parts:
            print(f"  {mh}  {name}")


if __name__ == "__main__":
    main()
