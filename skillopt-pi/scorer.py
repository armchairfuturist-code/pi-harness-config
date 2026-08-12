#!/usr/bin/env python3
"""Deterministic scorer for skillopt-pi tasks (SkillOpt env evaluate contract).

Usage: scorer.py [--workspace DIR] [--only TASK_ID] [--json]
Runs each task's `check` in a fresh temp workspace (with `setup` applied) and
reports per-task pass/fail + mean score. No LLM calls, no network.
"""
import argparse, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
TASKS = json.load(open(os.path.join(HERE, "tasks.json")))

def run_task(task, workdir):
    os.makedirs(workdir, exist_ok=True)
    if task.get("setup"):
        # setup runs in a dir that already contains fixtures/ (copied below)
        subprocess.run(task["setup"], shell=True, cwd=workdir, timeout=30)
    r = subprocess.run(task["check"], shell=True, cwd=workdir,
                       capture_output=True, text=True,
                       timeout=int(task.get("timeout_s", 120)))
    return r.returncode == 0, r.stdout.strip(), r.stderr.strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace", default=None)
    ap.add_argument("--only", default=None)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    sel = [t for t in TASKS if (not a.only) or t["id"] == a.only]
    results = []
    for t in sel:
        ws = a.workspace or tempfile.mkdtemp(prefix="skillopt-pi-")
        # copy fixtures so setup can reference them
        fix_src = os.path.join(HERE, "fixtures")
        if os.path.isdir(fix_src):
            shutil.copytree(fix_src, os.path.join(ws, "fixtures"), dirs_exist_ok=True)
        ok, out, err = run_task(t, ws)
        results.append({"id": t["id"], "pass": ok, "stdout": out[:400], "stderr": err[:400]})
        if not a.workspace:
            shutil.rmtree(ws, ignore_errors=True)
    score = sum(1 for r in results if r["pass"]) / max(1, len(results))
    if a.json:
        print(json.dumps({"score": score, "results": results}, indent=2))
    else:
        for r in results:
            print(f"{'PASS' if r['pass'] else 'FAIL'}  {r['id']}")
        print(f"score: {score:.3f} ({sum(1 for r in results if r['pass'])}/{len(results)})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
