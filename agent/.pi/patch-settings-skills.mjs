import fs from "fs";
const p = "/home/alex/.pi/agent/settings.json";
const j = JSON.parse(fs.readFileSync(p, "utf8"));
console.log("before", j.skills);
j.skills = ["!**/last30days/**"];
fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
console.log("after", JSON.parse(fs.readFileSync(p, "utf8")).skills);
