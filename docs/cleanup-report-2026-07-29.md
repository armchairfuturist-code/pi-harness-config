# Harness Test-Artifact Cleanup — 2026-07-29

Archive-first cleanup of scattered benchmark/probe testing artifacts. Everything deleted is recoverable from the archive.

## Archive

- **Location:** `~/pi-harness-cleanup-20260729.tar.gz` (808K, 589 entries, integrity-verified via `tar -t` before any deletion)
- **Restore:** `tar -xzf ~/pi-harness-cleanup-20260729.tar.gz -C /` (paths are relative: `pi-bench-ws/...`, `.pi/agent/sessions/...` — extract from `/home/alex` for home items and `/home/alex/.pi/agent/sessions` for session dirs, or inspect with `tar -tzf` first)

## Archived + deleted (originals removed)

### Home directory clutter
- `~/pi-bench-ws/`, `~/pi-bench-ws-complex/` — benchmark workspaces
- `~/pi-pq-bench/` (`bug`, `parse`, `stats`, `validate`) — prompt-quality bench outputs
- 10 logs: `~/pq-base2.log`, `pq-base3-hard.log`, `pq-base3.log`, `pq-base4.log`, `pq-baseline.log`, `pq-base-low.log`, `pq-exp1..4.log`

### Session transcripts (34 dirs, ~480 sessions, from `~/.pi/agent/sessions/`)
- Bench workspaces: `--home-alex-pi-bench-ws--` (203), `--home-alex-pi-bench-ws-complex--` (11), `--home-alex-pi-pq-bench-{bug,parse,stats,validate,cli,faster,errors}--` (107), `--home-alex-bench-results-work-{find_in_files,git_commit_check,parse_json,rename_file,sum_numbers,write_greeting}--` (22)
- Tmp probe/smoke dirs: `--tmp-bench-workspace--`, `--tmp-pi-probe-ws--`, `--tmp-harness-bench--`, `--tmp-pi-bench-test--`, `--tmp-pi-capture-ws--`, `--tmp-pi_dbg--`, `--tmp-pi-final-probe--`, `--tmp-pi-final-verify--`, `--tmp-pi-orphan-test--`, `--tmp-pi-probe-disabled--`, `--tmp-pi-probe-pruned2--`, `--tmp-pi-smoke--`, `--tmp-pi_smoke--`, `--tmp-pi_smoke2--`, `--tmp-pi-sysprompt-ws--`, `--tmp-pi-think--`, `--tmp-u1--`, `--tmp--`

Sessions dir: 48 → 16 project dirs (89M → 83M).

## Moved into this repo (`docs/`)

Harness documentation that was loose in home root — originals archived + removed:
- `docs/pi-configuration.md` (2026-07-14) — full config export / replication blueprint
- `docs/pi-config-analysis.md` (2026-07-22) — config audit vs official pi docs
- `docs/wayfinder-agents-optimization.md` (2026-07-22) — 3-harness optimization analysis

## Deliberately left in place

| Path | Reason |
|---|---|
| `~/orphan-config-backup-20260726/` (64M) | Config backup — safety artifact, not test clutter |
| `~/pi-config-backup-20260722-131821/` | Config backup — safety artifact |
| `~/bench-systima/` (5.9M) | Standalone benchmark rig (own LICENSE/README/qbench) — not pi-harness clutter; review separately |
| `~/steam-default.log` | Not pi-related |
| `/tmp/pi-herdr-btw-1000` | Ephemeral /tmp file, clears on reboot |
| Repo `.scratch/`, `research/`, `bench/` | In-repo by design; nothing inside the repo was deleted |

## Companion artifact

- `docs/harness-progress-summary.md` — distilled timeline of all harness improvements (2026-07-13 → 2026-07-29), built from 6 parallel extractions over ~300 session transcripts + on-disk docs, verified against contract (all terms PASS).
