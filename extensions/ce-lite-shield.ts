// ce-lite shield — automatic. Watches writes/tests, audits on settle, gates Done.
// Manual ce_* tools are overrides. A planted ce-audit.json cannot pass.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
    const child = spawn(process.execPath, [auditorPath, ...args], {
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

function contractRel(cwd: string) {
  return join(cwd, ".scratch", "ce-contract.json");
}
function auditRel(cwd: string) {
  return join(cwd, ".scratch", "ce-audit.json");
}
function observedRel(cwd: string) {
  return join(cwd, ".scratch", "ce-observed.json");
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

function emptyObserved(): Observed {
  return { writes: {}, cmds: [], manual: false, nudges: 0 };
}

export default function (pi: ExtensionAPI) {
  const cwdOf = () => pi.cwd || process.cwd();
  const pendingShell = new Map<string, string>();
  let lastAudit: Record<string, unknown> | null = null;
  let settling = false;

  const loadMod = () => import(auditorPath);

  const loadObserved = async (): Promise<Observed> => {
    const path = observedRel(cwdOf());
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
    mkdirSync(join(cwdOf(), ".scratch"), { recursive: true });
    saveJson(observedRel(cwdOf()), obs);
  };

  const refreshStatus = async () => {
    const cwd = cwdOf();
    if (!existsSync(contractRel(cwd))) {
      pi.setStatus?.("");
      return;
    }
    if (lastAudit) {
      pi.setStatus?.(statusFromAudit(lastAudit));
      return;
    }
    const auditPath = auditRel(cwd);
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
    mkdirSync(join(cwdOf(), ".scratch"), { recursive: true });
    saveJson(contractRel(cwdOf()), contract);
    pi.setStatus?.(`ce 0/${contract.terms.length} · shield red`);
  };

  const autoAuditAndGate = async (reason: string) => {
    if (settling) return;
    const cwd = cwdOf();
    const contractPath = contractRel(cwd);
    if (!existsSync(contractPath)) return;
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
          auditRel(cwd),
          "--out",
          auditRel(cwd),
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
        return;
      }
      const obs = await loadObserved();
      if (obs.nudges >= MAX_NUDGES) return;
      obs.nudges += 1;
      await saveObserved(obs);
      const failed = Array.isArray((lastAudit as { results?: { id: string; ok: boolean }[] })?.results)
        ? (lastAudit as { results: { id: string; ok: boolean }[] }).results
            .filter((r) => !r.ok)
            .map((r) => r.id)
            .join(", ")
        : "";
      const body = [
        `[ce-lite shield] auto-audit red after ${reason} — do not claim Done.`,
        payload.matrix || payload.reason || "shield red",
        failed ? `Failed: ${failed}` : "",
        "Fix the failed files/tests. The shield re-runs itself. Do not call ce_open unless adding extra checks.",
      ]
        .filter(Boolean)
        .join("\n");
      pi.sendUserMessage(body, { deliverAs: "followUp", triggerTurn: true });
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
        mkdirSync(join(cwd, ".scratch"), { recursive: true });
        saveJson(contractRel(cwd), contract);
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
        return textResult(lines.join("\n"), { contract });
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
      if (!existsSync(contractRel(cwd))) {
        pi.setStatus?.("");
        return textResult("no ce-lite contract yet (no writes/tests this session)");
      }
      const { loadJson } = await loadMod();
      const contract = loadJson(contractRel(cwd));
      const audit = existsSync(auditRel(cwd)) ? loadJson(auditRel(cwd)) : null;
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
      return textResult(lines.join("\n"), { contract, audit });
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
        ["audit", "--contract", contractRel(cwd), "--cwd", cwd, "--out", auditRel(cwd)],
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
          contractRel(cwd),
          "--cwd",
          cwd,
          "--claimed",
          auditRel(cwd),
          "--out",
          auditRel(cwd),
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
        const forged = payload.forged ? `\nforged/stale claimed audit: ${payload.forge_detail}` : "";
        return textResult(
          `CLOSE BLOCKED: ${payload.reason || "audit not green"}${forged}\n${payload.matrix || ""}`.trim(),
          { blocked: true, ...payload },
        );
      }
      const { loadJson, saveJson } = await loadMod();
      const contract = loadJson(contractRel(cwd));
      contract.status = "closed";
      contract.closed_at = new Date().toISOString();
      saveJson(contractRel(cwd), contract);
      pi.setStatus?.(
        `ce ${(lastAudit?.passed as number) ?? ""}/${(lastAudit?.total as number) ?? ""} · closed`,
      );
      return textResult(`CLOSED · ${payload.reason}\n${payload.matrix || ""}`.trim(), {
        closed: true,
        ...payload,
      });
    },
  });

  pi.on("session_start", () => {
    lastAudit = null;
    void refreshStatus();
  });

  pi.on("input", async () => {
    const obs = await loadObserved();
    obs.nudges = 0;
    await saveObserved(obs);
  });

  pi.on("tool_call", async (event) => {
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
  });

  pi.on("tool_result", async (event) => {
    const cmd = pendingShell.get(event.toolCallId);
    pendingShell.delete(event.toolCallId);
    if (!cmd || event.isError) return;
    const { isTestCommand } = await loadMod();
    if (!isTestCommand(cmd)) return;
    const obs = await loadObserved();
    if (!obs.cmds.includes(cmd)) obs.cmds.push(cmd);
    await saveObserved(obs);
    await syncAutoContract(obs);
  });

  pi.on("before_agent_start", async (event) => {
    const cwd = cwdOf();
    if (!existsSync(contractRel(cwd))) return;
    const auditPath = auditRel(cwd);
    if (!existsSync(auditPath) && !lastAudit) return;
    try {
      const { loadJson } = await loadMod();
      const contract = loadJson(contractRel(cwd));
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

  pi.on("agent_settled", () => {
    void autoAuditAndGate("agent_settled");
  });
}
