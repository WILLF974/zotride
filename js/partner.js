/* ============================================================
   partner.js – Espace partenaire ZotRide
   ============================================================ */

let currentPartner = null;
let partnerMap     = null;
let partnerMapMarker = null;

// ── Connexion par code ─────────────────────────────────────────
async function partnerLogin(e) {
  e.preventDefault();
  const errEl = document.getElementById('partnerLoginError');
  if (errEl) errEl.classList.add('d-none');

  const code = (document.getElementById('partnerCode')?.value || '').trim().toUpperCase();
  if (!code) {
    if (errEl) { errEl.textContent = 'Code requis'; errEl.classList.remove('d-none'); }
    return;
  }

  try {
    const data = await fetch('/api/partner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    }).then(r => r.json());

    if (data.error) throw new Error(data.error);

    localStorage.setItem('partner_token', data.token);
    localStorage.setItem('partner', JSON.stringify(data.partner));
    currentPartner = data.partner;
    showPage('partner-dashboard');
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove('d-none'); }
  }
}

function partnerLogout() {
  localStorage.removeItem('partner_token');
  localStorage.removeItem('partner');
  currentPartner = null;
  if (partnerMap) { partnerMap.remove(); partnerMap = null; partnerMapMarker = null; }
  showPage('partner-login');
}

// ── Dashboard partenaire ──────────────────────────────────────
async function loadPartnerDashboard() {
  const token = localStorage.getItem('partner_token');
  if (!token) { showPage('partner-login'); return; }

  // Tenter de restaurer depuis localStorage d'abord
  if (!currentPartner) {
    currentPartner = JSON.parse(localStorage.getItem('partner') || 'null');
  }

  try {
    const data = await partnerApi('/partner/me');
    currentPartner = data;
    localStorage.setItem('partner', JSON.stringify(data));
  } catch {
    showPage('partner-login');
    return;
  }

  renderPartnerInfo(currentPartner);
  loadPartnerOffers();
  initPartnerMap();
}

function renderPartnerInfo(p) {
  const nomEl = document.getElementById('partner-dash-nom');
  const catEl = document.getElementById('partner-dash-cat');
  if (nomEl) nomEl.textContent = p.nom || '';
  if (catEl) catEl.textContent = p.categorie || '';

  // Pré-remplir le formulaire de profil
  const descEl    = document.getElementById('pd-edit-desc');
  const addrEl    = document.getElementById('pd-edit-adresse');
  const telEl     = document.getElementById('pd-edit-tel');
  const webEl     = document.getElementById('pd-edit-web');
  if (descEl)    descEl.value    = p.description || '';
  if (addrEl)    addrEl.value    = p.adresse     || '';
  if (telEl)     telEl.value     = p.telephone   || '';
  if (webEl)     webEl.value     = p.site_web    || '';
}

async function updatePartnerInfo(e) {
  e.preventDefault();
  const body = {
    description: document.getElementById('pd-edit-desc')?.value    || '',
    adresse:     document.getElementById('pd-edit-adresse')?.value || '',
    telephone:   document.getElementById('pd-edit-tel')?.value     || '',
    site_web:    document.getElementById('pd-edit-web')?.value     || '',
    lat: currentPartner?.lat || null,
    lng: currentPartner?.lng || null,
  };
  // Récupérer coords depuis la carte
  if (partnerMapMarker) {
    const latlng = partnerMapMarker.getLatLng();
    body.lat = latlng.lat;
    body.lng = latlng.lng;
  }
  try {
    await partnerApi('/partner/me', 'PUT', body);
    currentPartner = { ...currentPartner, ...body };
    localStorage.setItem('partner', JSON.stringify(currentPartner));
    showToast('Profil mis à jour !');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Offres ─────────────────────────────────────────────────────
async function loadPartnerOffers() {
  const el = document.getElementById('partner-offers-list');
  if (!el) return;
  el.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>';
  try {
    const offers = await partnerApi('/partner/offers');
    if (!offers.length) {
      el.innerHTML = '<p class="text-muted small">Aucune offre créée</p>';
      return;
    }
    const typeColors = { menu:'#2d9e43', promo:'#e63946', event:'#f4a261', autre:'#888' };
    el.innerHTML = offers.map(o => {
      const expiry = o.valid_until ? new Date(o.valid_until).toLocaleDateString('fr-FR') : '—';
      const tc     = typeColors[o.type] || typeColors.autre;
      return `<div class="offer-card d-flex justify-content-between align-items-start gap-2">
        <div>
          <span class="offer-type-badge" style="background:${tc}">${sanitize(o.type)}</span>
          <strong class="ms-2" style="color:#e2e2e2">${sanitize(o.titre)}</strong>
          <p style="color:#aaa;font-size:.82rem;margin:.25rem 0 0">${sanitize(o.description || '')}</p>
          <small style="color:#666">Valable jusqu'au : ${expiry}</small>
        </div>
        <button class="btn btn-outline-danger btn-sm" onclick="deleteOffer(${o.id})" title="Supprimer">
          <i class="fas fa-trash"></i>
        </button>
      </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = `<p class="text-danger small">${sanitize(err.message)}</p>`;
  }
}

async function createOffer(e) {
  e.preventDefault();
  const titre  = document.getElementById('offer-titre')?.value.trim() || '';
  const desc   = document.getElementById('offer-desc')?.value.trim()  || '';
  const type   = document.getElementById('offer-type')?.value         || 'menu';
  const until  = document.getElementById('offer-until')?.value        || '';
  if (!titre) { showToast('Titre requis', 'error'); return; }
  try {
    await partnerApi('/partner/offers', 'POST', { titre, description: desc, type, valid_until: until || null });
    showToast('Offre créée !');
    document.getElementById('offerForm')?.reset();
    loadPartnerOffers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteOffer(id) {
  if (!confirm('Supprimer cette offre ?')) return;
  try {
    await partnerApi(`/partner/offers/${id}`, 'DELETE');
    showToast('Offre supprimée');
    loadPartnerOffers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Carte position partenaire ──────────────────────────────────
function initPartnerMap() {
  const mapEl = document.getElementById('partner-location-map');
  if (!mapEl) return;
  if (partnerMap) { partnerMap.remove(); partnerMap = null; partnerMapMarker = null; }

  partnerMap = L.map('partner-location-map', { zoomControl: true, attributionControl: false })
    .setView([-21.1151, 55.5364], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(partnerMap);

  // Si coordonnées déjà définies
  if (currentPartner?.lat && currentPartner?.lng) {
    const icon = L.divIcon({ className:'', html:`<div style="background:#e63946;border:2px solid #fff;border-radius:50%;width:14px;height:14px"></div>`, iconSize:[14,14], iconAnchor:[7,7] });
    partnerMapMarker = L.marker([currentPartner.lat, currentPartner.lng], { icon, draggable: true }).addTo(partnerMap);
    partnerMap.setView([currentPartner.lat, currentPartner.lng], 14);
  }

  // Clic → placer / déplacer le marqueur
  partnerMap.on('click', (e) => {
    const icon = L.divIcon({ className:'', html:`<div style="background:#e63946;border:2px solid #fff;border-radius:50%;width:14px;height:14px"></div>`, iconSize:[14,14], iconAnchor:[7,7] });
    if (partnerMapMarker) {
      partnerMapMarker.setLatLng(e.latlng);
    } else {
      partnerMapMarker = L.marker(e.latlng, { icon, draggable: true }).addTo(partnerMap);
    }
    const coordEl = document.getElementById('partner-coords-info');
    if (coordEl) coordEl.textContent = `${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
  });
}

// ── API helper partenaire ─────────────────────────────────────
async function partnerApi(endpoint, method = 'GET', body = null) {
  const token = localStorage.getItem('partner_token');
  const opts  = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    }
  };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch('/api' + endpoint, opts);
  } catch {
    throw new Error('Impossible de joindre le serveur.');
  }

  let data;
  try { data = await res.json(); } catch { throw new Error(`Erreur serveur HTTP ${res.status}`); }

  if (!res.ok) {
    if (res.status === 401) { partnerLogout(); return; }
    throw new Error(data.error || 'Erreur serveur');
  }
  return data;
}
