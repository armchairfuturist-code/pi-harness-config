#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"

const root = new URL("..", import.meta.url).pathname
const settings = JSON.parse(readFileSync(join(root, "settings.json"), "utf8"))
const lock = JSON.parse(readFileSync(join(root, "packages.lock.json"), "utf8"))
const install = readFileSync(join(root, "install.sh"), "utf8")
let failed = false
const bad = (message) => { console.error(`BAD ${message}`); failed = true }

for (const spec of settings.packages) {
  if (!spec.startsWith("npm:")) continue
  const name = spec.slice(4).replace(/@[^@/]+$/, "")
  if (!(name in lock)) bad(`unlocked package ${name}`)
}
// The lock may include packages used only as explicit extension sources
// (currently @samfp/pi-essentials); those must be installed but not registered
// as packages, otherwise every extension in their package manifest auto-loads.
for (const ext of settings.extensions.filter((value) => value.startsWith("~/.pi/agent/extensions/"))) {
  const file = basename(ext)
  if (!existsSync(join(root, "extensions", file))) bad(`missing extension source ${file}`)
  if (!install.includes(`extensions/${file}|`)) bad(`extension absent from install manifest: ${file}`)
}
const serialized = JSON.stringify(settings).toLowerCase()
if (serialized.includes("invest") || serialized.includes("last30days") || serialized.includes("better-harness")) bad("default settings contain domain/optional tooling")
for (const profile of ["research.json", "audit.json"]) {
  if (!existsSync(join(root, "profiles", profile))) bad(`missing profile ${profile}`)
}
if (install.includes("systemctl --user link")) bad("install.sh must copy systemd units, not systemctl link from $ROOT")
if (!install.includes(".config/systemd/user")) bad("install.sh must install units into ~/.config/systemd/user")
if (!install.includes("FragmentPath")) bad("install.sh --check must verify unit FragmentPath")
if (failed) process.exit(1)
console.log(`OK manifest: ${settings.packages.length} packages, ${settings.extensions.length} extensions`)
