#!/usr/bin/env node
// validate-ctx-canary.mjs — PASS iff a capture dir shows the agent actually
// invoking all required context-mode tools (not merely being offered them).
//
// Usage: node bench/validate-ctx-canary.mjs <capture-dir>
//
// Scans every capture JSON:
//   - response SSE stream: choices[].delta.tool_calls[].function.name
//   - non-stream responses: choices[].message.tool_calls[].function.name
//   - later-round requests: assistant messages' tool_calls (replayed history)
// Tool *definitions* in request.body.tools are deliberately ignored (they are
// always present and would false-positive).

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED = ["ctx_ls", "ctx_find", "ctx_read", "ctx_grep", "ctx_index", "ctx_search"];

const dir = process.argv[2];
if (!dir) {
  console.error("usage: validate-ctx-canary.mjs <capture-dir>");
  process.exit(2);
}

const found = new Set();
const add = (name) => {
  if (typeof name === "string" && name.startsWith("ctx_")) found.add(name);
};

function walkSse(raw) {
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") continue;
    let obj;
    try {
      obj = JSON.parse(payload);
    } catch {
      continue;
    }
    for (const ch of obj.choices ?? []) {
      for (const tc of ch.delta?.tool_calls ?? []) add(tc?.function?.name);
      for (const tc of ch.message?.tool_calls ?? []) add(tc?.function?.name);
    }
  }
}

function walkMessage(m) {
  if (m?.role !== "assistant") return;
  for (const tc of m.tool_calls ?? []) add(tc?.function?.name);
  if (Array.isArray(m.content)) {
    for (const block of m.content) {
      if (block?.type === "toolCall" || block?.type === "tool_call") add(block.name ?? block.function?.name);
    }
  }
}

let files;
try {
  files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
} catch (err) {
  console.error(`[ctx-canary] cannot read capture dir ${dir}: ${err.message}`);
  process.exit(2);
}

for (const f of files) {
  let cap;
  try {
    cap = JSON.parse(readFileSync(join(dir, f), "utf8"));
  } catch {
    continue;
  }
  const respBody = cap.response?.body;
  if (typeof respBody?.raw === "string") walkSse(respBody.raw);
  if (Array.isArray(respBody?.choices)) {
    for (const ch of respBody.choices) for (const tc of ch.message?.tool_calls ?? []) add(tc?.function?.name);
  }
  for (const m of cap.request?.body?.messages ?? []) walkMessage(m);
}

const missing = REQUIRED.filter((t) => !found.has(t));
const usedRequired = REQUIRED.filter((t) => found.has(t));
console.log(`[ctx-canary] captures scanned: ${files.length}`);
console.log(`[ctx-canary] ctx tools invoked: ${[...found].sort().join(", ") || "(none)"}`);
if (missing.length === 0) {
  console.log(`[ctx-canary] PASS — all ${REQUIRED.length} required tools exercised`);
  process.exit(0);
}
console.log(`[ctx-canary] FAIL — required missing: ${missing.join(", ")} (exercised ${usedRequired.length}/${REQUIRED.length})`);
process.exit(1);
