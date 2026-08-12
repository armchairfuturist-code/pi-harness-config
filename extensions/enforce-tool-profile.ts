/**
 * enforce-tool-profile.ts — active lean-ctx tool-profile watchdog.
 *
 * Problem: lean-ctx's config.toml `tool_profile` key only accepts
 * minimal|standard|power; the "lean"/"auto" profiles are internal-to-state
 * and are stored as the ABSENCE of the key. A config.toml pin of
 * `tool_profile = "lean"` is therefore IGNORED by the runtime, and the ACTIVE
 * profile can silently drift to `power` (82 tool schemas / ~+12.7k tok per
 * turn). The pre-push preflight only blocks pushes; nothing corrected the live
 * runtime. This extension enforces the repo pin on EVERY pi launch.
 *
 * Enforcement runs in the factory body (a top-level await of
 * scripts/enforce-tool-profile.sh --fix), so it happens at module load — before
 * provider/tool startup — regardless of which lifecycle hooks fire. The
 * session_start handler is kept as a re-check for long-lived sessions.
 *
 * "Always lean unless specifically changed" = change the pin in
 * lean-ctx/config.toml (and lean-ctx/pi-config.json); the watchdog enforces
 * whatever the repo pins.
 *
 * Kill switch: LEAN_TOOL_PROFILE_WATCHDOG=0
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ENV_KEY = "LEAN_TOOL_PROFILE_WATCHDOG";
const SCRIPT = join(homedir(), ".pi", "agent", "scripts", "enforce-tool-profile.sh");

function enforce(): Promise<void> {
	return new Promise((resolve) => {
		if (!existsSync(SCRIPT)) return resolve();
		execFile(SCRIPT, ["--fix", "--quiet"], { timeout: 15000 }, (err) => {
			// --quiet suppresses the clean "tool profile OK" line. Log only
			// unexpected failures (drift that could not be corrected).
			if (err && !String(err.message ?? "").includes("tool profile OK")) {
				console.error(`[enforce-tool-profile] ${err.message}`);
			}
			resolve();
		});
	});
}

export default async function (pi: ExtensionAPI) {
	const enabled = (process.env[ENV_KEY] ?? "1").trim().toLowerCase();
	if (enabled === "0" || enabled === "off" || enabled === "false") return;

	// Enforce at load: pi awaits async factory bodies before continuing startup
	// (docs: "If the factory returns a Promise, pi awaits it before continuing
	// startup"), so the profile is snapped to the repo pin before pi builds the
	// tool surface.
	await enforce();

	// Re-check on each new session in case the runtime drifted mid-process.
	pi.on("session_start", async () => {
		await enforce();
	});
}
