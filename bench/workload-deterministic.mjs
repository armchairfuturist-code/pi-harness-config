#!/usr/bin/env node
/**
 * Deterministic fixed-turn prune workload (Iteration 9).
 *
 * Builds synthetic multi-turn transcripts that force CLEAR / DEDUP / STALE
 * paths through prune-core — no LLM, no pi process. Suitable for gating
 * PI_PRUNE_KEEP and verifying path coverage.
 *
 * Usage:
 *   node bench/workload-deterministic.mjs
 *   node bench/workload-deterministic.mjs --keep 2,3,4,6 --json
 *   node bench/workload-deterministic.mjs --scenario all --min-len 40
 *
 * Exit 0 iff every required path fires under default keep and the KEEP
 * sweep is monotonic (higher keep → ≤ savings).
 */

import { fileURLToPath } from "node:url";
import * as path from "node:path";
import {
  pruneMessages,
  cloneMessages,
  estimateChars,
  summarizeChanged,
  textOf,
} from "../extensions/lib/prune-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CWD = path.join(__dirname, "fixtures", "det-ws");

// ─── synthetic message builders ───────────────────────────────────────────

let _id = 0;
function tid(prefix = "tc") {
  _id += 1;
  return `${prefix}_${_id}`;
}

function user(text) {
  return { role: "user", content: text, timestamp: Date.now() };
}

function assistantTools(calls) {
  // calls: [{ id, name, args }]
  return {
    role: "assistant",
    content: calls.map((c) => ({
      type: "toolCall",
      id: c.id,
      name: c.name,
      arguments: c.args ?? {},
    })),
    timestamp: Date.now(),
  };
}

function toolResult(id, name, text, isError = false) {
  return {
    role: "toolResult",
    toolCallId: id,
    toolName: name,
    content: [{ type: "text", text }],
    isError,
    timestamp: Date.now(),
  };
}

/** Pad to guarantee minLen. */
function blob(label, n = 200) {
  const base = `CONTENT[${label}] `;
  return base + "x".repeat(Math.max(0, n - base.length));
}

// ─── scenarios ────────────────────────────────────────────────────────────

/**
 * DEDUP: same ctx_read of file A repeated 5× with identical bytes.
 * Expect: 4 dups (keep first).
 */
function scenarioDedup() {
  const msgs = [user("read a.txt five times")];
  const body = blob("a.txt-v1", 400);
  for (let i = 0; i < 5; i++) {
    const id = tid("dedup");
    msgs.push(
      assistantTools([{ id, name: "ctx_read", args: { path: "a.txt" } }]),
      toolResult(id, "ctx_read", body),
    );
  }
  return {
    name: "dedup",
    messages: msgs,
    expect: { dup: { min: 4 }, stale: { min: 0 }, clear: { min: 0 } },
    // disable clear so only dedup fires
    opts: { enableClear: false, enableStale: false, enableDedup: true },
  };
}

/**
 * Cross-tool DEDUP: ctx_read then ctx_shell cat of same path+bytes.
 * Expect: ≥1 dup via content-sig.
 */
function scenarioCrossToolDedup() {
  const msgs = [user("read via two tools")];
  const body = blob("b.txt-v1", 300);
  const id1 = tid("xdedup");
  const id2 = tid("xdedup");
  msgs.push(
    assistantTools([{ id: id1, name: "ctx_read", args: { path: "b.txt" } }]),
    toolResult(id1, "ctx_read", body),
    assistantTools([
      { id: id2, name: "ctx_shell", args: { command: "cat b.txt" } },
    ]),
    toolResult(id2, "ctx_shell", body),
  );
  return {
    name: "cross_tool_dedup",
    messages: msgs,
    expect: { dup: { min: 1 }, stale: { min: 0 }, clear: { min: 0 } },
    opts: { enableClear: false, enableStale: false, enableDedup: true },
  };
}

/**
 * STALE: read file, then ≥4 filler msgs, then edit, so lastWrite > i+3.
 * Expect: ≥1 stale.
 *
 * Layout (indices after build):
 *   0 user
 *   1 asst read, 2 result read          ← target (i=2)
 *   3-6 filler pairs (need write idx > 2+3=5)
 *   N asst edit, N+1 result edit
 */
function scenarioStale() {
  const msgs = [user("read then edit after gap")];
  const body = blob("c.txt-v1", 350);
  const idR = tid("stale_r");
  msgs.push(
    assistantTools([{ id: idR, name: "ctx_read", args: { path: "c.txt" } }]),
    toolResult(idR, "ctx_read", body),
  );
  // Filler turns so write index is far enough past the read result
  for (let i = 0; i < 4; i++) {
    const id = tid("fill");
    msgs.push(
      assistantTools([
        { id, name: "ctx_read", args: { path: `filler_${i}.txt` } },
      ]),
      toolResult(id, "ctx_read", blob(`filler_${i}`, 80)),
    );
  }
  const idW = tid("stale_w");
  msgs.push(
    assistantTools([
      {
        id: idW,
        name: "edit",
        args: { path: "c.txt", oldText: "v1", newText: "v2" },
      },
    ]),
    toolResult(idW, "edit", "edited c.txt"),
  );
  return {
    name: "stale",
    messages: msgs,
    expect: { stale: { min: 1 }, dup: { min: 0 }, clear: { min: 0 } },
    opts: { enableClear: false, enableStale: true, enableDedup: false },
  };
}

/**
 * CLEAR: 12 unique large tool results, keep=K → drop 12-K.
 * Expect: clear count == max(0, 12-K).
 */
function scenarioClear(keep = 4) {
  const msgs = [user("twelve unique reads")];
  for (let i = 0; i < 12; i++) {
    const id = tid("clr");
    msgs.push(
      assistantTools([
        { id, name: "ctx_read", args: { path: `u${i}.txt` } },
      ]),
      toolResult(id, "ctx_read", blob(`unique-${i}`, 250)),
    );
  }
  return {
    name: "clear",
    messages: msgs,
    expect: {
      clear: { min: Math.max(0, 12 - keep), max: Math.max(0, 12 - keep) },
      dup: { min: 0 },
      stale: { min: 0 },
    },
    opts: {
      enableClear: true,
      enableStale: false,
      enableDedup: false,
      keepRecent: keep,
    },
  };
}

/**
 * Combined multi-turn: exercises all three paths in one transcript.
 * - 5× identical read of a.txt (dedup)
 * - read c.txt, fillers, edit c.txt (stale)
 * - 8 unique large reads (clear under keep=3)
 */
function scenarioCombined(keep = 3) {
  const msgs = [user("combined fixed-turn workload")];

  // Phase 1: dedup fodder
  const bodyA = blob("a.txt-combined", 400);
  for (let i = 0; i < 5; i++) {
    const id = tid("c_dedup");
    msgs.push(
      assistantTools([{ id, name: "ctx_read", args: { path: "a.txt" } }]),
      toolResult(id, "ctx_read", bodyA),
    );
  }

  // Phase 2: stale fodder
  const bodyC = blob("c.txt-combined", 350);
  const idR = tid("c_stale_r");
  msgs.push(
    assistantTools([{ id: idR, name: "ctx_read", args: { path: "c.txt" } }]),
    toolResult(idR, "ctx_read", bodyC),
  );
  for (let i = 0; i < 4; i++) {
    const id = tid("c_fill");
    msgs.push(
      assistantTools([
        { id, name: "ctx_read", args: { path: `cf_${i}.txt` } },
      ]),
      toolResult(id, "ctx_read", blob(`cf_${i}`, 100)),
    );
  }
  const idW = tid("c_stale_w");
  msgs.push(
    assistantTools([
      {
        id: idW,
        name: "edit",
        args: { path: "c.txt", oldText: "v1", newText: "v2" },
      },
    ]),
    toolResult(idW, "edit", "ok"),
  );

  // Phase 3: unique reads for clear
  for (let i = 0; i < 8; i++) {
    const id = tid("c_clr");
    msgs.push(
      assistantTools([
        { id, name: "ctx_read", args: { path: `uniq_${i}.txt` } },
      ]),
      toolResult(id, "ctx_read", blob(`uniq-${i}`, 280)),
    );
  }

  return {
    name: "combined",
    messages: msgs,
    expect: {
      dup: { min: 1 },
      stale: { min: 1 },
      clear: { min: 1 },
    },
    opts: {
      enableClear: true,
      enableStale: true,
      enableDedup: true,
      keepRecent: keep,
    },
  };
}

const SCENARIOS = {
  dedup: scenarioDedup,
  cross_tool_dedup: scenarioCrossToolDedup,
  stale: scenarioStale,
  clear: () => scenarioClear(4),
  combined: () => scenarioCombined(3),
};

// ─── runner ───────────────────────────────────────────────────────────────

function checkExpect(kinds, expect) {
  const fails = [];
  for (const kind of ["dup", "stale", "clear"]) {
    const e = expect[kind];
    if (!e) continue;
    const n = kinds[kind] || 0;
    if (e.min !== undefined && n < e.min) {
      fails.push(`${kind}: got ${n} < min ${e.min}`);
    }
    if (e.max !== undefined && n > e.max) {
      fails.push(`${kind}: got ${n} > max ${e.max}`);
    }
  }
  return fails;
}

function runScenario(factory, baseOpts = {}) {
  const sc = typeof factory === "function" ? factory() : factory;
  const opts = {
    minLen: baseOpts.minLen ?? 40,
    keepRecent: sc.opts?.keepRecent ?? baseOpts.keepRecent ?? 4,
    enableDedup: sc.opts?.enableDedup ?? true,
    enableStale: sc.opts?.enableStale ?? true,
    enableClear: sc.opts?.enableClear ?? true,
    cwd: CWD,
  };
  const original = cloneMessages(sc.messages);
  const working = cloneMessages(sc.messages);
  const before = estimateChars(original);
  const result = pruneMessages(working, opts);
  const summary = summarizeChanged(result.changed);
  const fails = checkExpect(summary.kinds, sc.expect);

  // Invariant: pruned text never grows
  const after = result.charsAfter;
  if (after > before) fails.push(`chars grew ${before} → ${after}`);

  // Invariant: pointer replacements are short
  for (const c of result.changed) {
    const t = textOf(working[c.idx]?.content);
    if (t.length >= (opts.minLen || 40) && !/^\[(dup of earlier|stale:|cleared:)/.test(t)) {
      fails.push(`msg#${c.idx} kind=${c.kind} not pointer-replaced`);
    }
  }

  return {
    name: sc.name,
    ok: fails.length === 0,
    fails,
    charsBefore: before,
    charsAfter: after,
    savedChars: before - after,
    savedTokensEst: Math.round((before - after) / 4),
    kinds: summary.kinds,
    pruneCount: result.changed.length,
    msgCount: original.length,
    opts: {
      keepRecent: opts.keepRecent,
      enableDedup: opts.enableDedup,
      enableStale: opts.enableStale,
      enableClear: opts.enableClear,
    },
  };
}

function keepSweep(keeps, minLen) {
  const rows = [];
  for (const k of keeps) {
    const sc = scenarioCombined(k);
    // Force combined with all paths on
    sc.opts = {
      enableClear: true,
      enableStale: true,
      enableDedup: true,
      keepRecent: k,
    };
    // Loosen expect: only require monotonic measurement, not fixed counts
    sc.expect = { dup: { min: 1 }, stale: { min: 1 }, clear: { min: 0 } };
    const r = runScenario(sc, { minLen, keepRecent: k });
    rows.push({
      keep: k,
      savedChars: r.savedChars,
      savedTokensEst: r.savedTokensEst,
      charsBefore: r.charsBefore,
      charsAfter: r.charsAfter,
      kinds: r.kinds,
      ok: r.ok,
      fails: r.fails,
    });
  }

  // Monotonic: higher keep → savedChars should be ≤ previous (less aggressive)
  const monoFails = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].savedChars > rows[i - 1].savedChars + 2) {
      // allow 2-char noise from pointer label length differences
      monoFails.push(
        `keep ${rows[i].keep} saved ${rows[i].savedChars} > keep ${rows[i - 1].keep} saved ${rows[i - 1].savedChars}`,
      );
    }
  }
  return { rows, monoOk: monoFails.length === 0, monoFails };
}

function parseArgs(argv) {
  const out = {
    keep: [2, 3, 4, 6],
    scenario: "all",
    minLen: 40,
    json: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--keep" && argv[i + 1]) {
      out.keep = argv[++i].split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    } else if (a === "--scenario" && argv[i + 1]) {
      out.scenario = argv[++i];
    } else if (a === "--min-len" && argv[i + 1]) {
      out.minLen = Number(argv[++i]);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node bench/workload-deterministic.mjs [opts]
  --scenario all|dedup|cross_tool_dedup|stale|clear|combined
  --keep 2,3,4,6          KEEP sweep values (combined scenario)
  --min-len 40
  --json`);
    process.exit(0);
  }

  const names =
    args.scenario === "all"
      ? Object.keys(SCENARIOS)
      : [args.scenario];

  for (const n of names) {
    if (!SCENARIOS[n]) {
      console.error(`unknown scenario: ${n}`);
      process.exit(2);
    }
  }

  const results = names.map((n) => runScenario(SCENARIOS[n], { minLen: args.minLen }));
  const sweep = keepSweep(args.keep, args.minLen);

  const allOk = results.every((r) => r.ok) && sweep.monoOk && sweep.rows.every((r) => r.ok);

  const report = {
    ok: allOk,
    deterministic: true,
    root: ROOT,
    cwd: CWD,
    scenarios: results,
    keep_sweep: sweep,
    gate: {
      all_paths_fire:
        results.some((r) => r.name === "combined" && r.kinds.dup >= 1) &&
        results.some((r) => r.name === "combined" && r.kinds.stale >= 1) &&
        results.some((r) => r.name === "combined" && r.kinds.clear >= 1),
      mono_keep_sweep: sweep.monoOk,
      scenario_pass: results.every((r) => r.ok),
    },
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== deterministic prune workload ===");
    for (const r of results) {
      const flag = r.ok ? "PASS" : "FAIL";
      console.log(
        `[${flag}] ${r.name}: saved=${r.savedChars}ch (~${r.savedTokensEst}tok) kinds=${JSON.stringify(r.kinds)} msgs=${r.msgCount}`,
      );
      if (!r.ok) for (const f of r.fails) console.log(`       - ${f}`);
    }
    console.log("--- KEEP sweep (combined) ---");
    for (const row of sweep.rows) {
      console.log(
        `  keep=${row.keep}: saved=${row.savedChars}ch (~${row.savedTokensEst}tok) kinds=${JSON.stringify(row.kinds)}${row.ok ? "" : " FAIL " + row.fails.join(";")}`,
      );
    }
    console.log(
      `mono: ${sweep.monoOk ? "PASS" : "FAIL"}${sweep.monoFails.length ? " " + sweep.monoFails.join("; ") : ""}`,
    );
    console.log(
      `gate: paths=${report.gate.all_paths_fire} scenarios=${report.gate.scenario_pass} mono=${report.gate.mono_keep_sweep} => ${allOk ? "PASS" : "FAIL"}`,
    );
  }

  process.exit(allOk ? 0 : 1);
}

// Export builders for live-keep-ab / other harnesses
export {
  scenarioDedup,
  scenarioCrossToolDedup,
  scenarioStale,
  scenarioClear,
  scenarioCombined,
  SCENARIOS,
  runScenario,
  keepSweep,
  CWD as DET_CWD,
};

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) main();
