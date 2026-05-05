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

async function processRedesOnServer() {
  if (!canUseLocalApi()) {
    alert('Abra o PainelURE pelo servidor local para processar as redes direto pelo site.');
    return;
  }
  const button = document.getElementById('processRedeBtn');
  const status = document.getElementById('redeProcessStatus');
  try {
    if (button) button.disabled = true;
    if (status) status.textContent = 'Processando DOCX no Word e gerando PDFs...';
    const payload = await apiRequest('/api/redes/process', {
      method: 'POST',
      body: JSON.stringify({ config: state.redes })
    });
    if (status) status.textContent = payload.stdout || 'Redes processadas. PDFs gerados na mesma pasta.';
    alert('Redes processadas. PDFs gerados na mesma pasta.');
  } catch (error) {
    if (status) status.textContent = `Falha ao processar: ${error.message}`;
    alert(`Nao foi possivel processar as redes: ${error.message}`);
  } finally {
    if (button) button.disabled = false;
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

function supervisorForSourceRow(rowSupervisor, source = {}) {
  const rowKey = normalizeKey(rowSupervisor);
  if (!rowKey) return null;
  const rowFirstName = rowKey.split(/\s+/)[0];
  return (state.supervisors || []).find((supervisor) => {
    const names = [
      source.supervisor,
      supervisor.name,
      ...(source.aliases || []),
      ...(supervisor.sourceAliases || [])
    ].filter(Boolean);
    return names.some((name) => {
      const key = normalizeKey(name);
      const firstName = key.split(/\s+/)[0];
      return key === rowKey ||
        key.startsWith(`${rowKey} `) ||
        rowKey.startsWith(`${key} `) ||
        (rowFirstName && firstName === rowFirstName);
    });
  }) || null;
}

function sourceRowBelongsToSupervisor(rowSupervisor, source, supervisor) {
  const names = [source.supervisor, supervisor?.name, ...(source.aliases || []), ...(supervisor?.sourceAliases || [])];
  const firstNames = names.map((name) => String(name || '').trim().split(/\s+/)[0]);
  names.push(...firstNames);
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

function googleSheetGidFromUrl(url) {
  const match = String(url || '').match(/[?&#]gid=(\d+)/i);
  return match ? match[1] : '';
}

function googleSheetGidCsvUrl(url, gid) {
  const text = String(url || '').trim();
  if (!gid) return googleSheetCsvUrl(text);
  if (/docs\.google\.com\/spreadsheets\/d\/e\//i.test(text)) {
    const base = text.split('?')[0];
    return `${base}?output=csv&gid=${encodeURIComponent(gid)}`;
  }
  const regularMatch = text.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/i);
  if (regularMatch) {
    return `https://docs.google.com/spreadsheets/d/${regularMatch[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`;
  }
  return googleSheetCsvUrl(text);
}

function supervisorMonthlySheetSource(link) {
  if (!link?.url) return null;
  return {
    id: `supervisor-monthly-${link.monthKey || 'sem-mes'}-${link.id}`,
    url: link.url,
    label: link.label || `Planilha supervisores - ${supervisorSheetMonthLabel(link.monthKey)}`,
    primary: true,
    aggregate: true,
    requireSupervisorColumn: true,
    panelGid: link.panelGid || googleSheetGidFromUrl(link.url),
    tabPrefix: 'DADOS_',
    monthKey: link.monthKey
  };
}

function supervisorMonthlySheetSources() {
  return (state.officialLinks || [])
    .filter((item) => item.category === 'supervisor-sheet' && item.url)
    .map(supervisorMonthlySheetSource)
    .filter(Boolean);
}

function supervisorSheetTabName(supervisorName, source = {}) {
  const prefix = source.tabPrefix || 'DADOS_';
  const firstName = String(supervisorName || '').trim().split(/\s+/)[0] || '';
  return `${prefix}${firstName}`;
}

function supervisorSheetTabNames(supervisorName, source = {}) {
  const prefix = source.tabPrefix || 'DADOS_';
  const fullName = String(supervisorName || '').trim();
  return [...new Set([
    supervisorSheetTabName(supervisorName, source),
    fullName ? `${prefix}${fullName}` : ''
  ].filter(Boolean))];
}

function rowSupervisorName(row) {
  return csvValue(row, [
    'Nome do Supervisor',
    'Primeiro nome do Supervisor',
    'Dados primeiro nome do Supervisor',
    'dados_primeiro nome do supervisor',
    'Supervisor'
  ]);
}

function parseVisitCount(value) {
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function indicatorTone(value) {
  const text = String(value || '').trim();
  if (!text) return 'aviso';
  const key = normalizeKey(text);
  if (key.includes('verde')) return 'verde';
  if (key.includes('amarelo')) return 'amarelo';
  if (key.includes('vermelho')) return 'vermelho';
  return text;
}

function mergeSupervisorPanelRows(source, rows) {
  const importedAt = new Date().toISOString();
  let updatedCount = 0;
  state.supervisors = (state.supervisors || []).map((supervisor) => {
    const row = rows.find((item) => supervisorForSourceRow(csvValue(item, ['Supervisor']), source)?.name === supervisor.name);
    if (!row) return supervisor;
    updatedCount += 1;
    const assignedSchoolCount = parseVisitCount(csvValue(row, ['Escolas Atribuidas', 'Escolas Atribuídas']));
    const weeklyGoal = parseVisitCount(csvValue(row, ['Meta Semanal']));
    const monthlyGoal = parseVisitCount(csvValue(row, ['Meta Mensal']));
    const currentWeek = parseVisitCount(csvValue(row, ['Semana do Mes', 'Semana do Mês']));
    const weeklyVisits = parseVisitCount(csvValue(row, ['Visitas na Semana']));
    const monthlyVisits = parseVisitCount(csvValue(row, ['Visitas no Mes', 'Visitas no Mês']));
    const weeklyIndicator = indicatorTone(csvValue(row, ['Indicador Semana']));
    const monthlyIndicator = indicatorTone(csvValue(row, ['Indicador Mensal']));
    return {
      ...supervisor,
      assignedSchoolCount: assignedSchoolCount || supervisor.assignedSchoolCount,
      weeklyGoal: weeklyGoal || supervisor.weeklyGoal,
      monthlyGoal: monthlyGoal || supervisor.monthlyGoal,
      currentWeek: currentWeek || supervisor.currentWeek,
      weeklyVisits: Number.isFinite(weeklyVisits) ? weeklyVisits : supervisor.weeklyVisits,
      monthlyVisits: Number.isFinite(monthlyVisits) ? monthlyVisits : supervisor.monthlyVisits,
      weeklyIndicator: weeklyIndicator || supervisor.weeklyIndicator,
      monthlyIndicator: monthlyIndicator || supervisor.monthlyIndicator,
      visitSourceId: source.id,
      visitSourceUrl: source.url,
      visitSourceLabel: source.label,
      visitSourcePrimary: source.primary,
      source: 'google-sheet',
      sourceSyncedAt: importedAt
    };
  });
  return updatedCount;
}

async function syncSupervisorPanelSource(source) {
  if (!source.panelGid) return 0;
  const response = await fetch(googleSheetGidCsvUrl(source.url, source.panelGid), { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rows = parseCsvRows(await response.text());
  const [headers, ...dataRows] = rows;
  if (!headers?.length) return 0;
  const records = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [normalizeCsvHeader(header), row[index] || ''])));
  return mergeSupervisorPanelRows(source, records);
}

function googleSheetTabCsvUrl(url, tabName) {
  const text = String(url || '').trim();
  const encodedTab = encodeURIComponent(tabName);
  const regularMatch = text.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/i);
  if (regularMatch) {
    return `https://docs.google.com/spreadsheets/d/${regularMatch[1]}/gviz/tq?tqx=out:csv&sheet=${encodedTab}`;
  }
  const publishedMatch = text.match(/docs\.google\.com\/spreadsheets\/d\/e\/([^/]+)/i);
  if (publishedMatch) {
    return `https://docs.google.com/spreadsheets/d/e/${publishedMatch[1]}/pub?output=csv&single=true&sheet=${encodedTab}`;
  }
  return googleSheetCsvUrl(text);
}

function mergeSupervisorVisitSourceRows(source, rows) {
  const importedAt = new Date().toISOString();
  const incoming = rows
    .map((row) => {
      const rowSupervisor = rowSupervisorName(row) || (source.requireSupervisorColumn ? '' : source.supervisor);
      const supervisor = source.supervisor
        ? supervisorVisitSourceFor(source)
        : supervisorForSourceRow(rowSupervisor, source);
      const school = canonicalSchoolName(csvValue(row, ['Escola Visitada', 'Escola']));
      const date = parseBrazilianDate(csvValue(row, ['Data Da Visita', 'Data da Visita', 'Data']));
      if (!supervisor || !rowSupervisor || !school || !date) return null;
      if (source.supervisor && !sourceRowBelongsToSupervisor(rowSupervisor, source, supervisor)) return null;
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
  const importedSupervisors = new Set(incoming.map((item) => item.supervisor));
  state.supervisorVisits = [
    ...(state.supervisorVisits || []).filter((item) => {
      if (item.sourceId === source.id) return !incomingKeys.has(normalizeKey(`${item.supervisor}|${item.school}|${item.date}|${item.type}`));
      if (!importedSupervisors.has(item.supervisor)) return true;
      return !(item.source === 'teste' || /^visit-\d+-\d+$/.test(String(item.id || '')) || /registro de teste/i.test(item.notes || ''));
    }),
    ...incoming
  ];

  const schoolsBySupervisor = incoming.reduce((acc, item) => {
    if (!acc[item.supervisor]) acc[item.supervisor] = new Set();
    acc[item.supervisor].add(item.school);
    return acc;
  }, {});
  state.supervisors = (state.supervisors || []).map((item) => {
    const schoolsFromSource = [...(schoolsBySupervisor[item.name] || [])];
    if (!schoolsFromSource.length) return item;
    return {
      ...item,
      schools: [...new Set([...(item.schools || []), ...schoolsFromSource])],
      monthlyGoal: Math.max(Number(item.monthlyGoal || 0), schoolsFromSource.length || 1),
      visitSourceId: source.id,
      visitSourceUrl: source.url,
      visitSourceLabel: source.label,
      visitSourcePrimary: source.primary,
      sourceAliases: [...new Set([...(item.sourceAliases || []), ...(source.aliases || [])])],
      source: 'google-sheet',
      sourceSyncedAt: importedAt
    };
  });
  return incoming.length;
}

async function syncSupervisorVisitSource(source) {
  const tabNames = Array.isArray(source.tabNames)
    ? source.tabNames
    : source.tabName ? [source.tabName] : [];
  let response = null;
  let lastError = null;
  let fallbackToSourceCsv = false;
  const urls = [
    ...tabNames.map((tabName) => ({ url: googleSheetTabCsvUrl(source.url, tabName), requireSupervisorColumn: false })),
    { url: googleSheetCsvUrl(source.url), requireSupervisorColumn: source.requireSupervisorColumn ?? tabNames.length > 0 }
  ];

  for (const item of urls) {
    try {
      response = await fetch(item.url, { cache: 'no-store' });
      if (response.ok) {
        fallbackToSourceCsv = item.requireSupervisorColumn;
        break;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }
  if (!response?.ok) throw lastError || new Error('Falha ao ler planilha Google');
  const rows = parseCsvRows(await response.text());
  const [headers, ...dataRows] = rows;
  if (!headers?.length) return 0;
  const records = dataRows.map((row) => Object.fromEntries(headers.map((header, index) => [normalizeCsvHeader(header), row[index] || ''])));
  return mergeSupervisorVisitSourceRows({ ...source, requireSupervisorColumn: fallbackToSourceCsv }, records);
}

async function syncSupervisorSourceList(sources, options = {}) {
  if (!Array.isArray(sources) || !sources.length) return 0;
  let importedCount = 0;
  let errorCount = 0;
  for (const source of sources) {
    if (source.aggregate) {
      try {
        if (source.panelGid) importedCount += await syncSupervisorPanelSource(source);
        importedCount += await syncSupervisorVisitSource(source);
      } catch (error) {
        errorCount += 1;
        console.warn(`Nao foi possivel sincronizar ${source.label}:`, error);
      }
      continue;
    }
    const sourceSupervisors = source.workbookTabs
      ? (state.supervisors || [])
      : [supervisorVisitSourceFor(source)].filter(Boolean);
    for (const supervisor of sourceSupervisors) {
      try {
        importedCount += await syncSupervisorVisitSource({
          ...source,
          supervisor: supervisor.name,
          aliases: supervisor.sourceAliases || source.aliases || [],
          tabNames: source.workbookTabs ? supervisorSheetTabNames(supervisor.name, source) : source.tabName ? [source.tabName] : []
        });
      } catch (error) {
        errorCount += 1;
        console.warn(`Nao foi possivel sincronizar ${source.label} / ${supervisor.name}:`, error);
      }
    }
  }
  if (options.refresh !== false && importedCount) refreshAll();
  return { importedCount, errorCount };
}

async function syncSupervisorVisitSources(options = {}) {
  const sources = Array.isArray(SUPERVISOR_VISIT_SOURCES) ? SUPERVISOR_VISIT_SOURCES : [];
  if (!sources.length) return;
  const silent = options.silent === true;
  const toast = silent ? null : showToast('Lendo planilha dos supervisores...', 'syncing', { persist: true });
  const { importedCount, errorCount } = await syncSupervisorSourceList(sources, { refresh: false });
  if (importedCount) refreshAll();
  if (toast) {
    if (importedCount) {
      toast.update(`${importedCount} visita(s) importada(s) da planilha.`, 'success');
    } else if (errorCount) {
      toast.update('Nao foi possivel ler a planilha dos supervisores.', 'error', { duration: 4200 });
    } else {
      toast.update('Planilha lida, mas nenhum registro novo foi encontrado.', 'success');
    }
  }
}

async function syncSupervisorMonthlySheet(linkId) {
  const link = (state.officialLinks || []).find((item) =>
    item.category === 'supervisor-sheet' && String(item.id) === String(linkId)
  );
  const source = supervisorMonthlySheetSource(link);
  if (!source) {
    showToast('Planilha mensal nao encontrada.', 'error');
    return;
  }
  const toast = showToast(`Atualizando ${source.label}...`, 'syncing', { persist: true });
  try {
    const { importedCount, errorCount } = await syncSupervisorSourceList([source], { refresh: false });
    if (importedCount) refreshAll();
    if (importedCount) {
      toast.update(`${importedCount} visita(s) importada(s) de ${source.label}.`, 'success');
    } else if (errorCount) {
      toast.update('Nao foi possivel ler esta planilha mensal.', 'error', { duration: 4200 });
    } else {
      toast.update('Planilha lida, mas nenhum registro novo foi encontrado.', 'success');
    }
  } catch (error) {
    toast.update('Nao foi possivel atualizar esta planilha.', 'error', { duration: 4200 });
    console.warn(`Nao foi possivel sincronizar ${source.label}:`, error);
  }
}

async function syncCurrentSupervisorVisitSource() {
  const supervisor = supervisorByName(currentSupervisorDetail);
  if (!supervisor?.visitSourceUrl) {
    showToast('Supervisor sem planilha vinculada.', 'error');
    return;
  }
  const button = document.getElementById('refreshSupervisorSheetBtn');
  const toast = showToast('Atualizando planilha...', 'syncing', { persist: true });
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
      primary: supervisor.visitSourcePrimary ?? true,
      panelGid: SUPERVISOR_VISIT_SOURCES[0]?.panelGid,
      tabNames: supervisorSheetTabNames(supervisor.name),
      requireSupervisorColumn: true
    };
    await syncSupervisorPanelSource(source);
    await syncSupervisorVisitSource(source);
    refreshAll();
    showPage('supervisor-record');
    toast.update('Planilha atualizada.', 'success');
  } catch (error) {
    toast.update('Nao foi possivel atualizar a planilha.', 'error', { duration: 3600 });
    console.warn('Nao foi possivel atualizar pela planilha Google:', error);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = 'Atualizar planilha';
    }
  }
}
