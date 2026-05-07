'use strict';

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
setupEventListeners();
restoreUiContext();
restorePageFromHash();
showPage(currentPage || sessionStorage.getItem(PAGE_KEY) || 'dashboard', { render: false });
if (currentPage === 'info') {
  renderCurrentPage('info');
  applySystemIcons();
  applyPrivacy();
}
updateSupabaseStatus(
  supabaseConfig().url && supabaseConfig().anonKey
    ? 'Supabase configurado neste navegador.'
    : 'Supabase nao configurado.',
  !!(supabaseConfig().url && supabaseConfig().anonKey)
);

function setLoginVisible(visible) {
  const setup = document.getElementById('setup');
  if (!setup) return;
  setup.classList.toggle('visible', visible);
  setup.style.display = visible ? '' : 'none';
  document.body.classList.toggle('login-open', visible);
  if (visible) {
    setTimeout(() => document.getElementById('loginName')?.focus(), 0);
  }
}
window.setLoginVisible = setLoginVisible;

window.addEventListener('hashchange', () => {
  if (window.__setecInternalHashChange) {
    window.__setecInternalHashChange = false;
    return;
  }
  restorePageFromHash();
  showPage(currentPage || 'dashboard');
});

document.addEventListener('fullscreenchange', updateSupervisorFullscreenButton);

function restoreLoginState() {
  if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
    if (!sessionStorage.getItem(ACTIVE_USER_KEY)) {
      const fallbackUser = (state.users || []).find((item) => item.role === 'admin') || state.users?.[0];
      if (fallbackUser) sessionStorage.setItem(ACTIVE_USER_KEY, fallbackUser.id);
    }
    if (currentUser()) {
      setLoginVisible(false);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(ACTIVE_USER_KEY);
      setLoginVisible(true);
    }
  } else {
    setLoginVisible(true);
  }
}

(async () => {
  await initializeSupabaseState();
  restoreUiContext();
  restorePageFromHash();
  showPage(currentPage || sessionStorage.getItem(PAGE_KEY) || 'dashboard', { render: false });
  refreshAll();
  if (typeof applyFunAdsMode === 'function') applyFunAdsMode();
  restoreLoginState();
  supabaseAutoSaveReady = true;
  scheduleSupabaseAutoSave();
  setTimeout(async () => {
    try {
      await refreshServerHealth();
      await syncFromServerIfUseful();
      await loadServerSnapshots();
      await syncSupervisorVisitSources({ silent: true });
      const aprilSheet = supervisorMonthlySheetLinks().find((item) => item.monthKey === '2026-04');
      if (aprilSheet) await syncSupervisorMonthlySheet(aprilSheet.id, { silent: true, preserveView: true });
      await refreshServerHealth();
    } catch (error) {
      console.warn('Sincronização em segundo plano não concluída.', error);
    }
  }, 250);
})();
