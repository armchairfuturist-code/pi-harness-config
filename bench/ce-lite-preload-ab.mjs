#!/usr/bin/env node
/**
 * ce-lite-preload A/B — no LLM, extension context-hook path.
 *
 * Loads the DEPLOYED ce-lite-preload extension via jiti, captures its
 * `before_agent_start` handler, and fires it with every real historical
 * first-user-prompt from ~/.pi/agent/sessions. Measures:
 *
 *  1. PAYLOAD — chars + est. tokens injected per match (stub vs full mode)
 *  2. PRECISION — how many real sessions the heuristic matches, split by
 *     whether the session actually did multi-step tool work (>=2 tool calls)
 *     vs stayed single-turn chat/lookup. That split is the real bloat signal:
 *     matching a multi-step session = replacing (or pre-empting) a voluntary
 *     skill read; matching a chat session = pure added tokens.
 *  3. BASELINE — how many historical sessions ever read ce-lite/SKILL.md
 *     voluntarily with APPEND_SYSTEM active (activation-fragility evidence)
 *  4. H4 GUARD — handler must never set systemPrompt
 *  5. DOUBLE-READ — among matched sessions, count that ALSO contain a
 *     ce-lite/SKILL.md ctx_read later (post-deploy signal; historical = 0 by
 *     definition since preload is new)
 *
 * Usage:
 *   node bench/ce-lite-preload-ab.mjs             # summary (default)
 *   node bench/ce-lite-preload-ab.mjs --json      # machine-readable
 *   --sessions DIR   override session dir
 *   --ext PATH       override extension (default deployed)
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EXT =
	process.env.PI_PRELOAD_EXT ||
	path.join(os.homedir(), ".pi/agent/extensions/ce-lite-preload.ts");
const DEFAULT_SESS =
	process.env.PI_SESSIONS_DIR || path.join(os.homedir(), ".pi/agent/sessions");

function parseArgs(argv) {
	const out = { json: false, sessions: DEFAULT_SESS, ext: DEFAULT_EXT };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--json") out.json = true;
		else if (a === "--sessions" && argv[i + 1]) out.sessions = argv[++i];
		else if (a === "--ext" && argv[i + 1]) out.ext = argv[++i];
		else if (a === "--help" || a === "-h") out.help = true;
	}
	return out;
}

function loadJiti() {
	const require = createRequire(import.meta.url);
	const paths = [
		path.join(os.homedir(), ".pi/agent/npm/node_modules"),
		path.join(
			os.homedir(),
			".local/share/pi-node/node-v22.23.1-linux-x64/lib/node_modules/@earendil-works/pi-coding-agent/node_modules",
		),
		"/home/alex/.local/share/pi-node/node-v22.23.1-linux-x64/lib/node_modules/@earendil-works/pi-coding-agent/node_modules",
	];
	let jitiPath;
	try {
		jitiPath = require.resolve("jiti", { paths });
	} catch (e) {
		throw new Error(`jiti not found: ${e.message}`);
	}
	return require(jitiPath)(import.meta.url, { esmResolve: true, interopDefault: true });
}

async function captureBeforeAgentStart(extPath, fakeEvent) {
	if (!fs.existsSync(extPath)) throw new Error(`extension missing: ${extPath}`);
	const jiti = loadJiti();
	const mod = jiti(extPath);
	const def = mod.default || mod;
	if (typeof def !== "function") throw new Error("extension default export is not a function");
	let handler;
	const fakePi = {
		on(ev, fn) {
			if (ev === "before_agent_start") handler = fn;
		},
	};
	def(fakePi);
	if (typeof handler !== "function") {
		throw new Error("extension did not register before_agent_start handler");
	}
	return handler(fakeEvent, {});
}

function loadSessions(dir) {
	const out = [];
	if (!fs.existsSync(dir)) return out;
	const walk = (d) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name.endsWith(".jsonl")) out.push(p);
		}
	};
	walk(dir);
	return out;
}

function readLines(file) {
	try {
		return fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

function firstUserPrompt(lines) {
	for (const raw of lines) {
		try {
			const d = JSON.parse(raw);
			if (d.type !== "message") continue;
			const m = d.message;
			if (!m || m.role !== "user") continue;
			const parts = Array.isArray(m.content) ? m.content : [{ text: m.content }];
			for (const c of parts) {
				if (c && typeof c.text === "string" && c.text.trim()) return c.text.trim();
			}
		} catch {
			/* skip malformed line */
		}
	}
	return null;
}

function toolCallCount(lines) {
	let n = 0;
	for (const raw of lines) {
		try {
			const d = JSON.parse(raw);
			if (d.type !== "message") continue;
			const m = d.message;
			if (!m || m.role !== "assistant") continue;
			for (const c of Array.isArray(m.content) ? m.content : []) {
				if (c && c.type === "toolCall") n++;
			}
		} catch {
			/* skip */
		}
	}
	return n;
}

// Sessions that contain at least one ce-lite/SKILL.md ctx_read tool call.
function readSkill(lines) {
	for (const raw of lines) {
		try {
			const d = JSON.parse(raw);
			if (d.type !== "message") continue;
			const m = d.message;
			if (!m || m.role !== "assistant") continue;
			for (const c of Array.isArray(m.content) ? m.content : []) {
				if (!c || c.type !== "toolCall") continue;
				const input = JSON.stringify(c.input ?? c.arguments ?? {});
				if (input.includes("ce-lite/SKILL.md")) return true;
			}
		} catch {
			/* skip */
		}
	}
	return false;
}

const estTokens = (s) => Math.round(String(s).length / 4);

async function main() {
	const args = parseArgs(process.argv);
	if (args.help) {
		console.log("node bench/ce-lite-preload-ab.mjs [--json] [--sessions DIR] [--ext PATH]");
		return;
	}

	const sessions = loadSessions(args.sessions);
	const items = []; // { prompt, toolCalls, readSkill }
	for (const f of sessions) {
		const lines = readLines(f);
		const prompt = firstUserPrompt(lines);
		if (!prompt) continue;
		items.push({ prompt, toolCalls: toolCallCount(lines), readSkill: readSkill(lines) });
	}

	// --- H4 guard (static) ---
	const src = fs.readFileSync(args.ext, "utf8");
	if (/systemPrompt\s*:/.test(src)) throw new Error("H4 GUARD FAIL: extension sets systemPrompt");

	// --- Payload (real handler; fresh instance each call) ---
	const stubRes = await captureBeforeAgentStart(args.ext, {
		prompt: "implement the multi-file refactor and add tests",
	});
	const stubContent = stubRes?.message?.content ?? "";
	const stubChars = stubContent.length ?? 0;
	const stubMode = stubRes?.message?.details?.contentMode ?? "?";
	const oldFull = process.env.CE_LITE_PRELOAD_FULL;
	process.env.CE_LITE_PRELOAD_FULL = "1";
	const fullRes = await captureBeforeAgentStart(args.ext, {
		prompt: "implement the multi-file refactor and add tests",
	});
	process.env.CE_LITE_PRELOAD_FULL = oldFull ?? "";
	const fullContent = fullRes?.message?.content ?? "";
	const fullChars = fullContent.length ?? 0;

	// --- Precision: fire real handler on every historical first prompt ---
	let matched = 0;
	let skipped = 0;
	let matchedMultistep = 0; // matched AND >=2 tool calls
	let matchedChat = 0; // matched AND <2 tool calls (likely chat/lookup)
	let multiStepTotal = 0;
	const missedEditLike = [];
	for (const it of items) {
		if (it.toolCalls >= 2) multiStepTotal++;
		const res = await captureBeforeAgentStart(args.ext, { prompt: it.prompt });
		const injected = !!res?.message;
		if (injected) {
			matched++;
			if (it.toolCalls >= 2) matchedMultistep++;
			else matchedChat++;
		} else {
			skipped++;
			if (
				it.toolCalls >= 2 &&
				/(edit|fix|debug|implement|refactor|multi|test|error|script|analyze|research)/i.test(
					it.prompt,
				)
			) {
				missedEditLike.push({ prompt: it.prompt.slice(0, 120), toolCalls: it.toolCalls });
			}
		}
	}

	const total = items.length;
	const voluntaryReads = items.filter((i) => i.readSkill).length;
	const result = {
		sessions_scanned: sessions.length,
		sessions_with_prompt: total,
		payload: {
			stub_chars: stubChars,
			stub_est_tokens: estTokens(stubContent),
			stub_mode: stubMode,
			full_chars: fullChars,
			full_est_tokens: estTokens(fullContent),
			savings_pct: Math.round((1 - stubChars / fullChars) * 100),
		},
		precision: {
			matched,
			skipped,
			match_rate_pct: total ? Math.round((matched / total) * 100) : 0,
			matched_multistep: matchedMultistep,
			matched_chat_like: matchedChat,
			multi_step_sessions_total: multiStepTotal,
			// Of all genuinely multi-step sessions, how many did the heuristic catch?
			recall_on_multistep_pct: multiStepTotal
				? Math.round((matchedMultistep / multiStepTotal) * 100)
				: 0,
			missed_editlike_sample: missedEditLike.slice(0, 8),
		},
		activation_baseline: {
			voluntary_reads: voluntaryReads,
			sessions_in_sample: total,
			voluntary_activation_rate_pct: total
				? Math.round((voluntaryReads / total) * 100)
				: 0,
			note: "APPEND_SYSTEM was active for these sessions; share that ever read ce-lite/SKILL.md on their own = fragility evidence",
		},
		h4_guard: true,
		double_read_post_deploy: {
			note: "preload is newly deployed; historical sessions cannot contain it. Re-run after N sessions to measure real double-read rate.",
			historical_skill_reads: voluntaryReads,
		},
	};

	if (args.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log("=== ce-lite-preload A/B (no LLM, deployed extension) ===");
	console.log(`sessions scanned : ${sessions.length}  (with first prompt: ${total})`);
	console.log("");
	console.log("1) PAYLOAD (per matched session, injected as user message):");
	console.log(`   stub: ${stubChars} chars ≈ ${estTokens(stubContent)} tok  [mode=${stubMode}]`);
	console.log(`   full: ${fullChars} chars ≈ ${estTokens(fullContent)} tok`);
	console.log(`   stub saves ~${result.payload.savings_pct}% of the full body`);
	console.log("");
	console.log("2) HEURISTIC on real traffic (multi-step proxy = >=2 tool calls):");
	console.log(
		`   matched: ${matched}  (multistep ${matchedMultistep} · chat-like ${matchedChat})`,
	);
	console.log(`   skipped: ${skipped}`);
	console.log(`   match_rate ${result.precision.match_rate_pct}% · recall on multistep ${result.precision.recall_on_multistep_pct}%`);
	console.log(`   multistep sessions total: ${multiStepTotal}`);
	console.log("");
	console.log("   Bloat math (worst case, all dummy-chat matches = pure waste):");
	console.log(
		`   ${matchedChat} chat-like matches × ${estTokens(stubContent)} tok = ${matchedChat * estTokens(stubContent)} tok / ${total} sessions`,
	);
	console.log("");
	console.log("3) ACTIVATION BASELINE (fragility evidence):");
	console.log(
		`   ${voluntaryReads}/${total} (${result.activation_baseline.voluntary_activation_rate_pct}%) voluntarily read ce-lite/SKILL.md with APPEND_SYSTEM active`,
	);
	console.log(
		`   → advisory prompt ignored most of the time; preload makes ${result.precision.matched_multistep} of ${multiStepTotal} multistep sessions deterministic`,
	);
	console.log("");
	console.log("4) H4 (no systemPrompt mutation):", result.h4_guard ? "PASS" : "FAIL");
	console.log("");
	console.log("5) DOUBLE-READ: preload is new; historical double-read = 0 by definition.");
	console.log("   Missed edit-like multistep prompts (recall gaps, sample):");
	for (const m of result.precision.missed_editlike_sample) {
		console.log(`   - [${m.toolCalls} toolcalls] ${m.prompt}`);
	}
	console.log("");
	console.log("Verdict (tokens): stub ~" + estTokens(stubContent) + " tok per matched session.");
	console.log("  Net-neutral per matched multi-step session IF it would otherwise have read");
	console.log("  the skill; pure overhead only on chat-like matches (" + matchedChat + " historical).");
}

main().catch((e) => {
	console.error("ce-lite-preload A/B failed:", e.message);
	process.exit(1);
});
