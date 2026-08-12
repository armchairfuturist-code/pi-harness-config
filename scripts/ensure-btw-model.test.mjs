#!/usr/bin/env node
// Tiny fixture test for ensure-btw-model.mjs. No extra deps.
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const script = fileURLToPath(new URL("./ensure-btw-model.mjs", import.meta.url))
let failed = 0

function writeAgent(dir, { btw, models, settings }) {
  if (btw !== undefined) {
    writeFileSync(join(dir, "pi-smart-btw.json"), JSON.stringify(btw, null, 2))
  }
  if (models !== undefined) {
    writeFileSync(join(dir, "models.json"), JSON.stringify(models, null, 2))
  }
  if (settings !== undefined) {
    writeFileSync(join(dir, "settings.json"), JSON.stringify(settings, null, 2))
  }
}

function run(dir, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, PI_AGENT_DIR: dir, ...extraEnv },
    encoding: "utf8",
  })
}

function assert(name, cond, detail = "") {
  if (cond) {
    console.error(`OK  ${name}`)
    return
  }
  failed += 1
  console.error(`BAD ${name}${detail ? ` — ${detail}` : ""}`)
}

function withAgent(fn) {
  const dir = mkdtempSync(join(tmpdir(), "ensure-btw-"))
  try {
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

withAgent((dir) => {
  writeAgent(dir, {
    btw: { provider: "Synthetic", modelId: "hf:Qwen/Qwen3.6-27B", thinking: "low" },
    models: { providers: { Venice: { models: [{ id: "grok-4-6" }] } } },
    settings: { defaultProvider: "Venice" },
  })
  const r = run(dir, ["--check"])
  assert("check passes with working slash-id model and no costs", r.status === 0, r.stderr)
})

withAgent((dir) => {
  writeAgent(dir, {
    btw: { provider: "openai-codex", modelId: "gpt-5.6-luna" },
    models: { providers: { Venice: { models: [{ id: "grok-4-6" }] } } },
  })
  const r = run(dir, ["--check"])
  assert("check fails on openai-codex default", r.status === 1, r.stderr)
})

withAgent((dir) => {
  writeAgent(dir, {
    models: { providers: { Venice: { models: [{ id: "grok-4-6" }] } } },
  })
  const r = run(dir, ["--check"])
  assert("check fails when /btw file missing", r.status === 1, r.stderr)
})

withAgent((dir) => {
  const btw = { provider: "Synthetic", modelId: "hf:Qwen/Qwen3.6-27B", thinking: "low" }
  writeAgent(dir, {
    btw,
    models: { providers: { Venice: { models: [{ id: "grok-4-6" }] } } },
  })
  const r = run(dir)
  const after = JSON.parse(readFileSync(join(dir, "pi-smart-btw.json"), "utf8"))
  assert("write mode leaves a working /btw alone", r.status === 0 && after.modelId === btw.modelId, r.stderr)
})

withAgent((dir) => {
  writeAgent(dir, {
    btw: { provider: "openai-codex", modelId: "gpt-5.6-luna" },
    models: {
      providers: {
        Venice: { models: [{ id: "grok-4-6", cost: { input: 0.2 } }, { id: "cheap", cost: { input: 0.01 } }] },
      },
    },
    settings: { defaultProvider: "Venice" },
  })
  const r = run(dir)
  const after = JSON.parse(readFileSync(join(dir, "pi-smart-btw.json"), "utf8"))
  assert(
    "write mode assigns cheapest costed model on the active provider",
    r.status === 0 && after.provider === "Venice" && after.modelId === "cheap",
    `${r.stderr} after=${JSON.stringify(after)}`,
  )
})

withAgent((dir) => {
  writeAgent(dir, {
    btw: { provider: "openai-codex", modelId: "gpt-5.6-luna" },
    models: { providers: { Venice: { models: [{ id: "grok-4-6" }] } } },
  })
  const r = run(dir, [], { ENSURE_BTW_MODEL: "Synthetic/hf:Qwen/Qwen3.6-27B" })
  const after = JSON.parse(readFileSync(join(dir, "pi-smart-btw.json"), "utf8"))
  assert(
    "override keeps slash inside modelId",
    r.status === 0 && after.provider === "Synthetic" && after.modelId === "hf:Qwen/Qwen3.6-27B",
    `${r.stderr} after=${JSON.stringify(after)}`,
  )
})

if (failed) {
  console.error(`${failed} failed`)
  process.exit(1)
}
console.error("all passed")
