/* ============================================================
   TGC Rongai Campus Tracker — Auth (login gate + roles)

   IMPORTANT — read this before relying on it as real security:
   This is a UI-level access gate, not cryptographic protection. The
   Supabase anon key used throughout this app grants full read/write
   access to every table (including `users`) to anyone who has it —
   that's unavoidable with the "no separate backend, works everywhere"
   design this whole app is built on. This login screen stops someone
   from casually opening the app and poking around Settings; it does
   NOT stop someone who calls the Supabase REST API directly with the
   same anon key. If real protection against a deliberate bad actor is
   needed, the actual fix is Supabase Auth with role-checking RLS
   policies — a bigger project, and worth doing if that's the real risk.
   ============================================================ */

const SESSION_KEY = "tgc_rongai_tracker_session";

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSession(user) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, name: user.name, userType: user.userType }));
  } catch (e) { /* ignore (private browsing etc.) */ }
}

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
}

function currentUser() {
  return getSession();
}

function isSuperAdmin() {
  const u = getSession();
  return !!u && u.userType === "Super Admin";
}

// A session is only valid if that user still actually exists (in case they
// were deleted by a Super Admin since the last login).
function sessionIsValid() {
  const s = getSession();
  if (!s) return false;
  return Store.data.users.some((u) => u.id === s.id);
}

function showLoginScreen() {
  document.getElementById("loginScreen").style.display = "block";
  document.getElementById("appShell").style.display = "none";
  document.getElementById("loginName").value = "";
  document.getElementById("loginPassword").value = "";
  document.getElementById("loginError").style.display = "none";
  setTimeout(() => document.getElementById("loginName").focus(), 50);
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appShell").style.display = "";

  const user = currentUser();
  const loggedInAsEl = document.getElementById("loggedInAs");
  const logoutBtnEl = document.getElementById("logoutBtn");
  if (user) {
    loggedInAsEl.textContent = `${user.name} · ${user.userType}`;
    loggedInAsEl.style.display = "inline-block";
    logoutBtnEl.style.display = "inline-flex";
  }

  applyRoleVisibility();
  renderAll();
  wireTabs();
}

// Only Super Admins can reach Members & Settings. Hides the tab entirely
// for everyone else (defense in depth: renderAdmin() itself also checks,
// in case the tab is somehow made visible).
function applyRoleVisibility() {
  const settingsTabBtn = document.querySelector('.tab-btn[data-view="view-admin"]');
  if (!settingsTabBtn) return;
  if (isSuperAdmin()) {
    settingsTabBtn.style.display = "";
  } else {
    settingsTabBtn.style.display = "none";
    // If a non-Super-Admin somehow had Settings as the active tab
    // (e.g. right after a role change), snap back to the Follow-Up Radar.
    if (settingsTabBtn.classList.contains("active")) {
      settingsTabBtn.classList.remove("active");
      document.getElementById("view-admin").classList.remove("active");
      document.querySelector('.tab-btn[data-view="view-dashboard"]').classList.add("active");
      document.getElementById("view-dashboard").classList.add("active");
    }
  }
}

function toggleLoginPasswordVisibility() {
  const input = document.getElementById("loginPassword");
  input.type = input.type === "password" ? "text" : "password";
}

async function attemptLogin() {
  const userType = document.getElementById("loginUserType").value;
  const name = document.getElementById("loginName").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errorEl = document.getElementById("loginError");

  if (!name || !password) {
    errorEl.textContent = "Enter your name and password.";
    errorEl.style.display = "block";
    return;
  }

  const user = await Store.verifyLogin(userType, name, password);
  if (!user) {
    errorEl.textContent = "That user type, name, or password doesn't match. Please try again.";
    errorEl.style.display = "block";
    return;
  }

  setSession(user);
  showApp();
}

function logout() {
  if (!confirm("Log out of the tracker?")) return;
  clearSession();
  document.getElementById("loggedInAs").style.display = "none";
  document.getElementById("logoutBtn").style.display = "none";
  showLoginScreen();
}
