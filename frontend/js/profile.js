/**
 * profile.js — User profile page: own profile or other user's profile.
 * Handles: load profile, tabs (posts/followers/following),
 *          follow/unfollow, edit profile, post actions.
 */

/* ── State ─────────────────────────────────────────────── */
let currentUser   = null;
let profileUser   = null;     // the user whose profile is displayed
let profileUserId = null;
let editingPostId = null;
let activePostId  = null;

/* ── Init ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await authCheck();
  setupLogout();
  setupSearch();
  setupTabs();

  // Determine which profile to show
  const params    = new URLSearchParams(window.location.search);
  const requestId = params.get('id');
  profileUserId   = requestId || currentUser.id;

  await loadProfile(profileUserId);
  await loadUserPosts(profileUserId);
});

/* ── Auth Guard ─────────────────────────────────────────── */
async function authCheck() {
  try {
    const res  = await apiFetch('/api/auth/me');
    const data = await res.json();
    if (!data.success) { window.location.replace('login.html'); return; }
    currentUser = data.user;
    setNavAvatar(currentUser);
  } catch (e) {
    console.error('[Profile] Auth check failed:', e.message);
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

/* ── Load Profile ────────────────────────────────────────── */
async function loadProfile(userId) {
  const res  = await apiFetch(`/api/users/${userId}`);
  const data = await res.json();
  if (!data.success) { alert('User not found.'); window.location.href = 'feed.html'; return; }

  profileUser = data.user;
  renderProfileHeader(profileUser);
}

function renderProfileHeader(u) {
  document.title = `${u.name} (@${u.username}) — SocialSphere`;

  // Avatar
  const avatarEl      = document.getElementById('profileAvatar');
  const placeholderEl = document.getElementById('avatarPlaceholder');
  if (u.profile_image) {
    avatarEl.src = u.profile_image;
    avatarEl.classList.remove('hidden');
    placeholderEl.classList.add('hidden');
  } else {
    avatarEl.classList.add('hidden');
    placeholderEl.textContent = (u.name || '?')[0].toUpperCase();
    placeholderEl.classList.remove('hidden');
  }

  document.getElementById('profileName').textContent     = u.name;
  document.getElementById('profileUsername').textContent = `@${u.username}`;
  document.getElementById('profileBio').textContent      = u.bio || '';

  // Stats
  document.getElementById('statPosts').innerHTML     = `<strong>${u.posts_count}</strong><span>Posts</span>`;
  document.getElementById('statFollowers').innerHTML = `<strong>${u.followers_count}</strong><span>Followers</span>`;
  document.getElementById('statFollowing').innerHTML = `<strong>${u.following_count}</strong><span>Following</span>`;

  // Actions
  const actionsEl = document.getElementById('profileActions');
  const isOwnProfile = currentUser && u.id === currentUser.id;

  if (isOwnProfile) {
    actionsEl.innerHTML = `
      <button class="btn btn-outline" onclick="openEditProfileModal()">✏️ Edit Profile</button>
    `;
  } else {
    actionsEl.innerHTML = `
      <button class="btn ${u.is_following ? 'btn-ghost' : 'btn-primary'}"
        id="followProfileBtn"
        onclick="toggleFollow('${u.id}', ${u.is_following})">
        ${u.is_following ? 'Following' : '+ Follow'}
      </button>
    `;
  }
}

/* ── Follow/Unfollow ─────────────────────────────────────── */
async function toggleFollow(userId, currentlyFollowing) {
  const btn = document.getElementById('followProfileBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  try {
    const method = currentlyFollowing ? 'DELETE' : 'POST';
    const res    = await apiFetch('/api/follow', { method, body: JSON.stringify({ following_id: userId }) });
    const data   = await res.json();

    if (!data.success) {
      showToast(data.message || 'Could not update follow status.', 'error');
      return;
    }

    if (btn) {
      if (data.following) {
        btn.textContent = 'Following';
        btn.className   = 'btn btn-ghost';
        btn.setAttribute('onclick', `toggleFollow('${userId}', true)`);
      } else {
        btn.textContent = '+ Follow';
        btn.className   = 'btn btn-primary';
        btn.setAttribute('onclick', `toggleFollow('${userId}', false)`);
      }
    }

    // Refresh followers count
    const followersStat = document.getElementById('statFollowers');
    if (followersStat) followersStat.innerHTML = `<strong>${data.followers_count}</strong><span>Followers</span>`;

    showToast(data.following ? 'Following!' : 'Unfollowed', 'success');
  } catch (err) {
    showToast('Network error. Please try again.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

/* ── Tabs ────────────────────────────────────────────────── */
function setupTabs() {
  document.querySelectorAll('.ptab').forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;

      document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => { p.classList.remove('active'); p.classList.add('hidden'); });

      tab.classList.add('active');
      const panel = document.getElementById(`tab-${name}`);
      panel.classList.remove('hidden');
      panel.classList.add('active');

      // Lazy-load
      if (name === 'followers' && !document.getElementById('followersList').dataset.loaded) {
        loadFollowers(profileUserId);
      }
      if (name === 'following' && !document.getElementById('followingList').dataset.loaded) {
        loadFollowing(profileUserId);
      }
    });
  });
}

/* ── Load User Posts ─────────────────────────────────────── */
async function loadUserPosts(userId) {
  const res  = await apiFetch(`/api/posts/user/${userId}`);
  const data = await res.json();
  const container = document.getElementById('userPostsContainer');

  if (!data.success) { container.innerHTML = emptyState('⚠️', 'Could not load posts.', ''); return; }
  if (data.posts.length === 0) {
    container.innerHTML = emptyState('📝', 'No posts yet.', 'Share your first post!');
    return;
  }

  container.innerHTML = data.posts.map(p => postCardHTML(p)).join('');
}

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
        <div class="post-avatar" onclick="window.location.href='profile.html?id=${encodeURIComponent(p.user_id)}'" style="cursor:pointer;">
          ${avatarHTML(p, 42)}
        </div>
        <div class="post-author">
          <div class="post-author-name" onclick="window.location.href='profile.html?id=${encodeURIComponent(p.user_id)}'" style="cursor:pointer;">${escHtml(p.name)}</div>
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
  const method = currentlyLiked ? 'DELETE' : 'POST';
  const res    = await apiFetch('/api/like', { method, body: JSON.stringify({ post_id: postId }) });
  const data   = await res.json();
  if (!data.success) return;

  const btn     = document.getElementById(`like-btn-${postId}`);
  const countEl = document.getElementById(`like-count-${postId}`);
  const heartEl = btn ? btn.querySelector('.like-heart') : null;

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

  const ca = document.getElementById('commentAvatar');
  if (ca && currentUser) ca.innerHTML = avatarHTML(currentUser, 34);

  await loadComments(postId);
  document.getElementById('submitComment').onclick = () => submitComment(postId);
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
    list.innerHTML = '<div class="empty-state" style="padding:24px;"><div class="empty-icon">💬</div><p>No comments yet.</p></div>';
    return;
  }
  list.innerHTML = data.comments.map(c => {
    const isOwn = currentUser && c.user_id === currentUser.id;
    return `
      <div class="comment-item" id="comment-${c.id}">
        <div class="comment-avatar">${avatarHTML(c, 34)}</div>
        <div class="comment-bubble">
          <div class="comment-author">${escHtml(c.name)}</div>
          <div class="comment-text">${escHtml(c.comment)}</div>
          <div class="comment-meta">
            <span>${timeAgo(c.created_at)}</span>
            ${isOwn ? `<span class="comment-action" onclick="deleteComment(${c.id}, ${postId})">Delete</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
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
  if (!data.success) { showToast(data.message || 'Error.', 'error'); return; }

  textarea.value = '';
  await loadComments(postId);
  const countEl = document.getElementById(`comment-count-${postId}`);
  if (countEl) countEl.textContent = parseInt(countEl.textContent) + 1;
}

async function deleteComment(commentId, postId) {
  if (!confirm('Delete comment?')) return;
  const res = await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' });
  if ((await res.json()).success) {
    await loadComments(postId);
    const countEl = document.getElementById(`comment-count-${postId}`);
    if (countEl) countEl.textContent = Math.max(0, parseInt(countEl.textContent) - 1);
  }
}

/* ── Post Menu/Edit/Delete ───────────────────────────────── */
function togglePostMenu(e, postId) {
  e.stopPropagation();
  document.querySelectorAll('.post-dropdown').forEach(d => {
    if (d.id !== `menu-${postId}`) d.classList.add('hidden');
  });
  document.getElementById(`menu-${postId}`).classList.toggle('hidden');
  document.addEventListener('click', () => {
    document.querySelectorAll('.post-dropdown').forEach(d => d.classList.add('hidden'));
  }, { once: true });
}

function openEditModal(postId, content) {
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
  const res  = await apiFetch(`/api/posts/${editingPostId}`, { method: 'PUT', body: JSON.stringify({ content }) });
  const data = await res.json();
  if (data.success) {
    showToast('Post updated!', 'success');
    closeEditModal();
    await loadUserPosts(profileUserId);
  }
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  const res  = await apiFetch(`/api/posts/${postId}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.success) {
    showToast('Post deleted.', 'success');
    const el = document.getElementById(`post-${postId}`);
    if (el) el.remove();
    // Update posts count
    await loadProfile(profileUserId);
  }
}

/* ── Followers/Following ─────────────────────────────────── */
async function loadFollowers(userId) {
  const list = document.getElementById('followersList');
  list.dataset.loaded = '1';
  list.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  const res  = await apiFetch(`/api/follow/followers/${userId}`);
  const data = await res.json();
  if (!data.success || data.followers.length === 0) {
    list.innerHTML = emptyState('👥', 'No followers yet.', '');
    return;
  }
  list.innerHTML = data.followers.map(u => userCardHTML(u)).join('');
}

async function loadFollowing(userId) {
  const list = document.getElementById('followingList');
  list.dataset.loaded = '1';
  list.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  const res  = await apiFetch(`/api/follow/following/${userId}`);
  const data = await res.json();
  if (!data.success || data.following.length === 0) {
    list.innerHTML = emptyState('👤', 'Not following anyone yet.', '');
    return;
  }
  list.innerHTML = data.following.map(u => userCardHTML(u)).join('');
}

function userCardHTML(u) {
  return `
    <div class="user-card" onclick="window.location.href='profile.html?id=${encodeURIComponent(u.id)}'">
      <div class="user-card-avatar">${avatarHTML(u, 44)}</div>
      <div class="user-card-info">
        <div class="user-card-name">${escHtml(u.name)}</div>
        <div class="user-card-handle">@${escHtml(u.username)}</div>
      </div>
    </div>`;
}

/* ── Edit Profile Modal ──────────────────────────────────── */
function openEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  modal.classList.remove('hidden');

  document.getElementById('editName').value = profileUser.name || '';
  document.getElementById('editBio').value  = profileUser.bio  || '';
  document.getElementById('bioCount').textContent = (profileUser.bio || '').length;

  // Avatar preview
  const avatarEl   = document.getElementById('editCurrentAvatar');
  const placeholder = document.getElementById('editAvatarPlaceholder');
  if (profileUser.profile_image) {
    avatarEl.src = profileUser.profile_image;
    avatarEl.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    avatarEl.classList.add('hidden');
    placeholder.textContent = (profileUser.name || '?')[0].toUpperCase();
    placeholder.classList.remove('hidden');
  }

  // Image preview on file select
  document.getElementById('profileImageInput').onchange = function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      avatarEl.src = e.target.result;
      avatarEl.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  };

  // Bio char counter
  document.getElementById('editBio').oninput = function () {
    document.getElementById('bioCount').textContent = this.value.length;
  };

  document.getElementById('saveProfileBtn').onclick = saveProfile;
}

function closeEditProfileModal() {
  document.getElementById('editProfileModal').classList.add('hidden');
}

async function saveProfile() {
  const name  = document.getElementById('editName').value.trim();
  const bio   = document.getElementById('editBio').value;
  const fileInput = document.getElementById('profileImageInput');

  if (!name) { showEditAlert('Name is required.', 'error'); return; }

  const formData = new FormData();
  formData.append('name', name);
  formData.append('bio', bio);
  if (fileInput.files[0]) formData.append('profile_image', fileInput.files[0]);

  document.getElementById('saveProfileBtn').textContent = 'Saving…';

  try {
    const res = await fetch((window.API_BASE || '') + `/api/users/${currentUser.id}`, {
      method: 'PUT',
      credentials: 'include',
      body: formData,
      // DO NOT set Content-Type — let browser set multipart boundary
    });
    const data = await res.json();

    if (data.success) {
      showToast('Profile updated!', 'success');
      closeEditProfileModal();
      profileUser = { ...profileUser, ...data.user };
      currentUser = { ...currentUser, ...data.user };
      renderProfileHeader(profileUser);
      setNavAvatar(currentUser);
    } else {
      showEditAlert(data.message || 'Update failed.', 'error');
    }
  } catch {
    showEditAlert('Network error.', 'error');
  }

  document.getElementById('saveProfileBtn').textContent = 'Save Changes';
}

function showEditAlert(msg, type) {
  const el = document.getElementById('editAlertMsg');
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
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
  const res     = await apiFetch('/api/users');
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

/* ── Shared Utilities ────────────────────────────────────── */
function apiFetch(url, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  return fetch((window.API_BASE || '') + url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    ...rest,
  });
}

function setNavAvatar(user) {
  const el = document.getElementById('navAvatar');
  if (!el) return;
  if (user.profile_image) {
    el.style.backgroundImage   = `url(${user.profile_image})`;
    el.style.backgroundSize    = 'cover';
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

function emptyState(icon, title, subtitle) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p>${subtitle}</p></div>`;
}

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
