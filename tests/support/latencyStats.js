/**
 * Nearest-rank percentile over an already sorted array.
 *
 * @param {number[]} sortedSamples
 * @param {number} p percentile in (0, 100]
 * @returns {number}
 */
function percentile(sortedSamples, p) {
  const rank = Math.ceil((p / 100) * sortedSamples.length);
  const index = Math.min(sortedSamples.length - 1, Math.max(0, rank - 1));

  return sortedSamples[index];
}

/**
 * @param {number[]} samples latencies in milliseconds
 * @returns {{ count: number, min: number, p50: number, p90: number, p95: number, p99: number, max: number, mean: number }}
 */
function summarizeLatencies(samples) {
  if (!Array.isArray(samples)) {
    throw new TypeError('summarizeLatencies requires an array of milliseconds');
  }

  if (samples.length === 0) {
    throw new RangeError('summarizeLatencies requires at least one sample');
  }

  for (const sample of samples) {
    if (typeof sample !== 'number' || !Number.isFinite(sample) || sample < 0) {
      throw new TypeError('every latency must be a finite, non-negative number');
    }
  }

  const sorted = [...samples].sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);

  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
    mean: total / sorted.length,
  };
}

module.exports = { summarizeLatencies };
