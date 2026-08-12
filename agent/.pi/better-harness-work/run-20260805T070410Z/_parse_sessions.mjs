import fs from "fs";
import path from "path";

const sessionsDir = "/home/alex/.pi/agent/sessions";
const windowStart = Date.parse("2026-07-05T00:00:00.000Z");
const windowEnd = Date.parse("2026-08-05T07:04:10.000Z"); // packet until
const p0Fix = Date.parse("2026-08-05T06:56:00.000Z");

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

function extractText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        typeof c === "string"
          ? c
          : c?.text || c?.content || (typeof c === "object" ? JSON.stringify(c) : "")
      )
      .join("\n");
  }
  if (typeof content === "object") {
    if (content.text) return String(content.text);
    if (content.content) return extractText(content.content);
    return JSON.stringify(content);
  }
  return String(content);
}

function isAllowlistFail(text) {
  return /not (?:in|on) the allowlist|allowlist blocked|command not allowed|blocked by (?:the )?allowlist|not allowed by (?:shell )?policy|shell allowlist|Command not in allowlist|is not allowlisted|denied by allowlist/i.test(
    text
  );
}

function isEditMiss(text, toolName = "") {
  const t = text || "";
  const editish = /edit|ctx_edit|str_replace|apply_patch|Edit/i.test(toolName);
  if (
    /could not find(?: the)? (?:exact )?text|string to replace not found|old[_ ]string not found|failed to find match|no match for|fuzzy match failed|Edit failed|context miss|TOCTOU|oldText not found|could not find.*to replace/i.test(
      t
    )
  ) {
    return true;
  }
  if (editish && /not found|no match|failed to apply|unable to apply/i.test(t)) return true;
  return false;
}

function isReadMiss(text, toolName = "") {
  if (!/read|cat|ctx_read|Read/i.test(toolName) && !/ENOENT|no such file|File not found|does not exist/i.test(text))
    return false;
  return /ENOENT|no such file|File not found|does not exist|path not found|Unable to read/i.test(text);
}

const files = walk(sessionsDir);
const toolCounts = Object.create(null);
const failReasons = Object.create(null);
const sessions = [];

let totalToolCalls = 0;
let totalToolResults = 0;
let isErrorTrue = 0;
let allowlistBlocks = 0;
let editMisses = 0;
let readMisses = 0;
let editCalls = 0;
let shellCalls = 0;
let compactions = 0;
let identicalRetryHints = 0;

for (const f of files) {
  const raw = fs.readFileSync(f, "utf8");
  const lines = raw.split("\n").filter(Boolean);
  let firstTs = null;
  let lastTs = null;
  let toolCalls = 0;
  let toolResults = 0;
  let allowN = 0;
  let editMissN = 0;
  let readMissN = 0;
  let editN = 0;
  let errN = 0;
  let hasOutcomeReview = false;
  let hasMidFlight = false;
  let hasCompaction = false;
  let models = new Set();
  let sessionId = path.basename(path.dirname(f));
  const toolsHere = Object.create(null);
  let cwd = null;
  let msgsUser = 0;
  let msgsAssistant = 0;
  const recentEditArgs = [];
  let lastEditFingerprint = null;

  for (const line of lines) {
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = ev.timestamp || ev.ts || ev.time || ev.createdAt || ev.message?.timestamp;
    const tms = ts ? Date.parse(ts) : NaN;
    if (!Number.isNaN(tms)) {
      if (firstTs == null) firstTs = tms;
      lastTs = tms;
    }

    if (ev.type === "session" || ev.type === "header" || ev.event === "session_start") {
      if (ev.id) sessionId = ev.id;
      if (ev.sessionId) sessionId = ev.sessionId;
      if (ev.cwd) cwd = ev.cwd;
    }
    if (ev.cwd && !cwd) cwd = ev.cwd;
    if (ev.type === "compaction" || ev.event === "compaction" || ev.kind === "compaction") {
      hasCompaction = true;
      compactions++;
    }

    const msg = ev.message || ev;
    const role = msg.role || ev.role;
    const mtype = msg.type || ev.type;
    if (msg.model) models.add(msg.model);
    if (ev.model) models.add(ev.model);

    if (role === "user") msgsUser++;
    if (role === "assistant") {
      msgsAssistant++;
      const text = extractText(msg.content);
      if (/mid-flight status|end checklist|Session hygiene|done\/blocked|files changed|verify next/i.test(text)) {
        hasOutcomeReview = true;
        if (/mid-flight/i.test(text)) hasMidFlight = true;
      }
      if (/context compacted|compaction applied|summarized prior context/i.test(text)) {
        hasCompaction = true;
      }
    }

    // Pi shapes: type tool_call / toolCall / message with content blocks
    const content = msg.content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        if (block.type === "toolCall" || block.type === "tool_use" || block.type === "tool_call") {
          const name = block.name || block.toolName || block.tool || "unknown";
          toolCalls++;
          totalToolCalls++;
          toolCounts[name] = (toolCounts[name] || 0) + 1;
          toolsHere[name] = (toolsHere[name] || 0) + 1;
          if (/^(edit|Edit|ctx_edit|str_replace)$/i.test(name)) {
            editN++;
            editCalls++;
            const args = block.arguments || block.input || block.args || {};
            const fp = JSON.stringify(args).slice(0, 500);
            if (lastEditFingerprint && lastEditFingerprint === fp) identicalRetryHints++;
            lastEditFingerprint = fp;
          }
          if (/shell|bash|Bash|ctx_shell/i.test(name)) shellCalls++;
        }
        if (block.type === "toolResult" || block.type === "tool_result") {
          toolResults++;
          totalToolResults++;
          const name = block.name || block.toolName || block.tool || "";
          const text = extractText(block.content ?? block.output ?? block.result ?? block.text);
          const isErr = block.isError === true || block.error === true || block.status === "error";
          if (isErr) {
            errN++;
            isErrorTrue++;
          }
          if (isAllowlistFail(text) || (isErr && /allowlist/i.test(text))) {
            allowN++;
            allowlistBlocks++;
            failReasons.allowlist = (failReasons.allowlist || 0) + 1;
          } else if (isEditMiss(text, name) || (isErr && /could not find|old[_ ]?string|oldText/i.test(text))) {
            editMissN++;
            editMisses++;
            failReasons.edit_miss = (failReasons.edit_miss || 0) + 1;
          } else if (isReadMiss(text, name)) {
            readMissN++;
            readMisses++;
            failReasons.read_miss = (failReasons.read_miss || 0) + 1;
          } else if (isErr) {
            const key = text.slice(0, 60).replace(/\s+/g, " ");
            failReasons[key] = (failReasons[key] || 0) + 1;
          }
        }
      }
    }

    // top-level tool events
    if (mtype === "toolCall" || mtype === "tool_call" || mtype === "tool_use" || ev.type === "tool_use") {
      const name = msg.name || msg.toolName || ev.name || "unknown";
      // avoid double count if already counted via content blocks — only if no content array toolCalls
      if (!Array.isArray(content)) {
        toolCalls++;
        totalToolCalls++;
        toolCounts[name] = (toolCounts[name] || 0) + 1;
        toolsHere[name] = (toolsHere[name] || 0) + 1;
        if (/^(edit|Edit|ctx_edit|str_replace)$/i.test(name)) {
          editN++;
          editCalls++;
        }
        if (/shell|bash|Bash|ctx_shell/i.test(name)) shellCalls++;
      }
    }
    if (mtype === "toolResult" || mtype === "tool_result" || ev.type === "tool_result") {
      if (!Array.isArray(content)) {
        toolResults++;
        totalToolResults++;
        const name = msg.name || msg.toolName || ev.name || "";
        const text = extractText(msg.content ?? msg.result ?? ev.result ?? ev.content);
        const isErr = msg.isError === true || ev.isError === true;
        if (isErr) {
          errN++;
          isErrorTrue++;
        }
        if (isAllowlistFail(text)) {
          allowN++;
          allowlistBlocks++;
          failReasons.allowlist = (failReasons.allowlist || 0) + 1;
        } else if (isEditMiss(text, name)) {
          editMissN++;
          editMisses++;
          failReasons.edit_miss = (failReasons.edit_miss || 0) + 1;
        } else if (isReadMiss(text, name)) {
          readMissN++;
          readMisses++;
          failReasons.read_miss = (failReasons.read_miss || 0) + 1;
        }
      }
    }

    // OpenAI-style tool_calls on assistant message
    const tcs = msg.tool_calls || msg.toolCalls;
    if (Array.isArray(tcs)) {
      for (const tc of tcs) {
        const name = tc.function?.name || tc.name || "unknown";
        toolCalls++;
        totalToolCalls++;
        toolCounts[name] = (toolCounts[name] || 0) + 1;
        toolsHere[name] = (toolsHere[name] || 0) + 1;
        if (/edit|ctx_edit|str_replace/i.test(name)) {
          editN++;
          editCalls++;
        }
        if (/shell|bash|ctx_shell/i.test(name)) shellCalls++;
      }
    }
  }

  const durationMin = firstTs != null && lastTs != null ? (lastTs - firstTs) / 60000 : 0;
  // eligibility: session activity overlaps window (use lastTs in window or firstTs)
  const overlapsWindow =
    firstTs != null &&
    lastTs != null &&
    firstTs <= windowEnd &&
    lastTs >= windowStart;
  const afterP0 = lastTs != null && lastTs >= p0Fix;

  sessions.push({
    file: path.relative(sessionsDir, f),
    sessionId,
    cwd,
    firstTs: firstTs != null ? new Date(firstTs).toISOString() : null,
    lastTs: lastTs != null ? new Date(lastTs).toISOString() : null,
    durationMin: Math.round(durationMin * 10) / 10,
    toolCalls,
    toolResults,
    allowN,
    editMissN,
    readMissN,
    editN,
    errN,
    hasOutcomeReview,
    hasMidFlight,
    hasCompaction,
    models: [...models],
    toolsHere,
    msgsUser,
    msgsAssistant,
    lines: lines.length,
    overlapsWindow,
    afterP0,
  });
}

const eligible = sessions.filter((s) => s.overlapsWindow);
const long = eligible.filter((s) => s.durationMin >= 60);
const withTools = eligible.filter((s) => s.toolCalls > 0);
const postP0 = sessions.filter((s) => s.afterP0);

const topTools = Object.entries(toolCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20);
const topFails = Object.entries(failReasons)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

// window-scoped aggregates from eligible only
let eToolCalls = 0,
  eToolResults = 0,
  eAllow = 0,
  eEditMiss = 0,
  eReadMiss = 0,
  eErr = 0,
  eEdit = 0,
  eShell = 0;
const eToolCounts = Object.create(null);
for (const s of eligible) {
  eToolCalls += s.toolCalls;
  eToolResults += s.toolResults;
  eAllow += s.allowN;
  eEditMiss += s.editMissN;
  eReadMiss += s.readMissN;
  eErr += s.errN;
  eEdit += s.editN;
  for (const [k, v] of Object.entries(s.toolsHere)) eToolCounts[k] = (eToolCounts[k] || 0) + v;
  if (Object.keys(s.toolsHere).some((n) => /shell|bash|ctx_shell/i.test(n))) eShell += s.toolsHere.ctx_shell || s.toolsHere.bash || s.toolsHere.Bash || 0;
}

const out = {
  totalFiles: files.length,
  eligibleCount: eligible.length,
  withToolsCount: withTools.length,
  zeroToolEligible: eligible.filter((s) => s.toolCalls === 0).length,
  totalsAllFiles: {
    totalToolCalls,
    totalToolResults,
    isErrorTrue,
    allowlistBlocks,
    editMisses,
    readMisses,
    editCalls,
    shellCalls,
    compactions,
    identicalRetryHints,
  },
  eligibleTotals: {
    eToolCalls,
    eToolResults,
    eAllow,
    eEditMiss,
    eReadMiss,
    eErr,
    eEdit,
    errorRate: eToolResults ? eErr / eToolResults : null,
    topTools: Object.entries(eToolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15),
  },
  topToolsAll: topTools,
  topFails,
  longSessions: long
    .sort((a, b) => b.durationMin - a.durationMin)
    .map((s) => ({
      file: s.file,
      durationMin: s.durationMin,
      toolCalls: s.toolCalls,
      allowN: s.allowN,
      editMissN: s.editMissN,
      errN: s.errN,
      hasOutcomeReview: s.hasOutcomeReview,
      hasMidFlight: s.hasMidFlight,
      hasCompaction: s.hasCompaction,
      firstTs: s.firstTs,
      lastTs: s.lastTs,
      topTools: Object.entries(s.toolsHere)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    })),
  postP0: {
    count: postP0.length,
    sessions: postP0.map((s) => ({
      file: s.file,
      toolCalls: s.toolCalls,
      allowN: s.allowN,
      editMissN: s.editMissN,
      durationMin: s.durationMin,
      lastTs: s.lastTs,
      firstTs: s.firstTs,
    })),
    allowSum: postP0.reduce((a, s) => a + s.allowN, 0),
    editMissSum: postP0.reduce((a, s) => a + s.editMissN, 0),
    toolSum: postP0.reduce((a, s) => a + s.toolCalls, 0),
  },
  frictionLeaders: eligible
    .filter((s) => s.allowN + s.editMissN + s.errN > 0)
    .sort((a, b) => b.allowN + b.editMissN + b.errN - (a.allowN + a.editMissN + a.errN))
    .slice(0, 12)
    .map((s) => ({
      file: s.file,
      durationMin: s.durationMin,
      toolCalls: s.toolCalls,
      allowN: s.allowN,
      editMissN: s.editMissN,
      errN: s.errN,
      lastTs: s.lastTs,
    })),
  sampleEligible: eligible
    .sort((a, b) => Date.parse(b.lastTs || 0) - Date.parse(a.lastTs || 0))
    .slice(0, 25)
    .map((s) => ({
      file: s.file,
      durationMin: s.durationMin,
      toolCalls: s.toolCalls,
      allowN: s.allowN,
      editMissN: s.editMissN,
      lines: s.lines,
      lastTs: s.lastTs,
    })),
};

fs.writeFileSync(
  "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z/_parse_out.json",
  JSON.stringify(out, null, 2)
);
console.log(
  JSON.stringify(
    {
      eligibleCount: out.eligibleCount,
      withToolsCount: out.withToolsCount,
      zeroToolEligible: out.zeroToolEligible,
      eligibleTotals: out.eligibleTotals,
      totalsAllFiles: out.totalsAllFiles,
      longSessions: out.longSessions,
      postP0: out.postP0,
      topFails: out.topFails,
      frictionLeaders: out.frictionLeaders,
    },
    null,
    2
  )
);
