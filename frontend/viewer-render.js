'use strict';

const MUNICIPALITY_AVATAR_COLORS = {
  itapeva: ['#5af5c8', '#2f80ed'],
  'capao bonito': ['#c8f55a', '#3f7d00'],
  'ribeirao grande': ['#a78bfa', '#5b4bd8'],
  'nova campina': ['#f5c85a', '#b7791f'],
  buri: ['#f5705a', '#b93326'],
  taquarivai: ['#78b4ff', '#007a61']
};

function schoolAvatarInitials(name) {
  const ignored = new Set(['pei', 'ee', 'e', 'emef', 'em', 'prof', 'professor', 'professora', 'doutor', 'doutora', 'dr', 'dra', 'padre', 'bairro', 'escola', 'estadual', 'municipal']);
  const parts = normalizeKey(name).split(/\s+/).filter((part) => part && !ignored.has(part) && part.length > 1).slice(0, 2);
  return parts.length ? parts.map((part) => part[0]).join('').toUpperCase() : 'EE';
}

function municipalityAvatarPalette(zone) {
  const key = normalizeKey(zone);
  if (MUNICIPALITY_AVATAR_COLORS[key]) return MUNICIPALITY_AVATAR_COLORS[key];
  let hash = 0;
  for (const char of key) hash = ((hash << 5) - hash) + char.charCodeAt(0);
  const hue = Math.abs(hash) % 360;
  return [`hsl(${hue} 78% 64%)`, `hsl(${(hue + 28) % 360} 62% 38%)`];
}

function schoolAvatarStyle(school) {
  const [from, to] = municipalityAvatarPalette(school?.zone || '');
  return `--school-avatar-a:${from};--school-avatar-b:${to};`;
}

function schoolDisplayNotes(notes) {
  const text = String(notes || '').trim();
  return normalizeKey(text) === normalizeKey('Unidade oficial da URE Itapeva.') ? '' : text;
}

function schoolAssetUnits(asset) {
  const note = String(asset?.notes || '');
  const quantityMatch = note.match(/(\d+)\s*unid/i);
  if (quantityMatch) return Number(quantityMatch[1]) || 1;
  return Number(asset?.quantity || asset?.units || 1) || 1;
}

function inventoryUpdatedLabelForSchool(schoolName) {
  const updated = state.inventoryUpdatedBySchool?.[schoolName] || state.inventoryUpdatedAt;
  return updated ? timestampLabel(new Date(updated)) : 'sem registro';
}

function renderSchoolCommandCenter() {}

function renderDashboardHero() {
  const title = document.getElementById('dashboardHeroTitle');
  const text = document.getElementById('dashboardHeroText');
  const actions = document.getElementById('dashboardHeroActions');
  const scoreNode = document.getElementById('dashboardHeroScore');
  const statsNode = document.getElementById('dashboardHeroStats');
  const health = dashboardHealth();
  const coverage = operationalCoverage();
  const focus = nextFocusTask();
  if (title) title.textContent = focus?.title || 'PainelURE';
  if (text) text.textContent = focus ? `${focus.place || 'Sem local'} | ${focus.category || 'Agenda'}` : buildSummaryPreview();
  if (actions) {
    actions.innerHTML = [
      ['Escolas', "showPage('schools')", 'schools'],
      ['Supervisores', "showPage('supervisors')", 'supervisors'],
      ['Inventario critico', "openInventoryCategory('criticos')", 'assets'],
      ['Buscar', "openCommandPalette('')", 'dashboard']
    ].filter((item) => canAccessPage(item[2])).map(([label, action]) =>
      `<button class="btn btn-g btn-sm" type="button" onclick="${action}">${esc(label)}</button>`
    ).join('');
  }
  if (scoreNode) {
    scoreNode.innerHTML = `<div><div class="sync-meta">Saude operacional</div><strong>${esc(String(health.score))}%</strong></div><span class="diag-pill ${health.tone}">${esc(health.label)}</span>`;
  }
  if (statsNode) {
    statsNode.innerHTML = [
      ['Escolas', visibleSchools().length],
      ['Inventario', state.schoolAssets.length],
      ['Supervisores', visibleSupervisors().length],
      ['Fichas', `${coverage.profileCoverage}%`]
    ].map(([label, value]) => `<div class="dashboard-hero-stat"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`).join('');
  }
}

function renderOperationsCenter() {
  const healthNode = document.getElementById('opsHealthPanel');
  const coverageNode = document.getElementById('coverageGrid');
  const signalNode = document.getElementById('opsSignalList');
  const suggestionNode = document.getElementById('opsSuggestionList');
  const coverage = operationalCoverage();
  if (healthNode) healthNode.innerHTML = `<div class="setechub-command-score"><strong>${dashboardHealth().score}%</strong><span class="diag-pill ${dashboardHealth().tone}">${dashboardHealth().label}</span></div>`;
  if (coverageNode) {
    coverageNode.innerHTML = [
      ['Inventario', `${coverage.assetCoverage}%`],
      ['Fichas', `${coverage.profileCoverage}%`],
      ['Importacoes', `${coverage.importCoverage}%`]
    ].map(([label, value]) => `<div class="setechub-monitor-card compact"><div class="sync-meta">${esc(label)}</div><strong>${esc(value)}</strong></div>`).join('');
  }
  if (signalNode) {
    signalNode.innerHTML = topSchoolSignals(5).map(({ school, signal }) => `
      <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school.name)}')">
        <strong>${esc(school.name)}</strong>
        <div class="sync-meta">${esc(school.zone)} | ficha ${esc(String(signal.completion))}% | ${esc(String(signal.alertUnits))} manut./defeito</div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum sinal operacional relevante.</div>';
  }
  if (suggestionNode) {
    suggestionNode.innerHTML = operationalSuggestions().map((text) => `<div class="setechub-item"><strong>Acao sugerida</strong><div class="sync-meta">${esc(text)}</div></div>`).join('')
      || '<div class="sync-empty">Base organizada para o uso atual.</div>';
  }
}

function renderDashboardAccess() {
  const profileNode = document.getElementById('dashboardProfileSummary');
  const roleCardsNode = document.getElementById('dashboardRoleCards');
  const attentionNode = document.getElementById('dashboardAttentionCards');
  if (profileNode) {
    profileNode.innerHTML = [
      ['Perfil', roleLabel(currentUserRole())],
      ['Modo', VIEWER_MODE_V1 ? 'Visualizador' : 'Operacao'],
      ['Escolas', visibleSchools().length],
      ['Supervisores', visibleSupervisors().length]
    ].map(([label, value]) => `<div class="insight-card"><div class="insight-l">${esc(label)}</div><div class="insight-v">${esc(String(value))}</div></div>`).join('');
  }
  if (roleCardsNode) {
    roleCardsNode.innerHTML = [
      ['Escolas', `${visibleSchools().length} unidades`, "showPage('schools')"],
      ['Supervisores', `${visibleSupervisors().length} registros`, "showPage('supervisors')"],
      ['Inventario', `${state.schoolAssets.length} linhas`, "showPage('assets')"]
    ].map(([title, meta, action]) => `<button class="dashboard-drill-card teal" type="button" onclick="${action}"><strong>${esc(title)}</strong><span>${esc(meta)}</span></button>`).join('');
  }
  if (attentionNode) attentionNode.innerHTML = '';
  const categoryNode = document.getElementById('dashboardCategoryGrid');
  const linksNode = document.getElementById('dashboardQuickLinks');
  const drillNode = document.getElementById('dashboardDrilldownGrid');
  if (categoryNode) categoryNode.innerHTML = '';
  if (linksNode) linksNode.innerHTML = topSchoolSignals(4).map(({ school }) => `<div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school.name)}')"><strong>${esc(school.name)}</strong><div class="sync-meta">${esc(school.zone)} | CIE ${esc(school.cie || '--')}</div></div>`).join('');
  if (drillNode) drillNode.innerHTML = '';
}

function renderDashboardOperationalLists() {
  const inventoryNode = document.getElementById('dashboardInventoryAlerts');
  const callsNode = document.getElementById('dashboardCallQueue');
  const sharedList = document.getElementById('dashboardSharedAgendaList');
  const personalList = document.getElementById('dashboardPersonalAgendaList');
  if (inventoryNode) inventoryNode.innerHTML = topInventoryAlerts(5).map((item) => `<div class="setechub-item setechub-clickable" onclick="setInventorySchool('${esc(item.school)}')"><strong>${esc(item.school)}</strong><div class="sync-meta">${esc(item.name)} | ${esc(String(item.alertUnits))} alerta(s)</div></div>`).join('') || '<div class="sync-empty">Nenhum alerta de inventario.</div>';
  if (callsNode) callsNode.innerHTML = topOpenCalls(5).map((item) => `<div class="setechub-item"><strong>${esc(item.title)}</strong><div class="sync-meta">${esc(item.school)} | ${esc(badgeText(item.status))}</div></div>`).join('') || '<div class="sync-empty">Nenhum chamado ativo.</div>';
  if (sharedList) sharedList.innerHTML = filteredTasks().slice(0, 6).map((task) => `<div class="setechub-item"><strong>${esc(task.title)}</strong><div class="sync-meta">${esc(task.date || '--')} | ${esc(task.place || '--')}</div></div>`).join('') || '<div class="sync-empty">Nada na agenda.</div>';
  if (personalList) personalList.innerHTML = '';
}

function renderPendingQueue() {
  const list = document.getElementById('pendingQueueList');
  if (!list) return;
  list.innerHTML = pendingQueueItems(8).map((item) => `<div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(item.school)}')"><strong>${esc(item.school)}</strong><div class="sync-meta">${esc(item.text)}</div></div>`).join('') || '<div class="sync-empty">Nenhuma pendencia relevante.</div>';
}

function renderMetrics() {}
function renderFocus() {}
function renderWeekBadges() {}

function renderSetupStats() {
  const values = {
    setupTaskCount: `${state.tasks.filter((item) => !item.done).length} tarefas`,
    setupCallCount: `${state.calls.filter((item) => item.status !== 'resolvido').length} em aberto`,
    setupSchoolCount: `${visibleSchools().length} escolas`,
    setupAssetCount: `${state.schoolAssets.filter((item) => item.status !== 'ok').length} em observacao`
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  });
}

function renderTimeline() {}
function renderChecklist() {}
function renderPonto() {}
function renderRoutes() {}

function renderTasks(filtered = filteredTasks()) {
  const list = document.getElementById('taskList');
  if (!list) return;
  list.innerHTML = filtered.slice(0, 80).map((task) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <div><strong>${esc(task.title)}</strong><div class="sync-meta">${esc(task.date || task.rawDate || 'Sem data')} | ${esc(task.time || 'Sem horario')} | ${esc(task.place || 'Sem local')}</div></div>
        <span class="diag-pill ${toneByPriority(task.priority)}">${esc(badgeText(task.priority))}</span>
      </div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhum agendamento encontrado.</div>';
}

function renderCtcAgenda() {
  ['Bruno', 'Danilo'].forEach((owner) => {
    const node = document.getElementById(`ctcAgenda${owner}`);
    if (!node) return;
    node.innerHTML = (state.tasks || []).filter((task) => normalizeKey(task.category) === 'ctc' && normalizeKey(task.ctcOwner) === normalizeKey(owner))
      .slice(0, 40).map((task) => `<div class="setechub-item"><strong>${esc(task.title)}</strong><div class="sync-meta">${esc(task.date || '--')} | ${esc(task.place || '--')}</div></div>`).join('')
      || '<div class="sync-empty">Nenhuma visita programada.</div>';
  });
}

function renderCalls() {
  const columns = document.getElementById('callColumns');
  if (!columns) return;
  columns.innerHTML = ['aberto', 'em_rota', 'resolvido'].map((status) => `
    <div class="bg-card setechub-column"><div class="ct">${esc(badgeText(status))}</div><div class="stack-list">
      ${filteredCalls().filter((item) => item.status === status).map((item) => `<div class="setechub-item"><strong>${esc(item.title)}</strong><div class="sync-meta">${esc(item.school)}</div></div>`).join('') || '<div class="sync-empty">Sem itens nesta etapa.</div>'}
    </div></div>
  `).join('');
}

function renderCallHistory() {
  const list = document.getElementById('callHistoryList');
  if (list) list.innerHTML = (state.histories.calls || []).slice(0, 40).map((item) => `<div class="setechub-item"><strong>${esc(item.text)}</strong><div class="sync-meta">${esc(item.when)}</div></div>`).join('') || '<div class="sync-empty">Nenhuma movimentacao.</div>';
}

function renderInventoryWorkspace() {
  const table = document.getElementById('inventoryDetailTable');
  const schoolSelect = document.getElementById('inventorySchoolSelect');
  const zoneSelect = document.getElementById('inventoryZoneSelect');
  const supervisorSelect = document.getElementById('inventorySupervisorSelect');
  const categorySelect = document.getElementById('inventoryCategorySelect');
  const schools = visibleSchools().slice().sort((a, b) => a.name.localeCompare(b.name));
  if (schoolSelect) {
    schoolSelect.innerHTML = '<option value="todas">Todas as escolas</option>' + schools.map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`).join('');
    schoolSelect.value = currentInventorySchool;
  }
  if (zoneSelect) {
    const zones = ['todas', ...new Set(schools.map((school) => school.zone).filter(Boolean))];
    zoneSelect.innerHTML = zones.map((zone) => `<option value="${esc(zone)}">${zone === 'todas' ? 'Todas as cidades' : esc(zone)}</option>`).join('');
    zoneSelect.value = currentInventoryZone;
  }
  if (supervisorSelect) supervisorSelect.value = currentInventorySupervisor;
  if (categorySelect) categorySelect.value = currentInventoryCategory;
  if (!table) return;
  const rows = aggregateInventoryItems(filteredSchoolAssets()).sort((a, b) => b.alertUnits - a.alertUnits || a.school.localeCompare(b.school));
  table.innerHTML = rows.length ? `
    <table class="setechub-table"><thead><tr><th>Escola</th><th>Item</th><th>Unid.</th><th>Status</th></tr></thead><tbody>
      ${rows.slice(0, INVENTORY_RENDER_LIMIT).map((item) => `<tr><td><button class="link-button" type="button" onclick="openSchoolRecord('${esc(item.school)}')">${esc(item.school)}</button></td><td>${esc(item.name)}</td><td>${esc(String(item.units))}</td><td><span class="diag-pill ${toneByAsset(item.statusLabel)}">${esc(badgeText(item.statusLabel))}</span></td></tr>`).join('')}
    </tbody></table>${listLimitNotice(rows.length, INVENTORY_RENDER_LIMIT, 'itens de inventario')}
  ` : '<div class="sync-empty">Nenhum inventario encontrado no filtro.</div>';
}

function renderAssets() {
  renderInventoryWorkspace();
}

function supervisorIndicatorClass(value) {
  if (['ok', 'verde', 'meta_ok'].includes(value)) return 'pill-ok';
  if (['critico', 'vermelho', 'atraso'].includes(value)) return 'pill-danger';
  return 'pill-warn';
}

function supervisorIndicatorText(value) {
  return ({ ok: 'Meta OK', verde: 'Meta OK', critico: 'Critico', vermelho: 'Atrasado', aviso: 'Atencao' }[value]) || badgeText(value || 'atencao');
}

function supervisorViewMonthIsCurrent() {
  const today = new Date();
  return currentViewDate.getFullYear() === today.getFullYear() && currentViewDate.getMonth() === today.getMonth();
}

function supervisorViewWeekOneStart() {
  return new Date(currentViewDate.getFullYear(), currentViewDate.getMonth(), 1);
}

function supervisorDateWeekForView(date) {
  const start = supervisorViewWeekOneStart();
  return Math.max(1, Math.floor((date - start) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function supervisorLastWeekOfViewMonth() {
  return supervisorDateWeekForView(new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 0));
}

function supervisorIndicatorFromGoal(visits, goal) {
  if (!goal) return 'aviso';
  return visits >= goal ? 'ok' : 'aviso';
}

function supervisorWeeklyVisitsForView(supervisor, fallback) {
  return supervisorViewMonthIsCurrent() ? Number(supervisor.weeklyVisits || fallback || 0) : Number(fallback || 0);
}

function supervisorMonthlyVisitsForView(supervisor, fallback) {
  return supervisorViewMonthIsCurrent() ? Number(supervisor.monthlyVisits || fallback || 0) : Number(fallback || 0);
}

function supervisorGoalPct(visits, goal) {
  return goal ? Math.min(100, Math.round((visits / goal) * 100)) : 0;
}

function supervisorSheetMetrics(item) {
  const supervisor = item.supervisor || {};
  const assigned = Number(supervisor.assignedSchoolCount || item.assignedSchools?.length || 0);
  const weeklyGoal = Number(supervisor.weeklyGoal || 0);
  const monthlyGoal = Number(supervisor.monthlyGoal || 0);
  const weeklyVisits = supervisorWeeklyVisitsForView(supervisor, Number(item.weeklyVisitFallback || 0));
  const monthlyVisits = supervisorMonthlyVisitsForView(supervisor, Number(item.monthlyVisitFallback ?? item.visits ?? 0));
  return {
    assigned,
    weeklyGoal,
    monthlyGoal,
    weeklyVisits,
    monthlyVisits,
    pendingMonth: Math.max(0, monthlyGoal - monthlyVisits),
    weeklyIndicator: supervisorIndicatorFromGoal(weeklyVisits, weeklyGoal),
    monthlyIndicator: supervisorIndicatorFromGoal(monthlyVisits, monthlyGoal)
  };
}

function renderSupervisors() {
  const stats = supervisorStats();
  const panelGrid = document.getElementById('supervisorPanelGrid');
  const selectorList = document.getElementById('supervisorSelectorList');
  ['supervisorMetricCount', 'supervisorMetricSchools', 'supervisorMetricVisits', 'supervisorMetricCoverage'].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = '0';
  });
  if (panelGrid) {
    panelGrid.innerHTML = `<div class="supervisor-sheet-table-wrap"><table class="supervisor-sheet-table"><thead><tr><th>Supervisor</th><th>Escolas</th><th>Visitas</th><th>Cobertura</th><th></th></tr></thead><tbody>
      ${stats.map((item) => `<tr class="supervisor-sheet-row" onclick="openSupervisorRecord('${esc(item.supervisor.name)}')"><td><strong>${esc(item.supervisor.name)}</strong></td><td>${esc(String(item.assignedSchools.length))}</td><td>${esc(String(item.visits))}</td><td><span class="diag-pill ${item.coverage >= 80 ? 'pill-ok' : 'pill-warn'}">${esc(String(item.coverage))}%</span></td><td><button class="btn btn-g btn-sm" type="button">Abrir</button></td></tr>`).join('')}
    </tbody></table></div>`;
  }
  if (selectorList) {
    selectorList.innerHTML = stats.map((item) => `<div class="setechub-item setechub-clickable" onclick="openSupervisorRecord('${esc(item.supervisor.name)}')"><strong>${esc(item.supervisor.name)}</strong><div class="sync-meta">${esc(String(item.assignedSchools.length))} escola(s) | ${esc(String(item.visits))} visita(s)</div></div>`).join('')
      || '<div class="sync-empty">Nenhum supervisor cadastrado.</div>';
  }
}

function supervisorSheetMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  const names = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return year && month ? `${names[month - 1]} de ${year}` : 'mes nao informado';
}

function supervisorMonthlySheetLinks() {
  return (state.officialLinks || []).filter((item) => item.category === 'supervisor-sheet').sort((a, b) => String(b.monthKey || '').localeCompare(String(a.monthKey || '')));
}

function renderSupervisorRecord() {
  const stats = supervisorStats();
  if (!stats.length) return;
  if (!currentSupervisorDetail || !stats.some((item) => item.supervisor.name === currentSupervisorDetail)) currentSupervisorDetail = stats[0].supervisor.name;
  const selected = stats.find((item) => item.supervisor.name === currentSupervisorDetail) || stats[0];
  const supervisor = selected.supervisor;
  const visits = getDerivedCache().visitsBySupervisor.get(supervisor.name) || [];
  const title = document.getElementById('supervisorRecordTitle');
  const subtitle = document.getElementById('supervisorRecordSubtitle');
  if (title) title.textContent = supervisor.name;
  if (subtitle) subtitle.textContent = `${selected.assignedSchools.length} escola(s) | ${visits.length} visita(s) importada(s).`;
  const profile = document.getElementById('supervisorRecordProfile');
  if (profile) profile.innerHTML = `<div class="setechub-item"><strong>${esc(supervisor.name)}</strong><div class="sync-meta">${esc(supervisor.email || '')} | ${esc(supervisor.phone || '')}</div></div>`;
  const goal = document.getElementById('supervisorRecordGoal');
  if (goal) goal.innerHTML = `<div class="setechub-command-score"><strong>${esc(String(selected.coverage))}%</strong><span class="diag-pill ${selected.coverage >= 80 ? 'pill-ok' : 'pill-warn'}">Cobertura</span></div>`;
  const metrics = document.getElementById('supervisorRecordMetrics');
  if (metrics) metrics.innerHTML = [
    ['Escolas', selected.assignedSchools.length],
    ['Visitadas', selected.visitedSchools],
    ['Visitas', visits.length],
    ['Chamados', selected.openCalls]
  ].map(([label, value]) => `<div class="setechub-monitor-card compact"><div class="sync-meta">${esc(label)}</div><strong>${esc(String(value))}</strong></div>`).join('');
  if (typeof renderSupervisorWeeklyMatrixForRecord === 'function') renderSupervisorWeeklyMatrixForRecord(selected, visits);
  const visited = new Set(visits.map((visit) => visit.school));
  const visitedNode = document.getElementById('supervisorRecordVisitedSchools');
  const pendingNode = document.getElementById('supervisorRecordPendingSchools');
  if (visitedNode) visitedNode.innerHTML = selected.assignedSchools.filter((school) => visited.has(school)).map((school) => `<div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')"><strong>${esc(school)}</strong><div class="sync-meta">Visitada</div></div>`).join('') || '<div class="sync-empty">Nenhuma escola visitada no mes atual.</div>';
  if (pendingNode) pendingNode.innerHTML = selected.assignedSchools.filter((school) => !visited.has(school)).map((school) => `<div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')"><strong>${esc(school)}</strong><div class="sync-meta">Sem visita registrada</div></div>`).join('') || '<div class="sync-empty">Todas as escolas vinculadas possuem visita.</div>';
  const matrix = document.getElementById('supervisorRecordSchoolMatrix');
  if (matrix) matrix.innerHTML = `<div class="supervisor-school-list">${selected.assignedSchools.map((school) => `<button class="supervisor-school-row" type="button" onclick="openSchoolRecord('${esc(school)}')"><span>${esc(school)}</span><strong>${visited.has(school) ? 'visitada' : 'pendente'}</strong></button>`).join('')}</div>`;
  const table = document.getElementById('supervisorRecordVisitsTable');
  if (table) table.innerHTML = visits.length ? `<table class="setechub-table"><thead><tr><th>Data</th><th>Escola</th><th>Tipo</th></tr></thead><tbody>${visits.slice(0, 80).map((visit) => `<tr><td>${esc(visit.date || '--')}</td><td>${esc(visit.school)}</td><td>${esc(visit.type || 'Visita')}</td></tr>`).join('')}</tbody></table>${listLimitNotice(visits.length, 80, 'visitas')}` : '<div class="sync-empty">Nenhuma visita registrada.</div>';
}

function renderMunicipalities() {}
function renderSectors() {}

function renderDirectoryFilterBar() {}

function renderDirectoryContacts() {
  const list = document.getElementById('directoryContactsList');
  if (!list) return;
  list.innerHTML = filteredDirectoryContacts().slice(0, 120).map((item) => `<div class="setechub-item"><strong>${esc(item.name)}</strong><div class="sync-meta">${esc(item.role || '')} | ${esc(item.phone || item.email || '')}</div></div>`).join('') || '<div class="sync-empty">Nenhum contato oficial importado.</div>';
}

function renderSchoolImports() {
  const list = document.getElementById('schoolImportList');
  const stats = document.getElementById('schoolImportStatus');
  const select = document.getElementById('importSchoolSelect');
  if (select) {
    select.innerHTML = visibleSchools().slice().sort((a, b) => a.name.localeCompare(b.name)).map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`).join('');
    if (currentImportSchoolContext) select.value = currentImportSchoolContext;
  }
  const rows = filteredSchoolImports().slice().sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')));
  if (list) {
    list.innerHTML = rows.slice(0, 80).map((item) => `
      <div class="setechub-item">
        <strong>${esc(item.label || item.filename || 'Importacao')}</strong>
        <div class="sync-meta">${esc(item.school)} | ${esc(item.type || '')} | ${esc(item.importedAt || '')}</div>
        <div class="sync-meta">${esc(String(item.preview || '').split('\n').slice(0, 3).join(' | ') || item.summary || 'Lido')}</div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhuma importacao vinculada a escolas neste filtro.</div>';
  }
  if (stats) stats.textContent = `${rows.length} importacao(oes) visiveis`;
}

function renderOfficialData() {
  const list = document.getElementById('officialList');
  if (list) list.innerHTML = (state.officialLinks || []).slice(0, 8).map((item) => `<div class="setechub-item"><strong>${esc(item.label)}</strong><div class="sync-meta">${esc(item.url)}</div></div>`).join('');
  const monthly = document.getElementById('monthlySupervisorSheetsList');
  if (monthly) monthly.innerHTML = supervisorMonthlySheetLinks().map((item) => `<div class="setechub-item"><strong>${esc(item.label)}</strong><div class="sync-meta">${esc(item.monthKey || '')}</div>${canImportData() ? `<div class="mini-actions"><button class="btn btn-p btn-sm" onclick="syncSupervisorMonthlySheet('${esc(item.id)}')">Atualizar dados</button></div>` : ''}</div>`).join('') || '<div class="sync-empty">Nenhuma planilha mensal cadastrada.</div>';
}

function renderReports() {
  const taskNode = document.getElementById('reportTasks');
  const callNode = document.getElementById('reportCalls');
  const schoolNode = document.getElementById('reportCriticalSchools');
  const assetNode = document.getElementById('reportAssets');
  if (taskNode) taskNode.textContent = String(state.tasks.length);
  if (callNode) callNode.textContent = String(state.calls.filter((item) => item.status !== 'resolvido').length);
  if (schoolNode) schoolNode.textContent = String(visibleSchools().filter((item) => item.status !== 'estavel').length);
  if (assetNode) assetNode.textContent = String(state.schoolAssets.filter((item) => item.status !== 'ok').length);
}

function renderDiagnostics() {
  const list = document.getElementById('diagnosticList');
  if (!list) return;
  list.innerHTML = [
    ['Escolas', state.schools.length],
    ['Supervisores', state.supervisors.length],
    ['Inventario', state.schoolAssets.length],
    ['Visitas', (state.supervisorVisits || []).length]
  ].map(([label, value]) => `<div class="setechub-item"><strong>${esc(label)}</strong><div class="sync-meta">${esc(String(value))}</div></div>`).join('');
}

function renderUsers() {
  const list = document.getElementById('userList');
  if (!list) return;
  list.innerHTML = (state.users || []).map((user) => `<div class="admin-user-row"><div class="admin-user-main"><strong>${esc(user.name)}</strong><div class="sync-meta">${esc(roleLabel(user.role))} | ${esc(user.login || '')}</div></div></div>`).join('');
}

function renderAdminSchoolTools() {
  const list = document.getElementById('adminSchoolList');
  if (list) list.innerHTML = '<div class="sync-empty">Cadastro manual de escolas pausado na V1 visualizadora.</div>';
}

function renderAdminPage() {
  renderDiagnostics();
  renderUsers();
  renderAdminSchoolTools();
  renderOfficialData();
}

function renderVisitHistory() {}
function renderNotes() {}
function renderRedePreview() {}
function renderRedeAutomation() {}
