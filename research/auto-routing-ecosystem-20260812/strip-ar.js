const fs = require('fs');

function stripSettings(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const j = JSON.parse(raw);
  if (!Array.isArray(j.packages)) throw new Error('no packages in ' + path);
  const before = j.packages.length;
  j.packages = j.packages.filter((p) => !String(p).includes('pi-auto-reasoning-tool'));
  if (j.packages.length === before) {
    console.log('settings no-op', path);
  } else {
    fs.writeFileSync(path, JSON.stringify(j, null, 2) + '\n');
    console.log('settings stripped', path, before, '->', j.packages.length);
  }
}

function stripLock(path) {
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (!Object.prototype.hasOwnProperty.call(j, '@howaboua/pi-auto-reasoning-tool')) {
    console.log('lock no-op', path);
    return;
  }
  delete j['@howaboua/pi-auto-reasoning-tool'];
  fs.writeFileSync(path, JSON.stringify(j) + '\n');
  console.log('lock stripped', path);
}

for (const p of [
  '/home/alex/Projects/pi-harness-config/settings.json',
  '/home/alex/Projects/pi-harness-config/agent/settings.json',
  '/home/alex/.pi/agent/settings.json',
]) stripSettings(p);

for (const p of [
  '/home/alex/Projects/pi-harness-config/packages.lock.json',
  '/home/alex/Projects/pi-harness-config/agent/packages.lock.json',
  '/home/alex/.pi/agent/packages.lock.json',
]) stripLock(p);
