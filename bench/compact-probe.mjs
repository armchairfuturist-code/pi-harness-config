#!/usr/bin/env node
/**
 * Compaction threshold probe — Iteration 9b.
 *
 * Drives `pi --mode rpc` to:
 *   1. Grow context with large bash outputs (no LLM)
 *   2. Snapshot get_session_stats.contextUsage
 *   3. Optionally run `compact` (LLM — gated by PI_COMPACT_PROBE=1)
 *   4. Snapshot again and report delta vs settings reserveTokens/keepRecentTokens
 *
 * Usage:
 *   node bench/compact-probe.mjs
 *   PI_COMPACT_PROBE=1 node bench/compact-probe.mjs --chunks 12 --chunk-bytes 8000
 *   node bench/compact-probe.mjs --json
 */

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = {
    chunks: Number(process.env.PI_COMPACT_CHUNKS || 10),
    chunkBytes: Number(process.env.PI_COMPACT_CHUNK_BYTES || 6000),
    doCompact: ["1", "true", "yes"].includes(
      String(process.env.PI_COMPACT_PROBE || "").toLowerCase(),
    ),
    json: false,
    timeoutMs: Number(process.env.PI_COMPACT_TIMEOUT_MS || 180000),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--compact") out.doCompact = true;
    else if (a === "--chunks" && argv[i + 1]) out.chunks = Number(argv[++i]);
    else if (a === "--chunk-bytes" && argv[i + 1])
      out.chunkBytes = Number(argv[++i]);
  }
  return out;
}

function readCompactionSettings() {
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
          reserveTokens: j.compaction.reserveTokens ?? null,
          keepRecentTokens: j.compaction.keepRecentTokens ?? null,
        };
      }
    } catch {
      /* next */
    }
  }
  return { path: null, reserveTokens: null, keepRecentTokens: null };
}

class PiRpc {
  constructor(cwd) {
    this.cwd = cwd;
    this.proc = null;
    this.rl = null;
    this.pending = new Map();
    this.bufEvents = [];
    this.id = 0;
    this.ready = null;
  }

  start() {
    const env = { ...process.env };
    // Keep pruner on; disable rot noise for probe
    env.PI_PRUNE = env.PI_PRUNE || "1";
    this.proc = spawn("pi", ["--mode", "rpc", "--no-session"], {
      cwd: this.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.rl = createInterface({ input: this.proc.stdout });
    this.rl.on("line", (line) => this._onLine(line));
    this.proc.stderr.on("data", (d) => {
      const s = d.toString();
      if (process.env.PI_COMPACT_DEBUG) process.stderr.write(s);
    });
    this.ready = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("rpc start timeout")), 30000);
      const onLine = (line) => {
        try {
          const msg = JSON.parse(line);
          if (msg.type === "response" && msg.command === "get_info" && msg.success) {
            clearTimeout(t);
            this.rl.off("line", early);
            resolve(msg.data || msg);
          }
        } catch {
          /* ignore */
        }
      };
      const early = (line) => onLine(line);
      // also resolve on first parseable hello-ish event
      this.proc.on("error", (e) => {
        clearTimeout(t);
        reject(e);
      });
      // kick get_info
      setTimeout(() => {
        this.request({ type: "get_info" })
          .then((r) => {
            clearTimeout(t);
            resolve(r);
          })
          .catch(reject);
      }, 200);
    });
    return this.ready;
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
    this.bufEvents.push(msg);
  }

  request(payload, timeoutMs = 60000) {
    const id = ++this.id;
    const body = { ...payload, id };
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`timeout waiting for ${payload.type}`));
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

  async bash(command, timeoutMs = 30000) {
    return this.request({ type: "bash", command }, timeoutMs);
  }

  async stats() {
    const r = await this.request({ type: "get_session_stats" });
    return r.data || r.result || r;
  }

  async compact(timeoutMs = 120000) {
    return this.request({ type: "compact" }, timeoutMs);
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

async function main() {
  const args = parseArgs(process.argv);
  const settings = readCompactionSettings();
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), "pi-compact-ws-"));
  // Pre-create a large fixture file the shell can cat
  const big = path.join(ws, "payload.txt");
  const line = "COMPACT_PROBE_LINE " + "y".repeat(120) + "\n";
  fs.writeFileSync(big, line.repeat(Math.ceil(args.chunkBytes / line.length)));

  const rpc = new PiRpc(ws);
  const report = {
    ok: false,
    llm_compact: args.doCompact,
    settings,
    chunks: args.chunks,
    chunkBytes: args.chunkBytes,
    before: null,
    after_grow: null,
    after_compact: null,
    errors: [],
  };

  try {
    await rpc.start();
    // baseline stats
    try {
      report.before = await rpc.stats();
    } catch (e) {
      report.errors.push(`stats_before: ${e.message}`);
    }

    for (let i = 0; i < args.chunks; i++) {
      // Each bash dumps the payload with a unique header so context accumulates
      const cmd = `echo "CHUNK ${i}" && wc -c payload.txt && head -c ${args.chunkBytes} payload.txt`;
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

    if (args.doCompact) {
      try {
        const c = await rpc.compact(args.timeoutMs);
        report.compact_response = {
          success: c.success,
          command: c.command,
          data: c.data || c.result || null,
          error: c.error || null,
        };
      } catch (e) {
        report.errors.push(`compact: ${e.message}`);
      }
      try {
        report.after_compact = await rpc.stats();
      } catch (e) {
        report.errors.push(`stats_after_compact: ${e.message}`);
      }
    }

    // Derive context tokens if present
    const tok = (s) =>
      s?.contextUsage?.tokens ??
      s?.contextUsage?.contextTokens ??
      s?.tokens?.context ??
      null;
    const beforeTok = tok(report.before);
    const growTok = tok(report.after_grow);
    const compactTok = tok(report.after_compact);
    report.context_tokens = {
      before: beforeTok,
      after_grow: growTok,
      after_compact: compactTok,
    };
    report.reserve_gap =
      settings.reserveTokens != null && growTok != null
        ? settings.reserveTokens - growTok
        : null;
    report.ok =
      report.errors.length === 0 &&
      report.after_grow != null &&
      (!args.doCompact || report.compact_response?.success !== false);

    if (args.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log("=== compact probe ===");
      console.log(
        `settings: reserve=${settings.reserveTokens} keepRecent=${settings.keepRecentTokens} (${settings.path})`,
      );
      console.log(`grew ${args.chunks} x ~${args.chunkBytes}B bash chunks`);
      console.log(`context_tokens: ${JSON.stringify(report.context_tokens)}`);
      if (report.reserve_gap != null) {
        console.log(
          `reserve_gap: ${report.reserve_gap} (positive => still below reserveTokens)`,
        );
      }
      if (args.doCompact) {
        console.log(
          `compact: success=${report.compact_response?.success} data_keys=${Object.keys(report.compact_response?.data || {}).join(",")}`,
        );
      } else {
        console.log("compact: SKIPPED (set PI_COMPACT_PROBE=1 or --compact to run LLM compact)");
      }
      if (report.errors.length) {
        console.log("errors:", report.errors.join("; "));
      }
      console.log(`ok: ${report.ok ? "PASS" : "FAIL"}`);
    }
  } finally {
    await rpc.close().catch(() => {});
    try {
      fs.rmSync(ws, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  process.exit(report.ok ? 0 : 1);
}

main().catch((e) => {
  console.error("compact-probe fatal:", e);
  process.exit(2);
});
