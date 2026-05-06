'use strict';

const legacyRenderAssets = window.renderAssets;
let inventoryRenderTicket = null;

function renderInventoryQuickHeader() {
  const filtered = filteredSchoolAssets();
  const totalUnits = filtered.reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const alertUnits = filtered.filter((item) => item.status !== 'ok').reduce((sum, item) => sum + schoolAssetUnits(item), 0);
  const coveredSchools = new Set(filtered.map((item) => item.school)).size;
  const totalSchools = visibleSchools().length || 1;
  const focusSchool = inventoryFocusSchool();
  const regionalView = currentInventorySchool === 'todas';

  const title = document.getElementById('inventoryHeroTitle');
  const text = document.getElementById('inventoryHeroText');
  const stats = document.getElementById('inventoryHeroStats');
  const score = document.getElementById('inventoryHeroScore');
  if (title) title.textContent = regionalView ? 'Inventario regional' : focusSchool;
  if (text) {
    text.textContent = regionalView
      ? `${coveredSchools}/${totalSchools} escola(s) com inventario no recorte.`
      : `Resumo inicial da unidade, com detalhes carregando em seguida.`;
  }
  if (stats) {
    stats.innerHTML = [
      { label: 'Unidades', value: String(totalUnits), note: 'no recorte atual' },
      { label: 'Atencao', value: String(alertUnits), note: 'manutencao ou defeito' },
      { label: 'Cobertura', value: `${Math.round((coveredSchools / totalSchools) * 100)}%`, note: `${coveredSchools}/${totalSchools} escolas` }
    ].map((item) => `
      <div class="inventory-hero-stat">
        <span>${esc(item.label)}</span>
        <strong>${esc(item.value)}</strong>
        <small>${esc(item.note)}</small>
      </div>
    `).join('');
  }
  if (score) {
    score.innerHTML = `
      <div class="inventory-risk-top"><span>Carregando matriz</span><strong>${esc(String(alertUnits))}</strong></div>
      <div class="inventory-risk-bar"><span style="width:${esc(String(totalUnits ? Math.min(100, Math.round((alertUnits / totalUnits) * 100)) : 0))}%"></span></div>
      <div class="inventory-risk-foot"><span class="diag-pill ${alertUnits ? 'pill-warn' : 'pill-ok'}">${alertUnits ? 'ha pontos de atencao' : 'sem alerta no recorte'}</span></div>
    `;
  }
}

function renderInventorySelectsQuickly() {
  const schoolSelect = document.getElementById('inventorySchoolSelect');
  const zoneSelect = document.getElementById('inventoryZoneSelect');
  const searchInput = document.getElementById('inventorySearchInput');
  const schools = visibleSchools().slice().sort((a, b) => a.name.localeCompare(b.name));
  if (schoolSelect && !schoolSelect.options.length) {
    schoolSelect.innerHTML = '<option value="todas">Todas as escolas</option>' + schools
      .map((school) => `<option value="${esc(school.name)}">${esc(school.name)}</option>`)
      .join('');
  }
  if (schoolSelect) schoolSelect.value = currentInventorySchool;
  if (zoneSelect && !zoneSelect.options.length) {
    const zones = ['todas', ...new Set(schools.map((school) => school.zone).filter(Boolean))];
    zoneSelect.innerHTML = zones
      .map((zone) => `<option value="${esc(zone)}">${zone === 'todas' ? 'Todas as cidades' : esc(zone)}</option>`)
      .join('');
  }
  if (zoneSelect) zoneSelect.value = currentInventoryZone;
  if (searchInput) searchInput.value = currentInventorySearch;
}

window.renderAssets = function renderAssetsPage() {
  cancelIdleRender(inventoryRenderTicket);
  renderInventoryQuickHeader();
  renderInventorySelectsQuickly();
  try {
    legacyRenderAssets();
  } catch (error) {
    console.error('Falha ao carregar inventario', error);
    renderDeferredPlaceholders([
      '#inventoryDetailTable',
      '#schoolAssetList'
    ], 'Nao foi possivel carregar o inventario. Atualize a pagina.');
  }
};
