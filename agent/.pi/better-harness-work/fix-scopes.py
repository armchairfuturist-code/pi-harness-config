#!/usr/bin/env python3
import json
from pathlib import Path
p = Path('/home/alex/.pi/agent/.pi/better-harness/findings.json')
d = json.loads(p.read_text())
for row in d['summary']['aiAgentPractice']['coverageRows']:
    scopes = []
    for s in row.get('scopes') or []:
        sl = s.lower()
        if sl == 'project':
            scopes.append('Project')
        elif sl == 'user' or sl == 'global':
            scopes.append('Global')
        elif sl == 'plugin':
            scopes.append('Plugin')
        else:
            scopes.append(s)
    # dedupe preserve order
    seen=set(); out=[]
    for s in scopes:
        if s not in seen:
            seen.add(s); out.append(s)
    row['scopes'] = out or ['Project']
p.write_text(json.dumps(d, ensure_ascii=False, indent=2)+'\n')
print('fixed scopes')
for r in d['summary']['aiAgentPractice']['coverageRows']:
    print(r['surface'], r['scopes'])
