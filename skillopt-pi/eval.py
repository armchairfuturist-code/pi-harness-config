#!/usr/bin/env python3
"""skillopt-pi eval — the SkillOpt path that can actually score this harness.

SkillOpt-Sleep's Pi backend runs `pi -p --no-tools` and judges the reply text.
That cannot see whether multiply.py was fixed. This runner:

  1. materializes each task in a temp workspace
  2. runs `pi -p` WITH tools (native read/write/edit/bash; no extensions)
  3. scores the workspace with the same `check` as scorer.py

Train target stays bundled-skills/ce-lite/SKILL.md (injected via
--append-system-prompt). No second router.

Usage:
  python3 skillopt-pi/eval.py              # all tasks
  python3 skillopt-pi/eval.py --only t0-lookup-multiply
  python3 skillopt-pi/eval.py --dry-run    # setup+check only, no pi
"""
from __future__ import annotations

import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, ".."))
TASKS = json.load(open(os.path.join(HERE, "tasks.json")))
CE_LITE = os.path.join(REPO, "bundled-skills/ce-lite/SKILL.md")
APPEND = os.path.join(REPO, "APPEND_SYSTEM.md")
PI = os.environ.get("PI_BIN", shutil.which("pi") or "pi")


def run_check(task, workdir):
    r = subprocess.run(
        task["check"], shell=True, cwd=workdir,
        capture_output=True, text=True,
        timeout=int(task.get("timeout_s", 120)),
    )
    return r.returncode == 0, (r.stdout or "")[-300:], (r.stderr or "")[-300:]


def materialize(task, workdir):
    fix_src = os.path.join(HERE, "fixtures")
    if os.path.isdir(fix_src):
        shutil.copytree(fix_src, os.path.join(workdir, "fixtures"), dirs_exist_ok=True)
    if task.get("setup"):
        subprocess.run(task["setup"], shell=True, cwd=workdir, timeout=30, check=False)


def run_pi(task, workdir, skill_text):
    cmd = [
        PI, "-p", "--no-session", "--no-extensions", "--no-skills",
        "--no-prompt-templates", "--no-themes",
        "--system-prompt", "",
        "--append-system-prompt", skill_text,
    ]
    env = os.environ.copy()
    env["PI_OFFLINE"] = "1"
    env["PI_SKIP_VERSION_CHECK"] = "1"
    env["PI_TELEMETRY"] = "0"
    proc = subprocess.run(
        cmd, input=task["prompt"], cwd=workdir, env=env,
        capture_output=True, text=True, timeout=int(task.get("timeout_s", 180)),
    )
    return proc.returncode, (proc.stdout or "")[-800:], (proc.stderr or "")[-400:]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--skill", default=CE_LITE)
    a = ap.parse_args()
    sel = [t for t in TASKS if (not a.only) or t["id"] == a.only]
    skill_text = ""
    if os.path.isfile(APPEND):
        skill_text += open(APPEND, encoding="utf-8").read().strip() + chr(10)*2
    if os.path.isfile(a.skill):
        skill_text += open(a.skill, encoding="utf-8").read()
    results = []
    for t in sel:
        ws = tempfile.mkdtemp(prefix="skillopt-pi-eval-")
        try:
            materialize(t, ws)
            pi_out = ""
            if not a.dry_run:
                code, pi_out, err = run_pi(t, ws, skill_text)
                if code != 0 and not pi_out:
                    pi_out = err
            ok, out, err = run_check(t, ws)
            results.append({
                "id": t["id"], "route": t.get("route", ""),
                "pass": ok, "stdout": out, "stderr": err,
                "pi_head": pi_out[:400],
            })
            mark = "PASS" if ok else "FAIL"
            print(f"{mark}  {t.get('route','?'):8s}  {t['id']}")
            if not ok and pi_out:
                print("  pi:", pi_out.replace(chr(10), " ")[:240])
        finally:
            shutil.rmtree(ws, ignore_errors=True)
    score = sum(1 for r in results if r["pass"]) / max(1, len(results))
    print(f"score: {score:.3f} ({sum(1 for r in results if r['pass'])}/{len(results)})")
    return 0 if all(r["pass"] for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
