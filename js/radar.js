/* ============================================================
   radar.js – Carte publique Zot Ride Radar
   ============================================================ */

const REUNION = { center: [-21.1151, 55.5364], zoom: 11 };
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const COLORS = ['#2ecc71','#3498db','#9b59b6','#f39c12','#1abc9c','#e67e22','#16a085','#8e44ad'];

let radarMap      = null;
let riderMarkers  = {};     // session_id → L.Marker
let sortieMarkers = {};     // sortie.id  → L.Marker
let sharingActive = false;
let shareTimer    = null;
let pollTimer     = null;

// ── Session & profil ──────────────────────────────────────────
function getSessionId() {
  let sid = localStorage.getItem('radar_session');
  if (!sid) {
    sid = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36));
    localStorage.setItem('radar_session', sid);
  }
  return sid;
}

function loadedProfile() {
  return {
    pseudo:         localStorage.getItem('radar_pseudo') || '',
    moto_marque:    localStorage.getItem('radar_marque') || '',
    moto_cylindree: localStorage.getItem('radar_cyl')    || '',
    moto_type:      localStorage.getItem('radar_type')   || ''
  };
}

function saveProfile() {
  const pseudo = document.getElementById('rdrPseudo').value.trim();
  const errEl  = document.getElementById('profileError');

  if (!pseudo) {
    errEl.textContent = 'Le pseudo est obligatoire';
    errEl.classList.remove('d-none');
    return;
  }
  errEl.classList.add('d-none');

  localStorage.setItem('radar_pseudo',  pseudo);
  localStorage.setItem('radar_marque',  document.getElementById('rdrMarque').value);
  localStorage.setItem('radar_cyl',     document.getElementById('rdrCylindree').value);
  localStorage.setItem('radar_type',    document.getElementById('rdrType').value);

  renderProfileDisplay();
}

function renderProfileDisplay() {
  const p = loadedProfile();
  if (!p.pseudo) {
    document.getElementById('profileDisplay').classList.add('d-none');
    document.getElementById('profileForm').style.display = 'block';
    document.getElementById('btnEditProfile').style.display = 'none';
    return;
  }

  // Remplir les champs (pour modification future)
  document.getElementById('rdrPseudo').value      = p.pseudo;
  document.getElementById('rdrMarque').value      = p.moto_marque;
  document.getElementById('rdrCylindree').value   = p.moto_cylindree;
  document.getElementById('rdrType').value        = p.moto_type;

  // Affichage
  const color = sessionColor(getSessionId());
  document.getElementById('profileAvatar').textContent  = p.pseudo[0].toUpperCase();
  document.getElementById('profileAvatar').style.background = color;
  document.getElementById('profileName').textContent    = p.pseudo;
  const motoDesc = [p.moto_marque, p.moto_type, p.moto_cylindree ? p.moto_cylindree + ' cc' : '']
    .filter(Boolean).join(' · ');
  document.getElementById('profileMotoTxt').textContent = motoDesc || 'Moto non renseignée';

  document.getElementById('profileDisplay').classList.remove('d-none');
  document.getElementById('profileForm').style.display = 'none';
  document.getElementById('btnEditProfile').style.display = 'inline-flex';
}

function openProfileEdit() {
  document.getElementById('profileDisplay').classList.add('d-none');
  document.getElementById('profileForm').style.display = 'block';
  document.getElementById('btnEditProfile').style.display = 'none';
}

// ── Partage de position ───────────────────────────────────────
function toggleSharing() {
  if (sharingActive) {
    stopSharing();
  } else {
    startSharing();
  }
}

function startSharing() {
  const p = loadedProfile();
  if (!p.pseudo) {
    openProfileEdit();
    document.getElementById('profileError').textContent = 'Entrez d\'abord un pseudo pour partager votre position';
    document.getElementById('profileError').classList.remove('d-none');
    return;
  }

  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas disponible sur ce navigateur.');
    return;
  }

  const btn = document.getElementById('shareBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Localisation…';

  navigator.geolocation.getCurrentPosition(
    async pos => {
      await postPosition(pos.coords.latitude, pos.coords.longitude);
      sharingActive = true;
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-stop-circle"></i> Arrêter le partage';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-danger');

      setShareStatus(true);
      await fetchAll();

      // Mise à jour auto toutes les 5 minutes pour rester "actif"
      shareTimer = setInterval(async () => {
        navigator.geolocation.getCurrentPosition(
          p2 => postPosition(p2.coords.latitude, p2.coords.longitude),
          () => {}
        );
      }, 5 * 60 * 1000);
    },
    () => {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Partager ma position';
      alert('Impossible d\'obtenir votre position. Vérifiez les permissions de localisation.');
    },
    { timeout: 12000, enableHighAccuracy: true }
  );
}

async function postPosition(lat, lng) {
  const p = loadedProfile();
  await fetch('/api/radar/position', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id:     getSessionId(),
      pseudo:         p.pseudo,
      moto_marque:    p.moto_marque,
      moto_cylindree: p.moto_cylindree,
      moto_type:      p.moto_type,
      lat, lng
    })
  });
}

async function stopSharing() {
  clearInterval(shareTimer);
  sharingActive = false;

  await fetch('/api/radar/position', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: getSessionId() })
  });

  const btn = document.getElementById('shareBtn');
  btn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Partager ma position';
  btn.classList.remove('btn-danger');
  btn.classList.add('btn-primary');

  setShareStatus(false);
  await fetchAll();
}

function setShareStatus(active) {
  const el = document.getElementById('shareStatus');
  el.classList.remove('d-none', 'active', 'inactive');
  if (active) {
    el.classList.add('active');
    el.innerHTML = '<div class="pulse-dot"></div> Position partagée – mise à jour auto toutes les 5 min';
  } else {
    el.classList.add('inactive');
    el.innerHTML = '<i class="fas fa-eye-slash"></i> Partage arrêté';
    setTimeout(() => el.classList.add('d-none'), 3000);
    return;
  }
  el.classList.remove('d-none');
}

// ── Polling & données ─────────────────────────────────────────
async function fetchAll() {
  try {
    const [positions, sorties] = await Promise.all([
      fetch('/api/radar/positions').then(r => r.json()),
      fetch('/api/radar/sorties').then(r => r.json())
    ]);
    updateMapRiders(positions);
    updateMapSorties(sorties);
    updatePanel(positions, sorties);

    document.getElementById('stat-update').textContent =
      'màj ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { /* silencieux */ }
}

// ── Carte – riders ────────────────────────────────────────────
function updateMapRiders(positions) {
  const seen     = new Set();
  const mySession = getSessionId();

  positions.forEach(p => {
    seen.add(p.session_id);
    const isOwn = p.session_id === mySession;
    const latlng = [p.lat, p.lng];

    if (riderMarkers[p.session_id]) {
      riderMarkers[p.session_id].setLatLng(latlng);
      riderMarkers[p.session_id].getPopup()?.setContent(riderPopup(p, isOwn));
    } else {
      riderMarkers[p.session_id] = L.marker(latlng, { icon: riderIcon(p, isOwn) })
        .addTo(radarMap)
        .bindPopup(riderPopup(p, isOwn));
    }
  });

  // Supprimer les partis
  Object.keys(riderMarkers).forEach(sid => {
    if (!seen.has(sid)) {
      riderMarkers[sid].remove();
      delete riderMarkers[sid];
    }
  });

  document.getElementById('stat-riders').textContent = positions.length;
}

function riderIcon(p, isOwn) {
  const bg     = isOwn ? '#4cc9f0' : sessionColor(p.session_id);
  const shadow = isOwn ? '0 0 0 5px rgba(76,201,240,.35)' : '0 3px 10px rgba(0,0,0,.5)';
  const init   = p.pseudo ? p.pseudo[0].toUpperCase() : '?';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;
      background:${bg};border:2px solid #fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:15px;
      box-shadow:${shadow};
    ">${init}</div>`,
    iconSize: [36, 36], iconAnchor: [18, 18]
  });
}

function riderPopup(p, isOwn) {
  const motoParts = [p.moto_marque, p.moto_type, p.moto_cylindree ? p.moto_cylindree + ' cc' : ''].filter(Boolean);
  const moto = motoParts.length
    ? `<div style="color:#aaa;font-size:.78rem;margin-top:2px">🏍 ${esc(motoParts.join(' · '))}</div>`
    : '';
  const tag = isOwn ? ' <span style="color:#4cc9f0;font-size:.72rem">(vous)</span>' : '';
  return `<div style="min-width:140px;font-family:sans-serif">
    <b style="font-size:.92rem">${esc(p.pseudo)}</b>${tag}
    ${moto}
    <div style="color:#aaa;font-size:.7rem;margin-top:4px">⏱ ${timeSince(p.updated_at)}</div>
  </div>`;
}

// ── Carte – sorties ───────────────────────────────────────────
function updateMapSorties(sorties) {
  const seen = new Set();

  sorties.forEach(s => {
    if (s.rally_lat == null) return;
    seen.add(s.id);

    const latlng = [s.rally_lat, s.rally_lng];
    if (sortieMarkers[s.id]) {
      sortieMarkers[s.id].getPopup()?.setContent(sortiePopup(s));
    } else {
      sortieMarkers[s.id] = L.marker(latlng, { icon: sortieIcon(s) })
        .addTo(radarMap)
        .bindPopup(sortiePopup(s));
    }
  });

  Object.keys(sortieMarkers).forEach(id => {
    if (!seen.has(+id)) { sortieMarkers[id].remove(); delete sortieMarkers[id]; }
  });

  document.getElementById('stat-sorties').textContent = sorties.length;
}

function sortieIcon(s) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;
      background:#e63946;border:2px solid #fff;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 12px rgba(230,57,70,.5);
      font-size:18px;
    ">🏁</div>`,
    iconSize: [40, 40], iconAnchor: [20, 20]
  });
}

function sortiePopup(s) {
  const full = s.nb_participants >= s.nb_max_participants;
  return `<div style="min-width:180px;font-family:sans-serif">
    <b style="font-size:.92rem;color:#e63946">${esc(s.titre)}</b>
    <div style="margin-top:4px;font-size:.8rem">
      <div>⏰ Départ à <b>${s.heure}</b></div>
      <div>👤 ${esc(s.organisateur)}</div>
      ${s.rally_nom ? `<div>📍 ${esc(s.rally_nom)}</div>` : ''}
      <div style="margin-top:4px">
        <span style="background:${full ? '#e63946' : '#2ecc71'};color:#fff;border-radius:4px;padding:1px 7px;font-size:.72rem;font-weight:700">
          ${s.nb_participants} / ${s.nb_max_participants} participants
        </span>
      </div>
    </div>
    <a href="/" style="display:block;margin-top:6px;font-size:.75rem;color:#e63946">
      → Rejoindre avec un compte
    </a>
  </div>`;
}

// ── Panneau latéral ───────────────────────────────────────────
function updatePanel(positions, sorties) {
  const mySession = getSessionId();

  // Liste des riders
  const ridersList = document.getElementById('ridersList');
  if (!positions.length) {
    ridersList.innerHTML = '<p class="rp-empty">Aucun motard actif pour l\'instant</p>';
  } else {
    ridersList.innerHTML = positions.map(p => {
      const isOwn = p.session_id === mySession;
      const bg    = isOwn ? '#4cc9f0' : sessionColor(p.session_id);
      return `<div class="rider-item" onclick="flyToRider('${p.session_id}')">
        <div class="rider-avatar" style="background:${bg}">${esc(p.pseudo[0].toUpperCase())}</div>
        <div class="flex-grow-1" style="min-width:0">
          <div class="rider-info-name">${esc(p.pseudo)}${isOwn ? ' <span style="color:#4cc9f0;font-size:.7rem">(vous)</span>' : ''}</div>
          ${[p.moto_marque, p.moto_type, p.moto_cylindree ? p.moto_cylindree+' cc':''].filter(Boolean).length ? `<div class="rider-info-moto">🏍 ${esc([p.moto_marque,p.moto_type,p.moto_cylindree?p.moto_cylindree+' cc':''].filter(Boolean).join(' · '))}</div>` : ''}
        </div>
        <div class="rider-time">${timeSince(p.updated_at)}</div>
      </div>`;
    }).join('');
  }

  // Liste des sorties du jour
  const sortiesList = document.getElementById('sortiesTodayList');
  if (!sorties.length) {
    sortiesList.innerHTML = '<p class="rp-empty">Aucune sortie programmée aujourd\'hui</p>';
  } else {
    sortiesList.innerHTML = sorties.map(s => `
      <div class="sortie-today-card" onclick="flyToSortie(${s.id})">
        <div class="st-title">${esc(s.titre)}</div>
        <div class="st-meta">⏰ ${s.heure} &bull; 👤 ${esc(s.organisateur)}</div>
        <span class="st-badge">🏍 ${s.nb_participants} / ${s.nb_max_participants}</span>
      </div>`).join('');
  }
}

function flyToRider(sid) {
  if (riderMarkers[sid]) {
    radarMap.flyTo(riderMarkers[sid].getLatLng(), 15, { animate: true, duration: .8 });
    riderMarkers[sid].openPopup();
  }
}

function flyToSortie(id) {
  if (sortieMarkers[id]) {
    radarMap.flyTo(sortieMarkers[id].getLatLng(), 14, { animate: true, duration: .8 });
    sortieMarkers[id].openPopup();
  }
}

// ── Mobile toggle ─────────────────────────────────────────────
function togglePanel() {
  const panel = document.getElementById('radarPanel');
  const btn   = document.getElementById('panelToggleBtn');
  panel.classList.toggle('open');
  const open = panel.classList.contains('open');
  btn.innerHTML = open
    ? '<i class="fas fa-times"></i> Fermer'
    : '<i class="fas fa-layer-group"></i> Panneau';
  if (open) setTimeout(() => radarMap.invalidateSize(), 350);
}

// ── Utilitaires ───────────────────────────────────────────────
function sessionColor(sid) {
  let h = 5381;
  for (let i = 0; i < Math.min(sid.length, 20); i++) h = ((h << 5) + h + sid.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

function timeSince(dateStr) {
  const sec = Math.floor((Date.now() - new Date(dateStr + (dateStr.endsWith('Z') ? '' : 'Z')).getTime()) / 1000);
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)} min`;
  return `${Math.floor(sec / 3600)} h`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Carte
  radarMap = L.map('radar-map').setView(REUNION.center, REUNION.zoom);
  L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(radarMap);

  // Profil depuis localStorage
  renderProfileDisplay();

  // Premier chargement
  fetchAll();

  // Polling toutes les 30 secondes
  pollTimer = setInterval(fetchAll, 30000);
});
