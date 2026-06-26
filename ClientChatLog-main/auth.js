/* ─── ClientChatLog — auth.js ─────────────────────────────────
   Handles sign in / sign up / sign out and gates the app shell
   behind a logged-in Supabase user. Google OAuth is wired up
   but shown as "coming soon" until the provider is enabled in
   the Supabase dashboard — see GOOGLE_AUTH_ENABLED below.
──────────────────────────────────────────────────────────────*/

// Flip this to true once you've enabled Google in
// Supabase → Authentication → Providers → Google
const GOOGLE_AUTH_ENABLED = false;

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
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
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
  showAppShell();
  showLoading();
  await loadFromSupabase();
  render();
  hideLoading();
}

// ─── KICK OFF ─────────────────────────────────────────────────
initAuth();
