/**
 * prune-core.mjs — pure transcript-pruner algorithm (no pi imports).
 *
 * Shared by:
 *   - extensions/transcript-pruner.ts (live context hook)
 *   - bench/workload-deterministic.mjs (fixed-turn KEEP gate)
 *
 * Must stay byte-logic-equivalent with the inlined algorithm historically
 * carried in transcript-pruner.ts. Order per message: STALE → DEDUP;
 * then a CLEAR pass. DEDUP keeps the FIRST full occurrence and pointers
 * later dups. STALE requires lastWrite index > resultIndex + 3.
 */

import * as path from "node:path";

export const READ_TOOLS = new Set([
  "read",
  "ctx_read",
  "ls",
  "ctx_ls",
  "grep",
  "ctx_grep",
  "find",
  "ctx_find",
  "bash",
  "ctx_shell",
  "ctx_batch_execute",
  "ctx_execute_file",
]);

export const INTENT_IGNORED = new Set(["ctx_execute_file", "ctx_read", "ctx_execute"]);

export const PATH_READ_TOOLS = new Set([
  "read",
  "ctx_read",
  "ctx_execute_file",
  "ctx_shell",
  "ctx_grep",
]);

export const PATH_WRITE_TOOLS = new Set(["write", "ctx_write", "edit", "ctx_edit"]);

const SHELL_CONTENT_CMDS = new Set(["cat", "head", "tail", "grep", "sed"]);

export function stableStringify(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const o = obj;
  return (
    "{" +
    Object.keys(o)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + stableStringify(o[k]))
      .join(",") +
    "}"
  );
}

export function textOf(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((b) => b && typeof b === "object" && b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

export function replaceText(msg, text) {
  if (!msg || typeof msg !== "object") return false;
  const original = textOf(msg.content);
  if (original.length <= text.length) return false;
  if (Array.isArray(msg.content)) {
    let replaced = false;
    msg.content = msg.content.flatMap((block) => {
      if (block && typeof block === "object" && block.type === "text") {
        if (replaced) return [];
        replaced = true;
        return [{ type: "text", text, textSignature: undefined }];
      }
      return [block];
    });
    if (!replaced) msg.content.push({ type: "text", text });
  } else {
    msg.content = [{ type: "text", text }];
  }
  return true;
}

export function normPath(p, cwd) {
  try {
    return cwd ? path.resolve(cwd, p) : p;
  } catch {
    return p;
  }
}

/** Conservative: only simple cat/head/tail/grep/sed -n of a single path. */
export function shellReadPath(cmd, cwd) {
  if (typeof cmd !== "string" || cmd.length === 0) return undefined;
  if (/[>|;&$(){}`]/.test(cmd)) return undefined;
  const toks = cmd.trim().split(/\s+/);
  const bin = toks[0] ? toks[0].split("/").pop() : undefined;
  if (!bin || !SHELL_CONTENT_CMDS.has(bin)) return undefined;
  if (bin === "sed" && (toks.includes("-i") || toks.includes("--in-place"))) return undefined;
  if (bin === "sed" && !toks.some((t) => t === "-n" || t.startsWith("-n"))) return undefined;
  let p;
  for (let j = toks.length - 1; j >= 0; j--) {
    const t = toks[j];
    if (t.startsWith("-")) continue;
    const clean = t.replace(/^['"]|['"]$/g, "");
    if (/^[A-Za-z0-9_./~-]+$/.test(clean)) {
      p = clean;
      break;
    }
  }
  return p === undefined ? undefined : normPath(p, cwd);
}

/** Paths a shell command likely MODIFIES (conservative). */
export function shellWritePaths(cmd, cwd) {
  if (typeof cmd !== "string" || cmd.length === 0) return [];
  if (/\|\|/.test(cmd)) return [];
  const out = [];
  const add = (p) => {
    if (!p) return;
    const clean = p.replace(/^['"]|['"]$/g, "");
    if (!/^[A-Za-z0-9_./~-]+$/.test(clean)) return;
    if (/^\d+$/.test(clean)) return;
    if (clean.startsWith("/dev/")) return;
    out.push(normPath(clean, cwd));
  };
  const toks = cmd.trim().split(/\s+/);
  const bin = toks[0] ? toks[0].split("/").pop() : undefined;
  if (bin === "sed") {
    if (!(toks.includes("-i") || toks.includes("--in-place"))) return [];
    for (const t of toks.slice(1)) {
      if (t.startsWith("-")) continue;
      if (/^['"].*['"]$/.test(t)) continue;
      if (/^(s|e|y)\//.test(t)) continue;
      add(t);
    }
    return out;
  }
  if (/['"(){}`]/.test(cmd)) return [];
  for (let k = 0; k < toks.length; k++) {
    const m = /^(?:[0-9]+)?(>+)(.*)$/.exec(toks[k]);
    if (m) {
      if (m[2]) add(m[2]);
      else if (k + 1 < toks.length) add(toks[k + 1]);
    }
  }
  if (bin === "rm" || bin === "touch") {
    for (const t of toks.slice(1)) {
      if (t.startsWith("-") || t === "--") continue;
      add(t);
    }
  } else if (bin === "mv" || bin === "cp") {
    for (let j = toks.length - 1; j >= 1; j--) {
      if (toks[j].startsWith("-")) continue;
      add(toks[j]);
      break;
    }
  }
  return out;
}

export function estimateChars(messages) {
  let n = 0;
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    n += textOf(m.content).length;
    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if (b && b.type === "toolCall") {
          n += (b.name || "").length + stableStringify(b.arguments ?? {}).length;
        } else if (b && b.type === "tool_use") {
          n += (b.name || "").length + stableStringify(b.input ?? {}).length;
        }
      }
    }
  }
  return n;
}

/**
 * @param {object[]} messages - mutable clone (caller clones if needed)
 * @param {object} opts
 * @returns {{ changed: Array<{idx:number,kind:string,bytes:number}>, charsBefore:number, charsAfter:number }}
 */
export function pruneMessages(messages, opts = {}) {
  const minLen = Number.isFinite(opts.minLen) && opts.minLen > 0 ? opts.minLen : 40;
  const keepRecent =
    Number.isFinite(opts.keepRecent) && opts.keepRecent >= 0
      ? Math.floor(opts.keepRecent)
      : 4;
  const enableDedup = opts.enableDedup !== false;
  const enableStale = opts.enableStale !== false;
  const enableClear = opts.enableClear !== false;
  const cwd = opts.cwd;

  const charsBefore = estimateChars(messages);
  const changed = [];

  // Failed tool calls (exclude their writes from lastWrite)
  const failedCalls = new Set();
  for (const m of messages) {
    if (
      m &&
      typeof m === "object" &&
      (m.role === "toolResult" || m.role === "tool") &&
      m.isError
    ) {
      if (typeof m.toolCallId === "string") failedCalls.add(m.toolCallId);
    }
  }

  // Index toolCallId → { name, args }
  const callById = new Map();
  for (const m of messages) {
    if (!m || typeof m !== "object" || m.role !== "assistant" || !Array.isArray(m.content)) {
      continue;
    }
    for (const b of m.content) {
      if (!b || typeof b !== "object") continue;
      const id =
        b.type === "toolCall" || b.type === "tool_use" ? b.id : undefined;
      if (typeof id !== "string") continue;
      const name = b.name;
      const args = b.type === "toolCall" ? b.arguments : b.input;
      if (typeof name === "string") callById.set(id, { name, args });
    }
  }

  // Pre-pass: last successful write/edit per path
  const lastWrite = new Map();
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== "object" || m.role !== "assistant" || !Array.isArray(m.content)) {
      continue;
    }
    for (const b of m.content) {
      if (!b || typeof b !== "object") continue;
      const wName = b.name;
      if (typeof wName !== "string") continue;
      const input = b.type === "toolCall" ? b.arguments : b.input;
      if (PATH_WRITE_TOOLS.has(wName)) {
        const p = input && (input.path ?? input.file_path);
        if (typeof p === "string" && !failedCalls.has(b.id)) {
          lastWrite.set(normPath(p, cwd), i);
        }
      } else if ((wName === "ctx_shell" || wName === "bash") && !failedCalls.has(b.id)) {
        for (const wp of shellWritePaths(input && (input.command ?? input.cmd), cwd)) {
          lastWrite.set(wp, i);
        }
      }
    }
  }

  const seen = new Map(); // sig → first full-occurrence index
  const seenContent = new Map(); // path+text → first index

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== "object") continue;
    if (m.role === "assistant" && Array.isArray(m.content)) continue;
    if (m.role !== "toolResult" || m.isError) continue;

    const info = callById.get(m.toolCallId);
    const name = typeof m.toolName === "string" ? m.toolName : info?.name;
    if (!name) continue;
    const text = textOf(m.content);
    if (text.length < minLen) continue;
    const args = info?.args ?? {};

    let normP;
    let contentRead = false;
    if (name === "ctx_shell") {
      normP = shellReadPath(args && (args.command ?? args.cmd), cwd);
      contentRead = normP !== undefined;
    } else {
      const rawPath = args && (args.path ?? args.file_path);
      normP = typeof rawPath === "string" ? normPath(rawPath, cwd) : undefined;
      contentRead = name === "read" || name === "ctx_read" || name === "ctx_grep";
    }

    // STALE: write must be > i+3 (original gate — avoids near-neighbor false positives)
    if (
      enableStale &&
      PATH_READ_TOOLS.has(name) &&
      normP !== undefined &&
      (lastWrite.get(normP) ?? -1) > i + 3
    ) {
      const n = text.length;
      if (replaceText(m, `[stale: ${normP}; changed at msg ${(lastWrite.get(normP) ?? 0) + 1}; re-read]`)) {
        changed.push({ idx: i, kind: "stale", bytes: n });
      }
      continue;
    }

    // Exact-sig DEDUP: keep FIRST, pointer later
    if (enableDedup && READ_TOOLS.has(name)) {
      const sigArgs =
        INTENT_IGNORED.has(name) && args && typeof args === "object"
          ? Object.fromEntries(Object.entries(args).filter(([k]) => k !== "intent"))
          : args;
      const sig = name + "\0" + stableStringify(sigArgs) + "\0" + text;
      const first = seen.get(sig);
      if (first !== undefined) {
        const n = text.length;
        if (replaceText(m, `[dup of earlier ${name} (msg ${first + 1}) — see above]`)) {
          changed.push({ idx: i, kind: "dup", bytes: n });
        }
        continue;
      }
      seen.set(sig, i);
    }

    // Cross-tool content DEDUP
    if (enableDedup && contentRead && normP !== undefined) {
      const csig = normP + "\0" + text;
      const cfirst = seenContent.get(csig);
      if (cfirst !== undefined) {
        const n = text.length;
        if (replaceText(m, `[dup of earlier ${name} (msg ${cfirst + 1}) — see above]`)) {
          changed.push({ idx: i, kind: "dup", bytes: n });
        }
      } else {
        seenContent.set(csig, i);
      }
    }
  }

  // CLEAR: keep last `keep` full-sized tool results
  if (enableClear && keepRecent >= 0) {
    const fullIdx = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m || typeof m !== "object" || m.role !== "toolResult" || m.isError) continue;
      const t = textOf(m.content);
      if (t.length < minLen) continue;
      if (/^\[(dup of earlier|stale:|cleared:)/.test(t)) continue;
      fullIdx.push(i);
    }
    const dropCount = Math.max(0, fullIdx.length - keepRecent);
    for (let j = 0; j < dropCount; j++) {
      const i = fullIdx[j];
      const m = messages[i];
      const info = callById.get(m.toolCallId);
      const name = typeof m.toolName === "string" ? m.toolName : info?.name ?? "tool";
      const args = info?.args ?? {};
      const rawPath = args && (args.path ?? args.file_path);
      let label = name;
      if (typeof rawPath === "string") label += ` ${normPath(rawPath, cwd)}`;
      else if (name === "ctx_shell" || name === "bash") {
        const rp = shellReadPath(args && (args.command ?? args.cmd), cwd);
        if (rp) label += ` ${rp}`;
      }
      const n = textOf(m.content).length;
      if (replaceText(m, `[cleared: ${label} — ${n} chars; see earlier turns or re-read]`)) {
        changed.push({ idx: i, kind: "clear", bytes: n });
      }
    }
  }

  const charsAfter = estimateChars(messages);
  return { changed, charsBefore, charsAfter };
}

export function summarizeChanged(changed) {
  const kinds = { clear: 0, dup: 0, stale: 0 };
  let bytes = 0;
  for (const c of changed) {
    if (c.kind in kinds) kinds[c.kind]++;
    bytes += c.bytes || 0;
  }
  return { kinds, bytes };
}

/** Deep-clone messages for safe mutation. */
export function cloneMessages(messages) {
  return JSON.parse(JSON.stringify(messages));
}
