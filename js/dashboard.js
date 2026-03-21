/* ============================================================
   dashboard.js – Widgets page d'accueil ZotRide (maquette fidèle)
   ============================================================ */

let dashMap = null;
let fluxMaps = {};
let dashData = null;

function groupColor(nom) {
  const colors = [
    'linear-gradient(135deg,#1a6b2a,#2d9e43)',
    'linear-gradient(135deg,#1a2a6b,#2d4a9e)',
    'linear-gradient(135deg,#6b1a1a,#9e2d2d)',
    'linear-gradient(135deg,#6b501a,#9e782d)',
    'linear-gradient(135deg,#4a1a6b,#722d9e)',
    'linear-gradient(135deg,#1a5a6b,#2d8a9e)',
  ];
  let h = 0;
  for (const c of nom) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

function groupInitials(nom) {
  return nom.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
}

async function loadDashboard() {
  const footer = document.getElementById('mainFooter');
  if (footer) {
    footer.style.display = 'block';
    const yr = document.getElementById('footer-year');
    if (yr) yr.textContent = new Date().getFullYear();
  }
  try {
    dashData = await api('/dashboard');
    renderMyNextSorties(dashData.myNextSorties);
    renderSpots(dashData.spots);
    renderZotFlux(dashData.allSorties, dashData.recentActivity);
    renderMyGroups(dashData.myGroups);
    renderPartners(dashData.partners);
  } catch (err) { showToast(err.message, 'error'); }
}

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
      <div class="db-sortie-date"><i class="fas fa-calendar-alt"></i>${fmtDate(s.date)} &bull; ${s.heure ? s.heure.slice(0,5) + ':00' : ''}</div>
      <div class="db-sortie-title">${sanitize(s.titre)}</div>
      <div class="db-sortie-desc">${sanitize(s.description || '')}</div>
      <div class="db-sortie-footer">
        <span class="db-organiser"><i class="fas fa-user"></i></span>
        <span class="db-pill ${full ? 'full' : ''}"><i class="fas fa-motorcycle"></i> ${s.nb_participants} / ${s.nb_max_participants}</span>
      </div>
    </div>`;
  }).join('');
}

function renderSpots(spots) {
  const mapEl  = document.getElementById('db-spots-map');
  const listEl = document.getElementById('db-spots-list');
  if (!mapEl || !listEl) return;
  if (!dashMap) {
    dashMap = L.map('db-spots-map', { zoomControl: true, attributionControl: false }).setView([-21.1151, 55.5364], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(dashMap);
  } else {
    dashMap.eachLayer(l => { if (l instanceof L.Marker) dashMap.removeLayer(l); });
  }
  if (!spots || !spots.length) { listEl.innerHTML = `<div class="db-empty"><i class="fas fa-map-marker-alt"></i></div>`; return; }

  const viewpoints = spots.filter(s => s.type === 'viewpoint');
  const balades    = spots.filter(s => s.type === 'balade');
  const allSpots   = [...viewpoints, ...balades];

  allSpots.forEach((s, i) => {
    const isView = s.type === 'viewpoint';
    const icon = L.divIcon({
      className: '',
      html: `<div class="spot-marker ${s.type}">${isView ? (i+1) : '<i class="fas fa-motorcycle" style="font-size:.5rem"></i>'}</div>`,
      iconSize: [22,22], iconAnchor: [11,11]
    });
    L.marker([s.lat, s.lng], { icon }).addTo(dashMap)
      .bindPopup(`<strong>${s.nom}</strong><br><small>${s.description || ''}</small>`)
      .on('click', () => focusSpot(s.lat, s.lng, s.nom));
  });

  let html = '';
  viewpoints.forEach((s, i) => {
    html += `<div class="db-spot-item" onclick="focusSpot(${s.lat},${s.lng},'${sanitize(s.nom)}')">
      <span class="db-spot-num">${i+1}</span>
      <span class="db-spot-name">${sanitize(s.nom)}</span></div>`;
  });
  balades.forEach(s => {
    html += `<div class="db-spot-item" onclick="focusSpot(${s.lat},${s.lng},'${sanitize(s.nom)}')">
      <span class="db-spot-num" style="background:var(--accent)"><i class="fas fa-route" style="font-size:.5rem"></i></span>
      <span class="db-spot-name">${sanitize(s.nom)}</span>
      <span class="db-spot-ride"><i class="fas fa-motorcycle"></i></span></div>`;
  });
  listEl.innerHTML = html;
}

function focusSpot(lat, lng, nom) {
  if (!dashMap) return;
  dashMap.setView([lat, lng], 12);
  dashMap.eachLayer(l => {
    if (l instanceof L.Marker) {
      const p = l.getLatLng();
      if (Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001) l.openPopup();
    }
  });
}

function renderZotFlux(allSorties, recentActivity) {
  const el = document.getElementById('db-flux');
  if (!el) return;
  let posts = [];
  if (allSorties && allSorties.length) {
    allSorties.slice(0,6).forEach((s, idx) => posts.push({ type:'sortie', data:s, mapId:`fmap-${idx}` }));
  }
  if (recentActivity && recentActivity.length) {
    recentActivity.filter(a => a.type === 'join').slice(0,3).forEach(a => posts.push({ type:'join', data:a }));
  }
  if (!posts.length) {
    el.innerHTML = `<div class="db-empty" style="padding:2rem"><i class="fas fa-stream"></i><p>Aucune activité récente</p></div>`;
    return;
  }
  el.innerHTML = posts.map(p => {
    if (p.type === 'sortie') {
      const s = p.data;
      const full = s.nb_participants >= s.nb_max_participants;
      const init = (s.organisateur || '?')[0].toUpperCase();
      return `
      <div class="flux-post">
        <div class="flux-post-header">
          <div class="flux-user-avatar">${init}</div>
          <div class="flux-text"><strong>${sanitize(s.organisateur)}</strong> a organisé une sortie :
            <span class="flux-link" onclick="viewSortie(${s.id})">${sanitize(s.titre)}</span> <span style="color:#555;font-size:.72rem">(Link)</span>
          </div>
        </div>
        <div class="flux-route-map" id="${p.mapId}"></div>
        <div class="flux-actions">
          <button class="flux-action-btn"><i class="fas fa-heart"></i> S'ante</button>
          <span style="color:#555;font-size:.7rem">${s.nb_participants} commentaires</span>
          <span class="db-pill ${full?'full':''}" style="margin-left:auto"><i class="fas fa-motorcycle"></i> ${s.nb_participants}/${s.nb_max_participants}</span>
          <button class="btn btn-primary btn-sm" onclick="viewSortie(${s.id})" style="font-size:.7rem;padding:2px 10px">Voir</button>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;margin-top:.4rem">
          <div class="flux-user-avatar" style="width:24px;height:24px;font-size:.6rem">${init}</div>
          <input class="flux-comment-input" placeholder="Un commentaire...">
        </div>
      </div>`;
    } else {
      const a = p.data;
      const init = (a.actor || '?')[0].toUpperCase();
      return `
      <div class="flux-post">
        <div class="flux-post-header">
          <div class="flux-user-avatar">${init}</div>
          <div class="flux-text"><strong>${sanitize(a.actor)}</strong> a rejoint la sortie
            <span class="flux-link">${sanitize(a.label)}</span>
          </div>
        </div>
        <div class="flux-actions">
          <button class="flux-action-btn"><i class="fas fa-heart"></i> J'aime</button>
          <span style="color:#555;font-size:.7rem">${fmtDatetime(a.ts)}</span>
        </div>
      </div>`;
    }
  }).join('');

  setTimeout(() => {
    posts.filter(p => p.type === 'sortie').forEach(p => {
      const mapEl = document.getElementById(p.mapId);
      if (!mapEl || mapEl.dataset.init) return;
      mapEl.dataset.init = '1';
      const m = L.map(p.mapId, { zoomControl:false, attributionControl:false, interactive:false }).setView([-21.1151,55.5364], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:16 }).addTo(m);
      fluxMaps[p.mapId] = m;
      api(`/sorties/${p.data.id}`).then(d => {
        if (!d || !d.waypoints || !d.waypoints.length) return;
        const coords = d.waypoints.sort((a,b) => a.ordre-b.ordre).map(w => [w.lat,w.lng]);
        if (coords.length) {
          L.polyline(coords, { color:'#e63946', weight:3 }).addTo(m);
          coords.forEach((c, i) => L.circleMarker(c, {
            radius: i===0?7:5, fillColor: i===0?'#e63946':'#f4a261',
            fillOpacity:1, color:'#fff', weight:1.5
          }).addTo(m));
          m.fitBounds(L.latLngBounds(coords), { padding:[10,10] });
        }
      }).catch(()=>{});
    });
  }, 150);
}

function renderMyGroups(groups) {
  const el = document.getElementById('db-groups');
  if (!el) return;
  if (!groups || !groups.length) {
    el.innerHTML = `<div class="db-empty"><i class="fas fa-users-slash"></i><p>Aucun groupe rejoint</p></div>`;
    return;
  }
  el.innerHTML = `<div class="db-groups-grid">` +
    groups.map(g => `
    <div class="db-group-item" title="${sanitize(g.nom)}">
      <div class="db-group-circle" style="background:${groupColor(g.nom)}"
           onclick="leaveGroup(${g.id},'${sanitize(g.nom)}')">
        <span style="font-size:.75rem;font-weight:800">${groupInitials(g.nom)}</span>
      </div>
      <div class="db-group-gname">${sanitize(g.nom)}</div>
      <div class="db-group-role"><span class="dot"></span>${g.my_role==='admin'?'Admin':'Membre'}</div>
    </div>`).join('') +
  `</div>`;
}

const PARTNER_CATS = {
  concessionnaire:{ icon:'fa-motorcycle', label:'CONCESSIONNAIRES & MÉCANOS' },
  mecano:         { icon:'fa-tools',      label:'GARAGES & MÉCANOS' },
  resto:          { icon:'fa-utensils',   label:'RESTOS & BOULANGERIES' },
  station:        { icon:'fa-gas-pump',   label:'STATIONS-SERVICE & AUTRES' },
  autre:          { icon:'fa-store',      label:'AUTRES' },
};

function renderPartners(partners) {
  const el = document.getElementById('db-partners');
  if (!el) return;
  if (!partners || !partners.length) {
    el.innerHTML = `<div class="db-empty"><i class="fas fa-handshake"></i><p>Aucun partenaire</p></div>`;
    return;
  }
  const grouped = {};
  partners.forEach(p => { if (!grouped[p.categorie]) grouped[p.categorie]=[]; grouped[p.categorie].push(p); });
  const order = ['concessionnaire','mecano','resto','station','autre'];
  let html = '';
  order.forEach(cat => {
    if (!grouped[cat]) return;
    const cfg = PARTNER_CATS[cat] || PARTNER_CATS.autre;
    html += `<div class="db-partner-section">
      <div class="db-partner-cat-row"><div class="cat-icon"><i class="fas ${cfg.icon}"></i></div>${cfg.label}</div>
      <div class="db-partner-grid">${grouped[cat].map(p => `
        <div class="db-partner-box" title="${sanitize(p.description||p.nom)}" onclick="openPartnerDetail(${p.id})" style="cursor:pointer">
          <div class="db-partner-logo-box">${partnerLogoHtml(p.nom)}</div>
          <div class="db-partner-pname">${sanitize(p.nom.split(' ').slice(-2).join(' '))}</div>
        </div>`).join('')}
      </div></div>`;
  });
  el.innerHTML = html;
}

function partnerLogoHtml(nom) {
  const words = nom.split(' ').filter(w => w.length > 1);
  const abbr  = words.slice(0,2).map(w => w[0].toUpperCase()).join('');
  const hue   = nom.split('').reduce((a,c) => a+c.charCodeAt(0), 0) % 360;
  return `<div style="width:100%;height:100%;background:hsl(${hue},30%,18%);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:800;color:hsl(${hue},50%,65%)">${abbr}</div>`;
}

function searchDashboard(query) {
  const resEl = document.getElementById('db-search-results');
  if (!resEl) return;
  query = query.trim().toLowerCase();
  if (!query || !dashData) { resEl.style.display='none'; return; }
  const results = [];
  (dashData.allSorties||[]).filter(s => s.titre.toLowerCase().includes(query)||(s.organisateur||'').toLowerCase().includes(query))
    .forEach(s => results.push({ icon:'fa-route', label:s.titre, sub:`Sortie • ${fmtDate(s.date)}`, action:()=>viewSortie(s.id) }));
  (dashData.spots||[]).filter(s => s.nom.toLowerCase().includes(query))
    .forEach(s => results.push({ icon:'fa-map-marker-alt', label:s.nom, sub:s.type==='viewpoint'?'Point de vue':'Balade', action:()=>focusSpot(s.lat,s.lng,s.nom) }));
  (dashData.partners||[]).filter(p => p.nom.toLowerCase().includes(query))
    .forEach(p => results.push({ icon:'fa-handshake', label:p.nom, sub:PARTNER_CATS[p.categorie]?.label||'Partenaire', action:()=>{} }));
  if (!results.length) { resEl.style.display='none'; return; }
  resEl.innerHTML = results.slice(0,8).map((r,i) => `
    <div class="city-result-item" onclick="selectSearchResult(${i})">
      <i class="fas ${r.icon}"></i>
      <div><div>${sanitize(r.label)}</div><small class="text-muted">${r.sub}</small></div>
    </div>`).join('');
  window._searchResults = results;
  resEl.style.display = 'block';
}

function selectSearchResult(i) {
  window._searchResults?.[i]?.action();
  document.getElementById('db-search-results').style.display = 'none';
  document.getElementById('db-search').value = '';
}

document.addEventListener('click', e => {
  if (!e.target.closest('#db-search-wrap')) {
    const el = document.getElementById('db-search-results');
    if (el) el.style.display = 'none';
  }
});

function showCreateGroupModal() {
  new bootstrap.Modal(document.getElementById('modalCreateGroup')).show();
}

async function submitCreateGroup(e) {
  e.preventDefault();
  const nom  = document.getElementById('groupNom').value.trim();
  const desc = document.getElementById('groupDesc').value.trim();
  if (!nom) { showToast('Nom du groupe requis','error'); return; }
  try {
    await api('/groups','POST',{ nom, description:desc });
    showToast('Groupe créé !');
    bootstrap.Modal.getInstance(document.getElementById('modalCreateGroup')).hide();
    document.getElementById('createGroupForm').reset();
    loadDashboard();
  } catch (err) { showToast(err.message,'error'); }
}

async function leaveGroup(id, nom) {
  if (!confirm(`Quitter le groupe "${nom}" ?`)) return;
  try {
    await api(`/groups/${id}/leave`,'DELETE');
    showToast('Vous avez quitté le groupe');
    loadDashboard();
  } catch (err) { showToast(err.message,'error'); }
}

let _partnerDetailMap = null;

async function openPartnerDetail(id) {
  try {
    const p = await api(`/partners/${id}`);
    const modal = document.getElementById('modalPartnerDetail');
    if (!modal) return;

    // Avatar coloré
    const hue  = p.nom.split('').reduce((a,c) => a + c.charCodeAt(0), 0) % 360;
    const abbr = p.nom.split(' ').filter(w => w.length > 1).slice(0,2).map(w => w[0].toUpperCase()).join('');
    document.getElementById('pd-avatar').innerHTML =
      `<div style="width:64px;height:64px;border-radius:12px;background:hsl(${hue},30%,18%);display:flex;align-items:center;justify-content:center;font-size:1.3rem;font-weight:800;color:hsl(${hue},50%,65%)">${abbr}</div>`;
    document.getElementById('pd-nom').textContent       = p.nom;
    document.getElementById('pd-categorie').textContent = PARTNER_CATS[p.categorie]?.label || p.categorie;
    document.getElementById('pd-desc').textContent      = p.description || '';
    document.getElementById('pd-adresse').textContent   = p.adresse || '';
    document.getElementById('pd-tel').textContent       = p.telephone || '';
    const webEl = document.getElementById('pd-web');
    if (p.site_web) {
      webEl.href        = p.site_web.startsWith('http') ? p.site_web : 'https://' + p.site_web;
      webEl.textContent = p.site_web;
      webEl.style.display = '';
    } else {
      webEl.style.display = 'none';
    }

    // Offres
    const offersEl = document.getElementById('pd-offers');
    if (p.offers && p.offers.length) {
      offersEl.innerHTML = p.offers.map(o => {
        const typeColors = { menu:'#2d9e43', promo:'#e63946', event:'#f4a261', autre:'#888' };
        const typeColor  = typeColors[o.type] || typeColors.autre;
        const expiry     = o.valid_until ? `<small style="color:#888"> · Valable jusqu'au ${new Date(o.valid_until).toLocaleDateString('fr-FR')}</small>` : '';
        return `<div class="offer-card">
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="offer-type-badge" style="background:${typeColor}">${sanitize(o.type)}</span>
            <strong style="color:#e2e2e2">${sanitize(o.titre)}</strong>
          </div>
          <p style="color:#aaa;font-size:.85rem;margin:0">${sanitize(o.description || '')}${expiry}</p>
        </div>`;
      }).join('');
    } else {
      offersEl.innerHTML = '<p class="text-muted small">Aucune offre active</p>';
    }

    // Mini-carte si coordonnées
    const mapWrap = document.getElementById('pd-map-wrap');
    if (p.lat && p.lng) {
      mapWrap.style.display = 'block';
      // Détruire ancienne carte
      if (_partnerDetailMap) { _partnerDetailMap.remove(); _partnerDetailMap = null; }
      setTimeout(() => {
        _partnerDetailMap = L.map('pd-map', { zoomControl:false, attributionControl:false }).setView([p.lat, p.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(_partnerDetailMap);
        const icon = L.divIcon({ className:'', html:`<div style="background:#e63946;border:2px solid #fff;border-radius:50%;width:12px;height:12px"></div>`, iconSize:[12,12], iconAnchor:[6,6] });
        L.marker([p.lat, p.lng], { icon }).addTo(_partnerDetailMap).bindPopup(sanitize(p.nom)).openPopup();
      }, 200);
    } else {
      mapWrap.style.display = 'none';
    }

    new bootstrap.Modal(modal).show();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showPartnerModal() {
  new bootstrap.Modal(document.getElementById('modalPartner')).show();
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
  if (!body.nom||!body.categorie) { showToast('Nom et catégorie requis','error'); return; }
  try {
    await api('/partners','POST',body);
    showToast('Demande envoyée ! En attente de validation.');
    bootstrap.Modal.getInstance(document.getElementById('modalPartner')).hide();
    document.getElementById('partnerForm').reset();
  } catch (err) { showToast(err.message,'error'); }
}
