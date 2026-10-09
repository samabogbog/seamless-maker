const test = require('node:test');
const assert = require('node:assert/strict');
const repeat = require('../extension/shared/repeat');
const defaults = { sizeMode: 'custom', width: 100, height: 80, columns: 4, rows: 4, scale: 100, rotation: 0, offsetX: 0, offsetY: 0, mode: 'all', layout: 'grid' };
const settings = (change) => ({ ...defaults, ...change });

test('grid uses cell centers and counts edge copies only when intersecting', () => {
  const p = repeat.plan(settings(), { width: 10, height: 10 });
  assert.equal(p.count, 16);
  assert.deepEqual(p.points[0], { x: 12.5, y: 10 });
  assert.deepEqual(p.points[15], { x: 87.5, y: 70 });
  assert.equal(repeat.plan(settings(), { width: 30, height: 24 }).count, 36);
});

test('one cell wraps four corners in All Sides and only top/bottom in vertical mode', () => {
  const s = settings({ columns: 1, rows: 1, offsetX: -50, offsetY: -40 });
  const all = repeat.plan(s, { width: 10, height: 10 });
  assert.deepEqual(all.points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 80 }, { x: 100, y: 80 }]);
  assert.deepEqual(repeat.plan({ ...s, mode: 'vertical' }, { width: 10, height: 10 }).points, [{ x: 0, y: 0 }, { x: 0, y: 80 }]);
});

test('negative offsets wrap by the tile period; vertical X is not wrapped', () => {
  const s = settings({ offsetX: -300, offsetY: -240 });
  assert.deepEqual(repeat.plan(s, { width: 10, height: 10 }), repeat.plan(settings(), { width: 10, height: 10 }));
  assert.equal(repeat.plan({ ...s, mode: 'vertical' }, { width: 10, height: 10 }).count, 0);
});

test('oversized symbol gets multiple periods and never a fixed one-ring pad', () => {
  const p = repeat.plan(settings({ columns: 1, rows: 1 }), { width: 620, height: 500 });
  assert.ok(p.points.some(point => point.x < -100));
  assert.ok(p.points.some(point => point.y > 160));
  for (const point of p.points) {
    assert.ok(point.x + 310 >= -1 && point.x - 310 <= 101);
    assert.ok(point.y + 250 >= -1 && point.y - 250 <= 81);
  }
});

// Independent brute-force lattice oracle: catches missing/extra border copies.
function brute(s, f) {
  const points = [];
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.columns; c++) {
    let x = (c + 0.5 + (s.layout === 'stagger' && r % 2 ? 0.5 : 0)) * s.width / s.columns + s.offsetX;
    const y = repeat.mod((r + 0.5) * s.height / s.rows + s.offsetY, s.height);
    if (s.mode === 'all') x = repeat.mod(x, s.width);
    for (let j = -12; j <= 12; j++) for (let k = s.mode === 'all' ? -12 : 0; k <= (s.mode === 'all' ? 12 : 0); k++) {
      const px = x + k * s.width, py = y + j * s.height;
      if (px + f.width / 2 >= -1 && px - f.width / 2 <= s.width + 1 && py + f.height / 2 >= -1 && py - f.height / 2 <= s.height + 1) points.push({ x: px, y: py });
    }
  }
  return points;
}
test('culling matches a brute-force lattice for odd/even staggered rows, offsets and oversized bounds', () => {
  for (const mode of ['all', 'vertical']) for (const layout of ['grid', 'stagger']) for (const rows of [1, 3, 4]) for (const offset of [-141, 0, 33]) {
    const s = settings({ mode, layout, rows, columns: 3, offsetX: offset, offsetY: offset });
    for (const f of [{ width: 18, height: 14 }, { width: 301, height: 265 }]) {
      const actual = repeat.plan(s, f).points, expected = brute(s, f);
      assert.equal(actual.length, expected.length);
      for (let i = 0; i < actual.length; i++) {
        assert.ok(Math.abs(actual[i].x - expected[i].x) < 1e-9);
        assert.ok(Math.abs(actual[i].y - expected[i].y) < 1e-9);
      }
    }
  }
});

test('all-sides contributors at opposite edges have identical local positions and stacking order', () => {
  for (const rows of [1, 3, 4]) {
    const f = { width: 260, height: 190 };
    const p = repeat.plan(settings({ rows, columns: 3, layout: 'stagger', offsetX: -35, offsetY: 17 }), f);
    function contributors(x, y) { return p.points.filter(q => Math.abs(q.x - x) < f.width / 2 && Math.abs(q.y - y) < f.height / 2).map(q => [+(q.x-x).toFixed(8), +(q.y-y).toFixed(8)]); }
    for (const v of [3, 27, 62]) {
      assert.deepEqual(contributors(0, v), contributors(100, v));
      assert.deepEqual(contributors(v, 0), contributors(v, 80));
    }
  }
});

test('limit is enforced before enormous arrays can be allocated', () => {
  const base = repeat.plan(settings({ columns: 100000000, rows: 100000000 }), { width: 10, height: 10 });
  assert.equal(base.exceeded, true); assert.deepEqual(base.points, []);
  const huge = repeat.plan(settings({ columns: 1, rows: 1 }), { width: 1e200, height: 1e200 });
  assert.equal(huge.exceeded, true); assert.deepEqual(huge.points, []);
  const warning = repeat.plan(settings({ columns: 50, rows: 50 }), { width: 0.1, height: 0.1 });
  assert.equal(warning.warning, true); assert.equal(warning.exceeded, false);
});

test('rejects invalid dimensions, enums and non-integer steps', () => {
  for (const change of [{ width: 0 }, { height: -1 }, { rows: 1.5 }, { columns: 0 }, { scale: NaN }, { offsetY: Infinity }, { mode: 'bad' }, { layout: 'bad' }, { sizeMode: 'bad' }]) {
    assert.throws(() => repeat.plan(settings(change), { width: 10, height: 10 }));
  }
  assert.throws(() => repeat.plan(settings(), { width: 0, height: 10 }));
});
