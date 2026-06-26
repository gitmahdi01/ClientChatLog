/* ─── ClientChatLog — auth.js ─────────────────────────────────
   Handles sign in / sign up / sign out and gates the app shell
   behind a logged-in Supabase user. Google OAuth is wired up
   but shown as "coming soon" until the provider is enabled in
   the Supabase dashboard — see GOOGLE_AUTH_ENABLED below.
──────────────────────────────────────────────────────────────*/

// Flip this to true once you've enabled Google in
// Supabase → Authentication → Providers → Google
const GOOGLE_AUTH_ENABLED = true;

let authMode = 'signin'; // 'signin' | 'signup'
let currentUser = null;

// ─── INIT ─────────────────────────────────────────────────────
async function initAuth() {
  if (!GOOGLE_AUTH_ENABLED) {
    document.getElementById('btnGoogleAuth').disabled = true;
    document.getElementById('btnGoogleAuth').classList.add('disabled');
  } else {
    document.getElementById('googleHint').style.display = 'none';
  }

  // Check for an existing session (e.g. page refresh)
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await onAuthenticated(session.user);
  } else {
    showAuthScreen();
  }

  // Listen for auth state changes (login, logout, token refresh)
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      onAuthenticated(session.user);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      clearTimeout(idleTimer);
      showAuthScreen();
    }
  });
}

// ─── UI MODE SWITCH ───────────────────────────────────────────
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('tabSignIn').classList.toggle('active', mode === 'signin');
  document.getElementById('tabSignUp').classList.toggle('active', mode === 'signup');
  document.getElementById('authSubmitBtn').textContent = mode === 'signin' ? 'Sign In' : 'Sign Up';
  document.getElementById('authPassword').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  clearAuthError();
}

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
  hideLoading();
}

function showAppShell() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'flex';
}

function setAuthError(msg) {
  document.getElementById('authError').textContent = msg;
}
function clearAuthError() {
  document.getElementById('authError').textContent = '';
}

function showLoading() { document.getElementById('loadingOverlay').classList.add('visible'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('visible'); }

// ─── EMAIL / PASSWORD ─────────────────────────────────────────
async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthError();

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');

  btn.disabled = true;
  btn.textContent = authMode === 'signin' ? 'Signing in…' : 'Signing up…';

  try {
    if (authMode === 'signin') {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange handles the rest
    } else {
      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      setAuthError('Account created! If email confirmation is required, check your inbox before signing in.');
    }
  } catch (err) {
    setAuthError(err.message || 'Something went wrong. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'signin' ? 'Sign In' : 'Sign Up';
  }
}

// ─── GOOGLE OAUTH ─────────────────────────────────────────────
async function signInWithGoogle() {
  if (!GOOGLE_AUTH_ENABLED) return;
  // Use the clean base URL (no query/hash) rather than the current
  // window.location.href — if a previous attempt left token
  // fragments in the address bar, reusing href would carry them
  // forward and they'd stack up with the new ones.
  const cleanUrl = window.location.origin + window.location.pathname;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: cleanUrl }
  });
  if (error) setAuthError(error.message);
}

// ─── LOGOUT ───────────────────────────────────────────────────
async function handleLogout() {
  showLoading();
  await supabaseClient.auth.signOut();
  hideLoading();
}

// ─── ON LOGIN SUCCESS ─────────────────────────────────────────
async function onAuthenticated(user) {
  currentUser = user;
  document.getElementById('userPill').textContent = '👤 ' + (user.email || 'Signed in');

  // Strip any OAuth token fragments (#access_token=...) from the
  // URL now that Supabase has consumed them into a real session.
  // Without this, retrying or re-navigating can cause fragments
  // to stack up in the address bar.
  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  showAppShell();
  showLoading();
  await loadFromSupabase();
  render();
  hideLoading();
  resetIdleTimer();
}

// ─── AUTO SIGN-OUT AFTER INACTIVITY ───────────────────────────
// Replaces the earlier "sign out on tab close" approach, which
// broke OAuth: Google sign-in itself triggers a page unload/reload
// as part of its redirect flow, so a beforeunload handler was
// wiping out the session Supabase had just set, right as the user
// returned from Google. Signing out is also async, and the browser
// does not wait for in-flight promises during beforeunload, so it
// was unreliable even for plain email/password logins.
//
// This approach signs the user out after a period of no activity
// instead — it protects a shared/staff computer without fighting
// the login flow itself.
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
let idleTimer = null;

function resetIdleTimer() {
  if (!currentUser) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    supabaseClient.auth.signOut();
  }, IDLE_TIMEOUT_MS);
}

['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt => {
  window.addEventListener(evt, resetIdleTimer, { passive: true });
});

// ─── KICK OFF ─────────────────────────────────────────────────
initAuth();