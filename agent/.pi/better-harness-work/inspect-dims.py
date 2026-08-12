#!/usr/bin/env python3
import json
from pathlib import Path
root = Path('/home/alex/.pi/agent/.pi/better-harness/_run')
for name in ['handoff-project-harness.json','handoff-session-compact.json','handoff-agent-customize.json']:
    d=json.loads((root/name).read_text())
    print('====', name)
    print('dimensionScores type', type(d.get('dimensionScores')).__name__, d.get('dimensionScores'))
    print('scores type', type(d.get('scores')).__name__, str(d.get('scores'))[:500])
