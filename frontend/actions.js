'use strict';

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function logSchoolEvent(school, kind, text) {
  if (!school) return;
  state.histories.schoolEvents = state.histories.schoolEvents || [];
  state.histories.schoolEvents.unshift({
    id: uid(),
    school,
    kind,
    text,
    when: timestampLabel()
  });
}

function requireEditAccess() {
  if (canEditData()) return true;
  alert('Seu perfil tem acesso de leitura. Edicao liberada apenas para SEINTEC, CTC e administrador.');
  return false;
}

function exportJson() {
  if (!canManageUsers()) return;
  downloadFile('setechub-backup.json', JSON.stringify(state, null, 2), 'application/json');
}

function exportSummary() {
  const user = currentUser();
  const summary = [
    'SETECHUB | Resumo operacional',
    `Responsavel: ${user?.name || state.profile.name}`,
    `Perfil: ${ROLE_LABELS[user?.role] || state.profile.unit}`,
    '',
    `Tarefas totais: ${state.tasks.length}`,
    `Tarefas concluidas: ${state.tasks.filter((item) => item.done).length}`,
    `Chamados ativos: ${state.calls.filter((item) => item.status !== 'resolvido').length}`,
    `Escolas em atencao: ${state.schools.filter((item) => item.status !== 'estavel').length}`,
    `Ativos em alerta: ${state.assets.filter((item) => item.status !== 'ok').length}`,
    `Ponto: ${state.ponto.entrada || '--:--'} ate ${state.ponto.saida || '--:--'}`
  ].join('\n');
  downloadFile('setechub-resumo.txt', summary, 'text/plain');
}

async function toggleSupervisorPanelFullscreen() {
  const panel = document.getElementById('painelSupervisor');
  if (!panel) return;
  const isFullscreen = document.fullscreenElement === panel;
  try {
    if (document.fullscreenEnabled && panel.requestFullscreen) {
      if (isFullscreen) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
      return;
    }
  } catch (error) {
    console.warn('Falha ao alternar tela cheia do painel de supervisores.', error);
  }
  panel.classList.toggle('supervisor-panel-fullscreen', !panel.classList.contains('supervisor-panel-fullscreen'));
  updateSupervisorFullscreenButton();
}

function updateSupervisorFullscreenButton() {
  const button = document.getElementById('supervisorFullscreenBtn');
  const panel = document.getElementById('painelSupervisor');
  if (!button || !panel) return;
  const active = document.fullscreenElement === panel || panel.classList.contains('supervisor-panel-fullscreen');
  button.textContent = active ? 'Sair da tela cheia' : 'Tela cheia';
}

function toggleUserActive(id) {
  if (!canManageUsers()) return;
  const user = state.users.find((item) => item.id === id);
  if (!user || user.id === currentUser()?.id) return;
  state.users = state.users.map((item) =>
    item.id === id ? { ...item, active: item.active === false } : item
  );
  refreshAll();
}

function randomPin(length = 6) {
  const digits = '0123456789';
  return Array.from({ length }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
}

function fillRandomUserPin() {
  const input = document.getElementById('userPin');
  if (input) input.value = randomPin();
}

function setUserEditMode(user = null) {
  const editingId = document.getElementById('editingUserId');
  const submit = document.getElementById('userSubmitBtn');
  const cancel = document.getElementById('cancelUserEditBtn');
  if (editingId) editingId.value = user?.id || '';
  if (submit) submit.textContent = user ? 'Salvar usuario' : 'Criar usuario';
  if (cancel) cancel.hidden = !user;
}

function editUser(id) {
  if (!canManageUsers()) return;
  const user = (state.users || []).find((item) => item.id === id);
  if (!user) return;
  document.getElementById('userName').value = user.name || '';
  document.getElementById('userLogin').value = user.login || user.name || '';
  document.getElementById('userPin').value = user.pin || '';
  document.getElementById('userRole').value = user.role || 'supervisor';
  document.getElementById('userSupervisorName').value = user.supervisorName || '';
  setUserEditMode(user);
  document.getElementById('userName')?.focus();
}

function cancelUserEdit() {
  document.getElementById('userForm')?.reset();
  setUserEditMode(null);
}

function randomizeUserPin(id) {
  if (!canManageUsers()) return;
  const nextPin = randomPin();
  state.users = (state.users || []).map((user) => user.id === id ? { ...user, pin: nextPin } : user);
  refreshAll();
  alert(`PIN atualizado para ${nextPin}.`);
}

function resetUserPin(id) {
  if (!canManageUsers()) return;
  state.users = (state.users || []).map((user) => user.id === id ? { ...user, pin: '1234' } : user);
  refreshAll();
  alert('Senha/PIN resetado para 1234.');
}

function removeUser(id) {
  if (!canManageUsers()) return;
  const user = (state.users || []).find((item) => item.id === id);
  if (!user || user.id === currentUser()?.id) return;
  if (!confirm(`Remover o usuario ${user.name}?`)) return;
  state.users = (state.users || []).filter((item) => item.id !== id);
  cancelUserEdit();
  refreshAll();
}

function findLoginUser(name, pin) {
  const loginKey = normalizeKey(name);
  const pinText = String(pin || '').trim();
  const users = (state.users || []).filter((item) =>
    item.active !== false &&
    String(item.pin || '') === pinText
  );
  const exact = users.find((item) =>
    loginCandidates(item).some((value) => normalizeKey(value) === loginKey)
  );
  if (exact) return exact;
  const firstNameMatches = users.filter((item) =>
    loginCandidates(item)
      .some((value) => normalizeKey(value).split(/\s+/)[0] === loginKey)
  );
  return firstNameMatches.length === 1 ? firstNameMatches[0] : null;
}

function loginCandidates(user) {
  const values = [user.login, user.name, user.supervisorName];
  if (user.role && !['supervisor', 'pec'].includes(user.role)) {
    values.push(user.role, ROLE_LABELS[user.role]);
  }
  return values.filter(Boolean);
}

function loginNameExists(name) {
  const loginKey = normalizeKey(name);
  return (state.users || []).some((item) =>
    item.active !== false &&
    loginCandidates(item)
      .some((value) => {
        const normalized = normalizeKey(value);
        return normalized === loginKey || normalized.split(/\s+/)[0] === loginKey;
      })
  );
}

function logoutToLogin() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(ACTIVE_USER_KEY);
  const pinInput = document.getElementById('loginPin');
  const nameInput = document.getElementById('loginName');
  const error = document.getElementById('loginError');
  if (pinInput) pinInput.value = '';
  if (nameInput) nameInput.value = '';
  if (error) {
    error.textContent = '';
    error.classList.remove('show');
  }
  setLoginVisible(true);
}

function closeAccountMenu() {
  const menu = document.getElementById('accountMenu');
  const button = document.getElementById('accountMenuBtn');
  if (menu) menu.classList.remove('open');
  if (button) button.setAttribute('aria-expanded', 'false');
}

function toggleAccountMenu() {
  const menu = document.getElementById('accountMenu');
  const button = document.getElementById('accountMenuBtn');
  if (!menu || !button) return;
  const nextOpen = !menu.classList.contains('open');
  menu.classList.toggle('open', nextOpen);
  button.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
}

function restoreState(file) {
  if (!canManageUsers()) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = mergeState(JSON.parse(reader.result));
      saveState();
      refreshAll();
      alert('Backup importado com sucesso.');
    } catch {
      alert('Nao foi possivel importar este arquivo.');
    }
  };
  reader.readAsText(file);
}

function importLegacyState() {
  if (!canManageUsers()) return;
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    alert('Nenhum dado do prototipo antigo foi encontrado neste navegador.');
    return;
  }
  try {
    state = mergeLegacyState(JSON.parse(raw));
    refreshAll();
    alert('Dados do prototipo antigo importados com sucesso.');
  } catch {
    alert('Nao foi possivel importar os dados do prototipo antigo.');
  }
}

function toggleTask(id) {
  if (!requireEditAccess()) return;
  state.tasks = state.tasks.map((item) => item.id === id ? { ...item, done: !item.done } : item);
  refreshAll();
}

function removeTask(id) {
  if (!requireEditAccess()) return;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  refreshAll();
}

function toggleChecklist(id) {
  state.checklist = state.checklist.map((item) => item.id === id ? { ...item, done: !item.done } : item);
  refreshAll();
}

function advanceCall(id) {
  if (!requireEditAccess()) return;
  const order = ['aberto', 'em_rota', 'resolvido'];
  state.calls = state.calls.map((item) => {
    if (item.id !== id) return item;
    const next = order[Math.min(order.indexOf(item.status) + 1, order.length - 1)];
    state.histories.calls.unshift({ id: uid(), text: `${item.title} agora esta em ${badgeText(next)}`, when: timestampLabel() });
    return { ...item, status: next };
  });
  refreshAll();
}

function removeCall(id) {
  if (!requireEditAccess()) return;
  state.calls = state.calls.filter((item) => item.id !== id);
  refreshAll();
}

function cycleSchool(id) {
  if (!requireEditAccess()) return;
  const order = ['estavel', 'atencao', 'critico'];
  state.schools = state.schools.map((item) => {
    if (item.id !== id) return item;
    const nextStatus = order[(order.indexOf(item.status) + 1) % order.length];
    logSchoolEvent(item.name, 'status', `Status alterado para ${badgeText(nextStatus)}.`);
    return { ...item, status: nextStatus };
  });
  refreshAll();
}

function removeSchool(id) {
  if (!requireEditAccess()) return;
  const target = state.schools.find((item) => item.id === id);
  if (target?.fixedName) {
    alert('Os nomes oficiais das escolas da URE Itapeva permanecem fixos na base inicial.');
    return;
  }
  purgeSchoolReferences(target?.name || '');
  state.schools = state.schools.filter((item) => item.id !== id);
  if (currentSchoolDetail === target?.name) currentSchoolDetail = '';
  if (currentInventorySchool === target?.name) currentInventorySchool = 'todas';
  if (currentCallSchoolContext === target?.name) currentCallSchoolContext = '';
  if (currentImportSchoolContext === target?.name) currentImportSchoolContext = '';
  refreshAll();
}

function createTaskFromSchool(id) {
  if (!requireEditAccess()) return;
  const school = state.schools.find((item) => item.id === id);
  if (!school) return;
  state.tasks.unshift({
    id: uid(),
    title: `Acao na ${school.name}`,
    time: '',
    priority: school.status === 'critico' ? 'alta' : 'media',
    place: school.name,
    category: 'Visita',
    done: false
  });
  state.histories.visits.unshift({ id: uid(), text: `Tarefa criada para ${school.name}`, when: timestampLabel() });
  refreshAll();
  showPage('agenda');
}

function cycleAsset(id) {
  if (!requireEditAccess()) return;
  const order = ['ok', 'manutencao', 'defeito'];
  state.assets = state.assets.map((item) => {
    if (item.id !== id) return item;
    return { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] };
  });
  refreshAll();
}

function removeAsset(id) {
  state.assets = state.assets.filter((item) => item.id !== id);
  refreshAll();
}

function removeNote(id) {
  state.notes = state.notes.filter((item) => item.id !== id);
  refreshAll();
}

function removeOfficialLink(id) {
  if (!canManageUsers()) return;
  state.officialLinks = state.officialLinks.filter((item) => item.id !== id);
  refreshAll();
}

function removeSector(id) {
  if (!canManageUsers()) return;
  state.sectors = state.sectors.filter((item) => item.id !== id);
  refreshAll();
}

function addSupervisorTestVisits() {
  const today = new Date().toISOString().slice(0, 10);
  supervisorStats().forEach(({ supervisor, assignedSchools }) => {
    const alreadyVisited = new Set((state.supervisorVisits || [])
      .filter((visit) => visit.supervisor === supervisor.name)
      .map((visit) => visit.school));
    const nextSchool = assignedSchools.find((school) => !alreadyVisited.has(school)) || assignedSchools[0];
    if (!nextSchool) return;
    state.supervisorVisits.unshift({
      id: uid(),
      supervisor: supervisor.name,
      school: nextSchool,
      date: today,
      type: 'Rotina',
      notes: 'Visita teste gerada para validar o BI.'
    });
  });
  refreshAll();
}

function selectSupervisor(name) {
  currentSupervisorFilter = normalizeKey(name);
  renderSupervisors();
  saveUiContext();
}

function openSupervisorRecord(name) {
  if (!canViewSupervisor(name)) {
    showPage('supervisors');
    return;
  }
  currentSupervisorDetail = name;
  currentSupervisorFilter = normalizeKey(name);
  showPage('supervisor-record');
  renderSupervisorRecord();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeSchoolImport(id) {
  if (!requireEditAccess()) return;
  const target = state.schoolImports.find((item) => item.id === id);
  if (target) logSchoolEvent(target.school, 'import', `Importacao removida: ${target.label || target.filename || 'arquivo'}.`);
  state.schoolImports = state.schoolImports.filter((item) => item.id !== id);
  refreshAll();
}

function approveSchoolImport(id) {
  if (!requireEditAccess()) return;
  state.schoolImports = state.schoolImports.map((item) => {
    if (item.id !== id) return item;
    logSchoolEvent(item.school, 'review', `Importacao confirmada: ${item.label || item.filename || 'arquivo'}.`);
    return { ...item, reviewStatus: 'approved' };
  });
  refreshAll();
}

function rejectSchoolImport(id) {
  if (!requireEditAccess()) return;
  const target = state.schoolImports.find((item) => item.id === id);
  if (!target) return;
  const key = normalizeKey(target.school);
  const importId = String(target.id || '');
  const sourceType = String(target.type || '');
  state.schoolImports = state.schoolImports.filter((item) => item.id !== id);
  if (importId.startsWith('seed-import-csv-') || /excel|csv|xlsx|xls|tsv/i.test(sourceType)) {
    state.schoolAssets = state.schoolAssets.filter((item) => !(normalizeKey(item.school) === key && String(item.id || '').startsWith('seed-csv-')));
  }
  if (importId.startsWith('seed-import-') && !importId.startsWith('seed-import-csv-')) {
    state.schoolAssets = state.schoolAssets.filter((item) => !(normalizeKey(item.school) === key && String(item.id || '').startsWith('seed-asset-')));
  }
  if (/rede adm|cameras instaladas|dvr|firewall/i.test(`${target.preview || ''} ${target.summary || ''}`)) {
    state.schoolNetworks = state.schoolNetworks.filter((item) => normalizeKey(item.school) !== key);
  }
  logSchoolEvent(target.school, 'review', `Importacao rejeitada e dados derivados removidos: ${target.label || target.filename || 'arquivo'}.`);
  refreshAll();
}

function cycleSchoolAsset(id) {
  if (!requireEditAccess()) return;
  const order = ['ok', 'manutencao', 'defeito'];
  state.schoolAssets = state.schoolAssets.map((item) => {
    if (item.id !== id) return item;
    return { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] };
  });
  refreshAll();
}

function removeSchoolAsset(id) {
  if (!requireEditAccess()) return;
  state.schoolAssets = state.schoolAssets.filter((item) => item.id !== id);
  refreshAll();
}

function showSchoolDetail(name) {
  if (!canViewSchool(name)) {
    showPage('schools');
    return;
  }
  currentSchoolDetail = name;
  currentSchoolSearch = '';
  currentImportSchoolContext = name;
  showPage('school-record');
  renderSchoolDetail();
  renderAssets();
  renderSchoolImports();
  const schoolDetailSelect = document.getElementById('schoolDetailSelect');
  if (schoolDetailSelect) schoolDetailSelect.value = name;
}

function setInventorySchool(name) {
  if (!canViewSchool(name)) {
    showPage('schools');
    return;
  }
  currentInventorySchool = name;
  currentInventorySearch = '';
  showPage('assets');
  renderAssets();
  const select = document.getElementById('inventorySchoolSelect');
  if (select) select.value = name;
}

function openSchoolRecord(name) {
  showSchoolDetail(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openSchoolImports(name) {
  currentSchoolDetail = name;
  currentImportSchoolContext = name;
  showPage('school-record');
  renderSchoolDetail();
  renderSchoolImports();
  document.getElementById('schoolImportList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openSchoolCalls(name) {
  currentCallSchoolContext = name;
  showPage('calls');
  document.getElementById('callSchool').value = name;
  renderCalls();
}

function openSchoolCategory(filter, zone = 'todas') {
  currentSchoolFilter = filter;
  currentSchoolZoneFilter = zone;
  currentSchoolSearch = '';
  showPage('schools');
  renderSchools();
}

function openMunicipalitySchools(zone) {
  currentSchoolFilter = 'todas';
  currentSchoolZoneFilter = zone || 'todas';
  currentSchoolSearch = '';
  showPage('schools');
  renderSchools();
}

function openInventoryCategory(status = 'todos', category = 'todas', school = 'todas') {
  currentInventoryStatus = status;
  currentInventoryCategory = category;
  currentInventorySchool = school;
  currentInventorySearch = '';
  showPage('assets');
  renderAssets();
}

function openMainNavigationPage(page) {
  if (page === 'assets') {
    currentInventorySchool = 'todas';
    currentInventoryStatus = 'todos';
    currentInventoryCategory = 'todas';
    currentInventorySearch = '';
  }
  showPage(page);
  if (page === 'assets') renderAssets();
  if (page === 'schools') renderSchools();
}

function openCallCategory(filter = 'todos') {
  currentCallFilter = filter;
  currentCallSchoolContext = '';
  showPage('calls');
  renderCalls();
}

function openImportCategory(filter = 'todos') {
  currentImportFilter = filter;
  currentImportSchoolContext = '';
  showPage('schools');
  renderSchoolImports();
}

function openPecDirectory() {
  currentDirectoryFilter = 'pecs';
  showPage('pecs');
  syncFilterButtons('directory');
  renderDirectoryContacts();
}

function renameSchoolReferences(previousName, nextName) {
  if (!previousName || !nextName || previousName === nextName) return;
  state.tasks = state.tasks.map((item) => item.place === previousName ? { ...item, place: nextName } : item);
  state.calls = state.calls.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolProfiles = state.schoolProfiles.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolImports = state.schoolImports.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolAssets = state.schoolAssets.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolNetworks = state.schoolNetworks.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.supervisors = (state.supervisors || []).map((supervisor) => ({
    ...supervisor,
    schools: Array.from(new Set((supervisor.schools || []).map((name) => name === previousName ? nextName : name)))
  }));
  if (currentSchoolDetail === previousName) currentSchoolDetail = nextName;
  if (currentInventorySchool === previousName) currentInventorySchool = nextName;
  if (currentCallSchoolContext === previousName) currentCallSchoolContext = nextName;
  if (currentImportSchoolContext === previousName) currentImportSchoolContext = nextName;
}

function purgeSchoolReferences(name) {
  if (!name) return;
  state.tasks = state.tasks.filter((item) => item.place !== name);
  state.calls = state.calls.filter((item) => item.school !== name);
  state.schoolProfiles = state.schoolProfiles.filter((item) => item.school !== name);
  state.schoolImports = state.schoolImports.filter((item) => item.school !== name);
  state.schoolAssets = state.schoolAssets.filter((item) => item.school !== name);
  state.schoolNetworks = state.schoolNetworks.filter((item) => item.school !== name);
  state.supervisors = (state.supervisors || []).map((supervisor) => ({
    ...supervisor,
    schools: (supervisor.schools || []).filter((school) => school !== name)
  }));
}

function supervisorNameForSchool(name) {
  return (state.supervisors || []).find((supervisor) =>
    (supervisor.schools || []).includes(name)
  )?.name || '';
}

function assignSchoolSupervisor(schoolName, supervisorName) {
  if (!schoolName) return;
  state.supervisors = (state.supervisors || []).map((supervisor) => {
    const schools = (supervisor.schools || []).filter((name) => name !== schoolName);
    if (supervisorName && supervisor.name === supervisorName) schools.push(schoolName);
    return { ...supervisor, schools: Array.from(new Set(schools)) };
  });
}

function clearAdminSchoolForm() {
  document.getElementById('adminSchoolForm')?.reset();
  const idInput = document.getElementById('adminSchoolId');
  const picker = document.getElementById('adminSchoolPicker');
  if (idInput) idInput.value = '';
  if (picker) picker.value = '';
  document.getElementById('adminSchoolName')?.focus();
}

function editAdminSchool(id) {
  if (!canManageUsers()) return;
  const school = (state.schools || []).find((item) => item.id === id);
  if (!school) return;
  document.getElementById('adminSchoolId').value = school.id;
  document.getElementById('adminSchoolPicker').value = school.id;
  document.getElementById('adminSchoolName').value = school.name || '';
  document.getElementById('adminSchoolCie').value = school.cie || '';
  document.getElementById('adminSchoolZone').value = school.zone || '';
  document.getElementById('adminSchoolStatus').value = school.status || 'estavel';
  document.getElementById('adminSchoolSupervisorName').value = supervisorNameForSchool(school.name);
  document.getElementById('adminSchoolName')?.focus();
}

function schoolSeverity(status) {
  return { estavel: 0, atencao: 1, critico: 2 }[status] ?? 0;
}

function saveAdminSchool(event) {
  event.preventDefault();
  if (!canManageUsers()) return;
  const id = document.getElementById('adminSchoolId').value;
  const name = document.getElementById('adminSchoolName').value.trim();
  const cie = document.getElementById('adminSchoolCie').value.trim();
  const zone = document.getElementById('adminSchoolZone').value.trim();
  const status = document.getElementById('adminSchoolStatus').value || 'estavel';
  const supervisorName = document.getElementById('adminSchoolSupervisorName').value;
  if (!name || !zone) return;
  const duplicate = (state.schools || []).find((school) =>
    school.id !== id &&
    (normalizeKey(school.name) === normalizeKey(name) || (cie && normalizeKey(school.cie || '') === normalizeKey(cie)))
  );
  if (duplicate) {
    alert('Ja existe uma escola com este nome ou CIE. Use "Unificar duplicada" para juntar os registros.');
    return;
  }
  const existing = (state.schools || []).find((school) => school.id === id);
  if (existing) {
    renameSchoolReferences(existing.name, name);
    state.schools = state.schools.map((school) => school.id === id ? {
      ...school,
      name,
      cie,
      zone,
      status,
      notes: school.notes || 'Escola atualizada no painel admin.'
    } : school);
  } else {
    state.schools.unshift({
      id: uid(),
      name,
      cie,
      zone,
      status,
      notes: 'Escola criada no painel admin.'
    });
  }
  assignSchoolSupervisor(name, supervisorName);
  clearAdminSchoolForm();
  refreshAll();
}

function mergeAdminSchools() {
  if (!canManageUsers()) return;
  const primaryId = document.getElementById('adminMergePrimary')?.value;
  const duplicateId = document.getElementById('adminMergeDuplicate')?.value;
  if (!primaryId || !duplicateId || primaryId === duplicateId) return;
  const primary = (state.schools || []).find((school) => school.id === primaryId);
  const duplicate = (state.schools || []).find((school) => school.id === duplicateId);
  if (!primary || !duplicate) return;
  if (!confirm(`Unificar "${duplicate.name}" dentro de "${primary.name}"? As referencias da duplicada serao movidas para a escola principal.`)) return;
  const duplicateSupervisor = supervisorNameForSchool(duplicate.name);
  renameSchoolReferences(duplicate.name, primary.name);
  state.schools = (state.schools || [])
    .filter((school) => school.id !== duplicate.id)
    .map((school) => {
      if (school.id !== primary.id) return school;
      const status = schoolSeverity(duplicate.status) > schoolSeverity(primary.status) ? duplicate.status : primary.status;
      const notes = [primary.notes, duplicate.notes].filter(Boolean).join(' | ');
      return {
        ...school,
        cie: school.cie || duplicate.cie || '',
        zone: school.zone || duplicate.zone || '',
        status,
        notes: notes || 'Registros unificados no painel admin.'
      };
    });
  if (duplicateSupervisor && !supervisorNameForSchool(primary.name)) {
    assignSchoolSupervisor(primary.name, duplicateSupervisor);
  } else {
    assignSchoolSupervisor(primary.name, supervisorNameForSchool(primary.name));
  }
  clearAdminSchoolForm();
  refreshAll();
}

function copySchoolSummary() {
  const school = state.schools.find((item) => item.name === currentSchoolDetail);
  const profile = currentSchoolProfile();
  const assets = state.schoolAssets.filter((item) => item.school === currentSchoolDetail);
  if (!school) return;
  const summary = [
    school.name,
    `Municipio: ${school.zone}`,
    `Status: ${badgeText(school.status)}`,
    `Direcao: ${profile?.director || 'Nao informado'}`,
    `Telefone: ${profile?.phone || 'Nao informado'}`,
    `E-mail: ${profile?.email || 'Nao informado'}`,
    `Equipamentos: ${assets.reduce((sum, item) => sum + schoolAssetUnits(item), 0)}`,
    `Observacoes: ${profile?.notes || school.notes || 'Sem observacoes'}`
  ].join('\n');
  copyText(summary, 'Resumo da escola copiado.');
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    alert(successMessage);
  } catch {
    alert('Nao foi possivel copiar automaticamente.');
  }
}

function stampPonto(type) {
  state.ponto[type] = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  refreshAll();
}

function focusFirstInput(id) {
  showPage(id === 'callTitle' ? 'calls' : 'agenda');
  setTimeout(() => document.getElementById(id)?.focus(), 50);
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function extractImportPreview(file, type) {
  if (type === 'text') {
    const text = await readFileAsText(file);
    return {
      preview: text.slice(0, 1800),
      summary: `${text.split(/\r?\n/).filter(Boolean).length} linhas`
    };
  }
  if (type === 'excel') {
    if (/\.(csv|tsv)$/i.test(file.name)) {
      const text = await readFileAsText(file);
      const rows = text.split(/\r?\n/).filter(Boolean);
      return {
        preview: rows.slice(0, 12).join('\n'),
        summary: `${rows.length} linhas`
      };
    }
    if (window.XLSX) {
      const buffer = await readFileAsArrayBuffer(file);
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const csv = window.XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
      const rows = csv.split(/\r?\n/).filter(Boolean);
      return {
        preview: rows.slice(0, 12).join('\n'),
        summary: `${workbook.SheetNames.length} aba(s) | ${rows.length} linhas`
      };
    }
    const text = await readFileAsText(file);
    return {
      preview: text.slice(0, 1800),
      summary: 'Leitura basica'
    };
  }
  if (type === 'image') {
    if (window.Tesseract) {
      const result = await window.Tesseract.recognize(file, 'por');
      const text = result?.data?.text || '';
      return {
        preview: text.slice(0, 1800),
        summary: text.trim() ? 'OCR concluido' : 'Imagem sem texto reconhecido'
      };
    }
    return {
      preview: 'OCR indisponivel neste navegador no momento.',
      summary: 'Sem OCR'
    };
  }
  return {
    preview: '',
    summary: 'Nao processado'
  };
}

function setupEventListeners() {
  document.addEventListener('submit', (event) => {
    if (event.target.closest('#setup')) return;
    if (['profileForm', 'userForm', 'supabaseConfigForm'].includes(event.target.id)) return;
    if (!canEditData()) {
      event.preventDefault();
      requireEditAccess();
    }
  }, true);

  document.getElementById('taskForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;
    state.tasks.unshift({
      id: uid(),
      title,
      time: document.getElementById('taskTime').value,
      priority: document.getElementById('taskPriority').value,
      place: document.getElementById('taskPlace').value.trim() || 'Sem local definido',
      category: document.getElementById('taskCategory').value,
      done: false
    });
    event.target.reset();
    refreshAll();
  });

  document.getElementById('ctcVisitForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const owner = document.getElementById('ctcVisitOwner').value;
    const date = document.getElementById('ctcVisitDate').value;
    const time = document.getElementById('ctcVisitTime').value;
    const place = document.getElementById('ctcVisitPlace').value.trim();
    const notes = document.getElementById('ctcVisitNotes').value.trim();
    if (!owner || !place) return;
    state.tasks.unshift({
      id: uid(),
      title: notes || `Visita programada - ${owner}`,
      time,
      date,
      priority: 'media',
      place,
      category: 'CTC',
      ctcOwner: owner,
      done: false
    });
    event.target.reset();
    refreshAll();
    showPage('ctc');
  });

  document.getElementById('callForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('callTitle').value.trim();
    const school = document.getElementById('callSchool').value.trim();
    if (!title || !school) return;
    state.calls.unshift({ id: uid(), title, school, status: 'aberto' });
    state.histories.calls.unshift({ id: uid(), text: `Novo chamado criado para ${school}`, when: timestampLabel() });
    event.target.reset();
    refreshAll();
  });

  document.getElementById('schoolForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('schoolName').value.trim();
    const cie = document.getElementById('schoolCie').value.trim();
    const zone = document.getElementById('schoolZone').value.trim();
    const notes = document.getElementById('schoolNotes').value.trim();
    if (!name || !zone) return;
    const existing = state.schools.find((item) =>
      normalizeKey(item.name) === normalizeKey(name) ||
      (cie && normalizeKey(item.cie || '') === normalizeKey(cie))
    );
    if (existing) {
      const nextName = existing.fixedName ? existing.name : name;
      renameSchoolReferences(existing.name, nextName);
      state.schools = state.schools.map((item) => item.id === existing.id ? {
        ...item,
        name: nextName,
        cie: cie || item.cie || '',
        zone,
        notes: notes || item.notes || 'Escola atualizada no painel.',
        status: item.status || 'atencao'
      } : item);
      logSchoolEvent(nextName, 'profile', 'Cadastro principal da escola atualizado.');
    } else {
      state.schools.unshift({ id: uid(), name, cie, zone, status: 'atencao', notes: notes || 'Nova escola adicionada ao painel.' });
      logSchoolEvent(name, 'profile', 'Escola adicionada na base principal.');
    }
    event.target.reset();
    refreshAll();
  });

  document.getElementById('schoolDetailSelect')?.addEventListener('change', (event) => {
    currentSchoolDetail = event.target.value;
    renderSchoolDetail();
  });

  document.getElementById('schoolProfileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!currentSchoolDetail) return;
    const nextProfile = {
      id: `profile-${normalizeKey(currentSchoolDetail)}`,
      school: currentSchoolDetail,
      municipality: state.schools.find((item) => item.name === currentSchoolDetail)?.zone || '',
      director: document.getElementById('schoolProfileDirector').value.trim(),
      viceDirector: document.getElementById('schoolProfileViceDirector').value.trim(),
      proati: document.getElementById('schoolProfileProati').value.trim(),
      goe: document.getElementById('schoolProfileGoe').value.trim(),
      phone: document.getElementById('schoolProfilePhone').value.trim(),
      mobile: document.getElementById('schoolProfileMobile').value.trim(),
      email: document.getElementById('schoolProfileEmail').value.trim(),
      address: document.getElementById('schoolProfileAddress').value.trim(),
      notes: document.getElementById('schoolProfileNotes').value.trim()
    };
    const existing = state.schoolProfiles.find((item) => item.school === currentSchoolDetail);
    if (existing) {
      state.schoolProfiles = state.schoolProfiles.map((item) => item.school === currentSchoolDetail ? nextProfile : item);
    } else {
      state.schoolProfiles.unshift(nextProfile);
    }
    logSchoolEvent(currentSchoolDetail, 'profile', 'Ficha da escola atualizada.');
    refreshAll();
    alert('Ficha da escola atualizada.');
  });

  document.getElementById('assetForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('assetName').value.trim();
    const place = document.getElementById('assetPlace').value.trim();
    const status = document.getElementById('assetStatus').value;
    if (!name || !place) return;
    state.assets.unshift({ id: uid(), name, place, status });
    event.target.reset();
    refreshAll();
  });

  document.getElementById('schoolAssetForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const school = document.getElementById('schoolAssetSchool').value.trim();
    const name = document.getElementById('schoolAssetName').value.trim();
    const quantity = parsePositiveInteger(document.getElementById('schoolAssetQuantity').value, 1);
    const status = document.getElementById('schoolAssetStatus').value;
    const notes = document.getElementById('schoolAssetNotes').value.trim();
    if (!school || !name) return;
    state.schoolAssets.unshift({ id: uid(), school, name, status, notes: formatSchoolAssetNotes(notes, quantity) });
    logSchoolEvent(school, 'inventory', `Equipamento adicionado manualmente: ${name}.`);
    event.target.reset();
    document.getElementById('schoolAssetQuantity').value = '1';
    refreshAll();
  });

  document.getElementById('schoolAssetBulkForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const school = document.getElementById('schoolAssetBulkSchool').value.trim();
    const text = document.getElementById('schoolAssetBulkText').value.trim();
    const statusNode = document.getElementById('schoolAssetBulkStatus');
    if (!school || !text) {
      statusNode.textContent = 'Selecione a escola e preencha pelo menos uma linha no lote rapido.';
      return;
    }
    const rows = parseBulkSchoolAssets(text);
    if (!rows.length) {
      statusNode.textContent = 'Nenhuma linha valida encontrada no lote rapido.';
      return;
    }
    rows.reverse().forEach((row) => {
      state.schoolAssets.unshift({
        id: uid(),
        school,
        name: row.name,
        status: row.status,
        notes: row.notes
      });
    });
    logSchoolEvent(school, 'inventory', `Lote rapido importado com ${rows.length} item(ns).`);
    event.target.reset();
    statusNode.textContent = `${rows.length} item(ns) adicionados ao inventario da escola.`;
    refreshAll();
  });

  document.getElementById('noteForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const title = document.getElementById('noteTitle').value.trim();
    const body = document.getElementById('noteBody').value.trim();
    if (!title || !body) return;
    state.notes.unshift({ id: uid(), title, body });
    event.target.reset();
    refreshAll();
  });

  document.getElementById('redeAutomationForm').addEventListener('submit', (event) => {
    event.preventDefault();
    state.redes = {
      folderPath: document.getElementById('redeFolderPath').value.trim(),
      yearSuffix: document.getElementById('redeYearSuffix').value.trim() || '26',
      numberPlaceholder: document.getElementById('redeNumberPlaceholder').value.trim() || '{{REDE_NUMERO}}',
      datePlaceholder: document.getElementById('redeDatePlaceholder').value.trim() || '{{REDE_DATA}}',
      headingPlaceholder: document.getElementById('redeHeadingPlaceholder').value.trim() || '{{REDE_CABECALHO}}',
      assuntoLabel: document.getElementById('redeAssuntoLabel').value.trim() || 'Assunto:'
    };
    refreshAll();
    alert('Configuracao de redes salva.');
  });

  document.getElementById('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('profileName').value.trim();
    const pin = document.getElementById('profilePin').value.trim();
    const user = currentUser();
    if (!name || !pin || !user) return;
    state.users = (state.users || []).map((item) =>
      item.id === user.id ? { ...item, name, login: item.login || name, pin } : item
    );
    if (user.role === 'admin') state.profile = { ...state.profile, name, pin };
    refreshAll();
    alert('Perfil atualizado.');
  });

  document.getElementById('officialForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManageUsers()) return;
    const office = document.getElementById('officeContactInput').value.trim();
    const label = document.getElementById('officialLabel').value.trim();
    const url = document.getElementById('officialUrl').value.trim();
    state.officialContacts.office = office || state.officialContacts.office;
    if (label && url) state.officialLinks.unshift({ id: uid(), label, url });
    event.target.reset();
    document.getElementById('officeContactInput').value = state.officialContacts.office;
    refreshAll();
  });

  document.getElementById('sectorForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManageUsers()) return;
    const code = document.getElementById('sectorCode').value.trim().toUpperCase();
    const name = document.getElementById('sectorName').value.trim();
    const lead = document.getElementById('sectorLead').value.trim();
    const phone = document.getElementById('sectorPhone').value.trim();
    const email = document.getElementById('sectorEmail').value.trim();
    const summary = document.getElementById('sectorSummary').value.trim();
    if (!code || !name) return;
    const existing = state.sectors.find((item) => item.code.toUpperCase() === code);
    if (existing) {
      state.sectors = state.sectors.map((item) => item.id === existing.id ? {
        ...item,
        name,
        lead: lead || item.lead,
        phone: phone || item.phone,
        email: email || item.email,
        summary: summary || item.summary
      } : item);
    } else {
      state.sectors.unshift({ id: uid(), code, name, lead, phone, email, summary });
    }
    event.target.reset();
    refreshAll();
  });

  document.getElementById('schoolImportForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const school = document.getElementById('importSchoolSelect').value.trim();
    const type = document.getElementById('importSourceType').value;
    const label = document.getElementById('importLabel').value.trim();
    const fileInput = document.getElementById('schoolImportFile');
    const statusNode = document.getElementById('schoolImportStatus');
    const file = fileInput.files?.[0];
    if (!school || !file) {
      statusNode.textContent = 'Selecione uma escola e um arquivo antes de importar.';
      return;
    }
    statusNode.textContent = 'Processando arquivo...';
    try {
      const parsed = await extractImportPreview(file, type);
      state.schoolImports.unshift({
        id: uid(),
        school,
        type,
        label: label || file.name,
        filename: file.name,
        importedAt: timestampLabel(),
        summary: parsed.summary,
        preview: parsed.preview,
        reviewStatus: 'approved'
      });
      logSchoolEvent(school, 'import', `Arquivo importado manualmente: ${label || file.name}.`);
      event.target.reset();
      fileInput.value = '';
      statusNode.textContent = `Importacao concluida para ${school}.`;
      refreshAll();
    } catch (error) {
      statusNode.textContent = `Falha ao processar arquivo: ${error.message}`;
    }
  });

  document.getElementById('supervisorVisitForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const supervisor = document.getElementById('visitSupervisorSelect').value;
    const school = document.getElementById('visitSchoolSelect').value;
    const date = document.getElementById('visitDate').value || new Date().toISOString().slice(0, 10);
    const type = document.getElementById('visitType').value;
    const notes = document.getElementById('visitNotes').value.trim();
    if (!supervisor || !school) return;
    state.supervisorVisits.unshift({ id: uid(), supervisor, school, date, type, notes });
    event.target.reset();
    refreshAll();
  });

  document.getElementById('supervisorRecordVisitFormElement')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!currentSupervisorDetail) return;
    const school = document.getElementById('recordVisitSchoolSelect').value;
    const date = document.getElementById('recordVisitDate').value || new Date().toISOString().slice(0, 10);
    const type = document.getElementById('recordVisitType').value;
    const notes = document.getElementById('recordVisitNotes').value.trim();
    if (!school) return;
    state.supervisorVisits.unshift({ id: uid(), supervisor: currentSupervisorDetail, school, date, type, notes });
    event.target.reset();
    renderSupervisorRecord();
    refreshAll();
  });

  document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const error = document.getElementById('loginError');
    let user = findLoginUser(name, pin);
    if (!user && canUseLocalApi()) {
      try {
        const payload = await apiRequest('/api/state');
        state = mergeState(payload.state || payload);
        refreshAll();
        user = findLoginUser(name, pin);
      } catch {
        // Login continues with the local browser state when the API is unavailable.
      }
    }
    if (user) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      sessionStorage.setItem(ACTIVE_USER_KEY, user.id);
      setLoginVisible(false);
      error.textContent = '';
      error.classList.remove('show');
      currentPage = defaultPageForUser();
      refreshAll();
      showPage(currentPage);
      return;
    }
    error.textContent = loginNameExists(name)
      ? 'PIN incorreto para este usuario.'
      : 'Usuario nao encontrado. Confira o login ou nome cadastrado.';
    error.classList.add('show');
  });

  document.getElementById('backupBtn')?.addEventListener('click', exportJson);
  document.getElementById('exportSummaryBtn')?.addEventListener('click', exportSummary);
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    logoutToLogin();
  });
  document.querySelectorAll('.logout-action').forEach((button) => {
    button.addEventListener('click', logoutToLogin);
  });
  document.getElementById('accountMenuBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleAccountMenu();
  });
  document.getElementById('accountOpenBtn')?.addEventListener('click', () => {
    closeAccountMenu();
    showPage('settings');
  });
  document.getElementById('accountAdminBtn')?.addEventListener('click', () => {
    closeAccountMenu();
    showPage('admin');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.acct-area')) closeAccountMenu();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAccountMenu();
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!canManageUsers()) return;
    state = createDefaults();
    redePreview = [];
    refreshAll();
  });
  document.getElementById('restoreInput').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) restoreState(file);
    event.target.value = '';
  });
  document.getElementById('copyRedeCommandBtn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildRedeCommand());
      alert('Comando copiado para a area de transferencia.');
    } catch {
      alert('Nao foi possivel copiar automaticamente.');
    }
  });
  document.getElementById('importLegacyBtn').addEventListener('click', importLegacyState);
  document.getElementById('exportRedeBatchBtn').addEventListener('click', () => {
    downloadFile('setechub-redes-lote.json', JSON.stringify({
      generatedAt: new Date().toISOString(),
      config: state.redes,
      preview: redePreview
    }, null, 2), 'application/json');
  });
  document.getElementById('redeFolderInput').addEventListener('change', (event) => {
    const files = Array.from(event.target.files || []);
    redePreview = files
      .filter((file) => /\.(doc|docx)$/i.test(file.name))
      .map((file) => ({
        ...parseRedeFilename(file.name, state.redes.yearSuffix),
        extension: file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '',
        relativePath: file.webkitRelativePath || file.name
      }))
      .sort((a, b) => {
        if (!a.valid && !b.valid) return a.originalName.localeCompare(b.originalName);
        if (!a.valid) return 1;
        if (!b.valid) return -1;
        return Number(a.sequence) - Number(b.sequence);
      });
    renderRedePreview();
    event.target.value = '';
  });

  document.getElementById('saveServerBtn').addEventListener('click', saveStateToServer);
  document.getElementById('loadServerBtn').addEventListener('click', loadStateFromServer);
  document.getElementById('refreshSnapshotsBtn').addEventListener('click', loadServerSnapshots);
  document.getElementById('saveSupabaseBtn')?.addEventListener('click', saveStateToSupabase);
  document.getElementById('loadSupabaseBtn')?.addEventListener('click', loadStateFromSupabase);
  document.getElementById('checkSupabaseBtn')?.addEventListener('click', checkSupabaseConnection);
  document.getElementById('seedSupervisorVisitsBtn')?.addEventListener('click', addSupervisorTestVisits);
  document.getElementById('randomUserPinBtn')?.addEventListener('click', fillRandomUserPin);
  document.getElementById('cancelUserEditBtn')?.addEventListener('click', cancelUserEdit);
  document.getElementById('adminSchoolPicker')?.addEventListener('change', (event) => {
    if (event.target.value) editAdminSchool(event.target.value);
    else clearAdminSchoolForm();
  });
  document.getElementById('adminSchoolForm')?.addEventListener('submit', saveAdminSchool);
  document.getElementById('clearAdminSchoolBtn')?.addEventListener('click', clearAdminSchoolForm);
  document.getElementById('mergeSchoolsBtn')?.addEventListener('click', mergeAdminSchools);
  document.getElementById('userForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManageUsers()) return;
    const editingId = document.getElementById('editingUserId').value;
    const name = document.getElementById('userName').value.trim();
    const login = document.getElementById('userLogin').value.trim() || name;
    const pin = document.getElementById('userPin').value.trim() || '1234';
    const role = document.getElementById('userRole').value;
    const supervisorName = document.getElementById('userSupervisorName').value;
    if (!name || !login) return;
    const existing = editingId
      ? (state.users || []).find((item) => item.id === editingId)
      : (state.users || []).find((item) => normalizeKey(item.login || item.name) === normalizeKey(login));
    const loginTaken = (state.users || []).some((item) =>
      item.id !== editingId && normalizeKey(item.login || item.name) === normalizeKey(login)
    );
    if (loginTaken) {
      alert('Ja existe um usuario com este login.');
      return;
    }
    const nextUser = {
      id: existing?.id || `user-${uid()}`,
      name,
      login,
      pin,
      role,
      supervisorName: role === 'supervisor' ? supervisorName || name : '',
      active: existing?.active === false ? false : true
    };
    state.users = existing
      ? state.users.map((item) => item.id === existing.id ? nextUser : item)
      : [nextUser, ...(state.users || [])];
    event.target.reset();
    setUserEditMode(null);
    refreshAll();
  });
  document.getElementById('supabaseConfigForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManageUsers()) return;
    saveSupabaseConfig({
      url: document.getElementById('supabaseUrl').value.trim(),
      anonKey: document.getElementById('supabaseAnonKey').value.trim()
    });
    updateSupabaseStatus('Configuracao Supabase salva neste navegador.', true);
  });
  document.getElementById('copySchoolSummaryBtn').addEventListener('click', copySchoolSummary);
  document.getElementById('openSchoolMapsBtn').addEventListener('click', () => {
    const profile = currentSchoolProfile();
    const school = state.schools.find((item) => item.name === currentSchoolDetail);
    const query = profile?.address || `${school?.name || ''} ${school?.zone || ''} São Paulo`;
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(query)}`, '_blank', 'noopener');
  });

  document.querySelectorAll('.nav-item, .fn-item').forEach((button) => {
    if (button.dataset.page) {
      button.addEventListener('click', (event) => {
        if (button.classList.contains('nav-disabled')) {
          event.preventDefault();
          return;
        }
        openMainNavigationPage(button.dataset.page);
      });
    }
  });
  document.addEventListener('click', (event) => {
    const navButton = event.target.closest('.nav-item[data-page], .fn-item[data-page]');
    if (!navButton) return;
    event.preventDefault();
    if (navButton.classList.contains('nav-disabled')) return;
    openMainNavigationPage(navButton.dataset.page);
  });

  document.querySelectorAll('[data-task-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentTaskFilter = button.dataset.taskFilter;
      syncFilterButtons('task');
      renderTasks();
    });
  });

  document.querySelectorAll('[data-call-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentCallFilter = button.dataset.callFilter;
      syncFilterButtons('call');
      renderCalls();
    });
  });

  document.querySelectorAll('[data-school-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentSchoolFilter = button.dataset.schoolFilter;
      syncFilterButtons('school');
      renderSchools();
      saveUiContext();
    });
  });

  document.getElementById('schoolMasterSearch')?.addEventListener('input', (event) => {
    currentSchoolSearch = event.target.value.trim();
    renderSchools();
    saveUiContext();
  });

  document.getElementById('schoolSortSelect')?.addEventListener('change', (event) => {
    currentSchoolSort = event.target.value;
    renderSchools();
    saveUiContext();
  });

  document.getElementById('supervisorFilterSelect')?.addEventListener('change', (event) => {
    const supervisor = (state.supervisors || []).find((item) => normalizeKey(item.name) === event.target.value);
    if (supervisor) openSupervisorRecord(supervisor.name);
  });

  document.getElementById('visitSupervisorSelect')?.addEventListener('change', renderSupervisors);
  document.getElementById('openSupervisorSelectedBtn')?.addEventListener('click', () => {
    const name = document.getElementById('supervisorRecordSelect')?.value;
    if (name) openSupervisorRecord(name);
  });
  document.getElementById('supervisorRecordSelect')?.addEventListener('change', (event) => {
    openSupervisorRecord(event.target.value);
  });

  document.querySelectorAll('[data-directory-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentDirectoryFilter = button.dataset.directoryFilter;
      syncFilterButtons('directory');
      renderDirectoryContacts();
    });
  });

  document.querySelectorAll('[data-asset-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentAssetFilter = button.dataset.assetFilter;
      syncFilterButtons('asset');
      renderAssets();
    });
  });

  document.querySelectorAll('[data-import-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentImportFilter = button.dataset.importFilter;
      syncFilterButtons('import');
      renderSchoolImports();
    });
  });

  document.querySelectorAll('[data-inventory-status]').forEach((button) => {
    button.addEventListener('click', () => {
      currentInventoryStatus = button.dataset.inventoryStatus;
      syncFilterButtons('inventory');
      renderAssets();
    });
  });

  document.getElementById('schoolZoneFilterSelect')?.addEventListener('change', (event) => {
    currentSchoolZoneFilter = event.target.value;
    renderSchools();
    saveUiContext();
  });

  document.getElementById('inventorySchoolSelect')?.addEventListener('change', (event) => {
    currentInventorySchool = event.target.value;
    renderAssets();
  });

  document.getElementById('inventoryCategorySelect')?.addEventListener('change', (event) => {
    currentInventoryCategory = event.target.value;
    renderAssets();
  });

  document.getElementById('inventorySearchInput')?.addEventListener('input', (event) => {
    currentInventorySearch = event.target.value.trim();
    renderAssets();
  });
}
