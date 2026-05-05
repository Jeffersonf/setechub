'use strict';

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function fileSafeName(value) {
  return normalizeKey(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'sem-assunto';
}

function applyProfilePhotoPreview(photo) {
  const preview = document.getElementById('profilePhotoPreview');
  const user = currentUser();
  if (!preview || !user) return;
  setAvatarNode(preview, { ...user, photo });
}

function readProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Selecione um arquivo de imagem.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Nao foi possivel carregar a imagem.'));
      image.onload = () => {
        const maxSide = 360;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#10141f';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function collectRedeDraftForm() {
  return {
    draftNumber: document.getElementById('redeDraftNumber')?.value.trim() || '',
    draftDate: document.getElementById('redeDraftDate')?.value || '',
    draftHeading: document.getElementById('redeDraftHeading')?.value.trim() || 'Diretoria de Ensino - Região de Itapeva',
    draftDestination: document.getElementById('redeDraftDestination')?.value.trim() || '',
    draftSubject: document.getElementById('redeDraftSubject')?.value.trim() || '',
    draftBody: document.getElementById('redeDraftBody')?.value.trim() || ''
  };
}

function saveRedeDraftForm() {
  state.redes = {
    ...state.redes,
    ...collectRedeDraftForm()
  };
  const preview = document.getElementById('redeDraftPreview');
  if (preview) preview.innerHTML = buildRedeDraftHtml(redeDraftDataFromState());
}

function downloadRedeDraft() {
  saveRedeDraftForm();
  const draft = redeDraftDataFromState();
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #111; line-height: 1.45; margin: 48px; }
        .rede-doc-heading { text-align: center; font-weight: 700; font-size: 16pt; margin-bottom: 28px; }
        .rede-doc-line { margin: 8px 0; }
        .rede-doc-subject { margin: 22px 0; font-weight: 400; }
        .rede-doc-body { margin-top: 22px; white-space: normal; }
      </style>
    </head>
    <body>${buildRedeDraftHtml(draft)}</body>
    </html>
  `;
  const number = fileSafeName(draft.number || 'rede');
  const subject = fileSafeName(draft.subject || 'assunto');
  downloadFile(`REDE_${number}_${subject}.doc`, html, 'application/msword;charset=utf-8');
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
    `Ativos em manutencao/defeito: ${state.assets.filter((item) => item.status !== 'ok').length}`,
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

function normalizePin(value, fallback = '1234') {
  const pin = String(value || '').replace(/\D/g, '').slice(0, 4);
  return pin || fallback;
}

function randomPin(length = 4) {
  const digits = '0123456789';
  return Array.from({ length }, () => digits[Math.floor(Math.random() * digits.length)]).join('');
}

function fillRandomUserPin() {
  const input = document.getElementById('userPin');
  if (input) input.value = randomPin();
}

let pendingPinChangeUserId = '';

function restrictPinInput(event) {
  event.target.value = String(event.target.value || '').replace(/\D/g, '').slice(0, 4);
}

function showForcePinForm(user) {
  pendingPinChangeUserId = user?.id || '';
  const loginForm = document.getElementById('loginForm');
  const forceForm = document.getElementById('forcePinForm');
  const title = document.getElementById('loginTitle');
  const intro = document.querySelector('.setup-auth-intro');
  const error = document.getElementById('forcePinError');
  if (loginForm) loginForm.hidden = true;
  if (forceForm) forceForm.hidden = false;
  if (title) title.textContent = 'Crie um novo PIN';
  if (intro) intro.textContent = 'Seu acesso ainda usa o PIN padrão 1234. Escolha um novo PIN de 4 dígitos para continuar.';
  if (error) {
    error.textContent = '';
    error.classList.remove('show');
  }
  document.getElementById('forcePinNew')?.focus();
}

function resetLoginPinForm() {
  pendingPinChangeUserId = '';
  const loginForm = document.getElementById('loginForm');
  const forceForm = document.getElementById('forcePinForm');
  const title = document.getElementById('loginTitle');
  const intro = document.querySelector('.setup-auth-intro');
  if (loginForm) loginForm.hidden = false;
  if (forceForm) {
    forceForm.hidden = true;
    forceForm.reset();
  }
  if (title) title.textContent = 'Entrar no PainelURE';
  if (intro) intro.textContent = 'Use seu nome de acesso e PIN. A base online vai substituir o armazenamento local nas próximas etapas.';
}

function completeLogin(user) {
  sessionStorage.setItem(SESSION_KEY, 'ok');
  sessionStorage.setItem(ACTIVE_USER_KEY, user.id);
  setLoginVisible(false);
  resetLoginPinForm();
  currentPage = defaultPageForUser();
  refreshAll();
  showPage(currentPage);
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
  resetLoginPinForm();
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
      date: new Date().toISOString().slice(0, 10),
      priority: school.status === 'critico' ? 'alta' : 'media',
      place: school.name,
      category: 'Visita',
      scope: 'pessoal',
      owner: currentUser()?.name || state.profile.name,
      createdBy: currentUser()?.name || state.profile.name,
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
  if (name !== 'todas' && !canViewSchool(name)) {
    showPage('schools');
    return;
  }
  currentInventorySchool = name;
  currentInventorySearch = '';
  showPage('assets');
  renderAssets();
  saveUiContext();
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
    currentInventoryZone = 'todas';
    currentInventorySupervisor = 'todos';
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

function saveSchoolSupervisor(event) {
  event.preventDefault();
  if (!canManageUsers()) return;
  const supervisorName = document.getElementById('schoolSupervisorSelect')?.value || '';
  assignSchoolSupervisor(currentSchoolDetail, supervisorName);
  refreshAll();
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
  const supervisors = (state.supervisors || [])
    .filter((supervisor) => (supervisor.schools || []).includes(currentSchoolDetail))
    .map((supervisor) => supervisor.name);
  if (!school) return;
  const summary = [
    school.name,
    `Municipio: ${school.zone}`,
    `Status: ${badgeText(school.status)}`,
    `Supervisao: ${supervisors.length ? supervisors.join(', ') : 'Sem supervisor vinculado'}`,
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

const externalScriptPromises = {};

function loadExternalScript(globalName, src) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!externalScriptPromises[globalName]) {
    externalScriptPromises[globalName] = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(window[globalName]);
      script.onerror = () => reject(new Error(`Falha ao carregar ${globalName}.`));
      document.head.appendChild(script);
    });
  }
  return externalScriptPromises[globalName];
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
    try {
      await loadExternalScript('XLSX', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const buffer = await readFileAsArrayBuffer(file);
      const workbook = window.XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      const csv = window.XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet]);
      const rows = csv.split(/\r?\n/).filter(Boolean);
      return {
        preview: rows.slice(0, 12).join('\n'),
        summary: `${workbook.SheetNames.length} aba(s) | ${rows.length} linhas`
      };
    } catch (error) {
      console.warn('Falha ao carregar leitor de planilhas.', error);
    }
    const text = await readFileAsText(file);
    return {
      preview: text.slice(0, 1800),
      summary: 'Leitura basica'
    };
  }
  if (type === 'image') {
    try {
      await loadExternalScript('Tesseract', 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
      const result = await window.Tesseract.recognize(file, 'por');
      const text = result?.data?.text || '';
      return {
        preview: text.slice(0, 1800),
        summary: text.trim() ? 'OCR concluido' : 'Imagem sem texto reconhecido'
      };
    } catch (error) {
      console.warn('Falha ao carregar OCR.', error);
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

function excelSerialDateToIso(value) {
  const serial = Number(value);
  if (!Number.isFinite(serial) || serial < 30000) return '';
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return date.toISOString().slice(0, 10);
}

function excelTimeToLabel(value) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    const fraction = value >= 1 ? value % 1 : value;
    if (!fraction) return String(value);
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return String(value).trim();
}

function fleetCellText(value) {
  return String(value ?? '').trim();
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthBounds(date = new Date()) {
  const start = localIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const today = localIsoDate(date);
  const end = localIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { start: today > start ? today : start, end };
}

function fleetEventInsideCurrentWindow(item, date = new Date()) {
  if (!item?.date) return false;
  const bounds = currentMonthBounds(date);
  return item.date >= bounds.start && item.date <= bounds.end;
}

function isImportedFleetTask(item) {
  return normalizeKey(item?.source || '').startsWith('frota excel');
}

function pruneImportedFleetTasks() {
  state.tasks = (state.tasks || []).filter((task) => !isImportedFleetTask(task) || fleetEventInsideCurrentWindow(task));
}

function fleetVehicleFromRow(row, dataIndex) {
  const candidates = [
    { header: row[dataIndex - 2], mark: row[dataIndex - 2] },
    { header: row[dataIndex - 1], mark: row[dataIndex - 1] }
  ];
  const headerRow = row.__headerRow || [];
  const marked = candidates.find((item, offset) => /x/i.test(fleetCellText(item.mark)) && headerRow[dataIndex - 2 + offset]);
  if (marked) return fleetCellText(headerRow[dataIndex - 2 + candidates.indexOf(marked)]);
  return [headerRow[dataIndex - 2], headerRow[dataIndex - 1]].map(fleetCellText).filter(Boolean).join(' / ') || 'Carro oficial';
}

function parseFleetWorksheetRows(rows, sheetName) {
  const events = [];
  let activeHeaders = [];
  rows.forEach((row) => {
    const normalized = row.map((cell) => normalizeKey(cell));
    const dataIndexes = normalized
      .map((cell, index) => cell === 'data' ? index : -1)
      .filter((index) => index >= 0 && /horario|horário/.test(normalized[index + 1] || ''));
    if (dataIndexes.length) {
      activeHeaders = row;
      return;
    }
    if (!activeHeaders.length) return;
    const headerDataIndexes = activeHeaders
      .map((cell, index) => normalizeKey(cell) === 'data' ? index : -1)
      .filter((index) => index >= 0 && /horario|horário/.test(normalizeKey(activeHeaders[index + 1] || '')));
    headerDataIndexes.forEach((dataIndex) => {
      const dateRaw = row[dataIndex];
      const requester = fleetCellText(row[dataIndex + 2]);
      const driver = fleetCellText(row[dataIndex + 3]);
      const authorization = fleetCellText(row[dataIndex + 4]);
      const destination = fleetCellText(row[dataIndex + 5]);
      const reason = fleetCellText(row[dataIndex + 6]);
      if (!dateRaw && !requester && !destination && !reason) return;
      const date = excelSerialDateToIso(dateRaw);
      const rawDate = date ? '' : fleetCellText(dateRaw);
      const rowWithHeader = [...row];
      rowWithHeader.__headerRow = activeHeaders;
      const vehicle = fleetVehicleFromRow(rowWithHeader, dataIndex);
      events.push({
        id: `fleet-${sheetName}-${dataIndex}-${fleetCellText(dateRaw)}-${requester}-${destination}`.toLowerCase(),
        title: reason || `Reserva de ${vehicle}`,
        date,
        rawDate,
        time: excelTimeToLabel(row[dataIndex + 1]),
        priority: 'media',
        place: destination || 'Destino nao informado',
        category: 'Carro oficial',
        scope: 'carro',
        owner: requester || driver || 'Frota URE',
        createdBy: 'Importacao frota',
        vehicle,
        driver,
        authorization,
        done: /cancelado/i.test(authorization),
        source: `Frota Excel - ${sheetName}`
      });
    });
  });
  return events;
}

async function importFleetSchedule(file) {
  const status = document.getElementById('fleetImportStatus');
  if (status) status.textContent = 'Lendo planilha da frota para montar o calendario...';
  try {
    await loadExternalScript('XLSX', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = window.XLSX.read(buffer, { type: 'array' });
    const imported = workbook.SheetNames.flatMap((sheetName) => {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
      return parseFleetWorksheetRows(rows, sheetName);
    });
    const inWindow = imported.filter((item) => fleetEventInsideCurrentWindow(item));
    pruneImportedFleetTasks();
    const existingKeys = new Set((state.tasks || []).map((item) => normalizeKey(item.fleetKey || `${item.source || ''}|${item.date || item.rawDate || ''}|${item.time || ''}|${item.vehicle || ''}|${item.owner || ''}|${item.place || ''}|${item.title || ''}`)));
    const nextEvents = inWindow
      .map((item) => ({
        ...item,
        fleetKey: normalizeKey(`${item.source}|${item.date || item.rawDate}|${item.time}|${item.vehicle}|${item.owner}|${item.place}|${item.title}`)
      }))
      .filter((item) => !existingKeys.has(item.fleetKey));
    state.tasks = [...nextEvents, ...(state.tasks || [])];
    currentTaskFilter = 'carro';
    refreshAll();
    showPage('agenda');
    if (status) status.textContent = `${nextEvents.length} reserva(s) do mes atual importada(s). ${imported.length - inWindow.length} linha(s) antigas/fora do mes ignorada(s).`;
  } catch (error) {
    console.error('Falha ao importar planilha da frota.', error);
    if (status) status.textContent = 'Nao foi possivel importar a planilha da frota.';
  }
}

function normalizeExcelHeader(value) {
  return normalizeKey(value).replace(/\s+/g, ' ');
}

function excelHeaderIndex(headers, patterns) {
  return headers.findIndex((header) => patterns.some((pattern) => pattern.test(normalizeExcelHeader(header))));
}

function inventoryStatusFromExcel(value) {
  const text = normalizeKey(value);
  if (/funcionando|ativo|ok/.test(text)) return 'ok';
  if (/manut|garantia/.test(text)) return 'manutencao';
  return 'defeito';
}

function inventoryImportTargetSchool(fileName, rows, schoolIndex) {
  const fromSheet = rows
    .map((row) => schoolIndex >= 0 ? row[schoolIndex] : '')
    .find((value) => String(value || '').trim());
  const text = `${fromSheet || ''} ${fileName || ''}`;
  if (/idalicio/i.test(text)) return 'PEI EE Idalicio Mendes Lima';
  return canonicalSchoolName(fromSheet) || document.getElementById('schoolAssetBulkSchool')?.value || document.getElementById('schoolAssetSchool')?.value || '';
}

function parseInventoryExcelRows(workbook, fileName) {
  const candidates = [];
  workbook.SheetNames.forEach((sheetName) => {
    const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
    const headerIndex = rows.findIndex((row) => row.some((cell) => /equipamento/i.test(String(cell || ''))) && row.some((cell) => /status/i.test(String(cell || ''))));
    if (headerIndex < 0) return;
    const headers = rows[headerIndex];
    const equipmentIndex = excelHeaderIndex(headers, [/^equipamento$/, /equipamento/]);
    const statusIndex = excelHeaderIndex(headers, [/status/]);
    if (equipmentIndex < 0 || statusIndex < 0) return;
    const schoolIndex = excelHeaderIndex(headers, [/^escola$/, /unidade/]);
    const serialIndex = excelHeaderIndex(headers, [/serie/, /serial/]);
    const patrimonyIndex = excelHeaderIndex(headers, [/patrimonio/]);
    const notesIndex = excelHeaderIndex(headers, [/observacao/, /informacao/]);
    const school = inventoryImportTargetSchool(fileName, rows.slice(headerIndex + 1), schoolIndex);
    rows.slice(headerIndex + 1).forEach((row) => {
      const rawName = String(row[equipmentIndex] || '').trim();
      if (!rawName) return;
      candidates.push({
        school,
        rawName,
        name: simplifiedEquipmentName({ name: rawName }),
        status: inventoryStatusFromExcel(row[statusIndex]),
        originalStatus: String(row[statusIndex] || '').trim() || 'Nao informado',
        serial: serialIndex >= 0 ? String(row[serialIndex] || '').trim() : '',
        patrimony: patrimonyIndex >= 0 ? String(row[patrimonyIndex] || '').trim() : '',
        notes: notesIndex >= 0 ? String(row[notesIndex] || '').trim() : ''
      });
    });
  });
  return candidates.filter((item) => item.school && item.name && item.name !== 'outros');
}

async function importSchoolInventoryExcel(file) {
  const statusNode = document.getElementById('schoolAssetBulkStatus');
  if (statusNode) statusNode.textContent = 'Lendo inventario Excel e consolidando por tipo/status...';
  try {
    await loadExternalScript('XLSX', 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = window.XLSX.read(buffer, { type: 'array' });
    const rows = parseInventoryExcelRows(workbook, file?.name || '');
    if (!rows.length) {
      if (statusNode) statusNode.textContent = 'Nenhuma linha de inventario reconhecida no Excel.';
      return;
    }
    const groups = new Map();
    rows.forEach((row) => {
      const key = normalizeKey(`${row.school}|${row.name}|${row.status}`);
      const current = groups.get(key) || { ...row, quantity: 0, samples: [], statusCounts: new Map() };
      current.quantity += 1;
      if (current.samples.length < 6) current.samples.push([row.rawName, row.originalStatus, row.serial || row.patrimony].filter(Boolean).join(' | '));
      current.statusCounts.set(row.originalStatus, (current.statusCounts.get(row.originalStatus) || 0) + 1);
      groups.set(key, current);
    });
    const imported = Array.from(groups.values()).map((group) => {
      const sourceSummary = Array.from(group.statusCounts.entries()).map(([label, count]) => `${label}: ${count}`).join(', ');
      return {
        id: `excel-inventory-${normalizeKey(group.school)}-${normalizeKey(group.name)}-${group.status}-${uid()}`,
        school: group.school,
        name: group.name,
        status: group.status,
        notes: formatSchoolAssetNotes(`Importado Excel | ${sourceSummary}${group.samples.length ? ` | Amostras: ${group.samples.join('; ')}` : ''}`, group.quantity)
      };
    });
    const affectedSchools = new Set(imported.map((item) => normalizeKey(item.school)));
    state.schoolAssets = (state.schoolAssets || []).filter((item) => {
      if (!affectedSchools.has(normalizeKey(item.school))) return true;
      return false;
    });
    state.inventoryReplacementSchools = Array.from(new Set([
      ...(state.inventoryReplacementSchools || []),
      ...imported.map((item) => item.school)
    ]));
    state.schoolAssets = [...imported, ...state.schoolAssets];
    currentInventorySchool = imported[0]?.school || currentInventorySchool;
    currentInventoryStatus = 'todos';
    currentInventoryCategory = 'todas';
    logSchoolEvent(imported[0].school, 'inventory', `Inventario Excel importado em ${imported.length} linha(s) consolidada(s).`);
    refreshAll();
    showPage('assets');
    if (statusNode) statusNode.textContent = `${rows.length} item(ns) lidos e salvos em ${imported.length} linha(s) consolidadas.`;
  } catch (error) {
    console.error('Falha ao importar inventario Excel.', error);
    if (statusNode) statusNode.textContent = 'Nao foi possivel importar o inventario Excel.';
  }
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
    const user = currentUser();
    const owner = document.getElementById('taskOwner').value || user?.name || state.profile.name;
    const scope = document.getElementById('taskScope').value;
    const selectedCategory = document.getElementById('taskCategory').value;
    const category = scope === 'pessoal' ? 'Pessoal' : scope === 'carro' ? 'Carro oficial' : selectedCategory;
    state.tasks.unshift({
      id: uid(),
      title,
      date: document.getElementById('taskDate').value,
      time: document.getElementById('taskTime').value,
      priority: document.getElementById('taskPriority').value,
      place: document.getElementById('taskPlace').value.trim() || 'Sem local definido',
      category,
      scope,
      owner,
      createdBy: user?.name || state.profile.name,
      vehicle: document.getElementById('taskVehicle').value.trim(),
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
      scope: 'ure',
      owner,
      createdBy: currentUser()?.name || state.profile.name,
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
  document.getElementById('schoolSupervisorForm')?.addEventListener('submit', saveSchoolSupervisor);

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
      numberPlaceholder: state.redes.numberPlaceholder || '{{REDE_NUMERO}}',
      datePlaceholder: state.redes.datePlaceholder || '{{REDE_DATA}}',
      headingPlaceholder: state.redes.headingPlaceholder || '{{REDE_CABECALHO}}',
      assuntoLabel: state.redes.assuntoLabel || 'Assunto:',
      processStartNumber: state.redes.processStartNumber || '',
      processDate: state.redes.processDate || '',
      ...collectRedeDraftForm()
    };
    refreshAll();
    alert('Configuracao de redes salva.');
  });

  document.getElementById('profileForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('profileName').value.trim();
    const pin = document.getElementById('profilePin').value.trim();
    const photo = document.getElementById('profilePhotoPreview')?.dataset.photo || '';
    const user = currentUser();
    if (!name || !pin || !user) return;
    state.users = (state.users || []).map((item) =>
      item.id === user.id ? { ...item, name, login: item.login || name, pin, photo } : item
    );
    if (user.role === 'admin') state.profile = { ...state.profile, name, pin, photo };
    refreshAll();
    alert('Perfil atualizado.');
  });

  document.getElementById('officialForm')?.addEventListener('submit', (event) => {
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

  document.getElementById('monthlySupervisorSheetForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManageUsers()) return;
    const monthKey = document.getElementById('monthlySupervisorSheetMonth')?.value || '';
    const url = document.getElementById('monthlySupervisorSheetUrl')?.value.trim() || '';
    const customLabel = document.getElementById('monthlySupervisorSheetLabel')?.value.trim() || '';
    if (!monthKey || !url) {
      alert('Informe o mes e o link da planilha.');
      return;
    }
    const label = customLabel || `Planilha supervisores - ${supervisorSheetMonthLabel(monthKey)}`;
    const existing = (state.officialLinks || []).find((item) =>
      item.category === 'supervisor-sheet' && item.monthKey === monthKey
    );
    const panelGid = googleSheetGidFromUrl(url);
    if (existing) {
      state.officialLinks = state.officialLinks.map((item) =>
        item.id === existing.id ? { ...item, label, url, category: 'supervisor-sheet', monthKey, panelGid } : item
      );
    } else {
      state.officialLinks.unshift({ id: uid(), label, url, category: 'supervisor-sheet', monthKey, panelGid });
    }
    event.target.reset();
    refreshAll();
  });

  document.getElementById('sectorForm')?.addEventListener('submit', (event) => {
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
      error.textContent = '';
      error.classList.remove('show');
      if (String(user.pin || '') === '1234') {
        showForcePinForm(user);
        return;
      }
      completeLogin(user);
      return;
    }
    error.textContent = loginNameExists(name)
      ? 'PIN incorreto para este usuario.'
      : 'Usuario nao encontrado. Confira o login ou nome cadastrado.';
    error.classList.add('show');
  });
  document.querySelectorAll('#loginForm .sinp').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    });
  });

  document.getElementById('forcePinForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const pin = normalizePin(document.getElementById('forcePinNew').value, '');
    const confirmPin = normalizePin(document.getElementById('forcePinConfirm').value, '');
    const error = document.getElementById('forcePinError');
    const user = (state.users || []).find((item) => item.id === pendingPinChangeUserId);
    const fail = (message) => {
      if (!error) return;
      error.textContent = message;
      error.classList.add('show');
    };
    if (!user) {
      fail('Sessao expirada. Entre novamente.');
      resetLoginPinForm();
      return;
    }
    if (pin.length !== 4 || confirmPin.length !== 4) {
      fail('O novo PIN precisa ter exatamente 4 digitos.');
      return;
    }
    if (pin === '1234') {
      fail('Escolha um PIN diferente de 1234.');
      return;
    }
    if (pin !== confirmPin) {
      fail('Os PINs nao conferem.');
      return;
    }
    state.users = (state.users || []).map((item) => item.id === user.id ? { ...item, pin } : item);
    if (user.role === 'admin') state.profile = { ...state.profile, pin };
    saveState();
    completeLogin({ ...user, pin });
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
  document.getElementById('sidebarSearch')?.addEventListener('input', (event) => {
    handleSearch(event.target.value);
  });
  document.getElementById('profilePhotoInput')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      applyProfilePhotoPreview(await readProfilePhoto(file));
    } catch (error) {
      alert(error.message || 'Nao foi possivel carregar a foto.');
    } finally {
      event.target.value = '';
    }
  });
  document.getElementById('removeProfilePhotoBtn')?.addEventListener('click', () => {
    applyProfilePhotoPreview('');
  });
  document.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-open-page]');
    if (!pageButton) return;
    event.preventDefault();
    showPage(pageButton.dataset.openPage);
  });
  document.addEventListener('click', (event) => {
    const shiftButton = event.target.closest('[data-focus-shift]');
    if (!shiftButton) return;
    event.preventDefault();
    shiftFocusCard(Number(shiftButton.dataset.focusShift || 0));
  });
  document.addEventListener('click', (event) => {
    const scrollButton = event.target.closest('[data-scroll-target]');
    if (!scrollButton) return;
    event.preventDefault();
    document.getElementById(scrollButton.dataset.scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('click', (event) => {
    const focusButton = event.target.closest('[data-focus-target]');
    if (!focusButton) return;
    event.preventDefault();
    document.getElementById(focusButton.dataset.focusTarget)?.focus();
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
  document.getElementById('fleetScheduleInput')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importFleetSchedule(file);
    event.target.value = '';
  });
  document.getElementById('schoolAssetExcelInput')?.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) importSchoolInventoryExcel(file);
    event.target.value = '';
  });
  document.getElementById('copyRedeCommandBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(buildRedeCommand());
      alert('Comando copiado para a area de transferencia.');
    } catch {
      alert('Nao foi possivel copiar automaticamente.');
    }
  });
  document.getElementById('processRedeBtn')?.addEventListener('click', processRedesOnServer);
  document.getElementById('importLegacyBtn').addEventListener('click', importLegacyState);
  document.getElementById('exportRedeBatchBtn')?.addEventListener('click', () => {
    downloadFile('setechub-redes-lote.json', JSON.stringify({
      generatedAt: new Date().toISOString(),
      config: state.redes,
      preview: redePreview
    }, null, 2), 'application/json');
  });
  document.getElementById('previewRedeDraftBtn')?.addEventListener('click', () => {
    saveRedeDraftForm();
    refreshAll();
  });
  document.getElementById('downloadRedeDraftBtn')?.addEventListener('click', downloadRedeDraft);
  document.getElementById('redeDraftForm')?.addEventListener('input', () => {
    saveRedeDraftForm();
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
  document.getElementById('syncSupervisorSourcesBtn')?.addEventListener('click', syncSupervisorVisitSources);
  document.getElementById('supervisorFullscreenBtn')?.addEventListener('click', toggleSupervisorPanelFullscreen);
  document.getElementById('refreshSupervisorSheetBtn')?.addEventListener('click', syncCurrentSupervisorVisitSource);
  document.getElementById('randomUserPinBtn')?.addEventListener('click', fillRandomUserPin);
  document.getElementById('userPin')?.addEventListener('input', restrictPinInput);
  document.getElementById('forcePinNew')?.addEventListener('input', restrictPinInput);
  document.getElementById('forcePinConfirm')?.addEventListener('input', restrictPinInput);
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
    const pin = normalizePin(document.getElementById('userPin').value);
    const role = document.getElementById('userRole').value;
    const supervisorName = document.getElementById('userSupervisorName').value;
    if (!name || !login) return;
    if (pin.length !== 4) {
      alert('O PIN precisa ter exatamente 4 digitos.');
      return;
    }
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

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-directory-filter]');
    if (!button) return;
    currentDirectoryFilter = button.dataset.directoryFilter;
    syncFilterButtons('directory');
    renderDirectoryContacts();
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
    saveUiContext();
  });

  document.getElementById('inventoryZoneSelect')?.addEventListener('change', (event) => {
    currentInventoryZone = event.target.value;
    currentInventorySchool = 'todas';
    renderAssets();
    saveUiContext();
  });

  document.getElementById('inventorySupervisorSelect')?.addEventListener('change', (event) => {
    currentInventorySupervisor = event.target.value;
    currentInventorySchool = 'todas';
    renderAssets();
    saveUiContext();
  });

  document.getElementById('inventoryCategorySelect')?.addEventListener('change', (event) => {
    currentInventoryCategory = event.target.value;
    renderAssets();
    saveUiContext();
  });

  document.getElementById('inventorySearchInput')?.addEventListener('input', (event) => {
    currentInventorySearch = event.target.value.trim();
    renderAssets();
  });
}
