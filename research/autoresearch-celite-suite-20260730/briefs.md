# C2 suite briefs (from multi-perspective-analysis-ms78jbqi-eyps5r, synthesized by gemini-3-5-flash)

## s1 — Research & Synthesis
**Prompt:** Analyze 'access.log' and cross-reference entries with security rules in 'rules.json'. Identify all legitimate API queries and filter out any requests originating from IPs flagged with high-severity threats. Produce a synthesis report saved as 'access_report.md'. The report must contain a markdown table showing the total count of clean queries grouped by department, followed by a 'Security Alerts' section citing the exact log line number of any high-severity threat IP using the format [filename:line_number].

**Seeds:**
- `access.log`:
```
2026-07-30 08:00:00 IP=192.168.1.50 DEPT=Engineering API=/v1/status
2026-07-30 08:01:22 IP=10.0.0.12 DEPT=Marketing API=/v1/campaign
2026-07-30 08:02:45 IP=198.51.100.7 DEPT=Unknown API=/v1/admin
2026-07-30 08:03:10 IP=192.168.1.50 DEPT=Engineering API=/v1/deploy
```
- `rules.json`:
```json
{ "threat_ips": { "198.51.100.7": "high" }, "departments": { "Engineering": "vetted", "Marketing": "vetted" } }
```

**Canaries:** access_report.md exists, contains "Engineering" with count 2 and "Marketing" with count 1; contains citation `[access.log:3]`; clean table excludes "Unknown".

## s2 — Multi-File Refactor
**Prompt:** Inspect 'config/schema.json' to retrieve the expected key names and default values. Update the 'load_config' function in 'config/loader.py' to read that JSON file and return the values associated with those keys as a dictionary. Finally, modify 'app.py' to update how it extracts the config values from the returned dictionary and returns the updated connection string.

**Seeds:**
- `config/schema.json`: `{ "db_host": "production-db.internal", "db_port": "5432" }`
- `config/loader.py`: `import json\ndef load_config(path):\n    # Legacy version returned hardcoded list\n    return ["localhost", "8080"]`
- `app.py`: `from config.loader import load_config\ndef run():\n    cfg = load_config("config/schema.json")\n    return f"Connecting to {cfg[0]}:{cfg[1]}"`

**Canaries:** loader.py contains json.load(s); app.py contains `cfg["db_host"]` and `cfg["db_port"]`; `python3 -c "from app import run; print(run())"` exits 0 printing `Connecting to production-db.internal:5432`.

## s3 — Exploratory Debugging
**Prompt:** Diagnose and resolve a bug in 'state_store.js'. Subsequent mutations are bleeding into different independent runs, causing isolation assertion checks to fail. Implement a clone-on-instantiation or clone-on-retrieve pattern to isolate the active state object. Verify your solution by running 'node verify.js' until it returns an exit code of 0 and prints only 'PASSED'. Do not modify 'verify.js'.

**Seeds:**
- `state_store.js`:
```javascript
let globalState = { counter: 0, flags: [] };
function getStateInstance() {
  // Returns reference to global store causing mutation bleeding
  return globalState;
}
function resetStore() {
  globalState.counter = 0;
  globalState.flags = [];
}
module.exports = { getStateInstance, resetStore };
```
- `verify.js`:
```javascript
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
```

**Canaries:** `node verify.js` exits 0 with stdout containing PASSED; state_store.js contains spread/Object.assign/structuredClone; verify.js unmodified (hash check).

## s4 — Long-Horizon Decomposition (added by operator mid-campaign)
**Prompt:** We're going to migrate this little tool from JSON-file storage to SQLite, spread over multiple sessions. Nothing is decided: schema, migration path, verification approach. Your job now is NOT to build — chart the way: write wayfinder-map.md naming the destination and listing decision tickets (open questions to resolve, one per line, phrased as questions). Stop after the map.

**Seeds:** small JSON-file tool (see seed_s4 in measure.sh).

**Canaries:** wayfinder-map.md exists; ≥N lines ending in `?` (decision tickets); NO new .py/.sql files (chart, don't build).

## s5 — Handoff Discipline (added by operator mid-campaign)
**Prompt:** This is the first session of a multi-session effort. Task for now: create a tiny counter module (counter.js exporting inc() and get()) and a handoff document for the next session. The handoff must include: current state, what's next, and a note for the model taking over. Write handoff.md.

**Seeds:** none (creates from scratch).

**Canaries:** counter.js exists with inc/get; handoff.md ≥5 lines containing state/next/model-note content.

## s4 — Decomposition Routing (wayfinder-shaped)
**Prompt:** We're going to migrate this little tool from JSON-file storage to SQLite, spread over multiple sessions. Nothing is decided: schema, migration path, verification approach. Your job now is NOT to build — chart the way: write wayfinder-map.md naming the destination and listing decision tickets (open questions to resolve, one per line, phrased as questions). Stop after the map.

**Seeds:**
- `store.js`: `const fs = require('fs');\nmodule.exports.load = f => JSON.parse(fs.readFileSync(f, 'utf8'));\nmodule.exports.save = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));`
- `data/notes.json`: `[{"id": 1, "text": "first"}, {"id": 2, "text": "second"}]`

**Canaries:** wayfinder-map.md exists; ≥3 lines ending in `?`; contains "destination" (case-insensitive); NO new .py/.js/.sql files created (wayfinder doctrine: produce decisions, not deliverables).

**Note:** prompt names the artifact for canary determinism — it tests decision-vs-deliverable discipline, not spontaneous routing. A vaguer variant (no filename given) is a sensitivity idea in ideas.md.

## s5 — Handoff
**Prompt:** This is the first session of a multi-session effort. Task for now: create a tiny counter module (counter.js exporting inc() and get()) and a handoff document for the next session. The handoff must include: current state, what's next, and a note for the model taking over. Write handoff.md.

**Seeds:** none (empty dir).

**Canaries:** counter.js exists and exports inc/get; handoff.md exists with ≥5 lines and contains "model note" (case-insensitive).
