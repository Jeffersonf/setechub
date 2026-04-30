'use strict';

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
setupEventListeners();
restoreUiContext();
restorePageFromHash();
refreshAll();
showPage(currentPage || sessionStorage.getItem(PAGE_KEY) || 'dashboard');
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
  restorePageFromHash();
  showPage(currentPage || 'dashboard');
});

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

(async () => {
  await refreshServerHealth();
  await syncFromServerIfUseful();
  await loadServerSnapshots();
  await refreshServerHealth();
})();
