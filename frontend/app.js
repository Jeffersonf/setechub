'use strict';

let state = loadState();
let redePreview = [];
let currentPage = 'dashboard';
let privacyHidden = false;
let currentTaskFilter = 'todas';
let currentCallFilter = 'todos';
let currentCallSchoolContext = '';
let currentSchoolFilter = 'todas';
let currentDirectoryFilter = 'todos';
let currentSchoolZoneFilter = 'todas';
let currentSchoolSort = 'prioridade';
let currentSupervisorFilter = 'todos';
let currentAssetFilter = 'todos';
let currentImportFilter = 'todos';
let currentImportSchoolContext = '';
let currentInventorySchool = 'todas';
let currentInventoryStatus = 'todos';
let currentInventoryCategory = 'todas';
let currentInventorySearch = '';
let currentSchoolSearch = '';
let currentSchoolDetail = '';
let currentSupervisorDetail = '';
let currentSearchQuery = '';
let serverStatus = { available: false, message: 'Servidor local nao verificado.' };
let serverSnapshots = [];
let supabaseStatus = { configured: false, message: 'Supabase nao configurado.' };
let searchTimer = null;

const PAGE_KEY = 'setechub_page';
const CONTEXT_KEY = 'setechub_context';
const ACTIVE_USER_KEY = 'setechub_active_user';

const ROLE_LABELS = {
  admin: 'Administrador',
  dirigente: 'Dirigente',
  seintec: 'SEINTEC',
  ctc: 'CTC',
  pec: 'PEC',
  supervisor: 'Supervisor'
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function schoolSlug(value) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function supervisorSlug(value) {
  return schoolSlug(value);
}

function toneByPriority(priority) {
  return priority === 'alta' ? 'pill-danger' : priority === 'media' ? 'pill-warn' : 'pill-ok';
}

function toneByCall(status) {
  return status === 'aberto' ? 'pill-danger' : status === 'em_rota' ? 'pill-info' : 'pill-ok';
}

function toneBySchool(status) {
  return status === 'critico' ? 'pill-danger' : status === 'atencao' ? 'pill-warn' : 'pill-ok';
}

function toneByAsset(status) {
  return status === 'defeito' ? 'pill-danger' : status === 'manutencao' ? 'pill-warn' : 'pill-ok';
}

function badgeText(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function timestampLabel(date = new Date()) {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function todayLabel() {
  return new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function toastIcon(type) {
  if (type === 'success') return 'OK';
  if (type === 'error') return '!';
  if (type === 'syncing') return '<span class="conn-spin"></span>';
  return 'i';
}

function ensureToastWrap() {
  let wrap = document.querySelector('.twrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'twrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

function showToast(message, type = 'info', options = {}) {
  const wrap = ensureToastWrap();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-ico">${toastIcon(type)}</span><span>${esc(message)}</span>`;
  wrap.appendChild(toast);

  let timer = null;
  const close = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(14px)';
    setTimeout(() => toast.remove(), 180);
  };
  const schedule = (delay = options.duration ?? 2600) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(close, delay);
  };
  const update = (nextMessage, nextType = type, nextOptions = {}) => {
    if (timer) clearTimeout(timer);
    toast.className = `toast ${nextType}`;
    toast.innerHTML = `<span class="toast-ico">${toastIcon(nextType)}</span><span>${esc(nextMessage)}</span>`;
    if (!nextOptions.persist) schedule(nextOptions.duration ?? 2600);
  };

  if (!options.persist) schedule();
  return { close, update, node: toast };
}

function workedDuration() {
  const start = state.ponto.entrada;
  const end = state.ponto.saida;
  if (!start || !end) return '0h00';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return '0h00';
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

function bankHours() {
  const total = workedDuration();
  if (total === '0h00') return '0h';
  const [hoursPart, minutesPart] = total.replace('h', ':').split(':');
  const minutes = Number(hoursPart) * 60 + Number(minutesPart);
  const delta = minutes - (8 * 60);
  const prefix = delta >= 0 ? '+' : '-';
  const abs = Math.abs(delta);
  return `${prefix}${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}`;
}

function nextFocusTask() {
  return state.tasks
    .filter((item) => !item.done)
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))[0];
}

function timelineItems() {
  const tasks = state.tasks.map((item) => ({
    time: item.time || 'Sem horario',
    title: item.title,
    detail: `${item.place} | ${item.category}`,
    done: item.done
  }));
  const calls = state.calls
    .filter((item) => item.status !== 'resolvido')
    .map((item) => ({
      time: item.status === 'em_rota' ? 'Em rota' : 'Aberto',
      title: item.title,
      detail: item.school,
      done: false
    }));
  return [...tasks, ...calls].slice(0, 8);
}

function showPage(page) {
  if (!canAccessPage(page)) {
    page = defaultPageForUser();
  }
  currentPage = page;
  sessionStorage.setItem(PAGE_KEY, page);
  document.querySelectorAll('.page').forEach((node) => node.classList.toggle('active', node.id === `page-${page}`));
  document.querySelectorAll('.nav-item, .fn-item').forEach((node) => {
    const targetPage = page === 'school-record' ? 'schools' : page === 'supervisor-record' ? 'supervisors' : page;
    node.classList.toggle('active', node.dataset.page === targetPage);
  });
  const hash = page === 'school-record' && currentSchoolDetail
    ? `school/${schoolSlug(currentSchoolDetail)}`
    : page === 'supervisor-record' && currentSupervisorDetail
      ? `supervisor/${supervisorSlug(currentSupervisorDetail)}`
      : page;
  if (window.location.hash !== `#${hash}`) {
    window.location.hash = hash;
  }
  saveUiContext();
  applyAccessControl();
}

function currentUser() {
  const activeId = sessionStorage.getItem(ACTIVE_USER_KEY);
  const users = state.users || [];
  if (activeId) {
    return users.find((item) => item.id === activeId && item.active !== false) || null;
  }
  return users.find((item) => item.role === 'admin' && item.active !== false) || null;
}

function currentUserRole() {
  return currentUser()?.role || 'admin';
}

function isSupervisorUser() {
  return currentUserRole() === 'supervisor';
}

function isPecUser() {
  return currentUserRole() === 'pec';
}

function isPecLeadUser() {
  const user = currentUser();
  return isPecUser() && normalizeKey(user?.login || user?.name) === normalizeKey('jaqueline.borelli');
}

function isRestrictedCtcUser() {
  const user = currentUser();
  return user?.role === 'ctc' && ['bruno', 'danilo'].includes(normalizeKey(user.login || user.name));
}

function canEditData() {
  return ['admin', 'seintec', 'ctc'].includes(currentUserRole());
}

function canManageUsers() {
  return sessionStorage.getItem(SESSION_KEY) === 'ok' && currentUserRole() === 'admin';
}

function visibleNavigationPages() {
  const pages = isPecUser()
    ? new Set(['pecs', 'info', 'settings'])
    : isSupervisorUser()
      ? new Set(['schools', 'school-record', 'supervisors', 'supervisor-record', 'info', 'settings'])
      : isRestrictedCtcUser()
        ? new Set(['dashboard', 'ctc', 'schools', 'school-record', 'assets', 'reports', 'info', 'settings'])
      : canEditData()
      ? new Set(['dashboard', 'ctc', 'schools', 'school-record', 'supervisors', 'supervisor-record', 'pecs', 'assets', 'agenda', 'reports', 'info', 'settings'])
        : new Set(['dashboard', 'schools', 'school-record', 'supervisors', 'supervisor-record', 'pecs', 'assets', 'reports', 'info', 'settings']);
  if (canManageUsers()) pages.add('admin');
  return pages;
}

function assignedSchoolsForCurrentUser() {
  const user = currentUser();
  if (!user || user.role !== 'supervisor') return state.schools.map((item) => item.name);
  const supervisor = (state.supervisors || []).find((item) =>
    normalizeKey(item.name) === normalizeKey(user.supervisorName || user.name || user.login)
  );
  return supervisor?.schools || [];
}

function visibleSchools() {
  if (!isSupervisorUser()) return state.schools || [];
  const allowed = new Set(assignedSchoolsForCurrentUser());
  return (state.schools || []).filter((school) => allowed.has(school.name));
}

function visibleSupervisors() {
  if (!isSupervisorUser()) return state.supervisors || [];
  const user = currentUser();
  return (state.supervisors || []).filter((supervisor) =>
    normalizeKey(supervisor.name) === normalizeKey(user?.supervisorName || user?.name || user?.login)
  );
}

function canViewSchool(name) {
  if (!isSupervisorUser()) return true;
  return assignedSchoolsForCurrentUser().includes(name);
}

function canViewSupervisor(name) {
  if (!isSupervisorUser()) return true;
  const user = currentUser();
  return normalizeKey(name) === normalizeKey(user?.supervisorName || user?.name || user?.login);
}

function defaultPageForUser() {
  if (isPecUser()) return 'pecs';
  if (currentUserRole() === 'ctc') return 'ctc';
  return isSupervisorUser() ? 'schools' : 'dashboard';
}

function canAccessPage(page) {
  return visibleNavigationPages().has(page);
}

function applyAccessControl() {
  const role = currentUserRole();
  document.body.dataset.role = role;
  document.body.classList.toggle('is-read-only', !canEditData());
  document.querySelectorAll('.nav-item, .fn-item').forEach((node) => {
    if (node.dataset.page) {
      const allowed = canAccessPage(node.dataset.page);
      node.hidden = isRestrictedCtcUser() && !allowed;
      node.classList.toggle('nav-disabled', !allowed);
      node.setAttribute('aria-disabled', allowed ? 'false' : 'true');
      node.tabIndex = allowed ? 0 : -1;
    }
  });
  document.querySelectorAll('.sidebar-icon-btn, .sidebar-mini-btn').forEach((node) => {
    node.hidden = !canEditData();
  });
  document.querySelectorAll('.sidebar-utility').forEach((node) => {
    node.hidden = !canEditData();
  });
  const sidebarSearch = document.querySelector('.sb-search');
  if (sidebarSearch) sidebarSearch.hidden = isPecUser();
  document.querySelectorAll('[data-edit-scope]').forEach((node) => {
    node.hidden = !canEditData();
  });
  document.querySelectorAll('[data-admin-only]').forEach((node) => {
    node.hidden = !canManageUsers();
  });
  [
    'taskForm',
    'callForm',
    'schoolForm',
    'schoolProfileForm',
    'schoolImportForm',
    'supervisorVisitForm',
    'supervisorRecordVisitFormElement',
    'assetForm',
    'schoolAssetForm',
    'schoolAssetBulkForm',
    'noteForm',
    'redeAutomationForm'
  ].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.hidden = !canEditData();
  });
  [
    'backupBtn',
    'restoreInput',
    'resetBtn',
    'saveServerBtn',
    'loadServerBtn',
    'refreshSnapshotsBtn',
    'saveSupabaseBtn',
    'loadSupabaseBtn',
    'checkSupabaseBtn',
    'importLegacyBtn',
    'officialForm',
    'sectorForm'
  ].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.hidden = !canManageUsers();
  });
  [
    'seedSupervisorVisitsBtn'
  ].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.hidden = !canEditData();
  });
  const directoryBox = document.getElementById('directoryContactsBox');
  if (directoryBox) directoryBox.hidden = isPecUser();
}

function updateIdentity() {
  const user = currentUser() || state.users?.[0] || { name: state.profile.name, role: 'admin', pin: state.profile.pin };
  const roleLabel = ROLE_LABELS[user.role] || badgeText(user.role || 'operacao');
  document.getElementById('uName').textContent = user.name;
  document.getElementById('uRole').textContent = roleLabel;
  document.getElementById('uAvatar').textContent = user.name.slice(0, 2).toUpperCase();
  document.getElementById('profileName').value = user.name;
  document.getElementById('profilePin').value = user.pin || '';
  document.getElementById('todayLabel').textContent = todayLabel();
  applyAccessControl();
}

function filteredTasks() {
  if (currentTaskFilter === 'todas') return state.tasks;
  if (currentTaskFilter === 'abertas') return state.tasks.filter((item) => !item.done);
  if (currentTaskFilter === 'alta') return state.tasks.filter((item) => item.priority === 'alta');
  if (currentTaskFilter === 'visita') return state.tasks.filter((item) => item.category.toLowerCase() === 'visita');
  if (currentTaskFilter === 'ctc') return state.tasks.filter((item) => normalizeKey(item.category).includes('ctc'));
  return state.tasks;
}

function openCtcAgenda() {
  showPage('ctc');
  renderCtcAgenda();
}

function filteredCalls() {
  return state.calls.filter((item) => {
    if (currentCallSchoolContext && item.school !== currentCallSchoolContext) return false;
    if (currentCallFilter === 'todos') return true;
    return item.status === currentCallFilter;
  });
}

function filteredSchools() {
  return visibleSchools().filter((item) => {
    const zoneMatch = currentSchoolZoneFilter === 'todas' || item.zone === currentSchoolZoneFilter;
    if (!zoneMatch) return false;
    if (currentSchoolSearch) {
      const haystack = normalizeKey(`${item.name} ${item.cie || ''} ${item.zone} ${item.notes || ''}`);
      if (!haystack.includes(normalizeKey(currentSchoolSearch))) return false;
    }
    if (currentSchoolFilter === 'todas') return true;
    if (currentSchoolFilter === 'oficiais') return item.fixedName;
    if (currentSchoolFilter === 'com_dados') return schoolHasOperationalData(item.name);
    if (currentSchoolFilter === 'sem_ficha') return schoolProfileCompletion(item.name) < 35;
    if (currentSchoolFilter === 'sem_inventario') return schoolAssetTotals(item.name).units === 0;
    if (currentSchoolFilter === 'sem_rede') return !schoolNetworkRecord(item.name);
    if (currentSchoolFilter === 'com_alerta') return schoolAlertUnits(item.name) > 0;
    if (currentSchoolFilter === 'com_importacao') return schoolImportCount(item.name) > 0;
    if (currentSchoolFilter === 'com_chamado') return state.calls.some((call) => call.school === item.name && call.status !== 'resolvido');
    return item.status === currentSchoolFilter;
  });
}

function filteredDirectoryContacts(scopeToCurrentPec = true) {
  if (scopeToCurrentPec && isPecUser()) {
    const user = currentUser();
    const pecContacts = state.directoryContacts.filter((item) => /pec|curriculo|currículo|especialista/i.test(`${item.role} ${item.name}`));
    if (isPecLeadUser()) return pecContacts;
    return pecContacts.filter((item) => normalizeKey(item.name) === normalizeKey(user?.name));
  }
  if (currentDirectoryFilter === 'todos') return state.directoryContacts;
  if (currentDirectoryFilter === 'supervisao') {
    return state.directoryContacts.filter((item) => /supervisor/i.test(item.role));
  }
  if (currentDirectoryFilter === 'tecnologia') {
    return state.directoryContacts.filter((item) => /prodesp|seintec|setec|tecnologia|ctc/i.test(`${item.role} ${item.sector}`));
  }
  if (currentDirectoryFilter === 'gestao') {
    return state.directoryContacts.filter((item) => /chefe|diretor|dirigente|executiva|assistente|gab|asure|seafin|sepes|segre/i.test(`${item.role} ${item.sector}`));
  }
  if (currentDirectoryFilter === 'pecs') {
    return state.directoryContacts.filter((item) => /pec|curriculo|currículo|especialista/i.test(`${item.role} ${item.name}`));
  }
  return state.directoryContacts;
}

function filteredAssets() {
  if (currentAssetFilter === 'todos') return state.assets;
  if (currentAssetFilter === 'alerta') return state.assets.filter((item) => item.status !== 'ok');
  if (currentAssetFilter === 'criticos') return state.assets.filter((item) => item.status === 'defeito');
  if (currentAssetFilter === 'infra') return state.assets.filter((item) => /switch|rack|modem|roteador|access point|wifi|rede/i.test(`${item.name} ${item.notes || ''}`));
  return state.assets;
}

function inventoryCategory(name) {
  const text = normalizeKey(name);
  if (/tablet/.test(text)) return 'tablets';
  if (/netbook/.test(text)) return 'netbooks';
  if (/notebook/.test(text)) return 'notebooks';
  if (/desktop|pc|computador/.test(text)) return 'desktops';
  if (/switch|rack|modem|roteador|wifi|antena|firewall|dvr/.test(text)) return 'infra';
  if (/recarga|carreg/.test(text)) return 'energia';
  return 'outros';
}

function inventoryFamily(name) {
  if (typeof name === 'object' && name?.canonicalName) return name.canonicalName;
  const text = normalizeKey(name);
  if (/netbook positivo 1110/.test(text)) return 'Netbook Positivo 1110';
  if (/netbook positivo 1210/.test(text)) return 'Netbook Positivo 1210';
  if (/tablet positivo/.test(text)) return 'Tablet Positivo';
  if (/notebook multilaser ultra/.test(text)) return 'Notebook Multilaser Ultra';
  if (/desktop lenovo/.test(text)) return 'Desktop Lenovo';
  if (/desktop legado positivo/.test(text)) return 'Desktop Legado Positivo';
  if (/equipamento adquirido pela escola/.test(text)) return 'Equipamento adquirido pela escola';
  if (/equipamento nao informado/.test(text)) return 'Equipamento nao informado';
  return String(name || 'Item sem nome').trim();
}

function inventoryBrand(name, notes = '') {
  if (typeof name === 'object' && name?.brand) return name.brand;
  const text = normalizeKey(`${name} ${notes}`);
  if (/positivo/.test(text)) return 'Positivo';
  if (/lenovo/.test(text)) return 'Lenovo';
  if (/multilaser/.test(text)) return 'Multilaser';
  if (/semp toshiba|itautec/.test(text)) return 'Misto';
  return 'Nao definida';
}

function inventoryModel(name, notes = '') {
  if (typeof name === 'object' && name?.model) return name.model;
  const text = normalizeKey(`${name} ${notes}`);
  if (/1110/.test(text)) return '1110';
  if (/1210/.test(text)) return '1210';
  if (/ultra/.test(text)) return 'Ultra';
  if (/legado/.test(text)) return 'Legado';
  return '';
}

function inventoryOriginalStatus(notes = '') {
  const match = String(notes).match(/status original:\s*([^|]+)/i);
  return match ? match[1].trim() : '';
}

function inventoryBlueMonitorCount(notes = '') {
  const match = String(notes).match(/BlueMonitor:\s*(\d+)/i);
  return match ? Number(match[1]) : 0;
}

function inventoryDataQuality(name, notes = '') {
  const text = normalizeKey(`${name} ${notes}`);
  if (/nao informado|sem marca|sem status|^tablet$|^notebook$|^netbooks?$|^desktop$/.test(text)) return 'fraco';
  if (/adquirido pela escola|mix de marcas|legado|equipamento lenovo|equipamento positivo|tv \/ monitor|bateria \/ pilha/.test(text)) return 'medio';
  return 'bom';
}

function parsePositiveInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatSchoolAssetNotes(notes = '', quantity = 1) {
  const cleanNotes = String(notes || '').trim();
  if (quantity <= 1) return cleanNotes;
  return cleanNotes ? `${quantity} unidades | ${cleanNotes}` : `${quantity} unidades`;
}

function parseBulkSchoolAssets(text, defaultStatus = 'ok') {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;|\t]/).map((item) => item.trim());
      const [name = '', quantityRaw = '', statusRaw = '', ...noteParts] = parts;
      const quantity = parsePositiveInteger(quantityRaw, 1);
      const status = ['ok', 'manutencao', 'defeito'].includes(normalizeKey(statusRaw).replace(/\s+/g, '_'))
        ? normalizeKey(statusRaw).replace(/\s+/g, '_')
        : defaultStatus;
      return {
        name,
        quantity,
        status,
        notes: formatSchoolAssetNotes(noteParts.join(' | '), quantity)
      };
    })
    .filter((item) => item.name);
}

function orphanedReferenceSummary() {
  const schoolNames = new Set(state.schools.map((item) => item.name));
  return {
    tasks: state.tasks.filter((item) => item.place && !schoolNames.has(item.place)).length,
    calls: state.calls.filter((item) => item.school && !schoolNames.has(item.school)).length,
    profiles: state.schoolProfiles.filter((item) => item.school && !schoolNames.has(item.school)).length,
    imports: state.schoolImports.filter((item) => item.school && !schoolNames.has(item.school)).length,
    assets: state.schoolAssets.filter((item) => item.school && !schoolNames.has(item.school)).length,
    networks: state.schoolNetworks.filter((item) => item.school && !schoolNames.has(item.school)).length
  };
}

function duplicateSchoolCies() {
  const map = new Map();
  state.schools.forEach((school) => {
    const cie = String(school.cie || '').trim();
    if (!cie) return;
    const bucket = map.get(cie) || [];
    bucket.push(school.name);
    map.set(cie, bucket);
  });
  return Array.from(map.entries())
    .filter(([, names]) => names.length > 1)
    .map(([cie, names]) => ({ cie, names }));
}

function schoolEventHistory(schoolName, limit = 8) {
  return (state.histories.schoolEvents || [])
    .filter((item) => item.school === schoolName)
    .slice(0, limit);
}

function pendingQueueItems(limit = 20) {
  const items = [];
  visibleSchools().forEach((school) => {
    const missingFields = schoolMissingProfileFields(school.name);
    const pendingImports = state.schoolImports.filter((item) => item.school === school.name && item.reviewStatus === 'pending').length;
    const network = schoolNetworkRecord(school.name);
    const networkGap = network ? Math.max(0, Number(network.cameraInstalled || 0) - Number(network.cameraWorking || 0)) : 0;
    const alerts = schoolAlertUnits(school.name);
    if (pendingImports) {
      items.push({ school: school.name, type: 'importacao', tone: 'pill-warn', text: `${pendingImports} importacao(oes) pendente(s) de revisao.` });
    }
    if (missingFields.length) {
      items.push({ school: school.name, type: 'ficha', tone: 'pill-info', text: `Ficha incompleta: faltam ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? '...' : ''}.` });
    }
    if (!network) {
      items.push({ school: school.name, type: 'rede', tone: 'pill-warn', text: 'Sem importacao de rede e cameras.' });
    } else if (networkGap > 0) {
      items.push({ school: school.name, type: 'rede', tone: 'pill-danger', text: `${networkGap} camera(s) abaixo da cobertura esperada.` });
    }
    if (alerts > 0) {
      items.push({ school: school.name, type: 'inventario', tone: 'pill-danger', text: `${alerts} unidade(s) em alerta no inventario.` });
    }
  });
  const priority = { importacao: 0, inventario: 1, rede: 2, ficha: 3 };
  return items
    .sort((a, b) => (priority[a.type] ?? 99) - (priority[b.type] ?? 99) || a.school.localeCompare(b.school))
    .slice(0, limit);
}

function filteredSchoolAssets() {
  return state.schoolAssets.filter((item) => {
    if (currentInventorySchool !== 'todas' && item.school !== currentInventorySchool) return false;
    if (currentInventoryStatus === 'alerta' && item.status === 'ok') return false;
    if (currentInventoryStatus === 'criticos' && item.status !== 'defeito') return false;
    if (currentInventoryStatus === 'ok' && item.status !== 'ok') return false;
    if (currentInventoryCategory !== 'todas' && inventoryCategory(item.name) !== currentInventoryCategory) return false;
    if (currentInventorySearch) {
      const haystack = normalizeKey(`${item.school} ${item.name} ${item.notes || ''}`);
      if (!haystack.includes(normalizeKey(currentInventorySearch))) return false;
    }
    return true;
  });
}

function aggregateInventoryItems(items) {
  const groups = new Map();
  items.forEach((item) => {
    const family = inventoryFamily(item.name);
    const key = `${item.school}|${normalizeKey(family)}`;
    const current = groups.get(key) || {
      school: item.school,
      name: family,
      rawNames: new Set(),
      category: inventoryCategory(item.name),
      brand: item.brand || inventoryBrand(item.name, item.notes || ''),
      model: item.model || inventoryModel(item.name, item.notes || ''),
      quality: inventoryDataQuality(item.name, item.notes || ''),
      lines: 0,
      units: 0,
      okUnits: 0,
      alertUnits: 0,
      defectUnits: 0,
      originalStatuses: new Set(),
      blueMonitorUnits: 0,
      statuses: new Set(),
      notes: []
    };
    const units = schoolAssetUnits(item);
    current.lines += 1;
    current.units += units;
    current.rawNames.add(item.sourceName || item.name);
    current.statuses.add(item.status);
    current.notes.push(item.notes || '');
    const originalStatus = inventoryOriginalStatus(item.notes || '');
    if (originalStatus) current.originalStatuses.add(originalStatus);
    current.blueMonitorUnits += inventoryBlueMonitorCount(item.notes || '');
    if (inventoryDataQuality(item.name, item.notes || '') === 'fraco') current.quality = 'fraco';
    else if (inventoryDataQuality(item.name, item.notes || '') === 'medio' && current.quality !== 'fraco') current.quality = 'medio';
    if (item.status === 'ok') current.okUnits += units;
    if (item.status !== 'ok') current.alertUnits += units;
    if (item.status === 'defeito') current.defectUnits += units;
    groups.set(key, current);
  });
  return Array.from(groups.values()).map((item) => ({
    ...item,
    statusLabel: item.defectUnits > 0 ? 'defeito' : item.alertUnits > 0 ? 'manutencao' : 'ok',
    rawNameCount: item.rawNames.size,
    originalStatusCount: item.originalStatuses.size,
    notePreview: item.notes.filter(Boolean).slice(0, 2).join(' | ')
  }));
}

function schoolInventoryRows(schoolName) {
  return aggregateInventoryItems(state.schoolAssets.filter((item) => item.school === schoolName))
    .sort((a, b) => b.units - a.units || b.alertUnits - a.alertUnits || a.name.localeCompare(b.name));
}

function schoolInventoryCategorySummary(schoolName) {
  return schoolInventoryRows(schoolName).reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = { category: item.category, units: 0, alertUnits: 0, items: 0 };
    }
    acc[item.category].units += item.units;
    acc[item.category].alertUnits += item.alertUnits;
    acc[item.category].items += 1;
    return acc;
  }, {});
}

function inventorySchoolRows() {
  const rows = filteredSchoolAssets().reduce((acc, item) => {
    if (!acc[item.school]) {
      acc[item.school] = { school: item.school, totalLines: 0, totalUnits: 0, alertUnits: 0, defectUnits: 0, categories: new Set() };
    }
    const bucket = acc[item.school];
    const units = schoolAssetUnits(item);
    bucket.totalLines += 1;
    bucket.totalUnits += units;
    bucket.categories.add(inventoryCategory(item.name));
    if (item.status !== 'ok') bucket.alertUnits += units;
    if (item.status === 'defeito') bucket.defectUnits += units;
    return acc;
  }, {});
  return Object.values(rows)
    .map((item) => ({ ...item, categories: item.categories.size }))
    .sort((a, b) => b.alertUnits - a.alertUnits || b.totalUnits - a.totalUnits || a.school.localeCompare(b.school));
}

function inventoryFocusSchool() {
  if (currentInventorySchool !== 'todas') return currentInventorySchool;
  return inventorySchoolRows()[0]?.school || visibleSchools()[0]?.name || '';
}

function inventoryQualitySummary() {
  const rows = aggregateInventoryItems(state.schoolAssets);
  return {
    families: rows.length,
    lowQuality: rows.filter((item) => item.quality === 'fraco').length,
    mergedFamilies: rows.filter((item) => item.rawNameCount > 1).length,
    criticalFamilies: rows.filter((item) => item.defectUnits > 0).length,
    mixedStatuses: rows.filter((item) => item.originalStatusCount > 1).length
  };
}

function inventoryIssuesForSchool(schoolName) {
  return schoolInventoryRows(schoolName)
    .filter((item) => item.quality !== 'bom' || item.defectUnits > 0 || item.rawNameCount > 1 || item.originalStatusCount > 1)
    .sort((a, b) => {
      const scoreA = (a.quality === 'fraco' ? 4 : a.quality === 'medio' ? 2 : 0) + a.defectUnits + a.rawNameCount + a.originalStatusCount;
      const scoreB = (b.quality === 'fraco' ? 4 : b.quality === 'medio' ? 2 : 0) + b.defectUnits + b.rawNameCount + b.originalStatusCount;
      return scoreB - scoreA || b.alertUnits - a.alertUnits || a.name.localeCompare(b.name);
    });
}

function filteredSchoolImports() {
  const allowedSchools = new Set(visibleSchools().map((item) => item.name));
  const source = currentImportSchoolContext
    ? state.schoolImports.filter((item) => item.school === currentImportSchoolContext && allowedSchools.has(item.school))
    : state.schoolImports.filter((item) => allowedSchools.has(item.school));
  if (currentImportFilter === 'todos') return source;
  if (currentImportFilter === 'documentos') return source.filter((item) => /doc|pdf|text/i.test(item.type || item.filename || ''));
  if (currentImportFilter === 'planilhas') return source.filter((item) => /excel|csv|xlsx|xls|tsv/i.test(item.type || item.filename || ''));
  if (currentImportFilter === 'imagens') return source.filter((item) => /image|png|jpg|jpeg|webp|bmp/i.test(item.type || item.filename || ''));
  if (currentImportFilter === 'com_preview') return source.filter((item) => (item.preview || '').trim().length > 0);
  return source;
}

function saveUiContext() {
  try {
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({
      page: currentPage,
      taskFilter: currentTaskFilter,
      callFilter: currentCallFilter,
      callSchoolContext: currentCallSchoolContext,
      schoolFilter: currentSchoolFilter,
      schoolZoneFilter: currentSchoolZoneFilter,
      schoolSort: currentSchoolSort,
      supervisorFilter: currentSupervisorFilter,
      schoolSearch: currentSchoolSearch,
      assetFilter: currentAssetFilter,
      importFilter: currentImportFilter,
      importSchoolContext: currentImportSchoolContext,
      inventorySchool: currentInventorySchool,
      inventoryStatus: currentInventoryStatus,
      inventoryCategory: currentInventoryCategory,
      inventorySearch: currentInventorySearch,
      schoolDetail: currentSchoolDetail,
      supervisorDetail: currentSupervisorDetail,
      directoryFilter: currentDirectoryFilter,
      searchQuery: currentSearchQuery
    }));
  } catch {
    // Ignore session persistence failures.
  }
}

function restoreUiContext() {
  try {
    const raw = sessionStorage.getItem(CONTEXT_KEY);
    if (!raw) return;
    const context = JSON.parse(raw);
    currentPage = context.page || currentPage;
    currentTaskFilter = context.taskFilter || currentTaskFilter;
    currentCallFilter = context.callFilter || currentCallFilter;
    currentCallSchoolContext = context.callSchoolContext || '';
    currentSchoolFilter = context.schoolFilter || currentSchoolFilter;
    currentSchoolZoneFilter = context.schoolZoneFilter || currentSchoolZoneFilter;
    currentSchoolSort = context.schoolSort || currentSchoolSort;
    currentSupervisorFilter = context.supervisorFilter || currentSupervisorFilter;
    currentSchoolSearch = context.schoolSearch || '';
    currentAssetFilter = context.assetFilter || currentAssetFilter;
    currentImportFilter = context.importFilter || currentImportFilter;
    currentImportSchoolContext = context.importSchoolContext || '';
    currentInventorySchool = context.inventorySchool || currentInventorySchool;
    currentInventoryStatus = context.inventoryStatus || currentInventoryStatus;
    currentInventoryCategory = context.inventoryCategory || currentInventoryCategory;
    currentInventorySearch = context.inventorySearch || '';
    currentSchoolDetail = context.schoolDetail || currentSchoolDetail;
    currentSupervisorDetail = context.supervisorDetail || currentSupervisorDetail;
    currentDirectoryFilter = context.directoryFilter || currentDirectoryFilter;
    currentSearchQuery = context.searchQuery || '';
  } catch {
    // Ignore malformed session context.
  }
}

function restorePageFromHash() {
  const hash = String(window.location.hash || '').replace(/^#/, '').trim();
  if (!hash) return;
  if (hash.startsWith('school/')) {
    const slug = hash.slice('school/'.length);
    const school = visibleSchools().find((item) => schoolSlug(item.name) === slug);
    if (school && canViewSchool(school.name)) {
      currentSchoolDetail = school.name;
      currentPage = 'school-record';
    }
    return;
  }
  if (hash.startsWith('supervisor/')) {
    const slug = hash.slice('supervisor/'.length);
    const supervisor = visibleSupervisors().find((item) => supervisorSlug(item.name) === slug);
    if (supervisor && canViewSupervisor(supervisor.name)) {
      currentSupervisorDetail = supervisor.name;
      currentSupervisorFilter = normalizeKey(supervisor.name);
      currentPage = 'supervisor-record';
    }
    return;
  }
  currentPage = hash;
}

function currentSchoolProfile() {
  const school = currentSchoolDetail || visibleSchools()[0]?.name || '';
  return state.schoolProfiles.find((item) => item.school === school) || null;
}

function schoolByName(schoolName) {
  return state.schools.find((item) => item.name === schoolName) || null;
}

function supervisorByName(supervisorName) {
  return (state.supervisors || []).find((item) => item.name === supervisorName) || null;
}

function topOpenCalls(limit = 5) {
  return state.calls
    .filter((item) => item.status !== 'resolvido')
    .slice()
    .sort((a, b) => a.school.localeCompare(b.school) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

function topInventoryAlerts(limit = 5) {
  return aggregateInventoryItems(state.schoolAssets)
    .filter((item) => item.alertUnits > 0)
    .sort((a, b) => b.alertUnits - a.alertUnits || b.defectUnits - a.defectUnits || a.school.localeCompare(b.school))
    .slice(0, limit);
}

function recentSchoolImports(limit = 5) {
  return state.schoolImports
    .slice()
    .sort((a, b) => String(b.importedAt || '').localeCompare(String(a.importedAt || '')))
    .slice(0, limit);
}

function schoolImportCount(schoolName) {
  return state.schoolImports.filter((item) => item.school === schoolName).length;
}

function schoolNetworkRecord(schoolName) {
  return state.schoolNetworks.find((item) => item.school === schoolName) || null;
}

function schoolAssetLines(schoolName) {
  return state.schoolAssets.filter((item) => item.school === schoolName);
}

function schoolAssetTotals(schoolName) {
  const assets = schoolAssetLines(schoolName);
  return {
    lines: assets.length,
    units: assets.reduce((sum, item) => sum + schoolAssetUnits(item), 0)
  };
}

function schoolAlertUnits(schoolName) {
  return schoolAssetLines(schoolName)
    .filter((item) => item.status !== 'ok')
    .reduce((sum, item) => sum + schoolAssetUnits(item), 0);
}

function schoolProfileCompletion(schoolName) {
  const profile = state.schoolProfiles.find((item) => item.school === schoolName);
  if (!profile) return 0;
  const fields = ['director', 'viceDirector', 'proati', 'goe', 'phone', 'mobile', 'email', 'address', 'notes'];
  const filled = fields.filter((field) => String(profile[field] || '').trim()).length;
  return Math.round((filled / fields.length) * 100);
}

function schoolMissingProfileFields(schoolName) {
  const profile = state.schoolProfiles.find((item) => item.school === schoolName);
  if (!profile) return ['direcao', 'telefone', 'email', 'endereco'];
  const labels = {
    director: 'direcao',
    viceDirector: 'vice-direcao',
    proati: 'PROATI',
    goe: 'GOE',
    phone: 'telefone',
    mobile: 'celular',
    email: 'email',
    address: 'endereco',
    notes: 'observacoes'
  };
  return Object.entries(labels)
    .filter(([field]) => !String(profile[field] || '').trim())
    .map(([, label]) => label);
}

function schoolHasOperationalData(schoolName) {
  return schoolImportCount(schoolName) > 0 || schoolAssetLines(schoolName).length > 0 || schoolProfileCompletion(schoolName) > 0 || !!schoolNetworkRecord(schoolName);
}

function schoolOperationalSnapshot(school) {
  const imports = schoolImportCount(school.name);
  const assetTotals = schoolAssetTotals(school.name);
  const alertUnits = schoolAlertUnits(school.name);
  const completion = schoolProfileCompletion(school.name);
  const openCalls = state.calls.filter((item) => item.school === school.name && item.status !== 'resolvido').length;
  const pendingTasks = state.tasks.filter((item) => !item.done && (item.place === school.name || item.title.includes(school.name))).length;
  const network = schoolNetworkRecord(school.name);
  const networkRisk = network
    ? (network.status === 'defeito' ? 8 : network.status === 'manutencao' ? 4 : 0) +
      Math.max(0, Number(network.cameraInstalled || 0) - Number(network.cameraWorking || 0))
    : 0;
  const riskScore = alertUnits * 2 + openCalls * 4 + pendingTasks * 2 + networkRisk + (school.status === 'critico' ? 10 : school.status === 'atencao' ? 5 : 0);
  return {
    imports,
    assetLines: assetTotals.lines,
    assetUnits: assetTotals.units,
    alertUnits,
    completion,
    openCalls,
    pendingTasks,
    networkStatus: network?.status || '',
    networkGap: network ? Math.max(0, Number(network.cameraInstalled || 0) - Number(network.cameraWorking || 0)) : 0,
    riskScore
  };
}

function schoolDataScore(schoolName) {
  const profile = schoolProfileCompletion(schoolName);
  const inventory = schoolAssetTotals(schoolName).units > 0 ? 25 : 0;
  const imports = schoolImportCount(schoolName) > 0 ? 20 : 0;
  const network = schoolNetworkRecord(schoolName) ? 20 : 0;
  return Math.min(100, Math.round((profile * 0.35) + inventory + imports + network));
}

function sortSchoolsByCurrentView(schools) {
  return schools.slice().sort((a, b) => {
    const signalA = schoolOperationalSnapshot(a);
    const signalB = schoolOperationalSnapshot(b);
    if (currentSchoolSort === 'nome') return a.name.localeCompare(b.name);
    if (currentSchoolSort === 'municipio') return a.zone.localeCompare(b.zone) || a.name.localeCompare(b.name);
    if (currentSchoolSort === 'inventario') return signalB.assetUnits - signalA.assetUnits || a.name.localeCompare(b.name);
    if (currentSchoolSort === 'alertas') return signalB.alertUnits - signalA.alertUnits || signalB.riskScore - signalA.riskScore || a.name.localeCompare(b.name);
    if (currentSchoolSort === 'dados') return schoolDataScore(b.name) - schoolDataScore(a.name) || a.name.localeCompare(b.name);
    return signalB.riskScore - signalA.riskScore || signalB.alertUnits - signalA.alertUnits || a.name.localeCompare(b.name);
  });
}

function filteredSupervisors() {
  const source = visibleSupervisors();
  if (currentSupervisorFilter === 'todos') return source;
  return source.filter((item) => normalizeKey(item.name) === currentSupervisorFilter);
}

function supervisorVisitRows() {
  const selectedNames = new Set(filteredSupervisors().map((item) => item.name));
  return (state.supervisorVisits || []).filter((item) =>
    currentSupervisorFilter === 'todos' || selectedNames.has(item.supervisor)
  );
}

function supervisorStats() {
  const visits = state.supervisorVisits || [];
  const schools = visibleSchools();
  return visibleSupervisors().map((supervisor) => {
    const assignedSchools = supervisor.schools || [];
    const supervisorVisits = visits.filter((visit) => visit.supervisor === supervisor.name);
    const visitedSchools = new Set(supervisorVisits.map((visit) => visit.school));
    const openCalls = state.calls.filter((call) => assignedSchools.includes(call.school) && call.status !== 'resolvido').length;
    const alerts = assignedSchools.reduce((sum, school) => sum + schoolAlertUnits(school), 0);
    const knownSchools = assignedSchools.filter((name) => schools.some((school) => school.name === name)).length;
    return {
      supervisor,
      assignedSchools,
      knownSchools,
      visits: supervisorVisits.length,
      visitedSchools: visitedSchools.size,
      coverage: assignedSchools.length ? Math.round((visitedSchools.size / assignedSchools.length) * 100) : 0,
      openCalls,
      alerts
    };
  });
}

function operationalCoverage() {
  const schools = visibleSchools();
  const totalSchools = schools.length || 1;
  const schoolsWithImports = schools.filter((item) => schoolImportCount(item.name) > 0).length;
  const schoolsWithAssets = schools.filter((item) => schoolAssetLines(item.name).length > 0).length;
  const schoolsWithProfile = schools.filter((item) => schoolProfileCompletion(item.name) >= 35).length;
  const activeAlerts = state.schoolAssets.filter((item) => item.status !== 'ok').length + state.assets.filter((item) => item.status !== 'ok').length;
  return {
    totalSchools,
    schoolsWithImports,
    schoolsWithAssets,
    schoolsWithProfile,
    importCoverage: Math.round((schoolsWithImports / totalSchools) * 100),
    assetCoverage: Math.round((schoolsWithAssets / totalSchools) * 100),
    profileCoverage: Math.round((schoolsWithProfile / totalSchools) * 100),
    activeAlerts
  };
}

function schoolCoverageSummary() {
  const filtered = filteredSchools();
  const total = filtered.length || 1;
  const withInventory = filtered.filter((school) => schoolAssetTotals(school.name).units > 0).length;
  const withNetwork = filtered.filter((school) => !!schoolNetworkRecord(school.name)).length;
  const withAlerts = filtered.filter((school) => schoolAlertUnits(school.name) > 0).length;
  const withProfile = filtered.filter((school) => schoolProfileCompletion(school.name) >= 35).length;
  return {
    total,
    withInventory,
    withNetwork,
    withAlerts,
    withProfile,
    inventoryPct: Math.round((withInventory / total) * 100),
    networkPct: Math.round((withNetwork / total) * 100),
    profilePct: Math.round((withProfile / total) * 100)
  };
}

function dashboardHealth() {
  const coverage = operationalCoverage();
  const doneTasks = state.tasks.filter((item) => item.done).length;
  const totalTasks = state.tasks.length || 1;
  const openCalls = state.calls.filter((item) => item.status !== 'resolvido').length;
  const score = Math.max(0, Math.min(100,
    Math.round(
      (coverage.importCoverage * 0.2) +
      (coverage.assetCoverage * 0.25) +
      (coverage.profileCoverage * 0.25) +
      (((doneTasks / totalTasks) * 100) * 0.1) +
      (Math.max(0, 100 - (openCalls * 8)) * 0.2)
    )
  ));
  let tone = 'pill-ok';
  let label = 'Base consistente';
  if (score < 70) {
    tone = 'pill-warn';
    label = 'Base em consolidacao';
  }
  if (score < 45) {
    tone = 'pill-danger';
    label = 'Base pedindo organizacao';
  }
  return { score, tone, label, openCalls };
}

function topSchoolSignals(limit = 5) {
  return visibleSchools()
    .map((school) => ({ school, signal: schoolOperationalSnapshot(school) }))
    .sort((a, b) => b.signal.riskScore - a.signal.riskScore || a.school.name.localeCompare(b.school.name))
    .slice(0, limit);
}

function operationalSuggestions() {
  const suggestions = [];
  const coverage = operationalCoverage();
  const health = dashboardHealth();
  const weakestProfile = visibleSchools()
    .map((school) => ({ school, completion: schoolProfileCompletion(school.name) }))
    .filter((item) => item.completion < 35)
    .slice(0, 3);
  if (health.openCalls > 0) {
    suggestions.push(`${health.openCalls} chamado(s) ativo(s): vale fechar a fila antes de abrir nova frente.`);
  }
  if (coverage.profileCoverage < 65) {
    suggestions.push(`So ${coverage.profileCoverage}% das escolas tem ficha minimamente preenchida. Priorize telefone, email e endereco.`);
  }
  if (coverage.importCoverage < 60) {
    suggestions.push(`As importacoes cobrem ${coverage.importCoverage}% das escolas. Ainda ha base para anexar e enriquecer.`);
  }
  if (coverage.activeAlerts > 0) {
    suggestions.push(`${coverage.activeAlerts} alerta(s) de ativo estao visiveis. Use a tela de ativos para separar manutencao de defeito.`);
  }
  weakestProfile.forEach((item) => {
    suggestions.push(`${item.school.name} esta com ficha em ${item.completion}%: faltam ${schoolMissingProfileFields(item.school.name).slice(0, 3).join(', ')}.`);
  });
  return suggestions.slice(0, 5);
}

function buildSummaryPreview() {
  const done = state.tasks.filter((item) => item.done).length;
  const openCalls = state.calls.filter((item) => item.status !== 'resolvido').length;
  const criticalSchools = visibleSchools().filter((item) => item.status !== 'estavel').length;
  const alertAssets = state.assets.filter((item) => item.status !== 'ok').length + state.schoolAssets.filter((item) => item.status !== 'ok').length;
  const focus = nextFocusTask();
  return [
    `${done}/${state.tasks.length} tarefas concluidas`,
    `${openCalls} chamados ativos`,
    `${criticalSchools} escolas em atencao`,
    `${alertAssets} ativos em alerta`,
    focus ? `proximo foco: ${focus.title}` : 'sem tarefa critica aberta'
  ].join(' | ');
}

function syncFilterButtons(kind) {
  if (kind === 'task') {
    document.querySelectorAll('[data-task-filter]').forEach((button) => {
      button.classList.toggle('active-filter', button.dataset.taskFilter === currentTaskFilter);
    });
    return;
  }
  document.querySelectorAll('[data-call-filter]').forEach((button) => {
    button.classList.toggle('active-filter', button.dataset.callFilter === currentCallFilter);
  });
  document.querySelectorAll('[data-school-filter]').forEach((button) => {
    button.classList.toggle('active-filter', button.dataset.schoolFilter === currentSchoolFilter);
  });
  document.querySelectorAll('[data-directory-filter]').forEach((button) => {
    button.classList.toggle('active-filter', button.dataset.directoryFilter === currentDirectoryFilter);
  });
  document.querySelectorAll('[data-asset-filter]').forEach((button) => {
    button.classList.toggle('active-filter', button.dataset.assetFilter === currentAssetFilter);
  });
  document.querySelectorAll('[data-import-filter]').forEach((button) => {
    button.classList.toggle('active-filter', button.dataset.importFilter === currentImportFilter);
  });
  document.querySelectorAll('[data-inventory-status]').forEach((button) => {
    button.classList.toggle('active-filter', button.dataset.inventoryStatus === currentInventoryStatus);
  });
}

function runGlobalSearch(query) {
  const term = normalizeKey(query);
  if (!term) {
    currentSearchQuery = '';
    currentSchoolSearch = '';
    currentInventorySearch = '';
    currentCallSchoolContext = '';
    currentImportSchoolContext = '';
    renderTasks();
    renderCalls();
    renderSchools();
    renderAssets();
    renderSchoolImports();
    saveUiContext();
    return;
  }

  const exactSchool = visibleSchools().find((item) =>
    normalizeKey(item.name) === term || normalizeKey(item.cie || '') === term
  );
  if (exactSchool) {
    currentSearchQuery = query.trim();
    currentSchoolSearch = query.trim();
    openSchoolRecord(exactSchool.name);
    saveUiContext();
    return;
  }

  const schoolMatches = visibleSchools().filter((item) =>
    normalizeKey(`${item.name} ${item.cie || ''} ${item.zone} ${item.notes || ''}`).includes(term)
  );
  const inventoryMatches = aggregateInventoryItems(state.schoolAssets).filter((item) =>
    normalizeKey(`${item.school} ${item.name} ${item.brand} ${item.model} ${item.notePreview || ''}`).includes(term)
  );
  const callMatches = state.calls.filter((item) =>
    normalizeKey(`${item.title} ${item.school} ${item.status}`).includes(term)
  );
  const importMatches = state.schoolImports.filter((item) =>
    normalizeKey(`${item.school} ${item.label || ''} ${item.filename || ''} ${item.summary || ''} ${item.preview || ''}`).includes(term)
  );
  const taskMatches = state.tasks.filter((item) =>
    normalizeKey(`${item.title} ${item.place} ${item.category}`).includes(term)
  );
  const generalAssetMatches = state.assets.filter((item) =>
    normalizeKey(`${item.name} ${item.place} ${item.status}`).includes(term)
  );

  currentSearchQuery = query.trim();
  currentSchoolSearch = query.trim();
  currentInventorySearch = '';
  currentCallSchoolContext = '';
  currentImportSchoolContext = '';

  if (schoolMatches.length) {
    showPage('schools');
    renderSchools();
    saveUiContext();
    return;
  }

  if (inventoryMatches.length) {
    const schools = [...new Set(inventoryMatches.map((item) => item.school))];
    currentInventorySearch = query.trim();
    currentInventorySchool = schools.length === 1 ? schools[0] : 'todas';
    showPage('assets');
    renderAssets();
    saveUiContext();
    return;
  }

  if (callMatches.length) {
    const schools = [...new Set(callMatches.map((item) => item.school))];
    currentCallSchoolContext = schools.length === 1 ? schools[0] : '';
    showPage('calls');
    renderCalls();
    saveUiContext();
    return;
  }

  if (importMatches.length) {
    const schools = [...new Set(importMatches.map((item) => item.school))];
    currentImportSchoolContext = schools.length === 1 ? schools[0] : '';
    showPage('schools');
    renderSchoolImports();
    saveUiContext();
    return;
  }

  if (taskMatches.length) {
    currentTaskFilter = 'todas';
    syncFilterButtons('task');
    showPage('agenda');
    renderTasks(taskMatches);
    saveUiContext();
    return;
  }

  if (generalAssetMatches.length) {
    showPage('assets');
    renderAssets();
    saveUiContext();
  }
}

function handleSearch(query) {
  currentSearchQuery = query.trim();
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runGlobalSearch(query), 140);
}

function shiftFocusCard(direction) {
  const pages = ['dashboard', 'schools', 'school-record', 'supervisors', 'supervisor-record', 'pecs', 'assets', 'calls', 'agenda', 'reports', 'info', 'settings', 'admin']
    .filter((page) => canAccessPage(page));
  const currentIndex = pages.indexOf(currentPage);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + pages.length) % pages.length;
  showPage(pages[nextIndex] || defaultPageForUser());
}

function applyPrivacy() {
  document.documentElement.dataset.privacy = privacyHidden ? 'hidden' : 'visible';
  document.querySelectorAll('.private').forEach((node) => node.classList.toggle('private-hidden', privacyHidden));
  const button = document.getElementById('privBtn');
  if (button) button.innerHTML = privacyHidden ? '&#128584;' : '&#128065;';
  localStorage.setItem(PRIVACY_KEY, privacyHidden ? '1' : '0');
}

function togglePrivacy() {
  privacyHidden = !privacyHidden;
  applyPrivacy();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const themeButton = document.getElementById('thmBtn');
  if (themeButton) {
    themeButton.innerHTML = theme === 'dark' ? '&#x2600;&#xFE0F;' : '&#x1F319;';
    themeButton.title = theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro';
  }
  document.getElementById('themeColorMeta').setAttribute('content', theme === 'dark' ? '#08090d' : '#f4f7ef');
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

function refreshAll() {
  state = mergeState(state);
  saveState();
  updateIdentity();
  syncFilterButtons('task');
  syncFilterButtons('call');
  syncFilterButtons('school');
  syncFilterButtons('directory');
  renderSetupStats();
  renderDashboardHero();
  renderDashboardAccess();
  renderDashboardOperationalLists();
  renderPendingQueue();
  renderOperationsCenter();
  renderMetrics();
  renderFocus();
  renderWeekBadges();
  renderTimeline();
  renderChecklist();
  renderPonto();
  renderRoutes();
  renderMunicipalities();
  renderOfficialData();
  renderSectors();
  renderDirectoryContacts();
  renderCtcAgenda();
  renderTasks();
  renderCalls();
  renderCallHistory();
  renderSchools();
  renderSupervisors();
  renderSupervisorRecord();
  renderSchoolDetail();
  renderAssets();
  renderReports();
  renderDiagnostics();
  renderUsers();
  applyPrivacy();
  const searchInput = document.getElementById('sidebarSearch');
  if (searchInput && searchInput.value !== currentSearchQuery) {
    searchInput.value = currentSearchQuery;
  }
  saveUiContext();
}
