#!/usr/bin/env node
// Validate live settings.json:
//  1. Every explicitly configured extension file must exist.
//  2. An extension must not point into a package's node_modules if that package
//     is ALSO declared in `packages` (or packages.lock). Such packages are
//     auto-loaded by pi from its package hub, so an explicit `extensions` entry
//     loads the same module a second time and pi aborts with
//       Tool "read" conflicts with <package path>
//     Requiring one-or-the-other makes this class of error impossible to push.
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"

const file = process.argv[2]
if (!file || !existsSync(file)) { console.error(`missing settings: ${file ?? ""}`); process.exit(1) }
const settings = JSON.parse(readFileSync(file, "utf8"))
let failed = false

const packages = (settings.packages ?? []).map((p) => {
  const s = typeof p === "string" ? p : p?.source
  // npm:@scope/name@1.2.3  ->  @scope/name
  return (s ?? "").replace(/^npm:/, "").replace(/@[^@]+$/, "")
}).filter(Boolean)
const pkgNames = new Set(packages)

for (const extension of settings.extensions ?? []) {
  const path = extension.replace(/^~/, homedir())
  const m = path.match(/\/node_modules\/((@[^/]+\/)?[^/]+)\//)
  const pkgFromPath = m?.[1]
  if (pkgFromPath && pkgNames.has(pkgFromPath)) {
    console.error(`extension ${extension} points into node_modules of package "${pkgFromPath}" which is also in \`packages\` — pi auto-loads that package, so this explicit entry double-registers its tools (startup: Tool "... " conflicts). Remove it from \`extensions\` and keep only \`packages\`.`)
    failed = true
  } else if (!existsSync(path)) {
    console.error(`missing extension: ${extension}`)
    failed = true
  }
}
if (failed) process.exit(1)
console.log(`OK live settings: ${settings.packages?.length ?? 0} packages, ${settings.extensions?.length ?? 0} extensions`)
