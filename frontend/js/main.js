// ===== PAGE LOADER =====
function loadPage(page) {
  switch (page) {
    case 'dashboard':   loadDashboard(); break;
    case 'farms':       loadFarmsPage(); break;
    case 'flocks':      loadFlocks(); break;
    case 'feeding':     loadFeeding(); break;
    case 'health':      loadHealth(); break;
    case 'eggs':        loadEggs(); break;
    case 'inventory':   loadInventory(); break;
    case 'sales':       loadSales(); break;
    case 'expenses':    loadExpenses(); break;
    case 'reports':     loadReports(); break;
    case 'notifications': loadNotificationsPage(); break;
    case 'settings':    loadSettings(); break;
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initAuth();

  // Sidebar toggle (mobile)
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });

  // Nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  // Farm selector
  document.getElementById('farmSelector').addEventListener('change', async (e) => {
    const farm = state.farms.find(f => f.id == e.target.value);
    if (farm) {
      state.setCurrentFarm(farm);
      await populateBatchSelects(farm.id);
      loadPage(getCurrentPage());
    }
  });

  // Offline bar
  if (!navigator.onLine) document.querySelector('.offline-bar')?.classList.add('visible');
});
