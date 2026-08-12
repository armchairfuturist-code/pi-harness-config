#!/usr/bin/env python3
from pathlib import Path
p = Path("/home/alex/.pi/agent/.pi/better-harness/_run/build-findings.py")
text = p.read_text()
old = '''    summary=(
        "/home/alex/.pi/.gitignore is '*" with narrow re-includes '!agent/' and "
        "'!agent/skills/**'. In practice git ls-files agent is nearly empty while the working "
        "tree shows hundreds of changed/untracked paths (settings, extensions, packages, "
        "sessions artifacts). Skills intended to be tracked are still untracked. Harness "
        "config cannot be reviewed or rolled back as a unit."
    ),'''
new = '''    summary=(
        "Root .gitignore is a deny-all star with narrow re-includes for agent/ and agent/skills/**. "
        "In practice git ls-files agent is nearly empty while the working tree shows hundreds of "
        "changed/untracked paths (settings, extensions, packages, sessions artifacts). Skills "
        "intended to be tracked are still untracked. Harness config cannot be reviewed or rolled "
        "back as a unit."
    ),'''
if old not in text:
    # try softer match
    start = text.find('id="BH-003"')
    if start < 0:
        raise SystemExit('BH-003 not found')
    s = text.find('summary=(', start)
    e = text.find('evidence=[', s)
    if s < 0 or e < 0:
        raise SystemExit(f'markers missing {s} {e}')
    replacement = '''summary=(
        "Root .gitignore is a deny-all star with narrow re-includes for agent/ and agent/skills/**. "
        "In practice git ls-files agent is nearly empty while the working tree shows hundreds of "
        "changed/untracked paths (settings, extensions, packages, sessions artifacts). Skills "
        "intended to be tracked are still untracked. Harness config cannot be reviewed or rolled "
        "back as a unit."
    ),
    '''
    text = text[:s] + replacement + text[e:]
    p.write_text(text)
    print('fixed via markers')
else:
    p.write_text(text.replace(old, new))
    print('fixed via exact')

import py_compile
py_compile.compile(str(p), doraise=True)
print('compile ok')
