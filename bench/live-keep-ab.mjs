#!/usr/bin/env node
/**
 * Live KEEP A/B — Iteration 9b (extension context-hook path, no LLM).
 *
 * Loads the deployed transcript-pruner extension via jiti, captures its
 * `context` handler, and fires it with the combined synthetic transcript
 * under each PI_PRUNE_KEEP value. Validates:
 *   - handler returns pruned messages
 *   - PI_PRUNE_STATE sink receives clear events
 *   - KEEP sweep is monotonic (higher keep → ≤ saved chars)
 *   - clear count decreases (or stays) as keep rises
 *
 * Usage:
 *   node bench/live-keep-ab.mjs
 *   node bench/live-keep-ab.mjs --keep 2,3,4,6 --json
 *   PI_PRUNE_EXT=/path/to/transcript-pruner.ts node bench/live-keep-ab.mjs
 */

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  scenarioCombined,
  DET_CWD,
} from "./workload-deterministic.mjs";
import {
  cloneMessages,
  estimateChars,
  summarizeChanged,
  textOf,
} from "../extensions/lib/prune-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_EXT =
  process.env.PI_PRUNE_EXT ||
  path.join(os.homedir(), ".pi/agent/extensions/transcript-pruner.ts");

function parseArgs(argv) {
  const out = { keep: [2, 3, 4, 6], json: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--keep" && argv[i + 1]) {
      out.keep = argv[++i]
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));
    } else if (a === "--ext" && argv[i + 1]) {
      out.ext = argv[++i];
    }
  }
  return out;
}

function loadJiti() {
  const require = createRequire(import.meta.url);
  const paths = [
    path.join(os.homedir(), ".pi/agent/npm/node_modules"),
    path.join(
      os.homedir(),
      ".pi/agent/npm/node_modules/@earendil-works/pi-coding-agent/node_modules",
    ),
  ];
  let jitiPath;
  try {
    jitiPath = require.resolve("jiti", { paths });
  } catch (e) {
    throw new Error(`jiti not found: ${e.message}`);
  }
  return require(jitiPath)(import.meta.url, {
    esmResolve: true,
    interopDefault: true,
  });
}

function loadContextHandler(extPath) {
  if (!fs.existsSync(extPath)) {
    throw new Error(`extension missing: ${extPath}`);
  }
  // Ensure sibling lib resolves for deployed layout
  const lib = path.join(path.dirname(extPath), "lib", "prune-core.mjs");
  if (!fs.existsSync(lib)) {
    throw new Error(`prune-core missing next to extension: ${lib}`);
  }
  const jiti = loadJiti();
  const mod = jiti(extPath);
  const def = mod.default || mod;
  if (typeof def !== "function") {
    throw new Error("extension default export is not a function");
  }
  let handler;
  const fakePi = {
    on(ev, fn) {
      if (ev === "context") handler = fn;
    },
  };
  def(fakePi);
  if (typeof handler !== "function") {
    throw new Error("extension did not register context handler");
  }
  return handler;
}

function readSink(sinkPath) {
  if (!fs.existsSync(sinkPath)) return [];
  return fs
    .readFileSync(sinkPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function sinkTallies(events) {
  const out = { clear: 0, dup: 0, stale: 0, bytes: 0 };
  for (const e of events) {
    const k = e.kind;
    if (k && k in out) out[k] += Number(e.count) || 1;
    out.bytes += Number(e.bytes) || 0;
  }
  return out;
}

function countPointerKinds(messages) {
  const kinds = { clear: 0, dup: 0, stale: 0 };
  for (const m of messages) {
    if (!m || m.role !== "toolResult") continue;
    const t = textOf(m.content);
    if (/^\[cleared:/.test(t)) kinds.clear++;
    else if (/^\[dup of earlier/.test(t)) kinds.dup++;
    else if (/^\[stale:/.test(t)) kinds.stale++;
  }
  return kinds;
}

async function runKeep(handler, keep, baseMessages) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-keep-ab-"));
  const sinkPath = path.join(tmpDir, "prune-state.jsonl");

  const prev = {
    PI_PRUNE: process.env.PI_PRUNE,
    PI_PRUNE_KEEP: process.env.PI_PRUNE_KEEP,
    PI_PRUNE_STATE: process.env.PI_PRUNE_STATE,
    PI_PRUNE_DEDUP: process.env.PI_PRUNE_DEDUP,
    PI_PRUNE_STALE: process.env.PI_PRUNE_STALE,
    PI_PRUNE_CLEAR: process.env.PI_PRUNE_CLEAR,
    PI_PRUNE_DEBUG: process.env.PI_PRUNE_DEBUG,
  };

  process.env.PI_PRUNE = "1";
  process.env.PI_PRUNE_KEEP = String(keep);
  process.env.PI_PRUNE_STATE = sinkPath;
  process.env.PI_PRUNE_DEDUP = "1";
  process.env.PI_PRUNE_STALE = "1";
  process.env.PI_PRUNE_CLEAR = "1";
  delete process.env.PI_PRUNE_DEBUG;

  try {
    const messages = cloneMessages(baseMessages);
    const before = estimateChars(messages);
    // Extension reads env at handler invoke time (flag/minLen/keepRecent are closures over env getters)
    const result = await handler({ messages }, { cwd: DET_CWD });
    const afterMsgs = result?.messages ?? messages;
    const after = estimateChars(afterMsgs);
    const pointerKinds = countPointerKinds(afterMsgs);
    const events = readSink(sinkPath);
    const sink = sinkTallies(events);

    return {
      keep,
      charsBefore: before,
      charsAfter: after,
      savedChars: before - after,
      savedTokensEst: Math.round((before - after) / 4),
      returned: Boolean(result?.messages),
      pointerKinds,
      sink,
      sinkEvents: events.length,
      ok:
        Boolean(result?.messages) &&
        after <= before &&
        pointerKinds.dup >= 1 &&
        pointerKinds.stale >= 1 &&
        (keep < 12 ? pointerKinds.clear >= 1 || sink.clear >= 1 : true),
    };
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(`Usage: node bench/live-keep-ab.mjs [--keep 2,3,4,6] [--ext path] [--json]`);
    process.exit(0);
  }
  const extPath = args.ext || DEFAULT_EXT;

  // Note: keepRecent is closed over env getters in the extension — they read
  // process.env on each call, so one handler instance works for all KEEP values.
  // BUT the extension was written with:
  //   const keepRecent = () => Number(process.env.PI_PRUNE_KEEP ?? 4)
  // called inside the handler — good.

  const handler = loadContextHandler(extPath);
  const base = scenarioCombined(3).messages; // shape only; KEEP comes from env

  const rows = [];
  for (const k of args.keep) {
    rows.push(await runKeep(handler, k, base));
  }

  // Monotonic: higher keep → ≤ savedChars
  const monoFails = [];
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].savedChars > rows[i - 1].savedChars + 2) {
      monoFails.push(
        `keep ${rows[i].keep} saved ${rows[i].savedChars} > keep ${rows[i - 1].keep} saved ${rows[i - 1].savedChars}`,
      );
    }
  }
  // clear counts non-increasing with keep
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].pointerKinds.clear;
    const b = rows[i].pointerKinds.clear;
    if (b > a) {
      monoFails.push(`clear count rose keep${rows[i - 1].keep}=${a} → keep${rows[i].keep}=${b}`);
    }
  }

  const allOk = rows.every((r) => r.ok) && monoFails.length === 0;
  // Recommendation: pick smallest keep that still leaves ≥1 clear path and
  // doesn't collapse stale/dup (all rows should keep those). Default stay 4
  // unless keep=3 saves ≥10% more with all paths green.
  const k4 = rows.find((r) => r.keep === 4);
  const k3 = rows.find((r) => r.keep === 3);
  let recommendation = "keep_default_4";
  let reason = "no compelling delta";
  if (k3?.ok && k4?.ok && k4.savedChars > 0) {
    const gain = (k3.savedChars - k4.savedChars) / k4.savedChars;
    if (gain >= 0.1) {
      recommendation = "consider_keep_3";
      reason = `keep3 saves ${(gain * 100).toFixed(1)}% more chars than keep4`;
    } else {
      recommendation = "keep_default_4";
      reason = `keep3 only ${(gain * 100).toFixed(1)}% better than keep4 (<10% bar)`;
    }
  }

  const report = {
    ok: allOk,
    live_extension_path: true,
    llm: false,
    ext: extPath,
    rows,
    monoOk: monoFails.length === 0,
    monoFails,
    recommendation,
    reason,
    gate: {
      all_rows_ok: rows.every((r) => r.ok),
      mono: monoFails.length === 0,
      sink_writes: rows.every((r) => r.sinkEvents > 0),
    },
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== live KEEP A/B (extension context handler) ===");
    console.log(`ext: ${extPath}`);
    for (const r of rows) {
      const flag = r.ok ? "PASS" : "FAIL";
      console.log(
        `[${flag}] keep=${r.keep}: saved=${r.savedChars}ch (~${r.savedTokensEst}tok) ` +
          `pointers=${JSON.stringify(r.pointerKinds)} sink=${JSON.stringify(r.sink)} returned=${r.returned}`,
      );
    }
    console.log(
      `mono: ${report.monoOk ? "PASS" : "FAIL"}${monoFails.length ? " " + monoFails.join("; ") : ""}`,
    );
    console.log(`recommend: ${recommendation} (${reason})`);
    console.log(
      `gate: rows=${report.gate.all_rows_ok} mono=${report.gate.mono} sink=${report.gate.sink_writes} => ${allOk ? "PASS" : "FAIL"}`,
    );
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("live-keep-ab fatal:", e);
  process.exit(2);
});
