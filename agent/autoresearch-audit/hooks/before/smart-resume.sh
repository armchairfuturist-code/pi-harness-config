#!/usr/bin/env bash
# smart-resume.sh — before.sh hook
# Reduces token waste on compaction resume by checking what actually changed
# since the last read, instead of blindly re-reading all session files.
#
# Token efficiency: avoids re-reading unchanged files by stat-checking
# modification times and only surfacing what's new.
set -euo pipefail

readonly PROMPT_MD=".auto/prompt.md"
readonly IDEAS_MD=".auto/ideas.md"
readonly LOG_JSONL=".auto/log.jsonl"
readonly STATE_FILE=".auto/.resume-state"

input="$(cat)"
workdir="$(jq -r '.cwd' <<<"$input")"
cd "$workdir"

# Initialize state file on first run
[ -f "$STATE_FILE" ] || echo '{"prompt_md":0,"ideas_md":0,"log_lines":0}' > "$STATE_FILE"

prev_prompt_mtime=$(jq -r '.prompt_md // 0' "$STATE_FILE")
prev_ideas_mtime=$(jq -r '.ideas_md // 0' "$STATE_FILE")
prev_log_lines=$(jq -r '.log_lines // 0' "$STATE_FILE")

output=""

# Check prompt.md — only mention if changed
if [ -f "$PROMPT_MD" ]; then
  current_mtime=$(stat -c %Y "$PROMPT_MD" 2>/dev/null || echo 0)
  if [ "$current_mtime" -gt "$prev_prompt_mtime" ]; then
    output+="📝 $PROMPT_MD has been updated since last read — re-read it.\n"
  fi
fi

# Check ideas.md — only mention if changed
if [ -f "$IDEAS_MD" ]; then
  current_ideas_mtime=$(stat -c %Y "$IDEAS_MD" 2>/dev/null || echo 0)
  if [ "$current_ideas_mtime" -gt "$prev_ideas_mtime" ]; then
    output+="💡 $IDEAS_MD has been updated — check for new ideas.\n"
  fi
fi

# Check log.jsonl — only show new entries
if [ -f "$LOG_JSONL" ]; then
  current_lines=$(wc -l < "$LOG_JSONL" 2>/dev/null || echo 0)
  new_lines=$((current_lines - prev_log_lines))
  if [ "$new_lines" -gt 0 ]; then
    output+="📊 $LOG_JSONL: ${new_lines} new entries since last read (tail: ${current_lines}).\n"
  fi
fi

# Git log — always show last 3 (cheap)
git_log=$(git log --oneline -3 2>/dev/null || true)
if [ -n "$git_log" ]; then
  output+="📋 Recent commits:\n${git_log}\n"
fi

# Update state file
new_prompt_mtime=$(stat -c %Y "$PROMPT_MD" 2>/dev/null || echo 0)
new_ideas_mtime=$(stat -c %Y "$IDEAS_MD" 2>/dev/null || echo 0)
new_log_lines=$(wc -l < "$LOG_JSONL" 2>/dev/null || echo 0)
jq -n \
  --arg pm "$new_prompt_mtime" \
  --arg im "$new_ideas_mtime" \
  --arg ll "$new_log_lines" \
  '{prompt_md:($pm|tonumber), ideas_md:($im|tonumber), log_lines:($ll|tonumber)}' \
  > "$STATE_FILE"

# Output steer (only if something changed)
if [ -n "$output" ]; then
  echo -e "$output" | head -20
fi
