const API_BASE = window.ADTRAP_API_URL || 'http://127.0.0.1:5000/api';
let games = [...window.gameDatabase];

const gamesEl = document.querySelector('#games');
const commentsList = document.querySelector('#comments-list');
const commentGame = document.querySelector('#comment-game');
const videoGallery = document.querySelector('#video-gallery');
const tierGroups = {
  total: document.querySelector('#tier-total'),
  clickbait: document.querySelector('#tier-clickbait'),
  partial: document.querySelector('#tier-partial')
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function showView(viewId) {
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === viewId);
  });
  document.querySelectorAll('[data-view-target]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.viewTarget === viewId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `La API respondió con ${response.status}.`);
  }

  return body;
}

async function loadStoredVideos() {
  try {
    const response = await fetch(`${API_BASE}/videos`);
    if (!response.ok) throw new Error(`La API respondió con ${response.status}.`);
    const storedVideos = await response.json();
    const videosByGame = new Map();
    storedVideos.forEach(video => {
      const gameVideos = videosByGame.get(video.game_id) || {};
      gameVideos[video.tipo] = `${API_BASE.replace(/\/api$/, '')}${video.url}`;
      videosByGame.set(video.game_id, gameVideos);
    });
    games = games.map(game => ({
      ...game,
      videos: { ...game.videos, ...(videosByGame.get(game.id) || {}) }
    }));
  } catch (error) {
    console.warn('[AdTrap API] No se pudieron cargar los videos locales:', error);
  }
}

async function cargarComentarios(gameId) {
  if (!gameId) return [];
  return apiRequest(`/comentarios/${encodeURIComponent(gameId)}`);
}

async function enviarComentario(gameId, texto) {
  return apiRequest('/comentarios', {
    method: 'POST',
    body: JSON.stringify({ game_id: gameId, contenido: texto })
  });
}

async function enviarAportacion(data) {
  const extraData = data.datos && typeof data.datos === 'object' ? data.datos : {};
  return apiRequest('/aportaciones', {
    method: 'POST',
    body: JSON.stringify({
      ...extraData,
      nombre_juego: data.nombreJuego || data.nombre_juego,
      desarrollador: data.desarrollador || data.developer || 'Comunidad',
      mecanica_real: data.mecanicaReal || data.mecanica_real
    })
  });
}

window.cargarComentarios = cargarComentarios;
window.enviarComentario = enviarComentario;
window.enviarAportacion = enviarAportacion;

function showApiMessage(message, type = 'error') {
  const target = document.querySelector('#comments-list');
  if (target) {
    target.insertAdjacentHTML('afterbegin',
      `<p class="comments-empty api-message ${type}">${escapeHtml(message)}</p>`);
  }
  console.warn(`[AdTrap API] ${message}`);
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

async function renderComments(gameId = commentGame?.value) {
  if (!commentsList) return;
  commentsList.innerHTML = '<p class="comments-empty">Cargando comentarios...</p>';
  try {
    const comments = await cargarComentarios(gameId);
    commentsList.innerHTML = comments.length
      ? comments.map(comment => `
        <article class="comment">
          <div class="comment-head">
            <strong>Comentario verificado</strong>
            <span class="comment-date">${escapeHtml(new Date(comment.fecha).toLocaleDateString('es-ES'))}</span>
          </div>
          <p>${escapeHtml(comment.contenido)}</p>
        </article>`).join('')
      : '<p class="comments-empty">Todavía no hay comentarios aprobados.</p>';
  } catch (error) {
    commentsList.innerHTML = '<p class="comments-empty api-message error">No podemos cargar comentarios ahora. Inténtalo más tarde.</p>';
    console.warn('[AdTrap API] No se pudieron cargar los comentarios:', error);
  }
}

function videoFrame(game, type, label) {
  const source = game.videos?.[type];
  if (source?.startsWith('assets/') || source?.includes('/media/videos/')) {
    return `<div class="video-link"><video controls preload="metadata" playsinline title="${label} de ${escapeHtml(game.name)}"><source src="${escapeHtml(source)}">Tu navegador no puede reproducir este video.</video><span class="video-label">${label}</span></div>`;
  }
  return source
    ? `<div class="video-link"><iframe src="https://www.youtube.com/embed/${encodeURIComponent(source)}?rel=0" title="${label} de ${escapeHtml(game.name)}" loading="lazy" allow="autoplay; encrypted-media" allowfullscreen></iframe><span class="video-label">${label}</span></div>`
    : `<div class="video-link video-unverified"><div class="video-missing">${type === 'ad' ? '📱 Anuncio' : '🎮 Juego real'}<br><small>Video pendiente</small></div></div>`;
}

function showVideos(game) {
  if (!game) return;
  if (!videoGallery) {
    window.location.href = `videos.html?game=${encodeURIComponent(game.id)}`;
    return;
  }
  videoGallery.classList.remove('empty-gallery');
  videoGallery.innerHTML = `
    <div class="video-gallery-heading">
      <span class="kicker">Comparación activa</span>
      <h3>${escapeHtml(game.name)}</h3>
      <span>📱 Anuncio <b>VS</b> 🎮 Real</span>
    </div>
    <div class="video-grid">${videoFrame(game, 'ad', '📱 ANUNCIO')}${videoFrame(game, 'gameplay', '🎮 JUEGO REAL')}</div>
    <div class="video-verdict"><b>⚡ ¿Coinciden?</b><span>${escapeHtml(game.real)}</span></div>`;
}

function getTier(game) {
  if (game.id === 'homescapes' || game.id === 'royal-match') return 'total';
  if (game.id === 'gardenscapes' || game.id === 'candy-crush-saga') return 'clickbait';
  return 'partial';
}

function renderWall() {
  Object.values(tierGroups).forEach(group => {
    if (group) group.innerHTML = '';
  });
  games.forEach(game => {
    const group = tierGroups[getTier(game)];
    if (!group) return;
    group.insertAdjacentHTML('beforeend', `
      <button class="tier-card" data-tier-game="${escapeHtml(game.id)}" title="Ver videos de ${escapeHtml(game.name)}">
        ${game.image
          ? `<img src="${escapeHtml(game.image)}" alt="${escapeHtml(game.name)}">`
          : `<div class="game-image-placeholder" aria-label="Sin carátula">${escapeHtml(game.name.slice(0, 2).toUpperCase())}</div>`}
        <span>${escapeHtml(game.name)}</span><small>▶ Ver videos</small>
      </button>`);
  });
  document.querySelectorAll('[data-tier-game]').forEach(card => {
    card.addEventListener('click', () => showVideos(games.find(game => game.id === card.dataset.tierGame)));
  });
}

function render(list = games) {
  gamesEl.innerHTML = list.length
    ? list.map(game => `
      <article class="game-card" data-index="${games.indexOf(game)}" tabindex="0" aria-label="Abrir videos de ${escapeHtml(game.name)}">
        <div class="game-image">${gameImage(game)}<span class="status ${game.statusClass}">${escapeHtml(game.status)}</span><span class="tap-hint">Toca para ver</span></div>
        <div class="card-body">
          <div class="card-title"><div><h3>${escapeHtml(game.name)}</h3><span class="rating">${escapeHtml(game.score)}/5</span></div><span class="stars">${escapeHtml(game.stars)}</span></div>
          <div class="compare-mini"><div><b>📱 ANUNCIO</b><span>${escapeHtml(game.promised)}</span></div><div><b>🎮 REAL</b><span>${escapeHtml(game.real)}</span></div></div>
          <button class="details" type="button">Ver en Videos</button>
        </div>
      </article>`).join('')
    : '<p class="empty">No encontramos ese juego.</p>';
}

async function recognizeGameImage(file) {
  const objectUrl = URL.createObjectURL(file);
  const status = document.querySelector('#game-image-match');
  status.textContent = 'Buscando el juego más parecido...';
  status.classList.add('visible');
  const filename = file.name.toLowerCase();
  const filenameMatch = games.find(game => filename.includes(game.id) || filename.includes(game.name.toLowerCase().replaceAll(' ', '-')));
  let match = filenameMatch;
  try {
    if (!match) {
      const uploaded = await loadImage(objectUrl);
      const uploadedVector = imageVector(uploaded);
      const candidates = await Promise.all(games
        .filter(game => game.image?.startsWith('assets/'))
        .map(async game => ({ game, score: vectorSimilarity(uploadedVector, imageVector(await loadImage(game.image))) })));
      match = candidates.sort((first, second) => second.score - first.score)[0]?.game;
    }
    if (!match) throw new Error('No match');
    status.innerHTML = `Juego encontrado: <strong>${escapeHtml(match.name)}</strong>`;
    render([match]);
    document.querySelector('#juegos').scrollIntoView({ behavior: 'smooth' });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

if (gamesEl) {
  gamesEl.addEventListener('click', event => {
    const card = event.target.closest('.game-card');
    if (card) showVideos(games[card.dataset.index]);
  });
  gamesEl.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList.contains('game-card')) {
      event.preventDefault();
      showVideos(games[event.target.dataset.index]);
    }
  });
}

document.querySelectorAll('[data-category]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
    button.classList.add('active');
    render(button.dataset.category === 'all' ? games : games.filter(game => game.category === button.dataset.category));
  });
});

document.querySelector('#search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const query = document.querySelector('#search').value.toLowerCase().trim();
  render(games.filter(game => `${game.name}${game.promised}${game.real}`.toLowerCase().includes(query)));
  showView('games-view');
});

document.querySelector('#game-image-search')?.addEventListener('change', event => {
  const file = event.target.files[0];
  if (file) recognizeGameImage(file).catch(() => {
    const status = document.querySelector('#game-image-match');
    status.textContent = 'No pudimos reconocer esa imagen. Prueba otra portada.';
    status.classList.add('visible');
  });
});

document.querySelector('#share')?.addEventListener('click', () => {
  navigator.clipboard?.writeText(location.href);
  const toast = document.querySelector('#toast');
  toast.textContent = 'Enlace copiado para compartir';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
});

document.querySelector('#contribute-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const name = document.querySelector('#new-game-name').value.trim();
  const real = document.querySelector('#new-game-real').value.trim();
  try {
    await enviarAportacion({ nombreJuego: name, mecanicaReal: real, desarrollador: 'Comunidad' });
    form.reset();
    showToast('Aportación enviada. Quedará pendiente de revisión.');
  } catch (error) {
    showApiMessage('No pudimos enviar la aportación. Comprueba que Flask esté encendido.');
    console.error('[AdTrap API] Error al enviar aportación:', error);
  }
});

document.querySelector('#comment-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const gameId = commentGame.value;
  const name = document.querySelector('#comment-name').value.trim();
  const rating = document.querySelector('#comment-rating').value;
  const text = document.querySelector('#comment-text').value.trim();
  if (!gameId || !name || !text) return;
  try {
    await enviarComentario(gameId, `${name} (${rating}/5): ${text}`);
    form.reset();
    await renderComments(gameId);
    showApiMessage('Comentario enviado y pendiente de moderación.', 'success');
  } catch (error) {
    showApiMessage('No pudimos enviar el comentario. Comprueba que Flask esté encendido.');
    console.error('[AdTrap API] Error al enviar comentario:', error);
  }
});

if (commentGame) {
  commentGame.addEventListener('change', () => renderComments(commentGame.value));
  games.forEach(game => commentGame.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(game.id)}">${escapeHtml(game.name)}</option>`));
  renderComments(games[0]?.id);
}
loadStoredVideos().finally(() => {
  if (gamesEl) render();
  if (tierGroups.total || tierGroups.clickbait || tierGroups.partial) renderWall();
  if (videoGallery) {
    const selectedGame = new URLSearchParams(window.location.search).get('game');
    if (selectedGame) showVideos(games.find(game => game.id === selectedGame));
  }
});

function imageVector(source) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d');
  context.drawImage(source, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  const vector = new Array(64).fill(0);
  for (let index = 0; index < pixels.length; index += 4) {
    const red = Math.floor(pixels[index] / 64);
    const green = Math.floor(pixels[index + 1] / 64);
    const blue = Math.floor(pixels[index + 2] / 64);
    vector[red * 16 + green * 4 + blue]++;
  }
  return vector.map(value => value / 256);
}

function vectorSimilarity(first, second) {
  let dot = 0;
  let firstLength = 0;
  let secondLength = 0;
  first.forEach((value, index) => {
    dot += value * second[index];
    firstLength += value * value;
    secondLength += second[index] * second[index];
  });
  return dot / (Math.sqrt(firstLength) * Math.sqrt(secondLength) || 1);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function gameImage(game) {
  return game.image
    ? `<img src="${escapeHtml(game.image)}" alt="Imagen de ${escapeHtml(game.name)}" loading="lazy">`
    : `<div class="game-image-placeholder" aria-label="Sin imagen">${escapeHtml(game.name.slice(0, 2).toUpperCase())}</div>`;
}
