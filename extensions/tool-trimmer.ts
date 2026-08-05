/**
 * tool-trimmer.ts — remove rarely-used admin/diagnostic tools from the active
 * surface to save tokens per request.
 *
 * context-mode registers ctx_doctor, ctx_insight, ctx_stats, ctx_upgrade,
 * ctx_purge unconditionally. With lean-ctx MCP bridge OFF, lean-ctx's
 * disableTools cannot reach them. This extension removes them from the
 * active tool set at session_start.
 *
 * NOTE: setActiveTools removes tools from the agent's callable set but may
 * not remove their schemas from the API request if context-mode registers
 * them after session_start. This extension is a best-effort approach.
 * Set PI_TOOL_TRIMMER=0 to disable.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"

const TRIMMED = new Set([
  "ctx_doctor",
  "ctx_insight",
  "ctx_stats",
  "ctx_upgrade",
  "ctx_purge",
])

export default function toolTrimmer(pi: ExtensionAPI) {
  if (process.env.PI_TOOL_TRIMMER === "0") return

  pi.on("session_start", () => {
    const active = pi.getActiveTools()
    const filtered = active.filter((name: string) => !TRIMMED.has(name))
    if (filtered.length < active.length) {
      pi.setActiveTools(filtered)
    }
  })
}
