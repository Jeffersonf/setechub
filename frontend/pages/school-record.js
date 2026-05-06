'use strict';

let schoolRecordDeferredTimer = null;
let schoolRecordDeferredType = '';

function scheduleSchoolRecordDeferredRender(work) {
  if (schoolRecordDeferredTimer && schoolRecordDeferredType === 'idle') cancelIdleCallback(schoolRecordDeferredTimer);
  if (schoolRecordDeferredTimer && schoolRecordDeferredType === 'timeout') clearTimeout(schoolRecordDeferredTimer);
  const run = () => {
    schoolRecordDeferredTimer = null;
    schoolRecordDeferredType = '';
    work();
  };
  if ('requestIdleCallback' in window) {
    schoolRecordDeferredType = 'idle';
    schoolRecordDeferredTimer = requestIdleCallback(run, { timeout: 900 });
  } else {
    schoolRecordDeferredType = 'timeout';
    schoolRecordDeferredTimer = setTimeout(run, 80);
  }
}

function schoolRecordContext() {
  const sortedSchools = visibleSchools().slice().sort((a, b) => a.name.localeCompare(b.name));
  const schoolNames = sortedSchools.map((item) => item.name);
  if (!currentSchoolDetail || !schoolNames.includes(currentSchoolDetail)) {
    currentSchoolDetail = schoolNames[0] || '';
  }
  const school = visibleSchools().find((item) => item.name === currentSchoolDetail);
  return { sortedSchools, school };
}

function renderSchoolRecordSelect(sortedSchools) {
  const select = document.getElementById('schoolDetailSelect');
  if (!select) return;
  select.innerHTML = sortedSchools.map((item) => `<option value="${esc(item.name)}">${esc(item.name)} | CIE ${esc(item.cie || '--')}</option>`).join('');
  select.value = currentSchoolDetail;
}

function setSchoolProfileForm(profile) {
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

function renderSchoolDetailHeader(ctx) {
  const { school, displayNotes, network, responsibleSupervisorText, situationLabel, situationTone } = ctx;
  document.getElementById('schoolDetailHeader').innerHTML = school ? `
    <div class="school-record-hero-main">
      ${schoolAvatarMarkup(school, 'school-record-avatar')}
      <div class="school-record-title-block">
        <div class="dashboard-command-kicker">Ficha da escola</div>
        <h1>${esc(school.name)}</h1>
        <p>${esc(school.zone)} | CIE ${esc(school.cie || network?.cie || '--')}${displayNotes ? ` | ${esc(displayNotes)}` : ''}</p>
        <div class="school-record-chip-row">
          ${school.fixedName ? '<span class="diag-pill">Oficial</span>' : ''}
          <span class="diag-pill ${situationTone}">${esc(situationLabel)}</span>
          <span class="diag-pill">${esc(responsibleSupervisorText)}</span>
          <span class="diag-pill">Inventario atualizado ${esc(inventoryUpdatedLabelForSchool(currentSchoolDetail))}</span>
        </div>
      </div>
      <div class="school-record-hero-actions">
        <button class="btn btn-p btn-sm" type="button" onclick="setInventorySchool('${esc(school.name)}')">Inventario</button>
        <button class="btn btn-g btn-sm" type="button" onclick="openSchoolCalls('${esc(school.name)}')">Chamados</button>
      </div>
    </div>
  ` : '<div class="sync-empty">Nenhuma escola selecionada.</div>';
}

function renderSchoolDetailCore(ctx) {
  const { school, profile, network, responsibleSupervisorText, totalUnits, alertUnits, defectUnits, completion, openCalls, plannedTasks } = ctx;
  const pageTitle = document.getElementById('schoolRecordTitle');
  const pageSubtitle = document.getElementById('schoolRecordSubtitle');
  if (pageTitle) pageTitle.textContent = school ? school.name : 'Pagina da escola';
  if (pageSubtitle) {
    pageSubtitle.textContent = school
      ? `${school.zone} | CIE ${school.cie || network?.cie || '--'} | dados principais e resumos operacionais.`
      : 'Dados principais da unidade, com resumos do inventario, rede e historico.';
  }

  document.getElementById('schoolDetailMetrics').innerHTML = [
    { label: 'Inventario', value: String(totalUnits), note: alertUnits ? `${alertUnits} em alerta` : 'sem alerta' },
    { label: 'Manut./defeito', value: String(alertUnits), note: defectUnits ? `${defectUnits} com defeito` : 'sem defeito' },
    { label: 'Cameras', value: network?.cameraInstalled ? `${network.cameraWorking || 0}/${network.cameraInstalled}` : '--', note: network ? badgeText(network.status) : 'sem rede' },
    { label: 'Chamados', value: String(openCalls.length), note: plannedTasks.length ? `${plannedTasks.length} tarefa(s)` : 'sem tarefa' }
  ].map((item) => `
    <div class="school-record-metric">
      <span>${esc(item.label)}</span>
      <strong>${esc(item.value)}</strong>
      <small>${esc(item.note)}</small>
    </div>
  `).join('');

  document.getElementById('schoolDetailExecutive').innerHTML = `
    <div class="school-record-info-list">
      <div class="school-record-info-row"><span>Municipio</span><strong>${esc(school.zone)}</strong></div>
      <div class="school-record-info-row"><span>Codigo CIE</span><strong>${esc(school.cie || network?.cie || '--')}</strong></div>
      <div class="school-record-info-row"><span>Status</span><strong>${esc(badgeText(school.status))}</strong></div>
      <div class="school-record-info-row"><span>Supervisao</span><strong>${esc(responsibleSupervisorText)}</strong></div>
      <div class="school-record-info-row"><span>Ficha</span><strong>${esc(String(completion))}%</strong></div>
    </div>
  `;

  document.getElementById('schoolDetailContacts').innerHTML = `
    <div class="school-record-info-list">
      <div class="school-record-info-row"><span>Direcao</span><strong>${esc(profile?.director || 'Nao informado')}</strong></div>
      <div class="school-record-info-row"><span>Vice</span><strong>${esc(profile?.viceDirector || 'Nao informado')}</strong></div>
      <div class="school-record-info-row"><span>PROATI</span><strong>${esc(profile?.proati || 'Nao informado')}</strong></div>
      <div class="school-record-info-row"><span>GOE</span><strong>${esc(profile?.goe || 'Nao informado')}</strong></div>
    </div>
  `;
}

function renderSchoolDetailDeferred(ctx) {
  const { school, profile, network, openCalls, defectUnits, alertUnits, missingFields, networkGap } = ctx;
  const inventoryRows = schoolInventoryRows(currentSchoolDetail);
  const inventoryCategories = Object.values(schoolInventoryCategorySummary(currentSchoolDetail)).sort((a, b) => b.units - a.units);

  document.getElementById('schoolDetailActions').innerHTML = [
    defectUnits > 0
      ? `<div class="school-record-action-item danger"><strong>Inventario com defeito</strong><span>${esc(String(defectUnits))} unidade(s) com defeito registrado.</span><button class="btn btn-p btn-sm" type="button" onclick="setInventorySchool('${esc(school.name)}')">Abrir inventario</button></div>`
      : '',
    openCalls.length > 0
      ? `<div class="school-record-action-item warn"><strong>Chamados em aberto</strong><span>${esc(String(openCalls.length))} chamado(s) ativo(s) para esta escola.</span><button class="btn btn-g btn-sm" type="button" onclick="openSchoolCalls('${esc(school.name)}')">Abrir chamados</button></div>`
      : '',
    missingFields.length
      ? `<div class="school-record-action-item"><strong>Ficha incompleta</strong><span>Faltam: ${esc(missingFields.slice(0, 4).join(', '))}${missingFields.length > 4 ? '...' : ''}.</span></div>`
      : '',
    (!network || networkGap > 0)
      ? `<div class="school-record-action-item"><strong>Rede e cameras</strong><span>${esc(!network ? 'Ainda nao ha importacao de rede para a unidade.' : `${networkGap} camera(s) fora da cobertura esperada.`)}</span></div>`
      : ''
  ].filter(Boolean).join('') || '<div class="school-record-action-item ok"><strong>Sem pendencia registrada</strong><span>Nenhum chamado, defeito ou campo obrigatorio pendente para esta escola.</span></div>';

  document.getElementById('schoolDetailInventory').innerHTML = `
    <div class="school-record-tech-card">
      <div><span>Inventario</span><strong>${esc(String(ctx.totalUnits))} unidade(s)</strong><small>${esc(String(inventoryRows.length))} tipo(s) | ${esc(String(alertUnits))} manut./defeito</small></div>
      <div class="school-detail-highlight">
        ${inventoryCategories.length ? inventoryCategories.slice(0, 4).map((item) => `<span class="diag-pill">${esc(equipmentTypeLabel(item.category))}: ${esc(String(item.units))}</span>`).join('') : '<span class="diag-pill">Sem tipos consolidados</span>'}
      </div>
      <button class="btn btn-p btn-sm" type="button" onclick="setInventorySchool('${esc(school.name)}')">Abrir inventario da escola</button>
    </div>
  `;

  document.getElementById('schoolDetailNetwork').innerHTML = network ? `
    <div class="school-record-tech-card">
      <div><span>Rede e cameras</span><strong>${esc(network.cameraWorkingLabel || '--')} / ${esc(network.cameraInstalledLabel || '--')}</strong><small>${esc(network.bandwidth || 'banda nao informada')} | Wi-Fi ${esc(network.wifi || '--')}</small></div>
      <div class="school-detail-highlight">
        <span class="diag-pill ${toneBySchool(network.status === 'defeito' ? 'critico' : network.status === 'manutencao' ? 'atencao' : 'estavel')}">${esc(badgeText(network.status))}</span>
        <span class="diag-pill">DVR ${esc(network.dvrBrand || '--')}</span>
        <span class="diag-pill">Firewall ${esc(network.firewallModel || '--')}</span>
      </div>
    </div>
  ` : '<div class="school-record-tech-card"><div><span>Rede e cameras</span><strong>Sem dados importados</strong><small>Nenhum registro de rede e cameras para esta escola ainda.</small></div></div>';

  document.getElementById('schoolDetailContacts').innerHTML += `
    <div class="school-record-note-card">
      <strong>Contato rapido</strong>
      <div class="school-link-grid">
        ${profile?.phone ? `<a class="btn btn-g btn-sm" href="tel:${esc(profile.phone)}">Ligar ${esc(profile.phone)}</a>` : '<span class="diag-pill">Sem telefone</span>'}
        ${profile?.mobile ? `<a class="btn btn-g btn-sm" href="https://wa.me/${esc(profile.mobile.replace(/\D/g, ''))}" target="_blank" rel="noreferrer">WhatsApp</a>` : '<span class="diag-pill">Sem celular</span>'}
        ${profile?.email ? `<a class="btn btn-g btn-sm" href="mailto:${esc(profile.email)}">E-mail</a>` : '<span class="diag-pill">Sem e-mail</span>'}
      </div>
      <p>${esc(profile?.address || 'Endereco nao informado')}</p>
      <small>${esc(profile?.notes || 'Sem observacoes adicionais')}</small>
    </div>
  `;

  const history = schoolEventHistory(currentSchoolDetail);
  document.getElementById('schoolEventHistory').innerHTML = history.map((item) => `
    <div class="setechub-item">
      <div class="setechub-head"><strong>${esc(item.text)}</strong><span class="diag-pill">${esc(item.when)}</span></div>
      <div class="sync-meta">${esc(badgeText(item.kind))}</div>
    </div>
  `).join('') || '<div class="sync-empty">Nenhum historico relevante para esta escola ainda.</div>';
}

function renderSchoolDetail() {
  const { sortedSchools, school } = schoolRecordContext();
  renderSchoolRecordSelect(sortedSchools);
  if (!school) {
    showPage('schools');
    renderCurrentPage('schools');
    return;
  }
  const profile = currentSchoolProfile();
  const assets = state.schoolAssets.filter((item) => item.school === currentSchoolDetail);
  const openCalls = state.calls.filter((item) => item.school === currentSchoolDetail && item.status !== 'resolvido');
  const plannedTasks = state.tasks.filter((item) => item.place === currentSchoolDetail || item.title.includes(currentSchoolDetail));
  const network = schoolNetworkRecord(currentSchoolDetail);
  const responsibleSupervisors = (state.supervisors || [])
    .filter((supervisor) => (supervisor.schools || []).includes(currentSchoolDetail))
    .map((supervisor) => supervisor.name);
  const alertUnits = assets.filter((item) => item.status !== 'ok').reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const defectUnits = assets.filter((item) => item.status === 'defeito').reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const ctx = {
    school,
    profile,
    network,
    displayNotes: schoolDisplayNotes(school.notes),
    responsibleSupervisorText: responsibleSupervisors.length ? responsibleSupervisors.join(', ') : 'Sem supervisor vinculado',
    totalUnits: assets.reduce((sum, item) => sum + schoolAssetUnits(item), 0),
    alertUnits,
    defectUnits,
    completion: schoolProfileCompletion(currentSchoolDetail),
    missingFields: schoolMissingProfileFields(currentSchoolDetail),
    openCalls,
    plannedTasks,
    networkGap: network ? Math.max(0, Number(network.cameraInstalled || 0) - Number(network.cameraWorking || 0)) : 0
  };
  ctx.situationLabel = defectUnits > 0 ? 'Defeito registrado' : alertUnits > 0 ? 'Manutencao registrada' : openCalls.length > 0 ? 'Chamado ativo' : 'Sem pendencia registrada';
  ctx.situationTone = defectUnits > 0 ? 'pill-danger' : alertUnits > 0 || openCalls.length > 0 ? 'pill-warn' : 'pill-ok';

  renderSchoolDetailHeader(ctx);
  renderSchoolDetailCore(ctx);
  document.getElementById('schoolDetailActions').innerHTML = '<div class="sync-empty">Carregando pendencias...</div>';
  document.getElementById('schoolDetailInventory').innerHTML = '<div class="sync-empty">Carregando inventario...</div>';
  document.getElementById('schoolDetailNetwork').innerHTML = '<div class="sync-empty">Carregando rede...</div>';
  document.getElementById('schoolEventHistory').innerHTML = '<div class="sync-empty">Carregando historico...</div>';
  setSchoolProfileForm(profile);
  scheduleSchoolRecordDeferredRender(() => {
    if (school.name === currentSchoolDetail) renderSchoolDetailDeferred(ctx);
  });
}
