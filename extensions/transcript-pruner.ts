/** * transcript-pruner.ts — cross-message transcript redundancy pruning. * * Avenue: existing context engineering compresses messages individually * (pi-tscg), caches tool outputs at the tool level (pi-lean-ctx), and * stabilizes prompts for KV-cache hits (pi-cache-optimizer). None of them * remove *cross-message* redundancy in the transcript: identical tool * results re-sent on later requests, and file reads whose content has been * superseded by a later write/edit. * * This extension hooks the `context` event (fires before every LLM call, * sees a structuredClone of the transcript) and rewrites: * * 1. DEDUP — exact-duplicate read-only tool results (same tool, same * args, byte-identical output) become a short pointer to the * first full occurrence. Lossless: the full text remains in * the transcript above. Cross-tool content dedup additionally * collapses byte-identical results for the same resolved path * (e.g. ctx_read full == ctx_shell "cat" == ctx_grep). * 2. STALE — path-read results (read/ctx_read/ctx_execute_file/ctx_grep * and simple ctx_shell cat/head/tail/grep/sed -n invocations) * for a path that was later written/edited become a one-line * stale notice, so the model is not charged (or misled) by * content it has since changed. * * 3. CLEAR — tool results older than the last K full results (default K=4 via PI_PRUNE_KEEP) become a short pointer once the model has moved on. Attacks uncleared spent outputs (survey item 4). * * Safety: only text content is replaced; message pairing (toolCallId) is * preserved; dedup requires byte-identical output (the earlier full * occurrence always remains in the transcript above). Default ON. Set PI_TRANSCRIPT_PRUNE=0 to disable. Toggles: PI_PRUNE_DEDUP / PI_PRUNE_STALE / PI_PRUNE_CLEAR (1/0); thresholds * via PI_PRUNE_MIN_LEN (default 40), PI_PRUNE_KEEP (default 4). */
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export default function transcriptPruner(pi: ExtensionAPI) {
 const flag = (name: string, def = true): boolean => {
  const v = process.env[name];
  if (v === undefined) return def;
  return v === "1" || v.toLowerCase() === "true";
 };
 const enabled = (): boolean => {
    // Default ON. Set PI_TRANSCRIPT_PRUNE=0 to disable (escape hatch only).
    const v = process.env.PI_TRANSCRIPT_PRUNE;
    if (v === undefined) return true;
    return !(v === "0" || v.toLowerCase() === "false");
  };
 const minLen = (): number => {
  const v = Number(process.env.PI_PRUNE_MIN_LEN ?? 40);
  return Number.isFinite(v) && v > 0 ? v : 40;
 };
 const keepRecent = (): number => {
   const v = Number(process.env.PI_PRUNE_KEEP ?? 4);
   return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 4;
 };
 // Tool classes (names as registered by this harness + lean-ctx shims).
 const READ_TOOLS = new Set([
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
 // Tools whose `intent` argument is a model-facing hint that does not affect
 // the result; drop it from the dedup signature so "read X (intent A)" and
 // "read X (intent B)" with byte-identical output still dedup.
 const INTENT_IGNORED = new Set(["ctx_execute_file", "ctx_read", "ctx_execute"]);
 // Path-tagged read tools eligible for STALE pruning and cross-tool content
 // dedup. ctx_shell results are tagged via shellReadPath (conservative parse).
 const PATH_READ_TOOLS = new Set(["read", "ctx_read", "ctx_execute_file", "ctx_shell", "ctx_grep"]);
 const PATH_WRITE_TOOLS = new Set(["write", "ctx_write", "edit", "ctx_edit"]);
 const stableStringify = (obj: unknown): string => {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const o = obj as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(o[k])).join(",") + "}";
 };
 const textOf = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
   return content.filter((b: any) => b && typeof b === "object" && b.type === "text" && typeof b.text === "string").map((b: any) => b.text).join("\n");
  }
  return "";
 };
 const replaceText = (msg: any, text: string): boolean => {
  if (!msg || typeof msg !== "object") return false;
  if (Array.isArray(msg.content)) {
   let replaced = false;
   msg.content = msg.content.map((b: any) => {
    if (b && typeof b === "object" && b.type === "text") {
     replaced = true;
     return { type: "text", text, textSignature: undefined };
    }
    return b;
   });
   if (!replaced) msg.content.push({ type: "text", text });
  } else {
   msg.content = [{ type: "text", text }];
  }
  return true;
 };
 const debug = (line: string): void => {
  const logPath = process.env.PI_PRUNE_LOG;
  if (!logPath) return;
  try {
   // eslint-disable-next-line @typescript-eslint/no-var-requires
   const fs = require("node:fs");
   fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
  } catch { /* debug logging is best-effort */ }
 };
 const normPath = (p: string, cwd?: string): string => {
  try {
   return cwd ? path.resolve(cwd, p) : p;
  } catch {
   return p;
  }
 };
 // Parse a ctx_shell command for simple content-read invocations
 // (cat/head/tail/grep/sed -n <path>). Conservative: commands containing
 // redirections, pipes, or control operators are NOT tagged (they may write
 // or are too complex to reason about). Returns the normalized path or undefined.
 const SHELL_CONTENT_CMDS = new Set(["cat", "head", "tail", "grep", "sed"]);
 const shellReadPath = (cmd: unknown, cwd?: string): string | undefined => {
  if (typeof cmd !== "string" || cmd.length === 0) return undefined;
 if (/[>|;&$()\x7b\x7d`]/.test(cmd)) return undefined; // redirection/pipe/control -> could write
  const toks = cmd.trim().split(/\s+/);
  const bin = toks[0] ? toks[0].split("/").pop() : undefined;
  if (!bin || !SHELL_CONTENT_CMDS.has(bin)) return undefined;
  if (bin === "sed" && (toks.includes("-i") || toks.includes("--in-place"))) return undefined; // write
  if (bin === "sed" && !toks.some((t) => t === "-n" || t.startsWith("-n"))) return undefined; // print mode only
  let p: string | undefined;
  for (let j = toks.length - 1; j >= 0; j--) {
   const t = toks[j];
   if (t.startsWith("-")) continue;
   const clean = t.replace(/^[\x27\x22]|[\x27\x22]$/g, "");
   if (/^[A-Za-z0-9_./~-]+$/.test(clean)) { p = clean; break; }
  }
  return p === undefined ? undefined : normPath(p, cwd);
 };
 // Detect paths a ctx_shell/bash command likely MODIFIES (conservative):
 // rm/mv/touch/cp/sed -i with a bare path arg, or an unquoted redirection
 // target. Commands containing quotes (except sed -i scripts), arithmetic,
 // or `||` are skipped entirely (too risky to parse). Failed commands are
 // excluded by the caller via the isError pre-pass. Returns normalized paths or [].
 const shellWritePaths = (cmd: unknown, cwd?: string): string[] => {
 if (typeof cmd !== "string" || cmd.length === 0) return [];
 if (/\|\|/.test(cmd)) return []; // conditional short-circuit -> unknown semantics
 const out: string[] = [];
 const add = (p: string) => {
  if (!p) return;
  const clean = p.replace(/^[\x27\x22]|[\x27\x22]$/g, "");
  if (!/^[A-Za-z0-9_./~-]+$/.test(clean)) return;
  if (/^\d+$/.test(clean)) return; // arithmetic-like target
  if (clean.startsWith("/dev/")) return;
  out.push(normPath(clean, cwd));
 };
 const toks = cmd.trim().split(/\s+/);
 const bin = toks[0] ? toks[0].split("/").pop() : undefined;
 // sed -i: the script is always quoted; take the bare path token(s).
 if (bin === "sed") {
  if (!(toks.includes("-i") || toks.includes("--in-place"))) return [];
  for (const t of toks.slice(1)) {
   if (t.startsWith("-")) continue;
   if (/^[\x27\x22].*[\x27\x22]$/.test(t)) continue; // quoted script
   if (/^(s|e|y)\//.test(t)) continue;   // unquoted script
   add(t);
  }
  return out;
 }
 if (/[\x27\x22()\x7b\x7d`]/.test(cmd)) return []; // anything else with quotes/arithmetic -> skip
 // redirections: attached (>file) or separated (> file), optional fd prefix
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
  // destination = last non-flag token
  for (let j = toks.length - 1; j >= 1; j--) {
   if (toks[j].startsWith("-")) continue;
   add(toks[j]); break;
  }
 }
 return out;
 };
 pi.on("context", (event, ctx) => {
  if (!enabled()) return undefined;
  const dedup = flag("PI_PRUNE_DEDUP");
  const stale = flag("PI_PRUNE_STALE");
  const clear = flag("PI_PRUNE_CLEAR");
  const min = minLen();
  const keep = keepRecent();
  const messages = event.messages;
  if (!Array.isArray(messages) || messages.length < 4) return undefined;
  // Index tool calls by id (handle both in-memory and JSONL block shapes).
  const failedCalls = new Set<string>();
  for (const m of messages) {
   if (m && typeof m === "object" && (m.role === "toolResult" || m.role === "tool") && m.isError) {
    if (typeof m.toolCallId === "string") failedCalls.add(m.toolCallId);
   }
  }
  const callById = new Map<string, { name: string; args: any }>();
  for (const m of messages) {
   if (!m || typeof m !== "object" || m.role !== "assistant" || !Array.isArray(m.content)) continue;
   for (const b of m.content) {
    if (!b || typeof b !== "object") continue;
    const id = (b as any).type === "toolCall" ? (b as any).id : (b as any).type === "tool_use" ? (b as any).id : undefined;
    if (typeof id !== "string") continue;
    const name = (b as any).type === "toolCall" ? (b as any).name : (b as any).name;
    const args = (b as any).type === "toolCall" ? (b as any).arguments : (b as any).input;
    if (typeof name === "string") callById.set(id, { name, args });
   }
  }
  const seen = new Map<string, number>(); // sig -> first full-occurrence index
  const seenContent = new Map<string, number>(); // (path + text) -> first full occurrence (cross-tool dedup)
  const lastWrite = new Map<string, number>(); // path -> index of most recent write/edit
  const changed: Array<{ msg: any; idx: number; kind: string }> = [];
  // Pre-pass: record every successful write/edit position (index of the
  // assistant message carrying the tool call), so reads earlier in the
  // transcript can be judged stale regardless of scan order.
  for (let i = 0; i < messages.length; i++) {
   const m = messages[i];
   if (!m || typeof m !== "object" || m.role !== "assistant" || !Array.isArray(m.content)) continue;
   for (const b of m.content) {
    if (!b || typeof b !== "object") continue;
    const wName = (b as any).name;
    if (typeof wName !== "string") continue;
    const input = (b as any).type === "toolCall" ? (b as any).arguments : (b as any).input;
    if (PATH_WRITE_TOOLS.has(wName)) {
     const p = input && (input.path ?? input.file_path);
     if (typeof p === "string" && !failedCalls.has((b as any).id)) {
      lastWrite.set(normPath(p, ctx?.cwd), i);
     }
    } else if ((wName === "ctx_shell" || wName === "bash") && !failedCalls.has((b as any).id)) {
     for (const wp of shellWritePaths(input && (input.command ?? input.cmd), ctx?.cwd)) {
      lastWrite.set(wp, i);
     }
    }
   }
  }
  for (let i = 0; i < messages.length; i++) {
   const m = messages[i];
   if (!m || typeof m !== "object") continue;
   if (m.role === "assistant" && Array.isArray(m.content)) {
    continue;
   }
   if (m.role !== "toolResult" || m.isError) continue;
   const info = callById.get(m.toolCallId);
   const name: string | undefined = typeof m.toolName === "string" ? m.toolName : info?.name;
   if (!name) continue;
   const text = textOf(m.content);
   if (text.length < min) continue;
   const args = info?.args ?? {};
   // Resolve the path this result refers to (if any). ctx_shell results are
   // resolved by parsing the command for simple content-read invocations.
   let normP: string | undefined;
   let contentRead = false;
   if (name === "ctx_shell") {
    normP = shellReadPath(args && (args.command ?? args.cmd), ctx?.cwd);
    contentRead = normP !== undefined;
   } else {
    const rawPath = args && (args.path ?? args.file_path);
    normP = typeof rawPath === "string" ? normPath(rawPath, ctx?.cwd) : undefined;
    contentRead = name === "read" || name === "ctx_read" || name === "ctx_grep";
   }
   if (stale && PATH_READ_TOOLS.has(name) && normP !== undefined && (lastWrite.get(normP) ?? -1) > i) {
    if (replaceText(m, `[stale: ${normP} changed at msg ${(lastWrite.get(normP) ?? 0) + 1}; re-read]`)) {
     changed.push({ msg: m, idx: i, kind: "stale" });
    }
    continue;
   }
   if (dedup && READ_TOOLS.has(name)) {
    const sigArgs = INTENT_IGNORED.has(name) && args && typeof args === "object"
     ? Object.fromEntries(Object.entries(args).filter(([k]) => k !== "intent"))
     : args;
    const sig = name + "\x00" + stableStringify(sigArgs) + "\x00" + text;
    const first = seen.get(sig);
    if (first !== undefined) {
     if (replaceText(m, `[dup of earlier ${name} (msg ${first + 1}) — see above]`)) {
      changed.push({ msg: m, idx: i, kind: "dup" });
     }
     continue;
    }
    seen.set(sig, i);
   }
   // Cross-tool content dedup: byte-identical text for the same resolved path
   // (e.g. ctx_read full == ctx_shell "cat" == ctx_grep) is one result.
   if (dedup && contentRead && normP !== undefined) {
    const csig = normP + "\x00" + text;
    const cfirst = seenContent.get(csig);
    if (cfirst !== undefined) {
     if (replaceText(m, `[dup of earlier ${name} (msg ${cfirst + 1}) — see above]`)) {
      changed.push({ msg: m, idx: i, kind: "dup" });
     }
    } else {
     seenContent.set(csig, i);
    }
   }
  }
  // CLEAR: keep last `keep` full-sized tool results; pointer-replace older spent outputs.
  if (clear && keep >= 0) {
    const fullIdx: number[] = [];
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (!m || typeof m !== "object" || m.role !== "toolResult" || m.isError) continue;
      const t = textOf(m.content);
      if (t.length < min) continue;
      if (/^\[(dup of earlier|stale:|cleared:)/.test(t)) continue;
      fullIdx.push(i);
    }
    const dropCount = Math.max(0, fullIdx.length - keep);
    for (let j = 0; j < dropCount; j++) {
      const i = fullIdx[j];
      const m = messages[i];
      const info = callById.get(m.toolCallId);
      const name: string = typeof m.toolName === "string" ? m.toolName : info?.name ?? "tool";
      const args = info?.args ?? {};
      const rawPath = args && (args.path ?? args.file_path);
      let label = name;
      if (typeof rawPath === "string") label += ` ${normPath(rawPath, ctx?.cwd)}`;
      else if (name === "ctx_shell" || name === "bash") {
        const rp = shellReadPath(args && (args.command ?? args.cmd), ctx?.cwd);
        if (rp) label += ` ${rp}`;
      }
      const n = textOf(m.content).length;
      if (replaceText(m, `[cleared: ${label} — ${n} chars; see earlier turns or re-read]`)) {
        changed.push({ msg: m, idx: i, kind: "clear" });
      }
    }
  }

  if (changed.length > 0) {
   debug(`pruned ${changed.length} of ${messages.length} msgs (dedup=${dedup} stale=${stale} clear=${clear} keep=${keep}) kinds=${changed.map((c) => c.kind).join(",")}`);
   return { messages };
  }
  debug(`noop ${messages.length} msgs`);
  return undefined;
 });
}
