// ── PROFILE & SOCIAL SYSTEM ───────────────────────────────────────
// Followers (public, names visible), Friends (mutual follow, public),
// Block (fully private — only you can see/manage your own block list),
// Haters (anyone can "hate" a profile — count is public, but identity of
// haters is never revealed to anyone, including the profile owner), Stories.

// ── VIEW ANY USER'S PROFILE ───────────────────────────────────────
async function viewUserProfile(uid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) { renderLogin(); return; }
  const isOwnProfile = uid === currentUser.uid;

  // Push state so back button works
  history.pushState({}, '', `#profile-${uid}`);

  const [userSnap, followerSnap, followingSnap, storySnap, hateCountSnap] = await Promise.all([
    firebase.database().ref(`users/${uid}`).once('value'),
    firebase.database().ref(`followers/${uid}`).once('value'),
    firebase.database().ref(`following/${uid}`).once('value'),
    firebase.database().ref(`stories/${uid}`).once('value'),
    firebase.database().ref(`hateCounts/${uid}`).once('value'),
  ]);

  const user = userSnap.val() || {};
  const followers = followerSnap.numChildren();
  const following = followingSnap.numChildren();
  const haterCount = hateCountSnap.val() || 0;

  // Check relationship
  const isFollowing = followerSnap.hasChild(currentUser.uid);
  const theyFollowMe = (await firebase.database().ref(`followers/${currentUser.uid}/${uid}`).once('value')).exists();
  const isFriend = isFollowing && theyFollowMe;
  const isBlocked = (await firebase.database().ref(`blocks/${currentUser.uid}/${uid}`).once('value')).exists();
  // Whether *I* have already hated this profile — this is the only hate-related
  // thing anyone is ever allowed to read besides the aggregate count (see rules).
  const iHaveHated = !isOwnProfile && (await firebase.database().ref(`hates/${uid}/${currentUser.uid}`).once('value')).exists();

  // Count friends
  const friendCount = await countFriends(uid);

  // Get stories (last 24 hours)
  const stories = [];
  const cutoff = Date.now() - 24 * 3600000;
  storySnap.forEach(s => { const v = s.val(); if (v.timestamp > cutoff) stories.push({ id: s.key, ...v }); });

  const initials = (user.displayName || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hasStory = stories.length > 0;
  const p = getProfile();

  $("#app").innerHTML = `
    <div class="max-w-lg mx-auto">

      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <button onclick="history.back()" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl">←</button>
        <h2 class="text-base font-bold">${escapeHtml(user.displayName || 'Profile')}</h2>
      </div>

      <!-- Profile card -->
      <div class="glass-card overflow-hidden">

        <!-- Cover gradient -->
        <div class="h-24" style="background:var(--nova-grad)"></div>

        <!-- Avatar + actions -->
        <div class="px-4 pb-4">
          <div class="flex items-end justify-between -mt-10 mb-3">
            <!-- Avatar (with story ring if has story) -->
            <div onclick="${hasStory ? `viewStories('${uid}')` : ''}"
                 class="cursor-${hasStory ? 'pointer' : 'default'} ${hasStory ? 'ring-4 ring-pink-500 ring-offset-2 dark:ring-offset-zinc-900' : ''} rounded-full">
              ${user.photoURL
                ? `<img src="${user.photoURL}" class="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-zinc-900" />`
                : `<div class="w-20 h-20 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center font-bold text-orange-700 dark:text-blue-200 text-2xl border-4 border-white dark:border-zinc-900">${initials}</div>`}
              ${hasStory ? '<div class="text-[10px] text-orange-600 text-center mt-0.5 font-medium">Story</div>' : ''}
            </div>

            <!-- Action buttons (other user) -->
            ${!isOwnProfile ? `
            <div class="flex gap-2 flex-wrap justify-end">
              <button onclick="toggleFollow('${uid}')" id="followBtn"
                class="text-sm px-4 py-1.5 rounded-full font-semibold transition-colors ${isFollowing
                  ? 'btn-ghost'
                  : 'btn-nova'}">
                ${isFriend ? '👥 Friends' : isFollowing ? '✓ Following' : '+ Follow'}
              </button>
              <button onclick="openDM('${uid}')" class="text-sm px-4 py-1.5 btn-ghost">
                💬 Message
              </button>
              <button onclick="toggleHate('${uid}')" id="hateBtn"
                class="text-sm px-3 py-1.5 rounded-full border ${iHaveHated ? 'border-red-400 bg-red-50 dark:bg-red-950 text-red-500' : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}" title="Anonymous — no one will know it was you">
                ${iHaveHated ? '😡 Hated' : '😡 Hate'}
              </button>
              <button onclick="toggleBlock('${uid}')" id="blockBtn"
                class="text-sm px-3 py-1.5 rounded-full border ${isBlocked ? 'border-red-400 bg-red-50 dark:bg-red-950 text-red-500' : 'border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'}" title="${isBlocked ? 'Unblock' : 'Block'}">
                ${isBlocked ? '🚫 Blocked' : '⋯'}
              </button>
            </div>` : `
            <div class="flex gap-2">
              <button onclick="renderProfile()" class="text-sm px-4 py-1.5 btn-ghost">✏️ Edit</button>
              <button onclick="renderPostStory()" class="text-sm px-4 py-1.5 btn-nova">+ Story</button>
            </div>`}
          </div>

          <!-- Name & info -->
          <h3 class="font-bold text-lg">${escapeHtml(user.displayName || 'Unknown')}</h3>
          ${user.rollCode ? `<p class="text-sm text-orange-600 font-mono">@${user.rollCode}</p>` : ''}
          <p class="text-xs text-zinc-500 mt-0.5">${escapeHtml(user.program || '')} ${user.course ? '· ' + escapeHtml(user.course) : ''} ${user.batch ? '· ' + escapeHtml(user.batch) : ''}</p>

          <!-- Stats row -->
          <div class="flex gap-4 mt-4 pt-4" style="border-top:1px solid var(--border)">
            <button onclick="viewFollowersList('${uid}','followers')" class="flex-1 text-center hover:bg-black/5 dark:hover:bg-white/5 rounded-xl py-2 transition-colors">
              <div class="font-bold text-lg">${followers}</div>
              <div class="text-xs text-zinc-500">Followers</div>
            </button>
            <button onclick="viewFollowersList('${uid}','following')" class="flex-1 text-center hover:bg-black/5 dark:hover:bg-white/5 rounded-xl py-2 transition-colors">
              <div class="font-bold text-lg">${following}</div>
              <div class="text-xs text-zinc-500">Following</div>
            </button>
            <button onclick="viewFollowersList('${uid}','friends')" class="flex-1 text-center hover:bg-black/5 dark:hover:bg-white/5 rounded-xl py-2 transition-colors">
              <div class="font-bold text-lg">${friendCount}</div>
              <div class="text-xs text-zinc-500">Friends</div>
            </button>
            <!-- Haters: public count, but nobody — not even this profile's owner — can
                 ever see WHO hated. Not clickable (no list to show). -->
            <div class="flex-1 text-center py-2" title="Anonymous — identities are never shown to anyone">
              <div class="font-bold text-lg text-red-400" id="hateCountDisplay">${haterCount}</div>
              <div class="text-xs text-zinc-500">Haters</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stories section -->
      <div class="mt-4 glass-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-sm">Stories (24h)</h4>
          ${isOwnProfile ? `<button onclick="renderPostStory()" class="text-xs text-orange-600 underline">+ Post Story</button>` : ''}
        </div>
        ${stories.length ? `
          <div class="flex gap-3 overflow-x-auto pb-1">
            ${stories.map((s, i) => `
              <div onclick="viewStories('${uid}', ${i})" class="flex-shrink-0 cursor-pointer">
                <div class="w-16 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-blue-400 to-pink-400 relative">
                  ${s.imageUrl
                    ? `<img src="${s.imageUrl}" class="w-full h-full object-cover" />`
                    : `<div class="absolute inset-0 flex items-center justify-center p-1"><p class="text-white text-[10px] text-center leading-tight">${escapeHtml(s.text || '')}</p></div>`}
                </div>
                <p class="text-[10px] text-zinc-400 text-center mt-0.5">${formatStoryTime(s.timestamp)}</p>
              </div>`).join('')}
          </div>` : `
          <p class="text-sm text-zinc-400 text-center py-4">No stories in last 24h</p>`}
      </div>

      ${isOwnProfile ? `
      <!-- My block list — private. Only I can ever see or manage this. -->
      <div class="mt-4 glass-card p-4">
        <h4 class="font-semibold text-sm mb-2">🚫 Blocked Users</h4>
        <p class="text-xs text-zinc-400 mb-2">Only visible to you.</p>
        <div id="blockedList" class="text-sm text-zinc-400"><div class="skeleton h-10 w-full"></div></div>
      </div>` : ''}
    </div>
  `;

  // Load own block list (private)
  if (isOwnProfile) loadBlockedList(currentUser.uid);
}

// ── HATE (public anonymous counter) ────────────────────────────────
// Anyone can "hate" any other profile. The aggregate count is public and shown on
// the profile, but the identity of who hated is never readable by anyone — not the
// hater's followers, not other visitors, and not even the profile owner themself.
// This mirrors how Confessions stay anonymous in this app: the per-hater record
// (hates/{targetUid}/{haterUid}) is only ever readable/writable by that one hater
// (so they can toggle their own vote), and the running total lives in a separate
// hateCounts/{targetUid} node that anyone can read but nobody can inspect for names.
async function toggleHate(uid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser || uid === currentUser.uid) return;
  const btn = $("#hateBtn");
  if (btn) btn.disabled = true;

  const myHateRef = firebase.database().ref(`hates/${uid}/${currentUser.uid}`);
  const countRef = firebase.database().ref(`hateCounts/${uid}`);
  const snap = await myHateRef.once('value');

  if (snap.exists()) {
    await myHateRef.remove();
    await countRef.transaction(n => Math.max(0, (n || 0) - 1));
    if (btn) { btn.textContent = '😡 Hate'; btn.className = 'text-sm px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'; }
  } else {
    await myHateRef.set(true);
    await countRef.transaction(n => (n || 0) + 1);
    if (btn) { btn.textContent = '😡 Hated'; btn.className = 'text-sm px-3 py-1.5 rounded-full border border-red-400 bg-red-50 dark:bg-red-950 text-red-500'; }
  }
  if (btn) btn.disabled = false;

  const countSnap = await countRef.once('value');
  const el = $("#hateCountDisplay");
  if (el) el.textContent = countSnap.val() || 0;
}

// ── FOLLOW / UNFOLLOW ─────────────────────────────────────────────
async function toggleFollow(uid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;
  const btn = $("#followBtn");
  if (btn) { btn.disabled = true; }

  const ref = firebase.database().ref(`followers/${uid}/${currentUser.uid}`);
  const myFollowRef = firebase.database().ref(`following/${currentUser.uid}/${uid}`);
  const snap = await ref.once('value');

  if (snap.exists()) {
    // Unfollow
    await ref.remove();
    await myFollowRef.remove();
    if (btn) { btn.textContent = '+ Follow'; btn.className = 'text-sm px-4 py-1.5 rounded-full font-semibold btn-nova'; }
  } else {
    // Follow
    const p = getProfile();
    await ref.set({ displayName: p.displayName, photoURL: p.photoURL || null, at: Date.now() });
    await myFollowRef.set({ displayName: (await firebase.database().ref(`users/${uid}/displayName`).once('value')).val(), at: Date.now() });

    // Check if now friends (mutual)
    const theyFollow = await firebase.database().ref(`followers/${currentUser.uid}/${uid}`).once('value');
    if (theyFollow.exists()) {
      if (btn) { btn.textContent = '👥 Friends'; btn.className = 'text-sm px-4 py-1.5 rounded-full font-semibold btn-ghost'; }
    } else {
      if (btn) { btn.textContent = '✓ Following'; btn.className = 'text-sm px-4 py-1.5 rounded-full font-semibold btn-ghost'; }
    }
  }
  if (btn) btn.disabled = false;
}

// ── BLOCK (fully private) ───────────────────────────────────────────
// Only the blocker can ever see or manage this — see FIREBASE_RULES.json
// (blocks/$uid is readable/writable only by that same $uid).
async function toggleBlock(uid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;
  const ref = firebase.database().ref(`blocks/${currentUser.uid}/${uid}`);
  const btn = $("#blockBtn");
  const snap = await ref.once('value');

  if (snap.exists()) {
    await ref.remove();
    if (btn) { btn.textContent = '⋯'; btn.className = 'text-sm px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'; }
  } else {
    if (!confirm('Block this user? They will not be able to message you, and this will never show up on your profile — only you can see your block list.')) return;
    const userSnap = await firebase.database().ref(`users/${uid}`).once('value');
    const u = userSnap.val() || {};
    await ref.set({ displayName: u.displayName || 'Unknown', at: Date.now() });
    if (btn) { btn.textContent = '🚫 Blocked'; btn.className = 'text-sm px-3 py-1.5 rounded-full border border-red-400 bg-red-50 dark:bg-red-950 text-red-500'; }
  }
}

async function countFriends(uid) {
  const [followers, following] = await Promise.all([
    firebase.database().ref(`followers/${uid}`).once('value'),
    firebase.database().ref(`following/${uid}`).once('value'),
  ]);
  let count = 0;
  followers.forEach(f => { if (following.hasChild(f.key)) count++; });
  return count;
}

function loadBlockedList(uid) {
  const list = $("#blockedList");
  if (!list) return;
  firebase.database().ref(`blocks/${uid}`).once('value', snap => {
    if (!snap.exists()) { list.textContent = 'No blocked users.'; return; }
    const items = [];
    snap.forEach(c => items.push({ uid: c.key, ...c.val() }));
    list.innerHTML = items.map(u => `
      <div class="flex items-center justify-between py-2 border-b dark:border-zinc-800 last:border-0">
        <span class="text-sm">${escapeHtml(u.displayName)}</span>
        <button onclick="unblockUser('${u.uid}')" class="text-xs text-red-500 underline">Unblock</button>
      </div>`).join('');
  });
}

function unblockUser(uid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;
  firebase.database().ref(`blocks/${currentUser.uid}/${uid}`).remove()
    .then(() => loadBlockedList(currentUser.uid))
    .catch(err => alert('Could not unblock: ' + err.message));
}

// ── FOLLOWERS / FOLLOWING / FRIENDS LIST ─────────────────────────
async function viewFollowersList(uid, type) {
  const [followersSnap, followingSnap] = await Promise.all([
    firebase.database().ref(`followers/${uid}`).once('value'),
    firebase.database().ref(`following/${uid}`).once('value'),
  ]);

  let uids = [];
  if (type === 'followers') {
    followersSnap.forEach(c => uids.push({ uid: c.key, ...c.val() }));
  } else if (type === 'following') {
    followingSnap.forEach(c => uids.push({ uid: c.key, ...c.val() }));
  } else if (type === 'friends') {
    followersSnap.forEach(f => { if (followingSnap.hasChild(f.key)) uids.push({ uid: f.key, ...f.val() }); });
  }

  const titles = { followers: '👥 Followers', following: '➡️ Following', friends: '👫 Friends' };

  $("#app").innerHTML = `
    <div class="max-w-lg mx-auto">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="history.back()" class="text-zinc-400 hover:text-zinc-600 text-xl">←</button>
        <h2 class="text-base font-bold">${titles[type]} (${uids.length})</h2>
      </div>
      <div class="glass-card divide-y dark:divide-zinc-800">
        ${!uids.length ? '<p class="text-sm text-zinc-400 text-center py-8">No one here yet.</p>' :
          uids.map(u => `
            <div class="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors" onclick="viewUserProfile('${u.uid}')">
              <div class="w-10 h-10 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center font-bold text-orange-700 dark:text-blue-200 flex-shrink-0">
                ${(u.displayName || 'U')[0].toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">${escapeHtml(u.displayName || 'Unknown')}</p>
              </div>
              <span class="text-orange-600">→</span>
            </div>`).join('')}
      </div>
    </div>
  `;
}

// ── STORIES ───────────────────────────────────────────────────────
function renderPostStory() {
  if (!isLoggedIn()) { renderLogin(); return; }

  $("#app").innerHTML = `
    <div class="max-w-lg mx-auto">
      <div class="flex items-center gap-3 mb-4">
        <button onclick="history.back()" class="text-xl text-zinc-400">←</button>
        <h2 class="text-base font-bold">Post a Story</h2>
      </div>

      <div class="glass-card p-4 space-y-4">
        <!-- Story type tabs -->
        <div class="flex gap-2">
          <button onclick="setStoryType('text')" id="stypeText" class="flex-1 py-2.5 text-sm pill-active">📝 Text</button>
          <button onclick="setStoryType('image')" id="stypeImage" class="flex-1 py-2.5 text-sm pill">🖼️ Image</button>
        </div>

        <!-- Text story -->
        <div id="textStoryInput">
          <textarea id="storyText" placeholder="What's on your mind? (max 200 chars)" maxlength="200" rows="4"
            class="w-full input-nova px-3 py-2.5 text-sm resize-none"></textarea>
          <div class="flex gap-2 mt-2">
            ${['🎨 Blue','🌅 Sunset','🌿 Green','🌙 Dark','💜 Purple'].map((c, i) => {
              const grads = ['from-blue-500 to-blue-700','from-orange-400 to-pink-500','from-green-400 to-teal-600','from-zinc-800 to-zinc-950','from-orange-500 to-pink-600'];
              return `<button onclick="setStoryBg('${grads[i]}')" class="w-8 h-8 rounded-full bg-gradient-to-br ${grads[i]} ring-2 ring-transparent hover:ring-zinc-400 transition-all" title="${c}"></button>`;
            }).join('')}
          </div>
        </div>

        <!-- Image story -->
        <div id="imageStoryInput" class="hidden">
          <label class="block border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 transition-colors">
            <div id="imagePreviewArea">
              <div class="text-4xl mb-2">🖼️</div>
              <p class="text-sm text-zinc-500">Tap to select image</p>
            </div>
            <input type="file" id="storyImageInput" accept="image/*" class="hidden" />
          </label>
          <textarea id="storyCaption" placeholder="Caption (optional)" rows="2"
            class="w-full input-nova px-3 py-2.5 text-sm resize-none mt-3"></textarea>
        </div>

        <!-- Preview -->
        <div id="storyPreview" class="hidden rounded-xl overflow-hidden" style="height:200px">
          <div id="storyPreviewInner" class="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 p-4">
            <p class="text-white text-center font-medium text-base" id="storyPreviewText"></p>
          </div>
        </div>

        <button onclick="submitStory()" id="postStoryBtn" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium text-sm hover:opacity-90 transition-opacity">
          ✨ Post Story (visible 24h)
        </button>
      </div>
    </div>
  `;

  window._storyType = 'text';
  window._storyBg = 'from-blue-500 to-blue-700';
  window._storyImageFile = null;

  // Image preview
  $("#storyImageInput").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    window._storyImageFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const area = $("#imagePreviewArea");
      if (area) area.innerHTML = `<img src="${ev.target.result}" class="max-h-32 mx-auto rounded-lg object-contain" />`;
    };
    reader.readAsDataURL(file);
  };

  // Live preview for text
  $("#storyText").oninput = function() {
    const preview = $("#storyPreview");
    const previewText = $("#storyPreviewText");
    if (this.value) {
      preview.classList.remove('hidden');
      if (previewText) previewText.textContent = this.value;
    } else {
      preview.classList.add('hidden');
    }
  };
}

function setStoryType(type) {
  window._storyType = type;
  $("#textStoryInput").classList.toggle('hidden', type !== 'text');
  $("#imageStoryInput").classList.toggle('hidden', type !== 'image');
  $("#stypeText").className = `flex-1 py-2.5 text-sm ${type === 'text' ? 'pill-active' : 'pill'}`;
  $("#stypeImage").className = `flex-1 py-2.5 text-sm ${type === 'image' ? 'pill-active' : 'pill'}`;
  if (type === 'text') { const p = $("#storyPreview"); if(p) p.classList.add('hidden'); }
}

function setStoryBg(grad) {
  window._storyBg = grad;
  const inner = $("#storyPreviewInner");
  if (inner) inner.className = `w-full h-full flex items-center justify-center bg-gradient-to-br ${grad} p-4`;
}

async function submitStory() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;
  const p = getProfile();
  const btn = $("#postStoryBtn");
  if (btn) { btn.textContent = 'Posting...'; btn.disabled = true; }

  try {
    const storyData = {
      uid: currentUser.uid,
      displayName: p.displayName || 'Student',
      photoURL: p.photoURL || null,
      timestamp: Date.now(),
      expiresAt: Date.now() + 24 * 3600000,
      type: window._storyType,
      bg: window._storyBg || 'from-blue-500 to-blue-700',
    };

    if (window._storyType === 'image' && window._storyImageFile) {
      const file = window._storyImageFile;
      if (file.size > 10 * 1024 * 1024) { alert('Image too large. Max 10MB.'); return; }
      // Story images use chat-level compression (10% → quality 0.90) and ImgBB
      const { url } = await uploadMedia(file, 'story');
      storyData.imageUrl = url;
      storyData.caption = $("#storyCaption")?.value.trim() || '';
    } else {
      const text = $("#storyText")?.value.trim();
      if (!text) { alert('Please write something!'); if(btn){btn.textContent='✨ Post Story (visible 24h)';btn.disabled=false;} return; }
      storyData.text = text;
    }

    await firebase.database().ref(`stories/${currentUser.uid}`).push(storyData);
    alert('Story posted! It will be visible for 24 hours.');
    viewUserProfile(currentUser.uid);
  } catch(err) {
    alert('Failed to post story: ' + err.message);
    if (btn) { btn.textContent = '✨ Post Story (visible 24h)'; btn.disabled = false; }
  }
}

// ── VIEW STORIES (fullscreen) ─────────────────────────────────────
async function viewStories(uid, startIndex = 0) {
  const snap = await firebase.database().ref(`stories/${uid}`).once('value');
  const cutoff = Date.now() - 24 * 3600000;
  const stories = [];
  snap.forEach(s => { const v = s.val(); if (v.timestamp > cutoff) stories.push({ id: s.key, ...v }); });
  if (!stories.length) return;

  let current = startIndex;
  const currentUser = firebase.auth().currentUser;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 bg-black flex items-center justify-center';
  overlay.id = 'storyOverlay';

  function renderStorySlide(i) {
    const s = stories[i];
    const progress = stories.map((_, idx) => `
      <div class="flex-1 h-0.5 rounded-full ${idx < i ? 'bg-white' : idx === i ? 'bg-white animate-pulse' : 'bg-white/30'}"></div>`).join('');

    overlay.innerHTML = `
      <div class="relative w-full max-w-sm mx-auto h-screen max-h-[700px] rounded-2xl overflow-hidden">

        <!-- Background -->
        ${s.imageUrl
          ? `<img src="${s.imageUrl}" class="absolute inset-0 w-full h-full object-cover" />`
          : `<div class="absolute inset-0 bg-gradient-to-br ${s.bg || 'from-blue-500 to-blue-700'}"></div>`}

        <!-- Dark overlay for text -->
        <div class="absolute inset-0 bg-black/20"></div>

        <!-- Progress bars -->
        <div class="absolute top-0 left-0 right-0 p-3 flex gap-1">${progress}</div>

        <!-- Header -->
        <div class="absolute top-8 left-0 right-0 px-4 flex items-center gap-2">
          ${s.photoURL
            ? `<img src="${s.photoURL}" class="w-8 h-8 rounded-full object-cover border-2 border-white" />`
            : `<div class="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center text-white font-bold text-sm">${(s.displayName||'U')[0]}</div>`}
          <span class="text-white text-sm font-semibold">${escapeHtml(s.displayName || '')}</span>
          <span class="text-white/70 text-xs ml-auto">${formatStoryTime(s.timestamp)}</span>
          <button onclick="closeStory()" class="text-white text-xl ml-2">✕</button>
        </div>

        <!-- Text content -->
        ${s.text ? `
          <div class="absolute inset-0 flex items-center justify-center p-8">
            <p class="text-white text-xl font-bold text-center leading-tight drop-shadow-lg">${escapeHtml(s.text)}</p>
          </div>` : ''}

        ${s.caption ? `
          <div class="absolute bottom-16 left-0 right-0 px-4">
            <p class="text-white text-sm text-center bg-black/30 rounded-xl px-3 py-2">${escapeHtml(s.caption)}</p>
          </div>` : ''}

        <!-- Navigation taps -->
        <div class="absolute inset-0 flex">
          <div class="flex-1" onclick="prevStory()"></div>
          <div class="flex-1" onclick="nextStory()"></div>
        </div>

        <!-- Reply box -->
        <div class="absolute bottom-0 left-0 right-0 p-4 flex gap-2">
          <input id="storyReplyInput" placeholder="Reply to story..." class="flex-1 bg-white/20 backdrop-blur text-white placeholder-white/70 border border-white/30 rounded-xl px-3 py-2 text-sm" />
          <button onclick="sendStoryReply('${uid}','${s.id}')" class="bg-white text-orange-600 px-3 py-2 rounded-xl text-sm font-medium">Send</button>
        </div>

        <!-- Delete (own story) -->
        ${s.uid === currentUser?.uid ? `
          <button onclick="deleteStory('${uid}','${s.id}')" class="absolute top-8 right-12 text-white/70 hover:text-white text-xs">🗑</button>` : ''}
      </div>
    `;

    // Auto advance after 5 seconds
    if (window._storyTimer) clearTimeout(window._storyTimer);
    window._storyTimer = setTimeout(() => nextStory(), 5000);
  }

  window.nextStory = () => {
    if (current < stories.length - 1) { current++; renderStorySlide(current); }
    else closeStory();
  };
  window.prevStory = () => {
    if (current > 0) { current--; renderStorySlide(current); }
  };
  window.closeStory = () => {
    if (window._storyTimer) clearTimeout(window._storyTimer);
    overlay.remove();
  };

  document.body.appendChild(overlay);
  renderStorySlide(current);
}

async function sendStoryReply(uid, storyId) {
  const input = $("#storyReplyInput");
  const text = input?.value.trim();
  if (!text) return;
  const currentUser = firebase.auth().currentUser;
  const p = getProfile();

  // Send as DM to story owner
  const roomKey = getDMRoomKey(currentUser.uid, uid);
  await firebase.database().ref(`dms/${roomKey}/messages`).push({
    type: 'text',
    text: `↩ Story reply: ${text}`,
    uid: currentUser.uid,
    senderName: p.displayName || 'Student',
    timestamp: Date.now(), read: false
  });
  if (input) input.value = '';
  alert('Reply sent!');
}

async function deleteStory(uid, storyId) {
  if (!confirm('Delete this story?')) return;
  await firebase.database().ref(`stories/${uid}/${storyId}`).remove();
  closeStory();
  viewUserProfile(uid);
}

// ── STORY FEED (all following's stories) ─────────────────────────
async function renderStoryFeed() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  // Get people I follow
  const followingSnap = await firebase.database().ref(`following/${currentUser.uid}`).once('value');
  const followingUids = [currentUser.uid]; // include own stories
  followingSnap.forEach(c => followingUids.push(c.key));

  const cutoff = Date.now() - 24 * 3600000;
  const storyUsers = [];

  await Promise.all(followingUids.map(async uid => {
    const snap = await firebase.database().ref(`stories/${uid}`).once('value');
    const stories = [];
    snap.forEach(s => { const v = s.val(); if (v.timestamp > cutoff) stories.push({ id: s.key, ...v }); });
    if (stories.length) {
      const userSnap = await firebase.database().ref(`users/${uid}`).once('value');
      const u = userSnap.val() || {};
      storyUsers.push({ uid, displayName: u.displayName || 'Unknown', photoURL: u.photoURL, stories });
    }
  }));

  return storyUsers;
}

// ── HELPERS ───────────────────────────────────────────────────────
function formatStoryTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
  return `${Math.floor(diff/3600000)}h`;
}

