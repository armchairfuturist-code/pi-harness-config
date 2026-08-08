# Unattended loop (long-running / autoresearch sessions)

## Problem
`rot-sentinel` only **writes a marker**. A normal interactive session still needs a human to open a fresh pi. That breaks multi-hour HIL and autoresearch runs.

## Solution
`scripts/unattended-loop.mjs` **owns** successive `pi --print` generations:

1. Start gen N with a goal (or resume) prompt  
2. Poll `~/.pi/.scratch/ROT_HANDOFF.json`  
3. On critical marker → SIGTERM gen N, archive marker/WORKSTATE  
4. Start gen N+1 with a resume prompt pointing at the archive  
5. Stop on WORKSTATE `status: DONE`, stop-file, max generations, or wall clock  

## Usage

```bash
# From the project you want to work in:
cd ~/Projects/pi-harness-config

./scripts/unattended-loop.sh \
  --goal "Continue HIL: pick up Iter 10 leftovers, keep ledger updated" \
  --cwd ~/Projects/pi-harness-config \
  --handoff ~/Projects/pi-harness-config/hil/HANDOFF.md \
  --max-generations 12 \
  --max-wall-min 480

# Autoresearch-style:
./scripts/unattended-loop.sh \
  --goal-file ./GOAL.md \
  --cwd ~/Projects/my-research \
  --max-generations 20
```

**Stop early:** `touch ~/.pi/.scratch/STOP_LOOP`

**State/logs:** `~/.pi/.scratch/unattended-loop/` (`loop.log`, `run.json`, per-gen archives)

**Dry run:** `./scripts/unattended-loop.sh --dry-run --goal "x"`

## Agent contract (inside each generation)
When rot is critical (or CE-lite handoff):
1. Update project `HANDOFF.md` + `~/.pi/.scratch/WORKSTATE.md`
2. **Stop** — do not open large new workstreams  
The supervisor spawns the next generation.

When fully done:
```
status: DONE
```
in WORKSTATE (loop exits ok).

## What this does *not* do
- Does not hijack an already-running interactive TUI you started by hand  
- Does not bypass model cost — each generation is a real `pi -p` run  
- Does not replace canaries; still run `live-keep-ab` / det gates as needed  

## Pairing with rot-sentinel
Critical path writes both:
- `~/.pi/.scratch/ROT_HANDOFF.md` (human)
- `~/.pi/.scratch/ROT_HANDOFF.json` (supervisor)

Env knobs on sentinel: `PI_ROT_*` (see extension header).
