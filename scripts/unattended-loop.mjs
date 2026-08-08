#!/usr/bin/env node
/**
 * unattended-loop.mjs — supervisor for long-running / autoresearch pi sessions.
 *
 * Owns successive `pi --print` generations. When rot-sentinel writes
 * ~/.pi/.scratch/ROT_HANDOFF.json (critical), this process stops the current
 * generation and starts a fresh one with a resume prompt. You do not manually
 * open a new session when running under this wrapper.
 *
 * Usage:
 *   scripts/unattended-loop.mjs --goal "Continue HIL from Iter 10"
 *   scripts/unattended-loop.mjs --goal-file ./GOAL.md --cwd ~/Projects/foo
 *   scripts/unattended-loop.mjs --max-generations 8 --max-wall-min 240
 *   scripts/unattended-loop.mjs --dry-run --goal "test"
 *   PI_LOOP_BIN=./fake-pi.sh scripts/unattended-loop.mjs --goal "x"   # test
 *
 * Stop early:  touch ~/.pi/.scratch/STOP_LOOP
 *
 * Env:
 *   PI_LOOP_BIN          override binary (default: pi)
 *   PI_LOOP_POLL_MS      marker poll interval (default 2000)
 *   PI_LOOP_GRACE_MS     SIGTERM→SIGKILL grace (default 15000)
 *   PI_LOOP_STATE_DIR    state/logs (default ~/.pi/.scratch/unattended-loop)
 *   PI_LOOP_EXTRA_ARGS   extra pi CLI args (space-separated)
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOME = os.homedir();
const SCRATCH = path.join(HOME, ".pi", ".scratch");
const MARKER_MD = path.join(SCRATCH, "ROT_HANDOFF.md");
const MARKER_JSON = path.join(SCRATCH, "ROT_HANDOFF.json");
const WORKSTATE = path.join(SCRATCH, "WORKSTATE.md");
const STOP_FILE = path.join(SCRATCH, "STOP_LOOP");

function parseArgs(argv) {
  const out = {
    goal: process.env.PI_LOOP_GOAL || "",
    goalFile: "",
    cwd: process.cwd(),
    maxGenerations: Number(process.env.PI_LOOP_MAX_GEN || 12),
    maxWallMin: Number(process.env.PI_LOOP_MAX_WALL_MIN || 480),
    pollMs: Number(process.env.PI_LOOP_POLL_MS || 2000),
    graceMs: Number(process.env.PI_LOOP_GRACE_MS || 15000),
    bin: process.env.PI_LOOP_BIN || "pi",
    extraArgs: (process.env.PI_LOOP_EXTRA_ARGS || "").trim().split(/\s+/).filter(Boolean),
    stateDir: process.env.PI_LOOP_STATE_DIR || path.join(SCRATCH, "unattended-loop"),
    handoffHints: [],
    dryRun: false,
    resumeOnly: false,
    help: false,
    namePrefix: "unattended",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--resume-only") out.resumeOnly = true;
    else if (a === "--goal") out.goal = next() || "";
    else if (a === "--goal-file") out.goalFile = next() || "";
    else if (a === "--cwd") out.cwd = path.resolve(next() || out.cwd);
    else if (a === "--max-generations") out.maxGenerations = Number(next());
    else if (a === "--max-wall-min") out.maxWallMin = Number(next());
    else if (a === "--poll-ms") out.pollMs = Number(next());
    else if (a === "--bin") out.bin = next() || out.bin;
    else if (a === "--name-prefix") out.namePrefix = next() || out.namePrefix;
    else if (a === "--handoff") out.handoffHints.push(next() || "");
    else if (a === "--") {
      out.extraArgs.push(...argv.slice(i + 1));
      break;
    }
  }
  return out;
}

function usage() {
  return `unattended-loop — multi-generation pi supervisor (rot-aware)

  --goal TEXT            Primary goal (required unless --goal-file / --resume-only)
  --goal-file PATH       Read goal from file
  --cwd DIR              Working directory for pi (default: cwd)
  --max-generations N    Cap generations (default 12)
  --max-wall-min N       Cap wall clock minutes (default 480)
  --poll-ms N            Rot marker poll interval (default 2000)
  --handoff PATH         Extra HANDOFF.md paths to cite in resume prompt (repeatable)
  --name-prefix STR      pi --name prefix (default unattended)
  --bin PATH             pi binary (or PI_LOOP_BIN)
  --dry-run              Print plan only
  --resume-only          Single generation from existing marker/WORKSTATE
  --                     Extra args passed to every pi invocation

Stop file: ${STOP_FILE}
Markers:   ${MARKER_JSON} (+ ${MARKER_MD})
`;
}

function log(stateDir, msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.error(line);
  try {
    fs.appendFileSync(path.join(stateDir, "loop.log"), line + "\n");
  } catch {
    /* ignore */
  }
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function markerSnapshot() {
  const j = readJsonSafe(MARKER_JSON);
  let mtimeMs = 0;
  try {
    mtimeMs = fs.statSync(MARKER_JSON).mtimeMs;
  } catch {
    try {
      mtimeMs = fs.statSync(MARKER_MD).mtimeMs;
    } catch {
      mtimeMs = 0;
    }
  }
  const mdExists = fs.existsSync(MARKER_MD);
  const critical =
    (j && j.critical === true) ||
    (mdExists && /ROT_HANDOFF|critical/i.test(fs.readFileSync(MARKER_MD, "utf8").slice(0, 500)));
  return { json: j, mtimeMs, mdExists, critical: Boolean(critical && (j || mdExists)) };
}

function archiveMarkers(stateDir, gen) {
  const dir = path.join(stateDir, `gen-${String(gen).padStart(3, "0")}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [src, name] of [
    [MARKER_MD, "ROT_HANDOFF.md"],
    [MARKER_JSON, "ROT_HANDOFF.json"],
    [WORKSTATE, "WORKSTATE.md"],
  ]) {
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, path.join(dir, name));
      } catch {
        /* ignore */
      }
    }
  }
  // Clear live markers so next gen only trips on a fresh critical write
  for (const p of [MARKER_MD, MARKER_JSON]) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
  return dir;
}

function buildPrompt({ goal, gen, maxGen, handoffHints, resume, lastArchive }) {
  const hints = [
    WORKSTATE,
    MARKER_MD,
    lastArchive ? path.join(lastArchive, "ROT_HANDOFF.md") : "",
    lastArchive ? path.join(lastArchive, "WORKSTATE.md") : "",
    ...handoffHints.filter(Boolean),
  ].filter(Boolean);
  const hintBlock = hints.map((h) => `- ${h}`).join("\n");

  if (!resume && gen === 0) {
    return [
      "You are running under an unattended multi-generation supervisor.",
      "Work the GOAL below. Prefer durable artifacts (files, ledger, tests) over chat.",
      "If context rot becomes critical, rot-sentinel will write ~/.pi/.scratch/ROT_HANDOFF.md.",
      "When that happens (or CE-lite handoff triggers): write/update WORKSTATE.md + project HANDOFF,",
      "then STOP — do not start large new threads. The supervisor will spawn the next generation.",
      "",
      `Generation: 1 / ${maxGen}`,
      "",
      "GOAL:",
      goal,
    ].join("\n");
  }

  return [
    `Unattended loop resume — generation ${gen + 1} / ${maxGen}.`,
    "Previous generation ended (context-rot handoff or clean exit with remaining work).",
    "",
    "Resume protocol:",
    "1. Read these files if they exist:",
    hintBlock,
    "2. Continue the GOAL without redoing completed work.",
    "3. Verify with tests/commands before claiming done.",
    "4. On rot-critical again: update WORKSTATE/HANDOFF and STOP.",
    "5. If GOAL is fully done: update WORKSTATE status=DONE and exit cleanly.",
    "",
    "GOAL:",
    goal,
  ].join("\n");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run one pi generation. Returns { code, reason, durationMs }.
 * reason: exit | rot | stop | timeout_wall | error
 */
function runGeneration(opts, prompt, gen) {
  const { bin, cwd, extraArgs, namePrefix, pollMs, graceMs, stateDir, maxWallMin, startedAt } =
    opts;

  return new Promise((resolve) => {
    const genStart = Date.now();
    const baseline = markerSnapshot();
    const name = `${namePrefix}-g${gen + 1}`;
    const args = [
      "--print",
      "--name",
      name,
      ...extraArgs,
      prompt,
    ];

    log(stateDir, `gen ${gen + 1}: spawn ${bin} ${args.slice(0, -1).join(" ")} <prompt ${prompt.length}ch>`);
    log(stateDir, `gen ${gen + 1}: cwd=${cwd}`);

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve(result);
    };

    let child;
    try {
      child = spawn(bin, args, {
        cwd,
        env: { ...process.env, PI_UNATTENDED_LOOP: "1", PI_LOOP_GENERATION: String(gen + 1) },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      finish({ code: 127, reason: "error", durationMs: 0, error: String(e) });
      return;
    }

    const outPath = path.join(stateDir, `gen-${String(gen).padStart(3, "0")}-stdout.log`);
    const errPath = path.join(stateDir, `gen-${String(gen).padStart(3, "0")}-stderr.log`);
    const outFd = fs.openSync(outPath, "a");
    const errFd = fs.openSync(errPath, "a");

    child.stdout.on("data", (d) => {
      fs.writeSync(outFd, d);
      process.stdout.write(d);
    });
    child.stderr.on("data", (d) => {
      fs.writeSync(errFd, d);
      process.stderr.write(d);
    });

    const killChild = (sig) => {
      try {
        if (!child.killed) child.kill(sig);
      } catch {
        /* ignore */
      }
      // also try process group if any
      try {
        if (child.pid) process.kill(-child.pid, sig);
      } catch {
        /* ignore */
      }
    };

    const timer = setInterval(() => {
      if (settled) return;

      if (fs.existsSync(STOP_FILE)) {
        log(stateDir, `gen ${gen + 1}: STOP_LOOP seen — terminating`);
        killChild("SIGTERM");
        setTimeout(() => killChild("SIGKILL"), graceMs);
        finish({
          code: null,
          reason: "stop",
          durationMs: Date.now() - genStart,
        });
        return;
      }

      const wallMs = opts.maxWallMin * 60 * 1000;
      if (Date.now() - startedAt > wallMs) {
        log(stateDir, `gen ${gen + 1}: wall clock exceeded — terminating`);
        killChild("SIGTERM");
        setTimeout(() => killChild("SIGKILL"), graceMs);
        finish({
          code: null,
          reason: "timeout_wall",
          durationMs: Date.now() - genStart,
        });
        return;
      }

      const snap = markerSnapshot();
      // Fresh critical marker written after this gen started
      if (
        snap.critical &&
        snap.mtimeMs > baseline.mtimeMs + 50 &&
        snap.mtimeMs >= genStart - 1000
      ) {
        log(
          stateDir,
          `gen ${gen + 1}: ROT marker detected (score=${snap.json?.score ?? "?"}) — stopping generation`,
        );
        // Give the agent a brief moment to finish writing WORKSTATE if mid-write
        setTimeout(() => {
          killChild("SIGTERM");
          setTimeout(() => killChild("SIGKILL"), graceMs);
        }, 1500);
        finish({
          code: null,
          reason: "rot",
          durationMs: Date.now() - genStart,
          rot: snap.json,
        });
      }
    }, pollMs);

    child.on("error", (e) => {
      fs.closeSync(outFd);
      fs.closeSync(errFd);
      finish({
        code: 127,
        reason: "error",
        durationMs: Date.now() - genStart,
        error: String(e),
      });
    });

    child.on("exit", (code, signal) => {
      fs.closeSync(outFd);
      fs.closeSync(errFd);
      // If we already finished due to rot/stop, keep that reason
      if (settled) return;
      finish({
        code: code ?? (signal ? 1 : 0),
        reason: "exit",
        signal,
        durationMs: Date.now() - genStart,
      });
    });
  });
}

function goalDoneHeuristic(stateDir, gen) {
  // WORKSTATE says DONE / complete
  try {
    const ws = fs.readFileSync(WORKSTATE, "utf8");
    if (/\bstatus\s*[:=]\s*DONE\b/i.test(ws) || /\bSTATUS:\s*DONE\b/i.test(ws)) {
      return true;
    }
  } catch {
    /* no workstate */
  }
  // archived workstate from this gen
  const arch = path.join(stateDir, `gen-${String(gen).padStart(3, "0")}`, "WORKSTATE.md");
  try {
    const ws = fs.readFileSync(arch, "utf8");
    if (/\bstatus\s*[:=]\s*DONE\b/i.test(ws)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  if (args.goalFile) {
    args.goal = fs.readFileSync(path.resolve(args.goalFile), "utf8").trim();
  }
  if (!args.goal && args.resumeOnly) {
    // fall back to WORKSTATE / marker
    try {
      args.goal = fs.readFileSync(WORKSTATE, "utf8").trim().slice(0, 4000);
    } catch {
      args.goal = "Resume from ROT_HANDOFF and continue prior work.";
    }
  }
  if (!args.goal) {
    console.error("error: --goal or --goal-file required (or --resume-only with WORKSTATE)");
    console.error(usage());
    process.exit(2);
  }

  fs.mkdirSync(args.stateDir, { recursive: true });
  fs.mkdirSync(SCRATCH, { recursive: true });

  const startedAt = Date.now();
  const runMeta = {
    startedAt: new Date(startedAt).toISOString(),
    goal: args.goal,
    cwd: args.cwd,
    maxGenerations: args.maxGenerations,
    maxWallMin: args.maxWallMin,
    bin: args.bin,
    generations: [],
  };

  log(args.stateDir, `loop start cwd=${args.cwd} maxGen=${args.maxGenerations} bin=${args.bin}`);
  log(args.stateDir, `goal: ${args.goal.slice(0, 200).replace(/\n/g, " ")}`);

  if (args.dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          prompt0: buildPrompt({
            goal: args.goal,
            gen: 0,
            maxGen: args.maxGenerations,
            handoffHints: args.handoffHints,
            resume: false,
          }),
          promptResume: buildPrompt({
            goal: args.goal,
            gen: 1,
            maxGen: args.maxGenerations,
            handoffHints: args.handoffHints,
            resume: true,
          }),
          paths: { MARKER_JSON, MARKER_MD, WORKSTATE, STOP_FILE, stateDir: args.stateDir },
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  // Clear stale stop file from prior runs unless resume-only wants it?
  if (fs.existsSync(STOP_FILE)) {
    log(args.stateDir, `removing stale STOP_LOOP`);
    try {
      fs.unlinkSync(STOP_FILE);
    } catch {
      /* ignore */
    }
  }

  let gen = 0;
  let finalReason = "max_generations";
  const startGen = 0;
  let lastArchive = "";
  let consecutiveFastFails = 0;
  const FAST_FAIL_MS = Number(process.env.PI_LOOP_FAST_FAIL_MS || 5000);
  const FAST_FAIL_MAX = Number(process.env.PI_LOOP_FAST_FAIL_MAX || 2);

  while (gen < args.maxGenerations) {
    if (fs.existsSync(STOP_FILE)) {
      finalReason = "stop";
      break;
    }
    if ((Date.now() - startedAt) / 60000 >= args.maxWallMin) {
      finalReason = "timeout_wall";
      break;
    }

    const resume = args.resumeOnly || gen > startGen;
    const prompt = buildPrompt({
      goal: args.goal,
      gen,
      maxGen: args.maxGenerations,
      handoffHints: args.handoffHints,
      resume,
      lastArchive,
    });

    // Archive any pre-existing marker so we only react to NEW critical writes
    if (markerSnapshot().critical || fs.existsSync(MARKER_MD) || fs.existsSync(MARKER_JSON)) {
      const arch = archiveMarkers(args.stateDir, `pre-${gen}`);
      lastArchive = arch;
      log(args.stateDir, `archived pre-gen markers → ${arch}`);
    }

    const result = await runGeneration(
      { ...args, startedAt },
      prompt,
      gen,
    );

    const archDir = archiveMarkers(args.stateDir, gen);
    lastArchive = archDir;
    const entry = {
      gen: gen + 1,
      ...result,
      archived: archDir,
    };
    runMeta.generations.push(entry);
    fs.writeFileSync(
      path.join(args.stateDir, "run.json"),
      JSON.stringify(runMeta, null, 2),
    );
    log(
      args.stateDir,
      `gen ${gen + 1} done reason=${result.reason} code=${result.code} ms=${result.durationMs}`,
    );

    if (result.reason === "stop") {
      finalReason = "stop";
      break;
    }
    if (result.reason === "timeout_wall") {
      finalReason = "timeout_wall";
      break;
    }
    if (result.reason === "error") {
      finalReason = "error";
      log(args.stateDir, `fatal: ${result.error || "spawn error"}`);
      break;
    }

    if (result.reason === "rot") {
      // continue to next generation
      gen += 1;
      if (args.resumeOnly) {
        // resume-only is single-shot unless rot forces... still allow one more? no — honor single
        finalReason = "rot_resume_only";
        break;
      }
      await sleep(500);
      continue;
    }

    // clean exit
    if (goalDoneHeuristic(args.stateDir, gen) || result.code === 0) {
      // If exit 0, treat as success unless WORKSTATE says otherwise incomplete
      if (goalDoneHeuristic(args.stateDir, gen)) {
        finalReason = "done";
        break;
      }
      // exit 0 without DONE — might still need more work; check if agent left CONTINUE
      try {
        const ws = fs.readFileSync(WORKSTATE, "utf8");
        if (/\bCONTINUE\b/i.test(ws) || /\bstatus\s*[:=]\s*IN_PROGRESS\b/i.test(ws)) {
          gen += 1;
          continue;
        }
      } catch {
        /* no ws */
      }
      finalReason = "exit_clean";
      break;
    }

    // non-zero exit without rot
    if (
      result.reason === "exit" &&
      result.code &&
      result.code !== 0 &&
      result.durationMs < FAST_FAIL_MS
    ) {
      consecutiveFastFails += 1;
      log(
        args.stateDir,
        `gen ${gen + 1} fast-fail (${result.durationMs}ms code=${result.code}) streak=${consecutiveFastFails}/${FAST_FAIL_MAX}`,
      );
      if (consecutiveFastFails >= FAST_FAIL_MAX) {
        finalReason = "fast_fail";
        log(
          args.stateDir,
          `aborting: ${FAST_FAIL_MAX} consecutive sub-${FAST_FAIL_MS}ms failures (likely extension/config error — fix and retry; try pi -ne to isolate)`,
        );
        break;
      }
    } else {
      consecutiveFastFails = 0;
    }
    log(args.stateDir, `gen ${gen + 1} non-zero exit; starting next generation`);
    gen += 1;
  }

  runMeta.finishedAt = new Date().toISOString();
  runMeta.finalReason = finalReason;
  runMeta.ok = ["done", "exit_clean"].includes(finalReason);
  fs.writeFileSync(path.join(args.stateDir, "run.json"), JSON.stringify(runMeta, null, 2));
  log(args.stateDir, `loop end reason=${finalReason} ok=${runMeta.ok} gens=${runMeta.generations.length}`);
  console.log(
    JSON.stringify(
      {
        ok: runMeta.ok,
        finalReason,
        generations: runMeta.generations.length,
        stateDir: args.stateDir,
        run: path.join(args.stateDir, "run.json"),
      },
      null,
      2,
    ),
  );
  process.exit(runMeta.ok ? 0 : finalReason === "stop" ? 0 : 1);
}

main().catch((e) => {
  console.error("unattended-loop fatal:", e);
  process.exit(2);
});
