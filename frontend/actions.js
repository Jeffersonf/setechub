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

function exportJson() {
  downloadFile('setechub-backup.json', JSON.stringify(state, null, 2), 'application/json');
}

function exportSummary() {
  const summary = [
    'SETECHUB | Resumo operacional',
    `Responsavel: ${state.profile.name}`,
    `Unidade: ${state.profile.unit}`,
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

function restoreState(file) {
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
  state.tasks = state.tasks.map((item) => item.id === id ? { ...item, done: !item.done } : item);
  refreshAll();
}

function removeTask(id) {
  state.tasks = state.tasks.filter((item) => item.id !== id);
  refreshAll();
}

function toggleChecklist(id) {
  state.checklist = state.checklist.map((item) => item.id === id ? { ...item, done: !item.done } : item);
  refreshAll();
}

function advanceCall(id) {
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
  state.calls = state.calls.filter((item) => item.id !== id);
  refreshAll();
}

function cycleSchool(id) {
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
  state.officialLinks = state.officialLinks.filter((item) => item.id !== id);
  refreshAll();
}

function removeSector(id) {
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
  currentSupervisorDetail = name;
  currentSupervisorFilter = normalizeKey(name);
  showPage('supervisor-record');
  renderSupervisorRecord();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function removeSchoolImport(id) {
  const target = state.schoolImports.find((item) => item.id === id);
  if (target) logSchoolEvent(target.school, 'import', `Importacao removida: ${target.label || target.filename || 'arquivo'}.`);
  state.schoolImports = state.schoolImports.filter((item) => item.id !== id);
  refreshAll();
}

function approveSchoolImport(id) {
  state.schoolImports = state.schoolImports.map((item) => {
    if (item.id !== id) return item;
    logSchoolEvent(item.school, 'review', `Importacao confirmada: ${item.label || item.filename || 'arquivo'}.`);
    return { ...item, reviewStatus: 'approved' };
  });
  refreshAll();
}

function rejectSchoolImport(id) {
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
  const order = ['ok', 'manutencao', 'defeito'];
  state.schoolAssets = state.schoolAssets.map((item) => {
    if (item.id !== id) return item;
    return { ...item, status: order[(order.indexOf(item.status) + 1) % order.length] };
  });
  refreshAll();
}

function removeSchoolAsset(id) {
  state.schoolAssets = state.schoolAssets.filter((item) => item.id !== id);
  refreshAll();
}

function showSchoolDetail(name) {
  currentSchoolDetail = name;
  currentInventorySchool = name;
  currentSchoolSearch = '';
  currentImportSchoolContext = name;
  showPage('school-record');
  renderSchoolDetail();
  renderAssets();
  renderSchoolImports();
  document.getElementById('schoolDetailSelect').value = name;
  const inventorySelect = document.getElementById('inventorySchoolSelect');
  if (inventorySelect) inventorySelect.value = name;
}

function setInventorySchool(name) {
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

function renameSchoolReferences(previousName, nextName) {
  if (!previousName || !nextName || previousName === nextName) return;
  state.tasks = state.tasks.map((item) => item.place === previousName ? { ...item, place: nextName } : item);
  state.calls = state.calls.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolProfiles = state.schoolProfiles.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolImports = state.schoolImports.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolAssets = state.schoolAssets.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
  state.schoolNetworks = state.schoolNetworks.map((item) => item.school === previousName ? { ...item, school: nextName } : item);
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
}

function copySchoolSummary() {
  const school = state.schools.find((item) => item.name === currentSchoolDetail);
  const profile = currentSchoolProfile();
  const assets = state.schoolAssets.filter((item) => item.school === currentSchoolDetail);
  const imports = state.schoolImports.filter((item) => item.school === currentSchoolDetail);
  if (!school) return;
  const summary = [
    school.name,
    `Municipio: ${school.zone}`,
    `Status: ${badgeText(school.status)}`,
    `Direcao: ${profile?.director || 'Nao informado'}`,
    `Telefone: ${profile?.phone || 'Nao informado'}`,
    `E-mail: ${profile?.email || 'Nao informado'}`,
    `Equipamentos: ${assets.reduce((sum, item) => sum + schoolAssetUnits(item), 0)}`,
    `Importacoes: ${imports.length}`,
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

  document.getElementById('schoolForm').addEventListener('submit', (event) => {
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

  document.getElementById('schoolDetailSelect').addEventListener('change', (event) => {
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

  document.getElementById('assetForm').addEventListener('submit', (event) => {
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
    const unit = document.getElementById('profileUnit').value.trim();
    const pin = document.getElementById('profilePin').value.trim();
    if (!name || !unit || !pin) return;
    state.profile = { name, unit, pin };
    refreshAll();
    alert('Perfil atualizado.');
  });

  document.getElementById('officialForm').addEventListener('submit', (event) => {
    event.preventDefault();
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

  document.getElementById('schoolImportForm').addEventListener('submit', async (event) => {
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

  document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('loginName').value.trim();
    const pin = document.getElementById('loginPin').value.trim();
    const error = document.getElementById('loginError');
    if (name.toLowerCase() === state.profile.name.toLowerCase() && pin === state.profile.pin) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      document.getElementById('setup').style.display = 'none';
      error.textContent = '';
      return;
    }
    error.textContent = 'Nome ou PIN invalido.';
    error.classList.add('show');
  });

  document.getElementById('backupBtn').addEventListener('click', exportJson);
  document.getElementById('exportSummaryBtn').addEventListener('click', exportSummary);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    document.getElementById('setup').style.display = '';
  });
  document.getElementById('resetBtn').addEventListener('click', () => {
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
  document.getElementById('supabaseConfigForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
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
    button.addEventListener('click', () => showPage(button.dataset.page));
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
