#!/usr/bin/env python3
"""Lead reconciliation → findings.json for better-harness render."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/home/alex/.pi/agent/.pi/better-harness")
RUN = ROOT / "_run"
OUT = ROOT  # durable outputs live here

def load(name: str):
    return json.loads((RUN / name).read_text())

proj = load("handoff-project-harness.json")
sess = load("handoff-session-compact.json") if (RUN / "handoff-session-compact.json").exists() else load("handoff-session-evidence.json")
arch = load("handoff-agent-customize.json")
lead = load("lead-summary.json")
bundle_meta = {
    "workspace": "/home/alex/.pi/agent",
    "provider": "pi",
    "language": "en",
    "depth": "normal",
    "window": {"since": "2026-07-05", "until": "2026-08-04"},
}

def n10(score, max_s=10):
    try:
        return round(float(score) / float(max_s) * 100)
    except Exception:
        return 0

def n100(score, max_s=100):
    try:
        return round(float(score) / float(max_s) * 100)
    except Exception:
        return 0

# --- dimension scores (normalized 0-100) ---
dimensions = []

def ingest_dims(raw, source, default_max=10):
    out = []
    if isinstance(raw, dict):
        for k, v in raw.items():
            if isinstance(v, (int, float)):
                out.append({
                    "id": str(k),
                    "label": str(k).replace("_", " ").replace("-", " ").title(),
                    "score": n10(v, default_max) if default_max != 100 else int(v),
                    "maxScore": 100,
                    "band": None,
                    "summary": "",
                    "confidence": "medium",
                    "sourceAgent": source,
                })
            elif isinstance(v, dict):
                sc = v.get("score", 0)
                mx = v.get("maxScore") or v.get("max") or default_max
                out.append({
                    "id": str(k),
                    "label": str(k).replace("_", " ").replace("-", " ").title(),
                    "score": n100(sc, mx) if mx == 100 else n10(sc, mx),
                    "maxScore": 100,
                    "band": None,
                    "summary": v.get("rationale") or v.get("summary") or "",
                    "confidence": v.get("confidence") or "medium",
                    "sourceAgent": source,
                })
        return out
    if not isinstance(raw, list):
        return out
    for d in raw:
        if isinstance(d, str):
            continue
        if not isinstance(d, dict):
            continue
        did = d.get("id") or d.get("dimension") or d.get("name")
        if not did:
            continue
        sc = d.get("score", 0)
        mx = d.get("maxScore") or d.get("max") or default_max
        # heuristic: scores already on 0-100 if max missing and score>10
        if "maxScore" not in d and "max" not in d and isinstance(sc, (int, float)) and sc > 10:
            mx = 100
        score = int(sc) if mx == 100 else n10(sc, mx)
        out.append({
            "id": str(did),
            "label": str(did).replace("_", " ").replace("-", " ").title(),
            "score": score if mx == 100 else score,
            "maxScore": 100,
            "band": None,
            "summary": d.get("rationale") or d.get("summary") or "",
            "confidence": d.get("confidence") or "medium",
            "sourceAgent": source,
        })
    return out

dimensions.extend(ingest_dims(proj.get("dimensionScores") or proj.get("scores"), "project-harness", 100))
dimensions.extend(ingest_dims(sess.get("dimensionScores") or sess.get("scores"), "session-evidence", 100))
dimensions.extend(ingest_dims(arch.get("dimensionScores") or arch.get("scores"), "agent-customize", 10))

def band_for(score: int) -> str:
    if score >= 85:
        return "strong"
    if score >= 70:
        return "good"
    if score >= 55:
        return "mixed"
    if score >= 40:
        return "weak"
    return "poor"

for d in dimensions:
    d["band"] = band_for(d["score"])

overall = round(sum(d["score"] for d in dimensions) / max(len(dimensions), 1))
overall_band = band_for(overall)

# --- reconciled findings ---
# Ownership rules from skill:
# project: docs, config hygiene, change control, validation loops
# session: runtime friction, tool failures, long sessions, delivery
# architecture: skills/extensions/agents/routing/overload

findings = []

def add(**kwargs):
    findings.append(kwargs)

# P0 — skills filter (architecture primary; project corroborates)
add(
    id="BH-001",
    title="Global skills denylist leaves 48 on-disk skills inert",
    severity="critical",
    status="open",
    dimension="routing-control",
    ownerAgent="agent-customize",
    confactors=["project-harness"],
    summary=(
        "settings.json skills filter is ['!**','**/ce-lite/**','**/better-harness/**']. "
        "That denies every skill path first and only re-allows ce-lite and better-harness. "
        "48 skill directories exist under agent/skills (including last30days, harness-doctor, "
        "pi-dynamic-workflows, graph-engineering, etc.) but cannot load. Architecture inventory "
        "envelopes reported 0 skills because enablement is empty, not because the tree is empty."
    ),
    evidence=[
        "agent/settings.json → skills: [\"!**\", \"**/ce-lite/**\", \"**/better-harness/**\"]",
        "agent/skills/ has 48 directories with SKILL.md files",
        "architecture packet envelopes.inventory.skills = [] / projectAssets = 0",
        "session usageActivity.skills = [] across 12 eligible sessions",
    ],
    impact=(
        "Agent cannot use specialized workflows the user installed. Triggers in SYSTEM/CE-lite "
        "point at skills that will never activate. Harness appears 'skill-rich' on disk and "
        "'skill-blind' at runtime — the dominant readiness failure."
    ),
    recommendation=(
        "Replace the denylist with an explicit allowlist of skills you actually want, or remove "
        "'!**' and deny only noisy ones. Minimum: enable last30days, harness-doctor, "
        "pi-dynamic-workflows, and any skill named in CE-lite triggers. Re-run a session and "
        "confirm skill load events appear."
    ),
    effort="S",
    priority="P0",
    confidence="high",
)

# P0 — identity/rules surface
add(
    id="BH-002",
    title="No AGENTS.md or SYSTEM.md — only APPEND_SYSTEM.md",
    severity="high",
    status="open",
    dimension="docs-guidance",
    ownerAgent="project-harness",
    confactors=["agent-customize"],
    summary=(
        "Pi project guidance expects AGENTS.md (and often SYSTEM.md) as the durable instruction "
        "surface. This agent root has APPEND_SYSTEM.md (1081 bytes) only — no AGENTS.md, no "
        "SYSTEM.md. Rules, skill routing policy, and workspace conventions are therefore not "
        "discoverable as a first-class project contract."
    ),
    evidence=[
        "AGENTS.md missing at /home/alex/.pi/agent/AGENTS.md",
        "SYSTEM.md missing",
        "APPEND_SYSTEM.md present (1081 bytes)",
        "project packet recommendedReads listed AGENTS.md as absent",
    ],
    impact=(
        "New sessions inherit weak/implicit policy. Skill enablement intent, safety boundaries, "
        "and repo conventions live only in chat memory or scattered files."
    ),
    recommendation=(
        "Add AGENTS.md describing: what this agent home is, which skills are in-policy, "
        "tool preferences (ctx_* vs shell), session hygiene, and git boundaries. Keep "
        "APPEND_SYSTEM.md for additive runtime notes only."
    ),
    effort="S",
    priority="P0",
    confidence="high",
)

# P0 — gitignore / change control
add(
    id="BH-003",
    title="Root gitignore is deny-all; agent config and skills are not really versioned",
    severity="high",
    status="open",
    dimension="change-control",
    ownerAgent="project-harness",
    confactors=["agent-customize"],
    summary=(
        "Root .gitignore is a deny-all star with narrow re-includes for agent/ and agent/skills/**. "
        "In practice git ls-files agent is nearly empty while the working tree shows hundreds of "
        "changed/untracked paths (settings, extensions, packages, sessions artifacts). Skills "
        "intended to be tracked are still untracked. Harness config cannot be reviewed or rolled "
        "back as a unit."
    ),
    evidence=[
        ".gitignore: *, !agent/, !agent/skills/, !agent/skills/**",
        "project packet: trackedFiles≈3 vs changedFiles≈453 / churn huge",
        "settings.json, extensions, agents not in the whitelist design",
        "skills directories currently show as untracked despite whitelist",
    ],
    impact=(
        "Silent config drift; cannot PR harness changes; recovery after bad settings edit is hard; "
        "better-harness project profile under-counts the real system."
    ),
    recommendation=(
        "Rewrite .gitignore to track: agent/settings.json, agent/AGENTS.md, agent/APPEND_SYSTEM.md, "
        "agent/skills/**, agent/agents/**, agent/extensions/*.ts (not node_modules), and a lock "
        "of package intent. Keep sessions/, npm/, caches, .pi/better-harness/_run ignored."
    ),
    effort="M",
    priority="P0",
    confidence="high",
)

# P0 — runtime friction allowlist
add(
    id="BH-004",
    title="Shell allowlist blocks dominate runtime failures",
    severity="high",
    status="open",
    dimension="controlled-execution",
    ownerAgent="session-evidence",
    confactors=["agent-customize"],
    summary=(
        "Across 12 eligible workspace sessions: ~1648 tool calls, ~153 isError toolResults "
        "(~9.3%), and 61 independent allowlist blocks — almost all on ctx_shell (python3 "
        "heredoc/-c, lean-ctx allowlist). Agents still prefer shell (ctx_shell lead count 1142 / "
        "independent 796) over safer ctx_* APIs, so the same boundary is hit repeatedly instead "
        "of being internalized as a routing rule."
    ),
    evidence=[
        "runtimeMetrics.independentAllowlistBlocks=61",
        "independentIsErrorTrue=153 / independentToolResults=1647",
        "topFailReasons: allowlist_block, edit_context_miss, enoent",
        "mostObservedTool ctx_shell",
    ],
    impact=(
        "Burned turns, aborted tool loops, long sessions with high failure mass (S1: 498 min, "
        "41 failures). Controlled-execution score stays weak."
    ),
    recommendation=(
        "1) Codify in AGENTS.md: never python -c/heredoc; write script file then execute. "
        "2) Prefer ctx_read/ctx_edit/ctx_execute over raw shell. "
        "3) Optionally extend lean-ctx allowlist for a few high-value audited patterns. "
        "4) Add a tiny skill or CE-lite rule that triggers after first allowlist block."
    ),
    effort="M",
    priority="P0",
    confidence="high",
)

# P1 — edit misses / validation
add(
    id="BH-005",
    title="Edit/patch context misses without post-change validation evidence",
    severity="high",
    status="open",
    dimension="change-validation",
    ownerAgent="session-evidence",
    confactors=["project-harness"],
    summary=(
        "Independent scan found 42 edit_context_miss / edit errors. Admission coverage shows "
        "withChanges=0 and withReviewedRelevantCheck=0 despite heavy edit/write volume "
        "(edit=211, write=98). validation-repair portfolio class appeared once and the only "
        "check was lint with relation=no-change-context."
    ),
    evidence=[
        "independentEditMisses=42",
        "populationCoverage.withChanges=0; withReviewedRelevantCheck=0",
        "availableClasses.validation-repair=1",
    ],
    impact="Repair loops, unconfirmed deliveries, weak change-validation score (28/100).",
    recommendation=(
        "After edit failures: fall back to shell sed/perl only when policy allows, or re-read "
        "exact file slice before retry (never identical retry). Require a cheap verification "
        "step (rg/test/json parse) after multi-file edits. Teach this in AGENTS.md."
    ),
    effort="M",
    priority="P1",
    confidence="high",
)

# P1 — last30days bloat
add(
    id="BH-006",
    title="last30days SKILL.md is ~217KB — context landmine if enabled",
    severity="high",
    status="open",
    dimension="skill-quality",
    ownerAgent="agent-customize",
    confactors=[],
    summary=(
        "skills/last30days/SKILL.md is ~222272 bytes. Even a single unconditional load can "
        "blow the prompt budget. It is currently disabled by the global denylist, but any "
        "broad re-enable without sliming will regress context health immediately."
    ),
    evidence=[
        "skills/last30days/SKILL.md size ≈ 222272 bytes",
        "CE-lite triggers reference last30days tools",
    ],
    impact="Token waste, earlier compaction, degraded reasoning when skill is turned on.",
    recommendation=(
        "Split into thin SKILL.md + references/ loaded on demand. Keep top-level skill under "
        "~5–8KB with triggers and tool names only."
    ),
    effort="M",
    priority="P1",
    confidence="high",
)

# P1 — inventory staleness / adapter blind spot
add(
    id="BH-007",
    title="Harness inventory/lint envelopes are empty or stale vs disk reality",
    severity="medium",
    status="open",
    dimension="asset-discovery",
    ownerAgent="agent-customize",
    confactors=["project-harness"],
    summary=(
        "agent-customize packet envelopes (inventory, agent-lint, pi-optimize) were empty. "
        "On-disk harness-inventory.json timestamp is 2026-07-30 — before current window end. "
        "Session packet initially reported 0 tool calls; independent JSONL parse found 1648. "
        "Evidence tooling under-represents the live harness."
    ),
    evidence=[
        "architecture envelopes empty in evidence-bundle",
        "harness-inventory.json generated 2026-07-30T16:03:28+0100",
        "session packet summaryFacts.toolCalls=0 vs independentToolCalls=1648",
    ],
    impact="Reviews and optimize loops act on wrong baselines; false 'clean idle' readings.",
    recommendation=(
        "Regenerate inventory after settings/skill changes. Prefer session JSONL independent "
        "counts when packet toolCalls=0. Fix pi session adapter toolCall extraction if upstream."
    ),
    effort="S",
    priority="P1",
    confidence="high",
)

# P1 — package/extension sprawl without pi.skills
add(
    id="BH-008",
    title="18 packages and dual extension paths; zero package-exported pi.skills",
    severity="medium",
    status="open",
    dimension="tool-surface",
    ownerAgent="agent-customize",
    confactors=["project-harness"],
    summary=(
        "settings.packages lists ~18 npm modules (lean-ctx, better-harness, last30days, "
        "pi-essentials, dynamic workflows, invest tools, etc.). Extensions are both "
        "settings-referenced under npm/node_modules and present under agent/extensions/. "
        "No package contributes pi.skills exports, so skill discovery cannot come from packages."
    ),
    evidence=[
        "settings.packages length 18",
        "settings.extensions mixes ~/.pi/agent/npm/... and extensions/transcript-pruner.ts",
        "extensions dir: pi-lean-ctx, invest-tools, tool-trimmer, session-index, ...",
        "architecture: packagesWithPiSkills=0",
    ],
    impact="Unclear ownership of tools; hard to audit enablement; dead or duplicate surfaces.",
    recommendation=(
        "Publish a one-page inventory in AGENTS.md: package → tools/extensions provided. "
        "Collapse duplicate extension entrypoints. Remove unused packages."
    ),
    effort="M",
    priority="P1",
    confidence="high",
)

# P1 — long sessions without outcome review
add(
    id="BH-009",
    title="Long sessions carry most failures without outcome review",
    severity="medium",
    status="open",
    dimension="reliable-delivery",
    ownerAgent="session-evidence",
    confactors=[],
    summary=(
        "4 long sessions (33% of sample) include a 498-minute thread with 41 failures. "
        "outcomeReview.status=required and reviewedActiveLongCount=0. Structured completion=0 "
        "while assistant handoffs exist — conversational close without evidential acceptance."
    ),
    evidence=[
        "longSessions S1–S4; S1 activeMinutes=498 failureCount=41",
        "withStructuredCompletion=0; withAssistantHandoff=14",
        "tokenTotals input≈10.1M cacheRead≈118.5M across sample",
    ],
    impact="Cannot tell complex work from thrash; learning-capture stays low.",
    recommendation=(
        "For sessions >60m or >3 compactions: force mid-flight status note + end checklist "
        "(done/blocked/files/verify). Use auto-session-name/title extensions already installed."
    ),
    effort="S",
    priority="P1",
    confidence="medium",
)

# P2 — custom agents sparse
add(
    id="BH-010",
    title="Custom agents surface is nearly empty (Explore.md only)",
    severity="low",
    status="open",
    dimension="agent-specialization",
    ownerAgent="agent-customize",
    confactors=[],
    summary=(
        "agent/agents contains Explore.md and a sync json only. No specialized review/build/"
        "research agents to absorb complexity that skills currently fail to load."
    ),
    evidence=["agents/Explore.md only"],
    impact="All work hits one generalist path; harder to isolate high-risk tool policies.",
    recommendation="Add 1–2 focused agents (e.g. session-forensics, skill-maintainer) after skills filter is fixed.",
    effort="M",
    priority="P2",
    confidence="high",
)

# P2 — model mix context
add(
    id="BH-011",
    title="Multi-model traffic without comparable outcome attribution",
    severity="info",
    status="open",
    dimension="task-understanding",
    ownerAgent="session-evidence",
    confactors=[],
    summary=(
        "Response mix dominated by kimi-k3 (535) and glm-5.2 (449); grok-4-5=45. "
        "No comparable per-model outcome evidence — do not blame friction on model choice yet."
    ),
    evidence=["modelUsageResponses counts in session handoff"],
    impact="Risk of false optimization if models are swapped without task-family labels.",
    recommendation="When running A/B, tag task family and success criteria in session notes.",
    effort="S",
    priority="P2",
    confidence="medium",
)

# Conflict log entries as info finding
add(
    id="BH-012",
    title="Evidence conflict: packet idle metrics vs independent JSONL activity",
    severity="info",
    status="resolved",
    dimension="asset-discovery",
    ownerAgent="session-evidence",
    confactors=["project-harness"],
    summary=(
        "Lead session packet summaryFacts claimed toolCalls=0 / toolFailures=0 for 20 sessions. "
        "Pass B independent parse of 12 eligible sessions found 1648 tool calls and material "
        "failure mass. Reconciliation trusts independent JSONL + lead long-session friction "
        "marks; treats packet zeros as adapter/selection gap, not true idle."
    ),
    evidence=[
        "packet-session summaryFacts.toolCalls=0",
        "runtimeMetrics.independentToolCalls=1648",
    ],
    impact="Without reconciliation, lead would under-report runtime risk.",
    recommendation="Always cross-check pi session packets with raw JSONL when toolCalls=0.",
    effort="S",
    priority="P2",
    confidence="high",
)

# --- top actions ---
top_actions = [
    {
        "id": "ACT-001",
        "title": "Fix settings.skills filter (remove blanket !** or explicit allowlist)",
        "priority": "P0",
        "effort": "S",
        "expectedEffect": "Restores installed skills; unblocks CE-lite triggers and specialized workflows",
        "relatedFindings": ["BH-001"],
    },
    {
        "id": "ACT-002",
        "title": "Add AGENTS.md with tool policy + skill enablement contract",
        "priority": "P0",
        "effort": "S",
        "expectedEffect": "Durable routing/docs surface; reduces allowlist thrash and identity drift",
        "relatedFindings": ["BH-002", "BH-004"],
    },
    {
        "id": "ACT-003",
        "title": "Rewrite .gitignore to version settings, skills, agents, extensions source",
        "priority": "P0",
        "effort": "M",
        "expectedEffect": "Reviewable harness changes; rollback; accurate project profile",
        "relatedFindings": ["BH-003"],
    },
    {
        "id": "ACT-004",
        "title": "Codify ctx_* first + script-file python; reduce shell allowlist loops",
        "priority": "P0",
        "effort": "S",
        "expectedEffect": "Fewer aborted turns; lower failure rate on long sessions",
        "relatedFindings": ["BH-004", "BH-005"],
    },
    {
        "id": "ACT-005",
        "title": "Slim last30days SKILL.md before enabling",
        "priority": "P1",
        "effort": "M",
        "expectedEffect": "Safe skill enablement without context blowups",
        "relatedFindings": ["BH-006"],
    },
    {
        "id": "ACT-006",
        "title": "Regenerate harness inventory; document package/extension map",
        "priority": "P1",
        "effort": "S",
        "expectedEffect": "Honest asset baseline for future optimize/audit loops",
        "relatedFindings": ["BH-007", "BH-008"],
    },
]

evidence_gaps = sorted(set(
    (proj.get("evidenceGaps") or [])
    + (sess.get("evidenceGaps") or [])
    + (arch.get("evidenceGaps") or [])
    + [
        "No structured per-task success labels on long sessions (outcome review required)",
        "Skill invocation series empty in activity metrics even when skill-tagged prompts exist",
        "Package pi.skills exports unobserved (0)",
        "Git history does not reflect real harness evolution due to ignore rules",
    ]
))

conflicts = [
    {
        "id": "CX-001",
        "topic": "session tool activity",
        "resolution": "trust_independent_jsonl",
        "detail": "Packet toolCalls=0 superseded by Pass B independent counts (1648 calls).",
        "agents": ["session-evidence"],
    },
    {
        "id": "CX-002",
        "topic": "skills inventory empty vs 48 on disk",
        "resolution": "both_true",
        "detail": "Inventory empty because settings denylist disables load; disk full of skill trees. Primary issue is enablement (BH-001), not missing files.",
        "agents": ["agent-customize", "project-harness"],
    },
    {
        "id": "CX-003",
        "topic": "SYSTEM.md presence",
        "resolution": "missing",
        "detail": "Verified missing; only APPEND_SYSTEM.md exists. Early packet recommendedReads noise ignored.",
        "agents": ["project-harness", "agent-customize"],
    },
]

rm = sess.get("runtimeMetrics") or {}

summary = {
    "headline": "Pi agent harness is skill-rich on disk but skill-blind and high-friction at runtime",
    "overallScore": overall,
    "overallBand": overall_band,
    "executiveSummary": (
        f"Overall harness score {overall}/100 ({overall_band}). The dominant failure is "
        "settings.skills=['!**', ...] which disables essentially all of 48 installed skills "
        "except ce-lite and better-harness. There is no AGENTS.md/SYSTEM.md, gitignore deny-all "
        "prevents real versioning of harness config, and session forensics show systemic shell "
        "allowlist blocks plus edit-context misses across long, multi-model threads. "
        "Fix enablement + identity docs + ignore rules first; then slim oversized skills and "
        "tighten execution policy."
    ),
    "keyMetrics": {
        "skillsOnDisk": 48,
        "skillsEnabledByFilter": ["ce-lite", "better-harness"],
        "packagesConfigured": 18,
        "sessionsAnalyzed": rm.get("sessionsAnalyzed"),
        "toolCallsIndependent": rm.get("independentToolCalls"),
        "toolErrorRate": rm.get("independentErrorRate"),
        "allowlistBlocks": rm.get("independentAllowlistBlocks"),
        "editMisses": rm.get("independentEditMisses"),
        "longestSessionMinutes": 498,
    },
    "window": bundle_meta["window"],
    "provider": "pi",
    "workspace": bundle_meta["workspace"],
    "depth": "normal",
    "language": "en",
    "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
}

# severity counts
sev_counts = {}
for f in findings:
    sev_counts[f["severity"]] = sev_counts.get(f["severity"], 0) + 1

doc = {
    "schemaVersion": 1,
    "kind": "better-harness-findings",
    "meta": {
        **bundle_meta,
        "generatedAt": summary["generatedAt"],
        "skill": "better-harness",
        "mode": "analyze",
        "agents": [
            {"id": "project-harness", "status": proj.get("status"), "findings": len(proj.get("findings") or [])},
            {"id": "session-evidence", "status": sess.get("status"), "findings": len(sess.get("findings") or [])},
            {"id": "agent-customize", "status": arch.get("status"), "findings": len(arch.get("findings") or [])},
        ],
    },
    "summary": summary,
    "scores": {
        "overall": overall,
        "band": overall_band,
        "dimensions": dimensions,
        "byAgent": {
            "project-harness": round(sum(d["score"] for d in dimensions if d["sourceAgent"]=="project-harness")/max(1,sum(1 for d in dimensions if d["sourceAgent"]=="project-harness"))),
            "session-evidence": round(sum(d["score"] for d in dimensions if d["sourceAgent"]=="session-evidence")/max(1,sum(1 for d in dimensions if d["sourceAgent"]=="session-evidence"))),
            "agent-customize": round(sum(d["score"] for d in dimensions if d["sourceAgent"]=="agent-customize")/max(1,sum(1 for d in dimensions if d["sourceAgent"]=="agent-customize"))),
        },
    },
    "findings": findings,
    "topActions": top_actions,
    "evidenceGaps": evidence_gaps,
    "conflicts": conflicts,
    "runtimeMetrics": rm,
    "inventory": arch.get("inventory") or {},
    "severityCounts": sev_counts,
    "followUp": {
        "suggestedCommands": [
            "Re-open skills filter in settings.json and verify with a fresh session",
            "Create AGENTS.md from BH-002 recommendation",
            "Optional: better-harness support operationalize after P0 fixes",
        ],
        "nextSkillHints": ["support-operationalize", "support-optimize", "ce-lite"],
    },
}

OUT.mkdir(parents=True, exist_ok=True)
out_path = OUT / "findings.json"
out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2))
print("wrote", out_path)
print("overall", overall, overall_band)
print("findings", len(findings), sev_counts)
print("dimensions", len(dimensions))
print("byAgent", doc["scores"]["byAgent"])
