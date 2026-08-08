#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

const ext = "/home/alex/.pi/agent/extensions/transcript-pruner.ts";
const core = "/home/alex/.pi/agent/extensions/lib/prune-core.mjs";
if (!existsSync(ext) || !existsSync(core)) {
  console.error("missing deployed files", { ext: existsSync(ext), core: existsSync(core) });
  process.exit(2);
}

const require = createRequire(import.meta.url);
// Resolve jiti from pi's package tree
const candidates = [
  "/home/alex/.pi/agent/npm/node_modules/jiti",
  "/home/alex/.pi/agent/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti",
];
let jitiPath;
for (const c of candidates) {
  try {
    jitiPath = require.resolve(c);
    break;
  } catch {
    /* next */
  }
}
if (!jitiPath) {
  // last resort: walk from pi-coding-agent
  try {
    jitiPath = require.resolve("jiti", {
      paths: ["/home/alex/.pi/agent/npm/node_modules/@earendil-works/pi-coding-agent"],
    });
  } catch (e) {
    console.error("jiti not found", e.message);
    process.exit(3);
  }
}
console.log("jiti:", jitiPath);
const jiti = require(jitiPath)(import.meta.url, { esmResolve: true, interopDefault: true });

const coreMod = jiti(core);
console.log("core.pruneMessages:", typeof coreMod.pruneMessages);

const extMod = jiti(ext);
const def = extMod.default || extMod;
console.log("extension default:", typeof def);

// Smoke: call pruneMessages on empty
const r = coreMod.pruneMessages([], { keepRecent: 4 });
console.log("empty prune ok:", r.changed.length === 0, "chars", r.charsBefore);

// Smoke: register fake pi
let hooked = false;
const fakePi = {
  on(ev, _fn) {
    if (ev === "context") hooked = true;
  },
};
def(fakePi);
console.log("registered context hook:", hooked);
process.exit(hooked && typeof coreMod.pruneMessages === "function" ? 0 : 1);
