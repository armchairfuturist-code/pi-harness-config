#!/usr/bin/env node
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
const root = new URL("..", import.meta.url).pathname
const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent")
const settings = JSON.parse(readFileSync(join(agent, "settings.json"), "utf8"))
const hash = createHash("sha256")
for (const file of ["settings.json", "APPEND_SYSTEM.md", "HARNESS.md"]) hash.update(readFileSync(join(agent, file)))
const packageVersions = {}
for (const spec of settings.packages ?? []) {
  if (!spec.startsWith("npm:")) continue
  const name = spec.slice(4).replace(/@[^@/]+$/, "")
  const pkg = join(agent, "npm", "node_modules", ...name.split("/"), "package.json")
  packageVersions[name] = existsSync(pkg) ? JSON.parse(readFileSync(pkg, "utf8")).version : null
}
console.log(JSON.stringify({configHash:hash.digest("hex").slice(0,12),packages:packageVersions,extensions:(settings.extensions??[]).map(basename).sort()},null,2))
