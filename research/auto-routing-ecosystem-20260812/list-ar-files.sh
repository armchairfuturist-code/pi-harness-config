#!/bin/bash
cd /home/alex/Projects/pi-harness-config
git ls-files | grep -E 'auto-reason|pi-auto-reasoning'
echo '---live---'
ls -la /home/alex/.pi/agent/patches/auto-reasoning 2>&1 | head
ls -d /home/alex/.pi/agent/npm/node_modules/@howaboua/pi-auto-reasoning-tool 2>&1
echo '---readme86---'
sed -n '80,95p' README.md
echo '---test hits---'
grep -Rnl 'auto-reasoning\|pi-auto-reasoning' --include='*.py' --include='*.sh' --include='*.md' --include='*.json' . 2>/dev/null | grep -v node_modules | grep -v research/
