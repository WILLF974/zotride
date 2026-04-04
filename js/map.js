/* ============================================================
   map.js – Gestion Leaflet
   ============================================================ */

const REUNION = { center: [-21.1151, 55.5364], zoom: 11 };
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

let createMap         = null;
let detailMap         = null;
let partnerMarkers    = [];

// Création sortie
let waypoints      = [];
let wpMarkers      = [];
let wpPolyline     = null;
let userLocMarker  = null;

// ── Carte de création ─────────────────────────────────────────
function initCreateMap() {
  if (createMap) { createMap.remove(); createMap = null; }
  waypoints = []; wpMarkers = [];

  // Attendre que le conteneur soit visible
  setTimeout(() => {
    createMap = L.map('create-map').setView(REUNION.center, REUNION.zoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(createMap);
    createMap.on('click', e => addWaypoint(e.latlng.lat, e.latlng.lng));
    renderWpList();
  }, 120);
}

function addWaypoint(lat, lng) {
  const idx   = waypoints.length;
  const first = idx === 0;
  const wp = {
    lat, lng,
    nom: first ? 'Point de rassemblement' : `Étape ${idx}`,
    is_rassemblement: first
  };
  waypoints.push(wp);
  wpMarkers.push(createWpMarker(createMap, lat, lng, idx, wp.nom));
  rebuildPolyline(createMap, wpPolyline, waypoints, setCreatePolyline);
  renderWpList();
}

function setCreatePolyline(pl) { wpPolyline = pl; }

function createWpMarker(map, lat, lng, idx, nom) {
  const first = idx === 0;
  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;
      background:${first ? '#e63946' : '#f4a261'};
      border:2px solid #fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:13px;
      box-shadow:0 2px 8px rgba(0,0,0,.5)
    ">${idx + 1}</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16]
  });
  return L.marker([lat, lng], { icon })
    .addTo(map)
    .bindPopup(`<b>${nom}</b><br><small>${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`);
}

function rebuildPolyline(map, existing, wps, setter) {
  if (existing) { existing.remove(); }
  if (wps.length < 2) { setter(null); return; }
  const pl = L.polyline(wps.map(w => [w.lat, w.lng]), {
    color: '#e63946', weight: 3, opacity: .8, dashArray: '8 6'
  }).addTo(map);
  setter(pl);
}

function clearWaypoints() {
  waypoints = [];
  wpMarkers.forEach(m => m.remove());
  wpMarkers = [];
  if (wpPolyline) { wpPolyline.remove(); wpPolyline = null; }
  renderWpList();
}

function removeWaypoint(idx) {
  waypoints.splice(idx, 1);
  wpMarkers[idx].remove();
  wpMarkers.splice(idx, 1);

  // Recalculate first/rassemblement
  waypoints.forEach((w, i) => { w.is_rassemblement = i === 0; });

  // Rebuild all markers
  wpMarkers.forEach(m => m.remove());
  wpMarkers = [];
  waypoints.forEach((w, i) => {
    wpMarkers.push(createWpMarker(createMap, w.lat, w.lng, i, w.nom));
  });

  rebuildPolyline(createMap, wpPolyline, waypoints, setCreatePolyline);
  renderWpList();
}

function updateWpName(idx, val) {
  waypoints[idx].nom = val;
}

function renderWpList() {
  const el = document.getElementById('waypoints-list');
  if (!el) return;
  if (!waypoints.length) {
    el.innerHTML = '<p class="text-muted small mb-0">Aucun point – cliquez sur la carte</p>';
    return;
  }
  el.innerHTML = waypoints.map((wp, i) => `
    <div class="wp-item">
      <div class="wp-num ${i === 0 ? 'first' : 'other'}">${i + 1}</div>
      <input type="text" class="form-control"
        value="${sanitize(wp.nom)}"
        onchange="updateWpName(${i}, this.value)">
      <button type="button" class="btn btn-sm btn-link text-danger p-0 ms-1" onclick="removeWaypoint(${i})" title="Supprimer">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `).join('');
}

function getWaypoints() { return waypoints; }

// ── Plein écran carte création ────────────────────────────────
function toggleCreateMapFullscreen() {
  const wrapper = document.getElementById('create-map-wrapper');
  const icon    = document.getElementById('map-fullscreen-icon');
  const btn     = document.getElementById('map-fullscreen-btn');
  if (!wrapper) return;

  const isFs = wrapper.classList.toggle('map-is-fullscreen');
  icon.className = isFs ? 'fas fa-compress' : 'fas fa-expand';
  btn.title      = isFs ? 'Quitter le plein écran' : 'Plein écran';

  // Laisser le browser repeindre avant d'invalider la taille Leaflet
  setTimeout(() => { if (createMap) createMap.invalidateSize(); }, 50);
}

// Quitter le plein écran avec Echap
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const wrapper = document.getElementById('create-map-wrapper');
    if (wrapper && wrapper.classList.contains('map-is-fullscreen')) {
      toggleCreateMapFullscreen();
    }
  }
});

// ── Recherche de ville (Nominatim / OSM) ──────────────────────
let _citySearchTimer = null;
function searchCity() {
  clearTimeout(_citySearchTimer);
  const input   = document.getElementById('citySearch');
  const results = document.getElementById('cityResults');
  const query   = input ? input.value.trim() : '';
  if (!query) { if (results) results.classList.add('d-none'); return; }
  if (query.length < 3) return;
  _citySearchTimer = setTimeout(() => _doSearchCity(query), 400);
}

async function _doSearchCity(query) {
  const results = document.getElementById('cityResults');
  if (!results) return;

  results.innerHTML = '<div class="city-result-searching"><i class="fas fa-spinner fa-spin me-2"></i>Recherche…</div>';
  results.classList.remove('d-none');

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(query)}`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'fr' } });
    const data = await res.json();

    if (!data.length) {
      results.innerHTML = '<div class="city-result-searching text-muted">Aucun résultat</div>';
      return;
    }

    results.innerHTML = data.map(item => `
      <div class="city-result-item" onclick="selectCity(${item.lat}, ${item.lon}, '${sanitize(item.display_name).replace(/'/g, '&#39;')}')">
        <i class="fas fa-map-marker-alt"></i>
        <span>${sanitize(item.display_name)}</span>
      </div>
    `).join('');
  } catch {
    results.innerHTML = '<div class="city-result-searching text-danger">Erreur de recherche</div>';
  }
}


function selectCity(lat, lng, label) {
  const results = document.getElementById('cityResults');
  const input   = document.getElementById('citySearch');

  // Extraire le nom court (avant la première virgule)
  input.value = label.split(',')[0];
  results.classList.add('d-none');

  if (createMap) {
    createMap.setView([parseFloat(lat), parseFloat(lng)], 14);
  }
}

// Fermer les résultats si clic ailleurs
document.addEventListener('click', e => {
  const bar = document.getElementById('citySearch');
  const res = document.getElementById('cityResults');
  if (res && bar && !bar.closest('.map-search-bar')?.contains(e.target)) {
    res.classList.add('d-none');
  }
});

// ── Carte de détail ───────────────────────────────────────────
let participantMarkers = {};   // pseudo → L.Marker
let locationPollTimer  = null;

// ── Marqueurs partenaires sur carte détail ────────────────────
function addPartnerMarkersToDetailMap(partners) {
  if (!detailMap) return;
  // Nettoyer anciens marqueurs partenaires
  partnerMarkers.forEach(m => detailMap.removeLayer(m));
  partnerMarkers = [];

  const catIcons = { resto:'🍽️', mecano:'🔧', concessionnaire:'🏍️', station:'⛽', autre:'🏪' };
  partners.forEach(p => {
    if (!p.lat || !p.lng) return;
    const emoji = catIcons[p.categorie] || catIcons.autre;
    const icon  = L.divIcon({
      className: '',
      html: `<div style="background:#1a1a1a;border:2px solid #f4a261;border-radius:8px;padding:2px 5px;font-size:.75rem;white-space:nowrap;color:#f4a261;font-weight:700">${emoji} ${sanitize(p.nom.split(' ').slice(0,2).join(' '))}</div>`,
      iconAnchor: [0, 0]
    });
    const marker = L.marker([p.lat, p.lng], { icon })
      .addTo(detailMap)
      .bindPopup(`<strong style="color:#f4a261">${sanitize(p.nom)}</strong><br><small>${sanitize(p.adresse||'')}</small>`)
      .on('click', () => {
        if (typeof openPartnerDetail === 'function') openPartnerDetail(p.id);
      });
    partnerMarkers.push(marker);
  });
}

function initDetailMap(wps) {
  stopLocationPolling();
  if (detailMap) { detailMap.remove(); detailMap = null; }
  participantMarkers = {};
  partnerMarkers = [];

  setTimeout(() => {
    detailMap = L.map('detail-map').setView(REUNION.center, REUNION.zoom);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(detailMap);

    if (wps && wps.length) {
      const bounds = [];
      wps.forEach((wp, i) => {
        const m = createWpMarker(detailMap, wp.lat, wp.lng, i, wp.nom || `Point ${i + 1}`);
        if (wp.is_rassemblement) {
          m.bindPopup(`<b>${sanitize(wp.nom || 'Point de rassemblement')}</b><br>
            <span style="background:#e63946;color:#fff;border-radius:4px;padding:1px 6px;font-size:.75rem">Rassemblement</span>`);
        }
        bounds.push([wp.lat, wp.lng]);
      });
      if (wps.length > 1) {
        L.polyline(bounds, { color: '#e63946', weight: 3, opacity: .8, dashArray: '8 6' }).addTo(detailMap);
      }
      detailMap.fitBounds(bounds, { padding: [30, 30] });
    }

    // Charger immédiatement les positions puis toutes les 15 s
    refreshParticipantLocations();
    locationPollTimer = setInterval(refreshParticipantLocations, 15000);
  }, 120);
}

function stopLocationPolling() {
  if (locationPollTimer) { clearInterval(locationPollTimer); locationPollTimer = null; }
}

// ── Rafraîchissement des positions participants ───────────────
async function refreshParticipantLocations() {
  if (!detailMap || !currentSortieId) return;
  try {
    const locations = await api(`/sorties/${currentSortieId}/locations`);
    const seen = new Set();

    locations.forEach(loc => {
      seen.add(loc.pseudo);
      const isOwn = currentUser && loc.user_id === currentUser.id;
      const popupHtml = buildLocPopup(loc, isOwn);

      if (participantMarkers[loc.pseudo]) {
        // Déplacer le marqueur existant
        participantMarkers[loc.pseudo].setLatLng([loc.lat, loc.lng]);
        participantMarkers[loc.pseudo].getPopup()?.setContent(popupHtml);
      } else {
        // Créer un nouveau marqueur
        const icon = buildParticipantIcon(loc.pseudo, isOwn);
        participantMarkers[loc.pseudo] = L.marker([loc.lat, loc.lng], { icon })
          .addTo(detailMap)
          .bindPopup(popupHtml);
      }
    });

    // Supprimer les marqueurs des participants qui ont retiré leur position
    Object.keys(participantMarkers).forEach(pseudo => {
      if (!seen.has(pseudo)) {
        participantMarkers[pseudo].remove();
        delete participantMarkers[pseudo];
      }
    });

    // Mettre à jour le compteur dans le bouton
    updateLocCounter(locations.length);
  } catch { /* silencieux */ }
}

function buildParticipantIcon(pseudo, isOwn) {
  const bg      = isOwn ? '#4cc9f0' : '#2ecc71';
  const shadow  = isOwn ? '0 0 0 5px rgba(76,201,240,.35)' : '0 2px 8px rgba(0,0,0,.45)';
  const initial = pseudo ? pseudo[0].toUpperCase() : '?';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:34px;height:34px;
      background:${bg};border:2px solid #fff;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:14px;
      box-shadow:${shadow};
    ">${initial}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17]
  });
}

function buildLocPopup(loc, isOwn) {
  const ago   = timeSince(loc.updated_at);
  const moto  = loc.moto_marque
    ? `<div style="color:#888;font-size:.78rem">🏍️ ${sanitize(loc.moto_marque)}${loc.moto_cylindree ? ' ' + loc.moto_cylindree + ' cc' : ''}</div>`
    : '';
  return `
    <div style="min-width:140px">
      <b>${sanitize(loc.pseudo)}</b>${isOwn ? ' <span style="color:#4cc9f0;font-size:.75rem">(vous)</span>' : ''}
      ${moto}
      <div style="color:#aaa;font-size:.73rem;margin-top:3px">⏱ ${ago}</div>
    </div>`;
}

function timeSince(dateStr) {
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (sec < 60)  return `il y a ${sec}s`;
  if (sec < 3600) return `il y a ${Math.floor(sec / 60)}min`;
  return `il y a ${Math.floor(sec / 3600)}h`;
}

function updateLocCounter(count) {
  const btn = document.getElementById('btn-location');
  if (!btn) return;
  if (count > 0) {
    btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> En ligne <span class="badge bg-success ms-1">${count}</span>`;
  } else {
    btn.innerHTML = `<i class="fas fa-map-marker-alt"></i> Ma position`;
  }
}

// ── Partager sa propre position ───────────────────────────────
function shareLocation() {
  if (!navigator.geolocation) {
    showToast('Géolocalisation non disponible sur ce navigateur', 'error');
    return;
  }

  const btn = document.getElementById('btn-location');
  if (btn) btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      try {
        await api(`/sorties/${currentSortieId}/location`, 'POST', { lat, lng });
        showToast('Position partagée avec les participants');
        // Rafraîchir immédiatement pour afficher le nouveau marqueur
        await refreshParticipantLocations();
        // Centrer sur la position de l'utilisateur
        if (detailMap) detailMap.setView([lat, lng], 14);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    },
    () => {
      showToast("Impossible d'obtenir votre position", 'error');
      if (btn) btn.disabled = false;
    },
    { timeout: 10000 }
  );
}
