/** Event-driven recovery guidance with cache-stable long-session notices. */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent"

const enabled = () => process.env.PI_RUNTIME_DISCIPLINE !== "0"
const LONG_MS = Number(process.env.PI_LONG_SESSION_MS || 60 * 60 * 1000)
const LONG_TURNS = Number(process.env.PI_LONG_SESSION_TURNS || 24)
const COMPACT_THRESHOLD = Number(process.env.PI_LONG_SESSION_COMPACTS || 3)
const FRICTION_COOLDOWN_MS = 3 * 60 * 1000
// Retry-loop breaker: inject once a tool has errored consecutively RETRY_BREAK times.
// Targets the 6296/30d retry_loops — stop repeating the identical failing call.
const RETRY_BREAK = Number(process.env.PI_RETRY_BREAK || 3)

function textOf(content: unknown): string {
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content.map((b: any) => b?.text ?? "").join("\n")
}

function allowlistBlock(text: string): boolean {
  const t = text.toLowerCase()
  return t.includes("allowlist") || t.includes("permanent security restriction") ||
    (t.includes("blocked") && (t.includes("python") || t.includes("heredoc") || t.includes("interpreter")))
}

function editMiss(name: string, text: string, isError: boolean): boolean {
  const n = name.toLowerCase()
  const t = text.toLowerCase()
  return n.includes("edit") && (isError || t.includes("could not find") || t.includes("old_string") || t.includes("oldtext"))
}

const ALLOWLIST_NUDGE = `<runtime_discipline kind="allowlist_block">The attempted shell/interpreter shape was blocked. Do not retry it. Prefer ctx_* tools; write a script file instead of inline code or heredocs.</runtime_discipline>`
const EDIT_NUDGE = `<runtime_discipline kind="edit_miss">The edit context was stale. Re-read the exact slice, use current text, never retry the identical match, then run a cheap verification.</runtime_discipline>`
const RETRY_NUDGE = `<runtime_discipline kind="retry_loop">A tool has now failed ${RETRY_BREAK}+ times in a row. Stop retrying the identical call — it will not succeed through repetition. Read the latest error, change approach (different tool, different input, or a fresh look), then proceed.</runtime_discipline>`

export default function runtimeDiscipline(pi: ExtensionAPI) {
  let startedAt = Date.now()
  let userTurns = 0
  let compactions = 0
  let pendingAllowlist = false
  let pendingEdit = false
  let lastFrictionAt = 0
  let longNotified = false
  let consecutiveErrors: Record<string, number> = {}
  let retryBroken = false

  pi.on("session_start", () => {
    startedAt = Date.now(); userTurns = 0; compactions = 0
    pendingAllowlist = false; pendingEdit = false; lastFrictionAt = 0; longNotified = false
    consecutiveErrors = {}; retryBroken = false
  })

  pi.on("input", (_event: any, ctx: any) => {
    if (!enabled()) return
    userTurns += 1
    const isLong = Date.now() - startedAt >= LONG_MS || userTurns >= LONG_TURNS || compactions >= COMPACT_THRESHOLD
    if (isLong && !longNotified) {
      ctx?.ui?.notify?.("Long session: verify current state and consider a CE-lite handoff before more work.", "warning")
      longNotified = true
    }
  })

  for (const event of ["session_compact", "compact", "auto_compact"] as const) {
    try { pi.on(event as any, () => { if (enabled()) compactions += 1 }) } catch { /* unsupported event */ }
  }

  pi.on("tool_execution_end", (event: any) => {
    if (!enabled()) return
    const name = String(event?.toolName || event?.name || "")
    const isError = Boolean(event?.isError || event?.error)
    const text = textOf(event?.result?.content ?? event?.result ?? event?.output ?? event?.content) + String(event?.error ?? "")
    if (allowlistBlock(text)) pendingAllowlist = true
    if (editMiss(name, text, isError)) pendingEdit = true
    // Consecutive-error tracking for the retry-loop breaker.
    if (isError && name) {
      consecutiveErrors[name] = (consecutiveErrors[name] || 0) + 1
      if (consecutiveErrors[name] >= RETRY_BREAK) retryBroken = true
    } else if (name) {
      delete consecutiveErrors[name]
    }
  })

  pi.on("before_agent_start", (event: any) => {
    if (!enabled()) return
    const now = Date.now()
    if (now - lastFrictionAt < FRICTION_COOLDOWN_MS) return
    const nudges = [pendingAllowlist ? ALLOWLIST_NUDGE : "", pendingEdit ? EDIT_NUDGE : "", retryBroken ? RETRY_NUDGE : ""].filter(Boolean)
    if (nudges.length === 0) return
    pendingAllowlist = false; pendingEdit = false; retryBroken = false; lastFrictionAt = now
    return { systemPrompt: `${event?.systemPrompt ?? ""}\n${nudges.join("\n")}` }
  })
}
