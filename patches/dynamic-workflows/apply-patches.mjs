#!/usr/bin/env node
// Idempotent patches against @quintinshaw/pi-dynamic-workflows 3.5.1.
// Re-apply after package upgrades; fail loudly when upstream anchors move.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent");
const root = join(agent, "npm", "node_modules", "@quintinshaw", "pi-dynamic-workflows");
const pkgFile = join(root, "package.json");
const expected = "3.5.1";

if (!existsSync(pkgFile)) throw new Error(`@quintinshaw/pi-dynamic-workflows missing: ${pkgFile}`);
const version = JSON.parse(readFileSync(pkgFile, "utf8")).version;
if (version !== expected) throw new Error(`dynamic-workflows patch supports ${expected}; found ${version}`);

function patchWorkflowTool() {
 const file = join(root, "dist", "workflow-tool.js");
 let code = readFileSync(file, "utf8");
 const marker = "SLIM_WORKFLOW_TOOL_PATCHED";
 if (code.includes(marker)) return;
 const description = [
  "Raw JavaScript workflow script, with no Markdown fences. Required unless `name` is given.",
  "Must start with: export const meta = { name: 'short_snake_case', description: '...' }.",
  "Use agent(), parallel(), pipeline(), phase(), log(), budget, args, cwd. Plain JS only — no imports, require(), fs, Date.now(), Math.random(), or new Date(). Must call agent() at least once.",
  "Full authoring reference: read the workflow-authoring skill (and workflow-patterns for saved/built-in names).",
 ].join(" ");
 const open = code.indexOf("script: Type.Optional(Type.String({");
 const start = code.indexOf("description: [", open);
 const joinAnchor = '.join(" "),';
 const end = code.indexOf(joinAnchor, start);
 if (open < 0 || start < 0 || start > open + 80 || end < 0) {
  throw new Error("dynamic-workflows: workflow-tool description anchor changed");
 }
 code = code.slice(0, start) + `description: ${JSON.stringify(description)}, /* ${marker} */ ` + code.slice(end + joinAnchor.length);
 writeFileSync(file, code, "utf8");
}

function patchTierConfig() {
 const file = join(root, "dist", "model-tier-config.js");
 const typeFile = join(root, "dist", "model-tier-config.d.ts");
 let code = readFileSync(file, "utf8");
 const marker = "MODEL_TIER_FALLBACK_ROUTER_PATCHED";
 if (code.includes(marker)) return;
 const anchor = "export function sortedTierNames(";
 const index = code.indexOf(anchor);
 if (index < 0) throw new Error("dynamic-workflows: tier helper anchor changed");
 const helper = `// ${marker}
function splitTierModelSpec(spec) {
 const requested = String(spec ?? "").trim();
 const colon = requested.lastIndexOf(":");
 const suffix = colon > 0 ? requested.slice(colon + 1).toLowerCase() : "";
 const levels = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
 return suffix && levels.has(suffix)
  ? { base: requested.slice(0, colon).toLowerCase(), suffix }
  : { base: requested.toLowerCase(), suffix: "" };
}
export function isTierModelAvailable(requestedSpec, availableModels) {
 const { base: requested } = splitTierModelSpec(requestedSpec);
 const slash = requested.indexOf("/");
 const provider = slash < 0 ? "" : requested.slice(0, slash);
 const id = slash < 0 ? requested : requested.slice(slash + 1);
 return (availableModels ?? []).some((candidate) => {
  const { base } = splitTierModelSpec(candidate.spec);
  const candidateSlash = base.indexOf("/");
  const candidateProvider = candidateSlash < 0 ? "" : base.slice(0, candidateSlash);
  const candidateId = candidateSlash < 0 ? base : base.slice(candidateSlash + 1);
  return (!provider || provider === candidateProvider) &&
   (base === requested || candidateId === id || candidateId.includes(id));
 });
}
/** Select a cross-provider replacement for an unavailable tier anchor. */
export function resolveTierFallback(tier, requestedSpec, availableModels) {
 const models = Array.isArray(availableModels) ? availableModels : [];
 if (!requestedSpec || models.length === 0) return undefined;
 const tierIndex = { small: 0, medium: 1, big: 2 }[tier];
 if (tierIndex === undefined) return undefined;
 const ranked = rankByCapability(models);
 const selectedIndex = Math.min(tierIndex, ranked.length - 1);
 // Never jump more than one tier downward and never auto-upgrade.
 if (tierIndex - selectedIndex > 1) return undefined;
 const selected = selectedIndex === 0
  ? ranked[0]
  : selectedIndex === 1
   ? ranked[Math.floor(ranked.length / 2)]
   : ranked[ranked.length - 1];
 if (!selected) return undefined;
 const { suffix } = splitTierModelSpec(requestedSpec);
 return {
  spec: suffix ? selected.spec + ":" + suffix : selected.spec,
  downgraded: selectedIndex < tierIndex,
 };
}
`;
 code = code.slice(0, index) + helper + code.slice(index);
 writeFileSync(file, code, "utf8");
 let types = readFileSync(typeFile, "utf8");
 if (!types.includes("resolveTierFallback")) {
  types += "\nexport declare function isTierModelAvailable(requestedSpec: string, availableModels: readonly RankableModel[]): boolean;\n";
  types += "export declare function resolveTierFallback(tier: string, requestedSpec: string, availableModels: readonly RankableModel[]): { spec: string; downgraded: boolean } | undefined;\n";
  writeFileSync(typeFile, types, "utf8");
 }
}

function patchAgent() {
 const file = join(root, "dist", "agent.js");
 let code = readFileSync(file, "utf8");
 const marker = "MODEL_TIER_FALLBACK_AGENT_PATCHED";
 if (code.includes(marker)) return;
 const importLine = 'import { formatTierFallbackNotice, loadModelTierConfig, resolveTierModel, } from "./model-tier-config.js";';
 if (!code.includes(importLine)) throw new Error("dynamic-workflows: agent model-tier import changed");
 code = code.replace(importLine, 'import { formatTierFallbackNotice, isTierModelAvailable, loadModelTierConfig, resolveTierFallback, resolveTierModel, } from "./model-tier-config.js";');
 const declaration = "const modelSpec = resolveAgentModelSpec(options, this.mainModel, () => this.loadTierConfig(), () => warnTierUnconfiguredOnce(this.mainModel, modelRegistry));";
 if (!code.includes(declaration)) throw new Error("dynamic-workflows: model resolution anchor changed");
 code = code.replace(declaration, declaration.replace("const modelSpec", "let modelSpec"));
 const resolveLine = "const resolved = resolveModelSpecWithThinking(modelSpec, modelRegistry);";
 if (!code.includes(resolveLine)) throw new Error("dynamic-workflows: model resolver anchor changed");
 const fallback = `let resolved = resolveModelSpecWithThinking(modelSpec, modelRegistry);
// ${marker}
// Explicit tiers use their anchor; untagged agents use the configured medium tier.
if (!options.model) {
 const config = this.loadTierConfig();
 const tier = options.tier ?? (config ? "medium" : undefined);
 const requestedSpec = tier && config ? resolveTierModel(tier, config) : undefined;
 const availableModels = requestedSpec ? listAvailableModels(modelRegistry) : [];
 if (requestedSpec && !isTierModelAvailable(requestedSpec, availableModels)) {
  const replacement = resolveTierFallback(tier, requestedSpec, availableModels);
  if (replacement) {
   console.warn("[workflow] tier " + tier + " model " + requestedSpec + " unavailable — using " + replacement.spec + (replacement.downgraded ? " after one-tier downgrade" : " from the live catalog"));
   modelSpec = replacement.spec;
   resolved = resolveModelSpecWithThinking(modelSpec, modelRegistry);
  } else {
   resolved = { model: undefined, error: "tier " + tier + " model " + requestedSpec + " is unavailable and no compatible authenticated fallback exists" };
  }
 }
}`;
 code = code.replace(resolveLine, fallback);
 writeFileSync(file, code, "utf8");
}

async function selfTest() {
 const file = join(root, "dist", "model-tier-config.js");
 const code = readFileSync(file, "utf8");
 const helperStart = code.indexOf("// MODEL_TIER_FALLBACK_ROUTER_PATCHED");
 const sortedStart = code.indexOf("export function sortedTierNames(", helperStart);
 if (helperStart < 0 || sortedStart < 0) throw new Error("dynamic-workflows self-test: router anchors missing");
 const source = code.replace(/^import .*;\n/gm, "").replace(/^export\s+/gm, "")
  + "\nexport { isTierModelAvailable, resolveTierFallback };\n";
 const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
 const models = [
  { spec: "provider/cheap", costOutput: 0.2, contextWindow: 32000 },
  { spec: "provider/mid", costOutput: 2, contextWindow: 128000 },
  { spec: "provider/strong", costOutput: 20, contextWindow: 1000000 },
 ];
 const before = JSON.stringify(models);
 const expect = (condition, message) => { if (!condition) throw new Error(`dynamic-workflows self-test: ${message}`); };
 expect(module.resolveTierFallback("small", "dead:minimal", models).spec === "provider/cheap:minimal", "small tier");
 expect(module.resolveTierFallback("medium", "dead:high", models).spec === "provider/mid:high", "medium tier");
 expect(module.resolveTierFallback("big", "dead:max", models).spec === "provider/strong:max", "big tier");
 const downgrade = module.resolveTierFallback("big", "dead:max", models.slice(0, 2));
 expect(downgrade?.spec === "provider/mid:max" && downgrade.downgraded, "one-tier downgrade");
 expect(module.resolveTierFallback("big", "dead:max", models.slice(0, 1)) === undefined, "no two-tier downgrade");
 expect(module.isTierModelAvailable("provider/cheap:low", models), "qualified anchor");
 expect(!module.isTierModelAvailable("other/cheap:low", models), "provider mismatch");
 expect(JSON.stringify(models) === before, "catalog is not mutated");
 console.log("OK dynamic-workflows: tier router self-test");
}

patchWorkflowTool();
patchTierConfig();
patchAgent();
if (process.argv.includes("--self-test")) await selfTest();
console.log(`OK dynamic-workflows ${expected}: routing patch applied`);
