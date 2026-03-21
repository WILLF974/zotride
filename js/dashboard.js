/* ============================================================
   dashboard.js – Widgets de la page d'accueil ZotRide
   ============================================================ */

let dashMap = null;
let dashData = null;

// ── Chargement principal ───────────────────────────────────────
async function loadDashboard() {
  try {
    dashData = await api('/dashboard');
    renderMyNextSorties(dashData.myNextSorties);
    renderZotFlux(dashData.allSorties, dashData.recentActivity);
    renderMyGroups(dashData.myGroups);
    renderPartners(dashData.partners);
    renderSpots(dashData.spots);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Mes Prochaines Sorties ─────────────────────────────────────
function renderMyNextSorties(sorties) {
  const el = document.getElementById('db-my-sorties');
  if (!el) return;
  if (!sorties || !sorties.length) {
    el.innerHTML = `<div class="db-empty"><i class="fas fa-road"></i><p>Aucune sortie prévue</p>
      <button class="btn btn-primary btn-sm" onclick="showPage('sorties')">Voir toutes les sorties</button></div>`;
    return;
  }
  el.innerHTML = sorties.map(s => {
    const full = s.nb_participants >= s.nb_max_participants;
    return `
    <div class="db-sortie-card" onclick="viewSortie(${s.id})">
      <div class="db-sortie-date">
        <i class="fas fa-calendar-alt me-1"></i>${fmtDate(s.date)} &bull; ${s.heure ? s.heure.slice(0,5) : ''}
      </div>
      <div class="db-sortie-title">${sanitize(s.titre)}</div>
      <div class="db-sortie-footer">
        <span class="db-organiser"><i class="fas fa-user me-1"></i>${sanitize(s.organisateur)}</span>
        <span class="db-pill ${full ? 'full' : ''}">
          <i class="fas fa-motorcycle me-1"></i>${s.nb_participants} / ${s.nb_max_participants}
        </span>
      </div>
    </div>`;
  }).join('');
}

// ── Zot'Flux (Community Feed) ──────────────────────────────────
function renderZotFlux(allSorties, recentActivity) {
  const el = document.getElementById('db-flux');
  if (!el) return;

  let html = '';

  // Prochaines sorties publiques
  if (allSorties && allSorties.length) {
    html += allSorties.slice(0, 5).map(s => `
    <div class="flux-item">
      <div class="flux-avatar"><i class="fas fa-route"></i></div>
      <div class="flux-content">
        <div class="flux-text">
          <strong>${sanitize(s.organisateur)}</strong> a organisé une sortie :
          <a href="#" onclick="viewSortie(${s.id}); return false;" class="flux-link">${sanitize(s.titre)}</a>
        </div>
        <div class="flux-date">${fmtDate(s.date)} à ${s.heure ? s.heure.slice(0,5) : ''}</div>
        <div class="flux-actions">
          <span class="db-pill"><i class="fas fa-motorcycle me-1"></i>${s.nb_participants} / ${s.nb_max_participants}</span>
          <button class="btn btn-primary btn-sm" onclick="viewSortie(${s.id})">Voir</button>
        </div>
      </div>
    </div>`).join('');
  }

  // Activité récente
  if (recentActivity && recentActivity.length) {
    html += recentActivity.filter(a => a.type === 'join').slice(0, 5).map(a => `
    <div class="flux-item">
      <div class="flux-avatar flux-join"><i class="fas fa-user-plus"></i></div>
      <div class="flux-content">
        <div class="flux-text">
          <strong>${sanitize(a.actor)}</strong> a rejoint la sortie
          <span class="flux-link">${sanitize(a.label)}</span>
        </div>
        <div class="flux-date">${fmtDatetime(a.ts)}</div>
      </div>
    </div>`).join('');
  }

  if (!html) {
    html = `<div class="db-empty"><i class="fas fa-stream"></i><p>Aucune activité récente</p></div>`;
  }

  el.innerHTML = html;
}

// ── Mes Groupes ────────────────────────────────────────────────
function renderMyGroups(groups) {
  const el = document.getElementById('db-groups');
  if (!el) return;
  if (!groups || !groups.length) {
    el.innerHTML = `<div class="db-empty"><i class="fas fa-users-slash"></i><p>Aucun groupe rejoint</p></div>`;
    return;
  }
  el.innerHTML = groups.map(g => `
  <div class="db-group-row">
    <div class="db-group-avatar"><i class="fas fa-users"></i></div>
    <div class="db-group-info">
      <div class="db-group-name">${sanitize(g.nom)}</div>
      <div class="db-group-meta">${g.nb_membres} membre${g.nb_membres > 1 ? 's' : ''} &bull; ${g.my_role === 'admin' ? 'Admin' : 'Membre'}</div>
    </div>
    <div class="db-group-badge">${g.my_role === 'admin' ? '<span class="badge-role admin">Admin</span>' : ''}</div>
    <button class="btn btn-link btn-sm p-0 text-danger" onclick="leaveGroup(${g.id}, '${sanitize(g.nom)}')" title="Quitter">
      <i class="fas fa-sign-out-alt"></i>
    </button>
  </div>`).join('');
}

// ── Partenaires Commerciaux ────────────────────────────────────
const PARTNER_CATS = {
  concessionnaire: { icon: 'fa-motorcycle',    label: 'Concessionnaires & Mécanos' },
  mecano:          { icon: 'fa-tools',         label: 'Garages & Mécanos' },
  resto:           { icon: 'fa-utensils',      label: 'Restos & Boulangeries' },
  station:         { icon: 'fa-gas-pump',      label: 'Stations-Service & Autres' },
  autre:           { icon: 'fa-store',         label: 'Autres Partenaires' },
};

function renderPartners(partners) {
  const el = document.getElementById('db-partners');
  if (!el) return;
  if (!partners || !partners.length) {
    el.innerHTML = `<div class="db-empty"><i class="fas fa-handshake"></i><p>Aucun partenaire</p></div>`;
    return;
  }

  // Grouper par catégorie
  const grouped = {};
  partners.forEach(p => {
    if (!grouped[p.categorie]) grouped[p.categorie] = [];
    grouped[p.categorie].push(p);
  });

  let html = '';
  for (const [cat, list] of Object.entries(grouped)) {
    const cfg = PARTNER_CATS[cat] || PARTNER_CATS.autre;
    html += `<div class="db-partner-cat">
      <div class="db-partner-cat-header">
        <i class="fas ${cfg.icon} text-primary me-2"></i>
        <span>${cfg.label}</span>
      </div>
      <div class="db-partner-list">
        ${list.map(p => `
        <div class="db-partner-item" title="${sanitize(p.description || '')}">
          <div class="db-partner-logo"><i class="fas ${cfg.icon}"></i></div>
          <div class="db-partner-name">${sanitize(p.nom)}</div>
        </div>`).join('')}
      </div>
    </div>`;
  }
  el.innerHTML = html;
}

// ── Spots & Points de Vue ──────────────────────────────────────
function renderSpots(spots) {
  const mapEl = document.getElementById('db-spots-map');
  const listEl = document.getElementById('db-spots-list');
  if (!mapEl || !listEl) return;

  // Carte Leaflet mini
  if (!dashMap) {
    dashMap = L.map('db-spots-map', { zoomControl: true, attributionControl: false })
      .setView([-21.1151, 55.5364], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(dashMap);
  } else {
    dashMap.eachLayer(l => { if (l instanceof L.Marker) dashMap.removeLayer(l); });
  }

  if (!spots || !spots.length) {
    listEl.innerHTML = `<div class="db-empty"><i class="fas fa-map-marker-alt"></i><p>Aucun spot</p></div>`;
    return;
  }

  const viewpoints = spots.filter(s => s.type === 'viewpoint');
  const balades    = spots.filter(s => s.type === 'balade');

  // Markers sur la carte
  spots.forEach(s => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="spot-marker ${s.type}"><i class="fas ${s.type === 'viewpoint' ? 'fa-eye' : 'fa-route'}"></i></div>`,
      iconSize: [28, 28], iconAnchor: [14, 14]
    });
    L.marker([s.lat, s.lng], { icon })
      .addTo(dashMap)
      .bindPopup(`<strong>${s.nom}</strong><br><small>${s.description || ''}</small>`);
  });

  // Liste texte
  let html = '';
  if (viewpoints.length) {
    html += `<div class="db-spots-section">
      <div class="db-spots-section-title"><i class="fas fa-eye text-primary me-1"></i>Points de vue</div>
      ${viewpoints.map((s, i) => `
      <div class="db-spot-item" onclick="focusSpot(${s.lat},${s.lng},'${sanitize(s.nom)}')">
        <span class="db-spot-num">${i + 1}</span>
        <span class="db-spot-name">${sanitize(s.nom)}</span>
      </div>`).join('')}
    </div>`;
  }
  if (balades.length) {
    html += `<div class="db-spots-section">
      <div class="db-spots-section-title"><i class="fas fa-route text-accent me-1"></i>Idées de balades</div>
      ${balades.map(s => `
      <div class="db-spot-item" onclick="focusSpot(${s.lat},${s.lng},'${sanitize(s.nom)}')">
        <i class="fas fa-map-signs db-spot-icon"></i>
        <span class="db-spot-name">${sanitize(s.nom)}</span>
      </div>`).join('')}
    </div>`;
  }
  listEl.innerHTML = html;
}

function focusSpot(lat, lng, nom) {
  if (!dashMap) return;
  dashMap.setView([lat, lng], 12);
  dashMap.eachLayer(l => {
    if (l instanceof L.Marker) {
      const pos = l.getLatLng();
      if (Math.abs(pos.lat - lat) < 0.001 && Math.abs(pos.lng - lng) < 0.001) l.openPopup();
    }
  });
}

// ── Recherche rapide ───────────────────────────────────────────
function searchDashboard(query) {
  const resEl = document.getElementById('db-search-results');
  if (!resEl) return;
  query = query.trim().toLowerCase();
  if (!query || !dashData) { resEl.style.display = 'none'; return; }

  const results = [];

  (dashData.allSorties || []).filter(s =>
    s.titre.toLowerCase().includes(query) || (s.organisateur || '').toLowerCase().includes(query)
  ).forEach(s => results.push({ icon: 'fa-route', label: s.titre, sub: `Sortie • ${fmtDate(s.date)}`, action: () => viewSortie(s.id) }));

  (dashData.spots || []).filter(s => s.nom.toLowerCase().includes(query))
    .forEach(s => results.push({ icon: 'fa-map-marker-alt', label: s.nom, sub: s.type === 'viewpoint' ? 'Point de vue' : 'Balade', action: () => focusSpot(s.lat, s.lng, s.nom) }));

  (dashData.partners || []).filter(p => p.nom.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query))
    .forEach(p => results.push({ icon: 'fa-handshake', label: p.nom, sub: PARTNER_CATS[p.categorie]?.label || 'Partenaire', action: () => {} }));

  if (!results.length) {
    resEl.style.display = 'none';
    return;
  }

  resEl.innerHTML = results.slice(0, 8).map((r, i) => `
    <div class="city-result-item" onclick="selectSearchResult(${i})">
      <i class="fas ${r.icon}"></i>
      <div><div>${sanitize(r.label)}</div><small class="text-muted">${r.sub}</small></div>
    </div>`).join('');

  window._searchResults = results;
  resEl.style.display = 'block';
}

function selectSearchResult(i) {
  if (!window._searchResults) return;
  const r = window._searchResults[i];
  if (r && r.action) r.action();
  document.getElementById('db-search-results').style.display = 'none';
  document.getElementById('db-search').value = '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#db-search-wrap')) {
    const el = document.getElementById('db-search-results');
    if (el) el.style.display = 'none';
  }
});

// ── Groupes CRUD ───────────────────────────────────────────────
function showCreateGroupModal() {
  const modal = new bootstrap.Modal(document.getElementById('modalCreateGroup'));
  modal.show();
}

async function submitCreateGroup(e) {
  e.preventDefault();
  const nom  = document.getElementById('groupNom').value.trim();
  const desc = document.getElementById('groupDesc').value.trim();
  if (!nom) { showToast('Nom du groupe requis', 'error'); return; }
  try {
    await api('/groups', 'POST', { nom, description: desc });
    showToast('Groupe créé !');
    bootstrap.Modal.getInstance(document.getElementById('modalCreateGroup')).hide();
    document.getElementById('createGroupForm').reset();
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

async function leaveGroup(id, nom) {
  if (!confirm(`Quitter le groupe "${nom}" ?`)) return;
  try {
    await api(`/groups/${id}/leave`, 'DELETE');
    showToast('Vous avez quitté le groupe');
    loadDashboard();
  } catch (err) { showToast(err.message, 'error'); }
}

// ── Partenaires ────────────────────────────────────────────────
function showPartnerModal() {
  const modal = new bootstrap.Modal(document.getElementById('modalPartner'));
  modal.show();
}

async function submitPartnerForm(e) {
  e.preventDefault();
  const body = {
    nom:         document.getElementById('partnerNom').value.trim(),
    categorie:   document.getElementById('partnerCat').value,
    description: document.getElementById('partnerDesc').value.trim(),
    adresse:     document.getElementById('partnerAdresse').value.trim(),
    telephone:   document.getElementById('partnerTel').value.trim(),
    site_web:    document.getElementById('partnerWeb').value.trim(),
  };
  if (!body.nom || !body.categorie) { showToast('Nom et catégorie requis', 'error'); return; }
  try {
    await api('/partners', 'POST', body);
    showToast('Demande envoyée ! En attente de validation.');
    bootstrap.Modal.getInstance(document.getElementById('modalPartner')).hide();
    document.getElementById('partnerForm').reset();
  } catch (err) { showToast(err.message, 'error'); }
}
