'use strict';

const legacyRenderSupervisors = window.renderSupervisors;
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

function supervisorWeekRangeForView(weekNumber) {
  const start = new Date(supervisorViewWeekOneStart());
  start.setDate(start.getDate() + ((Number(weekNumber) - 1) * 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function supervisorWeekRangeLabel(weekNumber) {
  const { start, end } = supervisorWeekRangeForView(weekNumber);
  const dateOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
  return {
    start: start.toLocaleDateString('pt-BR', dateOptions),
    end: end.toLocaleDateString('pt-BR', dateOptions)
  };
}

function supervisorWeekVisitCount(visits, supervisorName, schoolName, weekNumber) {
  return (visits || []).filter((visit) => {
    if (visit.supervisor !== supervisorName || visit.school !== schoolName) return false;
    const date = new Date(`${visit.date}T00:00:00`);
    return supervisorDateWeekForView(date) === Number(weekNumber);
  }).length;
}

function supervisorWeeklyMatrixStatus(visitedCount, totalSchools, weekEnd) {
  if (!totalSchools) return 'aguardando';
  if (visitedCount >= totalSchools) return 'verde';
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedMonthEnded = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 0) < todayStart;
  const weekEnded = weekEnd < todayStart;
  return selectedMonthEnded || weekEnded ? 'vermelho' : 'aguardando';
}

function supervisorWeeklyMatrixStatusClass(status) {
  if (status === 'verde') return 'matrix-green';
  if (status === 'vermelho') return 'matrix-red';
  return 'matrix-wait';
}

function renderSupervisorWeeklyMatrixForRecord(selectedStat, visits) {
  const panel = document.getElementById('supervisorRecordWeeklyMatrix');
  if (!panel) return;
  if (!selectedStat) {
    panel.innerHTML = '<div class="sync-empty">Nenhum supervisor selecionado para montar a matriz semanal.</div>';
    return;
  }
  const supervisor = selectedStat.supervisor;
  const schools = (selectedStat.assignedSchools || supervisor.schools || []).filter(Boolean);
  if (!schools.length) {
    panel.innerHTML = '<div class="sync-empty">Este supervisor ainda nao possui escolas vinculadas.</div>';
    return;
  }
  const weekCount = Math.max(1, supervisorLastWeekOfViewMonth());
  const weeks = Array.from({ length: weekCount }, (_, index) => index + 1);
  panel.innerHTML = `
    <div class="supervisor-weekly-matrix-wrap">
      <table class="supervisor-weekly-matrix">
        <thead>
          <tr>
            <th class="week-col">Semana</th>
            ${schools.map((school) => `<th>${esc(school)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${weeks.map((weekNumber) => {
            const range = supervisorWeekRangeForView(weekNumber);
            const rangeLabel = supervisorWeekRangeLabel(weekNumber);
            const cells = schools.map((school) => ({
              school,
              count: supervisorWeekVisitCount(visits, supervisor.name, school, weekNumber)
            }));
            const visitedCount = cells.filter((cell) => cell.count > 0).length;
            const status = supervisorWeeklyMatrixStatus(visitedCount, schools.length, range.end);
            const statusClass = supervisorWeeklyMatrixStatusClass(status);
            return `
              <tr>
                <td class="week-col">
                  <strong>Semana ${esc(String(weekNumber))}</strong>
                  <span>${esc(rangeLabel.start)} - ${esc(rangeLabel.end)}</span>
                  <small>${esc(String(visitedCount))}/${esc(String(schools.length))} escola(s)</small>
                </td>
                ${cells.map((cell) => `
                  <td class="${cell.count > 0 ? 'visited' : statusClass}">
                    <strong>${esc(String(cell.count))}</strong>
                    <span>${cell.count > 0 ? 'visita(s)' : status === 'aguardando' ? 'aguardando' : 'sem visita'}</span>
                  </td>
                `).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

window.renderSupervisors = function renderSupervisorsPage() {
  cancelIdleRender(supervisorsRenderTicket);
  renderSupervisorQuickMetrics();
  renderSupervisorQuickSelectors();
  try {
    legacyRenderSupervisors();
  } catch (error) {
    console.error('Falha ao carregar supervisao', error);
    renderDeferredPlaceholders([
      '#supervisorPanelGrid',
      '#supervisorSelectorList'
    ], 'Nao foi possivel carregar a supervisao. Atualize a pagina.');
  }
};
