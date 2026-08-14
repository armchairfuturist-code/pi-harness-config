/**
 * ce-lite-preload.ts — turn-1 deterministic CE-lite contract injection.
 *
 * Problem: APPEND_SYSTEM tells the model to read ce-lite/SKILL.md, but the
 * model rarely does (observed 1/37 real sessions read it voluntarily). This
 * closes the gap mechanically: inject the routing contract ONCE per session
 * on heuristic match.
 *
 * Cache safety (H4 / progressive-disclosure): NEVER mutates systemPrompt.
 * Injects a single custom message (→ LLM user role via convertToLlm) once
 * per session when the user prompt matches non-trivial work heuristics.
 * Base system prefix stays byte-stable for KV cache.
 *
 * Token policy: injects a condensed ~450-token routing stub by default
 * (route table + contract loop + footer). Set CE_LITE_PRELOAD_FULL=1 to
 * instead inject the entire SKILL.md body (heavier; only for debugging).
 *
 * Kill switch: CE_LITE_PRELOAD=0
 * Force all:   CE_LITE_PRELOAD=force (ignore heuristics; still once/session)
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ENV_KEY = "CE_LITE_PRELOAD";
const ENV_FULL = "CE_LITE_PRELOAD_FULL";

/** Action verbs that imply multi-step agent work. */
const ACTION_RE =
	/\b(edit|edits|refactor|implement|debug|fix|fixes|migrate|rewrite|wire\s*up|land|ship|add|create|update|patch|install|deploy|build|analyze|analysis|investigate|research|inspect|review|benchmark|profile|audit|optimize|optimise|tune)\b/i;

/** Objects / surfaces that make those verbs non-trivial. */
const OBJECT_RE =
	/\b(file|files|code|function|module|test|tests|bug|error|harness|extension|script|skill|workflow|agent|config|settings|canary|probe|metric|metrics|ledger|bench|install)\b/i;

/** Path-ish or compound identifiers (runtime-discipline, probe.sh, foo.ts). */
const PATHISH_RE = /[\w.-]+\.(ts|js|mjs|sh|md|json|py)\b|\/[\w./-]+|[\w]+-[\w.-]+/i;

/** Mirrors APPEND_SYSTEM non-trivial triggers; keep skip path cheap. */
export function shouldPreload(prompt: string): boolean {
	const p = (prompt ?? "").trim();
	if (p.length < 16) return false;
	if (/^\[ce-lite shield\]/i.test(p)) return false;

	// Pure conversation / single-token pings
	if (
		/^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|yep|nope|test|ping)\b/i.test(p) &&
		p.length < 48
	) {
		return false;
	}

	// Explicit single-step / chat-only skips
	if (
		/\b(just (a |an )?(question|lookup|check)|quick question|what (is|are|does)|who is|explain (only|briefly)|pure conversation|single[- ]step)\b/i.test(
			p,
		) &&
		!ACTION_RE.test(p)
	) {
		return false;
	}

	// APPEND_SYSTEM-shaped triggers
	if (/\b(2\+|two or more|multi[- ]?step|multi[- ]?file|several files|across files)\b/i.test(p)) {
		return true;
	}
	if (/\b(file edits?|new code|debugging|deliverable|artifact)\b/i.test(p)) {
		return true;
	}
	if (ACTION_RE.test(p) && (OBJECT_RE.test(p) || PATHISH_RE.test(p))) {
		return true;
	}

	// Numbered multi-step plans
	const numbered = p.match(/(?:^|\n)\s*\d+[\.)]\s+\S+/g) ?? [];
	if (numbered.length >= 2) return true;

	// Chained clauses
	const chain = p.match(/\b(and then|then |after that|; also|,\s*then)\b/gi) ?? [];
	if (chain.length >= 2 && p.length > 80) return true;

	return false;
}

function skillCandidates(): string[] {
	const here = dirname(fileURLToPath(import.meta.url));
	return [
		join(homedir(), ".pi/agent/skills/ce-lite/SKILL.md"),
		join(here, "../skills/ce-lite/SKILL.md"),
		join(here, "../bundled-skills/ce-lite/SKILL.md"),
		join(here, "../../bundled-skills/ce-lite/SKILL.md"),
	];
}

function stripFrontmatter(md: string): string {
	if (!md.startsWith("---")) return md.trim();
	const end = md.indexOf("\n---", 3);
	if (end === -1) return md.trim();
	return md.slice(end + 4).trim();
}

/**
 * Condensed routing contract (~450 tokens). Keeps what the model needs to
 * decide route + honor the loop + footer, drops the prose. Full body is
 * still one ctx_read away (APPEND_SYSTEM points at it) for detail.
 */
const CONDENSED_CONTRACT = `# CE-lite contract (condensed)

## Route
- Lookup — answer from memory; no loop.
- Simple — one step; no loop.
- Contract — 2+ steps: grill if fuzzy → terms → diagnose → execute → shield verifies → compound.

## Diagnose
- Neither high → stay here.
- Context high → selective read. Host writes HANDOFF on compact/rot.
- Action high, terms do not share writes → workflow(). Fresh session per agent().
- Both → workflow(); worktree only if a lane must not share cwd.
- Judgment → gather-judge. Never a shield term.
- Config/data work → file-state task: read target + source of truth, then edit directly. Do NOT reverse-engineer the generator/refresh pipeline.
- Recon bound: ~3 probes, then act. 5+ reads with 0 writes = loop. Re-reads of the same file add nothing.

## Worker safety
No destroy without consent. Declared paths only. No creds/remote-social.

## Footer
Done: n/m · artifacts · risks · next
Counts from the shield. Do not call ce_open/ce_audit/ce_close. Do not claim Done if statusline is red.
reason: no open contract = already closed. Continue the user task.
`

function loadSkillBody(): { body: string; path: string | null; treeOk: boolean; missing: string[] } {
	let path: string | null = null;
	let raw = "";
	for (const c of skillCandidates()) {
		if (existsSync(c)) {
			path = c;
			raw = readFileSync(c, "utf8");
			break;
		}
	}
	if (!path) {
		return { path: null, treeOk: false, missing: ["SKILL.md"], body: "" };
	}
	const dir = dirname(path);
	const refs = [
		"reference.md",
		"grilling.md",
		"gather-judge.md",
		"context-health.md",
		"wayfinding.md",
	];
	const missing = refs.filter((r) => !existsSync(join(dir, r)));
	return { path, body: stripFrontmatter(raw), treeOk: missing.length === 0, missing };
}

function buildPreloadContent(): { content: string; mode: "stub" | "full" } {
	const { body, path, treeOk, missing } = loadSkillBody();
	const full = (process.env[ENV_FULL] ?? "0").trim() === "1";

	const treeLine = treeOk
		? "Skill tree: OK (reference.md, grilling.md, gather-judge.md, context-health.md, wayfinding.md present)."
		: `Skill tree gap: missing ${missing.join(", ") || "SKILL.md"} — use body alone; do not assume missing refs.`;
	const src = path ? `source: ${path}` : "source: embedded-fallback";
	const head = [
		"[ce-lite-preload] Contract preloaded for this session. Do NOT spend a turn re-reading ce-lite/SKILL.md.",
		"Follow route selection + contract loop below now. Skip only if this turn is truly single-step lookup/chat.",
		treeLine,
		src,
		"",
	];
	if (full && body) {
		return { mode: "full", content: [...head, body].join("\n") };
	}
	return { mode: "stub", content: [...head, CONDENSED_CONTRACT].join("\n") };
}

export default function (pi: ExtensionAPI) {
	let injected = false;

	pi.on("session_start", async (_event, _ctx) => {
		injected = false;
	});

	pi.on("session_end", async (_event, _ctx) => {
		injected = false;
	});

	pi.on("before_agent_start", async (event, _ctx) => {
		const mode = (process.env[ENV_KEY] ?? "1").trim().toLowerCase();
		if (mode === "0" || mode === "off" || mode === "false") return;

		if (injected) return;

		const prompt = event.prompt ?? "";
		const force = mode === "force" || mode === "always";
		if (!force && !shouldPreload(prompt)) return;

		injected = true;
		const { content, mode: contentMode } = buildPreloadContent();

		return {
			// Custom message → convertToLlm maps to role:user. System prefix untouched (H4-safe).
			message: {
				customType: "ce-lite-preload",
				content,
				display: false,
				details: {
					reason: force ? "force" : "heuristic",
					contentMode,
					chars: content.length,
				},
			},
		};
	});
}
