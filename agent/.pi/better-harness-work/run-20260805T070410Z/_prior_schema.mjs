import fs from "fs";
const h = JSON.parse(
  fs.readFileSync("/home/alex/.pi/agent/.pi/better-harness-work/handoff-session-evidence.json", "utf8")
);
// full structure minus huge narratives
function shrink(v, depth = 0) {
  if (depth > 5) return typeof v;
  if (Array.isArray(v)) return v.slice(0, 6).map((x) => shrink(x, depth + 1));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, val] of Object.entries(v)) {
      if (typeof val === "string" && val.length > 200) o[k] = val.slice(0, 200) + `…(${val.length})`;
      else o[k] = shrink(val, depth + 1);
    }
    return o;
  }
  return v;
}
console.log(JSON.stringify(shrink(h), null, 2));
