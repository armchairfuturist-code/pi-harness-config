// _gh-release-body.js — read a GitHub release JSON from stdin, print name + body excerpt.
// Used by check-extension-updates.sh --notes. Kept as a file to avoid fragile
// inline node -e quoting inside the bash command substitution.
let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  try {
    const r = JSON.parse(s);
    const name = r.name || r.tag_name || '';
    const body = (r.body || '').split('\n').slice(0, 25).join('\n');
    console.log(name);
    if (body) console.log(body);
  } catch (e) {
    // no release / parse failure → print nothing, caller falls back to compare link
  }
});
