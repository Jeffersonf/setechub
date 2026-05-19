const test = require('node:test');
const assert = require('node:assert/strict');

const { safeResolve, sharePointListApiUrl, validateStateShape } = require('../server/index.js');

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

test('safeResolve keeps app entry access and blocks traversal', () => {
  const allowed = safeResolve('/frontend/index.html');
  assert.match(allowed, /frontend[\\/]index\.html$/i);
  assert.match(safeResolve('/'), /index\.html$/i);
  assert.match(safeResolve('/login'), /index\.html$/i);
  assert.equal(safeResolve('/../../Windows/system32'), null);
});

test('sharePointListApiUrl maps list views and shared list links to REST items', () => {
  const classic = sharePointListApiUrl('https://seesp-my.sharepoint.com/personal/site/Lists/ReservasVeiculos/AllItems.aspx');
  assert.equal(
    classic,
    "https://seesp-my.sharepoint.com/personal/site/_api/web/GetList('/personal/site/Lists/ReservasVeiculos')/items?%24top=5000"
  );

  const shared = sharePointListApiUrl('https://seesp-my.sharepoint.com/:l:/g/personal/site/abc?e=123');
  assert.equal(shared, classic);
});
