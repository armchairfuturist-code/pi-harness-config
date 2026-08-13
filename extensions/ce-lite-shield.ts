// ce-lite shield — automatic. Watches writes/tests, audits on settle, gates Done.
// Manual ce_* tools are overrides. A planted ce-audit.json cannot pass.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const here = dirname(fileURLToPath(import.meta.url));
const auditorPath = join(here, "ce-lite-auditor.mjs");
const MAX_NUDGES = 2;

type TermInput = {
  id?: string;
  text: string;
  kind?: string;
  check?: {
    type?: string;
    cmd?: string;
    expect?: string;
    exit?: number;
    path?: string;
    contains?: string;
    timeout_ms?: number;
  };
};

type Observed = {
  writes: Record<string, string>;
  cmds: string[];
  manual: boolean;
  nudges: number;
};

function textResult(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details };
}

function runAuditor(
  args: string[],
  cwd: string,
): Promise<{ code: number; json: Record<string, unknown>; raw: string }> {
  return new Promise((resolvePromise, reject) => {
 const child = spawn(process.execPath, [auditorPath].concat(args), {
      cwd,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, LANG: process.env.LANG || "C" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d;
    });
    child.stderr.on("data", (d) => {
      stderr += d;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const raw = stdout.trim() || stderr.trim();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(stdout);
      } catch {
        json = { error: raw || `auditor exit ${code}` };
      }
      resolvePromise({ code: code ?? 2, json, raw });
    });
  });
}

function stateDirOf(cwd: string, create = false): string {
  const abs = resolve(cwd);
  const home = resolve(homedir());
  const agentHome = dirname(here);
  const unsafe = abs === "/" || abs === "/home" || abs === home;
  if (!unsafe) {
    const scratch = join(abs, ".scratch");
    if (!create) return scratch;
    try {
      mkdirSync(scratch, { recursive: true });
      return scratch;
    } catch {
      // fall through
    }
  }
  const slug = createHash("sha256").update(abs).digest("hex").slice(0, 12);
  const fallback = join(agentHome, ".scratch", "ce-lite", slug);
  if (create) mkdirSync(fallback, { recursive: true });
  return fallback;
}

function contractRel(cwd: string, create = false) {
  return join(stateDirOf(cwd, create), "ce-contract.json");
}
function auditRel(cwd: string, create = false) {
  return join(stateDirOf(cwd, create), "ce-audit.json");
}
function observedRel(cwd: string, create = false) {
  return join(stateDirOf(cwd, create), "ce-observed.json");
}

function statusFromAudit(audit: Record<string, unknown> | undefined) {
  if (!audit || typeof audit.passed !== "number" || typeof audit.total !== "number") {
    return "ce · auto";
  }
  const shield = audit.green ? "green" : "red";
  return `ce ${audit.passed}/${audit.total} · shield ${shield}`;
}

function matrixText(payload: Record<string, unknown>) {
  if (typeof payload.matrix === "string") return payload.matrix;
  return JSON.stringify(payload, null, 2);
}


function handoffPath(cwd: string): string {
  const dir = stateDirOf(cwd, true);
  return join(dir, "HANDOFF.md");
}
function writeHandoff(cwd: string, reason: string, extras: Record<string, unknown> = {}) {
  const prep = (extras.preparation && typeof extras.preparation === "object") ? extras.preparation as Record<string, unknown> : {};
  const fileOps = (prep.fileOps && typeof prep.fileOps === "object") ? prep.fileOps as { read?: string[]; edited?: string[] } : {};
  const read = (fileOps.read || []).slice(0, 24);
  const edited = (fileOps.edited || []).slice(0, 24);
  let contractBlock = "- none";
  try {
    if (existsSync(contractRel(cwd, false))) {
      const raw = JSON.parse(readFileSync(contractRel(cwd, false), "utf8"));
      const terms = Array.isArray(raw.terms) ? raw.terms : [];
      contractBlock = terms.map((t: { id?: string; text?: string }) => `- ${t.id || "?"} ${t.text || ""} ${raw.status || "open"}`).join("\n") || "- none";
    }
  } catch { /* keep none */ }
  const body = [
    `# HANDOFF`,
    `reason: ${reason}`,
    `updated: ${new Date().toISOString()}`,
    "",
    "## Goal",
    String(extras.goal || "(see conversation)"),
    "",
    "## Constraints",
    "- host-written; same schema as pi compaction",
    "",
    "## Progress",
    "### Done",
    extras.done || "- (see contract)",
    "### In Progress",
    extras.inProgress || "- (see conversation)",
    "### Blocked",
    extras.blocked || "- none",
    "",
    "## Key Decisions",
    extras.decisions || "- (see conversation)",
    "",
    "## Next Steps",
    extras.next || "- continue user task",
    "",
    "## Critical Context",
    extras.critical || "- see contract and file lists",
    "",
    "## Contract",
    contractBlock,
    "",
    "## Model note",
    extras.modelNote || "-",
    "",
    "<read-files>",
    read.join("\n") || "(none)",
    "</read-files>",
    "<modified-files>",
    edited.join("\n") || "(none)",
    "</modified-files>",
    "",
  ].join("\n");
  writeFileSync(handoffPath(cwd), body);
}
function appendCompound(cwd: string, audit: Record<string, unknown> | null, summary: string) {
  const dir = join(homedir(), ".pi", "memory");
  mkdirSync(dir, { recursive: true });
  const files = existsSync(observedRel(cwd, false))
    ? Object.keys(JSON.parse(readFileSync(observedRel(cwd, false), "utf8")).writes || {}).slice(0, 8)
    : [];
  const block = [
    "",
    `## ${new Date().toISOString().slice(0, 10)} ${summary || "contract"}`,
    `- passed: ${audit?.passed ?? "?"}/${audit?.total ?? "?"}`,
    `- files: ${files.join(", ") || "(none)"}`,
    "- do-not-repeat: see HANDOFF if compact fired",
    "",
  ].join("\n");
  appendFileSync(join(dir, "solutions.md"), block);
}

function emptyObserved(): Observed {
  return { writes: {}, cmds: [], manual: false, nudges: 0 };
}

export default function (pi: ExtensionAPI) {
  const cwdOf = () => pi.cwd || process.cwd();
  const pendingShell = new Map<string, string>();
  let lastAudit: Record<string, unknown> | null = null;
  let settling = false;
  let injectingNudge = false;
  const loadMod = () => import(auditorPath);

  const loadObserved = async (): Promise<Observed> => {
    const path = observedRel(cwdOf(), false);
    if (!existsSync(path)) return emptyObserved();
    try {
      const { loadJson } = await loadMod();
      const raw = loadJson(path);
      return {
        writes: raw.writes && typeof raw.writes === "object" ? raw.writes : {},
        cmds: Array.isArray(raw.cmds) ? raw.cmds : [],
        manual: !!raw.manual,
        nudges: Number(raw.nudges) || 0,
      };
    } catch {
      return emptyObserved();
    }
  };

  const saveObserved = async (obs: Observed) => {
    const { saveJson } = await loadMod();
    stateDirOf(cwdOf(), true);
    saveJson(observedRel(cwdOf(), false), obs);
  };

  const refreshStatus = async () => {
    const cwd = cwdOf();
    if (!existsSync(contractRel(cwd, false))) {
      pi.setStatus?.("");
      return;
    }
    if (lastAudit) {
      pi.setStatus?.(statusFromAudit(lastAudit));
      return;
    }
    const auditPath = auditRel(cwd, false);
    if (!existsSync(auditPath)) {
      pi.setStatus?.("ce · auto");
      return;
    }
    try {
      const { loadJson } = await loadMod();
      lastAudit = loadJson(auditPath);
      pi.setStatus?.(statusFromAudit(lastAudit));
    } catch {
      pi.setStatus?.("ce · auto");
    }
  };

  const syncAutoContract = async (obs: Observed) => {
    if (obs.manual) return;
    const { makeAutoContract, saveJson } = await loadMod();
    const writes = Object.entries(obs.writes).map(([path, contains]) => ({ path, contains }));
    const contract = makeAutoContract({ writes, cmds: obs.cmds });
    if (!contract) return;
    stateDirOf(cwdOf(), true);
    saveJson(contractRel(cwdOf(), false), contract);
    pi.setStatus?.(`ce 0/${contract.terms.length} · shield red`);
  };

  const autoAuditAndGate = async (reason: string) => {
    if (settling) return;
    const cwd = cwdOf();
    const contractPath = contractRel(cwd, false);
    if (!existsSync(contractPath)) return;
    const { loadJson } = await loadMod();
    const existing = loadJson(contractPath);
    if (existing?.status === "closed") return;
    settling = true;
    try {
      const ran = await runAuditor(
        [
          "close-check",
          "--contract",
          contractPath,
          "--cwd",
          cwd,
          "--claimed",
          auditRel(cwd, false),
          "--out",
          auditRel(cwd, true),
        ],
        cwd,
      );
      const payload = ran.json;
      lastAudit = (payload.audit as Record<string, unknown>) || payload;
      pi.setStatus?.(statusFromAudit(lastAudit));
      if (payload.ok === true) {
        const { loadJson, saveJson } = await loadMod();
        const contract = loadJson(contractPath);
        contract.status = "closed";
        contract.closed_at = new Date().toISOString();
        saveJson(contractPath, contract);
        pi.setStatus?.(
          `ce ${(lastAudit?.passed as number) ?? ""}/${(lastAudit?.total as number) ?? ""} · closed`,
        );
        try { appendCompound(cwd, lastAudit, String((payload as { reason?: string }).reason || "closed")); } catch { /* ignore */ }
        try { writeHandoff(cwd, "shield-green", { next: "continue user task" }); } catch { /* ignore */ }
        return;
      }
      const failedIds = Array.isArray((payload as { failed?: string[] }).failed)
        ? ((payload as { failed: string[] }).failed)
        : Array.isArray((lastAudit as { results?: { id: string; ok: boolean }[] })?.results)
          ? (lastAudit as { results: { id: string; ok: boolean }[] }).results.filter((r) => !r.ok).map((r) => r.id)
          : [];
      const reasonText = String((payload as { reason?: string }).reason || "");
      const unfixable = /no open contract|judgment terms|does not match current contract/i.test(reasonText);
      // Don't start a new turn unless the agent can actually fix a failed check.
      if (unfixable || failedIds.length === 0) return;
      const obs = await loadObserved();
      if (obs.nudges >= MAX_NUDGES) return;
      obs.nudges += 1;
      await saveObserved(obs);
      const failed = failedIds.join(", ");
      const body = [
          `[ce-lite shield] auto-audit after ${reason}${payload.ok === true ? "" : " — not closed"}.`,
          payload.reason && payload.ok !== true ? `reason: ${payload.reason}` : "",
          payload.matrix || "no matrix",
          failed ? `Failed: ${failed}` : "",
          payload.ok === true ? "" : "Fix failed checks if any. Do not call ce_open unless adding extra checks.",
        ]
.filter(Boolean)
        .join(String.fromCharCode(10));
      injectingNudge = true;
      try {
        pi.sendUserMessage(body, { deliverAs: "followUp", triggerTurn: true });
      } finally {
        injectingNudge = false;
      }
    } catch {
      // never crash the session
    } finally {
      settling = false;
    }
  };

  pi.registerTool({
    name: "ce_open",
    label: "ce-open",
    description:
      "Override: replace the auto-inferred contract with explicit terms. Usually unnecessary — the shield records writes/tests itself.",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One-line contract summary" },
        terms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              kind: { type: "string", description: "mechanical (default) or judgment" },
              check: {
                type: "object",
                properties: {
                  type: { type: "string", description: "cmd or path" },
                  cmd: { type: "string" },
                  expect: { type: "string" },
                  exit: { type: "number" },
                  path: { type: "string" },
                  contains: { type: "string" },
                  timeout_ms: { type: "number" },
                },
              },
            },
            required: ["text"],
          },
        },
      },
      required: ["terms"],
    },
    execute: async (_id, params) => {
      const cwd = cwdOf();
      const { makeContract, saveJson } = await loadMod();
      try {
        const contract = makeContract({
          summary: String((params as { summary?: string }).summary || ""),
          terms: (params as { terms: TermInput[] }).terms,
        });
        stateDirOf(cwd, true);
        saveJson(contractRel(cwd, false), contract);
        const obs = await loadObserved();
        obs.manual = true;
        await saveObserved(obs);
        lastAudit = null;
        pi.setStatus?.(`ce 0/${contract.terms.length} · shield red`);
        const lines = [
          `opened ${contract.terms.length} terms · ${contract.summary} (manual override)`,
          ...contract.terms.map((t: { id: string; kind: string; text: string }) =>
            `- ${t.id} [${t.kind}] ${t.text}`,
          ),
          "Shield will auto-audit on settle. You do not need to call ce_audit/ce_close.",
        ];
        return textResult(lines.join(String.fromCharCode(10)), { contract });
      } catch (err) {
        return textResult(`ce_open failed: ${String((err as Error).message || err)}`);
      }
    },
  });

  pi.registerTool({
    name: "ce_status",
    label: "ce-status",
    description: "Show the current auto or manual contract and last audit. Does not re-run checks.",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const cwd = cwdOf();
      if (!existsSync(contractRel(cwd, false))) {
        pi.setStatus?.("");
        return textResult("no ce-lite contract yet (no writes/tests this session)");
      }
      const { loadJson } = await loadMod();
      const contract = loadJson(contractRel(cwd, false));
      const audit = existsSync(auditRel(cwd, false)) ? loadJson(auditRel(cwd, false)) : null;
      await refreshStatus();
      const obs = await loadObserved();
      const lines = [
        `status: ${contract.status} · ${obs.manual ? "manual" : "auto"} · ${contract.summary}`,
        ...contract.terms.map((t: { id: string; kind: string; text: string }) =>
          `- ${t.id} [${t.kind}] ${t.text}`,
        ),
      ];
      if (audit) lines.push(statusFromAudit(audit));
      else lines.push("no audit yet — runs automatically after writes/tests");
      return textResult(lines.join(String.fromCharCode(10)), { contract, audit });
    },
  });

  pi.registerTool({
    name: "ce_audit",
    label: "ce-audit",
    description: "Override: re-run checks now. The shield already does this on settle.",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const cwd = cwdOf();
      const ran = await runAuditor(
        ["audit", "--contract", contractRel(cwd, false), "--cwd", cwd, "--out", auditRel(cwd, true)],
        cwd,
      );
      lastAudit = ran.json;
      pi.setStatus?.(statusFromAudit(ran.json));
      if (ran.json.error && !ran.json.results) {
        return textResult(`ce_audit failed: ${ran.json.error}`);
      }
      return textResult(matrixText(ran.json), { audit: ran.json });
    },
  });

  pi.registerTool({
    name: "ce_close",
    label: "ce-close",
    description: "Override: re-run and close now. The shield already closes on a green auto-audit.",
    parameters: { type: "object", properties: {} },
    execute: async () => {
      const cwd = cwdOf();
      const ran = await runAuditor(
        [
          "close-check",
          "--contract",
          contractRel(cwd, false),
          "--cwd",
          cwd,
          "--claimed",
          auditRel(cwd, false),
          "--out",
          auditRel(cwd, true),
        ],
        cwd,
      );
      const payload = ran.json;
      lastAudit = (payload.audit as Record<string, unknown>) || payload;
      pi.setStatus?.(statusFromAudit(lastAudit));
      if (payload.error && payload.ok !== true && payload.ok !== false) {
        return textResult(`ce_close failed: ${payload.error}`);
      }
      if (payload.ok !== true) {
        const forged = payload.forged ? `${String.fromCharCode(10)}forged/stale claimed audit: ${payload.forge_detail}` : "";
        return textResult(
          `CLOSE BLOCKED: ${payload.reason || "audit not green"}${forged}${String.fromCharCode(10)}${payload.matrix || ""}`.trim(),
 { blocked: true, ...payload },
        );
      }
      const { loadJson, saveJson } = await loadMod();
      const contract = loadJson(contractRel(cwd, false));
      contract.status = "closed";
      contract.closed_at = new Date().toISOString();
      saveJson(contractRel(cwd, false), contract);
      pi.setStatus?.(
        `ce ${(lastAudit?.passed as number) ?? ""}/${(lastAudit?.total as number) ?? ""} · closed`,
      );
      return textResult(`CLOSED · ${payload.reason}${String.fromCharCode(10)}${payload.matrix || ""}`.trim(), {
        closed: true,
        ...payload,
      });
    },
  });

  pi.on("session_start", () => {
    lastAudit = null;
    void refreshStatus();
  });

  pi.on("input", async (event) => {
    try {
      if (injectingNudge) return;
      if (event?.source === "extension") return;
      if (!existsSync(observedRel(cwdOf(), false))) return;
      const cwd = cwdOf();
      if (existsSync(contractRel(cwd, false))) {
        const { loadJson } = await loadMod();
        if (loadJson(contractRel(cwd, false))?.status === "closed") return;
      }
      const obs = await loadObserved();
      obs.nudges = 0;
      await saveObserved(obs);
    } catch {
      // never crash a prompt over shield bookkeeping
    }
  });

  pi.on("tool_call", async (event) => {
    try {
      const { WRITE_TOOLS, SHELL_TOOLS, extractWritePath, extractWriteContains, extractShellCommand } =
        await loadMod();
      const name = event.toolName;
      const input = event.input || {};
      if (WRITE_TOOLS.has(name)) {
        const path = extractWritePath(name, input);
        if (!path) return;
        const obs = await loadObserved();
        obs.writes[path] = extractWriteContains(name, input);
        await saveObserved(obs);
        await syncAutoContract(obs);
        return;
      }
      if (SHELL_TOOLS.has(name)) {
        const cmd = extractShellCommand(input);
        if (cmd) pendingShell.set(event.toolCallId, cmd);
      }
    } catch {
      // never crash a tool call
    }
  });

  pi.on("tool_result", async (event) => {
    try {
      const cmd = pendingShell.get(event.toolCallId);
      pendingShell.delete(event.toolCallId);
      if (!cmd || event.isError) return;
      const { isTestCommand } = await loadMod();
      if (!isTestCommand(cmd)) return;
      const obs = await loadObserved();
      if (!obs.cmds.includes(cmd)) obs.cmds.push(cmd);
      await saveObserved(obs);
      await syncAutoContract(obs);
    } catch {
      // never crash a tool result
    }
  });

  pi.on("before_agent_start", async (event) => {
    try {
      const cwd = cwdOf();
      if (!existsSync(contractRel(cwd, false))) return;
      const auditPath = auditRel(cwd, false);
      if (!existsSync(auditPath) && !lastAudit) return;
      const { loadJson } = await loadMod();
      const contract = loadJson(contractRel(cwd, false));
      if (contract.status === "closed") return;
      const audit = lastAudit || loadJson(auditPath);
      if (audit.green) return;
      const failed = Array.isArray(audit.results)
        ? audit.results.filter((r: { ok: boolean }) => !r.ok).map((r: { id: string }) => r.id)
        : [];
      event.messages.push({
        role: "custom",
        customType: "ce-lite-shield",
        display: false,
        content: `[ce-lite-preload] Shield is automatic and currently RED (${audit.passed}/${audit.total}${failed.length ? `; failed ${failed.join(", ")}` : ""}). Do not claim Done. Fix files/tests; do not call ce_open unless adding extra checks.`,
      });
    } catch {
      // ignore
    }
  });

  pi.on("session_before_compact", (event: { preparation?: unknown; reason?: string }) => {
    try {
      writeHandoff(cwdOf(), String(event?.reason || "compact"), { preparation: event?.preparation, next: "resume from HANDOFF" });
    } catch { /* never block compact */ }
  });
  pi.on("agent_settled", () => {
    void autoAuditAndGate("agent_settled");
  });
}

