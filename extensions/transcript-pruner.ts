/**
 * transcript-pruner — context-event hook that pointer-replaces spent tool
 * results (DEDUP / STALE / CLEAR). Algorithm lives in lib/prune-core.mjs
 * so bench/workload-deterministic.mjs can gate KEEP without an LLM.
 *
 * Env:
 *   PI_PRUNE=0            master disable
 *   PI_PRUNE_DEDUP=0      disable exact+cross-tool dedup
 *   PI_PRUNE_STALE=0      disable stale-after-write
 *   PI_PRUNE_CLEAR=0      disable keep-N clear
 *   PI_PRUNE_KEEP=4       keep last N full tool results (CLEAR)
 *   PI_PRUNE_MIN_LEN=40   min chars to consider a result "full"
 *   PI_PRUNE_DEBUG=1      stderr diagnostics
 *   PI_PRUNE_STATE=path   append JSONL prune events (runtime evidence)
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
// @ts-expect-error plain ESM shared with the det bench (no types)
import { pruneMessages } from "./lib/prune-core.mjs";

const flag = (name: string, dflt = true): boolean => {
  const v = process.env[name];
  if (v === undefined || v === "") return dflt;
  return !["0", "false", "off", "no"].includes(String(v).toLowerCase());
};

const enabled = () => flag("PI_PRUNE", true);
const minLen = () => {
  const n = Number(process.env.PI_PRUNE_MIN_LEN ?? 40);
  return Number.isFinite(n) && n > 0 ? n : 40;
};
const keepRecent = () => {
  const n = Number(process.env.PI_PRUNE_KEEP ?? 4);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 4;
};
const debug = (msg: string) => {
  if (flag("PI_PRUNE_DEBUG", false)) console.error(`[transcript-pruner] ${msg}`);
};

/** Best-effort append of one JSONL event for runtime evidence (Iter 7). */
const sink = (line: string) => {
  const p = process.env.PI_PRUNE_STATE;
  if (!p) return;
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, line + "\n");
  } catch {
    /* best-effort */
  }
};

export default function (pi: ExtensionAPI) {
  pi.on("context", (event: any, ctx: any) => {
    if (!enabled()) return undefined;
    const messages = event.messages;
    if (!Array.isArray(messages) || messages.length < 4) return undefined;

    // Work on a clone — pi expects us to return a new messages array.
    let clone: any[];
    try {
      clone = structuredClone(messages);
    } catch {
      clone = JSON.parse(JSON.stringify(messages));
    }

    const result = pruneMessages(clone, {
      minLen: minLen(),
      keepRecent: keepRecent(),
      enableDedup: flag("PI_PRUNE_DEDUP", true),
      enableStale: flag("PI_PRUNE_STALE", true),
      enableClear: flag("PI_PRUNE_CLEAR", true),
      cwd: ctx?.cwd,
    });

    if (result.changed.length === 0) {
      debug(`noop ${messages.length} msgs`);
      return undefined;
    }

    // Sink per-kind tallies for context_growth / observe
    const tallies: Record<string, { count: number; bytes: number }> = {};
    for (const c of result.changed) {
      const t = tallies[c.kind] || (tallies[c.kind] = { count: 0, bytes: 0 });
      t.count += 1;
      t.bytes += c.bytes || 0;
    }
    for (const [kind, t] of Object.entries(tallies)) {
      sink(
        JSON.stringify({
          ts: new Date().toISOString(),
          kind,
          count: t.count,
          bytes: t.bytes,
        }),
      );
    }

    debug(
      `pruned ${result.changed.length} of ${messages.length} msgs ` +
        `(dedup=${flag("PI_PRUNE_DEDUP")} stale=${flag("PI_PRUNE_STALE")} ` +
        `clear=${flag("PI_PRUNE_CLEAR")} keep=${keepRecent()}) ` +
        `kinds=${result.changed.map((c: any) => c.kind).join(",")} ` +
        `saved=${result.charsBefore - result.charsAfter}ch`,
    );
    return { messages: clone };
  });
}
