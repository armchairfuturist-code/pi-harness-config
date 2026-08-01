#!/usr/bin/env python3
"""optimize-models-json.py — sync models.json from live provider /models APIs.

Fetches Venice + Lilac catalogs, reconciles ~/.pi/agent/models.json:
  - add missing / drop stale ids
  - fix contextWindow, maxTokens, reasoning, input, name from API
  - install non-collapsing thinkingLevelMap for reasoning models
  - apply known special-case maps (kimi-k3, mercury-2, gpt-5.5 family)
  - backup before write

Usage:
  optimize-models-json.py              # apply to ~/.pi/agent/models.json
  optimize-models-json.py --dry-run    # print plan only
  optimize-models-json.py PATH.json    # custom target
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import urllib.request
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any

DEFAULT_TARGET = Path.home() / ".pi/agent/models.json"

# Non-collapsing maps (repo CE-lite style)
MAP_EFFORT = {
    "minimal": "low",
    "low": "low",
    "medium": "medium",
    "high": "high",
    "xhigh": "xhigh",
    "max": "max",
}
MAP_REASONING_NO_EFFORT = {
    "minimal": "low",
    "low": "low",
    "medium": "medium",
    "high": "high",
    "xhigh": "high",
    "max": "high",
}
# Special cases by model id (provider-agnostic id match)
SPECIAL_MAPS: dict[str, dict[str, str]] = {
    "kimi-k3": {
        "minimal": "max",
        "low": "max",
        "medium": "max",
        "high": "max",
        "xhigh": "max",
        "max": "max",
    },
    "mercury-2": {
        "minimal": "none",
        "none": "none",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "high",
        "max": "high",
    },
    "openai-gpt-55": {
        "minimal": "none",
        "none": "none",
        "low": "low",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh",
    },
    "openai-gpt-55-pro": {
        "minimal": "medium",
        "low": "medium",
        "medium": "medium",
        "high": "high",
        "xhigh": "xhigh",
        "max": "xhigh",
    },
}

PROVIDERS = {
    "Venice": {
        "baseUrl": "https://api.venice.ai/api/v1",
        "models_url": "https://api.venice.ai/api/v1/models",
        "api": "openai-completions",
        "apiKey": "VENICE_API_KEY",
        "auth_probe_model": "grok-4-5",
        "compat": {"supportsDeveloperRole": False, "supportsReasoningEffort": True},
    },
    "Lilac": {
        "baseUrl": "https://api.getlilac.com/v1",
        "models_url": "https://api.getlilac.com/v1/models",
        "api": "openai-completions",
        "apiKey": "LILAC_API_KEY",
        "auth_probe_model": "moonshotai/kimi-k2.6",
        "compat": {"supportsDeveloperRole": False, "supportsReasoningEffort": True},
    },
}


def die(msg: str, code: int = 1) -> None:
    print(f"[optimize-models] ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def get_api_key(provider: str, probe_model: str) -> str:
    env_map = {
        "Venice": ["VENICE_API_KEY", "VENICE_INFERENCE_KEY"],
        "Lilac": ["LILAC_API_KEY"],
    }
    for k in env_map.get(provider, []):
        if os.environ.get(k):
            return os.environ[k]
    try:
        out = subprocess.check_output(
            ["pi", "auth", "print-api-key", "--provider", provider, "--model", probe_model],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            return out
    except Exception:
        pass
    die(f"no API key for {provider}")


def http_get_json(url: str, token: str) -> Any:
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode())


def normalize_venice(item: dict) -> dict:
    spec = item.get("model_spec") or {}
    caps = spec.get("capabilities") or {}
    ctx = spec.get("availableContextTokens") or item.get("context_length") or 128000
    max_tok = spec.get("maxCompletionTokens") or min(int(ctx), 65536)
    reasoning = bool(caps.get("supportsReasoning"))
    effort = bool(caps.get("supportsReasoningEffort"))
    inputs = ["text"]
    if caps.get("supportsVision"):
        inputs.append("image")
    entry = {
        "id": item["id"],
        "name": spec.get("name") or item["id"],
        "contextWindow": int(ctx),
        "maxTokens": int(max_tok),
        "reasoning": reasoning,
        "input": inputs,
    }
    if reasoning:
        entry["thinkingLevelMap"] = choose_map(item["id"], effort)
    if effort:
        entry.setdefault("compat", {})["supportsReasoningEffort"] = True
    # skip offline
    if spec.get("offline"):
        entry["_offline"] = True
    return entry


def normalize_lilac(item: dict) -> dict:
    top = item.get("top_provider") or {}
    arch = item.get("architecture") or {}
    ctx = item.get("context_length") or top.get("context_length") or 128000
    max_tok = top.get("max_completion_tokens") or ctx
    feats = set(item.get("supported_features") or [])
    params = set(item.get("supported_parameters") or [])
    reasoning = "reasoning" in feats or "reasoning_effort" in params or "include_reasoning" in params
    effort = "reasoning_effort" in params or reasoning  # lilac often exposes reasoning feature
    mods = set(arch.get("input_modalities") or [])
    inputs = ["text"]
    if "image" in mods:
        inputs.append("image")
    entry = {
        "id": item["id"],
        "name": item.get("name") or item["id"],
        "contextWindow": int(ctx),
        "maxTokens": int(max_tok),
        "reasoning": bool(reasoning),
        "input": inputs,
    }
    if reasoning:
        entry["thinkingLevelMap"] = choose_map(item["id"], True if effort else False)
    if effort:
        entry.setdefault("compat", {})["supportsReasoningEffort"] = True
    return entry


def choose_map(model_id: str, supports_effort: bool) -> dict[str, str]:
    if model_id in SPECIAL_MAPS:
        return dict(SPECIAL_MAPS[model_id])
    if supports_effort:
        return dict(MAP_EFFORT)
    return dict(MAP_REASONING_NO_EFFORT)


def is_weak_map(m: dict | None) -> bool:
    if not m:
        return True
    if m.get("xhigh") in ("low", "none") or m.get("max") in ("low", "none"):
        return True
    return False


def merge_model(old: dict | None, new: dict) -> tuple[dict, list[str]]:
    """Merge API-derived new onto old; return (model, change notes)."""
    changes: list[str] = []
    if old is None:
        out = {k: v for k, v in new.items() if not k.startswith("_")}
        return out, ["added"]

    out = deepcopy(old)
    for field in ("name", "contextWindow", "maxTokens", "reasoning", "input"):
        if field in new and out.get(field) != new[field]:
            changes.append(f"{field}:{out.get(field)!r}->{new[field]!r}")
            out[field] = new[field]

    # thinking map
    if new.get("reasoning"):
        desired = new.get("thinkingLevelMap")
        cur = out.get("thinkingLevelMap")
        if desired and (is_weak_map(cur) or cur != desired):
            # If special or weak/missing, replace with desired
            if is_weak_map(cur) or (out.get("id") in SPECIAL_MAPS) or not cur:
                if cur != desired:
                    changes.append("thinkingLevelMap:fixed")
                    out["thinkingLevelMap"] = desired
            else:
                # keep stronger existing if it already has non-collapsing xhigh/max
                pass
    else:
        if "thinkingLevelMap" in out:
            changes.append("thinkingLevelMap:removed")
            out.pop("thinkingLevelMap", None)

    # compat supportsReasoningEffort from API signal
    if new.get("compat", {}).get("supportsReasoningEffort"):
        c = dict(out.get("compat") or {})
        if not c.get("supportsReasoningEffort"):
            c["supportsReasoningEffort"] = True
            out["compat"] = c
            changes.append("compat.supportsReasoningEffort:true")

    if not changes:
        changes.append("unchanged")
    return out, changes


def optimize(target: Path, dry_run: bool) -> int:
    if not target.exists():
        die(f"missing {target}")

    config = json.loads(target.read_text())
    if "providers" not in config:
        die("no providers key")

    report: list[str] = []
    new_providers: dict[str, Any] = {}

    for pname, pmeta in PROVIDERS.items():
        token = get_api_key(pname, pmeta["auth_probe_model"])
        raw = http_get_json(pmeta["models_url"], token)
        data = raw.get("data") if isinstance(raw, dict) else raw
        if not isinstance(data, list):
            die(f"{pname}: unexpected /models payload")

        if pname == "Venice":
            api_models = [normalize_venice(x) for x in data]
        else:
            api_models = [normalize_lilac(x) for x in data]

        api_models = [m for m in api_models if not m.get("_offline")]
        api_by_id = {m["id"]: m for m in api_models}

        old_prov = (config.get("providers") or {}).get(pname) or {}
        old_by_id = {m["id"]: m for m in (old_prov.get("models") or []) if isinstance(m, dict) and "id" in m}

        # preserve provider apiKey if present
        api_key = old_prov.get("apiKey") or pmeta["apiKey"]
        prov_out = {
            "baseUrl": pmeta["baseUrl"],
            "api": pmeta["api"],
            "apiKey": api_key,
            "compat": dict(pmeta["compat"]),
            "models": [],
        }

        added = removed = fixed = unchanged = 0
        # keep API order
        for mid, api_m in api_by_id.items():
            merged, ch = merge_model(old_by_id.get(mid), api_m)
            # strip private
            merged = {k: v for k, v in merged.items() if not str(k).startswith("_")}
            prov_out["models"].append(merged)
            if ch == ["added"]:
                added += 1
                report.append(f"  + {pname}/{mid}")
            elif ch == ["unchanged"]:
                unchanged += 1
            else:
                fixed += 1
                report.append(f"  ~ {pname}/{mid}: {', '.join(ch)}")

        stale = sorted(set(old_by_id) - set(api_by_id))
        for mid in stale:
            removed += 1
            report.append(f"  - {pname}/{mid} (stale)")

        report.insert(
            0 if pname == "Venice" else len(report),
            f"{pname}: api={len(api_by_id)} old={len(old_by_id)} +{added} ~{fixed} ={unchanged} -{removed}",
        )
        # actually put summary better at end per provider
        new_providers[pname] = prov_out
        print(f"[optimize-models] {pname}: api={len(api_by_id)} local_was={len(old_by_id)} added={added} changed={fixed} unchanged={unchanged} removed={removed}")

    # Keep any other providers untouched
    for pname, pconf in (config.get("providers") or {}).items():
        if pname not in new_providers:
            new_providers[pname] = pconf
            print(f"[optimize-models] kept extra provider {pname}")

    out = {"providers": new_providers}

    # stats
    weak = 0
    no_map = 0
    for pname, pconf in new_providers.items():
        for m in pconf.get("models") or []:
            if m.get("reasoning") and is_weak_map(m.get("thinkingLevelMap")):
                weak += 1
            if m.get("reasoning") and not m.get("thinkingLevelMap"):
                no_map += 1
    print(f"[optimize-models] post-check weak_maps={weak} reasoning_without_map={no_map}")

    if dry_run:
        print("[optimize-models] DRY RUN — no write")
        for line in report:
            if line.strip().startswith(("+", "-", "~")):
                print(line)
        print(json.dumps({"Venice": len(new_providers.get("Venice", {}).get("models", [])), "Lilac": len(new_providers.get("Lilac", {}).get("models", []))}))
        return 0

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    bak = target.with_suffix(target.suffix + f".bak-optimize-{ts}")
    shutil.copy2(target, bak)
    print(f"[optimize-models] backup -> {bak}")
    target.write_text(json.dumps(out, indent=2) + "\n")
    print(f"[optimize-models] wrote {target}")
    return 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target", nargs="?", default=str(DEFAULT_TARGET))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    raise SystemExit(optimize(Path(args.target).expanduser(), args.dry_run))


if __name__ == "__main__":
    main()
