#!/usr/bin/env node
/**
 * tickets-to-workflow.mjs
 * -----------------------
 * Ticket-to-workflow adapter: converts a Matt Pocock `to-tickets` dependency
 * graph under `.scratch/<feature-slug>/issues/<NN>-<slug>.md` into a saved,
 * runnable multi-agent workflow.
 *
 * Usage:
 *   node scripts/tickets-to-workflow.mjs <feature-slug> [cwd]
 *
 *   <feature-slug> : the issues dir slug (e.g. auth-refactor-branch)
 *   [cwd]          : project root the agents should work in (default: $PWD)
 *
 * Output:
 *   Writes ~/.pi/workflows/saved/<feature-slug>-execute.json (saved workflow)
 *   Prints the workflow name to run via the `workflow` tool.
 *
 * Ordering: tickets are grouped into dependency waves using the "Blocked by"
 * edges (blockers first, as to-tickets numbers them). Agents in a wave run in
 * parallel; waves execute sequentially, so no agent starts before its blockers.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const [, , slug, cwd = process.cwd()] = process.argv;
if (!slug) {
  console.error("usage: node tickets-to-workflow.mjs <feature-slug> [cwd]");
  process.exit(1);
}

const issuesDir = join(cwd, ".scratch", slug, "issues");
if (!existsSync(issuesDir)) {
  console.error(`no issues dir: ${issuesDir}`);
  console.error("run matt pocock's to-tickets first (writes .scratch/<slug>/issues/).");
  process.exit(1);
}

// ---- parse tickets ---------------------------------------------------------
const files = readdirSync(issuesDir)
  .filter((f) => /^\d{2}-.*\.md$/.test(f))
  .sort();

const tickets = [];
for (const f of files) {
  const body = readFileSync(join(issuesDir, f), "utf8");
  const num = f.slice(0, 2);
  const titleMatch = body.match(/^#\s+\d+\s*[—–-]\s*(.+)$/m);
  const blockedMatch = body.match(/^\*\*Blocked by:\*\*\s*(.+)$/m);
  const statusMatch = body.match(/^\*\*Status:\*\*\s*(.+)$/m);
  const blocked =
    !blockedMatch || /none\s*[—–-]?\s*can start/i.test(blockedMatch[1])
      ? []
      : (blockedMatch[1].match(/\d{2}/g) || []).map((n) => parseInt(n, 10));
  tickets.push({
    file: f,
    num,
    title: (titleMatch?.[1] ?? f).trim(),
    blocked,
    status: (statusMatch?.[1] ?? "ready-for-agent").trim(),
  });
}

// ---- dependency waves (Kahn's algorithm) -------------------------------------
const byNum = new Map(tickets.map((t) => [parseInt(t.num, 10), t]));
const indeg = new Map(tickets.map((t) => [t.num, 0]));
const children = new Map(tickets.map((t) => [t.num, []]));
for (const t of tickets) {
  for (const b of t.blocked) {
    indeg.set(t.num, indeg.get(t.num) + 1);
    const bKey = String(b).padStart(2, "0");
    if (byNum.has(b)) children.get(bKey).push(t);
  }
}
const waves = [];
let ready = [...tickets].filter((t) => indeg.get(t.num) === 0).map((t) => t.num);
while (ready.length) {
  waves.push(ready.sort());
  const next = new Set();
  for (const n of ready) for (const c of children.get(n)) {
    const d = indeg.get(c.num) - 1;
    indeg.set(c.num, d);
    if (d === 0) next.add(c.num);
  }
  ready = [...next];
}
if (waves.flat().length !== tickets.length) {
  console.error("cycle detected in ticket dependencies — fix 'Blocked by' edges first.");
  process.exit(1);
}

// ---- emit saved workflow -----------------------------------------------------
// parallel() requires functions, so each ticket becomes `() => agent({...})`.
const agentCall = (t) => `() => agent({
  label: "ticket-${t.num}-${t.file.replace(/^\d{2}-/, "").replace(/\.md$/, "")}",
  tier: "medium",
  prompt: \`Implement ticket #${t.num} — ${t.title} (file: ${t.file}, blocked by: ${t.blocked.length ? t.blocked.join(", ") : "none"}).
READ the ticket first: .scratch/${slug}/issues/${t.file} — follow its 'What to build' and every acceptance criterion.
Work in cwd: ${cwd}. Verify each acceptance criterion; report what passed and what remains. Don't touch other tickets.\`,
})`;

let script = `export const meta = {
  name: "${slug}-execute",
  description: "Execute ${tickets.length} tickets from .scratch/${slug}/issues in dependency waves",
  phases: [${waves.map((_, i) => `{ title: "Wave ${i + 1}" }`).join(", ")}],
}

${waves.map((w, i) => `phase("Wave ${i + 1}")

const wave${i + 1} = await parallel([
${w.map((n) => agentCall(byNum.get(parseInt(n, 10)))).join(",\n")}
])`).join("\n\n")}

return { completed: ${tickets.length}, summary: "tickets executed in ${waves.length} waves" }
`;

const savedDir = join(homedir(), ".pi", "workflows", "saved");
mkdirSync(savedDir, { recursive: true });
// JSON.stringify handles all escaping (newlines → \n, quotes → \") — do NOT double-escape.
writeFileSync(
  join(savedDir, `${slug}-execute.json`),
  JSON.stringify(
    { name: `${slug}-execute`, description: `Execute ${tickets.length} tickets from .scratch/${slug}/issues`, script },
    null,
    2
  ) + "\n",
  "utf8"
);

console.log(`parsed ${tickets.length} tickets, ${waves.length} waves:`);
waves.forEach((w, i) => console.log(`  wave ${i + 1}: ${w.map((n) => byNum.get(parseInt(n, 10)).title).join(" | ")}`));
console.log(`\nsaved workflow: ${slug}-execute`);
console.log(`run it: workflow(name="${slug}-execute")  (or /workflows run ${slug}-execute)`);
