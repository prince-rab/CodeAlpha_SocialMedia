/**
 * post.js — Create Post page.
 * Handles form submission, image preview, and char counter.
 */

/* ── State ─────────────────────────────────────────────── */
let currentUser = null;

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await authCheck();
  setupLogout();
  setupSearch();
  setupForm();
});

/* ── Auth Guard ─────────────────────────────────────────── */
async function authCheck() {
  try {
    const res  = await fetch((window.API_BASE || '') + '/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (!data.success) { window.location.href = 'login.html'; return; }
    currentUser = data.user;

    // Set nav avatar
    setNavAvatar(currentUser);

    // Set author info
    const nameEl   = document.getElementById('postAuthorName');
    const handleEl = document.getElementById('postAuthorHandle');
    const avatarEl = document.getElementById('postAuthorAvatar');
    if (nameEl)   nameEl.textContent   = currentUser.name;
    if (handleEl) handleEl.textContent = `@${currentUser.username}`;
    if (avatarEl) avatarEl.innerHTML   = avatarHTML(currentUser, 46);
  } catch { window.location.href = 'login.html'; }
}

/* ── Logout ─────────────────────────────────────────────── */
function setupLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', async () => {
    await fetch((window.API_BASE || '') + '/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('ss_authenticated');
    window.location.href = 'login.html';
  });
}

/* ── Form Setup ─────────────────────────────────────────── */
function setupForm() {
  const textarea    = document.getElementById('postContent');
  const charCount   = document.getElementById('postCharCount');
  const imageInput  = document.getElementById('postImage');
  const removeBtn   = document.getElementById('removeImageBtn');
  const previewWrap = document.getElementById('imagePreviewContainer');
  const previewImg  = document.getElementById('imagePreview');
  const uploadArea  = document.getElementById('imageUploadArea');

  // Char counter
  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });
  }

  // Image preview
  if (imageInput) {
    imageInput.addEventListener('change', () => {
      const file = imageInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        previewImg.src = e.target.result;
        previewWrap.classList.remove('hidden');
        uploadArea.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  // Remove image
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      imageInput.value = '';
      previewImg.src   = '';
      previewWrap.classList.add('hidden');
      uploadArea.classList.remove('hidden');
    });
  }

  // Form submit
  const form = document.getElementById('createPostForm');
  if (form) form.addEventListener('submit', submitPost);
}

/* ── Submit Post ─────────────────────────────────────────── */
async function submitPost(e) {
  e.preventDefault();
  hideAlert();

  const textarea   = document.getElementById('postContent');
  const imageInput = document.getElementById('postImage');
  const content    = textarea.value.trim();

  if (!content) {
    showAlert('Please write something before posting.', 'error');
    return;
  }

  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('content', content);
    if (imageInput && imageInput.files[0]) {
      formData.append('image', imageInput.files[0]);
    }

    const res = await fetch('/api/posts', {
      method: 'POST',
      credentials: 'include',
      body: formData,
      // No Content-Type header — let browser set multipart boundary
    });
    const data = await res.json();

    if (data.success) {
      showAlert('Post shared successfully! Redirecting…', 'success');
      setTimeout(() => { window.location.href = 'feed.html'; }, 900);
    } else {
      const msg = data.errors ? data.errors.map(e => e.msg).join(' ') : data.message;
      showAlert(msg || 'Could not create post.', 'error');
      setLoading(false);
    }
  } catch {
    showAlert('Network error. Please try again.', 'error');
    setLoading(false);
  }
}

/* ── Search ──────────────────────────────────────────────── */
function setupSearch() {
  const input   = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (!q) { results.classList.add('hidden'); return; }
    debounceTimer = setTimeout(() => searchUsers(q), 280);
  });
  document.addEventListener('click', e => {
    if (!input.contains(e.target)) results.classList.add('hidden');
  });
}

async function searchUsers(query) {
  const results = document.getElementById('searchResults');
  const res     = await fetch((window.API_BASE || '') + '/api/users', { credentials: 'include' });
  const data    = await res.json();
  if (!data.success) return;

  const filtered = data.users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase()) ||
    u.username.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  results.innerHTML = filtered.length === 0
    ? '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">No users found.</div>'
    : filtered.map(u => `
        <div class="search-result-item" onclick="window.location.href='profile.html?id=${encodeURIComponent(u.id)}'">
          <div class="search-result-avatar">${avatarHTML(u, 36)}</div>
          <div>
            <div style="font-size:14px;font-weight:600;">${escHtml(u.name)}</div>
            <div style="font-size:12px;color:var(--text-muted);">@${escHtml(u.username)}</div>
          </div>
        </div>`).join('');
  results.classList.remove('hidden');
}

/* ── Utilities ───────────────────────────────────────────── */
function setLoading(loading) {
  const btn     = document.getElementById('submitPostBtn');
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled  = loading;
  text.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

function showAlert(msg, type = 'error') {
  const el = document.getElementById('createAlert');
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideAlert() {
  document.getElementById('createAlert').classList.add('hidden');
}

function setNavAvatar(user) {
  const el = document.getElementById('navAvatar');
  if (!el) return;
  if (user.profile_image) {
    el.style.backgroundImage    = `url(${user.profile_image})`;
    el.style.backgroundSize     = 'cover';
    el.style.backgroundPosition = 'center';
    el.innerHTML = '';
  } else {
    el.textContent = (user.name || '?')[0].toUpperCase();
  }
}

function avatarHTML(obj, size = 42) {
  if (obj.profile_image) {
    return `<img src="${obj.profile_image}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  }
  return `<span style="font-size:${Math.round(size * 0.38)}px;">${(obj.name || '?')[0].toUpperCase()}</span>`;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
