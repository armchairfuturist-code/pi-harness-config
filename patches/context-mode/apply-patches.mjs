#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent")
const root = join(agent, "npm", "node_modules", "context-mode")
const pkgFile = join(root, "package.json")
const expected = "1.0.169"
if (!existsSync(pkgFile)) throw new Error(`context-mode missing: ${pkgFile}`)
const version = JSON.parse(readFileSync(pkgFile, "utf8")).version
if (version !== expected) throw new Error(`context-mode patch supports ${expected}; found ${version}`)

const bridgeFile = join(root, "build", "adapters", "pi", "mcp-bridge.js")
let bridge = readFileSync(bridgeFile, "utf8")
if (!bridge.includes("PI_HARNESS_ADMIN_TOOLS_REMOVED")) {
  const old = "const tools = await client.listTools();\n    const registered = [];\n    for (const tool of tools) {"
  const next = "const tools = await client.listTools();\n    // PI_HARNESS_ADMIN_TOOLS_REMOVED: generic sessions do not expose maintenance schemas.\n    const adminTools = new Set([\"ctx_stats\", \"ctx_doctor\", \"ctx_upgrade\", \"ctx_purge\", \"ctx_insight\"]);\n    const registered = [];\n    for (const tool of tools.filter((candidate) => !adminTools.has(candidate.name))) {"
  if (!bridge.includes(old)) throw new Error("context-mode bridge shape changed; refusing patch")
  bridge = bridge.replace(old, next)
  writeFileSync(bridgeFile, bridge)
}

const extensionFile = join(root, "build", "adapters", "pi", "extension.js")
let extension = readFileSync(extensionFile, "utf8")
if (!extension.includes("PI_HARNESS_ADMIN_ROUTING_REMOVED")) {
  const pattern = /"Web pages → ctx_fetch_and_index then ctx_search\. Index docs → ctx_index\. "\s*\+\s*"Stats → ctx_stats\. Doctor → ctx_doctor\. Upgrade → ctx_upgrade\. Purge → ctx_purge\."\);/
  const matches = extension.match(new RegExp(pattern.source, "g")) ?? []
  if (matches.length !== 1) throw new Error(`context-mode routing anchor matches=${matches.length}; refusing patch`)
  extension = extension.replace(pattern, '"Web pages → ctx_fetch_and_index then ctx_search. Index docs → ctx_index."); // PI_HARNESS_ADMIN_ROUTING_REMOVED')
  writeFileSync(extensionFile, extension)
}
console.log(`OK context-mode ${version}: admin schemas removed`)
