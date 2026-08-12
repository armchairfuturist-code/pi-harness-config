import fs from "fs";
import path from "path";

const sessionsDir = "/home/alex/.pi/agent/sessions";
const WORK = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z";
const packet = JSON.parse(fs.readFileSync(path.join(WORK, "packet-session.json"), "utf8"));
const windowStart = Date.parse(packet.meta?.window?.start || "2026-07-05T00:00:00.000Z");
const windowEnd = Date.parse(packet.meta?.window?.end || packet.generatedAt || "2026-08-05T07:04:10.000Z");
const p0Fix = Date.parse("2026-08-05T06:56:00.000Z");

// agent primary cwd sessions folder
const primaryDir = path.join(sessionsDir, "--home-alex-.pi-agent--");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

function textFromContent(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => {
        if (typeof b === "string") return b;
        if (!b || typeof b !== "object") return "";
        if (typeof b.text === "string") return b.text;
        if (typeof b.content === "string") return b.content;
        return "";
      })
      .join("\n");
  }
  if (typeof content === "object" && typeof content.text === "string") return content.text;
  return String(content);
}

function classifyError(toolName, text, isError) {
  const t = text || "";
  const n = toolName || "";
  if (/not in the allowlist|Command not in allowlist|allowlist blocked|blocked by allowlist|is not allowlisted|not allowlisted|LEAN_CTX.*allowlist|shell allowlist|allowlist/i.test(t) && /block|not |denied|fail|error|allowlist/i.test(t)) {
    // more precise allowlist
    if (/allowlist/i.test(t)) return "allowlist";
  }
  if (/Could not find the exact text|could not find the exact text|old[_ ]string not found|string to replace not found|The old text must match exactly|oldText not found|could not find.*to replace/i.test(t)) {
    return "edit_miss";
  }
  if (/ENOENT|no such file|could not read|File not found|does not exist|Unable to read|path not found/i.test(t) && /read|cat|ctx_read|find|ls/i.test(n + t)) {
    return "read_miss";
  }
  if (/EACCES|permission denied|access denied/i.test(t)) return "permission";
  if (isError) return "other_error";
  return null;
}

const allFiles = walk(sessionsDir);
const primaryFiles = walk(primaryDir);

function parseFile(f) {
  const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  let firstTs = null;
  let lastTs = null;
  let cwd = null;
  let sessionId = path.basename(f).replace(/\.jsonl$/, "");
  let toolCalls = 0;
  let toolResults = 0;
  let errN = 0;
  let allowN = 0;
  let editMissN = 0;
  let readMissN = 0;
  let permN = 0;
  let otherErrN = 0;
  let editCalls = 0;
  let shellCalls = 0;
  let bashCalls = 0;
  let hasOutcomeReview = false;
  let hasMidFlight = false;
  let compactionN = 0;
  const tools = Object.create(null);
  const errByTool = Object.create(null);
  const failSamples = [];
  const models = new Set();
  let userMsgs = 0;
  let assistantMsgs = 0;
  let lastEditOld = null;
  let identicalEditRetry = 0;
  const editMissDetails = [];

  for (const line of lines) {
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = ev.timestamp || ev.message?.timestamp;
    const tms = typeof ts === "number" ? ts : ts ? Date.parse(ts) : NaN;
    // pi timestamps sometimes ms numbers wrong epoch - prefer ISO string on top-level
    let tIso = null;
    if (typeof ev.timestamp === "string") tIso = Date.parse(ev.timestamp);
    else if (typeof ev.timestamp === "number" && ev.timestamp > 1e12) tIso = ev.timestamp;
    else if (typeof ev.message?.timestamp === "string") tIso = Date.parse(ev.message.timestamp);
    if (tIso != null && !Number.isNaN(tIso)) {
      if (firstTs == null) firstTs = tIso;
      lastTs = tIso;
    }

    if (ev.type === "session") {
      if (ev.cwd) cwd = ev.cwd;
      if (ev.id) sessionId = ev.id;
    }
    if (ev.type === "compaction") compactionN++;

    if (ev.type !== "message") continue;
    const msg = ev.message || {};
    const role = msg.role;

    if (role === "user") {
      userMsgs++;
      continue;
    }

    if (role === "assistant") {
      assistantMsgs++;
      if (msg.model) models.add(msg.model);
      const content = msg.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (!b || typeof b !== "object") continue;
          if (b.type === "toolCall") {
            const name = b.name || "unknown";
            toolCalls++;
            tools[name] = (tools[name] || 0) + 1;
            if (name === "edit" || name === "Edit" || name === "ctx_edit") {
              editCalls++;
              const old =
                b.arguments?.oldText ||
                b.arguments?.old_string ||
                b.arguments?.edits?.[0]?.oldText ||
                null;
              if (old && lastEditOld === old) identicalEditRetry++;
              if (old) lastEditOld = old;
            }
            if (name === "ctx_shell" || name === "bash" || name === "Bash" || name === "shell") {
              shellCalls++;
              if (name === "bash" || name === "Bash") bashCalls++;
            }
          }
          if (b.type === "text" && typeof b.text === "string") {
            if (/mid-flight status|end checklist|Session hygiene checklist|done\/blocked/i.test(b.text)) {
              hasOutcomeReview = true;
              if (/mid-flight/i.test(b.text)) hasMidFlight = true;
            }
          }
        }
      }
      continue;
    }

    if (role === "toolResult") {
      toolResults++;
      const name = msg.toolName || msg.name || "unknown";
      const text = textFromContent(msg.content);
      const isError = msg.isError === true;
      if (isError) {
        errN++;
        errByTool[name] = (errByTool[name] || 0) + 1;
      }
      const cls = classifyError(name, text, isError);
      if (cls === "allowlist") {
        allowN++;
        if (failSamples.length < 8) failSamples.push({ cls, name, text: text.slice(0, 180) });
      } else if (cls === "edit_miss") {
        editMissN++;
        editMissDetails.push({ name, text: text.slice(0, 200), ts: ev.timestamp });
        if (failSamples.length < 8) failSamples.push({ cls, name, text: text.slice(0, 180) });
      } else if (cls === "read_miss") {
        readMissN++;
      } else if (cls === "permission") {
        permN++;
      } else if (cls === "other_error") {
        otherErrN++;
        if (failSamples.length < 12) failSamples.push({ cls, name, text: text.slice(0, 180) });
      }
      // non-isError allowlist mentions still count if blocked text
      if (!isError && /not in the allowlist|Command not in allowlist/i.test(text)) {
        allowN++;
      }
    }
  }

  const durationMin =
    firstTs != null && lastTs != null ? Math.round(((lastTs - firstTs) / 60000) * 10) / 10 : 0;
  const overlaps =
    firstTs != null && lastTs != null && firstTs <= windowEnd && lastTs >= windowStart;
  // "primary eligible" heuristic: under primary agent dir OR cwd is agent home
  const underPrimary = f.startsWith(primaryDir + path.sep) || f.startsWith(primaryDir);
  const agentCwd =
    cwd === "/home/alex/.pi/agent" ||
    cwd === "/home/alex/.pi" ||
    (cwd && cwd.includes("/.pi/agent"));

  return {
    file: path.relative(sessionsDir, f),
    sessionId,
    cwd,
    firstTs: firstTs != null ? new Date(firstTs).toISOString() : null,
    lastTs: lastTs != null ? new Date(lastTs).toISOString() : null,
    durationMin,
    toolCalls,
    toolResults,
    errN,
    allowN,
    editMissN,
    readMissN,
    permN,
    otherErrN,
    editCalls,
    shellCalls,
    bashCalls,
    hasOutcomeReview,
    hasMidFlight,
    compactionN,
    tools,
    errByTool,
    failSamples,
    editMissDetails: editMissDetails.slice(0, 5),
    models: [...models],
    userMsgs,
    assistantMsgs,
    identicalEditRetry,
    overlaps,
    underPrimary,
    agentCwd,
    afterP0: lastTs != null && lastTs >= p0Fix,
    lines: lines.length,
  };
}

const sessions = allFiles.map(parseFile);

// eligibility variants to match packet ~17-20
function scoreSet(label, filterFn) {
  const set = sessions.filter(filterFn);
  const withTools = set.filter((s) => s.toolCalls > 0);
  const long = set.filter((s) => s.durationMin >= 60);
  const sum = (k) => set.reduce((a, s) => a + s[k], 0);
  const toolMap = Object.create(null);
  for (const s of set) for (const [k, v] of Object.entries(s.tools)) toolMap[k] = (toolMap[k] || 0) + v;
  const errTool = Object.create(null);
  for (const s of set) for (const [k, v] of Object.entries(s.errByTool)) errTool[k] = (errTool[k] || 0) + v;
  return {
    label,
    n: set.length,
    withTools: withTools.length,
    long: long.length,
    longNoOutcome: long.filter((s) => !s.hasOutcomeReview).length,
    toolCalls: sum("toolCalls"),
    toolResults: sum("toolResults"),
    errN: sum("errN"),
    allowN: sum("allowN"),
    editMissN: sum("editMissN"),
    readMissN: sum("readMissN"),
    editCalls: sum("editCalls"),
    shellCalls: sum("shellCalls"),
    errorRate: sum("toolResults") ? sum("errN") / sum("toolResults") : null,
    topTools: Object.entries(toolMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    topErrTools: Object.entries(errTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12),
    longSessions: long
      .sort((a, b) => b.durationMin - a.durationMin)
      .map((s) => ({
        file: s.file,
        durationMin: s.durationMin,
        toolCalls: s.toolCalls,
        errN: s.errN,
        allowN: s.allowN,
        editMissN: s.editMissN,
        hasOutcomeReview: s.hasOutcomeReview,
        hasMidFlight: s.hasMidFlight,
        compactionN: s.compactionN,
        firstTs: s.firstTs,
        lastTs: s.lastTs,
        topTools: Object.entries(s.tools)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6),
      })),
    frictionLeaders: set
      .filter((s) => s.errN + s.allowN + s.editMissN > 0)
      .sort((a, b) => b.errN + b.allowN + b.editMissN - (a.errN + a.allowN + a.editMissN))
      .slice(0, 15)
      .map((s) => ({
        file: s.file,
        durationMin: s.durationMin,
        toolCalls: s.toolCalls,
        errN: s.errN,
        allowN: s.allowN,
        editMissN: s.editMissN,
        readMissN: s.readMissN,
        lastTs: s.lastTs,
        failSamples: s.failSamples.slice(0, 3),
      })),
    postP0: set
      .filter((s) => s.afterP0)
      .map((s) => ({
        file: s.file,
        toolCalls: s.toolCalls,
        errN: s.errN,
        allowN: s.allowN,
        editMissN: s.editMissN,
        durationMin: s.durationMin,
        lastTs: s.lastTs,
      })),
  };
}

const variants = [
  scoreSet("primary_dir_overlap", (s) => s.underPrimary && s.overlaps),
  scoreSet("primary_dir_tools_overlap", (s) => s.underPrimary && s.overlaps && s.toolCalls > 0),
  scoreSet("agent_cwd_overlap", (s) => s.agentCwd && s.overlaps),
  scoreSet("agent_cwd_tools", (s) => s.agentCwd && s.overlaps && s.toolCalls > 0),
  scoreSet("all_overlap_tools", (s) => s.overlaps && s.toolCalls > 0),
  scoreSet(
    "primary_or_cwd_tools",
    (s) => (s.underPrimary || s.agentCwd) && s.overlaps && s.toolCalls > 0
  ),
];

// match packet candidate refs by filename fragment
const candRefs = (packet.data.candidates || []).map((c) => c.ref);
const byFile = Object.fromEntries(sessions.map((s) => [s.file, s]));

// try match candidates
const candMatch = (packet.data.candidates || []).map((c) => {
  const id = (c.ref || "").replace(/^E\d+:?/, "").trim();
  const hit =
    sessions.find((s) => s.file.includes(c.ref) || s.sessionId.includes(c.ref)) ||
    sessions.find((s) => c.request?.summary && s.file.includes(c.ref)) ||
    null;
  // search by activity match
  return {
    ref: c.ref,
    packetToolCalls: c.activity?.toolCalls,
    packetFails: c.friction?.executionFailures,
    packetDenials: c.friction?.permissionDenials,
    packetEdits: c.changes?.edits,
    summary: (c.request?.summary || "").slice(0, 100),
  };
});

// gather allowlist samples across primary tools sessions
const primaryTools = sessions.filter((s) => s.underPrimary && s.overlaps && s.toolCalls > 0);
const allowSamples = [];
const editSamples = [];
for (const s of primaryTools) {
  for (const fs_ of s.failSamples) {
    if (fs_.cls === "allowlist" && allowSamples.length < 10) allowSamples.push({ file: s.file, ...fs_ });
    if (fs_.cls === "edit_miss" && editSamples.length < 10) editSamples.push({ file: s.file, ...fs_ });
  }
  for (const e of s.editMissDetails || []) {
    if (editSamples.length < 10) editSamples.push({ file: s.file, cls: "edit_miss", ...e });
  }
}

// identical edit retry total
const identicalRetry = primaryTools.reduce((a, s) => a + s.identicalEditRetry, 0);

const out = {
  windowStart: new Date(windowStart).toISOString(),
  windowEnd: new Date(windowEnd).toISOString(),
  totalFiles: allFiles.length,
  primaryFiles: primaryFiles.length,
  variants,
  candMatch,
  packetPop: packet.data.populationCoverage,
  packetObs: packet.data.observationCoverage,
  allowSamples,
  editSamples,
  identicalRetry,
  // detailed primary tools set
  primaryToolsDetail: primaryTools
    .sort((a, b) => b.errN - a.errN)
    .slice(0, 20)
    .map((s) => ({
      file: s.file,
      durationMin: s.durationMin,
      toolCalls: s.toolCalls,
      toolResults: s.toolResults,
      errN: s.errN,
      allowN: s.allowN,
      editMissN: s.editMissN,
      readMissN: s.readMissN,
      editCalls: s.editCalls,
      shellCalls: s.shellCalls,
      hasOutcomeReview: s.hasOutcomeReview,
      compactionN: s.compactionN,
      lastTs: s.lastTs,
      topTools: Object.entries(s.tools)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      topErr: Object.entries(s.errByTool)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
    })),
};

fs.writeFileSync(path.join(WORK, "_parse2_out.json"), JSON.stringify(out, null, 2));

// compact stdout
console.log(
  JSON.stringify(
    {
      variants: variants.map((v) => ({
        label: v.label,
        n: v.n,
        withTools: v.withTools,
        long: v.long,
        longNoOutcome: v.longNoOutcome,
        toolCalls: v.toolCalls,
        errN: v.errN,
        allowN: v.allowN,
        editMissN: v.editMissN,
        editCalls: v.editCalls,
        errorRate: v.errorRate,
        topTools: v.topTools.slice(0, 6),
        topErrTools: v.topErrTools.slice(0, 6),
        postP0: v.postP0,
        longSessions: v.longSessions.slice(0, 8),
      })),
      allowSamples: allowSamples.slice(0, 6),
      editSamples: editSamples.slice(0, 6),
      identicalRetry,
      packetPop: packet.data.populationCoverage,
    },
    null,
    2
  )
);
