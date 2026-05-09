const API = window.API_BASE;
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');

// ---------- AUTH UI ----------
function renderAuth() {
  const area = document.getElementById('auth-area');
  if (user) {
    const badge = `<span class="role-badge ${user.role}">${user.role}</span>`;
    const upgradeBtn = user.role === 'consumer'
      ? `<button class="secondary" onclick="upgradeToCreator()" title="Dev only: become a creator to test uploads">Become Creator</button>`
      : '';
    area.innerHTML = `
      <span>Hi, <strong>${escapeHtml(user.displayName || user.email)}</strong> ${badge}</span>
      ${upgradeBtn}
      <button class="secondary" onclick="logout()">Logout</button>`;
    document.getElementById('upload-section').style.display = user.role === 'creator' ? 'block' : 'none';
  } else {
    area.innerHTML = `
      <button onclick="showLogin()">Login</button>
      <button class="secondary" onclick="showRegister()">Register</button>`;
    document.getElementById('upload-section').style.display = 'none';
  }
}

function logout() {
  token = null; user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  renderAuth();
}

async function showLogin() {
  const email = prompt('Email:'); if (!email) return;
  const password = prompt('Password:'); if (!password) return;
  try {
    const r = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const d = await r.json();
    if (r.ok && d.token) {
      token = d.token; user = d.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      renderAuth();
      alert('Logged in!');
    } else alert(d.error || 'Login failed');
  } catch (e) { alert('Login error: ' + e.message); }
}

async function showRegister() {
  const email = prompt('Email:'); if (!email) return;
  const password = prompt('Password (min 6 chars):'); if (!password) return;
  const displayName = prompt('Display name:');
  try {
    const r = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName })
    });
    const d = await r.json();
    if (r.ok && d.token) {
      token = d.token; user = d.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      renderAuth();
      alert('Registered & logged in as consumer!');
    } else alert(d.error || 'Register failed');
  } catch (e) { alert('Register error: ' + e.message); }
}

// ---------- FEED ----------
async function loadFeed(search = '') {
  try {
    const url = search ? `${API}/photos?search=${encodeURIComponent(search)}` : `${API}/photos`;
    const res = await fetch(url);
    const photos = await res.json();
    const feed = document.getElementById('feed');
    document.getElementById('feed-title').textContent = search ? `Search results for "${search}"` : 'Feed';
    if (photos.length === 0) {
      feed.innerHTML = `<p style="color:#888; padding:2rem;">No photos yet. ${user?.role === 'creator' ? 'Upload one above!' : 'Login as a creator to upload.'}</p>`;
      return;
    }
    feed.innerHTML = photos.map(p => `
      <div class="photo-card" onclick="openPhoto('${p.id}')">
        <img src="${p.url}" alt="${escapeHtml(p.title)}" loading="lazy">
        <div class="photo-meta">
          <h3>${escapeHtml(p.title)}</h3>
          <div class="muted">${escapeHtml(p.location || 'No location')}</div>
          <div class="tags">${(p.autoTags || []).slice(0, 4).map(t => '#' + t.name).join(' ')}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('feed').innerHTML = `<p class="error">Error loading feed: ${e.message}</p>`;
  }
}

async function openPhoto(id) {
  try {
    const res = await fetch(`${API}/photos/${id}`);
    const p = await res.json();
    const commentsRes = await fetch(`${API}/comments/${id}`);
    const comments = await commentsRes.json();

    const avgRating = p.ratingCount ? (p.ratingSum / p.ratingCount).toFixed(1) : 'No ratings yet';

    document.getElementById('modal-body').innerHTML = `
      <img src="${p.url}" alt="${escapeHtml(p.title)}">
      <h2>${escapeHtml(p.title)}</h2>
      <p>${escapeHtml(p.caption || '')}</p>
      <p><strong>📍 Location:</strong> ${escapeHtml(p.location || 'N/A')}</p>
      <p><strong>👥 People:</strong> ${(p.people || []).join(', ') || 'N/A'}</p>
      <p><strong>🤖 AI caption:</strong> <em>${escapeHtml(p.autoCaption || 'N/A')}</em></p>
      <p><strong>🏷️ AI tags:</strong> ${(p.autoTags || []).map(t => '#' + t.name).join(' ')}</p>
      <p><strong>⭐ Average rating:</strong> ${avgRating} (${p.ratingCount || 0} ratings)</p>
      ${user ? `
        <div class="rating-buttons">
          Rate: ${[1,2,3,4,5].map(n => `<button onclick="rate('${id}', ${n})">${n}⭐</button>`).join('')}
        </div>
      ` : ''}
      <h3>Comments (${comments.length})</h3>
      <div id="comment-list">
        ${comments.map(c => `
          <div class="comment">
            <strong>${escapeHtml(c.userEmail)}:</strong> ${escapeHtml(c.text)}
          </div>
        `).join('') || '<p style="color:#888">No comments yet.</p>'}
      </div>
      ${user ? `
        <form id="comment-form" onsubmit="addComment(event, '${id}')" style="margin-top:1rem">
          <input id="comment-text" placeholder="Add a comment..." required>
          <button type="submit">Post comment</button>
        </form>
      ` : '<p style="color:#888"><em>Login to comment</em></p>'}
    `;
    document.getElementById('modal').classList.remove('hidden');
  } catch (e) {
    alert('Failed to load photo: ' + e.message);
  }
}

async function rate(id, n) {
  try {
    await fetch(`${API}/photos/${id}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ rating: n })
    });
    openPhoto(id);
  } catch (e) { alert('Rate failed: ' + e.message); }
}

async function addComment(e, id) {
  e.preventDefault();
  const text = document.getElementById('comment-text').value;
  try {
    await fetch(`${API}/comments/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });
    openPhoto(id);
  } catch (err) { alert('Comment failed: ' + err.message); }
}

// ---------- UPLOAD ----------
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append('image', document.getElementById('image-file').files[0]);
  fd.append('title', document.getElementById('title').value);
  fd.append('caption', document.getElementById('caption').value);
  fd.append('location', document.getElementById('location').value);
  fd.append('people', document.getElementById('people').value);

  try {
    const res = await fetch(`${API}/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd
    });
    if (res.ok) {
      e.target.reset();
      loadFeed();
      alert('Photo uploaded!');
    } else {
      const d = await res.json();
      alert(d.error || 'Upload failed');
    }
  } catch (err) { alert('Upload error: ' + err.message); }
});

// ---------- SEARCH ----------
document.getElementById('search-btn').addEventListener('click', () => {
  loadFeed(document.getElementById('search-box').value);
});
document.getElementById('clear-btn').addEventListener('click', () => {
  document.getElementById('search-box').value = '';
  loadFeed();
});
document.getElementById('search-box').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') loadFeed(document.getElementById('search-box').value);
});

// ---------- MODAL ----------
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.add('hidden');
});
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') document.getElementById('modal').classList.add('hidden');
});

// ---------- UTIL ----------
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ---------- INIT ----------
async function upgradeToCreator() {
  if (!confirm('Upgrade this account to Creator role? (For testing only)')) return;
  try {
    const r = await fetch(`${API}/auth/dev-upgrade-to-creator`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    if (r.ok) {
      token = d.token; user = d.user;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      renderAuth();
      alert('You are now a creator! Upload form should be visible.');
    } else {
      alert(d.error || 'Upgrade failed');
    }
  } catch (e) { alert('Error: ' + e.message); }
}

renderAuth();
loadFeed();