# SHaD Security Controls Skill

Reference: `ASSESSMENT.md` in this directory for full analysis.

## Quick Actions for Investment-Engine

### 1. Sandbox pi sessions with bubblewrap
```bash
~/.pi/scripts/pi-sandbox.sh ~/Investment-Engine
```
(Create the script from ASSESSMENT.md Priority 1)

### 2. Project-local permissions
Create `~/Investment-Engine/.pi/permissions.json` with trading API deny rules (see ASSESSMENT.md Priority 2)

### 3. Protect credentials
```bash
chmod 600 ~/Investment-Engine/.env ~/Investment-Engine/credentials/*
```

## What You Already Have
- **lean-ctx** = better than SHaD's tool restriction (blocks interpreters, inline code, has allowlist)
- **Skills are clean** — no dangerous patterns in ce-lite, harness-doctor, impeccable

## What You're Missing
- **OS sandboxing** — bwrap is installed but unused. Kernel-level protection is the only irreversible control.
- **Project-local permissions** — no per-project deny rules for trading APIs
- **Skill scanning** — defer unless installing untrusted skills

## Source
- Paper: arxiv.org/html/2607.25890v1
- Repo: github.com/wrgore/shard-demo (research artifact, macOS-targeted, not for production)
