'use strict';

function renderDashboardHero() {
  const title = document.getElementById('dashboardHeroTitle');
  const text = document.getElementById('dashboardHeroText');
  const actions = document.getElementById('dashboardHeroActions');
  const scoreNode = document.getElementById('dashboardHeroScore');
  const statsNode = document.getElementById('dashboardHeroStats');
  if (!title || !text || !actions || !scoreNode || !statsNode) return;

  const health = dashboardHealth();
  const coverage = operationalCoverage();
  const focus = nextFocusTask();
  const openCalls = state.calls.filter((item) => item.status !== 'resolvido').length;
  const attentionSchools = visibleSchools().filter((item) => item.status !== 'estavel').length;
  const alertAssets = state.assets.filter((item) => item.status !== 'ok').length + state.schoolAssets.filter((item) => item.status !== 'ok').length;
  const pendingItems = pendingQueueItems(99).length;

  title.textContent = focus ? focus.title : 'Painel inicial pronto para abrir a rotina.';
  text.textContent = focus
    ? `${focus.place || 'Sem local definido'} | ${focus.category || 'Rotina'} | ${focus.time || 'sem horario definido'}`
    : buildSummaryPreview();

  const actionItems = [
    { label: 'Abrir chamados', action: `openCallCategory('todos')`, page: 'calls', tone: 'primary' },
    { label: 'Ver escolas', action: `showPage('schools')`, page: 'schools', tone: '' },
    { label: 'Inventario', action: `openInventoryCategory('alerta')`, page: 'assets', tone: '' },
    { label: 'Nova tarefa', action: `showPage('agenda')`, page: 'agenda', tone: 'edit' }
  ].filter((item) => canAccessPage(item.page) && (item.tone !== 'edit' || canEditData()));

  actions.innerHTML = actionItems.map((item) => `
    <button class="btn ${item.tone === 'primary' ? 'btn-p' : 'btn-g'} btn-sm" type="button" onclick="${item.action}">${esc(item.label)}</button>
  `).join('');

  scoreNode.innerHTML = `
    <div class="sync-meta">Saude da operacao</div>
    <strong>${esc(String(health.score))}%</strong>
    <span class="diag-pill ${health.tone}">${esc(health.label)}</span>
  `;

  statsNode.innerHTML = [
    { label: 'Chamados', value: String(openCalls), tone: openCalls ? 'pill-warn' : 'pill-ok' },
    { label: 'Escolas', value: String(attentionSchools), tone: attentionSchools ? 'pill-warn' : 'pill-ok' },
    { label: 'Ativos', value: String(alertAssets), tone: alertAssets ? 'pill-danger' : 'pill-ok' },
    { label: 'Pendencias', value: String(pendingItems), tone: pendingItems ? 'pill-info' : 'pill-ok' },
    { label: 'Cobertura', value: `${coverage.profileCoverage}%`, tone: coverage.profileCoverage >= 65 ? 'pill-ok' : 'pill-warn' },
    { label: 'Horas', value: bankHours(), tone: '' }
  ].map((item) => `
    <div class="dashboard-hero-stat">
      <span>${esc(item.label)}</span>
      <strong>${esc(item.value)}</strong>
      <i class="diag-pill ${item.tone}"></i>
    </div>
  `).join('');
}

function renderOperationsCenter() {
  const health = dashboardHealth();
  const coverage = operationalCoverage();
  const topSignals = topSchoolSignals();
  const suggestions = operationalSuggestions();
  const healthNode = document.getElementById('opsHealthPanel');
  const coverageNode = document.getElementById('coverageGrid');
  const signalNode = document.getElementById('opsSignalList');
  const suggestionNode = document.getElementById('opsSuggestionList');
  if (healthNode) {
    healthNode.innerHTML = `
      <div class="setechub-command-score">
        <div>
          <div class="sync-meta">Indice operacional</div>
          <strong>${esc(String(health.score))}%</strong>
        </div>
        <span class="diag-pill ${health.tone}">${esc(health.label)}</span>
      </div>
      <div class="sync-meta">Base atualizada em ${esc(timestampLabel(new Date(state.lastUpdatedAt || Date.now())))} com foco em rotina e organizacao.</div>
    `;
  }
  if (coverageNode) {
    coverageNode.innerHTML = [
      { label: 'Escolas com importacao', value: `${coverage.importCoverage}%`, note: `${coverage.schoolsWithImports}/${coverage.totalSchools} unidades` },
      { label: 'Escolas com inventario', value: `${coverage.assetCoverage}%`, note: `${coverage.schoolsWithAssets}/${coverage.totalSchools} unidades` },
      { label: 'Fichas preenchidas', value: `${coverage.profileCoverage}%`, note: `${coverage.schoolsWithProfile}/${coverage.totalSchools} unidades` },
      { label: 'Alertas ativos', value: String(coverage.activeAlerts), note: 'ativos em manutencao ou defeito' }
    ].map((item) => `
      <div class="setechub-monitor-card compact">
        <div class="sync-meta">${esc(item.label)}</div>
        <strong>${esc(item.value)}</strong>
        <div class="diag-pill">${esc(item.note)}</div>
      </div>
    `).join('');
  }
  if (signalNode) {
    signalNode.innerHTML = topSignals.map(({ school, signal }) => `
      <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school.name)}')">
        <div class="setechub-head">
          <div>
            <strong>${esc(school.name)}</strong>
            <div class="sync-meta">${esc(school.zone)} | ficha ${esc(String(signal.completion))}% | ${esc(String(signal.imports))} importacao(oes)</div>
          </div>
          <div class="setechub-badges">
            <span class="diag-pill ${toneBySchool(school.status)}">${esc(badgeText(school.status))}</span>
            <span class="diag-pill ${signal.alertUnits ? 'pill-danger' : 'pill-info'}">${esc(String(signal.alertUnits))} alertas</span>
          </div>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum sinal operacional relevante ainda.</div>';
  }
  if (suggestionNode) {
    suggestionNode.innerHTML = suggestions.map((text) => `
      <div class="setechub-item">
        <strong>Acao sugerida</strong>
        <div class="sync-meta">${esc(text)}</div>
      </div>
    `).join('') || '<div class="sync-empty">A base ja parece organizada para o uso atual.</div>';
  }
}

function renderDashboardAccess() {
  const categoryNode = document.getElementById('dashboardCategoryGrid');
  const linksNode = document.getElementById('dashboardQuickLinks');
  const drilldownNode = document.getElementById('dashboardDrilldownGrid');
  const callCount = state.calls.filter((item) => item.status !== 'resolvido').length;
  const schools = visibleSchools();
  const schoolAlertCount = schools.filter((item) => item.status !== 'estavel').length;
  const importCount = state.schoolImports.length;
  const inventoryAlertCount = state.schoolAssets.filter((item) => item.status !== 'ok').length;
  const criticalSchools = schools.filter((item) => item.status === 'critico').length;
  const noProfileSchools = schools.filter((item) => schoolProfileCompletion(item.name) < 35).length;
  const noNetworkSchools = schools.filter((item) => !schoolNetworkRecord(item.name)).length;
  const unresolvedCalls = state.calls.filter((item) => item.status === 'aberto').length;
  const routeCalls = state.calls.filter((item) => item.status === 'em_rota').length;
  const recentImports = recentSchoolImports(8).length;
  const pecCount = (state.users || []).filter((item) => item.role === 'pec' && item.active !== false).length;
  const categories = [
    { title: 'Escolas', meta: `${schools.length} bases | ${schoolAlertCount} em atencao`, action: `showPage('schools')`, page: 'schools', tone: 'lime', priority: 'primary' },
    { title: 'Inventario', meta: `${state.schoolAssets.length} linhas | ${inventoryAlertCount} alertas`, action: `showPage('assets')`, page: 'assets', tone: 'teal', priority: 'primary' },
    { title: 'Chamados', meta: `${callCount} ativos`, action: `showPage('calls')`, page: 'calls', tone: 'red', priority: 'primary' },
    { title: 'PECs', meta: `${pecCount} acessos | equipe curricular`, action: `showPage('pecs')`, page: 'pecs', tone: 'blue', priority: 'secondary' },
    { title: 'Importacoes', meta: `${importCount} registros`, action: `showPage('schools')`, page: 'schools', tone: 'blue', priority: 'secondary' },
    { title: 'Rede / CFTV', meta: `${state.schoolNetworks.length} escolas com dados`, action: `showPage('schools')`, page: 'schools', tone: 'amber', priority: 'secondary' },
    { title: 'Relatorios', meta: `resumo, notas e redes`, action: `showPage('reports')`, page: 'reports', tone: 'slate', priority: 'secondary' }
  ].filter((item) => canAccessPage(item.page));
  const categoryBox = document.getElementById('dashboardCategoryBox');
  if (categoryBox) categoryBox.hidden = !categories.length;
  if (categoryNode) {
    categoryNode.innerHTML = categories.map((item) => `
      <button class="dashboard-category-card ${item.tone} ${item.priority}" type="button" onclick="${item.action}">
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.meta)}</span>
      </button>
    `).join('') || '<div class="sync-empty">Nenhuma categoria disponivel para este perfil.</div>';
  }
  if (linksNode) {
    const topSchools = topSchoolSignals(3);
    const topCalls = topOpenCalls(3);
    const topAssets = topInventoryAlerts(3);
    const topImports = recentSchoolImports(3);
    const quickItems = [
      ...(canAccessPage('schools') ? topSchools.map(({ school, signal }) => `
        <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school.name)}')">
          <strong>Escola</strong>
          <div class="sync-meta">${esc(school.name)} | CIE ${esc(school.cie || '--')} | ${esc(String(signal.alertUnits))} alertas | ${esc(String(signal.assetUnits))} unid.</div>
        </div>
      `) : []),
      ...(canAccessPage('assets') ? topAssets.map((item) => `
        <div class="setechub-item setechub-clickable" onclick="setInventorySchool('${esc(item.school)}')">
          <strong>Inventario</strong>
          <div class="sync-meta">${esc(item.school)} | ${esc(item.name)} | ${esc(String(item.alertUnits))} alertas</div>
        </div>
      `) : []),
      ...(canAccessPage('calls') ? topCalls.map((item) => `
        <div class="setechub-item setechub-clickable" onclick="openSchoolCalls('${esc(item.school)}')">
          <strong>Chamado</strong>
          <div class="sync-meta">${esc(item.school)} | ${esc(item.title)} | ${esc(badgeText(item.status))}</div>
        </div>
      `) : []),
      ...(canAccessPage('schools') ? topImports.map((item) => `
        <div class="setechub-item setechub-clickable" onclick="openSchoolImports('${esc(item.school)}')">
          <strong>Importacao</strong>
          <div class="sync-meta">${esc(item.school)} | ${esc(item.label || item.filename || '')} | ${esc(item.type || '')}</div>
        </div>
      `) : [])
    ];
    const quickBox = document.getElementById('dashboardQuickBox');
    if (quickBox) quickBox.hidden = !quickItems.length;
    linksNode.innerHTML = quickItems.join('') || '<div class="sync-empty">Nenhum atalho rapido disponivel ainda.</div>';
  }
  if (drilldownNode) {
    const cards = [
      { title: 'Escolas criticas', meta: `${criticalSchools} escola(s)`, action: `openSchoolCategory('critico')`, page: 'schools', tone: 'red' },
      { title: 'Escolas sem ficha', meta: `${noProfileSchools} escola(s)`, action: `openSchoolCategory('sem_ficha')`, page: 'schools', tone: 'amber' },
      { title: 'Escolas com alerta', meta: `${schoolAlertCount} escola(s)`, action: `openSchoolCategory('com_alerta')`, page: 'schools', tone: 'lime' },
      { title: 'Inventario critico', meta: `${aggregateInventoryItems(state.schoolAssets).filter((item) => item.defectUnits > 0).length} familia(s)`, action: `openInventoryCategory('criticos')`, page: 'assets', tone: 'red' },
      { title: 'Infra de rede', meta: `${aggregateInventoryItems(state.schoolAssets).filter((item) => item.category === 'infra').length} familia(s)`, action: `openInventoryCategory('todos', 'infra')`, page: 'assets', tone: 'blue' },
      { title: 'Chamados abertos', meta: `${unresolvedCalls} item(ns)`, action: `openCallCategory('aberto')`, page: 'calls', tone: 'red' },
      { title: 'Chamados em rota', meta: `${routeCalls} item(ns)`, action: `openCallCategory('em_rota')`, page: 'calls', tone: 'teal' },
      { title: 'Importacoes recentes', meta: `${recentImports} item(ns)`, action: `openImportCategory('todos')`, page: 'schools', tone: 'slate' },
      { title: 'Sem rede/CFTV', meta: `${noNetworkSchools} escola(s)`, action: `openSchoolCategory('sem_rede')`, page: 'schools', tone: 'amber' }
    ].filter((item) => canAccessPage(item.page));
    const drilldownBox = document.getElementById('dashboardDrilldownBox');
    if (drilldownBox) drilldownBox.hidden = !cards.length;
    drilldownNode.innerHTML = cards.map((item) => `
      <button class="dashboard-drill-card ${item.tone}" type="button" onclick="${item.action}">
        <strong>${esc(item.title)}</strong>
        <span>${esc(item.meta)}</span>
      </button>
    `).join('') || '<div class="sync-empty">Nenhum recorte disponivel para este perfil.</div>';
  }
}

function renderDashboardOperationalLists() {
  const inventoryNode = document.getElementById('dashboardInventoryAlerts');
  const callsNode = document.getElementById('dashboardCallQueue');
  const importsNode = document.getElementById('dashboardRecentImports');
  const inventoryRows = topInventoryAlerts(5);
  const callRows = topOpenCalls(5);
  const importRows = recentSchoolImports(5);
  if (inventoryNode) {
    inventoryNode.innerHTML = inventoryRows.map((item) => `
      <div class="setechub-item setechub-clickable" onclick="setInventorySchool('${esc(item.school)}')">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.school)}</strong>
            <div class="sync-meta">${esc(item.name)} | CIE ${esc(schoolByName(item.school)?.cie || '--')}</div>
          </div>
          <span class="diag-pill ${item.defectUnits ? 'pill-danger' : 'pill-warn'}">${esc(String(item.alertUnits))} alertas</span>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum alerta de inventario no momento.</div>';
  }
  if (callsNode) {
    callsNode.innerHTML = callRows.map((item) => `
      <div class="setechub-item setechub-clickable" onclick="openSchoolCalls('${esc(item.school)}')">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.school)}</strong>
            <div class="sync-meta">${esc(item.title)} | CIE ${esc(schoolByName(item.school)?.cie || '--')}</div>
          </div>
          <span class="diag-pill ${toneByCall(item.status)}">${esc(badgeText(item.status))}</span>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum chamado ativo no momento.</div>';
  }
  if (importsNode) {
    importsNode.innerHTML = importRows.map((item) => `
      <div class="setechub-item setechub-clickable" onclick="openSchoolImports('${esc(item.school)}')">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.school)}</strong>
            <div class="sync-meta">${esc(item.label || item.filename || '')} | ${esc(item.type || '')}</div>
          </div>
          <span class="diag-pill">CIE ${esc(schoolByName(item.school)?.cie || '--')}</span>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhuma importacao recente.</div>';
  }
}

function renderPendingQueue() {
  const list = document.getElementById('pendingQueueList');
  if (!list) return;
  const items = pendingQueueItems();
  list.innerHTML = items.map((item) => `
    <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(item.school)}')">
      <div class="setechub-head">
        <div>
          <strong>${esc(item.school)}</strong>
          <div class="sync-meta">${esc(item.text)}</div>
        </div>
        <span class="diag-pill ${item.tone}">${esc(badgeText(item.type))}</span>
      </div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma pendencia relevante na base neste momento.</div>';
}

function renderSchoolCommandCenter() {
  const filtered = sortSchoolsByCurrentView(visibleSchools());
  const focusSchool = schoolByName(currentSchoolDetail) || filtered[0] || null;
  const coverage = schoolCoverageSummary();
  const focusNode = document.getElementById('schoolFocusPanel');
  const coverageNode = document.getElementById('schoolCoverageGrid');
  const tableNode = document.getElementById('schoolMasterTable');
  const overviewNode = document.getElementById('schoolOverviewMatrix');
  if (focusNode) {
    const signal = focusSchool ? schoolOperationalSnapshot(focusSchool) : null;
    const network = focusSchool ? schoolNetworkRecord(focusSchool.name) : null;
    focusNode.innerHTML = focusSchool ? `
      <div class="setechub-command-score">
        <div>
          <div class="sync-meta">Escola em foco</div>
          <strong>${esc(focusSchool.name)}</strong>
        </div>
        <span class="diag-pill ${toneBySchool(focusSchool.status)}">${esc(badgeText(focusSchool.status))}</span>
      </div>
      <div class="sync-meta">CIE ${esc(focusSchool.cie || '--')} | ${esc(focusSchool.zone)} | risco ${esc(String(signal?.riskScore || 0))}</div>
      <div class="setechub-inline-metrics">
        <div class="mini-stat"><span class="ms-l">Inventario</span><strong class="ms-val">${esc(String(signal?.assetUnits || 0))}</strong></div>
        <div class="mini-stat"><span class="ms-l">Alertas</span><strong class="ms-val">${esc(String(signal?.alertUnits || 0))}</strong></div>
        <div class="mini-stat"><span class="ms-l">CFTV</span><strong class="ms-val">${esc(network?.cameraInstalled ? `${network.cameraWorking || 0}/${network.cameraInstalled}` : '--')}</strong></div>
      </div>
      <div class="setechub-action-row left">
        <button class="btn btn-p btn-sm" onclick="openSchoolRecord('${esc(focusSchool.name)}')">Abrir ficha</button>
        <button class="btn btn-g btn-sm" onclick="setInventorySchool('${esc(focusSchool.name)}')">Abrir inventario</button>
      </div>
    ` : '<div class="sync-empty">Nenhuma escola encontrada no filtro atual.</div>';
  }
  if (coverageNode) {
    coverageNode.innerHTML = [
      { label: 'Com inventario', value: `${coverage.inventoryPct}%`, note: `${coverage.withInventory}/${coverage.total} escolas` },
      { label: 'Com rede/CFTV', value: `${coverage.networkPct}%`, note: `${coverage.withNetwork}/${coverage.total} escolas` },
      { label: 'Com ficha', value: `${coverage.profilePct}%`, note: `${coverage.withProfile}/${coverage.total} escolas` },
      { label: 'Com alertas', value: String(coverage.withAlerts), note: 'escolas com itens em alerta' }
    ].map((item) => `
      <div class="setechub-monitor-card compact">
        <div class="sync-meta">${esc(item.label)}</div>
        <strong>${esc(item.value)}</strong>
        <div class="diag-pill">${esc(item.note)}</div>
      </div>
    `).join('');
  }
  if (overviewNode) {
    overviewNode.innerHTML = filtered.length ? filtered.map((school) => {
      const signal = schoolOperationalSnapshot(school);
      const dataScore = schoolDataScore(school.name);
      const network = schoolNetworkRecord(school.name);
      const tone = signal.riskScore >= 18 || school.status === 'critico'
        ? 'pill-danger'
        : signal.riskScore >= 7 || school.status === 'atencao'
          ? 'pill-warn'
          : 'pill-ok';
      return `
        <article class="school-overview-card">
          <button class="school-overview-main" type="button" onclick="openSchoolRecord('${esc(school.name)}')">
            <span class="diag-pill ${tone}">${esc(signal.riskScore ? `prioridade ${signal.riskScore}` : 'estavel')}</span>
            <strong>${esc(school.name)}</strong>
            <small>CIE ${esc(school.cie || network?.cie || '--')} | ${esc(school.zone)}</small>
          </button>
          <div class="school-overview-kpis">
            <div><span>Dados</span><strong>${esc(String(dataScore))}%</strong></div>
            <div><span>Invent.</span><strong>${esc(String(signal.assetUnits))}</strong></div>
            <div><span>Alertas</span><strong>${esc(String(signal.alertUnits))}</strong></div>
            <div><span>Cham.</span><strong>${esc(String(signal.openCalls))}</strong></div>
          </div>
          <div class="school-overview-flags">
            <span class="diag-pill ${signal.completion >= 35 ? 'pill-ok' : 'pill-warn'}">${esc(String(signal.completion))}% ficha</span>
            <span class="diag-pill ${network ? 'pill-info' : 'pill-warn'}">${network ? 'rede ok' : 'sem rede'}</span>
            <span class="diag-pill">${esc(String(signal.imports))} import.</span>
          </div>
          <div class="school-overview-actions">
            <button class="btn btn-p btn-sm" type="button" onclick="openSchoolRecord('${esc(school.name)}')">Ficha</button>
            <button class="btn btn-g btn-sm" type="button" onclick="setInventorySchool('${esc(school.name)}')">Inventario</button>
            <button class="btn btn-g btn-sm" type="button" onclick="openSchoolCalls('${esc(school.name)}')">Chamados</button>
          </div>
        </article>
      `;
    }).join('') : '<div class="sync-empty">Nenhuma escola encontrada no filtro atual.</div>';
  }
  if (tableNode) {
    tableNode.innerHTML = filtered.length ? `
      <table class="setechub-table setechub-table-clickable">
        <thead>
          <tr>
            <th>Escola</th>
            <th>CIE</th>
            <th>Municipio</th>
            <th>Importancia</th>
            <th>Dados</th>
            <th>Inventario</th>
            <th>Alertas</th>
            <th>Chamados</th>
            <th>Importacoes</th>
            <th>CFTV</th>
            <th>Banda</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((school) => {
            const signal = schoolOperationalSnapshot(school);
            const network = schoolNetworkRecord(school.name);
            const dataScore = schoolDataScore(school.name);
            return `
              <tr class="setechub-row-link" onclick="openSchoolRecord('${esc(school.name)}')">
                <td><strong>${esc(school.name)}</strong><div class="sync-meta">${esc(badgeText(school.status))}</div></td>
                <td>${esc(school.cie || '--')}</td>
                <td>${esc(school.zone)}</td>
                <td><span class="diag-pill ${signal.riskScore >= 18 ? 'pill-danger' : signal.riskScore >= 7 ? 'pill-warn' : 'pill-ok'}">${esc(String(signal.riskScore))}</span></td>
                <td>${esc(String(dataScore))}%</td>
                <td>${esc(String(signal.assetUnits || 0))}</td>
                <td>${esc(String(signal.alertUnits || 0))}</td>
                <td>${esc(String(signal.openCalls || 0))}</td>
                <td>${esc(String(signal.imports || 0))}</td>
                <td>${esc(network?.cameraInstalled ? `${network.cameraWorking || 0}/${network.cameraInstalled}` : '--')}</td>
                <td>${esc(network?.bandwidth || '--')}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    ` : '<div class="sync-empty">Nenhuma escola encontrada no filtro atual.</div>';
  }
}

function renderInventoryWorkspace() {
  const schoolRows = inventorySchoolRows();
  const focusSchool = inventoryFocusSchool();
  const focusRows = focusSchool ? schoolInventoryRows(focusSchool) : [];
  const categorySummary = focusSchool ? Object.values(schoolInventoryCategorySummary(focusSchool)) : [];
  const issueRows = focusSchool ? inventoryIssuesForSchool(focusSchool) : [];
  const quality = inventoryQualitySummary();
  const focusPanel = document.getElementById('inventoryFocusPanel');
  const ranking = document.getElementById('inventorySchoolRanking');
  const table = document.getElementById('inventoryDetailTable');
  const categoryTable = document.getElementById('inventoryCategoryTable');
  const schoolSelect = document.getElementById('inventorySchoolSelect');
  const categorySelect = document.getElementById('inventoryCategorySelect');
  const searchInput = document.getElementById('inventorySearchInput');
  const qualityNode = document.getElementById('inventoryQualityGrid');
  const issueNode = document.getElementById('inventoryIssuesList');
  if (schoolSelect) {
    schoolSelect.innerHTML = [`<option value="todas">Todas as escolas</option>`]
      .concat(visibleSchools().slice().sort((a, b) => a.name.localeCompare(b.name)).map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`))
      .join('');
    schoolSelect.value = currentInventorySchool;
  }
  if (categorySelect) {
    const categories = [
      ['todas', 'Todas as categorias'],
      ['desktops', 'Desktops / PCs'],
      ['notebooks', 'Notebooks'],
      ['netbooks', 'Netbooks'],
      ['tablets', 'Tablets'],
      ['infra', 'Infra / rede'],
      ['energia', 'Recarga / energia'],
      ['outros', 'Outros']
    ];
    categorySelect.innerHTML = categories.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
    categorySelect.value = currentInventoryCategory;
  }
  if (searchInput) {
    searchInput.value = currentInventorySearch;
  }
  if (focusPanel) {
    const totals = schoolAssetTotals(focusSchool);
    const alerts = schoolAlertUnits(focusSchool);
    const focusMeta = schoolByName(focusSchool);
    focusPanel.innerHTML = focusSchool ? `
      <div class="setechub-command-score">
        <div>
          <div class="sync-meta">Escola em foco</div>
          <strong>${esc(focusSchool)}</strong>
        </div>
        <span class="diag-pill ${alerts ? 'pill-danger' : 'pill-ok'}">${esc(String(alerts))} alertas</span>
      </div>
      <div class="sync-meta">CIE ${esc(focusMeta?.cie || '--')} | ${esc(focusMeta?.zone || 'Municipio nao definido')}</div>
      <div class="setechub-inline-metrics">
        <div class="mini-stat"><span class="ms-l">Tipos</span><strong class="ms-val">${esc(String(focusRows.length))}</strong></div>
        <div class="mini-stat"><span class="ms-l">Unidades</span><strong class="ms-val">${esc(String(totals.units))}</strong></div>
        <div class="mini-stat"><span class="ms-l">Importacoes</span><strong class="ms-val">${esc(String(schoolImportCount(focusSchool)))} </strong></div>
      </div>
    ` : '<div class="sync-empty">Nenhuma escola com inventario no filtro atual.</div>';
  }
  if (qualityNode) {
    qualityNode.innerHTML = [
      { label: 'Familias consolidadas', value: String(quality.families), note: 'tipos normalizados no inventario' },
      { label: 'Dados fracos', value: String(quality.lowQuality), note: 'nomes vagos ou pouco confiaveis' },
      { label: 'Familias fundidas', value: String(quality.mergedFamilies), note: 'agrupam variacoes do mesmo item' },
      { label: 'Familias criticas', value: String(quality.criticalFamilies), note: 'com defeito real registrado' },
      { label: 'Status mistos', value: String(quality.mixedStatuses), note: 'mais de um status original dentro da mesma familia' }
    ].map((item) => `
      <div class="setechub-monitor-card compact">
        <div class="sync-meta">${esc(item.label)}</div>
        <strong>${esc(item.value)}</strong>
        <div class="diag-pill">${esc(item.note)}</div>
      </div>
    `).join('');
  }
  if (issueNode) {
    issueNode.innerHTML = issueRows.map((item) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.name)}</strong>
            <div class="sync-meta">${esc(item.brand)}${item.model ? ` | modelo ${esc(item.model)}` : ''} | ${esc(badgeText(item.category))}</div>
          </div>
          <div class="setechub-badges">
            <span class="diag-pill ${item.quality === 'fraco' ? 'pill-danger' : item.quality === 'medio' ? 'pill-warn' : 'pill-ok'}">${esc(badgeText(item.quality))}</span>
            <span class="diag-pill ${item.defectUnits ? 'pill-danger' : item.alertUnits ? 'pill-warn' : 'pill-ok'}">${esc(String(item.alertUnits))} alertas</span>
          </div>
        </div>
        <div class="sync-meta">${esc(item.rawNameCount)} variacao(oes) de nome | ${esc(item.originalStatusCount)} status original(is) | BlueMonitor ${esc(String(item.blueMonitorUnits))}</div>
        <div class="sync-meta">${esc(item.notePreview || 'Sem observacao')}</div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhuma inconsistencia importante na escola em foco.</div>';
  }
  if (ranking) {
    ranking.innerHTML = schoolRows.map((item) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.school)}</strong>
            <div class="sync-meta">CIE ${esc(schoolByName(item.school)?.cie || '--')} | ${esc(String(item.totalLines))} linhas | ${esc(String(item.categories))} categorias</div>
          </div>
          <div class="setechub-badges">
            <span class="diag-pill">${esc(String(item.totalUnits))} unid.</span>
            <span class="diag-pill ${item.alertUnits ? 'pill-danger' : 'pill-ok'}">${esc(String(item.alertUnits))} alertas</span>
          </div>
        </div>
        <div class="setechub-action-row left">
          <button class="btn btn-g btn-sm" onclick="setInventorySchool('${esc(item.school)}')">Focar inventario</button>
          <button class="btn btn-p btn-sm" onclick="showSchoolDetail('${esc(item.school)}')">Abrir ficha</button>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum inventario encontrado nos filtros atuais.</div>';
  }
  if (table) {
    table.innerHTML = focusRows.length ? `
      <table class="setechub-table">
        <thead>
          <tr>
            <th>Equipamento</th>
            <th>Leitura</th>
            <th>Total</th>
            <th>Ok</th>
            <th>Alertas</th>
            <th>Criticos</th>
            <th>Observacao</th>
          </tr>
        </thead>
        <tbody>
          ${focusRows.map((item) => `
            <tr>
              <td><strong>${esc(item.name)}</strong><div class="sync-meta">${esc(item.brand)}${item.model ? ` | ${esc(item.model)}` : ''} | ${esc(badgeText(item.category))}</div></td>
              <td><span class="diag-pill ${item.quality === 'fraco' ? 'pill-danger' : item.quality === 'medio' ? 'pill-warn' : 'pill-ok'}">${esc(badgeText(item.quality))}</span><div class="sync-meta">${esc(String(item.rawNameCount))} nome(s) | ${esc(String(item.originalStatusCount))} status</div></td>
              <td>${esc(String(item.units))}</td>
              <td>${esc(String(item.okUnits))}</td>
              <td>${esc(String(item.alertUnits))}</td>
              <td>${esc(String(item.defectUnits))}</td>
              <td><div class="sync-meta">${esc(item.notePreview || 'Sem observacao')}</div></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="sync-empty">Nenhuma linha detalhada para a escola filtrada.</div>';
  }
  if (categoryTable) {
    categoryTable.innerHTML = categorySummary.length ? `
      <table class="setechub-table">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Tipos</th>
            <th>Unidades</th>
            <th>Alertas</th>
          </tr>
        </thead>
        <tbody>
            ${categorySummary.sort((a, b) => b.units - a.units || a.category.localeCompare(b.category)).map((item) => `
              <tr>
                <td><strong>${esc(badgeText(item.category))}</strong></td>
                <td>${esc(String(item.items))}</td>
                <td>${esc(String(item.units))}</td>
                <td>${esc(String(item.alertUnits))}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    ` : '<div class="sync-empty">Sem categorias para resumir nesta escola.</div>';
  }
}

function renderSetupStats() {
  document.getElementById('setupTaskCount').textContent = `${state.tasks.filter((item) => !item.done).length} tarefas`;
  document.getElementById('setupCallCount').textContent = `${state.calls.filter((item) => item.status !== 'resolvido').length} em aberto`;
  document.getElementById('setupSchoolCount').textContent = `${visibleSchools().filter((item) => item.status !== 'estavel').length} escolas`;
  document.getElementById('setupChecklistCount').textContent = `${state.checklist.length} itens`;
  document.getElementById('setupAssetCount').textContent = `${state.assets.filter((item) => item.status !== 'ok').length + state.schoolAssets.filter((item) => item.status !== 'ok').length} em observacao`;
  document.getElementById('setupHours').textContent = bankHours();
}

function renderMetrics() {
  document.getElementById('metricPending').textContent = state.tasks.filter((item) => !item.done).length;
  document.getElementById('metricCalls').textContent = state.calls.filter((item) => item.status !== 'resolvido').length;
  document.getElementById('metricSchools').textContent = visibleSchools().filter((item) => item.status !== 'estavel').length;
  document.getElementById('metricHours').textContent = bankHours();
}

function renderFocus() {
  const focus = nextFocusTask();
  document.getElementById('focusBadge').textContent = focus ? badgeText(focus.priority) : 'Organizar';
  document.getElementById('focusTitle').textContent = focus ? focus.title : 'Tudo principal do dia esta concluido.';
  document.getElementById('focusText').textContent = focus
    ? `${focus.place} | ${focus.category} | ${focus.time || 'sem horario definido'}`
    : 'Use a agenda para abrir novas tarefas, revisar escolas ou fechar relatorios.';
}

function renderWeekBadges() {
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  const today = new Date().getDay();
  const wrap = document.getElementById('weekBadges');
  if (!wrap) return;
  wrap.innerHTML = labels.map((label, index) => {
    const active = today === index + 1 ? 'pill-info' : '';
    return `<span class="diag-pill ${active}">${label}</span>`;
  }).join('');
}

function renderTimeline() {
  const list = document.getElementById('timelineList');
  list.innerHTML = timelineItems().map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>${esc(item.title)}</strong>
        <span class="diag-pill ${item.done ? 'pill-ok' : 'pill-info'}">${esc(item.time)}</span>
      </div>
      <div class="sync-meta">${esc(item.detail)}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhum item no fluxo de hoje.</div>';
}

function renderChecklist() {
  const list = document.getElementById('checklistList');
  list.innerHTML = state.checklist.map((item) => `
    <div class="setechub-item">
      <div class="setechub-check-row">
        <label class="setechub-check">
          <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklist(${item.id})">
          <span>${esc(item.text)}</span>
        </label>
        <span class="diag-pill ${item.done ? 'pill-ok' : 'pill-warn'}">${item.done ? 'Feito' : 'Pendente'}</span>
      </div>
    </div>
  `).join('');
}

function renderPonto() {
  document.getElementById('entryTime').textContent = state.ponto.entrada || '--:--';
  document.getElementById('exitTime').textContent = state.ponto.saida || '--:--';
  document.getElementById('workedToday').textContent = workedDuration();
}

function renderRoutes() {
  const list = document.getElementById('routeList');
  const order = { critico: 0, atencao: 1, estavel: 2 };
  const items = visibleSchools()
    .filter((item) => item.status !== 'estavel')
    .slice()
    .sort((a, b) => (order[a.status] ?? 99) - (order[b.status] ?? 99) || a.name.localeCompare(b.name));
  list.innerHTML = items.map((item) => `
    <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(item.name)}')">
      <div class="setechub-head">
        <strong>${esc(item.name)}</strong>
        <span class="diag-pill ${toneBySchool(item.status)}">${esc(badgeText(item.status))}</span>
      </div>
      <div class="sync-meta">${esc(item.zone)} | CIE ${esc(item.cie || '--')} | ${esc(item.notes)}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma escola em atencao no momento.</div>';
}

function renderMunicipalities() {
  const list = document.getElementById('municipalityList');
  if (!list) return;
  list.innerHTML = state.municipalities
    .slice()
    .sort((a, b) => b.schoolCount - a.schoolCount || a.name.localeCompare(b.name))
    .map((item) => `
    <div class="setechub-item setechub-clickable" onclick="openMunicipalitySchools('${esc(item.name)}')">
      <div class="setechub-head">
        <strong>${esc(item.name)}</strong>
        <span class="diag-pill">${esc(String(item.schoolCount))} escolas</span>
      </div>
      <div class="sync-meta">${esc(item.notes || 'Municipio coberto pela URE Itapeva.')}</div>
      <div class="setechub-action-row left">
        <button class="btn btn-g btn-sm" onclick="event.stopPropagation(); openMunicipalitySchools('${esc(item.name)}')">Abrir escolas</button>
      </div>
    </div>
  `).join('');
}

function renderSectors() {
  const preview = document.getElementById('sectorList');
  const directory = document.getElementById('sectorDirectoryList');
  const adminActions = canManageUsers();
  const html = state.sectors.map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <div>
          <strong>${esc(item.code)} | ${esc(item.name)}</strong>
          <div class="sync-meta">${esc(item.lead)} | ${esc(item.phone)} | ${esc(item.email)}</div>
        </div>
        <div class="setechub-badges">
          <a class="btn btn-g btn-sm" href="mailto:${esc(item.email)}">Email</a>
          ${adminActions ? `<button class="btn btn-d btn-sm" onclick="removeSector(${item.id})">Remover</button>` : ''}
        </div>
      </div>
      <div class="sync-meta">${esc(item.summary || '')}</div>
    </div>
  `).join('');
  if (preview) preview.innerHTML = state.sectors.slice(0, 5).map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>${esc(item.code)}</strong>
        <span class="diag-pill pill-info">${esc(item.phone)}</span>
      </div>
      <div class="sync-meta">${esc(item.name)} | ${esc(item.lead)}</div>
    </div>
  `).join('');
  if (directory) directory.innerHTML = html;
}

function renderDirectoryContacts() {
  const list = document.getElementById('directoryContactsList');
  if (!list) return;
  const contacts = filteredDirectoryContacts(false)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  list.innerHTML = contacts.map((item) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.name)}</strong>
            <div class="sync-meta">${esc(item.role)}</div>
          </div>
          <div class="setechub-badges">
            <span class="diag-pill">${esc(item.phone)}</span>
            <a class="btn btn-g btn-sm" href="mailto:${esc(item.email)}">Email</a>
          </div>
        </div>
        <div class="sync-meta">${esc(item.email)}</div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum contato oficial importado.</div>';
  const pecList = document.getElementById('pecAccountList');
  if (pecList) {
    const pecAccountContacts = filteredDirectoryContacts(true)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    pecList.innerHTML = pecAccountContacts.map((item) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.name)}</strong>
            <div class="sync-meta">${esc(item.role)}</div>
          </div>
          <span class="diag-pill">${esc(item.phone)}</span>
        </div>
        <div class="sync-meta">${esc(item.email)}</div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum dado PEC liberado para este acesso.</div>';
  }
  const pecsPageList = document.getElementById('pecsPageList');
  if (pecsPageList) {
    const pecContacts = filteredDirectoryContacts().filter((item) => /pec|curriculo|currículo|especialista/i.test(`${item.role} ${item.name}`));
    pecsPageList.innerHTML = pecContacts
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => `
        <div class="setechub-item">
          <div class="setechub-head">
            <div>
              <strong>${esc(item.name)}</strong>
              <div class="sync-meta">${esc(item.role)}</div>
            </div>
            <span class="diag-pill">${esc(item.phone)}</span>
          </div>
          <div class="sync-meta">${esc(item.email)}</div>
        </div>
      `).join('') || '<div class="sync-empty">Nenhum PEC disponivel para este perfil.</div>';
  }
}

function renderSchoolImports() {
  const filtered = filteredSchoolImports();
  const select = document.getElementById('importSchoolSelect');
  if (select) {
    const selected = currentImportSchoolContext || currentSchoolDetail || select.value;
    select.innerHTML = visibleSchools()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`)
      .join('');
    if (selected && visibleSchools().some((school) => school.name === selected)) {
      select.value = selected;
    }
  }
  const list = document.getElementById('schoolImportList');
  if (!list) return;
  list.innerHTML = filtered
    .slice()
    .sort((a, b) => {
      const reviewDiff = (a.reviewStatus === 'pending' ? 0 : 1) - (b.reviewStatus === 'pending' ? 0 : 1);
      if (reviewDiff) return reviewDiff;
      return String(b.importedAt || '').localeCompare(String(a.importedAt || ''));
    })
    .map((item) => `
      <div class="setechub-item school-detail-section">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.label || item.filename || 'Importacao')}</strong>
            <div class="sync-meta">${esc(item.school)} | ${esc(item.type)} | ${esc(item.importedAt || '')}</div>
          </div>
          <div class="setechub-badges">
            <span class="diag-pill ${item.reviewStatus === 'pending' ? 'pill-warn' : 'pill-ok'}">${item.reviewStatus === 'pending' ? 'Pendente' : 'Confirmada'}</span>
            <span class="diag-pill">${esc(item.summary || 'Lido')}</span>
          </div>
        </div>
        <div class="sync-meta">${esc(String(item.preview || '').split('\n').slice(0, 4).join(' | ') || 'Sem preview relevante')}</div>
        <div class="setechub-action-row left">
          ${item.reviewStatus === 'pending' ? `<button class="btn btn-p btn-sm" onclick='approveSchoolImport(${JSON.stringify(item.id)})'>Confirmar</button>` : ''}
          <button class="btn btn-d btn-sm" onclick='rejectSchoolImport(${JSON.stringify(item.id)})'>${item.reviewStatus === 'pending' ? 'Excluir dados' : 'Remover'}</button>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhuma importacao vinculada a escolas neste filtro.</div>';
  const stats = document.getElementById('schoolImportStatus');
  if (stats) {
    const bySchool = new Set(state.schoolImports.map((item) => item.school)).size;
    const pending = filtered.filter((item) => item.reviewStatus === 'pending').length;
    stats.textContent = `${filtered.length} importacao(oes) visiveis | ${pending} pendente(s) de revisao | ${bySchool} escola(s) com arquivos`;
  }
}

function renderSchoolDetail() {
  const select = document.getElementById('schoolDetailSelect');
  const sortedSchools = visibleSchools().slice().sort((a, b) => a.name.localeCompare(b.name));
  const schoolNames = sortedSchools.map((item) => item.name);
  if (!currentSchoolDetail || !schoolNames.includes(currentSchoolDetail)) {
    currentSchoolDetail = schoolNames[0] || '';
  }
  if (select) {
    select.innerHTML = sortedSchools.map((item) => `<option value="${esc(item.name)}">${esc(item.name)} | CIE ${esc(item.cie || '--')}</option>`).join('');
    select.value = currentSchoolDetail;
  }

  const school = visibleSchools().find((item) => item.name === currentSchoolDetail);
  if (!school) {
    showPage('schools');
    return;
  }
  const profile = currentSchoolProfile();
  const imports = state.schoolImports.filter((item) => item.school === currentSchoolDetail);
  const approvedImports = imports.filter((item) => item.reviewStatus !== 'pending');
  const pendingImports = imports.filter((item) => item.reviewStatus === 'pending');
  const assets = state.schoolAssets.filter((item) => item.school === currentSchoolDetail);
  const network = schoolNetworkRecord(currentSchoolDetail);
  const inventoryRows = schoolInventoryRows(currentSchoolDetail);
  const inventoryCategories = Object.values(schoolInventoryCategorySummary(currentSchoolDetail)).sort((a, b) => b.units - a.units);
  const openCalls = state.calls.filter((item) => item.school === currentSchoolDetail && item.status !== 'resolvido');
  const plannedTasks = state.tasks.filter((item) => item.place === currentSchoolDetail || item.title.includes(currentSchoolDetail));
  const totalUnits = assets.reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const alertUnits = assets.filter((item) => item.status !== 'ok').reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const defectUnits = assets.filter((item) => item.status === 'defeito').reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const completion = schoolProfileCompletion(currentSchoolDetail);
  const missingFields = schoolMissingProfileFields(currentSchoolDetail);
  const riskLabel = defectUnits > 0 || school?.status === 'critico'
    ? 'Acao urgente'
    : alertUnits > 0 || openCalls.length > 0 || school?.status === 'atencao'
      ? 'Acompanhar de perto'
      : 'Base sob controle';
  const riskTone = defectUnits > 0 || school?.status === 'critico'
    ? 'pill-danger'
    : alertUnits > 0 || openCalls.length > 0 || school?.status === 'atencao'
      ? 'pill-warn'
      : 'pill-ok';
  const networkGap = network ? Math.max(0, Number(network.cameraInstalled || 0) - Number(network.cameraWorking || 0)) : 0;

  document.getElementById('schoolDetailHeader').innerHTML = school ? `
    <div class="setechub-item">
      <div class="setechub-head">
        <div>
          <strong>${esc(school.name)}</strong>
          <div class="sync-meta">${esc(school.zone)} | CIE ${esc(school.cie || network?.cie || '--')} | ${esc(school.notes || 'Sem observacoes')}</div>
        </div>
        <div class="setechub-badges">
          ${school.fixedName ? '<span class="diag-pill">Oficial</span>' : ''}
          <span class="diag-pill ${toneBySchool(school.status)}">${esc(badgeText(school.status))}</span>
          <button class="btn btn-p btn-sm" type="button" onclick="setInventorySchool('${esc(school.name)}')">Abrir inventario</button>
        </div>
      </div>
    </div>
  ` : '<div class="sync-empty">Nenhuma escola selecionada.</div>';

  const pageTitle = document.getElementById('schoolRecordTitle');
  const pageSubtitle = document.getElementById('schoolRecordSubtitle');
  if (pageTitle) pageTitle.textContent = school ? school.name : 'Pagina da escola';
  if (pageSubtitle) {
    pageSubtitle.textContent = school
      ? `${school.zone} | CIE ${school.cie || network?.cie || '--'} | inventario, rede, chamados e importacoes da unidade.`
      : 'Base completa da unidade com inventario, rede, contatos e importacoes.';
  }

  document.getElementById('schoolDetailExecutive').innerHTML = school ? `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>Prioridade da unidade</strong>
        <span class="diag-pill ${riskTone}">${esc(riskLabel)}</span>
      </div>
      <div class="sync-meta">
        ${esc(school.zone)} | ficha ${esc(String(completion))}% | ${esc(String(openCalls.length))} chamado(s) | ${esc(String(plannedTasks.length))} tarefa(s)
      </div>
    </div>
    <div class="setechub-item">
      <strong>Leitura rapida</strong>
      <div class="sync-meta">
        Inventario: ${esc(String(totalUnits))} unidade(s) em ${esc(String(inventoryRows.length))} familia(s) |
        alertas: ${esc(String(alertUnits))} |
        criticos: ${esc(String(defectUnits))}
      </div>
      <div class="sync-meta">
        Rede/CFTV: ${network ? `${network.cameraWorking || 0}/${network.cameraInstalled || 0} cameras` : 'sem dados de rede'} |
        banda: ${esc(network?.bandwidth || '--')} |
        importacoes confirmadas: ${esc(String(approvedImports.length))}
      </div>
    </div>
  ` : '<div class="sync-empty">Nenhuma escola selecionada.</div>';

  document.getElementById('schoolDetailActions').innerHTML = school ? [
    defectUnits > 0
      ? `<div class="setechub-item"><strong>Inventario critico</strong><div class="sync-meta">${esc(String(defectUnits))} unidade(s) com defeito. Vale abrir o inventario da escola primeiro.</div><div class="setechub-action-row left"><button class="btn btn-p btn-sm" type="button" onclick="setInventorySchool('${esc(school.name)}')">Abrir inventario</button></div></div>`
      : '',
    openCalls.length > 0
      ? `<div class="setechub-item"><strong>Chamados em aberto</strong><div class="sync-meta">${esc(String(openCalls.length))} chamado(s) ativo(s) para esta escola.</div><div class="setechub-action-row left"><button class="btn btn-g btn-sm" type="button" onclick="openSchoolCalls('${esc(school.name)}')">Abrir chamados</button></div></div>`
      : '',
    pendingImports.length
      ? `<div class="setechub-item"><strong>Importacao pendente</strong><div class="sync-meta">${esc(String(pendingImports.length))} importacao(oes) aguardando confirmacao ou exclusao.</div><div class="setechub-action-row left"><button class="btn btn-g btn-sm" type="button" onclick="document.getElementById('schoolImportList')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">Revisar arquivos</button></div></div>`
      : '',
    missingFields.length
      ? `<div class="setechub-item"><strong>Ficha incompleta</strong><div class="sync-meta">Ainda faltam: ${esc(missingFields.slice(0, 4).join(', '))}${missingFields.length > 4 ? '...' : ''}.</div></div>`
      : '',
    (!network || networkGap > 0)
      ? `<div class="setechub-item"><strong>Rede / CFTV</strong><div class="sync-meta">${esc(!network ? 'Ainda nao ha importacao de rede para a unidade.' : `${networkGap} camera(s) fora da cobertura esperada.`)}</div></div>`
      : '',
    approvedImports.length === 0
      ? `<div class="setechub-item"><strong>Sem importacoes</strong><div class="sync-meta">A unidade ainda nao recebeu arquivo vinculado para enriquecer a base.</div></div>`
      : ''
  ].filter(Boolean).join('') || '<div class="sync-empty">Nenhuma pendencia critica encontrada para esta escola.</div>' : '<div class="sync-empty">Nenhuma escola selecionada.</div>';

  document.getElementById('schoolDetailMetrics').innerHTML = [
    { label: 'CIE', value: school?.cie || network?.cie || '--', note: 'codigo mestre da escola' },
    { label: 'Chamados', value: String(openCalls.length), note: `${plannedTasks.length} tarefas relacionadas` },
    { label: 'Criticos', value: String(defectUnits), note: 'unidades com defeito' },
    { label: 'Alertas', value: String(alertUnits), note: 'unidades em manutencao ou defeito' },
    { label: 'Equipamentos', value: String(totalUnits), note: `${assets.length} linhas de inventario` },
    { label: 'Ficha', value: `${completion}%`, note: missingFields.length ? `${missingFields.length} campo(s) faltando` : 'cadastro consistente' },
    { label: 'CFTV', value: network?.cameraInstalled ? `${network.cameraWorking || 0}/${network.cameraInstalled}` : '--', note: network ? `status ${badgeText(network.status)}` : 'sem importacao de rede' },
    { label: 'Banda', value: network?.bandwidth || '--', note: network?.wifi ? `Wi-Fi ${network.wifi}` : 'sem wifi informado' },
    { label: 'Importacoes', value: String(approvedImports.length), note: pendingImports.length ? `${pendingImports.length} pendente(s)` : 'arquivos confirmados' }
  ].map((item) => `
    <div class="setechub-monitor-card">
      <div class="sync-meta">${esc(item.label)}</div>
      <strong>${esc(item.value)}</strong>
      <div class="diag-pill">${esc(item.note)}</div>
    </div>
  `).join('');

  document.getElementById('schoolDetailContacts').innerHTML = `
    <div class="setechub-item">
      <strong>Gestao</strong>
      <div class="sync-meta">Direcao: ${esc(profile?.director || 'Nao informado')}</div>
      <div class="sync-meta">Vice-direcao: ${esc(profile?.viceDirector || 'Nao informado')}</div>
      <div class="sync-meta">PROATI: ${esc(profile?.proati || 'Nao informado')}</div>
      <div class="sync-meta">GOE / apoio: ${esc(profile?.goe || 'Nao informado')}</div>
    </div>
    <div class="setechub-item">
      <strong>Contato</strong>
      <div class="school-link-grid">
        ${profile?.phone ? `<a class="btn btn-g btn-sm" href="tel:${esc(profile.phone)}">Ligar ${esc(profile.phone)}</a>` : '<span class="diag-pill">Sem telefone</span>'}
        ${profile?.mobile ? `<a class="btn btn-g btn-sm" href="https://wa.me/${esc(profile.mobile.replace(/\D/g, ''))}" target="_blank" rel="noreferrer">WhatsApp</a>` : '<span class="diag-pill">Sem celular</span>'}
        ${profile?.email ? `<a class="btn btn-g btn-sm" href="mailto:${esc(profile.email)}">E-mail</a>` : '<span class="diag-pill">Sem e-mail</span>'}
        ${profile?.address ? `<a class="btn btn-g btn-sm" href="https://www.google.com/maps/search/${encodeURIComponent(profile.address)}" target="_blank" rel="noreferrer">Mapa</a>` : '<span class="diag-pill">Sem endereco</span>'}
      </div>
      <div class="sync-meta">${esc(profile?.address || 'Endereco nao informado')}</div>
      <div class="sync-meta">${esc(profile?.notes || 'Sem observacoes adicionais')}</div>
    </div>
  `;

  document.getElementById('schoolDetailInventory').innerHTML = `
    <div class="setechub-item school-detail-section">
      <strong>Resumo do inventario</strong>
      <div class="school-detail-data-grid">
        <div class="school-detail-data-card">
          <span>Familias</span>
          <strong>${esc(String(inventoryRows.length))}</strong>
        </div>
        <div class="school-detail-data-card">
          <span>Unidades</span>
          <strong>${esc(String(totalUnits))}</strong>
        </div>
        <div class="school-detail-data-card ${alertUnits ? 'is-alert' : ''}">
          <span>Alertas</span>
          <strong>${esc(String(alertUnits))}</strong>
        </div>
        <div class="school-detail-data-card">
          <span>Confirmadas</span>
          <strong>${esc(String(approvedImports.length))}</strong>
        </div>
      </div>
      <div class="school-detail-highlight">
        ${inventoryCategories.length ? inventoryCategories.slice(0, 4).map((item) => `<span class="diag-pill">${esc(badgeText(item.category))}: ${esc(String(item.units))}</span>`).join('') : '<span class="diag-pill">Sem categorias consolidadas</span>'}
      </div>
    </div>
    ${inventoryRows.length ? `
      <div class="setechub-table-wrap school-detail-section">
        <table class="setechub-table">
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Qualidade</th>
              <th>Total</th>
              <th>Alertas</th>
              <th>Criticos</th>
            </tr>
          </thead>
          <tbody>
            ${inventoryRows.slice(0, 10).map((item) => `
              <tr>
                <td><strong>${esc(item.name)}</strong><div class="sync-meta">${esc(item.brand)}${item.model ? ` | ${esc(item.model)}` : ''}</div></td>
                <td><span class="diag-pill ${item.quality === 'fraco' ? 'pill-danger' : item.quality === 'medio' ? 'pill-warn' : 'pill-ok'}">${esc(badgeText(item.quality))}</span></td>
                <td>${esc(String(item.units))}</td>
                <td>${esc(String(item.alertUnits))}</td>
                <td>${esc(String(item.defectUnits))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : '<div class="sync-empty">Nenhum equipamento vinculado.</div>'}
    <div class="setechub-item school-detail-section">
      <strong>Arquivos da escola</strong>
      ${approvedImports.length ? `
        <div class="school-detail-file-list">
          ${approvedImports.slice(0, 3).map((item) => `
            <div class="school-detail-file-card">
              <div class="setechub-head">
                <div>
                  <strong>${esc(item.label || item.filename || 'Importacao')}</strong>
                  <div class="sync-meta">${esc(item.type)} | ${esc(item.importedAt || '')}</div>
                </div>
                <span class="diag-pill">${esc(item.summary || 'Lido')}</span>
              </div>
              <div class="sync-meta">${esc(String(item.preview || '').split('\n').slice(0, 3).join(' | ') || 'Sem preview relevante')}</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="sync-empty">Nenhuma importacao confirmada.</div>'}
    </div>
  `;

  document.getElementById('schoolDetailNetwork').innerHTML = network ? `
    <div class="setechub-item school-detail-section">
      <div class="setechub-head">
        <div>
          <strong>CFTV e espelhamento</strong>
          <div class="sync-meta">DE ${esc(network.de || '--')} | CIE ${esc(network.cie || '--')} | espelhamento ${esc(network.mirroringDate || 'nao informado')}</div>
        </div>
        <div class="setechub-badges">
          <span class="diag-pill ${toneBySchool(network.status === 'defeito' ? 'critico' : network.status === 'manutencao' ? 'atencao' : 'estavel')}">${esc(badgeText(network.status))}</span>
          <span class="diag-pill">${esc(network.cameraWorkingLabel || '--')} / ${esc(network.cameraInstalledLabel || '--')}</span>
        </div>
      </div>
      <div class="school-detail-data-grid">
        <div class="school-detail-data-card">
          <span>Cameras OK</span>
          <strong>${esc(network.cameraWorkingLabel || '--')}</strong>
        </div>
        <div class="school-detail-data-card">
          <span>Cameras total</span>
          <strong>${esc(network.cameraInstalledLabel || '--')}</strong>
        </div>
        <div class="school-detail-data-card">
          <span>Banda</span>
          <strong>${esc(network.bandwidth || '--')}</strong>
        </div>
        <div class="school-detail-data-card">
          <span>Wi-Fi</span>
          <strong>${esc(network.wifi || '--')}</strong>
        </div>
      </div>
    </div>
    <div class="setechub-item school-detail-section">
      <strong>Acesso tecnico</strong>
      <div class="school-detail-kv-list">
        <div><span>Usuario DVR</span><strong>${esc(network.dvrUser || '--')}</strong></div>
        <div><span>Senha DVR</span><strong>${esc(network.password || '--')}</strong></div>
        <div><span>Marca DVR</span><strong>${esc(network.dvrBrand || '--')}</strong></div>
        <div><span>Tecnicos</span><strong>${esc(network.technicians || '--')}</strong></div>
      </div>
    </div>
    <div class="setechub-item school-detail-section">
      <strong>Rede administrativa e pedagogica</strong>
      <div class="school-detail-kv-list">
        <div><span>ADM</span><strong>${esc(network.adminNetwork || '--')}</strong></div>
        <div><span>Gateway ADM</span><strong>${esc(network.adminGateway || '--')}</strong></div>
        <div><span>PED</span><strong>${esc(network.pedNetwork || '--')}</strong></div>
        <div><span>Gateway PED</span><strong>${esc(network.pedGateway || '--')}</strong></div>
        <div><span>DNS 1</span><strong>${esc(network.dnsPrimary || '--')}</strong></div>
        <div><span>DNS 2</span><strong>${esc(network.dnsSecondary || '--')}</strong></div>
      </div>
    </div>
    <div class="setechub-item school-detail-section">
      <strong>Infra e observacoes</strong>
      <div class="school-detail-kv-list">
        <div><span>Firewall</span><strong>${esc(network.firewallModel || '--')}</strong></div>
        <div><span>VIDEO-DVR1</span><strong>${esc(network.videoDvr1 || '--')}</strong></div>
        <div><span>VIDEO-DVR2</span><strong>${esc(network.videoDvr2 || '--')}</strong></div>
        <div><span>VIDEO-DVR3</span><strong>${esc(network.videoDvr3 || '--')}</strong></div>
      </div>
      <div class="sync-meta">${esc((network.notes || []).join(' | ') || 'Sem observacoes adicionais na importacao de rede.')}</div>
    </div>
  ` : '<div class="sync-empty">Nenhum registro de rede/CFTV importado para esta escola ainda.</div>';

  const historyNode = document.getElementById('schoolEventHistory');
  if (historyNode) {
    const history = schoolEventHistory(currentSchoolDetail);
    historyNode.innerHTML = history.map((item) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <strong>${esc(item.text)}</strong>
          <span class="diag-pill">${esc(item.when)}</span>
        </div>
        <div class="sync-meta">${esc(badgeText(item.kind))}</div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum historico relevante para esta escola ainda.</div>';
  }

  document.getElementById('schoolProfileDirector').value = profile?.director || '';
  document.getElementById('schoolProfileViceDirector').value = profile?.viceDirector || '';
  document.getElementById('schoolProfileProati').value = profile?.proati || '';
  document.getElementById('schoolProfileGoe').value = profile?.goe || '';
  document.getElementById('schoolProfilePhone').value = profile?.phone || '';
  document.getElementById('schoolProfileMobile').value = profile?.mobile || '';
  document.getElementById('schoolProfileEmail').value = profile?.email || '';
  document.getElementById('schoolProfileAddress').value = profile?.address || '';
  document.getElementById('schoolProfileNotes').value = profile?.notes || '';
}

function renderSupervisors() {
  const metricCount = document.getElementById('supervisorMetricCount');
  const stats = supervisorStats();
  const visits = state.supervisorVisits || [];
  const assignedSchoolCount = new Set(stats.flatMap((item) => item.assignedSchools)).size;
  const averageCoverage = stats.length
    ? Math.round(stats.reduce((sum, item) => sum + item.coverage, 0) / stats.length)
    : 0;

  if (metricCount) metricCount.textContent = String(stats.length);
  const metricSchools = document.getElementById('supervisorMetricSchools');
  const metricVisits = document.getElementById('supervisorMetricVisits');
  const metricCoverage = document.getElementById('supervisorMetricCoverage');
  if (metricSchools) metricSchools.textContent = String(assignedSchoolCount);
  if (metricVisits) metricVisits.textContent = String(visits.length);
  if (metricCoverage) metricCoverage.textContent = `${averageCoverage}%`;

  const filterSelect = document.getElementById('supervisorFilterSelect');
  const visitSupervisorSelect = document.getElementById('visitSupervisorSelect');
  const visitSchoolSelect = document.getElementById('visitSchoolSelect');
  const supervisorOptions = stats.map(({ supervisor }) => `<option value="${esc(normalizeKey(supervisor.name))}">${esc(supervisor.name)}</option>`).join('');
  if (filterSelect) {
    filterSelect.innerHTML = supervisorOptions;
    filterSelect.value = currentSupervisorFilter;
  }
  if (visitSupervisorSelect) {
    visitSupervisorSelect.innerHTML = stats.map(({ supervisor }) => `<option value="${esc(supervisor.name)}">${esc(supervisor.name)}</option>`).join('');
  }
  if (visitSchoolSelect) {
    const selectedSupervisor = visitSupervisorSelect?.value || stats[0]?.supervisor.name || '';
    const selected = stats.find((item) => item.supervisor.name === selectedSupervisor) || stats[0];
    visitSchoolSelect.innerHTML = (selected?.assignedSchools || visibleSchools().map((school) => school.name))
      .map((school) => `<option value="${esc(school)}">${esc(school)}</option>`)
      .join('');
  }
  const visitDate = document.getElementById('visitDate');
  if (visitDate && !visitDate.value) visitDate.value = new Date().toISOString().slice(0, 10);

  const selectorList = document.getElementById('supervisorSelectorList');
  if (selectorList) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    selectorList.innerHTML = stats.map((item) => `
      <button class="supervisor-selector-btn" type="button" onclick="openSupervisorRecord('${esc(item.supervisor.name)}')">
        ${(() => {
          const monthlyGoal = Number(item.supervisor.monthlyGoal || item.assignedSchools.length || 1);
          const monthVisits = visits.filter((visit) => {
            if (visit.supervisor !== item.supervisor.name) return false;
            const date = new Date(`${visit.date}T00:00:00`);
            return date.getFullYear() === year && date.getMonth() === month;
          });
          const visitedSchools = new Set(monthVisits.map((visit) => visit.school)).size;
          const pending = Math.max(0, item.assignedSchools.length - visitedSchools);
          const goalMet = monthVisits.length >= monthlyGoal;
          return `
            <span class="diag-pill ${goalMet ? 'pill-ok' : 'pill-warn'}">${goalMet ? 'Meta cumprida' : 'Meta pendente'}</span>
            <span>${esc(item.supervisor.name)}</span>
            <strong>${esc(String(monthVisits.length))}/${esc(String(monthlyGoal))} visita(s)</strong>
            <small>${esc(String(item.assignedSchools.length))} escola(s) | ${esc(String(visitedSchools))} visitada(s) | ${esc(String(pending))} pendente(s)</small>
          `;
        })()}
      </button>
    `).join('') || '<div class="sync-empty">Nenhum supervisor cadastrado.</div>';
  }

  const overviewPanel = document.getElementById('supervisorOverviewPanel');
  if (overviewPanel) {
    const totalGoal = stats.reduce((sum, item) => sum + Number(item.supervisor.monthlyGoal || item.assignedSchools.length || 0), 0);
    const metGoals = stats.filter((item) => item.visits >= Number(item.supervisor.monthlyGoal || item.assignedSchools.length || 1)).length;
    overviewPanel.innerHTML = `
      <div class="school-overview-kpis">
        <div><span>Meta total</span><strong>${esc(String(totalGoal))}</strong></div>
        <div><span>Cumpriram</span><strong>${esc(String(metGoals))}</strong></div>
        <div><span>Pendentes</span><strong>${esc(String(Math.max(0, stats.length - metGoals)))}</strong></div>
        <div><span>Cobertura</span><strong>${esc(String(averageCoverage))}%</strong></div>
      </div>
    `;
  }

  const attentionList = document.getElementById('supervisorAttentionList');
  if (attentionList) {
    attentionList.innerHTML = stats
      .filter((item) => item.visits < Number(item.supervisor.monthlyGoal || item.assignedSchools.length || 1))
      .slice(0, 6)
      .map((item) => `
        <div class="setechub-item setechub-clickable" onclick="openSupervisorRecord('${esc(item.supervisor.name)}')">
          <div class="setechub-head">
            <div>
              <strong>${esc(item.supervisor.name)}</strong>
              <div class="sync-meta">${esc(String(item.visits))}/${esc(String(item.supervisor.monthlyGoal || item.assignedSchools.length || 1))} visita(s) no periodo de teste</div>
            </div>
            <span class="diag-pill pill-warn">Meta pendente</span>
          </div>
        </div>
      `).join('') || '<div class="sync-empty">Nenhuma pendencia geral de supervisao.</div>';
  }

  const summaryTable = document.getElementById('supervisorVisitTable');
  if (summaryTable) {
    summaryTable.innerHTML = visits.length ? `
      <table class="setechub-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Supervisor</th>
            <th>Escola</th>
            <th>Tipo</th>
          </tr>
        </thead>
        <tbody>
          ${visits.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12).map((visit) => `
            <tr>
              <td>${esc(visit.date || '--')}</td>
              <td><button class="link-button" type="button" onclick="openSupervisorRecord('${esc(visit.supervisor)}')">${esc(visit.supervisor)}</button></td>
              <td><button class="link-button" type="button" onclick="openSchoolRecord('${esc(visit.school)}')">${esc(visit.school)}</button></td>
              <td><span class="diag-pill">${esc(visit.type || 'Visita')}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="sync-empty">Nenhuma visita registrada ainda.</div>';
  }
  return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const selectedAllVisits = selectedStat
    ? (state.supervisorVisits || []).filter((visit) => visit.supervisor === selectedStat.supervisor.name)
    : [];
  const selectedVisits = selectedAllVisits.filter((visit) => {
    const date = new Date(`${visit.date}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const visitedSchoolSet = new Set(selectedVisits.map((visit) => visit.school));
  const pendingSchools = selectedStat
    ? selectedStat.assignedSchools.filter((school) => !visitedSchoolSet.has(school))
    : [];
  const monthlyGoal = selectedStat ? Number(selectedStat.supervisor.monthlyGoal || selectedStat.assignedSchools.length || 1) : 1;
  const monthlyVisitCount = selectedVisits.length;
  const goalPct = selectedStat ? Math.min(100, Math.round((monthlyVisitCount / monthlyGoal) * 100)) : 0;
  const goalMet = selectedStat && monthlyVisitCount >= monthlyGoal;

  const profilePanel = document.getElementById('supervisorProfilePanel');
  if (profilePanel) {
    profilePanel.innerHTML = selectedStat ? `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(selectedStat.supervisor.name)}</strong>
            <div class="sync-meta">${esc(selectedStat.supervisor.email || '')} | ${esc(selectedStat.supervisor.phone || '')}</div>
            ${selectedStat.supervisor.visitSourceUrl ? `<div class="sync-meta">Fonte principal: ${esc(selectedStat.supervisor.visitSourceLabel || 'Planilha Google')}${selectedStat.supervisor.sourceSyncedAt ? ` | atualizada em ${esc(timestampLabel(new Date(selectedStat.supervisor.sourceSyncedAt)))}` : ''}</div>` : ''}
          </div>
          <span class="diag-pill ${goalMet ? 'pill-ok' : 'pill-warn'}">${goalMet ? 'Meta cumprida' : 'Meta pendente'}</span>
        </div>
        ${selectedStat.supervisor.visitSourceUrl ? `<div class="mini-actions"><a class="btn btn-g btn-sm" href="${esc(selectedStat.supervisor.visitSourceUrl)}" target="_blank" rel="noreferrer">Abrir planilha</a></div>` : ''}
      </div>
      <div class="school-overview-kpis">
        <div><span>Escolas</span><strong>${esc(String(selectedStat.assignedSchools.length))}</strong></div>
        <div><span>Mes</span><strong>${esc(String(monthlyVisitCount))}</strong></div>
        <div><span>Visitadas</span><strong>${esc(String(visitedSchoolSet.size))}</strong></div>
        <div><span>Faltam</span><strong>${esc(String(pendingSchools.length))}</strong></div>
      </div>
    ` : '<div class="sync-empty">Selecione um supervisor para abrir o painel.</div>';
  }

  const goalPanel = document.getElementById('supervisorGoalPanel');
  if (goalPanel) {
    goalPanel.innerHTML = selectedStat ? `
      <div class="setechub-command-score supervisor-goal-score">
        <div>
          <div class="sync-meta">Meta mensal</div>
          <strong>${esc(String(monthlyVisitCount))}/${esc(String(monthlyGoal))}</strong>
        </div>
        <span class="diag-pill ${goalMet ? 'pill-ok' : 'pill-warn'}">${esc(String(goalPct))}%</span>
      </div>
      <div class="setechub-bar"><span style="width:${esc(String(Math.max(4, goalPct)))}%"></span></div>
      <div class="sync-meta">${goalMet ? 'Supervisor ja atingiu a meta de visitas no mes atual.' : `Faltam ${esc(String(Math.max(0, monthlyGoal - monthlyVisitCount)))} visita(s) para cumprir a meta do mes.`}</div>
    ` : '<div class="sync-empty">Sem meta calculada.</div>';
  }

  const calendar = document.getElementById('supervisorCalendarGrid');
  if (calendar) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const visitsByDay = selectedVisits.reduce((acc, visit) => {
      const date = new Date(`${visit.date}T00:00:00`);
      if (date.getFullYear() !== year || date.getMonth() !== month) return acc;
      const day = date.getDate();
      if (!acc[day]) acc[day] = [];
      acc[day].push(visit);
      return acc;
    }, {});
    const blanks = Array.from({ length: firstWeekday }, () => '<div class="supervisor-calendar-day empty"></div>');
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dayVisits = visitsByDay[day] || [];
      return `
        <div class="supervisor-calendar-day ${dayVisits.length ? 'has-visit' : ''}">
          <strong>${esc(String(day))}</strong>
          <span>${dayVisits.length ? `${esc(String(dayVisits.length))} visita(s)` : ''}</span>
        </div>
      `;
    });
    calendar.innerHTML = [
      '<div class="supervisor-calendar-week">Dom</div><div class="supervisor-calendar-week">Seg</div><div class="supervisor-calendar-week">Ter</div><div class="supervisor-calendar-week">Qua</div><div class="supervisor-calendar-week">Qui</div><div class="supervisor-calendar-week">Sex</div><div class="supervisor-calendar-week">Sab</div>',
      ...blanks,
      ...days
    ].join('');
  }

  const visitedNode = document.getElementById('supervisorVisitedSchools');
  if (visitedNode) {
    const visited = selectedStat ? selectedStat.assignedSchools.filter((school) => visitedSchoolSet.has(school)) : [];
    visitedNode.innerHTML = visited.map((school) => {
      const schoolVisits = selectedVisits.filter((visit) => visit.school === school);
      const lastVisit = schoolVisits.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      return `
        <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')">
          <div class="setechub-head">
            <div>
              <strong>${esc(school)}</strong>
              <div class="sync-meta">${esc(String(schoolVisits.length))} visita(s) | ultima em ${esc(lastVisit?.date || '--')}</div>
            </div>
            <span class="diag-pill pill-ok">Visitada</span>
          </div>
        </div>
      `;
    }).join('') || '<div class="sync-empty">Nenhuma escola visitada neste recorte.</div>';
  }

  const pendingNode = document.getElementById('supervisorPendingSchools');
  if (pendingNode) {
    pendingNode.innerHTML = pendingSchools.map((school) => `
      <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')">
        <div class="setechub-head">
          <div>
            <strong>${esc(school)}</strong>
            <div class="sync-meta">Sem visita registrada para ${esc(selectedStat?.supervisor.name || 'o supervisor')}.</div>
          </div>
          <span class="diag-pill pill-warn">Pendente</span>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Todas as escolas vinculadas possuem visita registrada.</div>';
  }

  const matrix = document.getElementById('supervisorSchoolMatrix');
  if (matrix) {
    matrix.innerHTML = filteredStats.map((item) => `
      <article class="supervisor-card">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.supervisor.name)}</strong>
            <div class="sync-meta">${esc(item.supervisor.email || '')} | ${esc(item.supervisor.phone || '')}</div>
          </div>
          <span class="diag-pill">${esc(item.supervisor.source === 'teste' ? 'dados teste' : 'oficial')}</span>
        </div>
        <div class="school-overview-kpis">
          <div><span>Escolas</span><strong>${esc(String(item.assignedSchools.length))}</strong></div>
          <div><span>Visitas</span><strong>${esc(String(item.visits))}</strong></div>
          <div><span>Cobertura</span><strong>${esc(String(item.coverage))}%</strong></div>
          <div><span>Chamados</span><strong>${esc(String(item.openCalls))}</strong></div>
        </div>
        <div class="supervisor-school-list">
          ${item.assignedSchools.map((schoolName) => {
            const signal = schoolByName(schoolName) ? schoolOperationalSnapshot(schoolByName(schoolName)) : null;
            const wasVisited = visitedSchoolSet.has(schoolName);
            return `
              <button class="supervisor-school-row" type="button" onclick="openSchoolRecord('${esc(schoolName)}')">
                <span>${esc(schoolName)}</span>
                <strong>${wasVisited ? 'visitada' : `${esc(String(signal?.alertUnits || 0))} alertas`}</strong>
              </button>
            `;
          }).join('')}
        </div>
      </article>
    `).join('') || '<div class="sync-empty">Nenhum supervisor encontrado.</div>';
  }

  const table = document.getElementById('supervisorVisitTable');
  if (table) {
    table.innerHTML = visits.length ? `
      <table class="setechub-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Supervisor</th>
            <th>Escola</th>
            <th>Tipo</th>
            <th>Observacao</th>
          </tr>
        </thead>
        <tbody>
          ${visits.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((visit) => `
            <tr>
              <td>${esc(visit.date || '--')}</td>
              <td>${esc(visit.supervisor)}</td>
              <td><button class="link-button" type="button" onclick="openSchoolRecord('${esc(visit.school)}')">${esc(visit.school)}</button></td>
              <td><span class="diag-pill">${esc(visit.type || 'Visita')}</span></td>
              <td>${esc(visit.notes || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '<div class="sync-empty">Nenhuma visita registrada neste recorte.</div>';
  }
}

function renderSupervisorRecord() {
  const profileHost = document.getElementById('supervisorRecordProfile');
  if (!profileHost) return;
  const select = document.getElementById('supervisorRecordSelect');
  const stats = supervisorStats();
  if (!stats.length) {
    profileHost.innerHTML = '<div class="sync-empty">Nenhum supervisor cadastrado.</div>';
    return;
  }
  if (!currentSupervisorDetail || !stats.some((item) => item.supervisor.name === currentSupervisorDetail)) {
    currentSupervisorDetail = stats[0].supervisor.name;
  }
  currentSupervisorFilter = normalizeKey(currentSupervisorDetail);
  const selectedStat = stats.find((item) => item.supervisor.name === currentSupervisorDetail) || stats[0];
  const supervisor = selectedStat.supervisor;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const allVisits = (state.supervisorVisits || []).filter((visit) => visit.supervisor === supervisor.name);
  const monthVisits = allVisits.filter((visit) => {
    const date = new Date(`${visit.date}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  });
  const visitedSchoolSet = new Set(monthVisits.map((visit) => visit.school));
  const pendingSchools = selectedStat.assignedSchools.filter((school) => !visitedSchoolSet.has(school));
  const monthlyGoal = Number(supervisor.monthlyGoal || selectedStat.assignedSchools.length || 1);
  const monthlyVisitCount = monthVisits.length;
  const goalPct = Math.min(100, Math.round((monthlyVisitCount / monthlyGoal) * 100));
  const goalMet = monthlyVisitCount >= monthlyGoal;

  if (select) {
    select.innerHTML = stats.map((item) => `<option value="${esc(item.supervisor.name)}">${esc(item.supervisor.name)}</option>`).join('');
    select.value = supervisor.name;
  }

  const title = document.getElementById('supervisorRecordTitle');
  const subtitle = document.getElementById('supervisorRecordSubtitle');
  if (title) title.textContent = supervisor.name;
  if (subtitle) subtitle.textContent = `${selectedStat.assignedSchools.length} escola(s) | ${monthlyVisitCount}/${monthlyGoal} visita(s) no mes | ${goalMet ? 'meta cumprida' : 'meta pendente'}.`;
  const refreshButton = document.getElementById('refreshSupervisorSheetBtn');
  if (refreshButton) {
    refreshButton.hidden = !supervisor.visitSourceUrl;
    refreshButton.disabled = false;
    refreshButton.textContent = 'Atualizar planilha';
  }

  profileHost.innerHTML = `
    <div class="setechub-item">
      <div class="setechub-head">
        <div>
          <strong>${esc(supervisor.name)}</strong>
          <div class="sync-meta">${esc(supervisor.email || '')} | ${esc(supervisor.phone || '')}</div>
          <div class="sync-meta">${esc(supervisor.visitSourceUrl ? `${supervisor.visitSourceLabel || 'Planilha Google'} como fonte principal.` : supervisor.source === 'teste' ? 'Distribuicao teste ate chegada do CSV oficial.' : 'Distribuicao oficial.')}</div>
          ${supervisor.sourceSyncedAt ? `<div class="sync-meta">Ultima leitura online: ${esc(timestampLabel(new Date(supervisor.sourceSyncedAt)))}</div>` : ''}
        </div>
        <span class="diag-pill ${goalMet ? 'pill-ok' : 'pill-warn'}">${goalMet ? 'Meta cumprida' : 'Meta pendente'}</span>
      </div>
      ${supervisor.visitSourceUrl ? `<div class="mini-actions"><a class="btn btn-g btn-sm" href="${esc(supervisor.visitSourceUrl)}" target="_blank" rel="noreferrer">Abrir planilha principal</a><button class="btn btn-p btn-sm" type="button" onclick="syncCurrentSupervisorVisitSource()">Atualizar planilha</button></div>` : ''}
    </div>
  `;

  document.getElementById('supervisorRecordGoal').innerHTML = `
    <div class="setechub-command-score supervisor-goal-score">
      <div>
        <div class="sync-meta">Meta mensal</div>
        <strong>${esc(String(monthlyVisitCount))}/${esc(String(monthlyGoal))}</strong>
      </div>
      <span class="diag-pill ${goalMet ? 'pill-ok' : 'pill-warn'}">${esc(String(goalPct))}%</span>
    </div>
    <div class="setechub-bar"><span style="width:${esc(String(Math.max(4, goalPct)))}%"></span></div>
    <div class="sync-meta">${goalMet ? 'Meta de visitas cumprida no mes atual.' : `Faltam ${esc(String(Math.max(0, monthlyGoal - monthlyVisitCount)))} visita(s) para cumprir a meta.`}</div>
  `;

  document.getElementById('supervisorRecordMetrics').innerHTML = [
    { label: 'Escolas', value: String(selectedStat.assignedSchools.length), note: 'vinculadas ao supervisor' },
    { label: 'Visitadas', value: String(visitedSchoolSet.size), note: 'com visita no mes' },
    { label: 'Faltantes', value: String(pendingSchools.length), note: 'sem visita no mes' },
    { label: 'Chamados', value: String(selectedStat.openCalls), note: 'ativos nas escolas vinculadas' },
    { label: 'Alertas', value: String(selectedStat.alerts), note: 'inventario em atencao' },
    { label: 'Historico', value: String(allVisits.length), note: 'visitas totais registradas' }
  ].map((item) => `
    <div class="setechub-monitor-card compact">
      <div class="sync-meta">${esc(item.label)}</div>
      <strong>${esc(item.value)}</strong>
      <div class="diag-pill">${esc(item.note)}</div>
    </div>
  `).join('');

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();
  const visitsByDay = monthVisits.reduce((acc, visit) => {
    const day = new Date(`${visit.date}T00:00:00`).getDate();
    if (!acc[day]) acc[day] = [];
    acc[day].push(visit);
    return acc;
  }, {});
  const blanks = Array.from({ length: firstWeekday }, () => '<div class="supervisor-calendar-day empty"></div>');
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const dayVisits = visitsByDay[day] || [];
    return `
      <div class="supervisor-calendar-day ${dayVisits.length ? 'has-visit' : ''}">
        <strong>${esc(String(day))}</strong>
        <span>${dayVisits.length ? `${esc(String(dayVisits.length))} visita(s)` : ''}</span>
      </div>
    `;
  });
  document.getElementById('supervisorRecordCalendarGrid').innerHTML = [
    '<div class="supervisor-calendar-week">Dom</div><div class="supervisor-calendar-week">Seg</div><div class="supervisor-calendar-week">Ter</div><div class="supervisor-calendar-week">Qua</div><div class="supervisor-calendar-week">Qui</div><div class="supervisor-calendar-week">Sex</div><div class="supervisor-calendar-week">Sab</div>',
    ...blanks,
    ...days
  ].join('');

  const visitedSchools = selectedStat.assignedSchools.filter((school) => visitedSchoolSet.has(school));
  document.getElementById('supervisorRecordVisitedSchools').innerHTML = visitedSchools.map((school) => {
    const schoolVisits = monthVisits.filter((visit) => visit.school === school);
    const lastVisit = schoolVisits.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    return `
      <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')">
        <div class="setechub-head">
          <div>
            <strong>${esc(school)}</strong>
            <div class="sync-meta">${esc(String(schoolVisits.length))} visita(s) | ultima em ${esc(lastVisit?.date || '--')}</div>
          </div>
          <span class="diag-pill pill-ok">Visitada</span>
        </div>
      </div>
    `;
  }).join('') || '<div class="sync-empty">Nenhuma escola visitada no mes atual.</div>';

  document.getElementById('supervisorRecordPendingSchools').innerHTML = pendingSchools.map((school) => `
    <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')">
      <div class="setechub-head">
        <div>
          <strong>${esc(school)}</strong>
          <div class="sync-meta">Ainda sem visita registrada no mes atual.</div>
        </div>
        <span class="diag-pill pill-warn">Pendente</span>
      </div>
    </div>
  `).join('') || '<div class="sync-empty">Todas as escolas vinculadas possuem visita no mes.</div>';

  document.getElementById('supervisorRecordSchoolMatrix').innerHTML = `
    <article class="supervisor-card">
      <div class="supervisor-school-list">
        ${selectedStat.assignedSchools.map((schoolName) => {
          const signal = schoolByName(schoolName) ? schoolOperationalSnapshot(schoolByName(schoolName)) : null;
          const wasVisited = visitedSchoolSet.has(schoolName);
          return `
            <button class="supervisor-school-row" type="button" onclick="openSchoolRecord('${esc(schoolName)}')">
              <span>${esc(schoolName)}</span>
              <strong>${wasVisited ? 'visitada' : `${esc(String(signal?.alertUnits || 0))} alertas`}</strong>
            </button>
          `;
        }).join('')}
      </div>
    </article>
  `;

  const recordSchoolSelect = document.getElementById('recordVisitSchoolSelect');
  if (recordSchoolSelect) {
    recordSchoolSelect.innerHTML = selectedStat.assignedSchools.map((school) => `<option value="${esc(school)}">${esc(school)}</option>`).join('');
  }
  const recordDate = document.getElementById('recordVisitDate');
  if (recordDate && !recordDate.value) recordDate.value = new Date().toISOString().slice(0, 10);

  document.getElementById('supervisorRecordVisitsTable').innerHTML = allVisits.length ? `
    <table class="setechub-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Escola</th>
          <th>Tipo</th>
          <th>Observacao</th>
        </tr>
      </thead>
      <tbody>
        ${allVisits.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((visit) => `
          <tr>
            <td>${esc(visit.date || '--')}</td>
            <td><button class="link-button" type="button" onclick="openSchoolRecord('${esc(visit.school)}')">${esc(visit.school)}</button></td>
            <td><span class="diag-pill">${esc(visit.type || 'Visita')}</span></td>
            <td>${esc(visit.notes || '')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<div class="sync-empty">Nenhuma visita registrada para este supervisor.</div>';
}

function renderOfficialData() {
  const list = document.getElementById('officialList');
  const adminActions = canManageUsers();
  list.innerHTML = state.officialLinks.slice(0, 6).map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>${esc(item.label)}</strong>
      </div>
      <div class="sync-meta"><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.url)}</a></div>
    </div>
  `).join('');
  document.getElementById('officialLinksList').innerHTML = state.officialLinks.map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <div>
          <strong>${esc(item.label)}</strong>
          <div class="sync-meta"><a href="${esc(item.url)}" target="_blank" rel="noreferrer">${esc(item.url)}</a></div>
        </div>
        ${adminActions ? `<button class="btn btn-d btn-sm" onclick="removeOfficialLink(${item.id})">Remover</button>` : ''}
      </div>
    </div>
  `).join('');
  const office = document.getElementById('officeContact');
  if (office) {
    office.innerHTML = `
      <div class="setechub-item">
        <div class="setechub-head">
          <strong>${esc(state.officialContacts.officeName || 'URE Itapeva')}</strong>
          <span class="diag-pill pill-info">Dirigente</span>
        </div>
        <div class="sync-meta">${esc(state.officialContacts.dirigente || '')}${state.officialContacts.since ? ` | desde ${esc(state.officialContacts.since)}` : ''}</div>
      </div>
      <div class="setechub-item">
        <strong>Contato principal</strong>
        <div class="sync-meta">${esc(state.officialContacts.address || '')}</div>
        <div class="sync-meta">${esc(state.officialContacts.phone || '')} | ${esc(state.officialContacts.email || '')}</div>
      </div>
    `;
  }
  const officeInput = document.getElementById('officeContactInput');
  if (officeInput) officeInput.value = state.officialContacts.office;
}

function renderTasks(filtered) {
  const list = document.getElementById('taskList');
  const source = filtered || filteredTasks();
  const sorted = source.slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  list.innerHTML = sorted.map((task) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <div>
          <strong class="${task.done ? 'is-done' : ''}">${esc(task.title)}</strong>
          <div class="sync-meta">${esc(task.time || 'Sem horario')} | ${esc(task.place)} | ${esc(task.category)}</div>
        </div>
        <div class="setechub-badges">
          <span class="diag-pill ${toneByPriority(task.priority)}">${esc(badgeText(task.priority))}</span>
          <button class="btn btn-g btn-sm" onclick="toggleTask(${task.id})">${task.done ? 'Reabrir' : 'Concluir'}</button>
          <button class="btn btn-d btn-sm" onclick="removeTask(${task.id})">Remover</button>
        </div>
      </div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma tarefa encontrada. Use a agenda para transformar escolas e chamados em acoes reais.</div>';
}

function renderCalls() {
  const columns = [
    { key: 'aberto', title: 'Abertos' },
    { key: 'em_rota', title: 'Em rota' },
    { key: 'resolvido', title: 'Resolvidos' }
  ];
  document.getElementById('callColumns').innerHTML = columns.map((column) => `
    <div class="bg-card setechub-column">
      <div class="ct">${column.title}</div>
      <div class="stack-list">
        ${filteredCalls().filter((item) => item.status === column.key).map((item) => `
          <div class="setechub-item">
            <div class="setechub-head">
              <div>
                <strong>${esc(item.title)}</strong>
                <div class="sync-meta">${esc(item.school)}</div>
              </div>
              <span class="diag-pill ${toneByCall(item.status)}">${esc(badgeText(item.status))}</span>
            </div>
            <div class="setechub-action-row left">
              <button class="btn btn-g btn-sm" onclick="advanceCall(${item.id})">Avancar</button>
              <button class="btn btn-d btn-sm" onclick="removeCall(${item.id})">Remover</button>
            </div>
          </div>
        `).join('') || '<div class="sync-empty">Sem itens nesta etapa.</div>'}
      </div>
    </div>
  `).join('');
}

function renderCallHistory() {
  document.getElementById('callHistoryList').innerHTML = state.histories.calls.map((item) => `
    <div class="setechub-item">
      <strong>${esc(item.text)}</strong>
      <div class="sync-meta">${esc(item.when)}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma movimentacao ainda.</div>';
}

function renderSchools() {
  renderSchoolCommandCenter();
  const zoneSelect = document.getElementById('schoolZoneFilterSelect');
  const sortSelect = document.getElementById('schoolSortSelect');
  const searchInput = document.getElementById('schoolMasterSearch');
  if (zoneSelect) {
    const selected = currentSchoolZoneFilter;
    const zones = ['todas', ...state.municipalities.map((item) => item.name)];
    zoneSelect.innerHTML = zones
      .filter((value, index, array) => array.indexOf(value) === index)
      .map((zone) => `<option value="${esc(zone)}">${zone === 'todas' ? 'Todos os municipios' : esc(zone)}</option>`)
      .join('');
    zoneSelect.value = selected;
  }
  if (sortSelect) sortSelect.value = currentSchoolSort;
  if (searchInput && searchInput.value !== currentSchoolSearch) searchInput.value = currentSchoolSearch;
  const schools = sortSchoolsByCurrentView(filteredSchools());
  const groups = schools.reduce((acc, school) => {
    if (!acc[school.zone]) acc[school.zone] = [];
    acc[school.zone].push(school);
    return acc;
  }, {});
  const schoolList = document.getElementById('schoolList');
  if (schoolList) schoolList.innerHTML = Object.keys(groups).length ? Object.entries(groups).map(([zone, items]) => `
    <div class="setechub-group">
      <div class="setechub-group-head">
        <strong>${esc(zone)}</strong>
        <span class="diag-pill">${esc(String(items.length))} escolas</span>
      </div>
      <div class="stack-list">
        ${items.map((school) => `
          <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school.name)}')">
            <div class="setechub-head">
              <div>
                <strong>${esc(school.name)}</strong>
                <div class="sync-meta">CIE ${esc(school.cie || '--')} | ${esc(school.notes)}</div>
                <div class="setechub-inline-meta">
                  <span class="diag-pill">${esc(String(schoolImportCount(school.name)))} import.</span>
                  <span class="diag-pill">${esc(String(schoolAssetTotals(school.name).units))} equip.</span>
                  <span class="diag-pill">${esc(String(schoolProfileCompletion(school.name)))}% ficha</span>
                  <span class="diag-pill ${schoolAlertUnits(school.name) ? 'pill-danger' : 'pill-ok'}">${esc(String(schoolAlertUnits(school.name)))} alertas</span>
                  ${schoolNetworkRecord(school.name) ? `<span class="diag-pill ${schoolNetworkRecord(school.name).status === 'defeito' ? 'pill-danger' : schoolNetworkRecord(school.name).status === 'manutencao' ? 'pill-warn' : 'pill-info'}">rede ${esc(badgeText(schoolNetworkRecord(school.name).status))}</span>` : ''}
                </div>
              </div>
              <div class="setechub-badges">
                ${school.fixedName ? '<span class="diag-pill">Oficial</span>' : ''}
                <span class="diag-pill ${toneBySchool(school.status)}">${esc(badgeText(school.status))}</span>
              </div>
            </div>
            <div class="setechub-action-row left">
              <button class="btn btn-g btn-sm" onclick="event.stopPropagation(); cycleSchool(${school.id})">Mudar status</button>
              <button class="btn btn-p btn-sm" onclick="event.stopPropagation(); createTaskFromSchool(${school.id})">Criar tarefa</button>
              <button class="btn btn-g btn-sm" onclick="event.stopPropagation(); openSchoolRecord('${esc(school.name)}')">Abrir ficha</button>
              ${school.fixedName ? '' : `<button class="btn btn-d btn-sm" onclick="event.stopPropagation(); removeSchool(${school.id})">Remover</button>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('') : '<div class="sync-empty">Nenhuma escola encontrada neste filtro.</div>';
  const options = document.getElementById('officialSchoolOptions');
  if (options) {
    options.innerHTML = visibleSchools()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => `<option value="${esc(school.name)}"></option>`)
      .join('');
  }
  renderSchoolImports();
}

function renderAssets() {
  renderInventoryWorkspace();
  const assetList = document.getElementById('assetList');
  if (assetList) {
    assetList.innerHTML = filteredAssets()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name) || a.status.localeCompare(b.status))
      .map((asset) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(asset.name)}</strong>
            <div class="sync-meta">${esc(asset.place)}</div>
          </div>
          <span class="diag-pill ${toneByAsset(asset.status)}">${esc(badgeText(asset.status))}</span>
        </div>
        <div class="setechub-action-row left">
          <button class="btn btn-g btn-sm" onclick="cycleAsset(${asset.id})">Atualizar status</button>
          <button class="btn btn-d btn-sm" onclick="removeAsset(${asset.id})">Remover</button>
        </div>
      </div>
    `).join('') || '<div class="sync-empty">Nenhum ativo geral encontrado neste filtro.</div>';
  }
  const schoolSelect = document.getElementById('schoolAssetSchool');
  const bulkSchoolSelect = document.getElementById('schoolAssetBulkSchool');
  if (schoolSelect) {
    const selected = schoolSelect.value;
    schoolSelect.innerHTML = visibleSchools()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`)
      .join('');
    if (selected) schoolSelect.value = selected;
  }
  if (bulkSchoolSelect) {
    const selected = bulkSchoolSelect.value;
    bulkSchoolSelect.innerHTML = visibleSchools()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`)
      .join('');
    if (selected) bulkSchoolSelect.value = selected;
  }
  const grouped = state.schoolAssets.reduce((acc, item) => {
    if (!acc[item.school]) acc[item.school] = [];
    acc[item.school].push(item);
    return acc;
  }, {});
  const schoolAssetList = document.getElementById('schoolAssetList');
  if (schoolAssetList) {
    const filteredRows = aggregateInventoryItems(filteredSchoolAssets());
    const groupedRows = filteredRows.reduce((acc, item) => {
      if (!acc[item.school]) acc[item.school] = [];
      acc[item.school].push(item);
      return acc;
    }, {});
    schoolAssetList.innerHTML = Object.keys(groupedRows).length ? Object.entries(groupedRows)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([school, items]) => `
        <div class="setechub-group">
          <div class="setechub-group-head">
            <strong>${esc(school)}</strong>
            <span class="diag-pill">${esc(String(items.reduce((sum, item) => sum + item.units, 0)))} unidades</span>
          </div>
          <div class="stack-list">
            ${items.map((asset) => `
              <div class="setechub-item setechub-clickable" onclick="openSchoolRecord('${esc(school)}')">
                <div class="setechub-head">
                  <div>
                    <strong>${esc(asset.name)}</strong>
                    <div class="sync-meta">CIE ${esc(schoolByName(school)?.cie || '--')} | ${esc(asset.notePreview || 'Sem observacao')}</div>
                    <div class="setechub-inline-meta">
                      <span class="diag-pill">${esc(String(asset.units))} unid.</span>
                      <span class="diag-pill">${esc(badgeText(asset.category))}</span>
                      <span class="diag-pill ${asset.alertUnits ? 'pill-danger' : 'pill-ok'}">${esc(String(asset.alertUnits))} alertas</span>
                    </div>
                  </div>
                  <div class="setechub-badges">
                    <span class="diag-pill ${toneByAsset(asset.statusLabel)}">${esc(badgeText(asset.statusLabel))}</span>
                    <button class="btn btn-p btn-sm" onclick="event.stopPropagation(); openSchoolRecord('${esc(school)}')">Abrir ficha</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')
      : '<div class="sync-empty">Nenhum equipamento vinculado a escolas neste filtro.</div>';
  }
  renderAssetMonitoring();
}

function schoolAssetUnits(asset) {
  const notes = String(asset.notes || '');
  const unitMatch = notes.match(/(\d+)\s+unidade/i);
  if (unitMatch) return Number(unitMatch[1]);
  const countMatch = notes.match(/(^|\D)(\d{1,4})(?=\D|$)/);
  if (countMatch) return Number(countMatch[2]);
  return 1;
}

function renderAssetMonitoring() {
  const cards = document.getElementById('assetMonitorCards');
  const comparison = document.getElementById('assetComparisonTable');
  const typeTable = document.getElementById('assetTypeTable');
  if (!cards || !comparison || !typeTable) return;

  const schoolAssets = state.schoolAssets || [];
  const totalGeneral = state.assets.length;
  const totalSchoolLines = schoolAssets.length;
  const totalUnits = schoolAssets.reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const alertLines = schoolAssets.filter((item) => item.status !== 'ok').length + state.assets.filter((item) => item.status !== 'ok').length;
  const defectiveLines = schoolAssets.filter((item) => item.status === 'defeito').length;

  cards.innerHTML = [
    { label: 'Inventario geral', value: String(totalGeneral), note: 'linhas consolidadas da regional', tone: '' },
    { label: 'Itens por escola', value: String(totalSchoolLines), note: `${totalUnits} unidades aproximadas`, tone: '' },
    { label: 'Alertas ativos', value: String(alertLines), note: 'manutencao ou defeito', tone: 'pill-warn' },
    { label: 'Criticos', value: String(defectiveLines), note: 'equipamentos com defeito', tone: 'pill-danger' }
  ].map((item) => `
    <div class="setechub-monitor-card">
      <div class="sync-meta">${esc(item.label)}</div>
      <strong>${esc(item.value)}</strong>
      <div class="diag-pill ${item.tone}">${esc(item.note)}</div>
    </div>
  `).join('');

  const bySchool = schoolAssets.reduce((acc, item) => {
    if (!acc[item.school]) {
      acc[item.school] = { school: item.school, totalLines: 0, totalUnits: 0, ok: 0, alert: 0, defect: 0 };
    }
    const bucket = acc[item.school];
    const units = schoolAssetUnits(item);
    bucket.totalLines += 1;
    bucket.totalUnits += units;
    if (item.status === 'defeito') bucket.defect += units;
    if (item.status !== 'ok') bucket.alert += units;
    if (item.status === 'ok') bucket.ok += units;
    return acc;
  }, {});

  const schoolRows = Object.values(bySchool)
    .sort((a, b) => b.totalUnits - a.totalUnits || b.alert - a.alert || a.school.localeCompare(b.school));
  const maxSchoolUnits = Math.max(...schoolRows.map((item) => item.totalUnits), 1);

  comparison.innerHTML = schoolRows.length ? `
    <table class="setechub-table">
      <thead>
        <tr>
          <th>Escola</th>
          <th>Total</th>
          <th>Alertas</th>
          <th>Criticos</th>
          <th>Peso</th>
        </tr>
      </thead>
      <tbody>
        ${schoolRows.map((item) => `
          <tr>
            <td><strong>${esc(item.school)}</strong><div class="sync-meta">${esc(String(item.totalLines))} tipos</div></td>
            <td>${esc(String(item.totalUnits))}</td>
            <td>${esc(String(item.alert))}</td>
            <td>${esc(String(item.defect))}</td>
            <td>
              <div class="setechub-bar"><span style="width:${Math.max(4, Math.round((item.totalUnits / maxSchoolUnits) * 100))}%"></span></div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<div class="sync-empty">Sem dados por escola para comparar.</div>';

  const byType = schoolAssets.reduce((acc, item) => {
    if (!acc[item.name]) {
      acc[item.name] = { name: item.name, totalUnits: 0, alert: 0, schools: new Set() };
    }
    const bucket = acc[item.name];
    const units = schoolAssetUnits(item);
    bucket.totalUnits += units;
    if (item.status !== 'ok') bucket.alert += units;
    bucket.schools.add(item.school);
    return acc;
  }, {});
  const typeRows = Object.values(byType)
    .sort((a, b) => b.totalUnits - a.totalUnits || a.name.localeCompare(b.name))
    .slice(0, 12);
  const maxTypeUnits = Math.max(...typeRows.map((item) => item.totalUnits), 1);

  typeTable.innerHTML = typeRows.length ? `
    <table class="setechub-table">
      <thead>
        <tr>
          <th>Equipamento</th>
          <th>Unidades</th>
          <th>Alertas</th>
          <th>Escolas</th>
          <th>Volume</th>
        </tr>
      </thead>
      <tbody>
        ${typeRows.map((item) => `
          <tr>
            <td><strong>${esc(item.name)}</strong></td>
            <td>${esc(String(item.totalUnits))}</td>
            <td>${esc(String(item.alert))}</td>
            <td>${esc(String(item.schools.size))}</td>
            <td>
              <div class="setechub-bar"><span style="width:${Math.max(4, Math.round((item.totalUnits / maxTypeUnits) * 100))}%"></span></div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '<div class="sync-empty">Sem tipos de equipamento para comparar.</div>';
}

function renderReports() {
  const done = state.tasks.filter((item) => item.done).length;
  const total = state.tasks.length || 1;
  document.getElementById('reportTasks').textContent = state.tasks.length;
  document.getElementById('reportCalls').textContent = state.calls.filter((item) => item.status !== 'resolvido').length;
  document.getElementById('reportCriticalSchools').textContent = visibleSchools().filter((item) => item.status !== 'estavel').length;
  document.getElementById('reportAssets').textContent = state.assets.filter((item) => item.status !== 'ok').length + state.schoolAssets.filter((item) => item.status !== 'ok').length;
  document.getElementById('taskProgressBar').style.width = `${Math.round((done / total) * 100)}%`;
  document.getElementById('reportSummaryPreview').textContent = buildSummaryPreview();
  renderVisitHistory();
  renderNotes();
  renderRedeAutomation();
}

function renderDiagnostics() {
  const orphaned = orphanedReferenceSummary();
  const duplicateCies = duplicateSchoolCies();
  const diagnostics = [
    { label: 'Pagina atual', value: currentPage },
    { label: 'Schema do estado', value: `v${state.stateVersion || 1}` },
    { label: 'Ultima atualizacao', value: state.lastUpdatedAt ? timestampLabel(new Date(state.lastUpdatedAt)) : 'Nao registrada' },
    { label: 'Storage principal', value: localStorage.getItem(STORAGE_KEY) ? 'Disponivel' : 'Vazio' },
    { label: 'Prototipo antigo', value: localStorage.getItem(LEGACY_STORAGE_KEY) ? 'Encontrado' : 'Nao encontrado' },
    { label: 'Sessao local', value: sessionStorage.getItem(SESSION_KEY) === 'ok' ? 'Desbloqueada' : 'Bloqueada' },
    { label: 'Servidor local', value: serverStatus.message },
    { label: 'Supabase', value: supabaseStatus.message },
    { label: 'Snapshots no servidor', value: String(serverSnapshots.length) },
    { label: 'Cobertura de importacao', value: `${operationalCoverage().importCoverage}%` },
    { label: 'Tarefas abertas', value: String(state.tasks.filter((item) => !item.done).length) },
    { label: 'Chamados ativos', value: String(state.calls.filter((item) => item.status !== 'resolvido').length) },
    { label: 'CIE duplicado', value: duplicateCies.length ? duplicateCies.map((item) => item.cie).join(', ') : 'Nenhum' },
    { label: 'Referencias orfas', value: Object.values(orphaned).reduce((sum, value) => sum + value, 0) ? JSON.stringify(orphaned) : 'Nenhuma' }
  ];
  document.getElementById('diagnosticList').innerHTML = diagnostics.map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>${esc(item.label)}</strong>
        <span class="diag-pill">${esc(item.value)}</span>
      </div>
    </div>
  `).join('');
  document.getElementById('legacyStateMeta').textContent = localStorage.getItem(LEGACY_STORAGE_KEY)
    ? 'Foi encontrado um estado salvo do setec_daily_app neste navegador.'
    : 'Nenhum estado legado encontrado no navegador atual.';
  const serverMeta = document.getElementById('serverHealthMeta');
  if (serverMeta) serverMeta.textContent = serverStatus.message;
  updateSupabaseStatus(supabaseStatus.message, supabaseStatus.configured);
  const snapshotList = document.getElementById('snapshotList');
  if (snapshotList) {
    snapshotList.innerHTML = serverSnapshots.length ? serverSnapshots.map((item) => `
      <div class="setechub-item">
        <div class="setechub-head">
          <div>
            <strong>${esc(item.label || item.id)}</strong>
            <div class="sync-meta">${esc(item.savedAt || item.createdAt || '')}</div>
          </div>
          <div class="setechub-badges">
            <button class="btn btn-g btn-sm" onclick="restoreServerSnapshot('${esc(item.id)}')">Restaurar</button>
          </div>
        </div>
      </div>
    `).join('') : '<div class="sync-empty">Nenhum snapshot salvo no servidor local.</div>';
  }
}

function renderUsers() {
  const list = document.getElementById('userList');
  if (!list) return;
  const supervisorSelect = document.getElementById('userSupervisorName');
  if (supervisorSelect) {
    supervisorSelect.innerHTML = '<option value="">Sem vinculo</option>' + (state.supervisors || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => `<option value="${esc(item.name)}">${esc(item.name)}</option>`)
      .join('');
  }
  const users = isPecUser()
    ? (state.users || []).filter((user) => {
      if (user.role !== 'pec') return false;
      if (isPecLeadUser()) return true;
      return normalizeKey(user.id) === normalizeKey(currentUser()?.id);
    })
    : (state.users || []);
  list.innerHTML = users.map((user) => `
    <div class="admin-user-row">
      <div class="admin-user-main">
        <strong>${esc(user.name)}</strong>
        <div class="sync-meta">${esc(user.login || user.name)} | ${esc(ROLE_LABELS[user.role] || badgeText(user.role))}${user.supervisorName ? ` | ${esc(user.supervisorName)}` : ''}</div>
      </div>
      <div class="admin-user-actions">
        <span class="diag-pill ${user.active === false ? 'pill-warn' : 'pill-ok'}">${user.active === false ? 'Inativo' : 'Ativo'}</span>
        <button class="btn btn-g btn-sm" type="button" onclick="toggleUserActive('${esc(user.id)}')">${user.active === false ? 'Ativar' : 'Bloquear'}</button>
      </div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhum usuario cadastrado.</div>';
}

function renderVisitHistory() {
  document.getElementById('visitHistoryList').innerHTML = state.histories.visits.map((item) => `
    <div class="setechub-item">
      <strong>${esc(item.text)}</strong>
      <div class="sync-meta">${esc(item.when)}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma visita registrada ainda.</div>';
}

function renderNotes() {
  document.getElementById('noteList').innerHTML = state.notes.map((note) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>${esc(note.title)}</strong>
        <button class="btn btn-d btn-sm" onclick="removeNote(${note.id})">Remover</button>
      </div>
      <div class="sync-meta">${esc(note.body)}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma nota salva.</div>';
}

function escapePowerShell(value) {
  return String(value || '').replace(/'/g, "''");
}

function parseRedeFilename(filename, fallbackYearSuffix) {
  const match = filename.match(/rede\s*n[oº°]?\s*(\d+)(?:\s*\/\s*(\d{2,4}))?.*?data[:\s]*([0-3]\d\/[01]\d\/\d{4})/i);
  if (!match) {
    return {
      originalName: filename,
      valid: false,
      reason: 'Nome fora do padrao esperado.'
    };
  }
  const sequence = match[1];
  const yearSuffix = match[2] || fallbackYearSuffix || '';
  const date = match[3];
  return {
    originalName: filename,
    valid: true,
    sequence,
    yearSuffix,
    date,
    networkNumber: yearSuffix ? `${sequence}/${yearSuffix}` : sequence,
    renamedBase: sequence
  };
}

function buildRedeCommand() {
  const folderPath = state.redes.folderPath.trim();
  if (!folderPath) return 'Preencha o caminho da pasta para montar o comando do PowerShell.';
  return [
    'powershell -ExecutionPolicy Bypass -File .\\tools\\processar_redes.ps1',
    `-SourceFolder '${escapePowerShell(folderPath)}'`,
    `-YearSuffix '${escapePowerShell(state.redes.yearSuffix)}'`,
    `-NumberPlaceholder '${escapePowerShell(state.redes.numberPlaceholder)}'`,
    `-DatePlaceholder '${escapePowerShell(state.redes.datePlaceholder)}'`,
    `-HeadingPlaceholder '${escapePowerShell(state.redes.headingPlaceholder)}'`,
    `-AssuntoLabel '${escapePowerShell(state.redes.assuntoLabel)}'`
  ].join(' ');
}

function renderRedePreview() {
  const list = document.getElementById('redePreviewList');
  list.innerHTML = redePreview.map((item) => `
    <div class="setechub-item">
      <div class="setechub-head">
        <strong>${esc(item.valid ? `${item.renamedBase}${item.extension || ''} | Rede ${item.networkNumber}` : item.originalName)}</strong>
        <span class="diag-pill ${item.valid ? 'pill-ok' : 'pill-warn'}">${item.valid ? esc(item.date) : 'Revisar'}</span>
      </div>
      <div class="sync-meta">${esc(item.valid ? `Original: ${item.originalName}` : item.reason)}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhuma pasta analisada ainda.</div>';
}

function renderRedeAutomation() {
  document.getElementById('redeFolderPath').value = state.redes.folderPath;
  document.getElementById('redeYearSuffix').value = state.redes.yearSuffix;
  document.getElementById('redeNumberPlaceholder').value = state.redes.numberPlaceholder;
  document.getElementById('redeDatePlaceholder').value = state.redes.datePlaceholder;
  document.getElementById('redeHeadingPlaceholder').value = state.redes.headingPlaceholder;
  document.getElementById('redeAssuntoLabel').value = state.redes.assuntoLabel;
  document.getElementById('redeCommand').value = buildRedeCommand();
  renderRedePreview();
}
