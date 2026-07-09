/**
 * login.js — Handles the login form submission.
 * Uses window.API_BASE (set by api.js) to support both
 * Express (port 5000) and VS Code Live Server (port 5500).
 */

// Redirect if already authenticated.
// NOTE: A 401 response here is normal — it just means no session exists yet.
// We consume the response without logging to avoid a misleading console error.
fetch(window.API_BASE + '/api/auth/me', { credentials: 'include' })
  .then(r => r.ok ? r.json() : null)
  .then(data => { if (data && data.success) window.location.href = 'feed.html'; })
  .catch(() => { /* server not running or network error — stay on login page */ });

function togglePassword(fieldId) {
  const field = document.getElementById(fieldId);
  field.type = field.type === 'password' ? 'text' : 'password';
}

function showAlert(msg, type = 'error') {
  const el = document.getElementById('authAlert');
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideAlert() {
  document.getElementById('authAlert').classList.add('hidden');
}

function setLoading(loading) {
  const btn     = document.getElementById('loginBtn');
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled = loading;
  text.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  hideAlert();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // Client-side validation
  let valid = true;
  if (!email) {
    document.getElementById('emailError').textContent = 'Email is required.';
    document.getElementById('email').classList.add('error');
    valid = false;
  } else {
    document.getElementById('emailError').textContent = '';
    document.getElementById('email').classList.remove('error');
  }
  if (!password) {
    document.getElementById('passwordError').textContent = 'Password is required.';
    document.getElementById('password').classList.add('error');
    valid = false;
  } else {
    document.getElementById('passwordError').textContent = '';
    document.getElementById('password').classList.remove('error');
  }
  if (!valid) return;

  setLoading(true);

  try {
    const res  = await fetch(window.API_BASE + '/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem('ss_authenticated', '1');
      showAlert('Logged in successfully! Redirecting…', 'success');
      setTimeout(() => { window.location.href = 'feed.html'; }, 800);
    } else {
      const msg = data.errors ? data.errors.map(e => e.msg).join(' ') : data.message;
      showAlert(msg || 'Login failed. Please try again.', 'error');
      setLoading(false);
    }
  } catch (err) {
    showAlert('Network error. Make sure the server is running on port 5000.', 'error');
    setLoading(false);
  }
});
