// ===== AUTH MODULE =====
async function initAuth() {
  const token = localStorage.getItem('nf_token');
  const user = state.getUser();
  if (token && user) {
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
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userAvatarMenu').textContent = initials;
  document.getElementById('userName').textContent = user.name;
  document.getElementById('userRole').textContent = user.role.replace(/_/g, ' ');
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
    state.setUser(data.user);
    showApp(data.user);
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
    toast.success('Account created! Welcome to NiaFarm 🐔');
  } catch (err) {
    document.getElementById('registerError').textContent = err.message;
    document.getElementById('registerError').style.display = 'block';
  } finally { btn.disabled = false; btn.textContent = 'Create Account'; }
});

function logout() {
  localStorage.removeItem('nf_token');
  localStorage.removeItem('nf_user');
  localStorage.removeItem('nf_farm_id');
  state.user = null; state.currentFarm = null;
  location.reload();
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
