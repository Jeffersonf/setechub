'use strict';

function renderSchoolDirectoryStats(schools) {
  const statsNode = document.getElementById('schoolDirectoryStats');
  if (!statsNode) return;
  const baseSchools = visibleSchools();
  const visibleNames = new Set(schools.map((school) => normalizeKey(school.name)));
  const shownAssets = state.schoolAssets.filter((item) => visibleNames.has(normalizeKey(item.school)));
  const assetSchools = new Set(shownAssets.map((item) => normalizeKey(item.school)));
  const snapshots = schools.map((school) => schoolOperationalSnapshot(school));
  const alertSchools = snapshots.filter((snapshot) => snapshot.alertUnits > 0 || snapshot.openCalls > 0).length;
  const noInventory = schools.length - assetSchools.size;
  const recordsOk = snapshots.filter((snapshot) => snapshot.completion >= 80).length;
  statsNode.innerHTML = [
    { label: 'No filtro', value: String(schools.length), note: `${baseSchools.length} unidade(s) visiveis` },
    { label: 'Com inventario', value: String(assetSchools.size), note: `${noInventory} sem inventario` },
    { label: 'Em atencao', value: String(alertSchools), note: 'chamado ou equipamento' },
    { label: 'Ficha 80%+', value: String(recordsOk), note: 'dados principais completos' }
  ].map((item) => `
    <div class="school-directory-stat">
      <span>${esc(item.label)}</span>
      <strong>${esc(item.value)}</strong>
      <small>${esc(item.note)}</small>
    </div>
  `).join('');
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

  const term = normalizeKey(currentSchoolSearch);
  const schools = visibleSchools()
    .filter((school) => currentSchoolZoneFilter === 'todas' || school.zone === currentSchoolZoneFilter)
    .filter((school) => !term || normalizeKey(`${school.name} ${school.zone} ${school.cie || ''}`).includes(term))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  renderSchoolDirectoryStats(schools);
  const schoolList = document.getElementById('schoolList');
  if (schoolList) {
    schoolList.innerHTML = schools.length
      ? `<div class="school-card-grid-lite">${schools.map(schoolCardMarkup).join('')}</div>`
      : '<div class="sync-empty">Nenhuma escola encontrada neste filtro.</div>';
  }
  const options = document.getElementById('officialSchoolOptions');
  if (options) {
    options.innerHTML = visibleSchools()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((school) => `<option value="${esc(school.name)}"></option>`)
      .join('');
  }
}
