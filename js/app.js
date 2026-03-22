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

  // Détecter un token de réinitialisation dans l'URL (?token=xxx)
  const urlParams = new URLSearchParams(window.location.search);
  const resetToken = urlParams.get('token');
  if (resetToken) {
    document.getElementById('resetToken').value = resetToken;
    history.replaceState({}, '', '/'); // Nettoyer l'URL
    showPage('reset-password');
    return;
  }

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

// Niveau du rôle courant
function userLevel() {
  const levels = { participant: 1, organisateur: 2, admin: 3, superadmin: 4 };
  return levels[currentUser?.role] || 0;
}

function applyRoleUI() {
  const level = userLevel();
  document.getElementById('nav-pseudo').textContent = currentUser.pseudo;
  const navOrg     = document.getElementById('nav-organiser');
  const navAdmin   = document.getElementById('nav-admin');
  const navMembers = document.getElementById('nav-members');
  if (navOrg)     navOrg.style.display     = level >= 2 ? 'block' : 'none';
  if (navAdmin)   navAdmin.style.display   = level >= 2 ? 'block' : 'none';
  if (navMembers) navMembers.style.display = level >= 3 ? 'block' : 'none';
}

async function bootApp() {
  document.getElementById('mainNav').style.display = 'flex';
  applyRoleUI();

  // Rafraîchir le profil depuis l'API pour avoir le rôle à jour (ex: superadmin promu depuis la DB)
  try {
    const fresh = await api('/users/me');
    if (fresh && fresh.role !== currentUser.role) {
      currentUser = fresh;
      localStorage.setItem('user', JSON.stringify(fresh));
      applyRoleUI();
    }
  } catch { /* si l'API échoue on garde le rôle en cache */ }

  pollNotifications();
  notifInterval = setInterval(pollNotifications, 30000);
  showPage('dashboard');
}

// ── Navigation ────────────────────────────────────────────────
function showPage(page) {
  // Contrôle d'accès par rôle
  if (page === 'create-sortie' && userLevel() < 2) {
    showToast('Seuls les organisateurs peuvent créer des sorties', 'error');
    return;
  }
  if (page === 'admin' && userLevel() < 2) {
    showPage('dashboard');
    return;
  }
  if (page === 'members' && userLevel() < 3) {
    showPage('dashboard');
    return;
  }
  // Pages auth sans connexion (forgot/reset password, partner)
  if (['forgot-password', 'reset-password', 'partner-login', 'partner-dashboard'].includes(page)) {
    document.querySelectorAll('.page, .auth-page').forEach(el => el.classList.add('d-none'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.remove('d-none');
    currentPage = page;
    window.scrollTo(0, 0);
    if (page === 'partner-dashboard') loadPartnerDashboard();
    return;
  }
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
    case 'dashboard':       loadDashboard(); break;
    case 'sorties':         loadSorties(); break;
    case 'create-sortie':   initCreateMap(); setTodayMin(); break;
    case 'profile':         loadProfile(); break;
    case 'notifications':   loadNotifications(); break;
    case 'admin':           loadAdminData(); break;
    case 'members':         loadMembers(); break;
  }

  if (page === 'register') {
    // Peupler le select des groupes
    fetch('/api/groups/public')
      .then(r => r.json())
      .then(groups => {
        const sel = document.getElementById('regGroup');
        if (!sel) return;
        sel.innerHTML = '<option value="">– Rejoindre un groupe (optionnel) –</option>';
        groups.forEach(g => {
          sel.innerHTML += `<option value="${g.id}">${sanitize(g.nom)}${g.nb_membres > 0 ? ' (' + g.nb_membres + ' membres)' : ''}</option>`;
        });
      })
      .catch(() => {});
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

  let res;
  try {
    res = await fetch(API + endpoint, opts);
  } catch {
    throw new Error('Impossible de joindre le serveur. Vérifiez votre connexion.');
  }

  let data;
  try {
    data = await res.json();
  } catch {
    // La réponse n'est pas du JSON (erreur Apache/PHP HTML)
    throw new Error(`Erreur serveur HTTP ${res.status} — vérifiez la configuration Hostinger (.htaccess, mod_rewrite)`);
  }

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

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    errEl.textContent = 'Veuillez remplir tous les champs.';
    errEl.classList.remove('d-none');
    return;
  }

  try {
    const data = await api('/auth/login', 'POST', { email, password });
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

  const pseudo   = document.getElementById('regPseudo').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!pseudo || !email || !password) {
    errEl.textContent = 'Veuillez remplir les champs obligatoires (*).';
    errEl.classList.remove('d-none');
    return;
  }
  if (password.length < 6) {
    errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    errEl.classList.remove('d-none');
    return;
  }

  try {
    const data = await api('/auth/register', 'POST', {
      pseudo:         document.getElementById('regPseudo').value.trim(),
      email:          document.getElementById('regEmail').value.trim(),
      password:       document.getElementById('regPassword').value,
      moto_marque:    document.getElementById('regMarque').value,
      moto_cylindree: document.getElementById('regCylindree').value,
      group_id:       parseInt(document.getElementById('regGroup').value) || 0
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

// ── Mot de passe oublié ───────────────────────────────────────
async function forgotPassword(e) {
  e.preventDefault();
  const errEl = document.getElementById('forgotError');
  const okEl  = document.getElementById('forgotSuccess');
  const btn   = document.getElementById('forgotBtn');
  errEl.classList.add('d-none');
  okEl.classList.add('d-none');

  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { errEl.textContent = 'Entrez votre email.'; errEl.classList.remove('d-none'); return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Envoi…';
  try {
    const data = await api('/auth/forgot-password', 'POST', { email });
    okEl.textContent = data.message;
    okEl.classList.remove('d-none');
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Email envoyé';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>Envoyer le lien';
  }
}

// ── Réinitialisation du mot de passe ─────────────────────────
async function resetPassword(e) {
  e.preventDefault();
  const errEl = document.getElementById('resetError');
  const okEl  = document.getElementById('resetSuccess');
  const btn   = document.getElementById('resetBtn');
  errEl.classList.add('d-none');
  okEl.classList.add('d-none');

  const token    = document.getElementById('resetToken').value;
  const password = document.getElementById('resetPassword').value;
  const confirm  = document.getElementById('resetPasswordConfirm').value;

  if (password.length < 6) {
    errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
    errEl.classList.remove('d-none'); return;
  }
  if (password !== confirm) {
    errEl.textContent = 'Les mots de passe ne correspondent pas.';
    errEl.classList.remove('d-none'); return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enregistrement…';
  try {
    const data = await api('/auth/reset-password', 'POST', { token, password });
    okEl.textContent = data.message;
    okEl.classList.remove('d-none');
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Mot de passe mis à jour';
    setTimeout(() => showPage('login'), 3000);
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check me-2"></i>Enregistrer le mot de passe';
  }
}

function logout() {
  clearInterval(notifInterval);
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  currentUser = null;
  document.getElementById('mainNav').style.display = 'none';
  document.getElementById('nav-admin').style.display = 'none';
  const navM = document.getElementById('nav-members');
  if (navM) navM.style.display = 'none';
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
    if (!data?.notifications?.length) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-bell-slash"></i><p>Aucune notification</p></div>`;
      return;
    }
    list.innerHTML = (data.notifications || []).map(n => {
      const isNewUser = n.type === 'new_user' && n.related_id && userLevel() >= 2;
      const roles = typeof assignableRoles === 'function' ? assignableRoles() : [];
      const roleOpts = roles.map(r => `<option value="${r.value}">${r.label}</option>`).join('');
      return `
      <div class="notif-item ${n.read ? '' : 'unread'}" id="notif-row-${n.id}">
        <div class="d-flex align-items-start gap-3">
          <div class="mt-1 fs-5">${notifIcon(n.type)}</div>
          <div class="flex-grow-1">
            <p class="mb-1">${sanitize(n.message)}</p>
            <span class="notif-time">${fmtDatetime(n.created_at)}</span>
            ${isNewUser ? `
            <div class="d-flex align-items-center gap-2 flex-wrap mt-2">
              <select class="form-select form-select-sm" id="notif-role-${n.related_id}" style="width:auto">
                ${roleOpts}
              </select>
              <button class="btn btn-success btn-sm" onclick="notifValidateUser(${n.related_id}, ${n.id})">
                <i class="fas fa-check me-1"></i>Valider
              </button>
              <button class="btn btn-warning btn-sm" onclick="notifBlockUser(${n.related_id}, ${n.id})">
                <i class="fas fa-ban me-1"></i>Suspendre
              </button>
              <button class="btn btn-outline-danger btn-sm" onclick="notifDeleteUser(${n.related_id}, ${n.id})">
                <i class="fas fa-trash me-1"></i>Refuser
              </button>
            </div>` : ''}
          </div>
        </div>
      </div>
    `; }).join('');
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

// ── Actions rapides depuis les notifications ───────────────────
async function notifValidateUser(userId, notifId) {
  const sel  = document.getElementById(`notif-role-${userId}`);
  const role = sel ? sel.value : 'participant';
  try {
    const data = await api(`/admin/users/${userId}/validate`, 'PUT', { role });
    showToast(data.message);
    document.getElementById(`notif-row-${notifId}`)?.querySelector('.d-flex.mt-2')?.remove();
  } catch (err) { showToast(err.message, 'error'); }
}

async function notifBlockUser(userId, notifId) {
  if (!confirm('Suspendre ce compte ?')) return;
  try {
    const data = await api(`/admin/users/${userId}/block`, 'PUT');
    showToast(data.message);
    document.getElementById(`notif-row-${notifId}`)?.querySelector('.d-flex.mt-2')?.remove();
  } catch (err) { showToast(err.message, 'error'); }
}

async function notifDeleteUser(userId, notifId) {
  if (!confirm('Refuser et supprimer ce compte ? Action irréversible.')) return;
  try {
    await api(`/admin/users/${userId}`, 'DELETE');
    showToast('Compte supprimé');
    document.getElementById(`notif-row-${notifId}`)?.querySelector('.d-flex.mt-2')?.remove();
  } catch (err) { showToast(err.message, 'error'); }
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
  if (!str) return '';
  // MySQL retourne "2026-03-19 13:51:00" (espace) invalide pour Safari → remplacer par T
  const d = new Date(str.replace(' ', 'T'));
  if (isNaN(d.getTime())) return str;
  // toLocaleString (pas toLocaleDateString) pour inclure heure+minute sans erreur Safari
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
