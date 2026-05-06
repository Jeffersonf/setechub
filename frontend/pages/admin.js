'use strict';

const legacyRenderDiagnostics = renderDiagnostics;
const legacyRenderUsers = renderUsers;
const legacyRenderAdminSchoolTools = renderAdminSchoolTools;
let adminRenderTicket = null;

function renderAdminPage() {
  cancelIdleRender(adminRenderTicket);
  try {
    legacyRenderDiagnostics();
    legacyRenderUsers();
    legacyRenderAdminSchoolTools();
  } catch (error) {
    console.error('Falha ao carregar administracao', error);
    renderDeferredPlaceholders([
      '#diagnosticList',
      '#userList',
      '#adminSchoolList'
    ], 'Nao foi possivel carregar a administracao. Atualize a pagina.');
  }
}
