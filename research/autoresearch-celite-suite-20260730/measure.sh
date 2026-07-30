#!/bin/bash
# measure.sh — ce-lite suite: 3 non-trivial briefs × 2 reps on Venice/kimi-k3:xhigh.
# Mutates ONLY candidates/SKILL.md (plus winner APPEND_SYSTEM from live). Prints
# METRIC lines incl. skill_loaded (lanes whose transcript references ce-lite).
set -uo pipefail
CAMPAIGN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERS=/home/alex/Projects/pi-harness-config/research/autoresearch-terseness-20260729
BENCH=/home/alex/bench-systima
PORT=4599

[ -s "$CAMPAIGN/candidates/SKILL.md" ] || { echo "candidate SKILL.md missing"; exit 1; }

port_open() { (echo > /dev/tcp/127.0.0.1/$PORT) 2>/dev/null; }
wait_free() { for i in $(seq 1 20); do port_open || return 0; sleep 0.5; done; }
wait_listen() { for i in $(seq 1 20); do port_open && return 0; sleep 0.5; done; return 1; }

VAGENT="$(bash "$TERS/build-variant.sh")"
jq '.providers.Venice.baseUrl="http://127.0.0.1:4599/v1"' ~/.pi/agent/models.json > "$VAGENT/models.json"
# Variant skills: symlink everything except ce-lite; candidate ce-lite copied in
rm "$VAGENT/skills"
mkdir -p "$VAGENT/skills"
for d in ~/.pi/agent/skills/*/; do
  name="$(basename "$d")"
  [ "$name" = "ce-lite" ] && continue
  ln -s "$d" "$VAGENT/skills/$name"
done
mkdir -p "$VAGENT/skills/ce-lite"
cp "$CAMPAIGN/candidates/SKILL.md" "$VAGENT/skills/ce-lite/SKILL.md"

seed_s1() { wd="$1"
  printf '2026-07-30 08:00:00 IP=192.168.1.50 DEPT=Engineering API=/v1/status\n2026-07-30 08:01:22 IP=10.0.0.12 DEPT=Marketing API=/v1/campaign\n2026-07-30 08:02:45 IP=198.51.100.7 DEPT=Unknown API=/v1/admin\n2026-07-30 08:03:10 IP=192.168.1.50 DEPT=Engineering API=/v1/deploy\n' > "$wd/access.log"
  printf '{ "threat_ips": { "198.51.100.7": "high" }, "departments": { "Engineering": "vetted", "Marketing": "vetted" } }\n' > "$wd/rules.json"
}
seed_s2() { wd="$1"
  mkdir -p "$wd/config"
  printf '{ "db_host": "production-db.internal", "db_port": "5432" }\n' > "$wd/config/schema.json"
  printf 'import json\ndef load_config(path):\n    # Legacy version returned hardcoded list\n    return ["localhost", "8080"]\n' > "$wd/config/loader.py"
  printf 'from config.loader import load_config\ndef run():\n    cfg = load_config("config/schema.json")\n    return f"Connecting to {cfg[0]}:{cfg[1]}"\n' > "$wd/app.py"
}
seed_s3() { wd="$1"
  printf 'let globalState = { counter: 0, flags: [] };\nfunction getStateInstance() {\n  // Returns reference to global store causing mutation bleeding\n  return globalState;\n}\nfunction resetStore() {\n  globalState.counter = 0;\n  globalState.flags = [];\n}\nmodule.exports = { getStateInstance, resetStore };\n' > "$wd/state_store.js"
  cat > "$wd/verify.js" <<'VEOF'
const { getStateInstance, resetStore } = require('./state_store');
const assert = require('assert');
try {
  resetStore();
  const stateA = getStateInstance();
  stateA.counter = 10;
  stateA.flags.push('admin');
  const stateB = getStateInstance();
  stateB.counter = 20;
  assert.strictEqual(stateA.counter, 10, "Counter mutated!");
  assert.deepStrictEqual(stateA.flags, ['admin'], "Flags mutated!");
  console.log('PASSED');
  process.exit(0);
} catch (err) {
  console.error('FAILED:', err.message);
  process.exit(1);
}
VEOF
}

seed_s4() { wd="$1"
  mkdir -p "$wd/data"
  printf 'const fs = require("fs");\nmodule.exports.load = f => JSON.parse(fs.readFileSync(f, "utf8"));\nmodule.exports.save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));\n' > "$wd/store.js"
  printf '[{"id": 1, "text": "first"}, {"id": 2, "text": "second"}]\n' > "$wd/data/notes.json"
}
seed_s5() { :; }

P_s1="Analyze 'access.log' and cross-reference entries with security rules in 'rules.json'. Identify all legitimate API queries and filter out any requests originating from IPs flagged with high-severity threats. Produce a synthesis report saved as 'access_report.md'. The report must contain a markdown table showing the total count of clean queries grouped by department, followed by a 'Security Alerts' section citing the exact log line number of any high-severity threat IP using the format [filename:line_number]."
P_s2="Inspect 'config/schema.json' to retrieve the expected key names and default values. Update the 'load_config' function in 'config/loader.py' to read that JSON file and return the values associated with those keys as a dictionary. Finally, modify 'app.py' to update how it extracts the config values from the returned dictionary and returns the updated connection string."
P_s3="Diagnose and resolve a bug in 'state_store.js'. Subsequent mutations are bleeding into different independent runs, causing isolation assertion checks to fail. Implement a clone-on-instantiation or clone-on-retrieve pattern to isolate the active state object. Verify your solution by running 'node verify.js' until it returns an exit code of 0 and prints only 'PASSED'. Do not modify 'verify.js'."
P_s4="We're going to migrate this little tool from JSON-file storage to SQLite, spread over multiple sessions. Nothing is decided: schema, migration path, verification approach. Your job now is NOT to build — chart the way: write wayfinder-map.md naming the destination and listing decision tickets (open questions to resolve, one per line, phrased as questions). Stop after the map."
P_s5="This is the first session of a multi-session effort. Task for now: create a tiny counter module (counter.js exporting inc() and get()) and a handoff document for the next session. The handoff must include: current state, what's next, and a note for the model taking over. Write handoff.md."

for s in s1 s2 s3 s4 s5; do
  for rep in 1 2; do
    label="celite-${s}-r${rep}"
    wd="/tmp/celite-${s}-r${rep}"
    rm -rf "$wd"; mkdir -p "$wd"
    seed_$s "$wd"
    pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true; wait_free
    rm -rf "$BENCH/captures/$label"
    LABEL="$label" PROXY_PORT=$PORT CAPTURE_DIR="$BENCH/captures" UPSTREAM_URL=https://api.venice.ai/api/v1 \
      node "$BENCH/rig/proxy-oi.mjs" >> "$BENCH/proxy.log" 2>&1 &
    wait_listen || { echo "PROXY FAILED" >&2; exit 1; }
    prompt_var="P_$s"
    (cd "$wd" && PI_CODING_AGENT_DIR="$VAGENT" timeout 240 pi -p "${!prompt_var}" --model "Venice/kimi-k3" --thinking high >/dev/null 2>&1) || true
    pkill -TERM -f 'proxy-oi.mjs' 2>/dev/null || true
    echo "lane $label done: $(ls "$BENCH/captures/$label" 2>/dev/null | wc -l) captures" >&2
  done
done

node "$CAMPAIGN/aggregate.js"
