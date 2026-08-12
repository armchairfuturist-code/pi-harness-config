const fs = require('fs');
for (const p of [
  '/home/alex/Projects/pi-harness-config/settings.json',
  '/home/alex/Projects/pi-harness-config/packages.lock.json',
  '/home/alex/Projects/pi-harness-config/agent/settings.json',
  '/home/alex/Projects/pi-harness-config/agent/packages.lock.json',
  '/home/alex/.pi/agent/settings.json',
  '/home/alex/.pi/agent/packages.lock.json',
]) {
  JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log('ok', p);
}
