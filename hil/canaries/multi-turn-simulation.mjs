#!/usr/bin/env node
/** Automated four-turn filesystem/state canary for Pi RPC sessions. */
import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const jsonOutput = process.argv.includes("--json");
const model = process.env.MULTITURN_MODEL || "openai-gpt-56-luna";
const timeoutMs = Number(process.env.MULTITURN_TIMEOUT_MS || 300000);
const workspace = mkdtempSync(join(tmpdir(), "pi-multiturn-canary-"));
const sessionDir = join(workspace, "sessions");
mkdirSync(sessionDir);
const prompts = [
  "Create calculator.py with add(a, b) and multiply(a, b). Create test_calculator.py with tests for both functions. Run the tests. Do not modify files outside this workspace.",
  "Now add divide(a, b) to calculator.py. It must raise ZeroDivisionError when b is 0. Add a test for it in test_calculator.py and run the tests again. Do not modify files outside this workspace.",
  "Inspect all three functions. Identify the one with the most complex error handling, simplify that function without changing behavior, and run the tests. Do not modify files outside this workspace.",
  "State the first function you created, the last change you made, and summarize the current calculator.py. Do not modify files.",
];

let proc;
let input = "";
let nextId = 0;
const responses = new Map();
const settledWaiters = [];
const results = [];
let lastAssistant = "";

function parseLine(line) {
  let event;
  try { event = JSON.parse(line); } catch { return; }
  if (event.type === "response" && event.id && responses.has(event.id)) {
    const { resolve, reject, timer } = responses.get(event.id);
    clearTimeout(timer); responses.delete(event.id);
    event.success === false ? reject(new Error(event.error || "RPC request rejected")) : resolve(event);
    return;
  }
  if (event.type === "message_end" && event.message?.role === "assistant") {
    lastAssistant = (event.message.content || [])
      .filter((x) => x?.type === "text").map((x) => x.text || "").join("\n");
  }
  if (event.type === "agent_settled") {
    const resolve = settledWaiters.shift();
    if (resolve) resolve();
  }
}
function onData(chunk) {
  input += chunk.toString();
  let pos;
  while ((pos = input.indexOf("\n")) >= 0) {
    const line = input.slice(0, pos).replace(/\r$/, ""); input = input.slice(pos + 1);
    if (line) parseLine(line);
  }
}
function request(payload) {
  return new Promise((resolve, reject) => {
    const id = `canary-${++nextId}`;
    const timer = setTimeout(() => { responses.delete(id); reject(new Error(`RPC timeout: ${payload.type}`)); }, timeoutMs);
    responses.set(id, { resolve, reject, timer });
    proc.stdin.write(JSON.stringify({ ...payload, id }) + "\n");
  });
}
function waitSettled() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("agent_settled timeout")), timeoutMs);
    settledWaiters.push(() => { clearTimeout(timer); resolve(); });
  });
}
function checkTurn(turn) {
  const calcPath = join(workspace, "calculator.py");
  const testPath = join(workspace, "test_calculator.py");
  const calc = existsSync(calcPath) ? readFileSync(calcPath, "utf8") : "";
  const tests = existsSync(testPath) ? readFileSync(testPath, "utf8") : "";
  const checks = {
    calculator_exists: existsSync(calcPath),
    tests_exists: existsSync(testPath),
    add_present: /def\s+add\s*\(/.test(calc),
    multiply_present: /def\s+multiply\s*\(/.test(calc),
    divide_present: turn < 1 || /def\s+divide\s*\(/.test(calc),
    zero_division_guard: turn < 1 || (/ZeroDivisionError/.test(calc) || (/divide|zero/i.test(tests) && /divide/.test(calc))),
    tests_cover_add_multiply: turn !== 0 || /add|multiply/.test(tests),
    tests_cover_divide: turn < 1 || /divide/.test(tests),
  };
  if (turn >= 2) {
    try {
      const output = execFileSync("python3", ["-m", "pytest", "-q"], { cwd: workspace, encoding: "utf8", timeout: 60000 });
      checks.tests_pass = /passed/.test(output);
    } catch { checks.tests_pass = false; }
  }
  return checks;
}
async function main() {
  proc = spawn("pi", ["--mode", "rpc", "--no-session", "--session-dir", sessionDir, "--model", model], {
    cwd: workspace, env: { ...process.env, PI_PRUNE: "1" }, stdio: ["pipe", "pipe", "pipe"],
  });
  proc.stdout.on("data", onData);
  let stderr = ""; proc.stderr.on("data", (d) => { stderr += d.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RPC startup timeout")), 30000);
    proc.once("spawn", () => { clearTimeout(timer); resolve(); });
    proc.once("error", reject);
  });
  for (let i = 0; i < prompts.length; i++) {
    lastAssistant = "";
    await request({ type: "prompt", message: prompts[i] });
    await waitSettled();
    const checks = checkTurn(i);
    results.push({ turn: i + 1, ok: Object.values(checks).every(Boolean), checks, assistant: lastAssistant.slice(0, 1200) });
    if (!results.at(-1).ok) break;
  }
  try { await request({ type: "quit" }); } catch {}
  proc.kill("SIGTERM");
  const report = { ok: results.length === prompts.length && results.every((x) => x.ok), model, turns: results, stderr: stderr.slice(-2000) };
  if (jsonOutput) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`multi-turn model=${model} turns=${results.length}/${prompts.length} ${report.ok ? "PASS" : "FAIL"}`);
    for (const r of results) console.log(`  turn ${r.turn}: ${r.ok ? "PASS" : "FAIL"} ${JSON.stringify(r.checks)}`);
  }
  rmSync(workspace, { recursive: true, force: true });
  process.exit(report.ok ? 0 : 1);
}
main().catch((err) => { console.error(`multi-turn fatal: ${err.stack || err}`); try { proc?.kill("SIGTERM"); } catch {} try { rmSync(workspace, { recursive: true, force: true }); } catch {} process.exit(2); });
