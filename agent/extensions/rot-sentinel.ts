/**
 * rot-sentinel.ts — real-time context-rot detection + proactive handoff trigger.
 *
 * Hooks the pi `context` event (fires before every LLM call with a clone of
 * the transcript) and scores degradation using contextrot's 5 behavioral
 * signals, adapted for pi:
 *
 *   tool_error      — any tool result containing error keywords
 *   edit_failure    — an editing tool returned an error (strongest signal)
 *   retry           — a (tool, target) repeats within 6 steps of an error
 *   reread          — a read tool re-reads a file already read earlier
 *   self_correction — assistant text matches apology/correction phrases
 *
 * Score = max(fill_component, 0.5·fill + 0.5·behavior) so EITHER rising
 * context fill OR accelerating behavioral degradation can trigger — neither
 * path suppresses the other. Measured profile (see context-rot-forensics
 * SKILL): this user's sessions knee at ~42% fill / step 76 / 377K tokens.
 *
 * Triggers:
 *   rot_score ≥ PI_ROT_WARN_PCT (55)     → visible warning
 *   rot_score ≥ PI_ROT_CRITICAL_PCT (70) → write handoff marker +
 *                                           critical notification
 *
 * The marker at ~/.pi/.scratch/ROT_HANDOFF.md is readable by the ce-lite /
 * handoff protocol: when it exists, execute the standard handoff (write
 * HANDOFF.md, resume in a fresh session). The sentinel detects; the
 * operator/protocol executes. For unattended loops, a wrapper script can
 * poll the marker and restart pi.
 *
 * Env: PI_ROT_ENABLED=1 (off by default), PI_ROT_WARN_PCT=55,
 *      PI_ROT_CRITICAL_PCT=70, PI_ROT_MAX_CONTEXT=900000,
 *      PI_ROT_WINDOW=20 (recent-step window), PI_ROT_BLOAT_THRESHOLD=15000,
 *      PI_ROT_AUTO_COMPACT=0 (auto-compact at critical if 1),
 *      PI_ROT_LOG (optional log path).
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"

// Default ON (this user's long-running loops need proactive handoff).
// Disable with PI_ROT_ENABLED=0.
const enabled = () => process.env.PI_ROT_ENABLED !== "0"
const warnPct = () => Number(process.env.PI_ROT_WARN_PCT || 55)
const critPct = () => Number(process.env.PI_ROT_CRITICAL_PCT || 70)
const maxCtx = () => Number(process.env.PI_ROT_MAX_CONTEXT || 900_000)
const windowSize = () => Number(process.env.PI_ROT_WINDOW || 20)
const bloatThresh = () => Number(process.env.PI_ROT_BLOAT_THRESHOLD || 15_000)
const autoCompact = () => process.env.PI_ROT_AUTO_COMPACT === "1"
const logPath = () => process.env.PI_ROT_LOG || ""
const scratchDir = () => join(homedir(), ".pi", ".scratch")
const markerPath = () => join(scratchDir(), "ROT_HANDOFF.md")
const markerJsonPath = () => join(scratchDir(), "ROT_HANDOFF.json")

const ERROR_KEYWORDS = [
  "error", "failed", "blocked", "not found", "no such file",
  "denied", "exception", "command exited with code",
]
const EDIT_TOOLS = new Set([
  "edit", "write", "ctx_edit", "ctx_write", "ctx_patch", "multiedit",
  "str_replace_editor", "apply_patch", "patch", "replace", "write_file",
  "write_to_file", "replace_in_file", "apply_diff", "insert_content",
  "search_and_replace", "edit_file", "ctx_refactor",
])
const READ_TOOLS = new Set([
  "read", "ctx_read", "cat", "grep", "ctx_grep", "find", "ctx_find",
  "ctx_shell", "ctx_batch_execute", "read_file", "read_many_files",
  "ctx_execute_file", "ls", "ctx_ls", "ctx_overview", "ctx_tree",
])
const SELF_CORRECTION_RE = /\b(i apologize|apologies|my mistake|my error|i made a mistake|i made an error|let me (fix|correct) (that|this|my)|that was (wrong|incorrect)|that's (wrong|incorrect)|i was wrong|oops|correcting my)\b/i

function textOf(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.map((b: any) => (b?.text ?? "") as string).join("\n")
}

function targetOf(name: string, args: any): string {
  if (!args || typeof args !== "object") return ""
  const a: any = args
  return String(a.path ?? a.file_path ?? a.command ?? a.pattern ?? a.query ?? "")
}

function log(line: string) {
  const p = logPath()
  if (!p) return
  try { appendFileSync(p, line + "\n") } catch {}
}

export default function rotSentinel(pi: ExtensionAPI) {
  // Per-step signal state (a "step" = one assistant turn + its tool results).
  let steps: Array<{ degraded: boolean; signals: string[] }> = []
  let seenReads = new Set<string>()
  let recentErrors: Array<{ step: number; key: string }> = []
  let lastFillPct = 0
  let lastScore = 0
  let warnedAt = false
  let criticalAt = false
  let sessionStart = Date.now()
  let prevInputTokens = 0

  pi.on("session_start", () => {
    steps = []
    seenReads = new Set()
    recentErrors = []
    lastFillPct = 0
    lastScore = 0
    warnedAt = false
    criticalAt = false
    sessionStart = Date.now()
    prevInputTokens = 0
    // Clear stale marker from a prior session.
    try {
      if (existsSync(markerPath())) writeFileSync(markerPath(), "")
      if (existsSync(markerJsonPath())) writeFileSync(markerJsonPath(), "")
    } catch {}
    log(`[rot-sentinel] session_start`)
  })

  pi.on("context", (event: any, ctx: any) => {
    if (!enabled()) return undefined
    const messages = event?.messages
    if (!Array.isArray(messages) || messages.length < 2) return undefined

    // --- Fill estimate: approximate prompt tokens from transcript size. ---
    let chars = 0
    for (const m of messages) {
      if (!m || typeof m !== "object") continue
      if (typeof m.content !== "undefined") chars += textOf(m.content).length
      if (typeof m.text === "string") chars += m.text.length
    }
    const estTokens = Math.round(chars / 4)
    const fillPct = Math.min(100, (estTokens / maxCtx()) * 100)
    const bloat = estTokens - prevInputTokens
    prevInputTokens = estTokens
    lastFillPct = fillPct

    // --- Detect signals in the most-recent assistant turn + tool results. ---
    // Walk messages; treat each assistant message with tool calls as a step.
    // We re-scan the tail each fire (cheap; context fires once per turn).
    const newSteps: typeof steps = []
    seenReads = new Set()
    recentErrors = []
    let stepIdx = 0
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (!m || typeof m !== "object") continue
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue
      const signals = new Set<string>()
      const callIds: Array<{ id: string; name: string; target: string }> = []
      for (const b of m.content) {
        if (!b || typeof b !== "object") continue
        const isCall = (b as any).type === "toolCall" || (b as any).type === "tool_use"
        if (!isCall) {
          // Self-correction in assistant text.
          const t = (b as any).text
          if (typeof t === "string" && SELF_CORRECTION_RE.test(t)) signals.add("self_correction")
          continue
        }
        const name = String((b as any).name || "").toLowerCase()
        const args = (b as any).type === "toolCall" ? (b as any).arguments : (b as any).input
        const target = targetOf(name, args)
        const id = String((b as any).id || `${name}:${stepIdx}`)
        callIds.push({ id, name, target })
        if (READ_TOOLS.has(name) && target) seenReads.add(target)
      }
      // Collect tool results that follow this assistant message.
      for (const c of callIds) {
        const res = messages.find(
          (rm: any) =>
            rm && typeof rm === "object" &&
            (rm.role === "toolResult" || rm.role === "tool") &&
            rm.toolCallId === c.id,
        )
        if (!res) continue
        const rtext = textOf((res as any).content ?? (res as any).result ?? "")
        const isErr = !!(res as any).isError || ERROR_KEYWORDS.some((k) => rtext.toLowerCase().includes(k))
        if (isErr) {
          signals.add("tool_error")
          if (EDIT_TOOLS.has(c.name)) signals.add("edit_failure")
          recentErrors.push({ step: stepIdx, key: `${c.name}:${c.target}` })
        }
        // Retry: same (tool,target) errored within 6 prior steps.
        const key = `${c.name}:${c.target}`
        if (recentErrors.some((e) => e.key === key && stepIdx - e.step <= 6 && e.step !== stepIdx)) {
          signals.add("retry")
        }
        // Reread: read tool re-reading a target seen in an earlier step.
        if (READ_TOOLS.has(c.name) && c.target) {
          // flagged below once we know earlier steps' reads
        }
      }
      newSteps.push({ degraded: signals.size > 0, signals: [...signals] })
      stepIdx++
    }
    // Second pass for reread: a read whose target appears in >1 step.
    const readCounts = new Map<string, number>()
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i]
      if (!m || typeof m !== "object" || m.role !== "assistant" || !Array.isArray(m.content)) continue
      for (const b of m.content) {
        if (!b || typeof b !== "object") continue
        const isCall = (b as any).type === "toolCall" || (b as any).type === "tool_use"
        if (!isCall) continue
        const name = String((b as any).name || "").toLowerCase()
        if (!READ_TOOLS.has(name)) continue
        const args = (b as any).type === "toolCall" ? (b as any).arguments : (b as any).input
        const t = targetOf(name, args)
        if (t) readCounts.set(t, (readCounts.get(t) || 0) + 1)
      }
    }
    // Mark reread on any step that read a target read in another step too.
    if (readCounts.size) {
      let sIdx = 0
      for (let i = 0; i < messages.length; i++) {
        const m = messages[i]
        if (!m || typeof m !== "object" || m.role !== "assistant" || !Array.isArray(m.content)) continue
        for (const b of m.content) {
          if (!b || typeof b !== "object") continue
          const isCall = (b as any).type === "toolCall" || (b as any).type === "tool_use"
          if (!isCall) continue
          const name = String((b as any).name || "").toLowerCase()
          if (!READ_TOOLS.has(name)) continue
          const args = (b as any).type === "toolCall" ? (b as any).arguments : (b as any).input
          const t = targetOf(name, args)
          if (t && (readCounts.get(t) || 0) > 1 && newSteps[sIdx]) {
            newSteps[sIdx].signals.push("reread")
            newSteps[sIdx].degraded = true
          }
        }
        if (newSteps[sIdx]) sIdx++
      }
    }
    steps = newSteps

    // --- Rot score: max(fill, 0.5·fill + 0.5·behavior). ---
    const win = windowSize()
    const recent = steps.slice(-win)
    const recentDeg = recent.filter((s) => s.degraded).length
    const recentRate = recent.length ? recentDeg / recent.length : 0
    const early = steps.slice(0, Math.min(win, steps.length))
    const earlyDeg = early.filter((s) => s.degraded).length
    const earlyRate = early.length ? earlyDeg / early.length : 0
    // Acceleration: recent degradation vs session baseline (floor 0.05).
    const acceleration = recentRate / Math.max(earlyRate, 0.05)
    const behaviorPct = Math.min(100, acceleration * 50)
    const score = Math.max(fillPct, 0.5 * fillPct + 0.5 * behaviorPct)
    lastScore = score

    // Signal tallies for reporting.
    const tally = new Map<string, number>()
    for (const s of steps) for (const sig of s.signals) tally.set(sig, (tally.get(sig) || 0) + 1)

    log(
      `[rot-sentinel] steps=${steps.length} fill=${fillPct.toFixed(1)}% ` +
        `recentRate=${recentRate.toFixed(2)} accel=${acceleration.toFixed(2)} ` +
        `score=${score.toFixed(1)} bloat=${bloat} signals=${[...tally.entries()].map(([k, v]) => `${k}=${v}`).join(",")}`,
    )

    // Bloat event (per-turn input jump) — ancillary signal.
    if (bloat > bloatThresh()) {
      log(`[rot-sentinel] BLOAT: +${bloat} tokens in one turn (>${bloatThresh()})`)
      ctx?.ui?.notify?.(`Context bloat: +${bloat} tokens in one turn. Consider pruning.`, "info")
    }

    // --- Triggers. ---
    if (score >= critPct() && !criticalAt) {
      criticalAt = true
      const dominant = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
      const body = buildHandoffMarker({
        score, fillPct, steps: steps.length, estTokens,
        recentRate, acceleration, dominant,
        sessionStart,
      })
      try {
      mkdirSync(scratchDir(), { recursive: true })
      writeFileSync(markerPath(), body)
      writeFileSync(
        markerJsonPath(),
        JSON.stringify({
          critical: true,
          ts: new Date().toISOString(),
          score: Number(score.toFixed(1)),
          fillPct: Number(fillPct.toFixed(1)),
          estTokens,
          steps: steps.length,
          recentRate: Number(recentRate.toFixed(3)),
          acceleration: Number(acceleration.toFixed(2)),
          dominant,
          marker: markerPath(),
        }) + "\n",
      )
    } catch {}
    log(`[rot-sentinel] CRITICAL: score=${score.toFixed(1)} — handoff marker written to ${markerPath()}`)
    ctx?.ui?.notify?.(
      `Context rot CRITICAL (score ${score.toFixed(0)}): handoff recommended. Marker at ${markerPath()}`,
      "error",
    )
      if (autoCompact()) {
        // Hint to the host; actual compaction is the pi binary's job.
        log(`[rot-sentinel] auto_compact requested (host-dependent)`)
      }
    } else if (score >= warnPct() && !warnedAt) {
      warnedAt = true
      log(`[rot-sentinel] WARN: score=${score.toFixed(1)}`)
      ctx?.ui?.notify?.(
        `Context rot rising (score ${score.toFixed(0)}, fill ${fillPct.toFixed(0)}%): consider a handoff soon.`,
        "warning",
      )
    }
    return undefined
  })
}

function buildHandoffMarker(d: {
  score: number; fillPct: number; steps: number; estTokens: number;
  recentRate: number; acceleration: number; dominant: string[]; sessionStart: number;
}): string {
  const ts = new Date().toISOString()
  const durMin = Math.round((Date.now() - d.sessionStart) / 60000)
  return `# ROT_HANDOFF — context rot critical

Triggered: ${ts}
Session duration: ${durMin} min
Rot score: ${d.score.toFixed(1)} / 100  (warn=${warnPct()}, critical=${critPct()})
Context fill: ${d.fillPct.toFixed(1)}%  (est ${d.estTokens.toLocaleString()} / ${maxCtx().toLocaleString()} tokens)
Steps: ${d.steps}
Recent degradation rate: ${(d.recentRate * 100).toFixed(0)}%  (acceleration ${d.acceleration.toFixed(2)}× vs early)
Dominant signals: ${d.dominant.join(", ") || "none"}

## Action
Execute a handoff now: write/update HANDOFF.md + ~/.pi/.scratch/WORKSTATE.md
with current state, then **stop** (do not keep expanding work).

If under scripts/unattended-loop, the supervisor detects ROT_HANDOFF.json,
stops this generation, and spawns the next pi -p with a resume prompt.

Past sessions are auto-indexed by session-index.ts (ctx_search).

## Why
Behavioral degradation is accelerating (contextrot methodology). Continuing
risks compounding errors, stale-edit retries, and re-read loops. A fresh
context restores quality; the session-index preserves continuity.
`
}
