'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'setechub-state.json');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Payload muito grande'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function validateStateShape(candidate) {
  if (!isPlainObject(candidate)) {
    throw new Error('Estado invalido: payload precisa ser um objeto.');
  }
  const arrayKeys = [
    'municipalities',
    'sectors',
    'directoryContacts',
    'officialLinks',
    'checklist',
    'tasks',
    'calls',
    'schools',
    'supervisors',
    'supervisorVisits',
    'schoolProfiles',
    'schoolImports',
    'schoolAssets',
    'schoolNetworks',
    'assets',
    'notes'
  ];
  arrayKeys.forEach((key) => {
    if (candidate[key] != null && !Array.isArray(candidate[key])) {
      throw new Error(`Estado invalido: ${key} precisa ser uma lista.`);
    }
  });
  if (candidate.profile != null && !isPlainObject(candidate.profile)) {
    throw new Error('Estado invalido: profile precisa ser um objeto.');
  }
  if (candidate.officialContacts != null && !isPlainObject(candidate.officialContacts)) {
    throw new Error('Estado invalido: officialContacts precisa ser um objeto.');
  }
  if (candidate.histories != null && !isPlainObject(candidate.histories)) {
    throw new Error('Estado invalido: histories precisa ser um objeto.');
  }
  if (candidate.ponto != null && !isPlainObject(candidate.ponto)) {
    throw new Error('Estado invalido: ponto precisa ser um objeto.');
  }
  if (candidate.redes != null && !isPlainObject(candidate.redes)) {
    throw new Error('Estado invalido: redes precisa ser um objeto.');
  }
  return true;
}

function safeResolve(urlPath) {
  const normalized = decodeURIComponent(urlPath.split('?')[0]);
  const requested = ['/', '/login'].includes(normalized) ? '/frontend/index.html' : normalized;
  const resolved = path.resolve(ROOT_DIR, `.${requested}`);
  if (!resolved.startsWith(ROOT_DIR)) return null;
  return resolved;
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        sendText(res, 404, 'Arquivo nao encontrado');
        return;
      }
      sendText(res, 500, error.message);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function readStateFile() {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) return null;
  const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  validateStateShape(parsed.state || parsed);
  return parsed;
}

function writeStateFile(payload) {
  ensureDataDir();
  validateStateShape(payload.state || payload);
  fs.writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
}

function snapshotId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function listSnapshots() {
  ensureDataDir();
  return fs.readdirSync(SNAPSHOT_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const fullPath = path.join(SNAPSHOT_DIR, file);
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      return {
        id: path.basename(file, '.json'),
        label: parsed.label || path.basename(file, '.json'),
        savedAt: parsed.savedAt || fs.statSync(fullPath).mtime.toISOString()
      };
    })
    .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
}

function createSnapshot(payload) {
  ensureDataDir();
  const id = snapshotId();
  const filePath = path.join(SNAPSHOT_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify({
    id,
    label: `Snapshot ${id}`,
    savedAt: new Date().toISOString(),
    state: payload.state || payload
  }, null, 2), 'utf8');
  return id;
}

function readSnapshot(id) {
  const filePath = path.join(SNAPSHOT_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (requestUrl.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      mode: 'arquivo-local',
      stateFile: fs.existsSync(STATE_FILE),
      updatedAt: fs.existsSync(STATE_FILE) ? fs.statSync(STATE_FILE).mtime.toISOString() : null,
      snapshotCount: listSnapshots().length
    });
    return;
  }

  if (requestUrl.pathname === '/api/state' && req.method === 'GET') {
    const state = readStateFile();
    if (!state) {
      sendJson(res, 404, { error: 'Nenhum estado salvo no servidor local.' });
      return;
    }
    sendJson(res, 200, state);
    return;
  }

  if (requestUrl.pathname === '/api/state' && req.method === 'PUT') {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body || '{}');
      const state = parsed.state || parsed;
      validateStateShape(state);
      writeStateFile({
        savedAt: new Date().toISOString(),
        state
      });
      const id = createSnapshot({ state });
      sendJson(res, 200, { ok: true, savedAt: new Date().toISOString(), snapshotId: id });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (requestUrl.pathname === '/api/snapshots' && req.method === 'GET') {
    sendJson(res, 200, { items: listSnapshots() });
    return;
  }

  if (requestUrl.pathname.startsWith('/api/snapshots/') && req.method === 'POST') {
    const id = requestUrl.pathname.split('/').pop();
    const snapshot = readSnapshot(id);
    if (!snapshot) {
      sendJson(res, 404, { error: 'Snapshot nao encontrado.' });
      return;
    }
    writeStateFile({
      savedAt: new Date().toISOString(),
      restoredFrom: id,
      state: snapshot.state || snapshot
    });
    sendJson(res, 200, {
      ok: true,
      restoredFrom: id,
      state: snapshot.state || snapshot
    });
    return;
  }

  if (req.method !== 'GET') {
    sendText(res, 405, 'Metodo nao suportado');
    return;
  }

  const filePath = safeResolve(requestUrl.pathname);
  if (!filePath) {
    sendText(res, 403, 'Caminho nao permitido');
    return;
  }

  serveFile(res, filePath);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`SETECHUB local server em http://localhost:${PORT}`);
  });
}

module.exports = {
  safeResolve,
  validateStateShape
};
