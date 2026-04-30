'use strict';

function canUseLocalApi() {
  return /^https?:$/i.test(window.location.protocol);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Falha em ${path}`);
  }
  return response.json();
}

async function refreshServerHealth() {
  if (!canUseLocalApi()) {
    serverStatus = { available: false, message: 'Abra pelo servidor local para usar a API.' };
    renderDiagnostics();
    return serverStatus;
  }
  try {
    const payload = await apiRequest('/api/health');
    serverStatus = {
      available: true,
      message: `Online em ${payload.mode || 'local'} | estado ${payload.stateFile ? 'pronto' : 'sem arquivo'} | snapshots ${payload.snapshotCount || 0}`
    };
  } catch (error) {
    serverStatus = { available: false, message: `Falha na API local: ${error.message}` };
  }
  renderDiagnostics();
  return serverStatus;
}

async function saveStateToServer() {
  if (!canManageUsers()) return;
  if (!canUseLocalApi()) {
    alert('Abra o SETECHUB pelo servidor local para salvar estado na API.');
    return;
  }
  try {
    await apiRequest('/api/state', {
      method: 'PUT',
      body: JSON.stringify({ state })
    });
    await loadServerSnapshots();
    await refreshServerHealth();
    alert('Estado salvo no servidor local.');
  } catch (error) {
    alert(`Nao foi possivel salvar no servidor local: ${error.message}`);
  }
}

async function loadStateFromServer() {
  if (!canManageUsers()) return;
  if (!canUseLocalApi()) {
    alert('Abra o SETECHUB pelo servidor local para carregar estado da API.');
    return;
  }
  try {
    const payload = await apiRequest('/api/state');
    state = mergeState(payload.state || payload);
    refreshAll();
    await loadServerSnapshots();
    await refreshServerHealth();
    alert('Estado carregado do servidor local.');
  } catch (error) {
    alert(`Nao foi possivel carregar do servidor local: ${error.message}`);
  }
}

async function loadServerSnapshots() {
  if (!canManageUsers()) {
    serverSnapshots = [];
    renderDiagnostics();
    return serverSnapshots;
  }
  if (!canUseLocalApi()) {
    serverSnapshots = [];
    renderDiagnostics();
    return serverSnapshots;
  }
  try {
    const payload = await apiRequest('/api/snapshots');
    serverSnapshots = payload.items || [];
  } catch {
    serverSnapshots = [];
  }
  renderDiagnostics();
  return serverSnapshots;
}

async function restoreServerSnapshot(id) {
  if (!canManageUsers()) return;
  if (!canUseLocalApi()) {
    alert('Abra o SETECHUB pelo servidor local para restaurar snapshots.');
    return;
  }
  try {
    const payload = await apiRequest(`/api/snapshots/${encodeURIComponent(id)}`, { method: 'POST' });
    state = mergeState(payload.state || payload);
    refreshAll();
    await loadServerSnapshots();
    await refreshServerHealth();
    alert('Snapshot restaurado com sucesso.');
  } catch (error) {
    alert(`Nao foi possivel restaurar snapshot: ${error.message}`);
  }
}

async function syncFromServerIfUseful() {
  if (!canUseLocalApi()) return;
  const hasLocalState = !!localStorage.getItem(STORAGE_KEY);
  try {
    const payload = await apiRequest('/api/state');
    if (!hasLocalState) {
      state = mergeState(payload.state || payload);
      refreshAll();
    }
  } catch {
    return;
  }
}

function normalizeSupabaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function supabaseConfig() {
  const config = loadSupabaseConfig();
  return {
    url: normalizeSupabaseUrl(config.url),
    anonKey: String(config.anonKey || '').trim()
  };
}

function updateSupabaseStatus(message, configured = false) {
  supabaseStatus = { configured, message };
  const node = document.getElementById('supabaseStatusMeta');
  if (node) node.textContent = message;
  const urlInput = document.getElementById('supabaseUrl');
  const keyInput = document.getElementById('supabaseAnonKey');
  const config = supabaseConfig();
  if (urlInput && !urlInput.value) urlInput.value = config.url || '';
  if (keyInput && !keyInput.value) keyInput.value = config.anonKey || '';
}

async function supabaseRequest(path, options = {}) {
  const config = supabaseConfig();
  if (!config.url || !config.anonKey) {
    throw new Error('Configure URL e anon key do Supabase na tela Conta.');
  }
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Falha Supabase HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function checkSupabaseConnection() {
  if (!canManageUsers()) return;
  try {
    await supabaseRequest('app_state?select=id,updated_at&id=eq.setechub_state&limit=1');
    updateSupabaseStatus('Supabase conectado. Tabela app_state acessivel.', true);
  } catch (error) {
    updateSupabaseStatus(`Falha no Supabase: ${error.message}`, false);
  }
}

async function saveStateToSupabase() {
  if (!canManageUsers()) return;
  try {
    await supabaseRequest('app_state?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify({ id: 'setechub_state', state, updated_at: new Date().toISOString() })
    });
    updateSupabaseStatus('Estado salvo no Supabase.', true);
  } catch (error) {
    updateSupabaseStatus(`Nao foi possivel salvar no Supabase: ${error.message}`, false);
  }
}

async function loadStateFromSupabase() {
  if (!canManageUsers()) return;
  try {
    const rows = await supabaseRequest('app_state?select=state,updated_at&id=eq.setechub_state&limit=1');
    const remoteState = rows?.[0]?.state;
    if (!remoteState) {
      updateSupabaseStatus('Nenhum estado setechub_state encontrado no Supabase.', true);
      return;
    }
    state = mergeState(remoteState);
    refreshAll();
    updateSupabaseStatus(`Estado carregado do Supabase. Atualizado em ${rows[0].updated_at || 'data nao informada'}.`, true);
  } catch (error) {
    updateSupabaseStatus(`Nao foi possivel carregar do Supabase: ${error.message}`, false);
  }
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const input = String(text || '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => String(cell || '').trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  row.push(value);
  if (row.some((cell) => String(cell || '').trim())) rows.push(row);
  return rows;
}

function normalizeCsvHeader(value) {
  return normalizeKey(repairMojibakeString(value)).replace(/[^a-z0-9]+/g, '');
}

function csvValue(record, names) {
  const wanted = names.map(normalizeCsvHeader);
  const entry = Object.entries(record).find(([key]) => wanted.includes(key));
  return repairMojibakeString(entry?.[1] || '').trim();
}

function parseBrazilianDate(value) {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function supervisorVisitSourceFor(source) {
  return (state.supervisors || []).find((supervisor) =>
    normalizeKey(supervisor.name) === normalizeKey(source.supervisor) ||
    (source.aliases || []).some((alias) => normalizeKey(alias) === normalizeKey(supervisor.name)) ||
    (supervisor.sourceAliases || []).some((alias) => normalizeKey(alias) === normalizeKey(source.supervisor))
  );
}

function sourceRowBelongsToSupervisor(rowSupervisor, source, supervisor) {
  const names = [source.supervisor, supervisor?.name, ...(source.aliases || []), ...(supervisor?.sourceAliases || [])];
  return names.filter(Boolean).some((name) => normalizeKey(name) === normalizeKey(rowSupervisor));
}

function googleSheetCsvUrl(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  if (/output=csv|format=csv/i.test(text)) return text;
  const match = text.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/i);
  if (!match) return text;
  const gidMatch = text.match(/[?&#]gid=(\d+)/i);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

function mergeSupervisorVisitSourceRows(source, rows) {
  const supervisor = supervisorVisitSourceFor(source);
  if (!supervisor) return 0;
  const importedAt = new Date().toISOString();
  const incoming = rows
    .map((row) => {
      const rowSupervisor = csvValue(row, ['Nome do Supervisor', 'Supervisor']) || source.supervisor;
      const school = canonicalSchoolName(csvValue(row, ['Escola Visitada', 'Escola']));
      const date = parseBrazilianDate(csvValue(row, ['Data Da Visita', 'Data da Visita', 'Data']));
      if (!rowSupervisor || !school || !date || !sourceRowBelongsToSupervisor(rowSupervisor, source, supervisor)) return null;
      const submittedAt = csvValue(row, ['Carimbo de data/hora', 'Timestamp']);
      const confirmation = csvValue(row, ['Confirmacao de Visita', 'Confirmacao', 'Confirmação de Visita']);
      return {
        id: `${source.id}-${normalizeKey(supervisor.name)}-${normalizeKey(school)}-${date}`,
        supervisor: supervisor.name,
        school,
        date,
        type: 'Planilha Google',
        notes: confirmation || `Importado de ${source.label}.`,
        source: 'google-sheet',
        sourceId: source.id,
        sourceLabel: source.label,
        importedAt,
        submittedAt,
        confirmation
      };
    })
    .filter(Boolean);
  if (!incoming.length) return 0;

  const incomingKeys = new Set(incoming.map((item) => normalizeKey(`${item.supervisor}|${item.school}|${item.date}|${item.type}`)));
  state.supervisorVisits = [
    ...(state.supervisorVisits || []).filter((item) => {
      if (item.sourceId === source.id) return !incomingKeys.has(normalizeKey(`${item.supervisor}|${item.school}|${item.date}|${item.type}`));
      if (item.supervisor !== supervisor.name) return true;
      return !(item.source === 'teste' || /^visit-\d+-\d+$/.test(String(item.id || '')) || /registro de teste/i.test(item.notes || ''));
    }),
    ...incoming
  ];

  const schoolsFromSource = [...new Set(incoming.map((item) => item.school))];
  state.supervisors = (state.supervisors || []).map((item) => {
    if (item.name !== supervisor.name) return item;
    return {
      ...item,
      schools: [...new Set([...(item.schools || []), ...schoolsFromSource])],
      monthlyGoal: Math.max(Number(item.monthlyGoal || 0), schoolsFromSource.length || 1),
      visitSourceId: source.id,
      visitSourceUrl: source.url,
      visitSourceLabel: source.label,
      visitSourcePrimary: source.primary,
      sourceAliases: source.aliases || [],
      source: 'google-sheet',
      sourceSyncedAt: importedAt
    };
  });
  return incoming.length;
}

async function syncSupervisorVisitSource(source) {
  const response = await fetch(googleSheetCsvUrl(source.url), { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = parseCsvRows(await response.text());
  const [headers, ...dataRows] = rows;
  if (!headers?.length) return 0;
  const records = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [normalizeCsvHeader(header), row[index] || ''])));
  return mergeSupervisorVisitSourceRows(source, records);
}

async function syncSupervisorVisitSources() {
  if (!Array.isArray(SUPERVISOR_VISIT_SOURCES) || !SUPERVISOR_VISIT_SOURCES.length) return;
  let importedCount = 0;
  for (const source of SUPERVISOR_VISIT_SOURCES) {
    try {
      importedCount += await syncSupervisorVisitSource(source);
    } catch (error) {
      console.warn(`Nao foi possivel sincronizar ${source.label}:`, error);
    }
  }
  if (importedCount) refreshAll();
}

async function syncCurrentSupervisorVisitSource() {
  const supervisor = supervisorByName(currentSupervisorDetail);
  if (!supervisor?.visitSourceUrl) {
    alert('Este supervisor ainda nao tem link de planilha Google cadastrado.');
    return;
  }
  const button = document.getElementById('refreshSupervisorSheetBtn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Atualizando...';
  }
  try {
    const source = {
      id: supervisor.visitSourceId || `supervisor-google-${normalizeKey(supervisor.name).replace(/[^a-z0-9]+/g, '-')}`,
      supervisor: supervisor.name,
      aliases: supervisor.sourceAliases || [],
      url: supervisor.visitSourceUrl,
      label: supervisor.visitSourceLabel || 'Planilha Google',
      primary: supervisor.visitSourcePrimary ?? true
    };
    const importedCount = await syncSupervisorVisitSource(source);
    refreshAll();
    showPage('supervisor-record');
    alert(importedCount
      ? `${importedCount} visita(s) atualizada(s) pela planilha Google.`
      : 'Planilha lida, mas nenhuma visita nova foi encontrada.');
  } catch (error) {
    alert(`Nao foi possivel atualizar pela planilha Google: ${error.message}`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Atualizar planilha';
    }
  }
}
