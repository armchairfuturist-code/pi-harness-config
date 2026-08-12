#!/usr/bin/env python3
from pathlib import Path
p = Path('/home/alex/.pi/agent/.pi/better-harness/_run/build-findings.py')
text = p.read_text()
old = '''# --- dimension scores (normalized 0-100) ---
dimensions = []

# project
for d in proj.get("dimensionScores") or []:
    dimensions.append({
        "id": d["id"],
        "label": d["id"].replace("-", " ").title(),
        "score": n10(d.get("score", 0), d.get("max", 10)),
        "maxScore": 100,
        "band": None,
        "summary": d.get("rationale") or "",
        "confidence": "high",
        "sourceAgent": "project-harness",
    })

# session uses maxScore already sometimes
for d in sess.get("dimensionScores") or []:
    mx = d.get("maxScore") or d.get("max") or 100
    sc = d.get("score", 0)
    dimensions.append({
        "id": d["id"],
        "label": d["id"].replace("-", " ").title(),
        "score": n100(sc, mx) if mx != 100 else int(sc),
        "maxScore": 100,
        "band": None,
        "summary": d.get("rationale") or "",
        "confidence": d.get("confidence") or "medium",
        "sourceAgent": "session-evidence",
    })

for d in arch.get("dimensionScores") or []:
    dimensions.append({
        "id": d["id"],
        "label": d["id"].replace("-", " ").title(),
        "score": n10(d.get("score", 0), d.get("max", 10)),
        "maxScore": 100,
        "band": None,
        "summary": d.get("rationale") or "",
        "confidence": "high",
        "sourceAgent": "agent-customize",
    })
'''
new = '''# --- dimension scores (normalized 0-100) ---
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
'''
if old not in text:
    raise SystemExit('block not found')
p.write_text(text.replace(old, new))
import py_compile
py_compile.compile(str(p), doraise=True)
print('ok')
