#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"

const file = process.argv[2]
if (!file || !existsSync(file)) { console.error(`missing settings: ${file ?? ""}`); process.exit(1) }
const settings = JSON.parse(readFileSync(file, "utf8"))
let failed = false
for (const extension of settings.extensions ?? []) {
  const path = extension.replace(/^~/, homedir())
  if (!existsSync(path)) { console.error(`missing extension: ${extension}`); failed = true }
}
if (failed) process.exit(1)
console.log(`OK live settings: ${settings.packages?.length ?? 0} packages, ${settings.extensions?.length ?? 0} extensions`)
