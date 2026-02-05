const main = document.getElementById('main');
const message = document.getElementById('message');
const loginEl = document.getElementById('login');
const logoutForm = document.getElementById('logout');
const usernameEl = document.getElementById('username');
const pinsSection = document.getElementById('pins-section');
const pinsEl = document.getElementById('pins');
const createSection = document.getElementById('create-section');
const createForm = document.getElementById('create-pin');
const boardSelect = document.getElementById('create-pin')?.querySelector('[name=board_id]');
const createStatus = document.getElementById('create-status');

function showMessage(text) {
  message.textContent = text;
  message.classList.remove('hidden');
}

function hideMessage() {
  message.classList.add('hidden');
}

async function api(path, options = {}) {
  const r = await fetch(path, { credentials: 'include', ...options });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.message || data.error || r.statusText);
  return data;
}

async function loadUser() {
  try {
    const user = await api('/api/me');
    loginEl.style.display = 'none';
    logoutForm.style.display = 'block';
    usernameEl.textContent = user.username || user.id || 'Logged in';
    hideMessage();
    pinsSection.classList.remove('hidden');
    createSection.classList.remove('hidden');
    loadBoards();
    loadPins();
  } catch {
    loginEl.style.display = 'block';
    logoutForm.style.display = 'none';
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'auth') showMessage('Authentication was cancelled or invalid.');
    else if (params.get('error') === 'token') showMessage('Failed to get access token. Check app credentials.');
    else showMessage('Log in to view and post pins.');
    pinsSection.classList.add('hidden');
    createSection.classList.add('hidden');
  }
}

async function loadBoards() {
  if (!boardSelect) return;
  try {
    const data = await api('/api/boards?page_size=100');
    const list = data.items || [];
    boardSelect.innerHTML = '<option value="">Select a board</option>' +
      list.map(b => `<option value="${b.id}">${escapeHtml(b.name || b.id)}</option>`).join('');
  } catch (e) {
    boardSelect.innerHTML = '<option value="">Failed to load boards</option>';
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function loadPins() {
  try {
    const data = await api('/api/pins?page_size=25');
    const list = data.items || [];
    if (list.length === 0) {
      pinsEl.innerHTML = '<p>No pins yet.</p>';
      return;
    }
    pinsEl.innerHTML = list.map(p => {
      const img = (p.media?.images && (p.media.images['736x'] || Object.values(p.media.images)[0]))?.url || '';
      const title = (p.title || '').slice(0, 80);
      return `<div class="pin"><img src="${escapeHtml(img)}" alt=""><div class="title">${escapeHtml(title)}</div></div>`;
    }).join('');
  } catch (e) {
    pinsEl.innerHTML = '<p>Could not load pins.</p>';
  }
}

createForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  createStatus.textContent = '';
  createStatus.className = '';
  const fd = new FormData(createForm);
  const board_id = fd.get('board_id');
  const image_url = fd.get('image_url');
  if (!board_id || !image_url) {
    createStatus.textContent = 'Board and image URL are required.';
    createStatus.className = 'error';
    return;
  }
  try {
    await api('/api/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id,
        media_source: { source_type: 'image_url', url: image_url },
        title: fd.get('title') || undefined,
        description: fd.get('description') || undefined,
        link: fd.get('link') || undefined,
      }),
    });
    createStatus.textContent = 'Pin created.';
    createStatus.className = 'ok';
    createForm.reset();
    loadPins();
  } catch (err) {
    createStatus.textContent = err.message || 'Failed to create pin.';
    createStatus.className = 'error';
  }
});

loadUser();
