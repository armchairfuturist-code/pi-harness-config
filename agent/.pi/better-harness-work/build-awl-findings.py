#!/usr/bin/env python3
"""Build agent-work-loop-v4 compact findings.json for better-harness render."""
from __future__ import annotations
import json
from pathlib import Path

OUT = Path("/home/alex/.pi/agent/.pi/better-harness")

DIM_ORDER = [
    ("task-understanding", "Task Understanding", 42, ["R1", "R2", "R7"],
     "Entry guidance is weak: no AGENTS.md or SYSTEM.md, skill routing denied by settings, and multi-model traffic lacks comparable task labels. Session comprehension is mixed while project readiness stays low."),
    ("controlled-execution", "Controlled Execution", 34, ["R1", "R4", "R5"],
     "Runtime is shell-heavy with systemic lean-ctx allowlist blocks and about a 9 percent tool error rate across roughly 1600 calls. Skills that should structure execution are disabled by the global denylist."),
    ("change-validation", "Change Validation", 28, ["R3", "R5"],
     "Dozens of edit-context misses and no reviewed relevant checks. Root git deny-all prevents durable review of harness edits, so change validation cannot close the loop."),
    ("reliable-delivery", "Reliable Delivery", 32, ["R4", "R6", "R8"],
     "Long sessions absorb most failures, including a multi-hour thread with dozens of failures, without structured completion or outcome review. Delivery often looks closed conversationally, not verified."),
    ("learning-capture", "Learning Capture", 36, ["R2", "R7", "R9"],
     "Inventory envelopes are empty or stale, skill invocations are unobserved, and there is no AGENTS.md to capture policy. Package and extension ownership is not written down."),
]

findings = [
    {
        "id": "R1",
        "title": "Global skills denylist leaves installed skills inert",
        "severity": "High",
        "reason": (
            "settings.json sets skills to a leading deny-all pattern and only re-allows ce-lite and better-harness. "
            "About 48 skill directories exist under agent/skills (including last30days, harness-doctor, "
            "pi-dynamic-workflows, and graph-engineering) but cannot load. Architecture inventory reported zero "
            "skills because enablement is empty, not because the tree is empty. Session skill usage stayed empty."
        ),
        "aiFixPrompt": (
            "Edit agent/settings.json. Replace the skills array denylist with an explicit allowlist of skills "
            "that should load (at minimum last30days, harness-doctor, pi-dynamic-workflows, and any CE-lite "
            "trigger targets), or remove the leading deny-all entry and deny only noisy skills. Keep JSON valid. "
            "Start a fresh session and confirm intended skills appear as available. Do not delete skill directories."
        ),
        "dimensionRefs": ["task-understanding", "controlled-execution"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R2",
        "title": "No AGENTS.md or SYSTEM.md — only APPEND_SYSTEM.md",
        "severity": "High",
        "reason": (
            "The agent root has APPEND_SYSTEM.md only. AGENTS.md and SYSTEM.md are missing. Pi project guidance "
            "expects AGENTS.md as the durable instruction and routing contract. Without it, skill enablement "
            "intent, tool policy, and git boundaries are not first-class."
        ),
        "aiFixPrompt": (
            "Create agent/AGENTS.md describing what this agent home is, which skills are in-policy, tool "
            "preferences (prefer ctx_read/ctx_edit/ctx_execute; never python -c or shell heredoc — write a "
            "script file first), and git boundaries for agent config. Keep APPEND_SYSTEM.md for additive notes only."
        ),
        "dimensionRefs": ["task-understanding", "learning-capture"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R3",
        "title": "Root gitignore is deny-all; harness config is not really versioned",
        "severity": "High",
        "reason": (
            "The repo root gitignore is a deny-all star with narrow re-includes for agent/ and agent/skills. "
            "Tracked files under agent are nearly empty while the working tree shows hundreds of changed or "
            "untracked paths for settings, extensions, and packages. Skills intended to be tracked still appear "
            "untracked. Harness changes cannot be reviewed or rolled back as a unit."
        ),
        "aiFixPrompt": (
            "Edit the repo root .gitignore so these stay trackable: agent/settings.json, agent/AGENTS.md, "
            "agent/APPEND_SYSTEM.md, agent/skills/**, agent/agents/**, and agent/extensions source files "
            "(not node_modules). Keep sessions/, npm/, caches, and .pi/better-harness/_run ignored. Stage a "
            "coherent harness snapshot without session transcripts or secrets."
        ),
        "dimensionRefs": ["change-validation"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R4",
        "title": "Shell allowlist blocks dominate runtime failures",
        "severity": "High",
        "reason": (
            "Independent session JSONL analysis across 12 eligible sessions found about 1648 tool calls, "
            "about 153 erroring tool results (roughly 9 percent), and 61 allowlist blocks — almost all on "
            "ctx_shell via python -c, heredoc, or lean-ctx allowlist. Agents still prefer shell over safer "
            "ctx APIs, so the same boundary is hit repeatedly. One long session ran many hours with dozens of failures."
        ),
        "aiFixPrompt": (
            "Update agent/AGENTS.md with a hard rule: never python -c or shell heredoc; write a script file "
            "then execute; prefer ctx_read, ctx_edit, and ctx_execute over raw shell. Optionally extend the "
            "lean-ctx allowlist only for a few audited high-value patterns. After the first allowlist block, "
            "switch strategy rather than retrying the same shell shape."
        ),
        "dimensionRefs": ["controlled-execution", "reliable-delivery"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R5",
        "title": "Edit context misses without post-change validation evidence",
        "severity": "High",
        "reason": (
            "Independent scan found about 42 edit-context miss or edit errors. Admission coverage shows "
            "withChanges=0 and withReviewedRelevantCheck=0 despite heavy edit and write volume. "
            "Change-validation stays weak because repairs are not closed with a check."
        ),
        "aiFixPrompt": (
            "Codify edit recovery in agent/AGENTS.md: on edit could-not-find failures, never retry identical "
            "text; re-read the exact file slice or fall back to sed/perl via shell only when policy allows. "
            "After multi-file edits, run a cheap verification such as search, JSON parse, or a targeted test "
            "before declaring done."
        ),
        "dimensionRefs": ["change-validation", "controlled-execution"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R6",
        "title": "last30days skill entry is huge and unsafe to enable as-is",
        "severity": "Medium",
        "reason": (
            "agent/skills/last30days/SKILL.md is roughly 217KB. It is currently disabled by the global "
            "denylist. Any broad re-enable without sliming will blow the prompt budget and regress context "
            "health. CE-lite already references last30days tools."
        ),
        "aiFixPrompt": (
            "Refactor agent/skills/last30days/SKILL.md into a thin top-level skill of about 5 to 8KB with "
            "triggers and tool names, moving bulk procedure into references loaded on demand. Do not enable "
            "the skill in settings until the slim entry file exists."
        ),
        "dimensionRefs": ["reliable-delivery"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent/skills/last30days"},
    },
    {
        "id": "R7",
        "title": "Harness inventory envelopes empty or stale versus disk reality",
        "severity": "Medium",
        "reason": (
            "Architecture packet envelopes for inventory, agent-lint, and optimize were empty. On-disk "
            "harness-inventory.json is dated 2026-07-30. The session packet claimed zero tool calls while "
            "independent JSONL parse found about 1648 calls. Evidence tooling under-represents the live harness."
        ),
        "aiFixPrompt": (
            "Regenerate harness inventory after settings or skill changes. When a session packet reports "
            "zero tool calls, cross-check raw JSONL under agent/sessions before concluding idle. Document "
            "the package-to-tools map in agent/AGENTS.md so inventory gaps stay visible without envelopes."
        ),
        "dimensionRefs": ["learning-capture", "task-understanding"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R8",
        "title": "Long sessions carry most failures without outcome review",
        "severity": "Medium",
        "reason": (
            "Four long sessions make up about a third of the sample, including a multi-hour thread with "
            "dozens of failures. Outcome review is required and reviewed active long count is zero. "
            "Structured completion is zero while assistant handoffs exist — conversational close without "
            "evidential acceptance."
        ),
        "aiFixPrompt": (
            "For sessions longer than 60 minutes or after three or more compactions, require a mid-flight "
            "status note and an end checklist covering done or blocked, files touched, and verify command. "
            "Use installed session naming extensions so long threads stay findable. Do not claim completion "
            "without a verification artifact."
        ),
        "dimensionRefs": ["reliable-delivery"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R9",
        "title": "Many packages and dual extension paths; no package-exported skills",
        "severity": "Medium",
        "reason": (
            "settings.packages lists about 18 npm modules. Extensions are referenced both under "
            "npm/node_modules paths and agent/extensions. No package contributes pi.skills exports, so "
            "skill discovery cannot come from packages. Tool ownership is unclear and duplicates are hard to audit."
        ),
        "aiFixPrompt": (
            "Add a short inventory section to agent/AGENTS.md mapping each settings.packages entry to the "
            "tools or extensions it provides. Collapse duplicate extension entrypoints between "
            "settings.extensions and agent/extensions. Remove packages that provide nothing used recently."
        ),
        "dimensionRefs": ["learning-capture"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent"},
    },
    {
        "id": "R10",
        "title": "Custom agents surface is nearly empty",
        "severity": "Low",
        "reason": (
            "agent/agents contains Explore.md and a sync json only. There are no specialized "
            "review, build, or research agents to absorb complexity while skills fail to load. "
            "All work hits one generalist path."
        ),
        "aiFixPrompt": (
            "After fixing the skills filter, add one focused custom agent under agent/agents with a clear "
            "tool allowlist and purpose, for example session-forensics or skill-maintainer. Keep Explore.md. "
            "Do not create agents before skills are enableable."
        ),
        "dimensionRefs": ["task-understanding"],
        "target": {"kind": "repo-subtree", "packageRoute": None, "ownerRoute": "agent/agents"},
    },
]

dimensions = []
for did, label, score, refs, summary in DIM_ORDER:
    dimensions.append({
        "id": did,
        "label": label,
        "score": score,
        "summary": summary,
        "findingRefs": refs,
    })

overall = round(sum(d["score"] for d in dimensions) / len(dimensions))

doc = {
    "summary": {
        "projectName": "pi-agent",
        "locale": "en",
        "modelId": "agent-work-loop-v4",
        "reportContractVersion": 26,
        "overview": (
            f"Overall harness score about {overall}/100 (weak). This pi agent home is skill-rich on disk "
            "but skill-blind at runtime: settings.skills denies nearly all installed skills except ce-lite "
            "and better-harness. There is no AGENTS.md or SYSTEM.md, root gitignore deny-all prevents real "
            "versioning of harness config, and session forensics show systemic shell allowlist blocks plus "
            "edit-context misses on long multi-model threads. Fix enablement, identity docs, and ignore rules "
            "first; then slim oversized skills and tighten execution policy."
        ),
        "strengths": [
            "Rich on-disk skill library and many useful packages already installed (lean-ctx, better-harness, last30days, dynamic workflows).",
            "Session JSONL is detailed enough for independent forensics once packet zeros are cross-checked.",
            "CE-lite and better-harness paths are intentionally enabled and provide a narrow working skill spine.",
            "Extensions such as transcript-pruner, tool-trimmer, and session-index show active investment in harness hygiene.",
        ],
        "dimensions": dimensions,
        "aiAgentPractice": {
            "inspectedSurfaces": [
                "Rules", "Skills", "Commands", "Custom Agents", "MCP", "Plugins", "Session Insights"
            ],
            "coverageRows": [
                {"surface": "Rules", "scopes": ["project"], "count": 1, "paths": ["agent/APPEND_SYSTEM.md"]},
                {"surface": "Skills", "scopes": ["user", "project"], "count": 48, "paths": ["agent/skills/"]},
                {"surface": "Commands", "scopes": ["project"], "count": 0, "paths": []},
                {"surface": "Custom Agents", "scopes": ["project"], "count": 1, "paths": ["agent/agents/Explore.md"]},
                {"surface": "MCP", "scopes": ["project"], "count": 0, "paths": []},
                {"surface": "Plugins", "scopes": ["project"], "count": 18, "paths": ["agent/settings.json", "agent/extensions/"]},
                {"surface": "Session Insights", "scopes": ["user"], "count": 12, "paths": ["agent/sessions/"]},
            ],
        },
    },
    "findings": findings,
}

path = OUT / "findings.json"
path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n")
print("wrote", path, "overall", overall)
