/**
 * feed.js — Home Feed: load posts, like, comment, edit, delete,
 *           sidebar profile, discover people, and search.
 */

/* ── State ─────────────────────────────────────────────── */
let currentUser    = null;
let activePostId   = null;   // post currently open in comment modal
let editingPostId  = null;   // post being edited

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await authCheck();
  setupLogout();
  await loadSidebarProfile();
  await loadFeed();
  await loadDiscoverPeople();
  setupSearch();
});

/* ── Auth Guard ─────────────────────────────────────────── */
async function authCheck() {
  try {
    const res  = await apiFetch('/api/auth/me');
    const data = await res.json();
    if (!data.success) {
      window.location.replace('login.html');
      return;
    }
    currentUser = data.user;
    setNavAvatar(currentUser);
  } catch (e) {
    console.error('[Feed] Auth check failed:', e.message);
    window.location.replace('login.html');
  }
}

/* ── Logout ─────────────────────────────────────────────── */
function setupLogout() {
  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('ss_authenticated');
    window.location.href = 'login.html';
  });
}

/* ── Sidebar Profile ────────────────────────────────────── */
async function loadSidebarProfile() {
  const res  = await apiFetch(`/api/users/${currentUser.id}`);
  const data = await res.json();
  if (!data.success) return;
  const u = data.user;

  document.getElementById('sidebarProfile').innerHTML = `
    <div class="sidebar-user-card">
      <a href="profile.html" class="sub-avatar">
        ${avatarHTML(u, 48)}
      </a>
      <div>
        <div class="sub-name">${escHtml(u.name)}</div>
        <div class="sub-username">@${escHtml(u.username)}</div>
      </div>
    </div>
    <div style="display:flex;gap:16px;justify-content:center;font-size:13px;">
      <div style="text-align:center;">
        <strong>${u.posts_count}</strong><div style="color:var(--text-muted);font-size:11px;">Posts</div>
      </div>
      <div style="text-align:center;">
        <strong>${u.followers_count}</strong><div style="color:var(--text-muted);font-size:11px;">Followers</div>
      </div>
      <div style="text-align:center;">
        <strong>${u.following_count}</strong><div style="color:var(--text-muted);font-size:11px;">Following</div>
      </div>
    </div>
  `;

  // Also update cp-avatar (quick post card)
  const cpAvatar = document.getElementById('cpAvatar');
  if (cpAvatar) cpAvatar.innerHTML = avatarHTML(u, 42);
}

/* ── Load Feed ──────────────────────────────────────────── */
async function loadFeed() {
  try {
    const res  = await apiFetch('/api/posts');
    const data = await res.json();
    const container = document.getElementById('feedContainer');

    if (!data.success) { container.innerHTML = emptyState('⚠️', 'Could not load feed.', ''); return; }
    if (data.posts.length === 0) {
      container.innerHTML = emptyState('🌱', 'No posts yet!', 'Follow some people or create your first post.');
      return;
    }

    container.innerHTML = data.posts.map(p => postCardHTML(p)).join('');
  } catch {
    document.getElementById('feedContainer').innerHTML = emptyState('⚠️', 'Network error.', 'Please refresh.');
  }
}

/* ── Post Card HTML ─────────────────────────────────────── */
function postCardHTML(p) {
  const isOwn = currentUser && p.user_id === currentUser.id;
  const menuHTML = isOwn ? `
    <div class="post-menu-wrapper">
      <button class="post-menu-btn" onclick="togglePostMenu(event, ${p.id})">⋯</button>
      <div class="post-dropdown hidden" id="menu-${p.id}">
        <div class="post-dropdown-item" onclick="openEditModal(${p.id}, ${JSON.stringify(escHtml(p.content))})">✏️ Edit</div>
        <div class="post-dropdown-item danger" onclick="deletePost(${p.id})">🗑️ Delete</div>
      </div>
    </div>` : '';

  const imageHTML = p.image ? `<img src="${p.image}" alt="Post image" class="post-image" onclick="openImageLightbox(this.src)" />` : '';

  return `
    <div class="post-card" id="post-${p.id}">
      <div class="post-header">
        <div class="post-avatar" onclick="visitProfile('${p.user_id}')">
          ${avatarHTML(p, 42)}
        </div>
        <div class="post-author">
          <div class="post-author-name" onclick="visitProfile('${p.user_id}')">${escHtml(p.name)}</div>
          <div class="post-author-handle">@${escHtml(p.username)} · <span class="post-timestamp">${timeAgo(p.created_at)}</span></div>
        </div>
        ${menuHTML}
      </div>
      <div class="post-content">${escHtml(p.content)}</div>
      ${imageHTML}
      <div class="post-actions">
        <button class="post-action-btn like-btn ${p.liked_by_me ? 'liked' : ''}"
          id="like-btn-${p.id}" onclick="toggleLike(${p.id}, ${p.liked_by_me})">
          <span class="like-heart">${p.liked_by_me ? '❤️' : '🤍'}</span>
          <span class="action-count" id="like-count-${p.id}">${p.like_count}</span>
        </button>
        <button class="post-action-btn comment-btn" onclick="openCommentModal(${p.id})">
          💬 <span class="action-count" id="comment-count-${p.id}">${p.comment_count}</span>
        </button>
      </div>
    </div>`;
}

/* ── Like/Unlike ─────────────────────────────────────────── */
async function toggleLike(postId, currentlyLiked) {
  const method  = currentlyLiked ? 'DELETE' : 'POST';
  const res     = await apiFetch('/api/like', { method, body: JSON.stringify({ post_id: postId }) });
  const data    = await res.json();
  if (!data.success) return;

  const btn        = document.getElementById(`like-btn-${postId}`);
  const countEl    = document.getElementById(`like-count-${postId}`);
  const heartEl    = btn ? btn.querySelector('.like-heart') : null;

  if (data.liked) {
    btn.classList.add('liked');
    btn.setAttribute('onclick', `toggleLike(${postId}, true)`);
    if (heartEl) heartEl.textContent = '❤️';
  } else {
    btn.classList.remove('liked');
    btn.setAttribute('onclick', `toggleLike(${postId}, false)`);
    if (heartEl) heartEl.textContent = '🤍';
  }
  if (countEl) countEl.textContent = data.like_count;
}

/* ── Comments ────────────────────────────────────────────── */
async function openCommentModal(postId) {
  activePostId = postId;
  document.getElementById('commentModal').classList.remove('hidden');

  // Set avatar
  const ca = document.getElementById('commentAvatar');
  if (ca && currentUser) ca.innerHTML = avatarHTML(currentUser, 34);

  await loadComments(postId);

  // Setup submit button
  document.getElementById('submitComment').onclick = () => submitComment(postId);
  document.getElementById('commentText').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(postId); }
  });
}

function closeCommentModal() {
  document.getElementById('commentModal').classList.add('hidden');
  activePostId = null;
}

async function loadComments(postId) {
  const list = document.getElementById('commentsList');
  list.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';

  const res  = await apiFetch(`/api/comments/${postId}`);
  const data = await res.json();

  if (!data.success || data.comments.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-icon">💬</div><p>No comments yet. Be the first!</p></div>';
    return;
  }

  list.innerHTML = data.comments.map(c => commentItemHTML(c)).join('');
}

function commentItemHTML(c) {
  const isOwn = currentUser && c.user_id === currentUser.id;
  const actions = isOwn ? `
    <span class="comment-action" onclick="deleteComment(${c.id}, ${c.post_id})">Delete</span>
  ` : '';

  return `
    <div class="comment-item" id="comment-${c.id}">
      <div class="comment-avatar">${avatarHTML(c, 34)}</div>
      <div class="comment-bubble">
        <div class="comment-author">${escHtml(c.name)}</div>
        <div class="comment-text">${escHtml(c.comment)}</div>
        <div class="comment-meta">
          <span>${timeAgo(c.created_at)}</span>
          ${actions}
        </div>
      </div>
    </div>`;
}

async function submitComment(postId) {
  const textarea = document.getElementById('commentText');
  const comment  = textarea.value.trim();
  if (!comment) return;

  const res  = await apiFetch('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, comment }),
  });
  const data = await res.json();
  if (!data.success) { showToast(data.message || 'Error posting comment.', 'error'); return; }

  textarea.value = '';
  await loadComments(postId);

  // Update comment count on card
  const countEl = document.getElementById(`comment-count-${postId}`);
  if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
}

async function deleteComment(commentId, postId) {
  if (!confirm('Delete this comment?')) return;
  const res  = await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    await loadComments(postId);
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
  }
}

/* ── Post Menu ───────────────────────────────────────────── */
function togglePostMenu(e, postId) {
  e.stopPropagation();
  // Close all open menus
  document.querySelectorAll('.post-dropdown').forEach(d => {
    if (d.id !== `menu-${postId}`) d.classList.add('hidden');
  });
  document.getElementById(`menu-${postId}`).classList.toggle('hidden');

  // Close on outside click
  document.addEventListener('click', closeAllMenus, { once: true });
}
function closeAllMenus() {
  document.querySelectorAll('.post-dropdown').forEach(d => d.classList.add('hidden'));
}

/* ── Edit Post ───────────────────────────────────────────── */
function openEditModal(postId, content) {
  closeAllMenus();
  editingPostId = postId;
  document.getElementById('editPostContent').value = content;
  document.getElementById('editPostModal').classList.remove('hidden');
  document.getElementById('saveEditPost').onclick = saveEditPost;
}
function closeEditModal() {
  document.getElementById('editPostModal').classList.add('hidden');
  editingPostId = null;
}
async function saveEditPost() {
  const content = document.getElementById('editPostContent').value.trim();
  if (!content) return;

  const res  = await apiFetch(`/api/posts/${editingPostId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  const data = await res.json();
  if (data.success) {
    showToast('Post updated!', 'success');
    closeEditModal();
    await loadFeed();
  } else {
    showToast(data.message || 'Update failed.', 'error');
  }
}

/* ── Delete Post ─────────────────────────────────────────── */
async function deletePost(postId) {
  closeAllMenus();
  if (!confirm('Delete this post permanently?')) return;
  const res  = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    showToast('Post deleted.', 'success');
    const el = document.getElementById(`post-${postId}`);
    if (el) el.remove();
  } else {
    showToast(data.message || 'Could not delete.', 'error');
  }
}

/* ── Discover People ─────────────────────────────────────── */
async function loadDiscoverPeople() {
  const res  = await apiFetch('/api/users');
  const data = await res.json();
  const container = document.getElementById('discoverPeople');

  if (!data.success || data.users.length === 0) {
    container.innerHTML = '<p class="text-muted text-sm">No users to discover yet.</p>';
    return;
  }

  // Show up to 5
  container.innerHTML = data.users.slice(0, 5).map(u => `
    <div class="discover-item">
      <div class="discover-avatar" onclick="visitProfile('${u.id}')">${avatarHTML(u, 38)}</div>
      <div class="discover-info">
        <div class="discover-name" onclick="visitProfile('${u.id}')">${escHtml(u.name)}</div>
        <div class="discover-username">@${escHtml(u.username)}</div>
      </div>
      <button class="discover-follow-btn ${u.is_following ? 'following' : 'follow'}"
        id="follow-btn-${u.id}"
        onclick="toggleFollow('${u.id}', ${u.is_following})">
        ${u.is_following ? 'Following' : 'Follow'}
      </button>
    </div>
  `).join('');
}

async function toggleFollow(userId, currentlyFollowing) {
  const btn = document.getElementById(`follow-btn-${userId}`);
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  try {
    const method = currentlyFollowing ? 'DELETE' : 'POST';
    const res    = await apiFetch('/api/follow', { method, body: JSON.stringify({ following_id: userId }) });
    const data   = await res.json();

    if (!data.success) {
      showToast(data.message || 'Could not update follow status.', 'error');
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      return;
    }

    // Re-render the entire discover list so all buttons reflect fresh state
    await loadDiscoverPeople();
    showToast(data.following ? 'Following!' : 'Unfollowed', 'success');
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
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

  // Close on click outside
  document.addEventListener('click', e => {
    if (!input.contains(e.target)) results.classList.add('hidden');
  });
}

async function searchUsers(query) {
  const results = document.getElementById('searchResults');
  const res     = await apiFetch('/api/users');
  const data    = await res.json();
  if (!data.success) return;

  const filtered = data.users.filter(u =>
    u.name.toLowerCase().includes(query.toLowerCase()) ||
    u.username.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  if (filtered.length === 0) {
    results.innerHTML = '<div style="padding:14px;text-align:center;color:var(--text-muted);font-size:13px;">No users found.</div>';
  } else {
    results.innerHTML = filtered.map(u => `
      <div class="search-result-item" onclick="visitProfile('${u.id}')">
        <div class="search-result-avatar">${avatarHTML(u, 36)}</div>
        <div>
          <div style="font-size:14px;font-weight:600;">${escHtml(u.name)}</div>
          <div style="font-size:12px;color:var(--text-muted);">@${escHtml(u.username)}</div>
        </div>
      </div>
    `).join('');
  }
  results.classList.remove('hidden');
}

/* ── Visit Profile ───────────────────────────────────────── */
function visitProfile(userId) {
  window.location.href = `/profile.html?id=${encodeURIComponent(userId)}`;
}

/* ── Image Lightbox ──────────────────────────────────────── */
function openImageLightbox(src) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
  const img = document.createElement('img');
  img.src = src;
  img.style.cssText = 'max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;';
  overlay.appendChild(img);
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

/* ── Utilities ───────────────────────────────────────────── */

/**
 * Generic API fetch helper — always includes credentials.
 * Merges headers safely so Content-Type is never accidentally dropped.
 */
function apiFetch(url, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  return fetch((window.API_BASE || '') + url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    ...rest,
  });
}

/**
 * Set the nav avatar from user data.
 */
function setNavAvatar(user) {
  const el = document.getElementById('navAvatar');
  if (!el) return;
  if (user.profile_image) {
    el.style.backgroundImage = `url(${user.profile_image})`;
    el.style.backgroundSize  = 'cover';
    el.style.backgroundPosition = 'center';
    el.innerHTML = '';
  } else {
    el.textContent = (user.name || '?')[0].toUpperCase();
  }
}

/**
 * Build an avatar HTML snippet.
 * The object must have name and optionally profile_image.
 */
function avatarHTML(obj, size = 42) {
  if (obj.profile_image) {
    return `<img src="${obj.profile_image}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  }
  return `<span style="font-size:${Math.round(size * 0.38)}px;">${(obj.name || '?')[0].toUpperCase()}</span>`;
}

/**
 * HTML-escape a string.
 */
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Convert a datetime string to a human-readable "time ago" format.
 */
function timeAgo(dateStr) {
  const now  = new Date();
  const then = new Date(dateStr.includes('T') ? dateStr : dateStr + 'Z');
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60)     return 'just now';
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Render an empty-state block.
 */
function emptyState(icon, title, subtitle) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${subtitle}</p></div>`;
}

/**
 * Show a toast notification.
 */
function showToast(msg, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}
