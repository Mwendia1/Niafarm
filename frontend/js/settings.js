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
  if (usersTabBtn) usersTabBtn.style.display = ['admin', 'farm_owner'].includes(user.role) ? '' : 'none';
  const securityTabBtn = document.querySelector('.tab-btn[onclick*="securityTab"]');
  if (securityTabBtn) securityTabBtn.style.display = ['admin', 'farm_owner'].includes(user.role) ? '' : 'none';
  if (['admin', 'farm_owner'].includes(user.role)) loadUsersList();
}

function updateAvatarDisplay(user) {
  const preview = document.getElementById('profileAvatarPreview');
  const avatarSrc = user.avatar ? user.avatar : null;
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
    const res = await fetch('/api/auth/avatar', {
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
    const me = state.getUser();
    const endpoint = me.role === 'admin' ? '/auth/users' : '/auth/members';
    const users = await api.get(endpoint);
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = users.length === 0
      ? `<tr><td colspan="7" style="text-align:center;color:var(--grey-500)">No members added yet</td></tr>`
      : users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td>${u.email}</td>
        <td>${u.phone || '-'}</td>
        <td>${u.job_title || '-'}</td>
        <td>
          <select class="form-control" style="width:140px;padding:4px 8px;font-size:12px" onchange="updateMemberRole(${u.id}, this.value)">
            <option value="farm_manager" ${u.role === 'farm_manager' ? 'selected' : ''}>Farm Manager</option>
            <option value="farm_worker" ${u.role === 'farm_worker' ? 'selected' : ''}>Farm Worker</option>
            <option value="accountant" ${u.role === 'accountant' ? 'selected' : ''}>Accountant</option>
            ${me.role === 'admin' ? `<option value="farm_owner" ${u.role === 'farm_owner' ? 'selected' : ''}>Farm Owner</option>` : ''}
          </select>
        </td>
        <td><span class="badge ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td style="display:flex;gap:6px">
          ${me.role === 'admin' ? `<button class="btn btn-sm btn-outline" onclick="impersonateUser(${u.id},'${u.name}')">Login as</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="removeMember(${u.id},'${u.name}')">Remove</button>
        </td>
      </tr>
    `).join('');
  } catch {}
}

function openAddMemberModal() {
  resetForm('memberForm');
  modal.open('memberModal');
}

function autoSetRole(select) {
  const map = {
    'Farm Manager': 'farm_manager', 'Supervisor': 'farm_manager',
    'Accountant': 'accountant',
    'Farm Worker': 'farm_worker', 'Veterinarian': 'farm_worker',
    'Driver': 'farm_worker', 'Security': 'farm_worker'
  };
  const roleSelect = document.getElementById('memberRoleSelect');
  if (roleSelect && map[select.value]) roleSelect.value = map[select.value];
}

async function saveMember() {
  const data = getFormData('memberForm');
  if (!data.name || !data.email || !data.password) { toast.error('Name, email and password required'); return; }
  try {
    await api.post('/auth/members', data);
    toast.success(`${data.name} added successfully`);
    modal.close('memberModal');
    loadUsersList();
  } catch (err) { toast.error(err.message); }
}

async function updateMemberRole(id, role) {
  try {
    await api.put(`/auth/members/${id}/role`, { role });
    toast.success('Role updated');
  } catch (err) { toast.error(err.message); loadUsersList(); }
}

async function removeMember(id, name) {
  if (!confirm(`Remove ${name} from your farm?`)) return;
  try {
    await api.delete(`/auth/members/${id}`);
    toast.success(`${name} removed`);
    loadUsersList();
  } catch (err) { toast.error(err.message); }
}
