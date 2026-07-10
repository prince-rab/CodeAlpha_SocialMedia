/**
 * register.js — Handles the registration form submission.
 * Uses window.API_BASE (set by api.js) to support both
 * Express (port 5000) and VS Code Live Server (port 5500).
 */

// Redirect if already authenticated
fetch(window.API_BASE + '/api/auth/me', { credentials: 'include' })
  .then(r => r.json())
  .then(data => { if (data.success) window.location.href = 'feed.html'; })
  .catch(() => {});

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
  const btn     = document.getElementById('registerBtn');
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.btn-spinner');
  btn.disabled  = loading;
  text.classList.toggle('hidden', loading);
  spinner.classList.toggle('hidden', !loading);
}

function clearErrors() {
  ['name', 'username', 'email', 'password', 'confirmPassword'].forEach(f => {
    const errEl = document.getElementById(f + 'Error');
    const input = document.getElementById(f);
    if (errEl)  errEl.textContent = '';
    if (input)  input.classList.remove('error');
  });
}

function setFieldError(field, msg) {
  const errEl = document.getElementById(field + 'Error');
  const input = document.getElementById(field);
  if (errEl)  errEl.textContent = msg;
  if (input)  input.classList.add('error');
}

document.getElementById('registerForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  hideAlert();
  clearErrors();

  const name            = document.getElementById('name').value.trim();
  const username        = document.getElementById('username').value.trim();
  const email           = document.getElementById('email').value.trim();
  const password        = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // Client-side validation
  let valid = true;
  if (!name) { setFieldError('name', 'Full name is required.'); valid = false; }
  if (!username) { setFieldError('username', 'Username is required.'); valid = false; }
  else if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
    setFieldError('username', 'Username: 3-30 chars, letters/numbers/_ only.'); valid = false;
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    setFieldError('email', 'Valid email is required.'); valid = false;
  }
  if (!password || password.length < 6) {
    setFieldError('password', 'Password must be at least 6 characters.'); valid = false;
  }
  if (password !== confirmPassword) {
    setFieldError('confirmPassword', 'Passwords do not match.'); valid = false;
  }
  if (!valid) return;

  setLoading(true);

  try {
    const res  = await fetch(window.API_BASE + '/api/auth/register', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ name, username, email, password }),
    });
    const data = await res.json();

    if (data.success) {
      if (data.confirmEmail) {
        // Supabase email confirmation is ON — user must confirm before login
        showAlert(data.message, 'success');
        setLoading(false);
      } else if (data.profileError) {
        // Auth user created but profiles table missing (SQL not run yet)
        showAlert('⚠️ ' + data.message, 'error');
        setLoading(false);
      } else {
        localStorage.setItem('ss_authenticated', '1');
        showAlert('Account created! Redirecting…', 'success');
        setTimeout(() => { window.location.href = 'feed.html'; }, 900);
      }
    } else {
      if (data.errors) {
        data.errors.forEach(err => {
          const field = err.path || err.param;
          if (field) setFieldError(field, err.msg);
          else showAlert(err.msg, 'error');
        });
      } else {
        // Handle 409 Conflict (username or email already taken)
        if (res.status === 409) {
          if (data.message.toLowerCase().includes('username')) {
            setFieldError('username', data.message);
          } else if (data.message.toLowerCase().includes('email')) {
            setFieldError('email', data.message);
          } else {
            showAlert(data.message || 'This username or email is already taken. Please try different values.', 'error');
          }
        } else {
          showAlert(data.message || 'Registration failed. Please try again.', 'error');
        }
      }
      setLoading(false);
    }
  } catch (err) {
    showAlert('Network error. Make sure the server is running on port 5000.', 'error');
    setLoading(false);
  }
});
