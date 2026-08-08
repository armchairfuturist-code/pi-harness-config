# Pi agent home (harness config repo)

This repository is the **source of truth** for a token-optimized pi harness.

**Other agents / machines:** read **`README.md` first** — install path, locked knobs, and what `install.sh` writes. Do not freestyle KEEP/compaction/tscg without HIL (`hil/ledger.md`).

| Doc | Use |
|-----|-----|
| `README.md` | Install + locked settings for consumers |
| `hil/HANDOFF.md` | Current next-iter instructions |
| `hil/ledger.md` | Why knobs are locked |
| `HARNESS.md` | Runtime constitution (deployed to agent home) |
| `APPEND_SYSTEM.md` | Tiny per-turn append (keep small) |

Harness policy for a live agent home also lives in deployed `HARNESS.md` / `APPEND_SYSTEM.md` under `~/.pi/agent/`.
