// ===== SETTINGS MODULE =====
async function loadSettings() {
  const user = state.getUser();
  if (!user) return;
  document.getElementById('settingName').value = user.name || '';
  document.getElementById('settingEmail').value = user.email || '';
  document.getElementById('settingPhone').value = user.phone || '';
  document.getElementById('settingRole').textContent = user.role?.replace(/_/g, ' ') || '';
  updateAvatarDisplay(user);
  const usersTabBtn = document.querySelector('.tab-btn[onclick*="usersTab"]');
  if (usersTabBtn) usersTabBtn.style.display = user.role === 'admin' ? '' : 'none';
  if (user.role === 'admin') loadUsersList();
}

function updateAvatarDisplay(user) {
  const preview = document.getElementById('profileAvatarPreview');
  const avatarSrc = user.avatar ? `http://localhost:3000${user.avatar}` : null;
  if (!preview) return;
  if (avatarSrc) {
    preview.innerHTML = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover">`;
  } else {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    preview.textContent = initials;
  }
  const avatarEl = document.getElementById('userAvatar');
  const avatarMenuEl = document.getElementById('userAvatarMenu');
  if (avatarSrc) {
    const img = `<img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    if (avatarEl) avatarEl.innerHTML = img;
    if (avatarMenuEl) avatarMenuEl.innerHTML = img;
  } else {
    const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (avatarEl) avatarEl.textContent = initials;
    if (avatarMenuEl) avatarMenuEl.textContent = initials;
  }
}

async function uploadAvatar(input) {
  if (!input.files[0]) return;
  const formData = new FormData();
  formData.append('avatar', input.files[0]);
  try {
    const res = await fetch('http://localhost:3000/api/auth/avatar', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('nf_token')}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const user = state.getUser();
    user.avatar = data.avatar;
    state.setUser(user);
    updateAvatarDisplay(user);
    toast.success('Profile photo updated');
  } catch (err) { toast.error(err.message); }
}

async function saveProfile() {
  const name = document.getElementById('settingName').value;
  const phone = document.getElementById('settingPhone').value;
  if (!name) { toast.error('Name required'); return; }
  try {
    await api.put('/auth/profile', { name, phone });
    const user = state.getUser();
    user.name = name; user.phone = phone;
    state.setUser(user);
    updateAvatarDisplay(user);
    document.getElementById('userName').textContent = name;
    toast.success('Profile updated successfully');
  } catch (err) { toast.error(err.message); }
}

async function changePassword() {
  const current = document.getElementById('currentPassword').value;
  const newPass = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;
  if (!current || !newPass) { toast.error('Fill all password fields'); return; }
  if (newPass !== confirm) { toast.error('New passwords do not match'); return; }
  if (newPass.length < 6) { toast.error('Password must be at least 6 characters'); return; }
  try {
    await api.post('/auth/change-password', { current_password: current, new_password: newPass });
    toast.success('Password changed successfully');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
  } catch (err) { toast.error(err.message); }
}

async function loadUsersList() {
  try {
    const users = await api.get('/auth/users');
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    const me = state.getUser();
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="badge badge-blue">${u.role.replace(/_/g, ' ')}</span></td>
        <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>${fmt.date(u.created_at)}</td>
        <td>${u.id !== me.id ? `<button class="btn btn-sm btn-primary" onclick="impersonateUser(${u.id},'${u.name}')">Login as</button>` : '<span style="color:var(--grey-700)">You</span>'}</td>
      </tr>
    `).join('');
  } catch {}
}
