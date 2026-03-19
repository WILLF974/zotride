/* ============================================================
   admin.js – Panneau d'administration
   ============================================================ */

let adminUsers  = [];
let userFilter  = 'pending';

// Rôles que cet acteur peut attribuer (niveau strictement inférieur au sien)
function assignableRoles() {
  const level = userLevel();
  const opts = [];
  if (level >= 2) opts.push({ value: 'participant',   label: 'Participant' });
  if (level >= 3) opts.push({ value: 'organisateur',  label: 'Organisateur' });
  if (level >= 4) opts.push({ value: 'admin',         label: 'Administrateur' });
  return opts;
}

function roleBadge(role) {
  const map = {
    superadmin:   '<span class="badge bg-danger">Super Admin</span>',
    admin:        '<span class="badge bg-primary">Admin</span>',
    organisateur: '<span class="badge" style="background:#0dcaf0;color:#000">Organisateur</span>',
    participant:  '<span class="badge bg-success">Participant</span>',
  };
  return map[role] || `<span class="badge bg-secondary">${role}</span>`;
}

// ── Chargement principal ──────────────────────────────────────
async function loadAdminData() {
  if (!currentUser || userLevel() < 2) {
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

    const pending = adminUsers.filter(u => !u.validated).length;
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
  const roles = assignableRoles();
  const roleOpts = roles.map(r => `<option value="${r.value}">${r.label}</option>`).join('');

  let users = adminUsers;
  if (userFilter === 'pending') users = adminUsers.filter(u => !u.validated);

  if (!users.length) {
    list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i>
      <p>Aucun utilisateur${userFilter === 'pending' ? ' en attente' : ''}</p></div>`;
    return;
  }

  const myLevel = userLevel();

  list.innerHTML = users.map(u => {
    const uLevel = { user:1, participant:1, organisateur:2, admin:3, superadmin:4 }[u.role] || 0;
    const canManage = myLevel > uLevel;
    const isPending = !u.validated;
    const isBlocked = !!u.blocked;

    return `
    <div class="user-row ${isPending ? 'pending' : ''} ${isBlocked ? 'blocked-row' : ''}">
      <div>
        <strong>${sanitize(u.pseudo)}</strong>
        <div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
          ${roleBadge(u.role)}
          ${isPending ? '<span class="badge-pending">En attente</span>' : ''}
          ${isBlocked ? '<span class="badge bg-warning text-dark"><i class="fas fa-ban me-1"></i>Suspendu</span>' : ''}
        </div>
        <div class="text-muted small mt-1">${sanitize(u.email)}</div>
        ${u.moto_marque ? `<div class="text-muted small"><i class="fas fa-motorcycle me-1"></i>${sanitize(u.moto_marque)} ${u.moto_cylindree ? u.moto_cylindree + ' cc' : ''}</div>` : ''}
        <div class="text-muted small">Inscrit le ${new Date(u.created_at).toLocaleDateString('fr-FR')}</div>
      </div>
      <div class="d-flex align-items-center gap-2 flex-wrap justify-content-end">
        ${isPending && canManage ? `
          <select class="form-select form-select-sm" id="role-${u.id}" style="width:auto">
            ${roleOpts}
          </select>
          <button class="btn btn-success btn-sm" onclick="validateUser(${u.id})">
            <i class="fas fa-check"></i> Valider
          </button>` : ''}
        ${!isPending && canManage ? `
          <select class="form-select form-select-sm" id="role-${u.id}" style="width:auto" onchange="changeRole(${u.id})">
            ${roles.map(r => `<option value="${r.value}"${r.value === u.role ? ' selected' : ''}>${r.label}</option>`).join('')}
          </select>` : ''}
        ${canManage && !isPending ? `
          <button class="btn btn-sm ${isBlocked ? 'btn-success' : 'btn-warning'}" onclick="blockUser(${u.id}, '${sanitize(u.pseudo)}', ${isBlocked})" title="${isBlocked ? 'Réactiver' : 'Suspendre'}">
            <i class="fas ${isBlocked ? 'fa-unlock' : 'fa-ban'}"></i>
          </button>` : ''}
        ${canManage ? `
          <button class="btn btn-outline-danger btn-sm" onclick="deleteUser(${u.id}, '${sanitize(u.pseudo)}')" title="Supprimer">
            <i class="fas fa-trash"></i>
          </button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function validateUser(id) {
  const sel = document.getElementById(`role-${id}`);
  const role = sel ? sel.value : 'participant';
  try {
    const data = await api(`/admin/users/${id}/validate`, 'PUT', { role });
    showToast(data.message);
    loadAdminData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changeRole(id) {
  const sel = document.getElementById(`role-${id}`);
  if (!sel) return;
  try {
    const data = await api(`/admin/users/${id}/role`, 'PUT', { role: sel.value });
    showToast(data.message);
    loadAdminData();
  } catch (err) {
    showToast(err.message, 'error');
    loadAdminData(); // reset
  }
}

async function blockUser(id, pseudo, isBlocked) {
  const action = isBlocked ? 'réactiver' : 'suspendre';
  if (!confirm(`Voulez-vous ${action} le compte de "${pseudo}" ?`)) return;
  try {
    const data = await api(`/admin/users/${id}/block`, 'PUT');
    showToast(data.message);
    loadAdminData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id, pseudo) {
  if (!confirm(`Supprimer définitivement le compte de "${pseudo}" ? Cette action est irréversible.`)) return;
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
