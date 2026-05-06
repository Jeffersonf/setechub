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

function supervisorWeeklyMatrixStatusLabel(status) {
  if (status === 'verde') return 'Verde';
  if (status === 'vermelho') return 'Vermelho';
  return 'Aguardando';
}

function supervisorWeeklyMatrixStatusClass(status) {
  if (status === 'verde') return 'matrix-green';
  if (status === 'vermelho') return 'matrix-red';
  return 'matrix-wait';
}

function supervisorWeeklyMatrixIcon(count, status) {
  if (count > 0) return '&#9989;';
  if (status === 'aguardando') return '&#9203;';
  return '&#10060;';
}

function renderSupervisorWeeklyMatrix(stats, visits) {
  const panel = document.getElementById('supervisorWeeklyMatrixPanel');
  if (!panel) return;
  const selectedStat = stats.find((item) => normalizeKey(item.supervisor.name) === currentSupervisorFilter) || stats[0];
  if (!selectedStat) {
    panel.innerHTML = '<div class="sync-empty">Nenhum supervisor cadastrado para montar a matriz semanal.</div>';
    return;
  }
  const supervisor = selectedStat.supervisor;
  const schools = (selectedStat.assignedSchools || supervisor.schools || []).filter(Boolean);
  const weekCount = Math.max(1, supervisorLastWeekOfViewMonth());
  const weeks = Array.from({ length: weekCount }, (_, index) => index + 1);
  const viewMonthKey = `${currentViewDate.getFullYear()}-${String(currentViewDate.getMonth() + 1).padStart(2, '0')}`;
  const viewMonthLabel = supervisorSheetMonthLabel(viewMonthKey);
  panel.innerHTML = `
    <div class="supervisor-weekly-matrix-head">
      <div>
        <strong>Tabela semanal de visitas</strong>
        <span>${esc(supervisor.name)} | ${esc(viewMonthLabel)}</span>
      </div>
      <button class="btn btn-g btn-sm" type="button" onclick="openSupervisorRecord('${esc(supervisor.name)}')">Abrir supervisor</button>
    </div>
    <div class="supervisor-weekly-matrix-wrap">
      <table class="supervisor-weekly-matrix">
        <thead>
          <tr>
            <th class="week-col">Semana</th>
            ${schools.map((school) => `<th>${esc(school)}</th>`).join('')}
            <th class="signal-col">Farol</th>
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
                  <span><b>Inicio</b> ${esc(rangeLabel.start)}</span>
                  <span><b>Fim</b> ${esc(rangeLabel.end)}</span>
                </td>
                ${cells.map((cell) => `
                  <td class="${cell.count > 0 ? 'visited' : statusClass}">
                    <strong>${esc(String(cell.count))}</strong>
                    <span>${supervisorWeeklyMatrixIcon(cell.count, status)}</span>
                  </td>
                `).join('')}
                <td class="signal-col ${statusClass}">
                  <strong>${esc(supervisorWeeklyMatrixStatusLabel(status))}</strong>
                  <span>${esc(String(visitedCount))}/${esc(String(schools.length))}</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSupervisors() {
  cancelIdleRender(supervisorsRenderTicket);
  renderSupervisorQuickMetrics();
  renderSupervisorQuickSelectors();
  try {
    legacyRenderSupervisors();
  } catch (error) {
    console.error('Falha ao carregar supervisao', error);
    renderDeferredPlaceholders([
      '#supervisorPanelGrid',
      '#supervisorWeeklyMatrixPanel',
      '#supervisorSelectorList'
    ], 'Nao foi possivel carregar a supervisao. Atualize a pagina.');
  }
}
