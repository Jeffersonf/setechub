'use strict';

const legacyRenderSupervisors = renderSupervisors;
let supervisorsRenderTicket = null;

function renderSupervisorQuickMetrics() {
  const stats = supervisorStats();
  const visits = state.supervisorVisits || [];
  const assignedSchoolCount = new Set(stats.flatMap((item) => item.assignedSchools)).size;
  const averageCoverage = stats.length
    ? Math.round(stats.reduce((sum, item) => sum + item.coverage, 0) / stats.length)
    : 0;
  const metricCount = document.getElementById('supervisorMetricCount');
  const metricSchools = document.getElementById('supervisorMetricSchools');
  const metricVisits = document.getElementById('supervisorMetricVisits');
  const metricCoverage = document.getElementById('supervisorMetricCoverage');
  if (metricCount) metricCount.textContent = String(stats.length);
  if (metricSchools) metricSchools.textContent = String(assignedSchoolCount);
  if (metricVisits) metricVisits.textContent = String(visits.length);
  if (metricCoverage) metricCoverage.textContent = `${averageCoverage}%`;
}

function renderSupervisorQuickSelectors() {
  const stats = supervisorStats();
  const filterSelect = document.getElementById('supervisorFilterSelect');
  const visitSupervisorSelect = document.getElementById('visitSupervisorSelect');
  const visitSchoolSelect = document.getElementById('visitSchoolSelect');
  if (filterSelect && !filterSelect.options.length) {
    filterSelect.innerHTML = stats
      .map(({ supervisor }) => `<option value="${esc(normalizeKey(supervisor.name))}">${esc(supervisor.name)}</option>`)
      .join('');
  }
  if (filterSelect) filterSelect.value = currentSupervisorFilter;
  if (visitSupervisorSelect && !visitSupervisorSelect.options.length) {
    visitSupervisorSelect.innerHTML = stats
      .map(({ supervisor }) => `<option value="${esc(supervisor.name)}">${esc(supervisor.name)}</option>`)
      .join('');
  }
  if (visitSchoolSelect && !visitSchoolSelect.options.length) {
    const schools = stats[0]?.assignedSchools || visibleSchools().map((school) => school.name);
    visitSchoolSelect.innerHTML = schools.map((school) => `<option value="${esc(school)}">${esc(school)}</option>`).join('');
  }
}

function renderSupervisors() {
  cancelIdleRender(supervisorsRenderTicket);
  renderSupervisorQuickMetrics();
  renderSupervisorQuickSelectors();
  renderDeferredPlaceholders([
    '#supervisorPanelGrid',
    '#supervisorSelectorList',
    '#supervisorOverviewPanel',
    '#supervisorAttentionList',
    '#supervisorVisitTable'
  ], 'Carregando supervisao...');
  supervisorsRenderTicket = scheduleIdleRender(() => {
    supervisorsRenderTicket = null;
    legacyRenderSupervisors();
  }, { timeout: 1000, delay: 70 });
}
