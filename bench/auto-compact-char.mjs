#!/usr/bin/env node
/**
 * Iter 13 — auto-compaction characterization (observe only; no knob unlock).
 *
 * 1) Offline: shouldCompact thresholds for locked vs default settings across
 *    known context windows (imports pi-coding-agent compaction.js).
 * 2) Optional live: grow session via RPC bash chunks and report gap to trigger
 *    (no LLM compact unless --compact).
 *
 * Usage:
 *   node bench/auto-compact-char.mjs
 *   node bench/auto-compact-char.mjs --live --chunks 8 --chunk-bytes 8000
 *   node bench/auto-compact-char.mjs --json
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

function loadShouldCompact() {
  const candidates = [
    path.join(
      os.homedir(),
      ".pi/agent/npm/node_modules/@mariozechner/pi-coding-agent/dist/core/compaction/compaction.js",
    ),
    path.join(
      ROOT,
      "node_modules/@mariozechner/pi-coding-agent/dist/core/compaction/compaction.js",
    ),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const mod = require(p);
      return {
        path: p,
        shouldCompact: mod.shouldCompact,
        DEFAULT_COMPACTION_SETTINGS: mod.DEFAULT_COMPACTION_SETTINGS,
        findCutPoint: mod.findCutPoint,
      };
    }
  }
  throw new Error("pi-coding-agent compaction.js not found");
}

function readLockedSettings() {
  const candidates = [
    path.join(os.homedir(), ".pi/agent/settings.json"),
    path.join(ROOT, "settings.json"),
  ];
  for (const p of candidates) {
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      if (j.compaction) {
        return {
          path: p,
          enabled: j.compaction.enabled !== false,
          reserveTokens: j.compaction.reserveTokens ?? null,
          keepRecentTokens: j.compaction.keepRecentTokens ?? null,
        };
      }
    } catch {
      /* next */
    }
  }
  return { path: null, enabled: true, reserveTokens: null, keepRecentTokens: null };
}

function readModelWindows() {
  const p = path.join(os.homedir(), ".pi/agent/models.json");
  const out = [];
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    for (const [prov, cfg] of Object.entries(j.providers || {})) {
      for (const m of cfg.models || []) {
        if (/glm-5|grok-4|claude|gpt-5|gemini/i.test(m.id || m.name || "")) {
          out.push({
            provider: prov,
            id: m.id,
            contextWindow: m.contextWindow,
            maxTokens: m.maxTokens,
          });
        }
      }
    }
  } catch (e) {
    out.push({ error: String(e.message || e) });
  }
  // always include common windows
  return out;
}

function parseArgs(argv) {
  const out = {
    live: false,
    compact: false,
    json: false,
    chunks: Number(process.env.PI_COMPACT_CHUNKS || 8),
    chunkBytes: Number(process.env.PI_COMPACT_CHUNK_BYTES || 8000),
    timeoutMs: Number(process.env.PI_COMPACT_TIMEOUT_MS || 180000),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--live") out.live = true;
    else if (a === "--compact") out.compact = true;
    else if (a === "--json") out.json = true;
    else if (a === "--chunks" && argv[i + 1]) out.chunks = Number(argv[++i]);
    else if (a === "--chunk-bytes" && argv[i + 1]) out.chunkBytes = Number(argv[++i]);
  }
  return out;
}

function thresholdTable(shouldCompact, locked, defaults) {
  const windows = [32000, 64000, 128000, 200000, 256000, 524288, 1000000];
  const reserves = [
    { label: "locked", reserve: locked.reserveTokens ?? 24000, keep: locked.keepRecentTokens ?? 20000 },
    { label: "upstream_default", reserve: defaults.reserveTokens, keep: defaults.keepRecentTokens },
    { label: "hypo_reserve_32k", reserve: 32000, keep: locked.keepRecentTokens ?? 20000 },
    { label: "hypo_reserve_8k", reserve: 8000, keep: locked.keepRecentTokens ?? 20000 },
  ];
  const rows = [];
  for (const w of windows) {
    for (const r of reserves) {
      const settings = { enabled: true, reserveTokens: r.reserve, keepRecentTokens: r.keep };
      const triggerAbove = w - r.reserve;
      const fireAt = triggerAbove + 1;
      const noFireAt = triggerAbove;
      rows.push({
        contextWindow: w,
        profile: r.label,
        reserveTokens: r.reserve,
        keepRecentTokens: r.keep,
        triggerWhenTokensGt: triggerAbove,
        pctOfWindow: Number(((triggerAbove / w) * 100).toFixed(2)),
        shouldCompact_at_trigger: shouldCompact(fireAt, w, settings),
        shouldCompact_at_eq: shouldCompact(noFireAt, w, settings),
        deltaVsLockedReserve:
          r.label === "locked" ? 0 : (locked.reserveTokens ?? 24000) - r.reserve,
        triggerShiftVsLocked: r.label === "locked" ? 0 : r.reserve - (locked.reserveTokens ?? 24000),
      });
    }
  }
  return rows;
}

function cutPointDemo(findCutPoint, keepRecentTokens) {
  // Synthetic entries with known token weights via content length (~chars/4)
  // findCutPoint expects session entries; build minimal message entries.
  const mk = (id, chars) => ({
    type: "message",
    id,
    timestamp: new Date().toISOString(),
    message: { role: "user", content: "x".repeat(chars), timestamp: Date.now() },
  });
  // 10 turns × ~4k tokens each (16k chars) = ~40k tokens total
  const entries = [];
  for (let i = 0; i < 10; i++) {
    entries.push(mk(`u${i}`, 16000)); // ~4000 tok
    entries.push({
      type: "message",
      id: `a${i}`,
      timestamp: new Date().toISOString(),
      message: {
        role: "assistant",
        content: [{ type: "text", text: "y".repeat(4000) }], // ~1000 tok
        timestamp: Date.now(),
        stopReason: "stop",
      },
    });
  }
  const cut = findCutPoint(entries, 0, entries.length - 1, keepRecentTokens);
  const firstKept =
    cut == null
      ? 0
      : typeof cut === "number"
        ? cut
        : (cut.firstKeptEntryIndex ?? cut.turnStartIndex ?? 0);
  return {
    entryCount: entries.length,
    keepRecentTokens,
    cutPoint: cut,
    firstKeptEntryIndex: firstKept,
    keptEntries: entries.length - firstKept,
    note: "findCutPoint walks backward accumulating estimateTokens until >= keepRecentTokens; returns {firstKeptEntryIndex,turnStartIndex,isSplitTurn}",
  };
}

// --- minimal RPC client for optional live leg ---
class PiRpc {
  constructor(cwd) {
    this.cwd = cwd;
    this.proc = null;
    this.rl = null;
    this.pending = new Map();
    this.events = [];
    this.id = 0;
  }
  start() {
    this.proc = spawn("pi", ["--mode", "rpc", "--no-session"], {
      cwd: this.cwd,
      env: { ...process.env, PI_PRUNE: process.env.PI_PRUNE || "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.rl = createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this._onLine(line));
    this.proc.stderr.on("data", (d) => {
      if (process.env.PI_COMPACT_DEBUG) process.stderr.write(d);
    });
    return this.request({ type: "get_info" }, 30000);
  }
  _onLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.type === "response" && msg.id != null && this.pending.has(msg.id)) {
      const { resolve } = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      resolve(msg);
      return;
    }
    this.events.push(msg);
    if (
      msg.type === "compaction_start" ||
      msg.type === "compaction_end" ||
      msg.event === "compaction_start" ||
      msg.event === "compaction_end"
    ) {
      this.events.push({ _flag: "compaction", msg });
    }
  }
  request(payload, timeoutMs = 60000) {
    const id = ++this.id;
    const body = { ...payload, id };
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout ${payload.type}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (msg) => {
          clearTimeout(t);
          resolve(msg);
        },
      });
      this.proc.stdin.write(JSON.stringify(body) + "\n");
    });
  }
  bash(command, timeoutMs = 30000) {
    return this.request({ type: "bash", command }, timeoutMs);
  }
  async stats() {
    const r = await this.request({ type: "get_session_stats" });
    return r.data || r.result || r;
  }
  async close() {
    try {
      await this.request({ type: "quit" }, 5000);
    } catch {
      /* ignore */
    }
    try {
      this.proc.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

function extractContextTokens(stats) {
  return (
    stats?.contextUsage?.tokens ??
    stats?.contextUsage?.contextTokens ??
    stats?.tokens?.context ??
    stats?.contextTokens ??
    null
  );
}

async function liveGrow(args, locked, modelWindow) {
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "pi-autocompact-"));
  const big = path.join(ws, "payload.txt");
  const line = "AUTOCOMPACT_PROBE " + "z".repeat(120) + "\n";
  fs.writeFileSync(big, line.repeat(Math.ceil(args.chunkBytes / line.length)));
  const rpc = new PiRpc(ws);
  const report = {
    ok: false,
    chunks: args.chunks,
    chunkBytes: args.chunkBytes,
    modelWindowAssumed: modelWindow,
    locked,
    before: null,
    after_grow: null,
    context_tokens: {},
    gap_to_trigger: null,
    compaction_events: [],
    errors: [],
  };
  try {
    await rpc.start();
    try {
      report.before = await rpc.stats();
    } catch (e) {
      report.errors.push(`stats_before: ${e.message}`);
    }
    for (let i = 0; i < args.chunks; i++) {
      const cmd = `echo "CHUNK ${i}" && head -c ${args.chunkBytes} payload.txt`;
      try {
        await rpc.bash(cmd, 20000);
      } catch (e) {
        report.errors.push(`bash_${i}: ${e.message}`);
      }
    }
    try {
      report.after_grow = await rpc.stats();
    } catch (e) {
      report.errors.push(`stats_after_grow: ${e.message}`);
    }
    const growTok = extractContextTokens(report.after_grow);
    const beforeTok = extractContextTokens(report.before);
    report.context_tokens = { before: beforeTok, after_grow: growTok };
    if (growTok != null && modelWindow != null && locked.reserveTokens != null) {
      const triggerAbove = modelWindow - locked.reserveTokens;
      report.gap_to_trigger = {
        triggerWhenTokensGt: triggerAbove,
        contextTokens: growTok,
        tokensUntilTrigger: triggerAbove - growTok,
        wouldFire: growTok > triggerAbove,
        note: "Auto-compact only runs after assistant turns with usage; bash-only grow may under-count vs real chat.",
      };
    }
    report.compaction_events = rpc.events.filter(
      (e) =>
        e?._flag === "compaction" ||
        e?.type === "compaction_start" ||
        e?.type === "compaction_end",
    );
    report.ok = report.errors.length === 0 && report.after_grow != null;
  } finally {
    await rpc.close().catch(() => {});
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
  return report;
}

async function main() {
  const args = parseArgs(process.argv);
  const { path: compactPath, shouldCompact, DEFAULT_COMPACTION_SETTINGS, findCutPoint } =
    loadShouldCompact();
  const locked = readLockedSettings();
  const models = readModelWindows();
  const rows = thresholdTable(shouldCompact, locked, DEFAULT_COMPACTION_SETTINGS);

  // Primary stack: Venice deepseek-v4-flash-0731 (1M ctx)
  const primary = models.find((m) => m.provider === "Venice" && /deepseek-v4-flash-0731/i.test(m.id));
  const primaryWindow = primary?.contextWindow ?? 1000000;

  const lockedRow = rows.find(
    (r) => r.profile === "locked" && r.contextWindow === primaryWindow,
  );
  const defaultRow = rows.find(
    (r) => r.profile === "upstream_default" && r.contextWindow === primaryWindow,
  );

  const cut = cutPointDemo(findCutPoint, locked.keepRecentTokens ?? 20000);

  let live = null;
  if (args.live) {
    live = await liveGrow(args, locked, primaryWindow);
  }

  const report = {
    ok: true,
    kind: "auto-compact-characterization",
    compactSource: compactPath,
    formula: "shouldCompact = enabled && contextTokens > contextWindow - reserveTokens",
    locked,
    defaults: DEFAULT_COMPACTION_SETTINGS,
    modelsOfInterest: models.filter((m) => /glm-5|grok-4/i.test(m.id || "")),
    primary: {
      model: primary || { id: "deepseek-v4-flash-0731", contextWindow: primaryWindow, assumed: true },
      locked_trigger_gt: lockedRow?.triggerWhenTokensGt ?? null,
      default_trigger_gt: defaultRow?.triggerWhenTokensGt ?? null,
      trigger_shift_tokens:
        lockedRow && defaultRow
          ? lockedRow.triggerWhenTokensGt - defaultRow.triggerWhenTokensGt
          : null,
      interpretation:
        "On ~524k context windows, reserveTokens 16k→24k only moves the auto-compact trigger by 8k tokens (~1.5% of window). Auto-compact is effectively dormant for normal sessions; KEEP/pruner/TSCG dominate day-to-day pressure.",
    },
    keepRecentNote:
      "keepRecentTokens does not affect shouldCompact. It only sizes the retained tail via findCutPoint when compaction actually runs.",
    cutPointDemo: cut,
    thresholdRows: rows.filter(
      (r) =>
        r.contextWindow === primaryWindow ||
        r.contextWindow === 128000 ||
        r.contextWindow === 1000000,
    ),
    allThresholdRows: rows,
    live,
    verdict: {
      unlock_reserve_recommended: false,
      unlock_keepRecent_recommended: false,
      reason:
        "Trigger is so high on glm-5.2-class 1M windows that locked 24k vs default 16k is noise-level for auto-fire. No HIL unlock without a smaller-window model or measured OOM/truncation evidence.",
    },
  };

  // sanity: formula self-check
  const s = { enabled: true, reserveTokens: 24000, keepRecentTokens: 20000 };
  if (
    shouldCompact(500288, 524288, s) !== false ||
    shouldCompact(500289, 524288, s) !== true
  ) {
    report.ok = false;
    report.formula_self_check = "FAIL";
  } else {
    report.formula_self_check = "PASS";
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("=== auto-compact characterization ===");
    console.log(`source: ${compactPath}`);
    console.log(`formula: ${report.formula}`);
    console.log(
      `locked: reserve=${locked.reserveTokens} keepRecent=${locked.keepRecentTokens} (${locked.path})`,
    );
    console.log(
      `primary window: ${primaryWindow} → trigger when tokens > ${report.primary.locked_trigger_gt}`,
    );
    console.log(
      `vs upstream default reserve: trigger shift ${report.primary.trigger_shift_tokens} tokens`,
    );
    console.log(`formula self-check: ${report.formula_self_check}`);
    console.log(`keepRecent: ${report.keepRecentNote}`);
    console.log(`cutPointDemo: ${JSON.stringify(cut)}`);
    console.log(`verdict: unlock? reserve=${report.verdict.unlock_reserve_recommended} keepRecent=${report.verdict.unlock_keepRecent_recommended}`);
    console.log(report.verdict.reason);
    if (live) {
      console.log(`live grow: tokens=${JSON.stringify(live.context_tokens)} gap=${JSON.stringify(live.gap_to_trigger)}`);
      console.log(`live ok=${live.ok} errors=${live.errors.join("; ") || "none"}`);
    } else {
      console.log("live: skipped (pass --live)");
    }
    console.log(`ok: ${report.ok ? "PASS" : "FAIL"}`);
  }

  // Always write artifact
  const outDir = path.join(ROOT, ".scratch/bench-results");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "iter13-auto-compact-char.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
  if (!args.json) console.log(`wrote ${outPath}`);

  process.exit(report.ok && (!live || live.ok) ? 0 : 1);
}

main().catch((e) => {
  console.error("auto-compact-char fatal:", e);
  process.exit(2);
});
