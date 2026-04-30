const test = require('node:test');
const assert = require('node:assert/strict');

const { safeResolve, validateStateShape } = require('../server/index.js');

test('validateStateShape accepts a minimal valid state', () => {
  assert.equal(validateStateShape({
    profile: { name: 'Jefferson' },
    tasks: [],
    calls: [],
    schools: [],
    schoolProfiles: [],
    schoolImports: [],
    schoolAssets: [],
    schoolNetworks: [],
    assets: [],
    notes: [],
    histories: { calls: [], visits: [] },
    ponto: {},
    redes: {}
  }), true);
});

test('validateStateShape rejects invalid task shape container', () => {
  assert.throws(() => validateStateShape({
    profile: {},
    tasks: {},
    schools: []
  }), /tasks precisa ser uma lista/i);
});

test('safeResolve keeps frontend root access and blocks traversal', () => {
  const allowed = safeResolve('/frontend/index.html');
  assert.match(allowed, /frontend[\\/]index\.html$/i);
  assert.match(safeResolve('/login'), /frontend[\\/]index\.html$/i);
  assert.equal(safeResolve('/../../Windows/system32'), null);
});
