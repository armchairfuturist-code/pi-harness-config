#!/usr/bin/env python3
"""
base64_bench.py — Private LLM benchmark for ranking providers/quantizations.

Tests three encoding tasks that are hard for LLMs due to BPE tokenization:
  1. base64   — encode a string to base64, verify it decodes back correctly
  2. morse    — encode a string to International Morse Code, verify against reference
  3. reversed — reverse a string character-by-character, exact match

These tasks correlate with the Artificial Analysis Intelligence Index (r=0.91,
r/LocalLLaMA Jul 2026) because BPE tokenizers mangle the output character
sequences, forcing the model to self-correct through garbled token streams.
This self-correction ability transfers to coding tasks.

Usage:
  python3 base64_bench.py --quick                    # N=5, base64 only (~30s)
  python3 base64_bench.py --full                     # N=20, all variants
  python3 base64_bench.py --shot                     # single string, instant proxy
  python3 base64_bench.py --providers providers.json # custom config
  python3 base64_bench.py --variant morse --n 10     # specific variant

Requires: Python 3.10+, requests (pip install requests)
"""

from __future__ import annotations

import argparse
import base64 as b64mod
import json
import os
import random
import sys
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

import requests

# ─── Morse Code Reference ─────────────────────────────────────────────────────

MORSE_TABLE: dict[str, str] = {
    "A": ".-", "B": "-...", "C": "-.-.", "D": "-..", "E": ".", "F": "..-.",
    "G": "--.", "H": "....", "I": "..", "J": ".---", "K": "-.-", "L": ".-..",
    "M": "--", "N": "-.", "O": "---", "P": ".--.", "Q": "--.-", "R": ".-.",
    "S": "...", "T": "-", "U": "..-", "V": "...-", "W": ".--", "X": "-..-",
    "Y": "-.--", "Z": "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
    " ": "/",
}


def to_morse(text: str) -> str:
    """Convert text to morse code. Unknown chars are skipped."""
    parts = []
    for ch in text.upper():
        if ch in MORSE_TABLE:
            parts.append(MORSE_TABLE[ch])
    return " ".join(parts)


# ─── Test String Generation ────────────────────────────────────────────────────

TEST_STRINGS: list[str] = [
    # Short phrases
    "Hello World",
    "The quick brown fox",
    "Fix the login bug",
    # Medium sentences
    "The authentication middleware was rejecting valid tokens due to a clock skew issue.",
    "Remember to deploy the hotfix before the Friday standup or customers will see 500s.",
    "The database migration script failed silently on the staging environment last night.",
    # Long paragraphs
    "The system was designed to handle concurrent requests by using a combination of read replicas and a write-through cache. However, under extreme load conditions, the cache invalidation lag caused stale reads that propagated to downstream services, resulting in eventual consistency violations that were difficult to reproduce in testing.",
    "When the deployment pipeline broke, the on-call engineer had to manually roll back three services, clear the CDN cache, and notify the status page. The root cause was a missing environment variable in the CI configuration that caused the build to succeed locally but fail in production with a cryptic module not found error.",
    # Code snippets
    "const handler = async (req, res) => { const data = await fetch(url); return res.json(data); }",
    "def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    return merge(merge_sort(arr[:mid]), merge_sort(arr[mid:]))",
    "SELECT u.name, COUNT(o.id) AS orders FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.name HAVING COUNT(o.id) > 5;",
    "import { useEffect, useState } from 'react'; export function useDebounce(value, delay) { const [debounced, setDebounced] = useState(value); useEffect(() => { const t = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(t); }, [value, delay]); return debounced; }",
    # Unicode / special chars
    "Café résumé naïve façade",
    "日本語のテキストです",
    "Emoji test: 🚀🎉💻✅❌🔥",
    "Special chars: <>&\"'{}[]()$@#%^&*",
    "Mixed: Hello 世界 — café — 123 — naïve",
    # Edge cases
    "a",
    "",
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "The path /usr/local/bin/python3.11 leads to the virtualenv at ~/.venv/py311",
]


def get_test_strings(n: int, seed: int = 42) -> list[str]:
    """Return n test strings. Uses fixed seed for reproducibility."""
    if n >= len(TEST_STRINGS):
        return list(TEST_STRINGS)
    rng = random.Random(seed)
    return rng.sample(TEST_STRINGS, n)


# ─── Prompt Templates ──────────────────────────────────────────────────────────

BASE64_PROMPT = """Encode the following text to standard Base64. Output ONLY the base64 string, nothing else. No explanation, no code fences, no quotes.

Text to encode: {input}"""

MORSE_PROMPT = """Encode the following text to International Morse Code. Use dots (.) and dashes (-) for letters, spaces between letters, and forward slash (/) for word boundaries. Output ONLY the morse code, nothing else.

Text to encode: {input}"""

REVERSE_PROMPT = """Reverse the following text character by character. Output ONLY the reversed text, nothing else. No explanation, no code fences.

Text to reverse: {input}"""

PROMPTS = {
    "base64": BASE64_PROMPT,
    "morse": MORSE_PROMPT,
    "reversed": REVERSE_PROMPT,
}


# ─── Response Cleaning ─────────────────────────────────────────────────────────

def strip_code_fence(text: str) -> str:
    """Remove markdown code fences if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (```lang or ```)
        if lines[0].strip().startswith("```"):
            lines = lines[1:]
        # Remove last line if it's just ```
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def clean_response(raw: str) -> tuple[str, bool]:
    """Clean model response. Returns (cleaned_text, had_code_fence)."""
    had_fence = raw.strip().startswith("```")
    cleaned = strip_code_fence(raw)
    # Strip surrounding quotes
    cleaned = cleaned.strip().strip('"').strip("'").strip()
    return cleaned, had_fence


# ─── Scoring ───────────────────────────────────────────────────────────────────

@dataclass
class TestResult:
    variant: str
    input_text: str
    expected: str
    raw_response: str
    cleaned_response: str
    correct: bool
    valid_but_wrong: bool = False
    had_code_fence: bool = False
    response_length: int = 0
    latency_ms: float = 0.0
    error: Optional[str] = None


@dataclass
class ProviderResult:
    provider_name: str
    model: str
    base_url: str
    results: list[TestResult] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        if not self.results:
            return 0.0
        return sum(1 for r in self.results if r.correct) / len(self.results)

    def accuracy_by_variant(self) -> dict[str, float]:
        by_var: dict[str, list[bool]] = {}
        for r in self.results:
            by_var.setdefault(r.variant, []).append(r.correct)
        return {v: sum(b) / len(b) for v, b in by_var.items()}

    def valid_but_wrong_rate(self) -> float:
        if not self.results:
            return 0.0
        return sum(1 for r in self.results if r.valid_but_wrong) / len(self.results)


def score_base64(input_text: str, cleaned: str) -> tuple[bool, bool]:
    """Score base64 result. Returns (correct, valid_but_wrong)."""
    try:
        decoded = b64mod.b64decode(cleaned, validate=True).decode("utf-8")
        correct = decoded == input_text
        return correct, (not correct)  # valid base64 but wrong content
    except Exception:
        return False, False


def score_morse(input_text: str, cleaned: str) -> tuple[bool, bool]:
    """Score morse code result. Returns (correct, valid_but_wrong)."""
    expected = to_morse(input_text)
    # Normalize whitespace
    norm_cleaned = " ".join(cleaned.split())
    norm_expected = " ".join(expected.split())
    correct = norm_cleaned == norm_expected
    # valid_but_wrong = has valid morse tokens but doesn't match
    return correct, (not correct and bool(norm_cleaned.strip()))


def score_reversed(input_text: str, cleaned: str) -> tuple[bool, bool]:
    """Score reversed text. Returns (correct, valid_but_wrong)."""
    expected = input_text[::-1]
    correct = cleaned == expected
    return correct, (not correct)


SCORERS = {
    "base64": score_base64,
    "morse": score_morse,
    "reversed": score_reversed,
}

EXPECTED_FN = {
    "base64": lambda s: b64mod.b64encode(s.encode()).decode(),
    "morse": to_morse,
    "reversed": lambda s: s[::-1],
}


# ─── LLM Client ────────────────────────────────────────────────────────────────

def call_llm(
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
    timeout: int = 60,
    temperature: float = 0.0,
    max_tokens: int = 2048,
) -> tuple[str, float]:
    """Call an OpenAI-compatible endpoint. Returns (response_text, latency_ms)."""
    url = base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    t0 = time.time()
    resp = requests.post(url, json=body, headers=headers, timeout=timeout)
    latency = (time.time() - t0) * 1000
    resp.raise_for_status()
    data = resp.json()
    text = data["choices"][0]["message"]["content"]
    return text, latency


# ─── Provider Config ───────────────────────────────────────────────────────────

@dataclass
class ProviderConfig:
    name: str
    base_url: str
    api_key: str
    model: str


DEFAULT_PROVIDERS = [
    {
        "name": "Lilac-GLM5.2",
        "base_url": os.environ.get("LILAC_BASE_URL", "https://api.getlilac.com/v1"),
        "api_key_env": "LILAC_API_KEY",
        "model": "zai-org/glm-5.2",
    },
    {
        "name": "Venice-Mercury2",
        "base_url": os.environ.get("VENICE_BASE_URL", "https://api.venice.ai/api/v1"),
        "api_key_env": "VENICE_API_KEY",
        "model": "mercury-2:minimal",
    },
    {
        "name": "Venice-Gemini35Flash",
        "base_url": os.environ.get("VENICE_BASE_URL", "https://api.venice.ai/api/v1"),
        "api_key_env": "VENICE_API_KEY",
        "model": "gemini-3-5-flash",
    },
    {
        "name": "Venice-KimiK3",
        "base_url": os.environ.get("VENICE_BASE_URL", "https://api.venice.ai/api/v1"),
        "api_key_env": "VENICE_API_KEY",
        "model": "kimi-k3:high",
    },
    {
        "name": "TokenRouter",
        "base_url": os.environ.get("TOKENROUTER_BASE_URL", "https://api.tokenrouter.ai/v1"),
        "api_key_env": "TOKENROUTER_API_KEY",
        "model": os.environ.get("TOKENROUTER_MODEL", "auto"),
    },
]


def load_providers(config_path: Optional[str]) -> list[ProviderConfig]:
    """Load provider configs from JSON file or use defaults."""
    if config_path and Path(config_path).exists():
        with open(config_path) as f:
            raw = json.load(f)
    else:
        raw = DEFAULT_PROVIDERS

    configs = []
    for p in raw:
        # api_key can be direct or via env var name
        if "api_key_env" in p:
            key = os.environ.get(p["api_key_env"], "")
        else:
            key = p.get("api_key", "")
        if not key:
            print(f"  ⚠ Skipping {p['name']}: no API key found", file=sys.stderr)
            continue
        configs.append(ProviderConfig(
            name=p["name"],
            base_url=p["base_url"],
            api_key=key,
            model=p["model"],
        ))
    return configs


# ─── Benchmark Runner ──────────────────────────────────────────────────────────

def run_benchmark(
    providers: list[ProviderConfig],
    variants: list[str],
    strings: list[str],
) -> list[ProviderResult]:
    results: list[ProviderResult] = []

    for pc in providers:
        pr = ProviderResult(
            provider_name=pc.name,
            model=pc.model,
            base_url=pc.base_url,
        )
        print(f"\n{'═' * 60}", file=sys.stderr)
        print(f"Testing: {pc.name} ({pc.model})", file=sys.stderr)
        print(f"{'═' * 60}", file=sys.stderr)

        for vi, variant in enumerate(variants):
            for si, text in enumerate(strings):
                label = f"  [{variant}] ({si+1}/{len(strings)})"
                prompt = PROMPTS[variant].format(input=text)
                expected = EXPECTED_FN[variant](text)

                try:
                    raw, latency = call_llm(
                        pc.base_url, pc.api_key, pc.model, prompt
                    )
                    cleaned, had_fence = clean_response(raw)
                    scorer = SCORERS[variant]
                    correct, valid_but_wrong = scorer(text, cleaned)

                    tr = TestResult(
                        variant=variant,
                        input_text=text,
                        expected=expected,
                        raw_response=raw[:500],  # truncate for storage
                        cleaned_response=cleaned[:500],
                        correct=correct,
                        valid_but_wrong=valid_but_wrong,
                        had_code_fence=had_fence,
                        response_length=len(raw),
                        latency_ms=latency,
                    )
                    status = "✓" if correct else ("~" if valid_but_wrong else "✗")
                    print(f"{label} {status}  ({latency:.0f}ms)", file=sys.stderr)

                except Exception as e:
                    tr = TestResult(
                        variant=variant,
                        input_text=text,
                        expected=expected,
                        raw_response="",
                        cleaned_response="",
                        correct=False,
                        error=str(e)[:200],
                        latency_ms=0,
                    )
                    print(f"{label} ERR: {e}", file=sys.stderr)

                pr.results.append(tr)
        results.append(pr)

    return results


# ─── Output / Reporting ────────────────────────────────────────────────────────

# Thresholds for coding-readiness interpretation
THRESHOLDS = {
    "solid": 0.85,     # >= this: good for coding
    "watch": 0.60,     # >= this but < solid: usable but monitor
    # < watch: rot — avoid for coding tasks
}


def rating(accuracy: float) -> str:
    if accuracy >= THRESHOLDS["solid"]:
        return "SOLID"
    elif accuracy >= THRESHOLDS["watch"]:
        return "WATCH"
    else:
        return "ROT  "


def print_report(results: list[ProviderResult], variants: list[str]) -> None:
    """Print a ranked table to stdout."""
    print()
    print("┌" + "─" * 78 + "┐")
    print("│  BASE64/MORSE/REVERSE BENCHMARK — Provider Ranking" + " " * 27 + "│")
    print("├" + "─" * 78 + "┤")

    # Header
    cols = ["Provider", "Model"] + [f"{v:>8}" for v in variants] + ["Overall", "Rating"]
    header = f"│ {cols[0]:<20} {cols[1]:<18}"
    for v in variants:
        header += f" {v:>8}"
    header += f" {'Overall':>8} {'Rating':>7} │"
    print(header)
    print("├" + "─" * 78 + "┤")

    # Sort by overall accuracy
    sorted_results = sorted(results, key=lambda r: r.accuracy, reverse=True)

    for pr in sorted_results:
        by_var = pr.accuracy_by_variant()
        overall = pr.accuracy
        line = f"│ {pr.provider_name:<20} {pr.model:<18}"
        for v in variants:
            acc = by_var.get(v, 0.0)
            line += f" {acc:>7.1%}"
        line += f" {overall:>7.1%} {rating(overall):>7} │"
        print(line)

    print("├" + "─" * 78 + "┤")
    print("│  Thresholds: SOLID ≥85% (coding-ready) · WATCH 60-85% (monitor) · ROT <60% (avoid) │")
    print("│  valid_but_wrong = produced valid encoding but decoded to wrong content            │")
    print("└" + "─" * 78 + "┘")

    # Detailed per-provider notes
    print()
    for pr in sorted(results, key=lambda r: r.accuracy, reverse=True):
        vwr = pr.valid_but_wrong_rate()
        errors = sum(1 for r in pr.results if r.error)
        avg_lat = sum(r.latency_ms for r in pr.results if r.latency_ms > 0)
        n_lat = sum(1 for r in pr.results if r.latency_ms > 0)
        avg_lat = avg_lat / n_lat if n_lat else 0
        fences = sum(1 for r in pr.results if r.had_code_fence)
        print(f"  {pr.provider_name}:")
        print(f"    accuracy={pr.accuracy:.1%}  valid_but_wrong={vwr:.1%}  errors={errors}  avg_latency={avg_lat:.0f}ms  code_fences={fences}")
        if pr.accuracy < THRESHOLDS["watch"]:
            print(f"    ⚠ ROT DETECTED — self-correction degraded, expect coding quality issues")


def save_results(results: list[ProviderResult], output_path: str) -> None:
    """Save detailed JSON results."""
    data = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "thresholds": THRESHOLDS,
        "providers": [],
    }
    for pr in results:
        by_var = pr.accuracy_by_variant()
        data["providers"].append({
            "name": pr.provider_name,
            "model": pr.model,
            "base_url": pr.base_url,
            "overall_accuracy": pr.accuracy,
            "accuracy_by_variant": by_var,
            "valid_but_wrong_rate": pr.valid_but_wrong_rate(),
            "results": [asdict(r) for r in pr.results],
        })
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"\n  Results saved to: {output_path}", file=sys.stderr)


# ─── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Base64/Morse/Reverse benchmark for LLM provider ranking"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--quick", action="store_true", help="N=5, base64 only (~30s)")
    mode.add_argument("--full", action="store_true", help="N=20, all variants (default)")
    mode.add_argument("--shot", action="store_true", help="Single string, base64 only (instant proxy)")
    parser.add_argument("--n", type=int, default=None, help="Number of test strings")
    parser.add_argument("--variant", choices=["base64", "morse", "reversed"], action="append",
                        help="Variant(s) to test (default: all)")
    parser.add_argument("--providers", type=str, default=None,
                        help="Path to providers JSON config")
    parser.add_argument("--output", type=str, default=None,
                        help="Output JSON path (default: ~/.pi/scripts/base64_bench_results.json)")
    parser.add_argument("--timeout", type=int, default=60, help="API timeout in seconds")
    args = parser.parse_args()

    # Determine mode
    if args.shot:
        n = 1
        variants = ["base64"]
        strings = ["The authentication middleware was rejecting valid tokens due to a clock skew issue."]
    elif args.quick:
        n = 5
        variants = ["base64"]
        strings = get_test_strings(n)
    elif args.full:
        n = 20
        variants = ["base64", "morse", "reversed"]
        strings = get_test_strings(n)
    else:
        # Default: full
        n = args.n or 20
        variants = args.variant or ["base64", "morse", "reversed"]
        strings = get_test_strings(n) if not args.n else get_test_strings(n)

    if args.n and not args.shot and not args.quick:
        strings = get_test_strings(args.n)

    output_path = args.output or os.path.expanduser(
        "~/.pi/scripts/base64_bench_results.json"
    )

    print(f"\n🔬 Base64/Morse/Reverse Benchmark", file=sys.stderr)
    print(f"   Variants: {', '.join(variants)}", file=sys.stderr)
    print(f"   Strings:  {len(strings)}", file=sys.stderr)
    print(f"   Mode:     {'shot' if args.shot else 'quick' if args.quick else 'full'}", file=sys.stderr)

    providers = load_providers(args.providers)
    if not providers:
        print("\n❌ No providers configured. Set API key env vars or pass --providers.", file=sys.stderr)
        sys.exit(1)

    print(f"   Providers: {len(providers)}", file=sys.stderr)
    for p in providers:
        print(f"     · {p.name} ({p.model})", file=sys.stderr)

    results = run_benchmark(providers, variants, strings)
    print_report(results, variants)
    save_results(results, output_path)


if __name__ == "__main__":
    main()
