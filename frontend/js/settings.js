// ===== SETTINGS MODULE =====
async function loadSettings() {
  const user = state.getUser();
  if (!user) return;
  document.getElementById('settingName').value = user.name || '';
  document.getElementById('settingEmail').value = user.email || '';
  document.getElementById('settingPhone').value = user.phone || '';
  document.getElementById('settingRole').textContent = user.role?.replace(/_/g, ' ') || '';
  if (['admin', 'farm_owner'].includes(user.role)) loadUsersList();
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
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userAvatarMenu').textContent = initials;
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
    const users = await api.get('/notifications/users');
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td><span class="badge badge-blue">${u.role.replace(/_/g, ' ')}</span></td>
        <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>${fmt.date(u.created_at)}</td>
      </tr>
    `).join('');
  } catch {}
}
