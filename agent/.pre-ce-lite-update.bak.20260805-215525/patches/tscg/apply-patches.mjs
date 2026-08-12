#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const agent = process.env.PI_AGENT_HOME || join(process.env.HOME, ".pi", "agent")
const root = join(agent, "npm", "node_modules", "pi-tscg")
const pkgFile = join(root, "package.json")
const expected = "0.2.4"
if (!existsSync(pkgFile)) throw new Error(`pi-tscg missing: ${pkgFile}`)
const version = JSON.parse(readFileSync(pkgFile, "utf8")).version
if (version !== expected) throw new Error(`pi-tscg patch supports ${expected}; found ${version}`)
const file = join(root, "extensions", "tscg.ts")
let code = readFileSync(file, "utf8")
if (!code.includes("PI_HARNESS_TSCG_DEEP")) {
  const start = code.indexOf("function truncateLongDescriptions(")
  const stop = code.indexOf("\nfunction truncate(", start)
  if (start < 0 || stop < 0) throw new Error("pi-tscg function shape changed; refusing patch")
  const replacement = `function truncateLongDescriptions(t: AnyToolDefinition, maxChars: number): AnyToolDefinition {\n\t// PI_HARNESS_TSCG_DEEP: recursively truncate nested parameter descriptions.\n\tfunction truncateDeep(obj: unknown): unknown {\n\t\tif (obj === null || typeof obj !== "object") return obj;\n\t\tif (Array.isArray(obj)) return obj.map(truncateDeep);\n\t\tconst result: Record<string, unknown> = {};\n\t\tfor (const [key, value] of Object.entries(obj as Record<string, unknown>)) {\n\t\t\tresult[key] = key === "description" && typeof value === "string" ? truncate(value, maxChars) : truncateDeep(value);\n\t\t}\n\t\treturn result;\n\t}\n\tlet next = setDescription(t, truncate(getDescription(t), maxChars));\n\tconst props = getParamProperties(next);\n\tif (props) next = setParamProperties(next, truncateDeep(props) as Record<string, unknown>);\n\treturn next;\n}\n`
  code = code.slice(0, start) + replacement + code.slice(stop + 1)
  writeFileSync(file, code)
}
console.log(`OK pi-tscg ${version}: recursive descriptions patched`)
