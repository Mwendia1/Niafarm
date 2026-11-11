// ===== AUTH MODULE =====
async function initAuth() {
  const token = localStorage.getItem('nf_token');
  const user = state.getUser();
  if (token && user) {
    if (localStorage.getItem('nf_admin_token')) {
      document.getElementById('impersonateBanner').style.display = 'flex';
    }
    showApp(user);
  } else {
    showAuthPage('login');
  }
}

function showAuthPage(page) {
  document.getElementById('authSection').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
  document.getElementById('loginForm').style.display = page === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = page === 'register' ? 'block' : 'none';
}

async function showApp(user) {
  document.getElementById('authSection').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  // Clear stale farm selection so loadFarms() always picks the correct farm for this user
  localStorage.removeItem('nf_farm_id');
  state.currentFarm = null;
  const avatarEl = document.getElementById('userAvatar');
  const avatarMenuEl = document.getElementById('userAvatarMenu');
  const avatarSrc = user.avatar ? user.avatar : null;
  if (avatarSrc) {
    const img = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    if (avatarEl) avatarEl.innerHTML = img;
    if (avatarMenuEl) avatarMenuEl.innerHTML = img;
  } else {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (avatarEl) avatarEl.textContent = initials;
    if (avatarMenuEl) avatarMenuEl.textContent = initials;
  }
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userRole').textContent = user.role.replace(/_/g, ' ');
  const canEdit = ['admin', 'farm_owner'].includes(user.role);
  const addFarmBtn = document.getElementById('addFarmBtn');
  if (addFarmBtn) addFarmBtn.style.display = canEdit ? '' : 'none';
  document.querySelector('[data-page="farms"]').style.display = canEdit ? '' : 'none';
  const farms = await loadFarms();
  if (farms.length === 0) {
    navigate('farms');
    toast.warning('Please register your first farm to get started');
  } else {
    navigate('dashboard');
  }
  loadNotificationCount();
}

document.getElementById('loginFormEl').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Signing in...';
  document.getElementById('loginError').style.display = 'none';
  try {
    const data = await api.post('/auth/login', {
      email: document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value
    });
    localStorage.setItem('nf_token', data.token);
    // Fetch full profile to get avatar
    const profile = await fetch('http://localhost:3000/api/auth/profile', { headers: { 'Authorization': `Bearer ${data.token}` } }).then(r => r.json());
    const user = { ...data.user, avatar: profile.avatar, job_title: profile.job_title };
    state.setUser(user);
    showApp(user);
  } catch (err) {
    document.getElementById('loginError').textContent = err.message;
    document.getElementById('loginError').style.display = 'block';
  } finally { btn.disabled = false; btn.textContent = 'Sign In'; }
});

document.getElementById('registerFormEl').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Creating account...';
  document.getElementById('registerError').style.display = 'none';
  try {
    const data = await api.post('/auth/register', {
      name: document.getElementById('regName').value,
      email: document.getElementById('regEmail').value,
      password: document.getElementById('regPassword').value,
      phone: document.getElementById('regPhone').value,
      role: 'farm_owner'
    });
    localStorage.setItem('nf_token', data.token);
    state.setUser(data.user);
    showApp(data.user);
    toast.success('Account created! Welcome to FarmNest ');
  } catch (err) {
    document.getElementById('registerError').textContent = err.message;
    document.getElementById('registerError').style.display = 'block';
  } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
});

function logout() {
  localStorage.removeItem('nf_token');
  localStorage.removeItem('nf_user');
  localStorage.removeItem('nf_farm_id');
  localStorage.removeItem('nf_admin_token');
  localStorage.removeItem('nf_admin_user');
  state.user = null; state.currentFarm = null;
  location.reload();
}

async function impersonateUser(userId, userName) {
  if (!confirm(`Login as ${userName}?`)) return;
  try {
    const data = await api.post(`/auth/impersonate/${userId}`, {});
    // Save admin session
    localStorage.setItem('nf_admin_token', localStorage.getItem('nf_token'));
    localStorage.setItem('nf_admin_user', localStorage.getItem('nf_user'));
    // Switch to target user
    localStorage.setItem('nf_token', data.token);
    state.setUser(data.user);
    localStorage.removeItem('nf_farm_id');
    state.currentFarm = null;
    document.getElementById('impersonateBanner').style.display = 'flex';
    await showApp(data.user);
    toast.success(`Now viewing as ${data.user.name}`);
  } catch (err) { toast.error(err.message); }
}

async function returnToAdmin() {
  const adminToken = localStorage.getItem('nf_admin_token');
  const adminUser = localStorage.getItem('nf_admin_user');
  if (!adminToken || !adminUser) return;
  localStorage.setItem('nf_token', adminToken);
  localStorage.removeItem('nf_admin_token');
  localStorage.removeItem('nf_admin_user');
  localStorage.removeItem('nf_farm_id');
  state.currentFarm = null;
  const user = JSON.parse(adminUser);
  state.setUser(user);
  document.getElementById('impersonateBanner').style.display = 'none';
  await showApp(user);
  toast.success('Returned to admin account');
}

async function loadNotificationCount() {
  try {
    const farmId = state.getCurrentFarmId();
    if (!farmId) return;
    const notifs = await api.get(`/notifications?farm_id=${farmId}&is_read=false`);
    const count = notifs.length;
    const badge = document.getElementById('notifBadge');
    if (count > 0) { badge.textContent = count > 9 ? '9+' : count; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
    const sb = document.getElementById('notifSidebarBadge');
    if (sb) { sb.textContent = count; sb.style.display = count > 0 ? 'inline' : 'none'; }
  } catch {}
}
