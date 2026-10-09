const test = require('node:test');
const assert = require('node:assert/strict');
const codec = require('../extension/shared/json');
test('legacy JSON codec roundtrips protocol data, Unicode and paths', () => {
  const value = { ok: true, name: 'Symbol "สี" \\ /\n\t', uri: 'file:///C:/Some%20Path/a.png', n: -0.02, points: [{ x: 12, y: 3 }], empty: null, disabled: false };
  assert.deepEqual(codec.parse(codec.stringify(value)), value);
  assert.deepEqual(JSON.parse(codec.stringify(value)), value);
  assert.deepEqual(codec.parse(JSON.stringify(value)), value);
});
test('strict parser rejects malformed and executable input', () => {
  for (const text of ['{"x":1,}', '[1,]', '01', '1 trailing', 'NaN', 'Infinity', '1e999', 'undefined', '{x:1}', '"\\x20"', '"\n"', '{"__proto__":{}}', '({x:1})', '[function(){}]']) assert.throws(() => codec.parse(text), text);
});
test('nonfinite response values become JSON null', () => {
  assert.equal(codec.stringify({ count: Infinity }), '{"count":null}');
});
