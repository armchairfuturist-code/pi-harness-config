#!/usr/bin/env python3
"""Transactional provider add/remove across harnesses.

Surfaces: pi models.json, reasonix config.toml [[providers]], env.d credentials.
Codex is proxied via app-server catalog — reported, never edited.

Dry-run by default; --apply mutates. Every mutation: snapshot -> edit -> validate
(JSON/TOML parse) -> residue scan; auto-rollback on any failure.
Never touches auth.json. Never prints or writes secret values.
"""
import argparse, json, os, re, shutil, sys, time

HOME = os.path.expanduser("~")
PI_MODELS = f"{HOME}/.pi/agent/models.json"
REASONIX = f"{HOME}/.reasonix/config.toml"
ENV_D = f"{HOME}/.config/env.d"
BACKUPS = f"{HOME}/.pi/agent/harness-doctor-backups"


def toml_parse_ok(path):
    try:
        import tomllib
        tomllib.load(open(path, "rb"))
        return True
    except Exception as e:
        print(f"  TOML validation failed: {e}")
        return False


class Tx:
    """Snapshot/rollback transaction."""
    def __init__(self, apply):
        self.apply = apply
        self.snapdir = None
        self.touched = []

    def snapshot(self, path):
        if not self.apply or not os.path.exists(path):
            return
        if self.snapdir is None:
            self.snapdir = f"{BACKUPS}/{time.strftime('%Y%m%d-%H%M%S')}"
            os.makedirs(self.snapdir, exist_ok=True)
        dst = os.path.join(self.snapdir, path.replace("/", "__"))
        shutil.copy2(path, dst)
        self.touched.append((path, dst))

    def rollback(self):
        for path, dst in self.touched:
            shutil.copy2(dst, path)
        if self.touched:
            print(f"  ROLLED BACK {len(self.touched)} file(s) from {self.snapdir}")


def find_pi_provider(d, name):
    for k in d.get("providers", {}):
        if k.lower() == name.lower():
            return k
    return None


def reasonix_remove_block(txt, name):
    """Remove [[providers]] block whose name matches. Returns (new_txt, found, key_env)."""
    parts = re.split(r'(?m)^(\[\[providers\]\])\s*$', txt)
    # parts: [pre, '[[providers]]', body, '[[providers]]', body, ...]
    out = [parts[0]]
    found = False
    key_env = None
    i = 1
    while i < len(parts):
        header, body = parts[i], parts[i + 1]
        m = re.search(r'(?m)^name\s*=\s*"([^"]+)"', body)
        if m and m.group(1).lower() == name.lower():
            found = True
            k = re.search(r'(?m)^api_key_env\s*=\s*"([^"]+)"', body)
            key_env = k.group(1) if k else None
            body = re.sub(r'.*\n', '', body, count=0)  # drop whole block
            body = ""  # ensure removal
        else:
            out.append(header)
            out.append(body)
        i += 2
    new = "".join(out)
    new = re.sub(r'\n{3,}', '\n\n', new)
    return new, found, key_env


def env_d_find_var(varname):
    for f in sorted(os.listdir(ENV_D)) if os.path.isdir(ENV_D) else []:
        p = os.path.join(ENV_D, f)
        if re.search(rf'(?m)^export\s+{re.escape(varname)}\b', open(p).read()):
            return p
    return None


def cmd_remove(args):
    tx = Tx(args.apply)
    plan, key_envs = [], set()

    # --- pi models.json ---
    d = json.load(open(PI_MODELS))
    key = find_pi_provider(d, args.name)
    if key:
        n_models = len(d["providers"][key].get("models", []))
        plan.append(f"pi: remove provider '{key}' (+{n_models} models) from models.json")
    else:
        plan.append(f"pi: '{args.name}' not present")

    # --- reasonix ---
    rx_found, rx_key = False, None
    if os.path.exists(REASONIX):
        txt = open(REASONIX).read()
        _, rx_found, rx_key = reasonix_remove_block(txt, args.name)
        plan.append(f"reasonix: {'remove [[providers]] block' if rx_found else 'not present'}")
        if rx_key:
            key_envs.add(rx_key)

    # --- env.d (only vars referenced by removed providers) ---
    env_hits = {v: env_d_find_var(v) for v in key_envs}
    for v, p in env_hits.items():
        if p:
            action = "remove file" if args.with_env else "report only (use --with-env to remove)"
            plan.append(f"env.d: {os.path.basename(p)} exports {v} -> {action}")

    print("DRY-RUN (no changes):" if not args.apply else "APPLYING:")
    for line in plan:
        print(f"  {line}")
    if not args.apply:
        return 0

    try:
        if key:
            tx.snapshot(PI_MODELS)
            del d["providers"][key]
            json.dump(d, open(PI_MODELS, "w"), indent=2)
            json.load(open(PI_MODELS))  # validate
            print("  pi: done, JSON valid")
        if rx_found:
            tx.snapshot(REASONIX)
            new, _, _ = reasonix_remove_block(txt, args.name)
            open(REASONIX, "w").write(new)
            if not toml_parse_ok(REASONIX):
                raise RuntimeError("reasonix config.toml invalid after edit")
            print("  reasonix: done, TOML valid")
        if args.with_env:
            for v, p in env_hits.items():
                if p:
                    tx.snapshot(p)
                    os.remove(p)
                    print(f"  env.d: removed {os.path.basename(p)}")
    except Exception as e:
        print(f"ERROR: {e}")
        tx.rollback()
        return 1

    # residue scan
    residue = []
    for p in [PI_MODELS, REASONIX]:
        if os.path.exists(p) and re.search(re.escape(args.name), open(p).read(), re.I):
            residue.append(p)
    print("  residue scan:", "CLEAN" if not residue else f"FOUND in {residue}")
    return 0 if not residue else 2


def cmd_add(args):
    if not args.base_url or not args.models:
        print("add requires --base-url and --models"); return 2
    models = [m.strip() for m in args.models.split(",") if m.strip()]
    api = args.api or "openai-completions"
    tx = Tx(args.apply)

    d = json.load(open(PI_MODELS))
    exists = find_pi_provider(d, args.name)
    plan = [f"pi: {'REPLACE' if exists else 'add'} provider '{args.name}' "
            f"({api}, {len(models)} models, key={'$' + args.key_env if args.key_env else 'none'})"]
    if os.path.exists(REASONIX):
        plan.append(f"reasonix: append [[providers]] block '{args.name}'")
    if args.key_env:
        plan.append(f"env.d: YOU must add: export {args.key_env}=<secret>  (never written by this tool)")

    print("DRY-RUN (no changes):" if not args.apply else "APPLYING:")
    for line in plan:
        print(f"  {line}")
    if not args.apply:
        return 0

    try:
        tx.snapshot(PI_MODELS)
        prov = {"baseUrl": args.base_url, "api": api,
                "models": [{"id": m, "name": m} for m in models]}
        if args.key_env:
            prov["apiKey"] = f"${args.key_env}"
        d.setdefault("providers", {})[args.name] = prov
        json.dump(d, open(PI_MODELS, "w"), indent=2)
        json.load(open(PI_MODELS))
        print("  pi: done, JSON valid")

        if os.path.exists(REASONIX):
            tx.snapshot(REASONIX)
            block = (f'\n[[providers]]\nname = "{args.name}"\nkind = "openai"\n'
                     f'base_url = "{args.base_url}"\n'
                     f'models = {json.dumps(models)}\ndefault = "{models[0]}"\n')
            if args.key_env:
                block += f'api_key_env = "{args.key_env}"\n'
            open(REASONIX, "a").write(block)
            if not toml_parse_ok(REASONIX):
                raise RuntimeError("reasonix config.toml invalid after edit")
            print("  reasonix: done, TOML valid")
    except Exception as e:
        print(f"ERROR: {e}")
        tx.rollback()
        return 1
    print("  done. Restart harnesses to pick up changes.")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("remove", "add"):
        p = sub.add_parser(name)
        p.add_argument("name")
        p.add_argument("--apply", action="store_true")
        p.add_argument("--with-env", action="store_true")
        p.add_argument("--base-url")
        p.add_argument("--models")
        p.add_argument("--api")
        p.add_argument("--key-env")
    args = ap.parse_args()
    return cmd_remove(args) if args.cmd == "remove" else cmd_add(args)


if __name__ == "__main__":
    sys.exit(main())
