#!/usr/bin/env bash
# benchmark-stability.sh — before.sh hook
# On the first run (no prior results), run the benchmark 3× to establish a
# noise floor. Warn if variance exceeds a threshold. This prevents the agent
# from chasing noise-driven "improvements" and makes the confidence score
# reliable from the start.
#
# Anti-overfitting: by calibrating noise early, we prevent the agent from
# keeping changes that are within measurement noise — a common form of
# accidental benchmark overfitting.
set -euo pipefail

readonly STABILITY_RUNS=3
readonly VARIANCE_THRESHOLD_PCT=5
readonly MEASURE_SCRIPT=".auto/measure.sh"

input="$(cat)"
workdir="$(jq -r '.cwd' <<<"$input")"
run_count="$(jq -r '.session.run_count // 0' <<<"$input")"

# Only fire on the very first run
[ "$run_count" -eq 0 ] || exit 0

# Check measure.sh exists
[ -f "$workdir/$MEASURE_SCRIPT" ] || exit 0

# Run the benchmark N times, collect primary metric values
declare -a values
for i in $(seq 1 "$STABILITY_RUNS"); do
  output="$(cd "$workdir" && bash "$MEASURE_SCRIPT" 2>&1)" || true
  # Extract the first METRIC line (primary metric)
  val="$(echo "$output" | grep -oP 'METRIC \K[^=]+=\K[0-9.]+' | head -1)"
  [ -n "$val" ] && values+=("$val")
done

# Need at least 2 values to compute variance
count="${#values[@]}"
[ "$count" -ge 2 ] || exit 0

# Compute mean and max-deviation percentage
sum=0
for v in "${values[@]}"; do
  sum=$(echo "$sum + $v" | bc -l)
done
mean=$(echo "scale=6; $sum / $count" | bc -l)

max_dev=0
for v in "${values[@]}"; do
  dev=$(echo "scale=6; if ($mean != 0) { ($v - $mean) / $mean * 100 } else { 0 }" | bc -l)
  abs_dev=$(echo "scale=6; if ($dev < 0) { -$dev } else { $dev }" | bc -l)
  max_dev=$(echo "scale=6; if ($abs_dev > $max_dev) { $abs_dev } else { $max_dev }" | bc -l)
done

# Compare as integers (bc doesn't do comparisons easily)
max_dev_int=$(echo "$max_dev" | cut -d. -f1)
if [ "$max_dev_int" -gt "$VARIANCE_THRESHOLD_PCT" ]; then
  cat <<EOF
⚠️ Benchmark noise calibration: ran ${STABILITY_RUNS}× baseline, max deviation ${max_dev}% (threshold ${VARIANCE_THRESHOLD_PCT}%).
Values: ${values[*]} (mean: ${mean})
This benchmark is NOISY. Improvements < ${max_dev_int}% are likely within noise — use run_experiment's multiple-run median feature or increase STABILITY_RUNS. Do not keep changes that improve by less than the noise floor.
EOF
else
  echo "📊 Benchmark stability: ${STABILITY_RUNS}× baseline, max deviation ${max_dev}% — stable. Noise floor ≈ ${max_dev_int}%."
fi
