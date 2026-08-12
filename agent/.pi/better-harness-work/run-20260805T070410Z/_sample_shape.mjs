import fs from "fs";
import path from "path";

const sessionsDir = "/home/alex/.pi/agent/sessions";
// use the post-P0 long session and one known candidate if possible
const targets = [
  "--home-alex-.pi-agent--/2026-08-04T20-56-07-280Z_019fce8f-ef70-7bad-b8ba-79dd0e88354e.jsonl",
];

// also pick first few jsonl under agent
function walk(dir, acc = [], limit = 20) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (acc.length >= limit) return acc;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc, limit);
    else if (ent.name.endsWith(".jsonl")) acc.push(p);
  }
  return acc;
}

const files = [
  ...targets.map((t) => path.join(sessionsDir, t)).filter(fs.existsSync),
  ...walk(path.join(sessionsDir, "--home-alex-.pi-agent--"), [], 5),
];

const shapes = [];
for (const f of files.slice(0, 3)) {
  const lines = fs.readFileSync(f, "utf8").split("\n").filter(Boolean);
  const typeCounts = Object.create(null);
  const samples = [];
  for (let i = 0; i < lines.length; i++) {
    let ev;
    try {
      ev = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const t = ev.type || ev.role || "unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    // capture diverse samples
    if (samples.length < 40) {
      const msg = ev.message || {};
      const content = msg.content;
      let contentTypes = null;
      if (Array.isArray(content)) {
        contentTypes = content.map((b) =>
          b && typeof b === "object"
            ? {
                type: b.type,
                name: b.name || b.toolName,
                keys: Object.keys(b).slice(0, 12),
                isError: b.isError,
                hasText: typeof b.text === "string" || typeof b.content === "string",
                textHead:
                  typeof b.content === "string"
                    ? b.content.slice(0, 100)
                    : typeof b.text === "string"
                      ? b.text.slice(0, 100)
                      : Array.isArray(b.content)
                        ? "array"
                        : null,
              }
            : typeof b
        );
      }
      // only keep interesting
      if (
        t === "message" ||
        t === "tool" ||
        t === "toolResult" ||
        t === "compaction" ||
        /tool/i.test(t) ||
        (Array.isArray(content) && content.some((b) => b && /tool/i.test(b.type || "")))
      ) {
        samples.push({
          i,
          type: t,
          role: msg.role || ev.role,
          topKeys: Object.keys(ev).slice(0, 15),
          msgKeys: Object.keys(msg).slice(0, 15),
          contentTypes,
        });
      }
    }
  }
  // find first toolResult-like
  let toolResultExample = null;
  let toolCallExample = null;
  let errorExample = null;
  for (const line of lines) {
    if (toolResultExample && toolCallExample && errorExample) break;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const s = JSON.stringify(ev);
    if (!toolCallExample && /"type":"toolCall"|"type":"tool_use"|"toolCall"/.test(s)) {
      toolCallExample = summarize(ev);
    }
    if (!toolResultExample && /"type":"toolResult"|"type":"tool_result"|"toolResult"/.test(s)) {
      toolResultExample = summarize(ev);
    }
    if (!errorExample && /"isError":true|allowlist|could not find/i.test(s)) {
      errorExample = summarize(ev, 1500);
    }
  }
  shapes.push({
    file: path.relative(sessionsDir, f),
    lines: lines.length,
    typeCounts,
    sampleCount: samples.length,
    samples: samples.slice(0, 12),
    toolCallExample,
    toolResultExample,
    errorExample,
  });
}

function summarize(ev, max = 800) {
  const s = JSON.stringify(ev);
  if (s.length <= max) return ev;
  // shallow
  const out = { type: ev.type, keys: Object.keys(ev) };
  if (ev.message) {
    out.message = {
      role: ev.message.role,
      keys: Object.keys(ev.message),
      content: Array.isArray(ev.message.content)
        ? ev.message.content.map((b) => {
            if (!b || typeof b !== "object") return b;
            const o = { type: b.type, name: b.name, keys: Object.keys(b) };
            for (const k of ["isError", "toolCallId", "id"]) if (k in b) o[k] = b[k];
            const text = b.content || b.text || b.output;
            if (typeof text === "string") o.textHead = text.slice(0, 200);
            else if (Array.isArray(text)) o.textType = "array len " + text.length;
            return o;
          })
        : typeof ev.message.content === "string"
          ? ev.message.content.slice(0, 200)
          : typeof ev.message.content,
    };
  }
  return out;
}

const outPath = "/home/alex/.pi/agent/.pi/better-harness-work/run-20260805T070410Z/_shape_out.json";
fs.writeFileSync(outPath, JSON.stringify(shapes, null, 2));
console.log("files", shapes.length, "bytes", fs.statSync(outPath).size);
for (const s of shapes) {
  console.log(
    "FILE",
    s.file,
    "lines",
    s.lines,
    "types",
    JSON.stringify(s.typeCounts),
    "hasTR",
    !!s.toolResultExample,
    "hasTC",
    !!s.toolCallExample,
    "hasErr",
    !!s.errorExample
  );
}
