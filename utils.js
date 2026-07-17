// ═══ BUILD VERSION ═══════════════════════════════════════════════
// Bump this on every release. It prints in the console and shows on the
// Settings screen, so "which build is actually live?" is never a guess again.
const APP_BUILD = 'v20';
console.log('%cMujConnects build ' + APP_BUILD, 'color:#ea580c;font-weight:bold;font-size:14px');

const $ = (sel) => document.querySelector(sel);

// ── ESCAPE HTML (shared) ──────────────────────────────────────────
// BUG FIX: this used to build a <div>, set .textContent, then read back .innerHTML.
// That only escapes & < > (per the HTML text-serialization spec) — it does NOT escape
// straight quote characters. But escapeHtml() output is used everywhere to build
// double-quoted onclick="..." attributes out of user-supplied content (chat messages,
// DM text, confessions, marketplace listings, story captions, etc). Any message
// containing a literal " would close the onclick attribute early and let the rest of
// the message be interpreted as raw HTML/JS — a real stored-XSS / markup-breaking bug,
// not just cosmetic. Escaping " and ' explicitly (in addition to & < >) makes the output
// safe to embed in both HTML text nodes and quoted attribute values.
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── ROLL CODE HELPERS ────────────────────────────────────────────
function extractRollCode(email) {
  if (!email) return null;
  const local = email.split('@')[0];
  const parts = local.split('.');
  if (parts.length >= 2) return parts[parts.length - 1].toLowerCase();
  return local.toLowerCase();
}

function extractFirstName(email) {
  if (!email) return null;
  const local = email.split('@')[0];
  const parts = local.split('.');
  if (parts.length >= 2) {
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
  return null;
}

// ── LOCAL STORAGE KEYS ───────────────────────────────────────────
const LS = {
  theme:   'mujc_theme',
  session: 'mujc_session',
  profile: 'mujc_profile',
};

// ── ADMIN ────────────────────────────────────────────────────────
// BUG FIX: this was the only place "who is an admin" was defined, and it's a plain
// client-side JS array. The security rules (FIREBASE_RULES.json), however, gate the
// sensitive "ban a user" write on a completely different, separate check —
// root.child('admins').child(auth.uid).exists() — which reads from an '/admins/{uid}'
// node in the database. Nothing in this app ever wrote to that node, so even after
// adding your UID below, banUser() in extras.js would still fail with a silent
// permission-denied error. Firebase rules can't see this JS array, so both places
// need your UID:
//   1. Add your Firebase Auth UID to ADMIN_UIDS below (controls what the UI shows you)
//   2. In the Firebase console → Realtime Database, add: admins/<your-uid>: true
//      (controls what the server actually lets you write)
const ADMIN_UIDS = []; // Add your Firebase UID here

function isAdmin() {
  const user = firebase.auth().currentUser;
  return user && ADMIN_UIDS.includes(user.uid);
}

// ── DARK MODE ────────────────────────────────────────────────────
// Nova theme is designed dark-first (glass blur + gradients pop most against a dark
// backdrop), so first-time visitors default to dark; anyone who's already chosen a
// theme keeps their saved preference.
function getTheme() { return localStorage.getItem(LS.theme) || 'dark'; }
function setTheme(t) {
  localStorage.setItem(LS.theme, t);
  document.documentElement.classList.toggle('dark', t === 'dark');
}
function toggleTheme() { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }
function applyTheme()  { setTheme(getTheme()); }

// ── MUJ PROGRAMS ────────────────────────────────────────────────
const MUJ_PROGRAMS = {
  'B.Tech':         { duration: 4, courses: ['CSE','CSE (AI & ML)','CSE (Data Science)','CSE (Cyber Security)','CSE (IoT & IS)','CSE (CCE)','CSE (Biosciences)','Information Technology','Mechanical Engineering','Civil Engineering','Electrical Engineering','Electronics & Communication Engineering','Mechatronics Engineering','Biotechnology','Chemical Engineering','Robotics & AI','Fashion Technology'] },
  'M.Tech':         { duration: 2, courses: ['CSE','Cyber Security','Computational Biology','Structural Engineering','Mechanical Engineering'] },
  'BCA':            { duration: 3, courses: ['BCA'] },
  'MCA':            { duration: 2, courses: ['MCA'] },
  'BBA':            { duration: 3, courses: ['BBA','BBA (Business Analytics)'] },
  'MBA':            { duration: 2, courses: ['MBA (General)','MBA (Business Analytics)','MBA (Real Estate Management)','MBA (Finance)','MBA (Marketing)'] },
  'Integrated MBA': { duration: 5, courses: ['Integrated MBA'] },
  'B.Com':          { duration: 3, courses: ['B.Com (Hons.)','B.Com (Hons.) FinTech','B.Com (Hons.) Accounting (ACCA)'] },
  'M.Com':          { duration: 2, courses: ['M.Com (Financial Analysis)'] },
  'B.Sc':           { duration: 3, courses: ['B.Sc (Biotechnology)','B.Sc (Microbiology)','B.Sc (Physics)','B.Sc (Chemistry)','B.Sc (Mathematics)','B.Sc (Food Science & Technology)'] },
  'M.Sc':           { duration: 2, courses: ['M.Sc (Biotechnology)','M.Sc (Chemistry)','M.Sc (Mathematics)','M.Sc (Mathematics & Computing)','M.Sc (Physics)','M.Sc (Food Science & Technology)','M.Sc (Cyber Security)'] },
  'B.Arch':         { duration: 5, courses: ['B.Arch'] },
  'M.Arch':         { duration: 2, courses: ['M.Arch'] },
  'B.Des':          { duration: 4, courses: ['B.Des (Interior Design)','B.Des (Fashion Design)','B.Des (Communication Design)','B.Des (Interaction Design)'] },
  'M.Des':          { duration: 2, courses: ['M.Des (Fashion Design)','M.Des (Interior Design)'] },
  'BFA':            { duration: 4, courses: ['BFA (Applied Arts)'] },
  'LLB':            { duration: 3, courses: ['LLB (Hons.)'] },
  'LLM':            { duration: 1, courses: ['LLM'] },
  'BA':             { duration: 3, courses: ['BA (Hons.) English','BA (Hons.) Economics','BA (Hons.) Psychology','BA (Liberal Arts)','BA (Journalism & Mass Communication)'] },
  'MA':             { duration: 2, courses: ['MA (Economics)','MA (JMC)'] },
  'BHM':            { duration: 4, courses: ['BHM (Hotel Management)'] },
  'B.Pharm':        { duration: 4, courses: ['B.Pharm'] },
  'BPEd':           { duration: 4, courses: ['BPEd (Physical Education & Sports)'] },
  'Ph.D':           { duration: 3, courses: ['Ph.D (Engineering)','Ph.D (Management)','Ph.D (Sciences)','Ph.D (Humanities)','Ph.D (Law)','Ph.D (Design)'] },
};

function getBatchesForProgram(key) {
  const prog = MUJ_PROGRAMS[key];
  if (!prog) return [];
  const cur = new Date().getFullYear();
  const out = [];
  for (let s = 2011; s <= cur; s++) out.push(`${s}\u2013${s + prog.duration}`);
  return out.reverse();
}

function buildRoomKey(program, course, batch) {
  return [program, course, batch].join('_').replace(/[^a-zA-Z0-9_-]/g, '-');
}

// ── PROFILE ──────────────────────────────────────────────────────
function getProfile() {
  try {
    const raw = localStorage.getItem(LS.profile);
    return raw ? JSON.parse(raw) : { displayName:'Student', email:'', program:'', course:'', batch:'', rollCode:'' };
  } catch(e) { return { displayName:'Student', email:'', program:'', course:'', batch:'', rollCode:'' }; }
}
function setProfile(p) { localStorage.setItem(LS.profile, JSON.stringify(p)); }
function loginSession(email) { localStorage.setItem(LS.session, email); }
function logoutSession() { localStorage.removeItem(LS.session); localStorage.removeItem(LS.profile); }
function isLoggedIn() { return !!localStorage.getItem(LS.session); }

// ── FORMAT HELPERS ────────────────────────────────────────────────
function formatLastSeen(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60000)     return 'Just now';
  if (diff < 3600000)   return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000)  return `${Math.floor(diff/3600000)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN');
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)    return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

function getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  const m = { pdf:'📄',doc:'📝',docx:'📝',ppt:'📊',pptx:'📊',xls:'📈',xlsx:'📈',
               txt:'📃',md:'📃',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',svg:'🖼️',
               webp:'🖼️',mp4:'🎬',mov:'🎬',mkv:'🎬',mp3:'🎵',wav:'🎵',
               zip:'🗜️',rar:'🗜️',py:'💻',java:'💻',cpp:'💻',js:'💻',html:'🌐',css:'🎨',json:'🔧' };
  return m[ext] || '📁';
}

// ── NOTIFICATIONS ────────────────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied')  return false;
  return (await Notification.requestPermission()) === 'granted';
}

function showNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible') return;
  try { new Notification(title, { body }); } catch(e) {}
}

// ── LAST SEEN ────────────────────────────────────────────────────
function updateLastSeen() {
  const user = firebase.auth().currentUser;
  if (user) firebase.database().ref(`users/${user.uid}/lastSeen`).set(Date.now()).catch(() => {});
}
setInterval(() => { if (isLoggedIn()) updateLastSeen(); }, 120000);

// ── SHARED ERROR HINT (admin-only writes) ───────────────────────
// Several actions (announcements, pin, polls, exams, deleting confessions) are only
// allowed server-side for UIDs listed under /admins/<uid> in the Realtime Database —
// that's a SEPARATE, deliberately-required step from the local ADMIN_UIDS array in this
// file (see the comment above it). If someone is in ADMIN_UIDS but not yet in Firebase's
// /admins/ node, every one of these actions fails with PERMISSION_DENIED. This helper
// gives a consistent, actionable message instead of a bare Firebase error code.
function adminPermissionHint(err) {
  if (err && err.code === 'PERMISSION_DENIED') {
    return '\n\nYour account is in the local admin list but Firebase itself doesn\'t recognize you as admin yet. In the Firebase Console → Realtime Database, add: admins/<your-uid>: true, then try again.';
  }
  return '';
}

// ── 7-DAY POST RETENTION (Lost & Found / Marketplace / Confessions) ─
// These community boards only keep the last 7 days of posts:
//  - loaders call filterToLast7Days() so anything older never renders
//  - loaders also call cleanupExpiredPosts() lazily, which actually deletes
//    expired items from Firebase (the security rules explicitly allow ANY
//    authenticated user to remove a post whose timestamp is >7 days old, so
//    cleanup happens organically whenever anyone opens the page — no server
//    or cron job needed)
//  - dateFilterMatch() powers the "Today / Yesterday / This week" dropdown
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function filterToLast7Days(items) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  return items.filter(i => (i.timestamp || 0) >= cutoff);
}

function cleanupExpiredPosts(collectionPath) {
  // Safety: run at most once per session per collection — cleanup doesn't need
  // to re-run on every single list refresh, and throttling shrinks any possible
  // interaction between cleanup and a just-created post to effectively zero.
  const flag = 'mujc_cleaned_' + collectionPath;
  try { if (sessionStorage.getItem(flag)) return; sessionStorage.setItem(flag, '1'); } catch (e) {}
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  firebase.database().ref(collectionPath).orderByChild('timestamp').endAt(cutoff).once('value', snap => {
    snap.forEach(c => {
      // Belt-and-braces: even though the query already targets only expired items,
      // re-verify with an explicit numeric check before deleting anything — this
      // makes it impossible for index quirks or clock weirdness to ever delete a
      // fresh post.
      const ts = c.val() && c.val().timestamp;
      if (typeof ts === 'number' && ts < cutoff) {
        firebase.database().ref(`${collectionPath}/${c.key}`).remove().catch(() => {});
      }
    });
  }, () => {});
}

function dateFilterMatch(item, dateFilter) {
  if (!dateFilter || dateFilter === 'week') return true;
  const d = new Date(item.timestamp || 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const itemDay = new Date(d); itemDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - itemDay) / 86400000);
  if (dateFilter === 'today') return diffDays === 0;
  if (dateFilter === 'yesterday') return diffDays === 1;
  return true;
}

// Standard dropdown markup used by all three boards. onchangeFn re-loads the list.
function dateFilterDropdown(id, onchangeFn) {
  return `<select id="${id}" onchange="${onchangeFn}" class="input-nova text-xs px-2 py-1.5 ml-auto" title="Filter by date">
    <option value="week">📅 Last 7 days</option>
    <option value="today">Today</option>
    <option value="yesterday">Yesterday</option>
  </select>`;
}

// ── STORAGE LAYER (ImgBB for images, Google Drive via Apps Script for files) ─
// Replaces Puter.js entirely — no user login/popup needed for uploads at all.
//  · Images  → ImgBB (free image host; needs only the API key in firebase-config.js)
//  · Files   → the site owner's Google Drive, through a tiny Apps Script "bridge"
//              deployed from the owner's account (see DRIVE_SETUP.md for the
//              copy-paste script + 5-minute setup). The script runs as the owner
//              on Google's servers, so no token or account ever appears in this
//              frontend code, and end users never see a login prompt.

// Per-context image compression (as requested):
//   profile pic → 30% compression (quality 0.70) + resized to max 512px
//   group chat  → 10% compression (quality 0.90)
//   personal DM →  5% compression (quality 0.95)
const IMG_QUALITY = { profile: 0.70, chat: 0.90, dm: 0.95, story: 0.90 };

// Canvas-based JPEG re-encode. Also caps the longest edge (maxDim) since a
// 4000px phone photo gains nothing over ~1600px on a phone screen but costs
// 5-10x the bandwidth. GIFs are passed through untouched (re-encoding kills
// animation).
function compressImage(file, quality, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/gif') { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) { resolve(file); return; }
        // If recompression somehow made it bigger (already-optimized small image), keep original
        resolve(blob.size < file.size ? blob : file);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// Upload an image blob/file to ImgBB. Returns the direct display URL.
async function uploadImageToImgBB(fileOrBlob, fileName) {
  if (!window.IMGBB_API_KEY || window.IMGBB_API_KEY.includes('PASTE')) {
    throw new Error('ImgBB API key is not configured — open firebase-config.js and set IMGBB_API_KEY (free key from api.imgbb.com).');
  }
  const form = new FormData();
  form.append('image', fileOrBlob, fileName || 'image.jpg');
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${window.IMGBB_API_KEY}`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'ImgBB upload failed');
  return data.data.url;
}

// Upload any file to the owner's Google Drive via the Apps Script bridge.
// Sent as text/plain JSON (base64 payload) — that content type skips the CORS
// preflight that Apps Script can't answer. Returns a direct-download URL.
async function uploadFileToDrive(file) {
  if (!window.DRIVE_UPLOAD_URL || window.DRIVE_UPLOAD_URL.includes('PASTE')) {
    throw new Error('Google Drive upload is not configured — follow DRIVE_SETUP.md, then set DRIVE_UPLOAD_URL in firebase-config.js.');
  }
  if (file.size > 30 * 1024 * 1024) {
    throw new Error('File too large — maximum 30MB per file.');
  }
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Could not read file'));
    r.readAsDataURL(file);
  });
  const res = await fetch(window.DRIVE_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ filename: file.name, mimeType: file.type || 'application/octet-stream', data: base64 })
  });
  const out = await res.json();
  if (!out.url) throw new Error(out.error || 'Drive upload failed');
  return out.url;
}

// One-stop helper: images get compressed (per-context quality) and go to ImgBB;
// everything else goes to Drive. Returns { url, isImage }.
async function uploadMedia(file, context) {
  const isImage = file.type.startsWith('image/');
  if (isImage) {
    const quality = IMG_QUALITY[context] || 0.90;
    const maxDim = context === 'profile' ? 512 : 1600;
    const compressed = await compressImage(file, quality, maxDim);
    const url = await uploadImageToImgBB(compressed, file.name.replace(/\.[^.]+$/, '') + '.jpg');
    return { url, isImage: true };
  }
  const url = await uploadFileToDrive(file);
  return { url, isImage: false };
}


// ── TOAST (small success/notice popup) ─────────────────────────────
function showToast(msg) {
  const old = document.getElementById('mujcToast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'mujcToast';
  t.className = 'fixed bottom-24 left-1/2 z-50 text-sm font-semibold text-white px-4 py-2 rounded-full pop-in';
  t.style.cssText += ';transform:translateX(-50%);background:var(--nova-grad);box-shadow:0 6px 20px rgba(249,115,22,.35)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { const x = document.getElementById('mujcToast'); if (x) x.remove(); }, 2500);
}
