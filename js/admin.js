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
  const sel = document.getElementById(`val-role-${id}`) || document.getElementById(`role-${id}`);
  const role = sel ? sel.value : 'participant';
  try {
    const data = await api(`/admin/users/${id}/validate`, 'PUT', { role });
    showToast(data.message);
    refreshUserData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changeRole(id, roleVal) {
  const role = roleVal ?? document.getElementById(`role-${id}`)?.value;
  if (!role) return;
  try {
    const data = await api(`/admin/users/${id}/role`, 'PUT', { role });
    showToast(data.message);
    refreshUserData();
  } catch (err) {
    showToast(err.message, 'error');
    refreshUserData();
  }
}

async function blockUser(id, pseudo, isBlocked) {
  const action = isBlocked ? 'réactiver' : 'suspendre';
  if (!confirm(`Voulez-vous ${action} le compte de "${pseudo}" ?`)) return;
  try {
    const data = await api(`/admin/users/${id}/block`, 'PUT');
    showToast(data.message);
    refreshUserData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(id, pseudo) {
  if (!confirm(`Supprimer définitivement le compte de "${pseudo}" ? Cette action est irréversible.`)) return;
  try {
    await api(`/admin/users/${id}`, 'DELETE');
    showToast('Utilisateur supprimé');
    refreshUserData();
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

// ── Helpers reload ────────────────────────────────────────────
function refreshUserData() {
  if (typeof currentPage !== 'undefined' && currentPage === 'members') loadMembers();
  else loadAdminData();
}

// ── PAGE MEMBRES ──────────────────────────────────────────────
let membersData     = [];
let membersFilter   = 'all';
let membersSelected = new Set();

async function loadMembers() {
  const list = document.getElementById('members-list');
  if (!list) return;
  list.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
  membersSelected.clear();
  updateBulkBar();
  try {
    membersData = await api('/admin/users');
    updateMembersFilterBadge();
    renderMembersTable();
  } catch (err) {
    list.innerHTML = `<p class="text-danger">Erreur : ${sanitize(err.message)}</p>`;
  }
}

function updateMembersFilterBadge() {
  const cnt = membersData.filter(u => !u.validated).length;
  const el  = document.getElementById('mbr-pending-count');
  if (!el) return;
  el.textContent    = cnt;
  el.style.display  = cnt > 0 ? '' : 'none';
}

function filterMembers(f) {
  membersFilter = f;
  membersSelected.clear();
  updateBulkBar();
  renderMembersTable();
  ['all', 'pending', 'validated', 'blocked'].forEach(k => {
    const btn = document.getElementById(`mbr-btn-${k}`);
    if (!btn) return;
    btn.className = btn.className.replace(/btn-outline-\w+|btn-primary|btn-warning|btn-success/, '');
    const colorMap = { all: 'btn-outline-secondary', pending: 'btn-outline-warning', validated: 'btn-outline-success', blocked: 'btn-outline-secondary' };
    btn.className += ' ' + (k === f ? colorMap[k].replace('outline-', '') : colorMap[k]);
  });
}

function renderMembersTable() {
  const list    = document.getElementById('members-list');
  if (!list) return;
  const myLevel = userLevel();
  const roles   = assignableRoles();
  const roleOpts = roles.map(r => `<option value="${r.value}">${r.label}</option>`).join('');

  let users = membersData;
  if (membersFilter === 'pending')   users = membersData.filter(u => !u.validated);
  if (membersFilter === 'validated') users = membersData.filter(u => u.validated && !u.blocked);
  if (membersFilter === 'blocked')   users = membersData.filter(u => !!u.blocked);

  if (!users.length) {
    const lbl = { all: 'membre', pending: 'inscrit en attente', validated: 'membre validé', blocked: 'membre suspendu' };
    list.innerHTML = `<div class="empty-state"><i class="fas fa-users"></i><p>Aucun ${lbl[membersFilter] || 'membre'}</p></div>`;
    return;
  }

  const allChecked = users.length > 0 && users.every(u => membersSelected.has(u.id));

  list.innerHTML = `
  <div class="dark-card p-0" style="overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:1px solid var(--border);background:var(--bg-card2)">
          <th style="padding:10px 14px;width:36px">
            <input type="checkbox" class="form-check-input" id="chk-all" ${allChecked ? 'checked' : ''} onchange="toggleSelectAll(this)">
          </th>
          <th style="padding:10px 14px;color:var(--text-muted);font-size:.8rem;font-weight:600">Membre</th>
          <th style="padding:10px 14px;color:var(--text-muted);font-size:.8rem;font-weight:600" class="d-none d-md-table-cell">Moto</th>
          <th style="padding:10px 14px;color:var(--text-muted);font-size:.8rem;font-weight:600">Rôle</th>
          <th style="padding:10px 14px;color:var(--text-muted);font-size:.8rem;font-weight:600">Statut</th>
          <th style="padding:10px 14px;color:var(--text-muted);font-size:.8rem;font-weight:600;text-align:right">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => {
          const uLevel  = { participant:1, organisateur:2, admin:3, superadmin:4 }[u.role] || 1;
          const canManage = myLevel > uLevel;
          const isChecked = membersSelected.has(u.id);
          const statusBadge = !u.validated
            ? `<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>En attente</span>`
            : u.blocked
              ? `<span class="badge bg-danger"><i class="fas fa-ban me-1"></i>Suspendu</span>`
              : `<span class="badge bg-success"><i class="fas fa-check me-1"></i>Validé</span>`;

          return `
          <tr style="border-bottom:1px solid var(--border)" id="mbr-row-${u.id}">
            <td style="padding:12px 14px">
              ${canManage ? `<input type="checkbox" class="form-check-input member-chk" data-id="${u.id}" ${isChecked ? 'checked' : ''} onchange="toggleMemberCheck(${u.id}, this)">` : ''}
            </td>
            <td style="padding:12px 14px">
              <div class="d-flex align-items-center gap-2">
                <div class="mini-avatar" style="background:var(--primary);color:#fff;font-weight:700">${sanitize(u.pseudo).charAt(0).toUpperCase()}</div>
                <div>
                  <div style="color:#fff;font-weight:600;font-size:.9rem">${sanitize(u.pseudo)}</div>
                  <div style="color:var(--text-muted);font-size:.78rem">${sanitize(u.email)}</div>
                </div>
              </div>
            </td>
            <td style="padding:12px 14px;color:var(--text-muted);font-size:.83rem" class="d-none d-md-table-cell">
              ${u.moto_marque ? `${sanitize(u.moto_marque)}${u.moto_cylindree ? ' ' + u.moto_cylindree + ' cc' : ''}` : '–'}
            </td>
            <td style="padding:12px 14px">
              ${canManage && u.validated && !u.blocked
                ? `<select class="form-select form-select-sm" style="width:auto;min-width:130px" onchange="changeRole(${u.id}, this.value)">${roles.map(r => `<option value="${r.value}"${r.value === u.role ? ' selected' : ''}>${r.label}</option>`).join('')}</select>`
                : roleBadge(u.role)}
            </td>
            <td style="padding:12px 14px">${statusBadge}</td>
            <td style="padding:12px 14px;text-align:right">
              <div class="d-flex gap-1 justify-content-end flex-wrap">
                ${!u.validated && canManage ? `
                  <select class="form-select form-select-sm" id="val-role-${u.id}" style="width:auto;min-width:130px">${roleOpts}</select>
                  <button class="btn btn-success btn-sm" onclick="validateUser(${u.id})" title="Valider"><i class="fas fa-check"></i></button>` : ''}
                ${u.validated && canManage ? `
                  <button class="btn btn-sm ${u.blocked ? 'btn-outline-success' : 'btn-outline-warning'}" onclick="blockUser(${u.id}, '${sanitize(u.pseudo)}', ${!!u.blocked})" title="${u.blocked ? 'Réactiver' : 'Suspendre'}">
                    <i class="fas ${u.blocked ? 'fa-unlock' : 'fa-ban'}"></i>
                  </button>` : ''}
                ${canManage ? `
                  <button class="btn btn-outline-danger btn-sm" onclick="deleteUser(${u.id}, '${sanitize(u.pseudo)}')" title="Supprimer"><i class="fas fa-trash"></i></button>` : ''}
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

function toggleMemberCheck(id, checkbox) {
  if (checkbox.checked) membersSelected.add(id);
  else membersSelected.delete(id);
  updateBulkBar();
  const visibleUsers = membersData.filter(u => {
    if (membersFilter === 'pending')   return !u.validated;
    if (membersFilter === 'validated') return u.validated && !u.blocked;
    if (membersFilter === 'blocked')   return !!u.blocked;
    return true;
  });
  const allChk = document.getElementById('chk-all');
  if (allChk) allChk.checked = visibleUsers.length > 0 && visibleUsers.every(u => membersSelected.has(u.id));
}

function toggleSelectAll(checkbox) {
  let users = membersData;
  if (membersFilter === 'pending')   users = membersData.filter(u => !u.validated);
  if (membersFilter === 'validated') users = membersData.filter(u => u.validated && !u.blocked);
  if (membersFilter === 'blocked')   users = membersData.filter(u => !!u.blocked);
  if (checkbox.checked) users.forEach(u => membersSelected.add(u.id));
  else users.forEach(u => membersSelected.delete(u.id));
  document.querySelectorAll('.member-chk').forEach(chk => {
    chk.checked = membersSelected.has(parseInt(chk.dataset.id));
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('members-bulk-bar');
  if (!bar) return;
  const count = membersSelected.size;
  if (count > 0) {
    bar.classList.remove('d-none');
    bar.style.removeProperty('display');
    document.getElementById('bulk-count').textContent = count;
    const sel = document.getElementById('bulk-role-select');
    if (sel && sel.options.length === 0) {
      assignableRoles().forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.value; opt.textContent = r.label;
        sel.appendChild(opt);
      });
    }
  } else {
    bar.classList.add('d-none');
  }
}

function clearMemberSelection() {
  membersSelected.clear();
  document.querySelectorAll('.member-chk').forEach(c => c.checked = false);
  const allChk = document.getElementById('chk-all');
  if (allChk) allChk.checked = false;
  updateBulkBar();
}

async function bulkValidate() {
  if (!membersSelected.size) return;
  const role    = document.getElementById('bulk-role-select')?.value || 'participant';
  const pending = membersData.filter(u => membersSelected.has(u.id) && !u.validated);
  if (!pending.length) { showToast('Aucun inscrit en attente dans la sélection', 'error'); return; }
  let ok = 0;
  for (const u of pending) {
    try { await api(`/admin/users/${u.id}/validate`, 'PUT', { role }); ok++; } catch {}
  }
  showToast(`${ok} membre(s) validé(s) en tant que ${role}`);
  membersSelected.clear();
  await loadMembers();
}

async function bulkBlock() {
  if (!membersSelected.size) return;
  if (!confirm(`Suspendre ${membersSelected.size} membre(s) ?`)) return;
  let ok = 0;
  for (const id of [...membersSelected]) {
    try { await api(`/admin/users/${id}/block`, 'PUT'); ok++; } catch {}
  }
  showToast(`${ok} compte(s) suspendu(s)`);
  membersSelected.clear();
  await loadMembers();
}

async function bulkDelete() {
  if (!membersSelected.size) return;
  if (!confirm(`Supprimer définitivement ${membersSelected.size} membre(s) ? Irréversible.`)) return;
  let ok = 0;
  for (const id of [...membersSelected]) {
    try { await api(`/admin/users/${id}`, 'DELETE'); ok++; } catch {}
  }
  showToast(`${ok} membre(s) supprimé(s)`);
  membersSelected.clear();
  await loadMembers();
}
