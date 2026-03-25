/* ============================================================
   landing.js – Page d'accueil publique Zot Ride
   ============================================================ */

// ── Données statiques : parcours emblématiques ────────────────
const STATIC_PARCOURS = [
  {
    id: 'p1', nom: 'Cirque de Cilaos',
    desc: 'La route des 400 virages, au cœur du cirque',
    lat: -21.2380, lng: 55.4772,
    distance: '85 km', type: 'trail', icon: '⛰️',
    color: '#e63946'
  },
  {
    id: 'p2', nom: 'Route du Volcan',
    desc: 'Montée vers le Piton de la Fournaise, paysages lunaires',
    lat: -21.2418, lng: 55.7088,
    distance: '110 km', type: 'trail', icon: '🌋',
    color: '#f4a261'
  },
  {
    id: 'p3', nom: 'Route des Laves',
    desc: 'Coulées figées jusqu\'à la mer, sensation unique',
    lat: -21.3500, lng: 55.7300,
    distance: '45 km', type: 'roadster', icon: '🏖️',
    color: '#a0a0a0'
  },
  {
    id: 'p4', nom: 'Cirque de Mafate',
    desc: 'Col des Bœufs, panoramas à couper le souffle',
    lat: -21.0830, lng: 55.4200,
    distance: '70 km', type: 'trail', icon: '🏕️',
    color: '#f4a261'
  },
  {
    id: 'p5', nom: 'Grand Bénare',
    desc: 'Les hauts de Saint-Paul, virages et air frais',
    lat: -21.0920, lng: 55.3770,
    distance: '60 km', type: 'roadster', icon: '🌿',
    color: '#a0a0a0'
  },
];

// ── Données statiques : partenaires piliers ───────────────────
const STATIC_PARTNERS = [
  {
    id: 'r1', nom: 'Le Vieux Vélo', categorie: 'resto',
    lat: -21.2391, lng: 55.4741, adresse: 'Cilaos',
    offre: '10% sur la note pour les ZotRiders'
  },
  {
    id: 'r2', nom: 'Chez Régis', categorie: 'resto',
    lat: -21.3219, lng: 55.5040, adresse: 'Saint-Pierre',
    offre: 'Plat du jour offert à partir de 3 motos'
  },
  {
    id: 'r3', nom: 'Station Lava', categorie: 'station',
    lat: -21.3490, lng: 55.7180, adresse: 'Route des Laves',
    offre: 'Café offert sur présentation de la carte ZotRide'
  },
  {
    id: 'r4', nom: 'Moto Réunion Service', categorie: 'mecano',
    lat: -20.8800, lng: 55.4500, adresse: 'Saint-Denis',
    offre: 'Diagnose gratuite pour pannes en route'
  },
  {
    id: 'r5', nom: 'La Table du Volcan', categorie: 'resto',
    lat: -21.2380, lng: 55.6950, adresse: 'Bourg-Murat',
    offre: 'Dessert maison offert pour les groupes'
  },
];

// ── État ──────────────────────────────────────────────────────
let landingMap      = null;
let _partnerCluster = null;
let _parcoursLayer  = null;
let _liveCluster    = null;
let _landingFilter  = 'all';

// ── Initialisation ────────────────────────────────────────────
function initLandingPage() {
  if (landingMap) { landingMap.remove(); landingMap = null; }
  _partnerCluster = null;
  _parcoursLayer  = null;
  _liveCluster    = null;
  _landingFilter  = 'all';

  // Reset chip active state
  document.querySelectorAll('.landing-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === 'all');
  });

  setTimeout(() => {
    landingMap = L.map('landing-map', { zoomControl: false })
      .setView([-21.1151, 55.5364], 11);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(landingMap);

    // Zoom control en bas à droite (loin du panel)
    L.control.zoom({ position: 'bottomright' }).addTo(landingMap);

    // Ajuster la taille quand le panel change
    landingMap.invalidateSize();

    _initMarkerClusters();
    _addParcoursMarkers();
    _addPartnerMarkers();
    _fetchAndRenderLiveRiders();
    _renderParcoursList();

    // Tooltip "commencez ici" à la 1ère visite
    if (!localStorage.getItem('zr_landing_tip')) {
      setTimeout(_showCreateTip, 1800);
    }
  }, 150);
}

// ── Clusters ──────────────────────────────────────────────────
function _initMarkerClusters() {
  _partnerCluster = L.markerClusterGroup({
    maxClusterRadius: 50,
    iconCreateFunction: c => L.divIcon({
      html: `<div class="lc-cluster lc-cluster-partner">${c.getChildCount()}</div>`,
      className: '', iconSize: [36, 36]
    })
  });
  _liveCluster = L.markerClusterGroup({
    maxClusterRadius: 40,
    iconCreateFunction: c => L.divIcon({
      html: `<div class="lc-cluster lc-cluster-live">${c.getChildCount()}</div>`,
      className: '', iconSize: [36, 36]
    })
  });
  _parcoursLayer = L.featureGroup();
}

// ── Marqueurs parcours (gris/rouge) ───────────────────────────
function _addParcoursMarkers() {
  STATIC_PARCOURS.forEach(p => {
    const icon = L.divIcon({
      className: '',
      html: `<div class="lm-parcours" style="background:${p.color}"><i class="fas fa-route" style="font-size:.7rem"></i></div>`,
      iconSize: [34, 34], iconAnchor: [17, 17]
    });
    const marker = L.marker([p.lat, p.lng], { icon })
      .bindPopup(`
        <div style="min-width:170px">
          <b style="color:var(--accent,#f4a261)">${p.icon} ${p.nom}</b>
          <div style="color:#ccc;font-size:.8rem;margin:.3rem 0">${p.desc}</div>
          <div style="color:#888;font-size:.72rem;margin-bottom:.5rem">
            <i class="fas fa-road me-1"></i>${p.distance}
          </div>
          <button onclick="showPage('explore')"
            style="background:#e63946;border:none;color:#fff;width:100%;padding:5px;border-radius:8px;font-size:.78rem;cursor:pointer;font-weight:600">
            <i class="fas fa-map-marked-alt me-1"></i>Explorer ce parcours
          </button>
        </div>
      `);
    _parcoursLayer.addLayer(marker);
  });
  _parcoursLayer.addTo(landingMap);
}

// ── Marqueurs partenaires (orange) ────────────────────────────
function _addPartnerMarkers() {
  const catEmoji = { resto: '🍽️', mecano: '🔧', station: '⛽', concessionnaire: '🏍️', autre: '🏪' };
  STATIC_PARTNERS.forEach(p => {
    const emoji = catEmoji[p.categorie] || catEmoji.autre;
    const icon  = L.divIcon({
      className: '',
      html: `<div class="lm-partner">${emoji}</div>`,
      iconSize: [38, 38], iconAnchor: [19, 38]
    });
    const marker = L.marker([p.lat, p.lng], { icon })
      .bindPopup(`
        <div style="min-width:175px">
          <b style="color:var(--accent,#f4a261)">${emoji} ${p.nom}</b>
          <div style="color:#aaa;font-size:.76rem;margin:.15rem 0">${p.adresse}</div>
          <div style="background:rgba(244,162,97,.12);border:1px solid rgba(244,162,97,.25);
               border-radius:6px;padding:4px 8px;font-size:.73rem;color:#f4a261;margin:.4rem 0">
            🎁 ${p.offre}
          </div>
          <button onclick="showPage('register')"
            style="background:#e63946;border:none;color:#fff;width:100%;padding:5px;border-radius:8px;font-size:.78rem;cursor:pointer;font-weight:600">
            Réserver l'étape (Offre ZotRide)
          </button>
        </div>
      `);
    _partnerCluster.addLayer(marker);
  });
  _partnerCluster.addTo(landingMap);
}

// ── Riders live (API publique, aucun token requis) ────────────
async function _fetchAndRenderLiveRiders() {
  try {
    const res   = await fetch('/api/live/riders?lat=-21.1151&lng=55.5364&radius=100', {
      cache: 'no-store'
    });
    if (!res.ok) throw new Error('no riders');
    const riders = await res.json();

    _updateLiveBanner(Array.isArray(riders) ? riders.length : 0);

    if (Array.isArray(riders)) {
      riders.forEach(r => {
        const initial = r.pseudo?.[0]?.toUpperCase() || '?';
        const icon    = L.divIcon({
          className: '',
          html: `<div class="lm-live">${initial}</div>`,
          iconSize: [32, 32], iconAnchor: [16, 16]
        });
        _liveCluster.addLayer(
          L.marker([r.display_lat, r.display_lng], { icon })
            .bindPopup(`
              <div>
                <b>${r.pseudo || 'Motard'}</b>
                <div style="color:#888;font-size:.74rem">🏍️ En route sur l'île</div>
              </div>
            `)
        );
      });
      if (riders.length) _liveCluster.addTo(landingMap);
    }
  } catch {
    _updateLiveBanner(0);
  }
}

function _updateLiveBanner(count) {
  const counter = document.getElementById('landing-live-counter');
  const banner  = document.getElementById('landing-cta-banner');
  if (!counter || !banner) return;

  if (count >= 1) {
    counter.innerHTML = `
      <span class="landing-live-dot"></span>
      <b>${count}</b>&nbsp;motard${count > 1 ? 's' : ''} en ligne maintenant
    `;
    counter.style.display = 'flex';
    banner.style.display  = 'none';
  } else {
    counter.style.display = 'none';
    banner.innerHTML = `
      <span><i class="fas fa-fire-alt" style="color:#e63946"></i>&nbsp;
      Soyez le premier à proposer une sortie aujourd'hui !</span>
      <a href="#" onclick="showPage('register');return false" class="landing-cta-link">
        Je m'inscris →
      </a>
    `;
    banner.style.display = 'flex';
    banner.style.flexDirection = 'column';
    banner.style.gap = '.4rem';
  }
}

// ── Filtre par chip ───────────────────────────────────────────
function setLandingFilter(filter) {
  _landingFilter = filter;

  document.querySelectorAll('.landing-chip').forEach(el => {
    el.classList.toggle('active', el.dataset.filter === filter);
  });

  if (!landingMap) return;

  // Retire tout
  if (_parcoursLayer)  landingMap.removeLayer(_parcoursLayer);
  if (_partnerCluster) landingMap.removeLayer(_partnerCluster);
  if (_liveCluster)    landingMap.removeLayer(_liveCluster);

  switch (filter) {
    case 'live':
      landingMap.addLayer(_liveCluster);
      break;
    case 'parcours':
      landingMap.addLayer(_parcoursLayer);
      break;
    case 'partners':
      landingMap.addLayer(_partnerCluster);
      break;
    default: // 'all'
      landingMap.addLayer(_parcoursLayer);
      landingMap.addLayer(_partnerCluster);
      if (_liveCluster.getLayers().length) landingMap.addLayer(_liveCluster);
  }
}

// ── Rendu des cards parcours dans le panel ────────────────────
function _renderParcoursList() {
  const container = document.getElementById('landing-parcours-list');
  if (!container) return;

  container.innerHTML = STATIC_PARCOURS.map(p => `
    <div class="lpc-card" onclick="_focusParcours('${p.id}')">
      <div class="lpc-icon">${p.icon}</div>
      <div class="lpc-info">
        <div class="lpc-nom">${p.nom}</div>
        <div class="lpc-desc">${p.desc}</div>
      </div>
      <div class="lpc-dist"><i class="fas fa-road" style="font-size:.65rem"></i>&nbsp;${p.distance}</div>
    </div>
  `).join('');
}

function _focusParcours(id) {
  const p = STATIC_PARCOURS.find(x => x.id === id);
  if (!p || !landingMap) return;
  landingMap.setView([p.lat, p.lng], 14, { animate: true });
  // Réduire le bottom sheet sur mobile pour voir la carte
  const panel = document.getElementById('landingPanel');
  if (panel && window.innerWidth < 992) panel.classList.remove('expanded');
}

// ── Bottom sheet toggle (mobile) ──────────────────────────────
function toggleBottomSheet() {
  const panel = document.getElementById('landingPanel');
  if (panel) {
    panel.classList.toggle('expanded');
    // Invalider la carte quand le panel change de taille
    if (landingMap) setTimeout(() => landingMap.invalidateSize(), 420);
  }
}

// ── Tooltip "Commencez ici" ───────────────────────────────────
function _showCreateTip() {
  const tip = document.getElementById('landing-create-tip');
  if (!tip) return;
  tip.classList.remove('d-none');
  setTimeout(() => {
    tip.style.transition = 'opacity .5s';
    tip.style.opacity = '0';
    setTimeout(() => {
      tip.classList.add('d-none');
      tip.style.opacity = '';
      tip.style.transition = '';
      localStorage.setItem('zr_landing_tip', '1');
    }, 500);
  }, 5000);
}
