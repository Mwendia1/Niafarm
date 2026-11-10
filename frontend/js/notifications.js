// ===== NOTIFICATIONS MODULE =====
async function loadNotificationsPage() {
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  try {
    const notifs = await api.get(`/notifications?farm_id=${farmId}`);
    renderNotificationsPage(notifs);
  } catch (err) { toast.error('Failed to load notifications: ' + err.message); }
}

function renderNotificationsPage(notifs) {
  const container = document.getElementById('notificationsContent');
  if (!notifs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon"></div><h4>No notifications</h4><p>You're all caught up!</p></div>`;
    return;
  }
  const priorityIcons = { high: '', normal: '🟡', low: '🟢' };
  const typeIcons = { vaccination: '', low_stock: '', reminder: '', feeding: '', health: '' };
  container.innerHTML = notifs.map(n => `
    <div class="notif-item notif-priority-${n.priority} ${n.is_read ? '' : 'unread'}" onclick="markNotifRead('${n.uuid}', this)">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <span style="font-size:20px">${typeIcons[n.type] || ''}</span>
        <div style="flex:1">
          <div class="notif-title">${priorityIcons[n.priority] || ''} ${n.title}</div>
          <div class="notif-msg">${n.message}</div>
          ${n.due_date ? `<div style="font-size:12px;color:var(--warning);margin-top:4px"> Due: ${fmt.date(n.due_date)}</div>` : ''}
          <div class="notif-time">${fmt.ago(n.created_at)}</div>
        </div>
        <button class="btn btn-sm btn-danger btn-icon" onclick="event.stopPropagation();deleteNotif('${n.uuid}', this.closest('.notif-item'))"></button>
      </div>
    </div>
  `).join('');
}

async function markNotifRead(uuid, el) {
  try {
    await api.put(`/notifications/${uuid}/read`);
    el.classList.remove('unread');
    loadNotificationCount();
  } catch {}
}

async function deleteNotif(uuid, el) {
  try {
    await api.delete(`/notifications/${uuid}`);
    el.remove();
    loadNotificationCount();
  } catch (err) { toast.error(err.message); }
}

async function markAllRead() {
  const farmId = state.getCurrentFarmId();
  try {
    await api.put('/notifications/read-all', { farm_id: farmId });
    toast.success('All notifications marked as read');
    await loadNotificationsPage();
    loadNotificationCount();
  } catch (err) { toast.error(err.message); }
}

function openAddReminderModal() {
  resetForm('reminderForm');
  modal.open('reminderModal');
}

async function saveReminder() {
  const data = getFormData('reminderForm');
  data.farm_id = state.getCurrentFarmId();
  if (!data.title || !data.message) { toast.error('Title and message required'); return; }
  try {
    await api.post('/notifications', data);
    toast.success('Reminder created');
    modal.close('reminderModal');
    await loadNotificationsPage();
    loadNotificationCount();
  } catch (err) { toast.error(err.message); }
}

async function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const isOpen = panel.classList.contains('open');
  if (isOpen) { panel.classList.remove('open'); return; }
  panel.classList.add('open');
  const farmId = state.getCurrentFarmId();
  if (!farmId) return;
  try {
    const notifs = await api.get(`/notifications?farm_id=${farmId}`);
    const list = document.getElementById('notifPanelList');
    if (!notifs.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--grey-500)">No notifications</div>';
      return;
    }
    list.innerHTML = notifs.slice(0, 15).map(n => `
      <div class="notif-item notif-priority-${n.priority} ${n.is_read ? '' : 'unread'}" onclick="markNotifRead('${n.uuid}', this)">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${fmt.ago(n.created_at)}</div>
      </div>
    `).join('');
  } catch {}
}

document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  if (panel?.classList.contains('open') && !panel.contains(e.target) && !e.target.closest('#notifBtn')) {
    panel.classList.remove('open');
  }
});
