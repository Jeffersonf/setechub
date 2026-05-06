'use strict';

function schoolCardStatus(school) {
  const snapshot = schoolOperationalSnapshot(school);
  if (snapshot.alertUnits) return { tone: 'pill-warn', label: `${snapshot.alertUnits} item(ns)` };
  if (snapshot.openCalls) return { tone: 'pill-warn', label: `${snapshot.openCalls} chamado(s)` };
  return { tone: 'pill-ok', label: 'OK' };
}

function schoolCardMarkup(school) {
  const snapshot = schoolOperationalSnapshot(school);
  const status = schoolCardStatus(school);
  return `
    <article class="school-card-lite">
      <button class="school-card-lite-main" type="button" onclick="openSchoolRecord('${esc(school.name)}')">
        ${schoolAvatarMarkup(school, 'school-widget-avatar')}
        <span class="school-card-lite-copy">
          <strong>${esc(school.name)}</strong>
          <small>${esc(school.zone)} | CIE ${esc(school.cie || '--')}</small>
        </span>
        <span class="diag-pill ${status.tone}">${esc(status.label)}</span>
      </button>
      <div class="school-card-lite-foot">
        <span>Ficha ${esc(String(snapshot.completion))}%</span>
        <span>${esc(String(snapshot.assetUnits))} item(ns)</span>
      </div>
    </article>
  `;
}
