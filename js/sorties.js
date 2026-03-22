/* ============================================================
   sorties.js – Liste, détail, création, participation
   ============================================================ */

let currentSortieId = null;

// ── Chat Pusher ────────────────────────────────────────────────
let pusherClient  = null;
let chatChannel   = null;
const PUSHER_KEY  = 'e3694954e31d41d5e80d';
const PUSHER_CLUSTER = 'eu';

function initChat(sortieId) {
  // Init Pusher une seule fois
  if (!pusherClient) {
    pusherClient = new Pusher(PUSHER_KEY, { cluster: PUSHER_CLUSTER });
  }

  // Quitter le canal précédent
  if (chatChannel) {
    pusherClient.unsubscribe(chatChannel.name);
    chatChannel = null;
  }

  chatChannel = pusherClient.subscribe(`sortie-${sortieId}`);
  chatChannel.bind('new-message', (data) => {
    appendChatMessage(data, false);
    scrollChat();
  });

  loadChatMessages(sortieId);
}

async function loadChatMessages(sortieId) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  try {
    const messages = await api(`/sorties/${sortieId}/chat`);
    if (!messages.length) {
      box.innerHTML = '<p class="chat-empty">Aucun message. Soyez le premier !</p>';
      return;
    }
    box.innerHTML = '';
    messages.forEach(m => appendChatMessage(m, false));
    scrollChat();
  } catch { box.innerHTML = '<p class="chat-empty">Chat indisponible</p>'; }
}

function appendChatMessage(m, animate = true) {
  const box = document.getElementById('chat-messages');
  if (!box) return;
  const isOwn = currentUser && m.user_id == currentUser.id;
  const time  = new Date(m.created_at.endsWith('Z') ? m.created_at : m.created_at + 'Z')
                  .toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const init  = (m.pseudo || '?')[0].toUpperCase();

  // Supprimer le message vide si présent
  const empty = box.querySelector('.chat-empty');
  if (empty) empty.remove();

  const el = document.createElement('div');
  el.className = `chat-msg${isOwn ? ' own' : ''}`;
  if (animate) el.style.animation = 'fadeInUp .2s ease';
  el.innerHTML = `
    <div class="chat-avatar">${sanitize(init)}</div>
    <div>
      <div class="chat-meta">${isOwn ? 'Vous' : sanitize(m.pseudo)} · ${time}</div>
      <div class="chat-bubble">${sanitize(m.message)}</div>
    </div>`;
  box.appendChild(el);
}

function scrollChat() {
  const box = document.getElementById('chat-messages');
  if (box) box.scrollTop = box.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const btn   = document.getElementById('chat-send-btn');
  const msg   = input.value.trim();
  if (!msg || !currentSortieId) return;

  input.value = '';
  btn.disabled = true;
  try {
    await api(`/sorties/${currentSortieId}/chat`, 'POST', { message: msg });
  } catch (err) {
    showToast(err.message, 'error');
    input.value = msg; // restaurer si erreur
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

// ── Dashboard : liste des sorties ─────────────────────────────
async function loadSorties() {
  const list = document.getElementById('sorties-list');
  list.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

  try {
    const sorties = await api('/sorties');

    if (!sorties.length) {
      list.innerHTML = `
        <div class="col-12">
          <div class="empty-state">
            <i class="fas fa-motorcycle"></i>
            <h5 class="mb-1">Aucune sortie programmée</h5>
            <p class="mb-3">Soyez le premier à en organiser une !</p>
            <button class="btn btn-primary" onclick="showPage('create-sortie')">
              <i class="fas fa-plus"></i> Organiser une sortie
            </button>
          </div>
        </div>`;
      return;
    }

    list.innerHTML = sorties.map(s => {
      const full = s.nb_participants >= s.nb_max_participants;
      return `
        <div class="col-sm-6 col-xl-4" onclick="viewSortie(${s.id})" style="cursor:pointer">
          <div class="sortie-card">
            <div class="sortie-date-pill">
              <i class="fas fa-calendar-alt"></i>
              ${fmtDate(s.date)} &bull; ${s.heure}
            </div>
            <h5>${sanitize(s.titre)}</h5>
            ${s.description ? `<p>${sanitize(s.description).substring(0, 110)}${s.description.length > 110 ? '…' : ''}</p>` : '<p></p>'}
            <div class="sortie-card-footer">
              <span class="sortie-organizer">
                <i class="fas fa-user me-1"></i>${sanitize(s.organisateur)}
              </span>
              <span class="participants-pill ${full ? 'full' : ''}">
                <i class="fas fa-motorcycle me-1"></i>${s.nb_participants} / ${s.nb_max_participants}
              </span>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="col-12 text-center text-danger py-4">Erreur : ${sanitize(err.message)}</div>`;
  }
}

// ── Détail d'une sortie ───────────────────────────────────────
async function viewSortie(id) {
  currentSortieId = id;
  showPage('sortie-detail');

  document.getElementById('detail-loading').classList.remove('d-none');
  document.getElementById('detail-content').classList.add('d-none');
  document.getElementById('detail-titre').textContent = 'Chargement…';

  try {
    const s = await api(`/sorties/${id}`);
    document.getElementById('detail-titre').textContent = sanitize(s.titre);

    // Meta info
    document.getElementById('detail-info').innerHTML = `
      <div class="detail-meta mb-3">
        <div class="detail-meta-item">
          <i class="fas fa-calendar-alt"></i>
          <strong>${fmtDate(s.date)}</strong>
        </div>
        <div class="detail-meta-item">
          <i class="fas fa-clock"></i>
          <span>Départ à <strong>${s.heure}</strong></span>
        </div>
        <div class="detail-meta-item">
          <i class="fas fa-user"></i>
          <span>Organisé par <strong>${sanitize(s.organisateur)}</strong></span>
        </div>
        <div class="detail-meta-item">
          <i class="fas fa-motorcycle"></i>
          <span><strong>${s.nb_participants}</strong> / ${s.nb_max_participants} participants</span>
        </div>
      </div>
      ${s.description ? `<hr style="border-color:var(--border)"><p class="text-muted mb-0">${sanitize(s.description)}</p>` : ''}
      ${s.waypoints && s.waypoints.length ? `
        <hr style="border-color:var(--border)">
        <p class="fw-600 mb-2"><i class="fas fa-map-signs text-primary"></i> Parcours (${s.waypoints.length} points)</p>
        ${s.waypoints.map((wp, i) => `
          <div class="wp-item">
            <div class="wp-num ${i === 0 ? 'first' : 'other'}">${i + 1}</div>
            <span>${sanitize(wp.nom || `Point ${i + 1}`)}</span>
            ${wp.is_rassemblement ? '<span class="badge bg-danger ms-auto">Rassemblement</span>' : ''}
          </div>`).join('')}` : ''}
    `;

    // Participants
    document.getElementById('detail-count').textContent = `${s.nb_participants} / ${s.nb_max_participants}`;
    document.getElementById('detail-participants').innerHTML =
      s.participants.length
        ? s.participants.map(p => `
          <div class="participant-row">
            <div class="mini-avatar"><i class="fas fa-user"></i></div>
            <div>
              <strong>${sanitize(p.pseudo)}</strong>
              ${p.moto_marque ? `<div class="text-muted small">${sanitize(p.moto_marque)} ${p.moto_cylindree ? p.moto_cylindree + ' cc' : ''}</div>` : ''}
            </div>
          </div>`).join('')
        : '<p class="text-muted small mb-0">Aucun participant pour l\'instant</p>';

    // Bouton participation
    const btnPart = document.getElementById('btn-participate');
    if (s.isParticipant) {
      btnPart.innerHTML = '<i class="fas fa-times"></i> Annuler ma participation';
      btnPart.className = 'btn btn-outline-danger flex-grow-1';
      btnPart.disabled = false;
    } else if (s.nb_participants >= s.nb_max_participants) {
      btnPart.innerHTML = '<i class="fas fa-lock"></i> Sortie complète';
      btnPart.className = 'btn btn-secondary flex-grow-1';
      btnPart.disabled = true;
    } else {
      btnPart.innerHTML = '<i class="fas fa-motorcycle"></i> Rejoindre la sortie';
      btnPart.className = 'btn btn-primary flex-grow-1';
      btnPart.disabled = false;
    }

    // Bouton suppression (organisateur ou admin)
    const isOwner = currentUser && (currentUser.role === 'admin' || s.organisateur === currentUser.pseudo);
    document.getElementById('btn-delete-sortie').classList.toggle('d-none', !isOwner);

    document.getElementById('detail-loading').classList.add('d-none');
    document.getElementById('detail-content').classList.remove('d-none');

    // Init map
    initDetailMap(s.waypoints);

    // Init chat éphémère
    initChat(id);

    // Partenaires proches du point de rassemblement
    const rally = s.waypoints && s.waypoints.find(w => w.is_rassemblement);
    if (rally) {
      try {
        const nearby = await api(`/partners/nearby?lat=${rally.lat}&lng=${rally.lng}&radius=15`);
        if (nearby && nearby.length && typeof addPartnerMarkersToDetailMap === 'function') {
          addPartnerMarkersToDetailMap(nearby);
        }
      } catch { /* non-bloquant */ }
    }
  } catch (err) {
    document.getElementById('detail-loading').innerHTML =
      `<p class="text-danger">Erreur : ${sanitize(err.message)}</p>`;
  }
}

// ── Participer / quitter ──────────────────────────────────────
async function toggleParticipation() {
  try {
    const data = await api(`/sorties/${currentSortieId}/participate`, 'POST');
    showToast(data.message);
    viewSortie(currentSortieId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Supprimer une sortie ──────────────────────────────────────
async function deleteSortie() {
  if (!confirm('Supprimer définitivement cette sortie ?')) return;
  try {
    await api(`/sorties/${currentSortieId}`, 'DELETE');
    showToast('Sortie supprimée');
    showPage('sorties');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ── Créer une sortie ──────────────────────────────────────────
async function createSortie(e) {
  e.preventDefault();
  const errEl = document.getElementById('sortieError');
  errEl.classList.add('d-none');

  const body = {
    titre:               document.getElementById('sortieTitre').value.trim(),
    description:         document.getElementById('sortieDesc').value.trim(),
    date:                document.getElementById('sortieDate').value,
    heure:               document.getElementById('sortieHeure').value,
    nb_max_participants: parseInt(document.getElementById('sortieMaxParticipants').value, 10) || 20,
    waypoints:           getWaypoints()
  };

  try {
    await api('/sorties', 'POST', body);
    showToast('Sortie publiée ! Les membres ont été notifiés.');
    document.getElementById('sortieForm').reset();
    clearWaypoints();
    showPage('sorties');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('d-none');
  }
}
