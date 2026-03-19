/* ============================================================
   app.js – État global, navigation, API, auth
   ============================================================ */

const API = '/api';
let currentUser = null;
let currentPage = '';
let notifInterval = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Définir la date minimale du formulaire de création de sortie à aujourd'hui
  const dateInput = document.getElementById('sortieDate');
  if (dateInput) dateInput.min = new Date().toISOString().split('T')[0];

  const token = localStorage.getItem('token');
  if (token) {
    currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (currentUser) {
      bootApp();
    } else {
      showPage('login');
    }
  } else {
    showPage('login');
  }
});

function bootApp() {
  document.getElementById('mainNav').style.display = 'flex';
  document.getElementById('nav-pseudo').textContent = currentUser.pseudo;

  if (currentUser.role === 'admin') {
    document.getElementById('nav-admin').style.display = 'block';
  }

  pollNotifications();
  notifInterval = setInterval(pollNotifications, 30000);
  showPage('dashboard');
}

// ── Navigation ────────────────────────────────────────────────
function showPage(page) {
  document.querySelectorAll('.page, .auth-page').forEach(el => el.classList.add('d-none'));

  const el = document.getElementById('page-' + page);
  if (el) el.classList.remove('d-none');

  // Arrêter le polling de positions si on quitte la page détail
  if (currentPage === 'sortie-detail' && page !== 'sortie-detail') {
    if (typeof stopLocationPolling === 'function') stopLocationPolling();
  }

  currentPage = page;
  window.scrollTo(0, 0);

  // Bootstrap collapse navbar on mobile
  const navCollapse = document.getElementById('navContent');
  if (navCollapse && navCollapse.classList.contains('show')) {
    navCollapse.classList.remove('show');
  }

  switch (page) {
    case 'dashboard':       loadSorties(); break;
    case 'create-sortie':   initCreateMap(); setTodayMin(); break;
    case 'profile':         loadProfile(); break;
    case 'notifications':   loadNotifications(); break;
    case 'admin':           loadAdminData(); break;
  }
}

function setTodayMin() {
  const d = document.getElementById('sortieDate');
  if (d) d.min = new Date().toISOString().split('T')[0];
}

// ── API helper ────────────────────────────────────────────────
async function api(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('token');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API + endpoint, opts);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 && currentUser) { logout(); return; }
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}

// ── Auth ──────────────────────────────────────────────────────
async function login(e) {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.classList.add('d-none');

  try {
    const data = await api('/auth/login', 'POST', {
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPassword').value
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    currentUser = data.user;
    bootApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  }
}

async function register(e) {
  e.preventDefault();
  const errEl = document.getElementById('registerError');
  const okEl  = document.getElementById('registerSuccess');
  errEl.classList.add('d-none');
  okEl.classList.add('d-none');

  try {
    const data = await api('/auth/register', 'POST', {
      pseudo:         document.getElementById('regPseudo').value.trim(),
      email:          document.getElementById('regEmail').value.trim(),
      password:       document.getElementById('regPassword').value,
      moto_marque:    document.getElementById('regMarque').value,
      moto_cylindree: document.getElementById('regCylindree').value
    });
    okEl.textContent = data.message;
    okEl.classList.remove('d-none');
    document.getElementById('regPseudo').closest('form').reset();
    setTimeout(() => showPage('login'), 4000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  }
}

function logout() {
  clearInterval(notifInterval);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  document.getElementById('mainNav').style.display = 'none';
  document.getElementById('nav-admin').style.display = 'none';
  showPage('login');
}

// ── Notifications ─────────────────────────────────────────────
async function pollNotifications() {
  try {
    const data = await api('/notifications');
    const badge = document.getElementById('notif-count');
    if (data.unreadCount > 0) {
      badge.textContent = data.unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  } catch { /* ignore */ }
}

async function loadNotifications() {
  const list = document.getElementById('notifications-list');
  list.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
  try {
    const data = await api('/notifications');
    if (!data.notifications.length) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-bell-slash"></i><p>Aucune notification</p></div>`;
      return;
    }
    list.innerHTML = data.notifications.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="d-flex align-items-start gap-3">
          <div class="mt-1 fs-5">${notifIcon(n.type)}</div>
          <div class="flex-grow-1">
            <p class="mb-1">${sanitize(n.message)}</p>
            <span class="notif-time">${fmtDatetime(n.created_at)}</span>
          </div>
        </div>
      </div>
    `).join('');
    document.getElementById('notif-count').style.display = 'none';
  } catch (err) {
    list.innerHTML = `<p class="text-danger">Erreur : ${err.message}</p>`;
  }
}

async function markAllRead() {
  await api('/notifications/read', 'PUT');
  loadNotifications();
  document.getElementById('notif-count').style.display = 'none';
}

function notifIcon(type) {
  const map = {
    new_sortie:        '<i class="fas fa-route text-primary"></i>',
    new_participant:   '<i class="fas fa-user-plus text-success"></i>',
    new_user:          '<i class="fas fa-user-clock text-warning"></i>',
    account_validated: '<i class="fas fa-check-circle text-success"></i>'
  };
  return map[type] || '<i class="fas fa-info-circle text-info"></i>';
}

// ── Profile ───────────────────────────────────────────────────
async function loadProfile() {
  try {
    const [user, stats] = await Promise.all([
      api('/users/me'),
      api('/users/me/stats')
    ]);
    document.getElementById('profile-pseudo').textContent = user.pseudo;
    document.getElementById('profile-moto').textContent =
      user.moto_marque ? `${user.moto_marque} ${user.moto_cylindree ? user.moto_cylindree + ' cc' : ''}` : 'Moto non renseignée';

    document.getElementById('profilePseudo').value    = user.pseudo;
    document.getElementById('profileMarque').value    = user.moto_marque || '';
    document.getElementById('profileCylindree').value = user.moto_cylindree || '';

    document.getElementById('stat-created').textContent = stats.sortiesCreated;
    document.getElementById('stat-joined').textContent  = stats.sortiesJoined;
    document.getElementById('stat-since').textContent   = new Date(user.created_at).getFullYear();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function updateProfile(e) {
  e.preventDefault();
  const errEl = document.getElementById('profileError');
  const okEl  = document.getElementById('profileSuccess');
  errEl.classList.add('d-none');
  okEl.classList.add('d-none');

  const password = document.getElementById('profilePassword').value;
  const body = {
    pseudo:         document.getElementById('profilePseudo').value.trim(),
    moto_marque:    document.getElementById('profileMarque').value,
    moto_cylindree: document.getElementById('profileCylindree').value,
    ...(password ? { password } : {})
  };

  try {
    await api('/users/me', 'PUT', body);
    okEl.textContent = 'Profil mis à jour !';
    okEl.classList.remove('d-none');
    document.getElementById('profilePassword').value = '';

    currentUser.pseudo = body.pseudo;
    localStorage.setItem('user', JSON.stringify(currentUser));
    document.getElementById('nav-pseudo').textContent = body.pseudo;
    loadProfile();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  }
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const body  = document.getElementById('toast-body');
  body.textContent = msg;
  toast.className = `toast text-white border-0 bg-${type === 'error' ? 'danger' : 'success'}`;
  new bootstrap.Toast(toast, { delay: 3500 }).show();
}

// ── Utilities ─────────────────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  const date = new Date(+y, +m - 1, +d);
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtDatetime(str) {
  const d = new Date(str);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
