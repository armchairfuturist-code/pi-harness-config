const fs = require('fs');
const files = [
  '/home/alex/Projects/pi-harness-config/packages.lock.json',
  '/home/alex/Projects/pi-harness-config/agent/packages.lock.json',
  '/home/alex/.pi/agent/packages.lock.json',
];
for (const p of files) {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  delete j['@howaboua/pi-auto-reasoning-tool'];
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('pretty', p);
}
