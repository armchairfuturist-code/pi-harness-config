#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

const scriptRoot = new URL("..", import.meta.url).pathname
const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent")
const lockFile = process.env.PI_PACKAGE_LOCK || (existsSync(join(scriptRoot, "packages.lock.json")) ? join(scriptRoot, "packages.lock.json") : join(agent, "packages.lock.json"))
if (!existsSync(lockFile)) { console.error(`MISSING package lock: ${lockFile}`); process.exit(1) }
const lock = JSON.parse(readFileSync(lockFile, "utf8"))
let failed = false
for (const [name, expected] of Object.entries(lock)) {
  const file = join(agent, "npm", "node_modules", ...name.split("/"), "package.json")
  if (!existsSync(file)) { console.error(`MISSING ${name}@${expected}`); failed = true; continue }
  const actual = JSON.parse(readFileSync(file, "utf8")).version
  if (actual !== expected) { console.error(`VERSION ${name}: expected ${expected}, found ${actual}`); failed = true }
}
if (failed) process.exit(1)
console.log(`OK package lock (${Object.keys(lock).length} packages)`)
