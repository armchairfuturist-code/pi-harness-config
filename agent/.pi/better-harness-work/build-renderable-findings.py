#!/usr/bin/env python3
"""Build findings.json matching better-harness software-fluency schema."""
from __future__ import annotations

import json
from pathlib import Path

OUT = Path("/home/alex/.pi/agent/.pi/better-harness")
RUN = OUT / "_run"

# Dimension scores from reconciled agent handoffs (0-100)
# Map multi-agent dims onto the five agent-work-loop fluency dimensions.
DIMS = {
    "task-understanding": {
        "score": 42,
        "summary": (
            "Entry guidance is weak: no AGENTS.md/SYSTEM.md, skill routing denied by settings, "
            "and multi-model traffic lacks comparable task labels. Session task-understanding "
            "was moderate (58) but project/agent readiness pulls this down."
        ),
        "findingRefs": ["R1", "R2", "R7"],
    },
    "controlled-execution": {
        "score": 34,
        "summary": (
            "Runtime is shell-heavy with systemic lean-ctx allowlist blocks (61) and ~9% tool "
            "error rate across 1648 calls. Skills that should structure execution are disabled "
            "by the global denylist."
        ),
        "findingRefs": ["R1", "R4", "R5"],
    },
    "change-validation": {
        "score": 28,
        "summary": (
            "42 edit-context misses; admission coverage shows withChanges=0 and "
            "withReviewedRelevantCheck=0. Git deny-all prevents durable review of harness edits."
        ),
        "findingRefs": ["R3", "R5"],
    },
    "reliable-delivery": {
        "score": 32,
        "summary": (
            "Long sessions absorb most failures (498m / 41 fails) without structured completion "
            "or outcome review. Delivery looks conversationally closed, not verified."
        ),
        "findingRefs": ["R4", "R6", "R8"],
    },
    "learning-capture": {
        "score": 30,
        "summary": (
            "Inventory envelopes empty/stale; skill invocations unobserved; no AGENTS.md to "
            "capture policy. Package/extension map not written down. Learning-capture stays low."
        ),
        "findingRefs": ["R2", "R7", "R9"],
    },
}

LABELS = {
    "task-understanding": "Task Understanding",
    "controlled-execution": "Controlled Execution",
    "change-validation": "Change Validation",
    "reliable-delivery": "Reliable Delivery",
    "learning-capture": "Learning Capture",
}

findings = [
    {
        "id": "R1",
        "title": "Global skills denylist leaves ~48 installed skills inert",
        "severity": "High",
        "reason": (
            "settings.json sets skills to ['!**','**/ce-lite/**','**/better-harness/**']. "
            "That denies every skill path, then only re-allows ce-lite and better-harness. "
            "48 skill directories exist under agent/skills (last30days, harness-doctor, "
            "pi-dynamic-workflows, graph-engineering, etc.) but cannot load. Architecture "
            "inventory reported 0 skills because enablement is empty, not because the tree is "
            "empty. Session usageActivity.skills stayed empty across eligible sessions."
        ),
        "aiFixPrompt": (
            "Open /home/alex/.pi/agent/settings.json. Replace the skills array denylist "
            "with an explicit allowlist of skills that should load (at minimum: last30days, "
            "harness-doctor, pi-dynamic-workflows, and any CE-lite trigger targets), or remove "
            "the leading '!**' and deny only noisy skills. Keep the JSON valid. Then start a "
            "fresh pi session and confirm the intended skills appear as loaded/available. "
            "Do not delete skill directories."
        ),
        "dimensionRefs": ["task-understanding", "controlled-execution"],
    },
    {
        "id": "R2",
        "title": "No AGENTS.md or SYSTEM.md — only APPEND_SYSTEM.md",
        "severity": "High",
        "reason": (
            "The agent root has APPEND_SYSTEM.md (~1KB) but no AGENTS.md and no SYSTEM.md. "
            "Pi project guidance and architecture practice expect AGENTS.md as the durable "
            "instruction/routing contract. Without it, skill enablement intent, tool policy "
            "(ctx_* vs shell), and git boundaries are not first-class."
        ),
        "aiFixPrompt": (
            "Create /home/alex/.pi/agent/AGENTS.md describing: (1) what this agent home is, "
            "(2) which skills are in-policy and how settings.skills should look, "
            "(3) tool preferences — prefer ctx_read/ctx_edit/ctx_execute; never python -c or "
            "heredoc on shell, write a script file first, (4) git boundaries for agent config. "
            "Keep APPEND_SYSTEM.md for additive notes only. Do not invent secrets."
        ),
        "dimensionRefs": ["task-understanding", "learning-capture"],
    },
    {
        "id": "R3",
        "title": "Root gitignore is deny-all; harness config is not really versioned",
        "severity": "High",
        "reason": (
            "/home/alex/.pi/.gitignore is '*' with narrow re-includes for agent/ and "
            "agent/skills/**. git ls-files under agent is nearly empty while the working tree "
            "shows hundreds of changed/untracked paths (settings, extensions, packages). "
            "Skills intended to be tracked still appear untracked. Harness changes cannot be "
            "reviewed or rolled back as a unit; project profile under-counts the real system."
        ),
        "aiFixPrompt": (
            "Edit /home/alex/.pi/.gitignore so these are tracked: agent/settings.json, "
            "agent/AGENTS.md, agent/APPEND_SYSTEM.md, agent/skills/**, agent/agents/**, and "
            "agent/extensions/*.ts source (not node_modules). Keep sessions/, npm/, caches, "
            "and .pi/better-harness/_run ignored. Then git status and stage a coherent harness "
            "snapshot without adding secrets or session transcripts."
        ),
        "dimensionRefs": ["change-validation"],
    },
    {
        "id": "R4",
        "title": "Shell allowlist blocks dominate runtime failures",
        "severity": "High",
        "reason": (
            "Independent session JSONL analysis (12 eligible sessions): ~1648 tool calls, "
            "~153 isError toolResults (~9.3%), and 61 allowlist blocks — almost all on "
            "ctx_shell (python3 -c/heredoc and lean-ctx allowlist). Agents still prefer "
            "ctx_shell (hundreds of calls) over safer ctx_* APIs, so the same boundary is hit "
            "repeatedly instead of being internalized. Long session S1 ran ~498 minutes with "
            "41 failures."
        ),
        "aiFixPrompt": (
            "Update AGENTS.md (or APPEND_SYSTEM.md if AGENTS.md not yet present) with a hard "
            "rule: never python -c or shell heredoc; write a script file then execute; prefer "
            "ctx_read/ctx_edit/ctx_execute over raw shell. Optionally extend lean-ctx allowlist "
            "only for a few audited high-value patterns. After the first allowlist block in a "
            "session, switch strategy rather than retrying the same shell shape."
        ),
        "dimensionRefs": ["controlled-execution", "reliable-delivery"],
    },
    {
        "id": "R5",
        "title": "Edit/patch context misses without post-change validation evidence",
        "severity": "High",
        "reason": (
            "Independent scan found 42 edit_context_miss/edit errors. Admission coverage "
            "shows withChanges=0 and withReviewedRelevantCheck=0 despite heavy edit/write "
            "volume. validation-repair class appeared once and the only check was lint with "
            "relation=no-change-context. Change-validation score is 28/100."
        ),
        "aiFixPrompt": (
            "Codify edit recovery in AGENTS.md: on edit 'could not find' failures, never retry "
            "identical text; re-read the exact file slice or fall back to sed/perl via shell "
            "only when policy allows. After multi-file edits, run a cheap verification "
            "(rg, json parse, or targeted test) before declaring done."
        ),
        "dimensionRefs": ["change-validation", "controlled-execution"],
    },
    {
        "id": "R6",
        "title": "last30days SKILL.md is ~217KB — context landmine if enabled",
        "severity": "Medium",
        "reason": (
            "skills/last30days/SKILL.md is approximately 222KB. It is currently disabled by "
            "the global denylist. Any broad re-enable without sliming will blow the prompt "
            "budget and regress context health. CE-lite already references last30days tools."
        ),
        "aiFixPrompt": (
            "Refactor /home/alex/.pi/agent/skills/last30days/SKILL.md into a thin top-level "
            "skill (about 5–8KB) with triggers and tool names, moving bulk procedure into "
            "references/ loaded on demand. Do not enable the skill in settings until the slim "
            "entry file exists."
        ),
        "dimensionRefs": ["reliable-delivery"],
    },
    {
        "id": "R7",
        "title": "Harness inventory/lint envelopes empty or stale vs disk reality",
        "severity": "Medium",
        "reason": (
            "Architecture packet envelopes (inventory, agent-lint, pi-optimize) were empty. "
            "On-disk harness-inventory.json is stamped 2026-07-30. Session packet claimed "
            "toolCalls=0 while independent JSONL parse found 1648 calls. Evidence tooling "
            "under-represents the live harness and can produce false idle readings."
        ),
        "aiFixPrompt": (
            "Regenerate harness inventory after settings/skill changes. When a session packet "
            "reports toolCalls=0, cross-check raw JSONL under ~/.pi/agent/sessions before "
            "concluding idle. Document the package→tools map in AGENTS.md so inventory gaps "
            "are visible without envelopes."
        ),
        "dimensionRefs": ["learning-capture", "task-understanding"],
    },
    {
        "id": "R8",
        "title": "Long sessions carry most failures without outcome review",
        "severity": "Medium",
        "reason": (
            "Four long sessions (33% of sample) include a 498-minute thread with 41 failures. "
            "outcomeReview.status=required and reviewedActiveLongCount=0. Structured "
            "completion=0 while assistant handoffs exist — conversational close without "
            "evidential acceptance. Token totals show large cache-read mass across the sample."
        ),
        "aiFixPrompt": (
            "For sessions longer than 60 minutes or after 3+ compactions, require a mid-flight "
            "status note and an end checklist (done/blocked/files touched/verify command). "
            "Use installed session naming/title extensions so long threads stay findable. "
            "Do not claim completion without a verification artifact."
        ),
        "dimensionRefs": ["reliable-delivery"],
    },
    {
        "id": "R9",
        "title": "18 packages and dual extension paths; zero package-exported pi.skills",
        "severity": "Medium",
        "reason": (
            "settings.packages lists about 18 npm modules. Extensions are referenced both "
            "under npm/node_modules paths and agent/extensions/. No package contributes "
            "pi.skills exports, so skill discovery cannot come from packages. Ownership of "
            "tools is unclear and duplicates are hard to audit."
        ),
        "aiFixPrompt": (
            "Add a short inventory section to AGENTS.md: each settings.packages entry → tools "
            "or extensions it provides. Collapse duplicate extension entrypoints between "
            "settings.extensions and agent/extensions. Remove packages that provide nothing "
            "used in the last 30 days of sessions."
        ),
        "dimensionRefs": ["learning-capture"],
    },
    {
        "id": "R10",
        "title": "Custom agents surface is nearly empty (Explore.md only)",
        "severity": "Low",
        "reason": (
            "agent/agents contains Explore.md and a sync json only. There are no specialized "
            "review/build/research agents to absorb complexity while skills fail to load. "
            "All work hits one generalist path."
        ),
        "aiFixPrompt": (
            "After fixing the skills filter, add one focused custom agent (for example "
            "session-forensics or skill-maintainer) under agent/agents/ with a clear tool "
            "allowlist and purpose. Keep Explore.md. Do not create agents before skills are "
            "enableable."
        ),
        "dimensionRefs": ["task-understanding"],
    },
]

dimensions = []
for did, meta in DIMS.items():
    dimensions.append({
        "id": did,
        "label": LABELS[did],
        "score": meta["score"],
        "summary": meta["summary"],
        "findingRefs": meta["findingRefs"],
    })

overall = round(sum(d["score"] for d in dimensions) / len(dimensions))

doc = {
    "summary": {
        "projectName": "pi-agent",
        "modelId": "software-fluency",
        "overview": (
            f"Overall harness score about {overall}/100 (weak/poor). "
            "This pi agent home is skill-rich on disk but skill-blind at runtime: settings.skills "
            "denies nearly all of 48 installed skills except ce-lite and better-harness. There is "
            "no AGENTS.md/SYSTEM.md, root gitignore deny-all prevents real versioning of harness "
            "config, and session forensics show systemic shell allowlist blocks plus edit-context "
            "misses on long multi-model threads. Fix enablement, identity docs, and ignore rules "
            "first; then slim oversized skills and tighten execution policy."
        ),
        "strengths": [
            "Rich on-disk skill library and many useful packages already installed (lean-ctx, better-harness, last30days, dynamic workflows).",
            "Session JSONL is detailed enough for independent forensics (tool calls, models, failures) once packet zeros are cross-checked.",
            "CE-lite and better-harness paths are intentionally enabled and provide a narrow but working skill spine.",
            "Extensions such as transcript-pruner, tool-trimmer, and session-index show active investment in harness hygiene.",
        ],
        "dimensions": dimensions,
        "aiAgentPractice": {
            "inspectedSurfaces": [
                "Rules",
                "Skills",
                "Commands",
                "Custom Agents",
                "MCP",
                "Plugins",
                "Session Insights",
            ],
            "coverageRows": [
                {
                    "surface": "Rules",
                    "scopes": ["project"],
                    "count": 1,
                    "paths": ["APPEND_SYSTEM.md"],
                },
                {
                    "surface": "Skills",
                    "scopes": ["user", "project"],
                    "count": 48,
                    "paths": ["skills/"],
                },
                {
                    "surface": "Commands",
                    "scopes": ["project"],
                    "count": 0,
                    "paths": [],
                },
                {
                    "surface": "Custom Agents",
                    "scopes": ["project"],
                    "count": 1,
                    "paths": ["agents/Explore.md"],
                },
                {
                    "surface": "MCP",
                    "scopes": ["project"],
                    "count": 0,
                    "paths": [],
                },
                {
                    "surface": "Plugins",
                    "scopes": ["project"],
                    "count": 18,
                    "paths": ["settings.json#packages", "extensions/"],
                },
                {
                    "surface": "Session Insights",
                    "scopes": ["user"],
                    "count": 12,
                    "paths": ["sessions/"],
                },
            ],
        },
    },
    "findings": findings,
}

out = OUT / "findings.json"
out.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
print("wrote", out, "overall~", overall, "findings", len(findings))

# also keep full lead reconciliation sidecar
sidecar = {
    "overallScore": overall,
    "byAgentApprox": {
        "project-harness": 24,
        "session-evidence": 40,
        "agent-customize": 27,
    },
    "topActions": [
        "Fix settings.skills filter (P0)",
        "Add AGENTS.md tool+skill contract (P0)",
        "Rewrite .gitignore to version harness config (P0)",
        "Codify ctx_* first + script-file python (P0)",
        "Slim last30days before enable (P1)",
        "Regenerate inventory + package map (P1)",
    ],
    "conflictsResolved": [
        "Packet toolCalls=0 superseded by independent JSONL 1648 calls",
        "Inventory skills=[] and disk skills=48 both true under denylist",
        "SYSTEM.md verified missing; only APPEND_SYSTEM.md",
    ],
}
(RUN / "lead-reconciliation.json").write_text(json.dumps(sidecar, indent=2) + "\n")
print("sidecar ok")
