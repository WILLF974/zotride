/* ============================================================
   admin.js – Panneau d'administration
   ============================================================ */

let adminUsers  = [];
let userFilter  = 'pending';

// ── Chargement principal ──────────────────────────────────────
async function loadAdminData() {
  if (!currentUser || currentUser.role !== 'admin') {
    showPage('dashboard');
    return;
  }
  await Promise.all([loadAdminStats(), loadAdminUsers()]);
}

async function loadAdminStats() {
  try {
    const s = await api('/admin/stats');
    document.getElementById('admin-stats-row').innerHTML = [
      { num: s.totalUsers,        lbl: 'Membres',          icon: 'fa-users' },
      { num: s.pendingUsers,      lbl: 'En attente',       icon: 'fa-user-clock' },
      { num: s.totalSorties,      lbl: 'Sorties',          icon: 'fa-road' },
      { num: s.totalParticipations, lbl: 'Participations', icon: 'fa-motorcycle' }
    ].map(c => `
      <div class="col-6 col-md-3">
        <div class="admin-stat-card">
          <i class="fas ${c.icon} text-primary mb-1"></i>
          <div class="num">${c.num}</div>
          <div class="lbl">${c.lbl}</div>
        </div>
      </div>`).join('');
  } catch { /* ignore */ }
}

// ── Onglets ───────────────────────────────────────────────────
function showAdminTab(tab, el) {
  document.querySelectorAll('.admin-tab').forEach(b => b.classList.remove('active'));
  el.classList.add('active');

  document.getElementById('admin-tab-users').style.display  = tab === 'users'  ? 'block' : 'none';
  document.getElementById('admin-tab-sorties').style.display = tab === 'sorties' ? 'block' : 'none';

  if (tab === 'sorties') loadAdminSorties();
}

// ── Utilisateurs ──────────────────────────────────────────────
async function loadAdminUsers() {
  try {
    adminUsers = await api('/admin/users');

    const pending = adminUsers.filter(u => !u.validated && u.role !== 'admin').length;
    const badge = document.getElementById('pending-badge');
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }

    renderUsers();
  } catch (err) {
    document.getElementById('admin-users-list').innerHTML =
      `<p class="text-danger">Erreur : ${sanitize(err.message)}</p>`;
  }
}

function filterUsers(f) {
  userFilter = f;
  renderUsers();
}

function renderUsers() {
  const list = document.getElementById('admin-users-list');
  let users = adminUsers;
  if (userFilter === 'pending') users = adminUsers.filter(u => !u.validated && u.role !== 'admin');

  if (!users.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i>
      <p>Aucun utilisateur${userFilter === 'pending' ? ' en attente' : ''}</p></div>`;
    return;
  }

  list.innerHTML = users.map(u => `
    <div class="user-row ${!u.validated && u.role !== 'admin' ? 'pending' : ''}">
      <div>
        <strong>${sanitize(u.pseudo)}</strong>
        <div class="text-muted small">${sanitize(u.email)}</div>
        ${u.moto_marque ? `<div class="text-muted small"><i class="fas fa-motorcycle"></i> ${sanitize(u.moto_marque)} ${u.moto_cylindree ? u.moto_cylindree + ' cc' : ''}</div>` : ''}
        <div class="text-muted small">Inscrit le ${new Date(u.created_at).toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap">
        ${u.role === 'admin'
          ? '<span class="badge bg-primary">Admin</span>'
          : u.validated
            ? '<span class="badge-validated"><i class="fas fa-check"></i> Validé</span>'
            : '<span class="badge-pending">En attente</span>'}
        ${!u.validated && u.role !== 'admin' ? `
          <button class="btn btn-success btn-sm" onclick="validateUser(${u.id})">
            <i class="fas fa-check"></i> Valider
          </button>` : ''}
        ${u.role !== 'admin' ? `
          <button class="btn btn-outline-danger btn-sm" onclick="deleteUser(${u.id}, '${sanitize(u.pseudo)}')">
            <i class="fas fa-trash"></i>
          </button>` : ''}
      </div>
    </div>`).join('');
}

async function validateUser(id) {
  try {
    const data = await api(`/admin/users/${id}/validate`, 'PUT');
    showToast(data.message);
    loadAdminData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id, pseudo) {
  if (!confirm(`Supprimer l'utilisateur "${pseudo}" ? Cette action est irréversible.`)) return;
  try {
    await api(`/admin/users/${id}`, 'DELETE');
    showToast('Utilisateur supprimé');
    loadAdminData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Sorties (admin) ───────────────────────────────────────────
async function loadAdminSorties() {
  const list = document.getElementById('admin-sorties-list');
  list.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';
  try {
    const sorties = await api('/admin/sorties');
    if (!sorties.length) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-road"></i><p>Aucune sortie enregistrée</p></div>`;
      return;
    }
    list.innerHTML = sorties.map(s => `
      <div class="user-row">
        <div>
          <strong>${sanitize(s.titre)}</strong>
          <div class="text-muted small">
            <i class="fas fa-calendar me-1"></i>${fmtDate(s.date)} à ${s.heure}
          </div>
          <div class="text-muted small">
            <i class="fas fa-user me-1"></i>${sanitize(s.organisateur)} &bull;
            <i class="fas fa-motorcycle ms-1 me-1"></i>${s.nb_participants} / ${s.nb_max_participants} participants
          </div>
        </div>
        <button class="btn btn-outline-danger btn-sm" onclick="adminDeleteSortie(${s.id}, '${sanitize(s.titre)}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>`).join('');
  } catch (err) {
    list.innerHTML = `<p class="text-danger">Erreur : ${sanitize(err.message)}</p>`;
  }
}

async function adminDeleteSortie(id, titre) {
  if (!confirm(`Supprimer la sortie "${titre}" ?`)) return;
  try {
    await api(`/sorties/${id}`, 'DELETE');
    showToast('Sortie supprimée');
    loadAdminSorties();
    loadAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
