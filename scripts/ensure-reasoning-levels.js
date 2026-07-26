#!/usr/bin/env node
/**
 * ensure-reasoning-levels.js — provider/model-agnostic thinkingLevelMap injector.
 *
 * pi's shift-tab thinking dial only shows `xhigh`/`max` when a model's
 * `thinkingLevelMap` explicitly defines them (see pi-ai's
 * `getSupportedThinkingLevels`). A model can have `supportsReasoningEffort: true`
 * yet still hide those levels if the map is absent. This script fixes that.
 *
 * For every model in models.json that has `reasoning: true` AND
 * `compat.supportsReasoningEffort: true`, injects/merges a `thinkingLevelMap`
 * exposing all levels through `xhigh` and `max`. Models that don't support the
 * reasoning-effort dial are left untouched (their levels correctly top out at `high`).
 *
 * Works against any provider — no model IDs or provider names are hardcoded.
 *
 * Usage:
 *   node scripts/ensure-reasoning-levels.js [path/to/models.json]
 *       (defaults to ./models.json)
 *
 * Exit codes: 0 = ok (written or no-op), 1 = error.
 */
const fs = require("fs");
const path = require("path");

const DEFAULT_MAP = {
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  max: "max",
};

const target = path.resolve(process.argv[2] || "models.json");

let raw;
try {
  raw = fs.readFileSync(target, "utf8");
} catch (e) {
  console.error(`[ensure-reasoning-levels] cannot read ${target}: ${e.message}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(raw);
} catch (e) {
  console.error(`[ensure-reasoning-levels] invalid JSON in ${target}: ${e.message}`);
  process.exit(1);
}

const providers = config.providers;
if (!providers || typeof providers !== "object") {
  console.error(`[ensure-reasoning-levels] no "providers" object in ${target}`);
  process.exit(1);
}

let touched = 0;
let skipped = 0;

for (const [provName, prov] of Object.entries(providers)) {
  if (!prov || !Array.isArray(prov.models)) continue;
  const provSupportsEffort = prov.compat?.supportsReasoningEffort === true;
  for (const model of prov.models) {
    // Provider-level compat acts as a default; per-model compat overrides it.
    const supportsEffort =
      (model.compat?.supportsReasoningEffort ?? provSupportsEffort) === true;
    if (!model.reasoning || !supportsEffort) {
      skipped++;
      continue;
    }
    model.thinkingLevelMap = { ...DEFAULT_MAP, ...(model.thinkingLevelMap || {}) };
    touched++;
    console.log(`  ✓ ${provName}/${model.id} -> thinkingLevelMap set (xhigh, max exposed)`);
  }
}

if (touched === 0) {
  console.log(`[ensure-reasoning-levels] no reasoning-effort-capable models found; ${skipped} skipped. No change.`);
  process.exit(0);
}

fs.writeFileSync(target, JSON.stringify(config, null, 2) + "\n", "utf8");
console.log(`[ensure-reasoning-levels] wrote ${target}: ${touched} model(s) updated, ${skipped} skipped.`);
