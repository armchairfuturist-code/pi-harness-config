#!/usr/bin/env node
// ensure-btw-model.mjs — assign /btw (pi-smart-btw) a cheap, working model.
//
// WHY: the pi-smart-btw upstream default is hardcoded to
// provider:"openai-codex", modelId:"gpt-5.6-luna". If the machine has no
// openai-codex key, `/btw` fails with "No API key found for openai-codex".
// This script sets ~/.pi/agent/pi-smart-btw.json to the cheapest model with
// a published cost across the machine's registered providers, preferring the
// machine's active defaultProvider (from agent/settings.json) so /btw runs a
// genuinely cheap child session on a backend the operator already uses.
//
// Provider-agnostic by design (README): we never hardcode a provider; we read
// the machine's own model registry and auth. The registry does NOT know which
// keys are valid, so we respect an explicit override + the active provider
// preference, and fall back to any registered provider with costed models.
//
// --check exits 0 when /btw already has a non-openai-codex provider+model.
// It does not require a costed registry. Write mode only assigns when the
// current /btw is missing or still on the upstream openai-codex default.
//
// Usage:
//   ensure-btw-model.mjs            # fix in place if broken; leave a working /btw
//   ensure-btw-model.mjs --check    # exit 1 only if /btw is missing or openai-codex
// Override target: ENSURE_BTW_MODEL="provider/modelId"
// Test override:   PI_AGENT_DIR=/tmp/fake-agent
import { readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

const agentDir = process.env.PI_AGENT_DIR || join(homedir(), ".pi", "agent")
const btwPath = join(agentDir, "pi-smart-btw.json")
const modelsPath = join(agentDir, "models.json")
const settingsPath = join(agentDir, "settings.json")
const CHECK = process.argv.includes("--check")
const OVERRIDE = process.env["ENSURE_BTW_MODEL"]?.trim()
const FAIL_PROVIDER = "openai-codex"

function readJson(p) {
  try {
    return JSON.parse(readFileSync(p, "utf8"))
  } catch {
    return null
  }
}

function splitRef(ref) {
  const slash = ref.indexOf("/")
  if (slash < 0) return [ref, ""]
  return [ref.slice(0, slash), ref.slice(slash + 1)]
}

const btw = readJson(btwPath) ?? {}
const models = readJson(modelsPath)
const settings = readJson(settingsPath)

const bad = (msg) => {
  console.error(`[ensure-btw-model] BAD ${msg}`)
}
const ok = (msg) => {
  console.error(`[ensure-btw-model] OK ${msg}`)
}

const currentRef = `${btw.provider ?? ""}/${btw.modelId ?? ""}`
const isBroken = btw.provider === FAIL_PROVIDER || !btw.provider || !btw.modelId

const costed = []
if (models?.providers) {
  for (const [prov, p] of Object.entries(models.providers)) {
    if (!p || typeof p !== "object") continue
    for (const m of p.models ?? []) {
      const cost = m.cost?.input
      if (typeof cost === "number" && cost > 0) {
        costed.push({ provider: prov, modelId: m.id, cost })
      }
    }
  }
}

let target
if (OVERRIDE) {
  target = OVERRIDE.includes("/") ? OVERRIDE : `${OVERRIDE}/NO_MODEL`
} else {
  const activeProvider = settings?.defaultProvider ?? ""
  const activeFirst = costed
    .filter((x) => x.provider === activeProvider)
    .sort((a, b) => a.cost - b.cost)[0]
  const cheapest = [...costed].sort((a, b) => a.cost - b.cost)[0]
  const pick = activeFirst ?? cheapest
  if (pick) target = `${pick.provider}/${pick.modelId}`
}

if (CHECK) {
  if (isBroken) {
    const hint = target
      ? ` (expected ${target})`
      : " (no costed model in registry to suggest)"
    bad(`/btw uses non-working ${currentRef}${hint} — run: ensure-btw-model.mjs`)
    process.exit(1)
  }
  ok(`/btw on ${currentRef}`)
  process.exit(0)
}

if (!isBroken) {
  ok(`/btw already on ${currentRef}`)
  process.exit(0)
}

if (!target) {
  bad("no costed model found in model registry — cannot pick a cheap /btw model")
  process.exit(1)
}

const [tProv, tModel] = splitRef(target)
if (!tProv || !tModel) {
  bad(`invalid target ref ${target}`)
  process.exit(1)
}

btw.provider = tProv
btw.modelId = tModel
btw.thinking = btw.thinking ?? "low"
writeFileSync(btwPath, JSON.stringify(btw, null, 2) + "\n")
ok(`assigned /btw to ${target}`)
