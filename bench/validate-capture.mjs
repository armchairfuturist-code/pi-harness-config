#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs"
const [captureFile, outFile] = process.argv.slice(2)
if (!captureFile || !existsSync(captureFile)) throw new Error(`capture missing: ${captureFile ?? ""}`)
const capture = JSON.parse(readFileSync(captureFile, "utf8"))
const body = capture.request?.body ?? capture.request ?? {}
const tools = body.tools ?? []
const names = tools.map((tool) => tool.function?.name ?? tool.name).filter(Boolean).sort()
const forbidden = names.filter((name) => /^(invest_|last30days_)|^ctx_(stats|doctor|upgrade|purge|insight)$/.test(name))
if (forbidden.length) throw new Error(`forbidden default tools: ${forbidden.join(", ")}`)
const response = capture.response?.body?.raw ?? capture.resPreview ?? ""
const usage = capture.usage ?? capture.response?.body?.usage ?? {}
const result = {
  capture: captureFile,
  model: body.model,
  requestCount: 1,
  toolCount: names.length,
  toolNames: names,
  toolSchemaChars: JSON.stringify(tools).length,
  systemChars: (body.messages ?? []).filter((m) => m.role === "system").map((m) => typeof m.content === "string" ? m.content.length : JSON.stringify(m.content).length).reduce((a,b)=>a+b,0),
  usage,
  responseContainsOK: /(?:^|["\s])OK(?:["\s]|$)/.test(response),
}
if (!result.responseContainsOK) throw new Error("response did not contain exact OK token")
if (outFile) writeFileSync(outFile, JSON.stringify(result, null, 2) + "\n")
console.log(JSON.stringify(result))
