const test = require('node:test');
const assert = require('node:assert/strict');
const matcher = require('../extension/shared/matcher');

test('matcher validates inputs and rejects non-positive tile or zero-length vectors', () => {
  assert.throws(() => matcher.solve(null), /Options object is required/);
  assert.throws(() => matcher.solve({ width: 0, height: 100, targetHx: 40, targetHy: 0, targetVx: 0, targetVy: 50 }), /Tile width must be greater than zero/);
  assert.throws(() => matcher.solve({ width: 100, height: -10, targetHx: 40, targetHy: 0, targetVx: 0, targetVy: 50 }), /Tile height must be greater than zero/);
  assert.throws(() => matcher.solve({ width: 100, height: 100, targetHx: 0, targetHy: 0, targetVx: 0, targetVy: 50 }), /Horizontal vector must have non-zero length/);
  assert.throws(() => matcher.solve({ width: 100, height: 100, targetHx: 40, targetHy: 0, targetVx: 0, targetVy: 0 }), /Vertical vector must have non-zero length/);
  assert.throws(() => matcher.solve({ width: 100, height: 100, targetHx: 40, targetHy: NaN, targetVx: 0, targetVy: 50 }), /Horizontal Y must be a finite number/);
});

test('matcher returns exact 100% match when target vectors divide tile evenly in Grid', () => {
  // Tile 200 x 200, target H=(50, 0), V=(0, 50) -> 4 columns, 4 rows = exact 50 x 50
  const results = matcher.solve({
    width: 200,
    height: 200,
    targetHx: 50,
    targetHy: 0,
    targetVx: 0,
    targetVy: 50,
    mode: 'all',
    maxCandidates: 5
  });

  assert.ok(results.length > 0 && results.length <= 5);
  const best = results[0];
  assert.equal(best.rank, 1);
  assert.equal(best.matchPct, 100);
  assert.equal(best.layout, 'grid');
  assert.equal(best.columns, 4);
  assert.equal(best.rows, 4);
  assert.equal(best.horizontalX, 50);
  assert.equal(best.horizontalY, 0);
  assert.equal(best.verticalX, 0);
  assert.equal(best.verticalY, 50);
  assert.equal(best.diffHx, 0);
  assert.equal(best.diffHy, 0);
  assert.equal(best.diffVx, 0);
  assert.equal(best.diffVy, 0);
});

test('matcher finds 100% match for known Tilted Lattice with negative coordinates', () => {
  // W=120, H=120, C=3, R=4, Q=-1, A=-1, U=1
  // HX = 120/3 = 40
  // HY = 120 * (-1) / (1 * 3) = -40
  // VX = 40 * (-1) / 4 = -10
  // VY = (120/1 + (-40) * (-1)) / 4 = 160 / 4 = 40
  const results = matcher.solve({
    width: 120,
    height: 120,
    targetHx: 40,
    targetHy: -40,
    targetVx: -10,
    targetVy: 40,
    mode: 'all',
    maxCandidates: 5
  });

  assert.ok(results.length > 0);
  const best = results[0];
  assert.equal(best.matchPct, 100);
  assert.equal(best.layout, 'lattice');
  assert.equal(best.columns, 3);
  assert.equal(best.rows, 4);
  assert.equal(best.rowShift, -1);
  assert.equal(best.columnShift, -1);
  assert.equal(best.rowCycles, 1);
  assert.equal(best.horizontalX, 40);
  assert.equal(best.horizontalY, -40);
  assert.equal(best.verticalX, -10);
  assert.equal(best.verticalY, 40);
});

test('matcher handles user example H=(40, -5), V=(-10, 25) and returns top 5 sorted candidates', () => {
  const results = matcher.solve({
    width: 200,
    height: 200,
    targetHx: 40,
    targetHy: -5,
    targetVx: -10,
    targetVy: 25,
    mode: 'all',
    maxCandidates: 5
  });

  assert.equal(results.length, 5);
  for (let i = 0; i < results.length - 1; i += 1) {
    assert.ok(results[i].matchPct >= results[i + 1].matchPct);
    assert.equal(results[i].rank, i + 1);
  }
  const first = results[0];
  assert.ok(first.matchPct > 80);
  assert.ok(typeof first.display === 'object');
  assert.ok(typeof first.diffHx === 'number');
  assert.ok(typeof first.diffHy === 'number');
  assert.ok(typeof first.diffVx === 'number');
  assert.ok(typeof first.diffVy === 'number');
});

test('matcher scales display values by unitScale', () => {
  const results = matcher.solve({
    width: 200,
    height: 200,
    targetHx: 50,
    targetHy: 0,
    targetVx: 0,
    targetVy: 50,
    unitScale: 2,
    mode: 'all',
    maxCandidates: 5
  });

  const best = results[0];
  assert.equal(best.horizontalX, 50);
  assert.equal(best.display.horizontalX, 25);
});

test('matcher supports Top-Bottom vertical mode with fixed horizontal vector', () => {
  const results = matcher.solve({
    width: 300,
    height: 240,
    targetHx: 40,
    targetHy: -5,
    targetVx: -10,
    targetVy: 80,
    mode: 'vertical',
    maxCandidates: 5
  });

  assert.ok(results.length > 0);
  const best = results[0];
  assert.equal(best.horizontalX, 40);
  assert.equal(best.horizontalY, -5);
  assert.equal(best.diffHx, 0);
  assert.equal(best.diffHy, 0);
});

test('odd-row stagger never claims an exact constant vector across the tile seam',()=>{
  const results=matcher.solve({width:200,height:150,targetHx:50,targetHy:0,targetVx:25,targetVy:50,mode:'all',maxCandidates:100});
  assert.ok(results.length);assert.ok(results.every(c=>c.layout!=='stagger'||c.rows%2===0));
  assert.ok(results.every(c=>c.matchPct<100),'the requested vectors cannot close a 150pt vertical period exactly');
});

test('even-row stagger retains its exact match and closes the vertical lattice period',()=>{
  const results=matcher.solve({width:200,height:200,targetHx:50,targetHy:0,targetVx:25,targetVy:50,mode:'all'});
  assert.equal(results[0].layout,'stagger');assert.equal(results[0].matchPct,100);assert.equal(results[0].rows,4);
});
