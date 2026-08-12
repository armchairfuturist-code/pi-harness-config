#!/usr/bin/env node
// Mechanical auditor for ce-lite. Re-runs checks. A planted verdict is not evidence.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export const CONTRACT_VERSION = 1;
export const AUDIT_VERSION = 1;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_TIMEOUT_MS = 120_000;
export const MAX_CAPTURE = 200_000;

export function isUnsafeProjectCwd(cwd) {
  const abs = resolve(cwd || ".");
  const home = resolve(homedir());
  return abs === "/" || abs === "/home" || abs === home;
}

export function resolveStateDir(cwd, opts = {}) {
  const abs = resolve(cwd || ".");
  const home = resolve(homedir());
  const agentHome = resolve(opts.agentHome || join(home, ".pi", "agent"));
  const create = opts.create !== false;
  if (!isUnsafeProjectCwd(abs)) {
    const scratch = join(abs, ".scratch");
    if (!create) return scratch;
    try {
      mkdirSync(scratch, { recursive: true });
      return scratch;
    } catch {
      // unwritable project dir
    }
  }
  const slug = sha256(abs).slice(0, 12);
  const fallback = join(agentHome, ".scratch", "ce-lite", slug);
  if (create) mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function contractPaths(cwd, stateDir) {
  const scratch = stateDir || resolveStateDir(cwd, { create: false });
  return {
    scratch,
    contract: join(scratch, "ce-contract.json"),
    audit: join(scratch, "ce-audit.json"),
    observed: join(scratch, "ce-observed.json"),
  };
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function hashContract(contract) {
  return sha256(
    stableStringify({
      version: contract.version,
      summary: contract.summary,
      terms: contract.terms,
    }),
  );
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function saveJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function resolveInCwd(cwd, rel) {
  const root = resolve(cwd);
  const abs = resolve(cwd, rel);
  const ok = abs === root || abs.startsWith(`${root}/`) || abs.startsWith(`${root}\\`);
  if (!ok) {
    const err = new Error(`path escapes cwd: ${rel}`);
    err.code = "PATH_ESCAPE";
    throw err;
  }
  return abs;
}

function clip(text) {
  if (text.length <= MAX_CAPTURE) return text;
  return text.slice(-Math.floor(MAX_CAPTURE / 2));
}

export function normalizeTerms(rawTerms) {
  if (!Array.isArray(rawTerms) || rawTerms.length === 0) {
    throw new Error("ce_open requires at least one term");
  }
  return rawTerms.map((term, i) => {
    const id = String(term.id || `T${i + 1}`);
    const text = String(term.text || "").trim();
    if (!text) throw new Error(`${id}: term.text is required`);
    const kind = term.kind === "judgment" ? "judgment" : "mechanical";
    const check = term.check ? { ...term.check } : undefined;
    if (kind === "mechanical") {
      if (!check || !check.type) {
        throw new Error(`${id}: mechanical term needs check.type (cmd|path)`);
      }
      if (check.type === "cmd") {
        if (!check.cmd || !String(check.cmd).trim()) {
          throw new Error(`${id}: cmd check needs check.cmd`);
        }
      } else if (check.type === "path") {
        if (!check.path || !String(check.path).trim()) {
          throw new Error(`${id}: path check needs check.path`);
        }
      } else {
        throw new Error(`${id}: unknown check.type ${check.type}`);
      }
    }
    return { id, text, kind, check };
  });
}

export function makeContract({ summary, terms }) {
  return {
    version: CONTRACT_VERSION,
    status: "open",
    opened_at: new Date().toISOString(),
    closed_at: null,
    summary: String(summary || "").trim() || "ce-lite contract",
    terms: normalizeTerms(terms),
  };
}

function runCmd(cmd, { cwd, timeoutMs }) {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, {
      cwd,
      shell: true,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: process.env.LANG || "C",
        TERM: "dumb",
      },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolvePromise(result);
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({
        exit: -1,
        stdout: clip(stdout),
        stderr: clip(stderr),
        error: `timeout ${timeoutMs}ms`,
      });
    }, timeoutMs);
    child.stdout?.on("data", (d) => {
      stdout += d;
      if (stdout.length > MAX_CAPTURE) stdout = clip(stdout);
    });
    child.stderr?.on("data", (d) => {
      stderr += d;
      if (stderr.length > MAX_CAPTURE) stderr = clip(stderr);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ exit: code ?? -1, stdout: clip(stdout), stderr: clip(stderr) });
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      finish({
        exit: -1,
        stdout: clip(stdout),
        stderr: clip(stderr),
        error: String(e),
      });
    });
  });
}

export async function runOneCheck(term, { cwd }) {
  if (term.kind === "judgment") {
    return {
      id: term.id,
      ok: false,
      kind: "judgment",
      detail: "judgment terms cannot pass the mechanical shield",
    };
  }
  const check = term.check;
  const timeoutMs = Math.min(
    Math.max(Number(check.timeout_ms) || DEFAULT_TIMEOUT_MS, 1),
    MAX_TIMEOUT_MS,
  );
  if (check.type === "path") {
    let abs;
    try {
      abs = resolveInCwd(cwd, check.path);
    } catch (e) {
      return { id: term.id, ok: false, kind: "mechanical", detail: e.message };
    }
    if (!existsSync(abs)) {
      return {
        id: term.id,
        ok: false,
        kind: "mechanical",
        detail: `missing file: ${check.path}`,
      };
    }
    const body = readFileSync(abs, "utf8");
    const needle = check.contains == null ? "" : String(check.contains);
    if (needle && !body.includes(needle)) {
      return {
        id: term.id,
        ok: false,
        kind: "mechanical",
        detail: `path ${check.path} does not contain ${JSON.stringify(needle)}`,
      };
    }
    return {
      id: term.id,
      ok: true,
      kind: "mechanical",
      detail: needle
        ? `path ${check.path} contains ${JSON.stringify(needle)}`
        : `path ${check.path} exists`,
    };
  }
  if (check.type === "cmd") {
    const expectedExit = check.exit == null ? 0 : Number(check.exit);
    const ran = await runCmd(String(check.cmd), { cwd, timeoutMs });
    const output = `${ran.stdout || ""}${ran.stderr || ""}`;
    const expect = check.expect == null ? "" : String(check.expect);
    const exitOk = ran.exit === expectedExit;
    const expectOk = !expect || output.includes(expect);
    const ok = exitOk && expectOk && !ran.error;
    let detail;
    if (ran.error) detail = ran.error;
    else if (!exitOk) detail = `exit ${ran.exit}, expected ${expectedExit}`;
    else if (!expectOk) detail = `output missing ${JSON.stringify(expect)}`;
    else detail = `exit ${ran.exit}${expect ? `, found ${JSON.stringify(expect)}` : ""}`;
    return {
      id: term.id,
      ok,
      kind: "mechanical",
      detail,
      exit: ran.exit,
      stdout: clip(ran.stdout || ""),
      stderr: clip(ran.stderr || ""),
    };
  }
  return {
    id: term.id,
    ok: false,
    kind: "mechanical",
    detail: `unknown check.type ${check?.type}`,
  };
}

export async function runChecks(contract, { cwd }) {
  const results = [];
  for (const term of contract.terms) {
    results.push(await runOneCheck(term, { cwd }));
  }
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const judgment = results.filter((r) => r.kind === "judgment").length;
  const green = total > 0 && passed === total && judgment === 0;
  return {
    version: AUDIT_VERSION,
    audited_at: new Date().toISOString(),
    contract_sha256: hashContract(contract),
    cwd: resolve(cwd),
    results,
    passed,
    total,
    judgment,
    green,
  };
}

export function canClose(contract, audit) {
  if (!contract || contract.status === "closed") {
    return { ok: false, reason: "no open contract" };
  }
  if (!audit) return { ok: false, reason: "no audit" };
  if (audit.contract_sha256 !== hashContract(contract)) {
    return { ok: false, reason: "audit does not match current contract (stale or forged)" };
  }
  if (audit.judgment > 0) {
    return { ok: false, reason: "judgment terms cannot pass the mechanical shield" };
  }
  if (!audit.green) {
    const failed = (audit.results || [])
      .filter((r) => !r.ok)
      .map((r) => r.id)
      .join(", ");
    return { ok: false, reason: failed ? `failed terms: ${failed}` : "audit not green" };
  }
  return { ok: true, reason: "all mechanical terms passed on re-run" };
}

export function detectForgery(claimedAudit, freshAudit) {
  if (!claimedAudit || typeof claimedAudit !== "object") {
    return { forged: false, detail: "no claimed audit" };
  }
  if (claimedAudit.green === true && freshAudit.green === false) {
    return { forged: true, detail: "claimed green; re-run is red" };
  }
  if (claimedAudit.contract_sha256 && claimedAudit.contract_sha256 !== freshAudit.contract_sha256) {
    return { forged: true, detail: "claimed audit hash does not match contract" };
  }
  const claimedPass = Number(claimedAudit.passed);
  if (Number.isFinite(claimedPass) && claimedPass !== freshAudit.passed) {
    return { forged: true, detail: `claimed passed=${claimedPass}; re-run passed=${freshAudit.passed}` };
  }
  return { forged: false, detail: "claimed audit matches re-run" };
}

export function formatMatrix(audit) {
  const rows = (audit.results || []).map((r) => {
    const mark = r.ok ? "PASS" : "FAIL";
    return `${mark} ${r.id}: ${r.detail}`;
  });
  const shield = audit.green ? "green" : "red";
  return [`ce ${audit.passed}/${audit.total} · shield ${shield}`, ...rows].join("\n");
}

export const WRITE_TOOLS = new Set([
  "write",
  "edit",
  "ctx_edit",
  "ctx_patch",
  "ctx_write",
]);

export const SHELL_TOOLS = new Set(["bash", "shell", "ctx_shell"]);

export function isScratchMeta(rel) {
  const n = String(rel || "").replace(/\\/g, "/");
  return (
    n.includes(".scratch/ce-contract.json") ||
    n.includes(".scratch/ce-audit.json") ||
    n.includes(".scratch/ce-observed.json") ||
    n.endsWith("ce-lite-auditor.mjs") ||
    n.endsWith("test-ce-lite-shield.mjs")
  );
}

export function extractWritePath(_toolName, input) {
  if (!input || typeof input !== "object") return null;
  const p = input.path || input.file_path || input.file;
  if (typeof p !== "string") return null;
  const trimmed = p.trim();
  return trimmed && !isScratchMeta(trimmed) ? trimmed : null;
}

export function extractWriteContains(_toolName, input) {
  if (!input || typeof input !== "object") return "";
  const text = [input.new_string, input.newText, input.new_text, input.content]
    .find((v) => typeof v === "string" && v.trim());
  if (!text) return "";
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 12 && l.length <= 80)
    .filter((l) => !/^(\/\/|#|\*|\/\*)/.test(l));
  const preferred = lines.find((l) => /^(export |function |class |const |let |var |def |async )/.test(l));
  return (preferred || lines[0] || "").slice(0, 80);
}

export function extractShellCommand(input) {
  if (!input || typeof input !== "object") return "";
  const cmd = input.command || input.cmd;
  return typeof cmd === "string" ? cmd.trim() : "";
}

export function isTestCommand(cmd) {
  if (!cmd || typeof cmd !== "string") return false;
  const c = cmd.trim();
  if (!c) return false;
  if (c.includes("ce-lite-auditor") || c.includes("test-ce-lite-shield")) return false;
  return (
    /\b(npm|pnpm|yarn|bun)\s+(test|run\s+test)\b/i.test(c) ||
    /\b(pytest|cargo\s+test|go\s+test|vitest|jest)\b/i.test(c) ||
    /\bnode\s+\S*test\S*/i.test(c)
  );
}

export function inferTerms({ writes = [], cmds = [] } = {}) {
  const terms = [];
  const seen = new Set();
  for (const w of writes) {
    const path = typeof w === "string" ? w : w?.path;
    if (!path || isScratchMeta(path) || seen.has(`path:${path}`)) continue;
    seen.add(`path:${path}`);
    const contains = typeof w === "string" ? "" : String(w.contains || "");
    terms.push({
      id: `W${terms.filter((t) => t.id.startsWith("W")).length + 1}`,
      text: `written file still holds: ${path}`,
      kind: "mechanical",
      check: { type: "path", path, contains },
    });
  }
  for (const cmd of cmds) {
    const c = String(cmd || "").trim();
    if (!c || !isTestCommand(c) || seen.has(`cmd:${c}`)) continue;
    seen.add(`cmd:${c}`);
    terms.push({
      id: `C${terms.filter((t) => t.id.startsWith("C")).length + 1}`,
      text: `re-run: ${c}`,
      kind: "mechanical",
      check: { type: "cmd", cmd: c, exit: 0 },
    });
  }
  return terms;
}

export function makeAutoContract({ writes, cmds, summary }) {
  const terms = inferTerms({ writes, cmds });
  if (terms.length === 0) return null;
  return makeContract({
    summary: summary || `auto: ${writes?.length || 0} files, ${cmds?.length || 0} tests`,
    terms,
  });
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--") && a.includes("=")) {
      const [k, ...rest] = a.slice(2).split("=");
      out[k] = rest.join("=");
    } else if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) out[k] = true;
      else {
        out[k] = next;
        i++;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

async function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || "audit";
  if (cmd === "help" || args.help) {
    printJson({
      usage: [
        "node ce-lite-auditor.mjs audit --contract FILE --cwd DIR [--out FILE]",
        "node ce-lite-auditor.mjs close-check --contract FILE --cwd DIR [--claimed FILE]",
      ],
    });
    return 0;
  }
  const cwd = resolve(String(args.cwd || process.cwd()));
  const paths = contractPaths(cwd);
  const contractPath = resolve(String(args.contract || paths.contract));
  if (!existsSync(contractPath)) {
    printJson({ error: `missing contract: ${contractPath}` });
    return 2;
  }
  const contract = loadJson(contractPath);
  if (cmd === "audit") {
    const audit = await runChecks(contract, { cwd });
    const outPath = resolve(String(args.out || paths.audit));
    saveJson(outPath, audit);
    printJson({ ...audit, matrix: formatMatrix(audit), out: outPath });
    return audit.green ? 0 : 1;
  }
  if (cmd === "close-check") {
    const fresh = await runChecks(contract, { cwd });
    const claimedPath = args.claimed ? resolve(String(args.claimed)) : null;
    const claimed = claimedPath && existsSync(claimedPath) ? loadJson(claimedPath) : null;
    const forgery = detectForgery(claimed, fresh);
    const decision = canClose(contract, fresh);
    const outPath = resolve(String(args.out || paths.audit));
    saveJson(outPath, fresh);
    printJson({
      ...decision,
      forged: forgery.forged,
      forge_detail: forgery.detail,
      audit: fresh,
      matrix: formatMatrix(fresh),
    });
    if (!decision.ok) return 1;
    return 0;
  }
  printJson({ error: `unknown command: ${cmd}` });
  return 2;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      printJson({ error: String(err?.stack || err) });
      process.exit(2);
    });
}
