#!/usr/bin/env bash
# check-extension-updates.sh — report available updates for pinned extensions.
#
# Extensions update often; this surfaces version drift + release notes so we
# can adopt changes deliberately instead of discovering breakage after the fact.
#
# Pinned packages (context-mode, dynamic-workflows, pi-tscg) are patched at a
# specific version — an update there REQUIRES re-running/re-verifying the patch.
# Those are flagged [PINNED] so they are never auto-bumped blindly.
#
# Usage:
#   scripts/check-extension-updates.sh          # human report, exit 0 always
#   scripts/check-extension-updates.sh --strict # exit 1 if any update available
#   scripts/check-extension-updates.sh --json   # machine-readable
#   scripts/check-extension-updates.sh --notes  # + fetch GitHub release notes for outdated pkgs
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/packages.lock.json"
STRICT=0; JSON=0; NOTES=0
for a in "$@"; do case "$a" in --strict) STRICT=1;; --json) JSON=1;; --notes) NOTES=1;; esac; done
[[ -f "$LOCK" ]] || { echo "packages.lock.json not found" >&2; exit 1; }

# Packages whose installed version is pinned by a patch (do NOT auto-bump).
is_pinned() { case "$1" in
  context-mode|@quintinshaw/pi-dynamic-workflows|pi-tscg) return 0;; *) return 1;; esac; }

mapfile -t PKGS < <(node -e "const l=require('$LOCK');Object.keys(l).forEach(k=>console.log(k))" 2>/dev/null)
[[ ${#PKGS[@]} -gt 0 ]] || { echo "could not parse packages.lock.json" >&2; exit 1; }

check_one() {  # $1=pkg → prints "pkg|installed|latest|status"
  local p="$1" inst latest
  inst=$(node -e "console.log(require('$LOCK')['$p']||'')" 2>/dev/null)
  latest=$(npm view "$p" version 2>/dev/null || echo '?')
  local st="current"; [[ "$latest" == "?" ]] && st="unknown"
  [[ -n "$latest" && "$latest" != "?" && "$inst" != "$latest" ]] && st="UPDATE"
  echo "$p|$inst|$latest|$st"
}
export -f check_one; export LOCK

RESULTS=$(printf '%s\n' "${PKGS[@]}" | xargs -P8 -I{} bash -c 'check_one "$@"' _ {})

if [[ "$JSON" -eq 1 ]]; then
  echo "$RESULTS" | awk -F'|' '{printf "{\"pkg\":\"%s\",\"installed\":\"%s\",\"latest\":\"%s\",\"status\":\"%s\"}\n",$1,$2,$3,$4}' \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{console.log(JSON.stringify(s.trim().split('\n').filter(Boolean).map(JSON.parse),null,2))})"
  exit 0
fi

UPDATES=0; PINNED_UPDATES=0
echo "Extension update check ($(date +%F))"
echo "=================================================="
while IFS='|' read -r p inst latest st; do
  [[ -z "$p" ]] && continue
  if [[ "$st" == "UPDATE" ]]; then
    UPDATES=$((UPDATES+1))
    if is_pinned "$p"; then PINNED_UPDATES=$((PINNED_UPDATES+1)); tag="[PINNED—re-patch required]"
    else tag="[safe to bump]"; fi
    printf "  ⬆ %-38s %s → %s  %s\n" "$p" "$inst" "$latest" "$tag"
  fi
done <<< "$RESULTS"
[[ "$UPDATES" -eq 0 ]] && echo "  ✓ all ${#PKGS[@]} extensions current"
echo "=================================================="
[[ "$UPDATES" -gt 0 ]] && echo "$UPDATES update(s) available; $PINNED_UPDATES pinned (need patch re-verify). See release notes before bumping."

# --notes: fetch GitHub release notes for each outdated package so we can read
# what actually changed before deciding to bump (and re-patch pinned ones).
if [[ "$NOTES" -eq 1 && "$UPDATES" -gt 0 ]]; then
  echo; echo "Release notes for outdated packages:"
  echo "=================================================="
  while IFS='|' read -r p inst latest st; do
    [[ "$st" == "UPDATE" ]] || continue
    repo=$(npm view "$p" repository.url 2>/dev/null | sed -E 's#git\+##; s#\.git$##; s#git@github.com:#https://github.com/#')
    echo "--- $p ($inst -> $latest) ---"
    if [[ "$repo" == https://github.com/* ]]; then
      api="${repo/github.com/api.github.com/repos}/releases/latest"
      notes=$(curl -fsSL --max-time 8 "$api" 2>/dev/null | node "$ROOT/scripts/_gh-release-body.js" 2>/dev/null)
      if [[ -n "$notes" ]]; then
        echo "$notes"
      else
        echo "no GitHub release notes; see: $repo/releases"
      fi
    else
      echo "no GitHub repo on npm; see: https://www.npmjs.com/package/$p"
    fi
    echo
  done <<< "$RESULTS"
fi

[[ "$STRICT" -eq 1 && "$UPDATES" -gt 0 ]] && exit 1
exit 0
