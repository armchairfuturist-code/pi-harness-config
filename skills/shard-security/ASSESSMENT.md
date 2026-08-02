# SHaD Security Controls — Assessment for This User

## Paper: "Distributing Security Controls Through Harness Engineering" (arXiv 2607.25890, Jul 2026)
## Repo: github.com/wrgore/shard-demo

## What SHaD Is

SHaD (Secure Harness Distribution) = a Pi agent harness extension that embeds three security controls as distributable, code-expressed policies. Built on Pi specifically because of its lightweight extensibility. **7 new files, 1 modified (package.json), zero Pi core changes.** Install: `curl -fsSL https://raw.githubusercontent.com/wrgore/shard-demo/main/install.sh | sh`

### The Three Controls

| Control | Mechanism | Layer | Your Equivalent |
|---------|----------|-------|-----------------|
| **OS Sandboxing** | `nono` sandbox (kernel-level, macOS Seatbelt). Irreversible for session duration. All child processes inherit restrictions. `shard-nono.ts` detects non-sandboxed state via `NONO_CAP_FILE` env var and re-launches inside sandbox via `spawnSync`. | Kernel | `bwrap` (bubblewrap) — **already installed** at `/usr/bin/bwrap` |
| **Tool Restriction** | `shard-permissions.ts` hooks `tool_call` event, regex-matches bash commands against deny rules in `permissions.json`. Blocks rm/rmdir in demo. **Bypassable via direct syscalls** (harness-layer, not kernel). | Harness | `lean-ctx` — **more mature than SHaD's demo** (blocks interpreters, inline code, bare commands, has allowlist) |
| **Skill Scanning** | Permiso SandyClaw API. Scans skills before loading — prevents malicious content from reaching inference. 26.1% of skills have vulnerabilities, 5.2% exhibit malicious intent (Jan 2026 research). `shard-onboarding.ts` handles API key provisioning. | External service | **None currently** — you install community skills without scanning |

### Evaluation Results

| Agent | Raw Score | Adjusted Score |
|-------|-----------|---------------|
| Claude Code | 87.0% | 100% |
| Codex | 69.6% | 75% |
| SHaD (on Pi) | 78.3% | 100% |

SHaD matched Claude Code on adjusted score, outperformed Codex. No regressions to baseline Pi capabilities.

### Key Design Principles (from paper)

Two characteristics make a control distributable via harness:
1. **Declarative Policy** — control expresses policy as code (JSON profile, markdown skill, TypeScript extension), applied automatically
2. **Control Locality** — policy + enforcement at or near agent's execution boundary

---

## Your Current State vs SHaD

### What you already have (better than SHaD's demo)

**Tool restriction: lean-ctx > shard-permissions.ts**
- SHaD's demo blocks `rm` and `rmdir` via regex. That's it.
- Your lean-ctx blocks: inline `python3 -c`, bare interpreters, pipe-to-interpreter, and has a configurable allowlist with warn-only mode.
- **You're already ahead here.** lean-ctx is more granular and battle-tested.

**Skills audit: clean**
- Scanned `~/.pi/agent/skills/` (ce-lite, harness-doctor, impeccable) for dangerous patterns (`rm -rf`, `sudo`, `chmod 777`, `curl|sh`, `eval(`).
- **No dangerous patterns found.** Your current skills are safe.

### What you're missing

**1. OS Sandboxing — the biggest gap**
- `bwrap` (bubblewrap) is installed at `/usr/bin/bwrap` but NOT used by pi.
- SHaD uses `nono` (macOS). On Linux, `bwrap` is the equivalent kernel-level sandbox.
- Without it: the agent can read any file your user can access, make any network connection, write anywhere. For a financial MCP project, this is the highest-risk gap.
- **Bypassable harness-layer controls (like lean-ctx) don't protect against this** — the paper explicitly notes a determined agent can bypass extension-level tool restriction via direct syscalls. Kernel-level sandboxing is the only irreversible control.

**2. Skill Scanning — moderate gap**
- You install community skills (ce-lite, harness-doctor, impeccable, last30days). 26.1% of skills have vulnerabilities per the paper's research.
- Your skills are currently clean, but future installs are unscanned.
- SandyClaw requires an API key from Permiso — external dependency.

**3. Project-local permissions — missing**
- SHaD supports project-local `.pi/permissions.json` for per-project deny rules.
- You have global lean-ctx config but no project-specific restrictions (e.g., blocking trading API calls in Investment-Engine).

---

## Recommendations for Investment-Engine (Financial MCP)

### Priority 1: OS Sandboxing via bubblewrap (HIGH)

Wrap pi sessions in bwrap when working on Investment-Engine:
```bash
# Restrict to project dir + read-only system, block network except API endpoints
bwrap --ro-bind / / --bind ~/Investment-Engine ~/Investment-Engine \
  --unshare-net \
  -- env -i HOME=$HOME PATH=$PATH pi
```
Or create a wrapper script `~/.pi/scripts/pi-sandbox.sh`:
```bash
#!/bin/bash
PROJECT_DIR="${1:-$(pwd)}"
bwrap --ro-bind / / \
  --bind "$PROJECT_DIR" "$PROJECT_DIR" \
  --bind "$HOME/.pi" "$HOME/.pi" \
  --bind "$HOME/.config" "$HOME/.config" \
  --dev /dev --proc /proc --tmpfs /tmp \
  --unshare-net \
  -- env -i HOME="$HOME" PATH="$PATH" TERM="$TERM" pi
```
Note: `--unshare-net` blocks all network. For MCP servers that need API access, use `--share-net` and rely on tool restriction to block specific endpoints. Trade-off: sandboxing MCP network access requires allowlisting specific API hosts.

### Priority 2: Project-local permissions for trading APIs (MEDIUM)

Create `~/Investment-Engine/.pi/permissions.json`:
```json
{
  "deny": [
    {"pattern": "curl.*alpaca|api.alpaca|api.polygon|api.tiingo", "message": "Trading API call blocked — requires human confirmation"},
    {"pattern": "python.*execute_order|place_trade|submit_order", "message": "Order execution blocked — requires human confirmation"},
    {"pattern": "rm -rf.*Investment", "message": "Cannot delete Investment-Engine files"}
  ]
}
```
This is the SHaD pattern applied to your domain. lean-ctx already handles the enforcement mechanism — you just need project-specific rules.

### Priority 3: Skill scanning (LOW for now)

Your current skills are clean. For future installs:
- Quick option: `grep -rn 'rm -rf\|sudo\|curl.*sh\|eval(\|exec(' ~/.pi/agent/skills/<new-skill>/` before loading
- Full option: Get a SandyClaw API key from Permiso and implement the scan-first pattern
- **Defer unless you start installing untrusted community skills regularly**

### Priority 4: File access controls for financial data (MEDIUM)

If Investment-Engine stores API keys, credentials, or portfolio data:
```bash
# Restrict agent from reading credential files
chmod 600 ~/Investment-Engine/.env ~/Investment-Engine/credentials/*
# Or add to permissions.json:
{"pattern": "cat.*credentials|cat.*\\.env", "message": "Credential access blocked"}
```

---

## What Not to Do

- **Don't install SHaD's demo** — it's a research artifact (paper says so explicitly), targets macOS (nono/Seatbelt), and its tool restriction is less mature than your lean-ctx.
- **Don't replace lean-ctx with shard-permissions.ts** — lean-ctx is strictly better.
- **Don't implement skill scanning yet** — your skills are clean and SandyClaw is an external API dependency. Revisit if you start installing untrusted skills.

## Summary: Effort vs Payoff

| Control | Effort | Payoff | Do it? |
|---------|--------|--------|--------|
| bwrap sandbox for IE sessions | 30 min | HIGH — only kernel-level protection for financial data | **Yes** |
| Project-local permissions.json | 15 min | MEDIUM — blocks accidental trading API calls | **Yes** |
| File access controls (chmod/permissions) | 10 min | MEDIUM — protects credentials | **Yes** |
| Skill scanning (SandyClaw) | 2+ hours | LOW — current skills clean | **Defer** |
| Replace lean-ctx | N/A | Negative — lean-ctx is better | **No** |
