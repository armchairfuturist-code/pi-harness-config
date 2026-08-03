#!/bin/bash
set -euo pipefail
# Correctness check — verify the bench workload completed successfully.
# This runs AFTER measure.sh and validates the last bench run.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check that hello.txt was created (from the bench workload)
if [ ! -f /home/alex/pi-bench-ws/hello.txt ]; then
  echo "FAIL: hello.txt missing"
  exit 1
fi

content=$(cat /home/alex/pi-bench-ws/hello.txt)
content="${content%$'\n'}"
if [ "$content" != "hello world" ]; then
  echo "FAIL: hello.txt content='$content'"
  exit 1
fi

echo "OK"
