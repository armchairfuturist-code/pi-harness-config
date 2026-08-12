// Session Index — extractive, zero-token session summaries for cross-session recall.
//
// On session shutdown, parses the session JSONL (no LLM call) and writes a small
// markdown summary to ~/.pi/agent/memory/sessions/<date>-<slug>.md. That directory
// is indexed into the context-mode FTS5 store (source: "session-log") by the
// ce-lite "Read before you decide" step, so past sessions surface via ctx_search.
// The full JSONL stays on disk for zoom; the summary is the retrieval pointer.
//
// Zero-token trend reminder: if output-trend.js hasn't been run in 7+ days, a one-line
// reminder is appended to the summary. The marker is auto-updated when the session
// references "output-trend". No LLM call, no context injection — pure file I/O.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const SESSIONS_ROOT = join(homedir(), ".pi", "agent", "sessions")
const OUT_DIR = join(homedir(), ".pi", "agent", "memory", "sessions")
const SNIP = 400
const MIN_USER_TURNS = 3 // skip trivial sessions — they carry no recall value
const TREND_MARKER = join(homedir(), ".pi", "agent", "memory", ".output-trend-last-run")
const TREND_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

function trendStale(): boolean {
  if (!existsSync(TREND_MARKER)) return true
  try { return Date.now() - statSync(TREND_MARKER).mtimeMs > TREND_INTERVAL_MS } catch { return true }
}

function touchTrendMarker(): void {
  try { writeFileSync(TREND_MARKER, new Date().toISOString()) } catch { /* ignore */ }
}

function newestJsonl(dir: string): string | null {
  let best: string | null = null
  let bestM = 0
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue
    try {
      const m = statSync(join(dir, f)).mtimeMs
      if (m > bestM) { bestM = m; best = f }
    } catch { /* ignore unreadable entries */ }
  }
  return best
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content.filter((p) => p && p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n")
  }
  return ""
}

function clip(s: string): string {
  const t = s.replace(/\s+/g, " ").trim()
  return t.length > SNIP ? t.slice(0, SNIP) + "…" : t
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "untitled"
}

function summarize(path: string): { filename: string; markdown: string; sawTrend: boolean } | null {
  let id = "", title = "", project = "", date = ""
  const models = new Set<string>()
  let firstUser = "", lastAssistant = ""
  const files = new Set<string>()
  let userTurns = 0
  let sawTrend = false

  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue
    let r: any
    try { r = JSON.parse(line) } catch { continue }
    if (r.type === "session") {
      id = r.id ?? id
      if (r.cwd) project = r.cwd
      if (r.timestamp) date = String(r.timestamp).slice(0, 10)
    } else if (r.type === "session_info" && r.name) {
      title = String(r.name)
    } else if (r.type === "model_change" && (r.modelId ?? r.model)) {
      models.add(String(r.modelId ?? r.model))
    } else if (r.type === "message" && r.message) {
      const m = r.message
      if (m.role === "user") {
        userTurns++
        const ut = textOf(m.content)
        if (ut.includes("output-trend")) sawTrend = true
        if (!firstUser) firstUser = clip(ut)
      } else if (m.role === "assistant") {
        const t = clip(textOf(m.content))
        if (t) lastAssistant = t
        const parts = Array.isArray(m.content) ? m.content : []
        for (const p of parts) {
          if (p && p.type === "toolCall" && (p.name === "edit" || p.name === "write")) {
            const fp = p.arguments?.path ?? p.input?.path
            if (typeof fp === "string") files.add(fp)
          }
        }
      }
    }
  }

  if (userTurns < MIN_USER_TURNS) return null
  if (!id) id = path.split("/").pop()?.replace(".jsonl", "") ?? "unknown"
  if (!date) date = new Date().toISOString().slice(0, 10)

  const name = title || "Untitled session"
  let markdown = [
    "---",
    `session: ${id}`,
    `project: ${project}`,
    `date: ${date}`,
    `title: ${name}`,
    models.size ? `models: ${[...models].join(", ")}` : null,
    `user_turns: ${userTurns}`,
    "---",
    "",
    `# ${name}`,
    "",
    `**Ask:** ${firstUser || "(none captured)"}`,
    "",
    `**Outcome:** ${lastAssistant || "(none captured)"}`,
    "",
    files.size ? `**Files changed:** ${[...files].slice(0, 30).join(", ")}` : "**Files changed:** none recorded",
    "",
  ].filter((l) => l !== null).join("\n")

  if (trendStale()) {
    markdown += "\n> ⚠ Run `node ~/bench-systima/bench/output-trend.js` — weekly output-token trend validation overdue.\n"
  }

  return { filename: `${date}-${slug(name)}.md`, markdown, sawTrend }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_shutdown", async (_event, ctx) => {
    try {
      const cwd = (ctx as { cwd?: string })?.cwd ?? process.cwd()
      const dir = join(SESSIONS_ROOT, "--" + cwd.replaceAll("/", "-") + "--")
      if (!existsSync(dir)) return
      const f = newestJsonl(dir)
      if (!f) return
      const s = summarize(join(dir, f))
      if (!s) return

      if (s.sawTrend) touchTrendMarker()
      mkdirSync(OUT_DIR, { recursive: true })
      writeFileSync(join(OUT_DIR, s.filename), s.markdown)
    } catch {
      // Never block or noisy-fail a shutdown.
    }
  })
}
