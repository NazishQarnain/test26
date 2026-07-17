// ── BOTTOM NAV PAGES ─────────────────────────────────────────────
// Main 4 tabs + "More" sheet for rest
const BOTTOM_PAGES = ['home','chat','dm','resources'];
const MORE_ITEMS = [
  { hash:'dm',           emoji:'📩', label:'Direct Msg' },
  { hash:'lostandfound', emoji:'🔍', label:'Lost & Found' },
  { hash:'confessions',  emoji:'🤫', label:'Confessions' },
  { hash:'marketplace',  emoji:'🛒', label:'Marketplace' },
  { hash:'campusmap',    emoji:'🗺️', label:'Campus Map' },
  { hash:'leaderboard',  emoji:'🏆', label:'Leaderboard' },
  { hash:'groupcall',    emoji:'📹', label:'Video Call' },
  { hash:'cgpa',         emoji:'📊', label:'CGPA Calc' },
  { hash:'attendance',   emoji:'📋', label:'Attendance' },
  { hash:'assignments',  emoji:'📝', label:'Assignments' },
  { hash:'poststory',    emoji:'✨', label:'Post Story' },
  { hash:'myprofile',    emoji:'👤', label:'My Profile' },
  { hash:'profile',      emoji:'⚙️', label:'Settings' },
];

function renderNavbar() {
  const nav = $("#navbar");
  const mobileNav = $("#mobileNav");
  if (!nav) return;

  const isDark = getTheme() === 'dark';
  const themeBtn = `<button id="themeBtn" title="Toggle dark mode" class="navlink text-lg">${isDark ? '☀️' : '🌙'}</button>`;

  if (isLoggedIn()) {
    const links = [
      ["🏠 Home","#home"],["💬 Chat","#chat"],["📚 Resources","#resources"],
      ["🔍 L&F","#lostandfound"],["⏳ Exams","#exams"],["🤫","#confessions"],
      ["🛒","#marketplace"],["🗺️","#campusmap"],["🏆","#leaderboard"],
      ["📹","#groupcall"],["📊","#cgpa"],["📋","#attendance"],["📝","#assignments"],
      ...(isAdmin() ? [["⚙️","#admin"]] : []),
      ["👤","#myprofile"],["⚙️","#profile"],
    ];
    nav.innerHTML = links.map(l=>`<a href="${l[1]}" class="navlink text-xs">${l[0]}</a>`).join('') +
      `<button id="logoutBtn" class="navlink text-red-500 text-xs">Logout</button>` + themeBtn;

    // Mobile dropdown nav
    if (mobileNav) mobileNav.innerHTML = [
      ["🏠 Home","#home"],["💬 Chat","#chat"],["📚 Resources","#resources"],
      ["🔍 Lost & Found","#lostandfound"],["⏳ Exam Countdown","#exams"],
      ["🤫 Confessions","#confessions"],["🛒 Marketplace","#marketplace"],
      ["🗺️ Campus Map","#campusmap"],["🏆 Leaderboard","#leaderboard"],
      ["📹 Video Call","#groupcall"],["📊 CGPA Calculator","#cgpa"],
      ["📋 Attendance","#attendance"],["📝 Assignments","#assignments"],
      ...(isAdmin() ? [["⚙️ Admin Panel","#admin"]] : []),
      ["👤 My Profile","#myprofile"],["⚙️ Settings","#profile"],
    ].map(l=>`<a href="${l[1]}" class="navlink text-sm">${l[0]}</a>`).join('') +
      `<button id="logoutBtnM" class="navlink text-red-500 text-sm text-left">Logout</button>` + themeBtn;
  } else {
    nav.innerHTML = `<a href="#login" class="navlink text-sm">Login</a><a href="#register" class="navlink text-sm">Register</a>` + themeBtn;
    if (mobileNav) mobileNav.innerHTML = `<a href="#login" class="navlink text-sm">Login</a><a href="#register" class="navlink text-sm">Register</a>` + themeBtn;
  }

  document.querySelectorAll("#logoutBtn,#logoutBtnM").forEach(b => b.addEventListener("click", logout));
  document.querySelectorAll("#themeBtn").forEach(b => b.addEventListener("click", () => { toggleTheme(); renderNavbar(); }));

  const cur = location.hash || "#home";
  document.querySelectorAll(".navlink[href]").forEach(l => {
    l.getAttribute("href") === cur ? l.classList.add("active") : l.classList.remove("active");
  });

  updateBottomNav();
}

// ── BOTTOM NAV ───────────────────────────────────────────────────
function updateBottomNav() {
  const bn = $("#bottomNav");
  const moreGrid = $("#moreGrid");
  if (!bn) return;

  if (!isLoggedIn()) { bn.classList.add('hidden'); return; }
  bn.classList.remove('hidden');

  const cur = location.hash.replace('#','') || 'home';
  document.querySelectorAll('.bnav-item').forEach(el => {
    const page = el.dataset.page;
    if (page === cur || (page === 'more' && !BOTTOM_PAGES.includes(cur))) {
      el.classList.add('text-orange-600'); el.classList.remove('text-zinc-500');
    } else {
      el.classList.remove('text-orange-600'); el.classList.add('text-zinc-500');
    }
  });

  // More button handler
  const moreBtn = $("#moreBtn");
  if (moreBtn) moreBtn.onclick = (e) => { e.preventDefault(); openMoreSheet(); };

  // Populate more grid
  if (moreGrid) {
    moreGrid.innerHTML = MORE_ITEMS.map(item => `
      <a href="#${item.hash}" onclick="closeMoreSheet()" class="glass flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-transform active:scale-95 no-underline">
        <span class="text-2xl">${item.emoji}</span>
        <span class="text-[10px] font-semibold text-center leading-tight" style="color:var(--muted)">${item.label}</span>
      </a>`).join('');
    if (isAdmin()) moreGrid.innerHTML += `<a href="#admin" onclick="closeMoreSheet()" class="glass flex flex-col items-center gap-1.5 py-3.5 rounded-2xl transition-transform active:scale-95 no-underline">
      <span class="text-2xl">⚙️</span><span class="text-[10px] font-semibold" style="color:var(--muted)">Admin</span></a>`;
  }
}

function openMoreSheet() {
  const sheet = $("#moreSheet");
  if (sheet) sheet.classList.remove('hidden');
}
function closeMoreSheet() {
  const sheet = $("#moreSheet");
  if (sheet) sheet.classList.add('hidden');
}

// ── ROUTER ───────────────────────────────────────────────────────
function setupMobileMenu() {
  const menuBtn = $("#menuBtn");
  const mobileNav = $("#mobileNav");
  if (menuBtn && mobileNav) menuBtn.onclick = () => mobileNav.classList.toggle("hidden");
}

function router() {
  renderNavbar();
  try { if (typeof cleanupChat === 'function') cleanupChat(); } catch(e) {}
  try { if (typeof cleanupDM === 'function') cleanupDM(); } catch(e) {}
  try { if (typeof cleanupExams === 'function') cleanupExams(); } catch(e) {}
  const mobileNav = $("#mobileNav");
  if (mobileNav) mobileNav.classList.add("hidden");

  const hash = location.hash.replace("#","").trim();

  if (hash === "login")    { renderLogin();    return; }
  if (hash === "register") { renderRegister(); return; }
  if (hash === "more")     { openMoreSheet();  return; }

  if (!isLoggedIn()) { renderLogin(); return; }

  const routes = {
    chat:         renderChat,
    dm:           renderDMInbox,
    profile:      renderProfile,
    resources:    renderResources,
    lostandfound: renderLostFound,
    exams:        renderExamCountdown,
    confessions:  renderConfessions,
    marketplace:  renderMarketplace,
    admin:        renderAdmin,
    campusmap:    renderCampusMap,
    leaderboard:  renderLeaderboard,
    groupcall:    renderGroupCall,
    cgpa:         renderCGPA,
    attendance:   renderAttendance,
    assignments:  renderAssignments,
    poststory:    renderPostStory,
  };

  // Own public/social profile (followers, friends, stories)
  if (hash === 'myprofile') {
    const u = firebase.auth().currentUser;
    if (u && typeof viewUserProfile === 'function') { viewUserProfile(u.uid); return; }
  }
  // Handle profile-uid routes e.g. #profile-abc123
  if (hash.startsWith('profile-')) {
    const uid = hash.replace('profile-', '');
    if (uid && typeof viewUserProfile === 'function') { viewUserProfile(uid); return; }
  }
  // Handle dm-uid routes
  if (hash.startsWith('dm-')) {
    const uid = hash.replace('dm-', '');
    if (uid && typeof openDM === 'function') { openDM(uid); return; }
  }

  const fn = routes[hash];
  if (fn) fn(); else renderHome();
}

window.addEventListener("hashchange", router);

// ── INIT ─────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  initializeFirebase();
  applyTheme();
  setupAuthListener();
  setupMobileMenu();
  const yearEl = $("#year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── CONNECTION STATUS BANNER ──────────────────────────────────
  // Makes Firebase's live connection state visible. Without this, a dropped
  // connection just looks like "nothing saves / nothing loads" with zero
  // indication why. Shows a slim banner while disconnected, and a brief
  // green "back online" flash on reconnect. Skips the very first emission
  // (initial state right after page load) to avoid flashing on every visit.
  let connSeenOnce = false;
  firebase.database().ref('.info/connected').on('value', snap => {
    const online = snap.val() === true;
    let banner = document.getElementById('connBanner');
    if (!online) {
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'connBanner';
        banner.className = 'fixed top-0 left-0 right-0 z-50 text-center text-xs font-semibold py-1.5 text-white';
        banner.style.background = '#dc2626';
        document.body.appendChild(banner);
      }
      banner.textContent = '⚠️ Connection lost — reconnecting...';
      banner.style.background = '#dc2626';
      connSeenOnce = true;
    } else if (banner) {
      banner.textContent = '✅ Back online';
      banner.style.background = '#16a34a';
      setTimeout(() => { const b = document.getElementById('connBanner'); if (b) b.remove(); }, 2000);
    } else if (!connSeenOnce) {
      connSeenOnce = true; // first "connected" emission on load — no banner needed
    }
  });

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // BUG FIX: Previously router() ran immediately on DOMContentLoaded, based only on the
  // localStorage "logged in" flag — but Firebase's own auth session hadn't finished restoring
  // yet. That race meant pages could briefly run with firebase.auth().currentUser === null
  // right after a refresh (e.g. profile photo upload, batch lock, sending a message could
  // silently no-op or throw "Not logged in"). Now we wait for the FIRST auth state resolution
  // (whether it resolves to a user or null) before running the initial route.
  // BUG FIX: previously this only waited for Firebase's auth state to resolve, but not for
  // the actual profile data (program/course/batch) to be pulled from the database — same
  // race as the login-handler bug. Now we await syncProfileFromFirebase() too, so a page
  // refresh never flashes the batch-selection screen for a student who already locked theirs.
  // BUG FIX: the "safety net" below used to fire a flat 2.5s after DOMContentLoaded no matter
  // what — including while syncProfileFromFirebase() was still genuinely in-flight on a slower
  // mobile connection. When that happened, it flipped firstAuthResolved to true and called
  // router() with an INCOMPLETE profile (program/course/batch not pulled from Firebase yet),
  // so renderHome() showed "select your batch" even for a student whose batch really was
  // already locked. This is the most likely explanation for "logs out, logs back in (or the
  // page/app reloads), and batch-select shows up again" on a slow connection — the real data
  // was there, it just hadn't arrived in time to beat the 2.5s cutoff. Now the safety net only
  // fires if the sync hasn't even STARTED after 4s (e.g. Firebase totally unreachable); once a
  // sync is genuinely in progress we let it finish rather than race it, with a generous 12s
  // hard ceiling so a truly hung request still can't leave the user stuck forever.
  let firstAuthResolved = false;
  let syncInProgress = false;
  const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
    if (firstAuthResolved) return;
    syncInProgress = true;
    if (user && typeof syncProfileFromFirebase === 'function') {
      try {
        await syncProfileFromFirebase(user);
      } catch (e) {
        console.error('[MujConnects] Profile sync failed on load — program/course/batch may not have loaded from Firebase:', e);
      }
    }
    syncInProgress = false;
    firstAuthResolved = true;
    router();
  });
  setTimeout(() => {
    if (!firstAuthResolved && !syncInProgress) { firstAuthResolved = true; router(); }
  }, 4000);
  // Absolute last resort — fires even mid-sync, only if something hung for 12+ seconds.
  setTimeout(() => { if (!firstAuthResolved) { firstAuthResolved = true; router(); } }, 12000);
});
