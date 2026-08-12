import fs from 'fs';
import path from 'path';
const work = process.argv[2];
const raw = fs.readFileSync(path.join(work,'evidence-bundle.raw.json'),'utf8');
const i = raw.indexOf('{');
const data = JSON.parse(raw.slice(i));
fs.writeFileSync(path.join(work,'evidence-bundle.json'), JSON.stringify(data,null,2));
console.log(JSON.stringify({
  status: data.status,
  schemaVersion: data.schemaVersion,
  topology: data.context?.topology,
  window: data.context?.window,
  depth: data.context?.depth,
  provider: data.context?.provider,
  laneStatus: Object.fromEntries(Object.entries(data.lanes||{}).map(([k,v])=>[k,v?.status])),
  leadHasEvidence: Boolean(data.lead?.data?.evidence),
  leadKeys: Object.keys(data.lead?.data||{}),
},null,2));
const lead = data.lead?.data || {};
fs.writeFileSync(path.join(work,'lead-evidence.md'), lead.evidence || '');
fs.writeFileSync(path.join(work,'lead-summary.json'), JSON.stringify({
  summaryFacts: lead.summaryFacts,
  sessionBinding: lead.sessionBinding,
  kind: lead.kind,
  schemaVersion: lead.schemaVersion,
},null,2));
for (const [name,key] of [['session','sessionEvidence'],['project','projectHarness'],['architecture','agentCustomize']]) {
  const lane = data.lanes?.[key];
  const payload = {
    laneStatus: lane?.status,
    data: lane?.data,
    context: {
      workspace: data.context?.workspace,
      provider: data.context?.provider,
      language: data.context?.language,
      depth: data.context?.depth,
      window: data.context?.window,
      topology: data.context?.topology,
    },
    diagnostics: data.diagnostics,
  };
  fs.writeFileSync(path.join(work,`packet-${name}.json`), JSON.stringify(payload,null,2));
  console.log(name, 'bytes', fs.statSync(path.join(work,`packet-${name}.json`)).size, 'status', lane?.status);
}
