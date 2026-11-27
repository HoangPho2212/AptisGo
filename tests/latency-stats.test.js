const test = require('node:test');
const assert = require('node:assert/strict');

const { summarizeLatencies } = require('./support/latencyStats');

test('summarizeLatencies reports nearest-rank percentiles for a small sample', () => {
  assert.deepEqual(summarizeLatencies([10, 20, 30, 40]), {
    count: 4,
    min: 10,
    p50: 20,
    p90: 40,
    p95: 40,
    p99: 40,
    max: 40,
    mean: 25,
  });
});

test('summarizeLatencies sorts unsorted input before ranking', () => {
  const summary = summarizeLatencies([5, 1, 3]);

  assert.equal(summary.min, 1);
  assert.equal(summary.p50, 3);
  assert.equal(summary.max, 5);
  assert.equal(summary.mean, 3);
});

test('summarizeLatencies handles a single sample', () => {
  assert.deepEqual(summarizeLatencies([7]), {
    count: 1,
    min: 7,
    p50: 7,
    p90: 7,
    p95: 7,
    p99: 7,
    max: 7,
    mean: 7,
  });
});

test('summarizeLatencies uses the nearest-rank index for 100 samples', () => {
  const samples = Array.from({ length: 100 }, (_unused, index) => index + 1);
  const summary = summarizeLatencies(samples);

  assert.equal(summary.p50, 50);
  assert.equal(summary.p90, 90);
  assert.equal(summary.p95, 95);
  assert.equal(summary.p99, 99);
  assert.equal(summary.max, 100);
  assert.equal(summary.mean, 50.5);
});

test('summarizeLatencies keeps fractional milliseconds', () => {
  const summary = summarizeLatencies([12.5, 18.25, 33.75]);

  assert.equal(summary.min, 12.5);
  assert.equal(summary.max, 33.75);
  assert.ok(Math.abs(summary.mean - 21.5) < 1e-9);
});

test('summarizeLatencies rejects an empty sample', () => {
  assert.throws(() => summarizeLatencies([]), RangeError);
});

test('summarizeLatencies rejects unusable samples', () => {
  for (const samples of [[Number.NaN], [Infinity], [-1], ['12'], [null], 'nope', undefined]) {
    assert.throws(() => summarizeLatencies(samples), TypeError);
  }
});
