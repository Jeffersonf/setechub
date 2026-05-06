'use strict';

const legacyRenderDiagnostics = renderDiagnostics;
const legacyRenderUsers = renderUsers;
const legacyRenderAdminSchoolTools = renderAdminSchoolTools;
let adminRenderTicket = null;

function renderAdminPage() {
  cancelIdleRender(adminRenderTicket);
  renderDeferredPlaceholders([
    '#diagnosticList',
    '#userList',
    '#adminSchoolList',
    '#adminImportInfo',
    '#snapshotList'
  ], 'Carregando administracao...');
  adminRenderTicket = scheduleIdleRender(() => {
    adminRenderTicket = null;
    legacyRenderDiagnostics();
    legacyRenderUsers();
    legacyRenderAdminSchoolTools();
  }, { timeout: 1000, delay: 80 });
}
