#!/usr/bin/env bash
# regression-guard.sh — after.sh hook
# After a "keep", runs a quick regression smoke test by re-running the
# benchmark and checking the metric is still in the expected range.
# This catches "lucky passes" where a keep introduces a regression that
# checks.sh doesn't cover.
#
# Anti-overfitting: verifies that keeps are stable, not just lucky.
set -euo pipefail

readonly MEASURE_SCRIPT=".auto/measure.sh"
readonly TOLERANCE_PCT=10  # allow 10% regression from reported metric

input="$(cat)"
workdir="$(jq -r '.cwd' <<<"$input")"
status="$(jq -r '.run_entry.status // empty' <<<"$input")"
reported_metric="$(jq -r '.run_entry.metric // empty' <<<"$input")"
metric_name="$(jq -r '.session.metric_name // "metric"' <<<"$input")"

# Only fire on keep
[ "$status" = "keep" ] || exit 0
[ -f "$workdir/$MEASURE_SCRIPT" ] || exit 0
[ -n "$reported_metric" ] || exit 0

# Re-run the benchmark once
output="$(cd "$workdir" && bash "$MEASURE_SCRIPT" 2>&1)" || true
verify_metric="$(echo "$output" | grep -oP "METRIC \K${metric_name}=\K[0-9.]+" | head -1)"

[ -n "$verify_metric" ] || exit 0

# Check if verification is within tolerance
dev=$(echo "scale=6; if ($reported_metric != 0) { ($verify_metric - $reported_metric) / $reported_metric * 100 } else { 0 }" | bc -l)
abs_dev=$(echo "scale=6; if ($dev < 0) { -$dev } else { $dev }" | bc -l)
abs_dev_int=$(echo "$abs_dev" | cut -d. -f1)

if [ "$abs_dev_int" -gt "$TOLERANCE_PCT" ]; then
  cat <<EOF
🔍 Regression guard: re-ran benchmark after keep. Metric ${metric_name}=${verify_metric} vs reported ${reported_metric} (deviation: ${abs_dev}%).
This exceeds ${TOLERANCE_PCT}% tolerance — the keep may be unstable. Consider:
- The benchmark may be noisy; run it a few more times to confirm
- If the metric is genuinely worse, the keep may need to be reverted
- Check if the optimization has side effects not covered by .auto/checks.sh
EOF
fi
