/**
 * Runtime discipline — operational enforcement for:
 * 1) lean-ctx / shell allowlist blocks (esp. python -c / heredoc)
 * 2) edit context misses (never identical retry)
 * 3) long-session close discipline (mid-flight + end checklist)
 *
 * Pattern: tool_execution_end flags → before_agent_start systemPrompt nudge.
 * No LLM calls. Toggle: PI_RUNTIME_DISCIPLINE=0 to disable.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const ENABLED = () => process.env.PI_RUNTIME_DISCIPLINE !== "0";

// Long-session thresholds
const LONG_MS = Number(process.env.PI_LONG_SESSION_MS || 60 * 60 * 1000); // 60m
const LONG_TURNS = Number(process.env.PI_LONG_SESSION_TURNS || 24);
const COMPACT_THRESHOLD = Number(process.env.PI_LONG_SESSION_COMPACTS || 3);

// Cooldown so we don't re-nudge every turn forever
const FRICTION_COOLDOWN_MS = 3 * 60 * 1000;
const LONG_COOLDOWN_MS = 15 * 60 * 1000;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((b) => (b && typeof b === "object" && typeof (b as any).text === "string" ? (b as any).text : ""))
    .join("\n");
}

function isAllowlistBlock(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("[blocked") ||
    t.includes("do not retry") ||
    t.includes("allowlist") ||
    t.includes("shell allowlist") ||
    t.includes("permanent security restriction") ||
    (t.includes("blocked") && (t.includes("python") || t.includes("heredoc") || t.includes("interpreter")))
  );
}

function isEditMiss(toolName: string, text: string, isError?: boolean): boolean {
  const n = (toolName || "").toLowerCase();
  const t = text.toLowerCase();
  if (n === "edit" || n === "ctx_edit" || n.includes("edit")) {
    return (
      isError === true ||
      t.includes("could not find") ||
      t.includes("not found") ||
      t.includes("old_string") ||
      t.includes("oldtext") ||
      t.includes("fuzzy match")
    );
  }
  return t.includes("could not find") && t.includes("edit");
}

const ALLOWLIST_NUDGE = `
<runtime_discipline kind="allowlist_block">
Shell/interpreter block just fired. Do NOT retry the same shape.
Required recovery:
1) Prefer ctx_read / ctx_edit / ctx_execute / ctx_batch_execute over raw shell.
2) Never python -c, python3 -c, or shell heredoc into interpreters — write a .mjs/.py/.sh file, then run the file.
3) If lean-ctx blocked an introspection command, switch to a ctx_* tool or a script file.
Continue the task with a different tool path now.
</runtime_discipline>`;

const EDIT_MISS_NUDGE = `
<runtime_discipline kind="edit_miss">
Edit/patch context miss. Do NOT retry identical old_string/oldText.
Required recovery:
1) Re-read the exact file slice (ctx_read with offset/limit).
2) Copy the live text into the next edit, or use sed/perl via ctx_shell only if needed.
3) After multi-file edits, run a cheap verify (rg, JSON parse, or targeted test) before claiming done.
</runtime_discipline>`;

const LONG_SESSION_NUDGE = `
<runtime_discipline kind="long_session">
Long session threshold reached. Before more tool work, emit a short status block:
- status: in_progress | blocked | done
- done_so_far: (1-3 bullets)
- files_touched: paths
- next: single next action
- verify: command or check you will run before claiming done
If the user is ending the session or the task is complete, also write an end checklist:
done/blocked, files, verify artifact. Do not claim completion without verification when files changed.
</runtime_discipline>`;

export default function runtimeDiscipline(pi: ExtensionAPI) {
  let startedAt = Date.now();
  let userTurns = 0;
  let compactEvents = 0;

  let pendingAllowlist = false;
  let pendingEditMiss = false;
  let lastFrictionNudgeAt = 0;
  let lastLongNudgeAt = 0;
  let longNudgeCount = 0;

  function resetSession() {
    startedAt = Date.now();
    userTurns = 0;
    compactEvents = 0;
    pendingAllowlist = false;
    pendingEditMiss = false;
    lastFrictionNudgeAt = 0;
    lastLongNudgeAt = 0;
    longNudgeCount = 0;
  }

  pi.on("session_start", async () => {
    resetSession();
  });

  // Count user inputs as turns
  pi.on("input", async () => {
    if (!ENABLED()) return;
    userTurns += 1;
  });

  // Best-effort compaction signal (event name may vary by pi version)
  for (const ev of ["session_compact", "compact", "auto_compact"] as const) {
    try {
      pi.on(ev as any, async () => {
        if (!ENABLED()) return;
        compactEvents += 1;
      });
    } catch {
      // ignore unknown event registration failures
    }
  }

  pi.on("tool_execution_end", async (event: any) => {
    if (!ENABLED()) return;
    const name = String(event?.toolName || event?.name || "");
    const isError = Boolean(event?.isError || event?.error);
    const result = event?.result ?? event?.toolResult ?? event?.output;
    let text = "";
    if (typeof result === "string") text = result;
    else if (result && typeof result === "object") {
      text = textOf((result as any).content ?? (result as any).text ?? result);
      if ((result as any).isError) {
        // keep
      }
    }
    if (!text && typeof event?.content === "string") text = event.content;
    if (!text) text = textOf(event?.content);

    if (isAllowlistBlock(text) || (isError && isAllowlistBlock(String(event?.error || "")))) {
      pendingAllowlist = true;
    }
    if (isEditMiss(name, text, isError)) {
      pendingEditMiss = true;
    }
  });

  pi.on("before_agent_start", async (event: any) => {
    if (!ENABLED()) return;
    const now = Date.now();
    const parts: string[] = [];

    // Friction nudges
    if (pendingAllowlist || pendingEditMiss) {
      if (now - lastFrictionNudgeAt >= FRICTION_COOLDOWN_MS) {
        if (pendingAllowlist) parts.push(ALLOWLIST_NUDGE);
        if (pendingEditMiss) parts.push(EDIT_MISS_NUDGE);
        pendingAllowlist = false;
        pendingEditMiss = false;
        lastFrictionNudgeAt = now;
      }
    }

    // Long-session discipline
    const age = now - startedAt;
    const long =
      age >= LONG_MS || userTurns >= LONG_TURNS || compactEvents >= COMPACT_THRESHOLD;
    if (long && now - lastLongNudgeAt >= LONG_COOLDOWN_MS) {
      // First long nudge is mid-flight; later ones remind end checklist
      parts.push(LONG_SESSION_NUDGE);
      lastLongNudgeAt = now;
      longNudgeCount += 1;
    }

    if (parts.length === 0) return;
    const sys = typeof event?.systemPrompt === "string" ? event.systemPrompt : "";
    return { systemPrompt: sys + "\n" + parts.join("\n") };
  });
}
