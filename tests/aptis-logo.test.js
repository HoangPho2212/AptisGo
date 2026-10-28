const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

const LOGOS = [
  { file: 'client/public/aptis-logo.svg', label: 'square' },
  { file: 'client/public/aptis-logo-full.svg', label: 'horizontal' },
];

for (const { file, label } of LOGOS) {
  test(`Aptis ${label} logo has a transparent background`, () => {
    const svg = readFileSync(join(ROOT, file), 'utf8');
    const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/);

    assert.ok(viewBox, `${file} must declare a viewBox`);

    const [, width, height] = viewBox;
    const fullCanvasRects = [...svg.matchAll(/<rect\b[^>]*>/g)].filter(([rect]) => {
      return rect.includes(`width="${width}"`) && rect.includes(`height="${height}"`);
    });

    assert.deepEqual(
      fullCanvasRects,
      [],
      `${file} must not include a full-canvas background rectangle`
    );
  });
}
