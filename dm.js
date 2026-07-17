// ── DIRECT MESSAGES ──────────────────────────────────────────────
// DM room key = sorted UIDs joined — same for both users
let dmRef = null;
let dmQuery = null; // BUG FIX: keep a handle to the exact query .on() was called on
let currentDmUid = null;

function getDMRoomKey(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ── DM INBOX ─────────────────────────────────────────────────────
function renderDMInbox() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) { renderLogin(); return; }

  $("#app").innerHTML = `
    <div class="glass-card overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b dark:border-zinc-800">
        <h2 class="text-lg font-bold">💬 Direct Messages</h2>
        <button onclick="renderNewDM()" class="text-sm btn-nova px-4 py-2">+ New Chat</button>
      </div>

      <!-- Conversation list -->
      <div id="dmList" class="divide-y dark:divide-zinc-800">
        <div class="space-y-3 p-4"><div class="skeleton h-14 w-full"></div><div class="skeleton h-14 w-full"></div><div class="skeleton h-14 w-full"></div></div>
      </div>
    </div>
  `;

  loadDMInbox(currentUser.uid);
}

function loadDMInbox(myUid) {
  const list = $("#dmList");
  if (!list) return;

  const emptyState = `
    <div class="p-8 text-center">
      <div class="text-4xl mb-3">💬</div>
      <p class="text-sm text-zinc-500">No conversations yet.</p>
      <p class="text-xs text-zinc-400 mt-1">Start chatting with your batchmates!</p>
      <button onclick="renderNewDM()" class="mt-3 text-sm text-orange-600 underline">Find someone to chat with</button>
    </div>`;

  // BUG FIX: see the big comment above indexDMRoom() in sendDM() — this used to read the
  // whole /dms tree and filter for rooms containing myUid, which the security rules
  // never actually permitted (nor should they — that would mean anyone could read
  // everyone's private DMs). Now it reads only this user's own short room-key index.
  firebase.database().ref(`dmIndex/${myUid}`).once('value', indexSnap => {
    if (!indexSnap.exists()) { list.innerHTML = emptyState; return; }

    const roomKeys = [];
    indexSnap.forEach(c => roomKeys.push(c.key));

    Promise.all(roomKeys.map(key =>
      firebase.database().ref(`dms/${key}/messages`).once('value').then(msgsSnap => ({ key, msgsSnap }))
    )).then(rooms => {
      const convos = [];
      rooms.forEach(({ key, msgsSnap }) => {
        let lastMsg = null;
        let unread = 0;
        msgsSnap.forEach(m => {
          const val = m.val();
          lastMsg = val;
          if (val.uid !== myUid && !val.read) unread++;
        });
        if (!lastMsg) return; // room was indexed but has no messages (shouldn't normally happen)
        convos.push({ key, lastMsg, unread, otherUid: key.replace(myUid, '').replace('_', '') });
      });

      if (!convos.length) { list.innerHTML = emptyState; return; }

      // Sort by latest message
      convos.sort((a, b) => (b.lastMsg?.timestamp || 0) - (a.lastMsg?.timestamp || 0));

      // Fetch other user's profile for each convo
      Promise.all(convos.map(c =>
        firebase.database().ref(`users/${c.otherUid}`).once('value')
          .then(s => ({ ...c, otherUser: s.val() || { displayName: 'Unknown' } }))
      )).then(convosWithUsers => {
        list.innerHTML = convosWithUsers.map(c => {
          const other = c.otherUser;
          const initials = (other.displayName || 'U')[0].toUpperCase();
          const timeStr = c.lastMsg ? formatDMTime(c.lastMsg.timestamp) : '';
          const lastText = c.lastMsg
            ? c.lastMsg.type === 'file' ? `📎 ${c.lastMsg.fileName}` : c.lastMsg.text
            : 'No messages yet';

          return `
          <div onclick="openDM('${c.otherUid}')"
               class="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
            <div class="relative flex-shrink-0" onclick="event.stopPropagation(); viewUserProfile('${c.otherUid}')" title="View profile">
              ${other.photoURL
                ? `<img src="${other.photoURL}" class="w-11 h-11 rounded-full object-cover" />`
                : `<div class="w-11 h-11 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center font-bold text-orange-700 dark:text-blue-200">${initials}</div>`}
              ${c.unread > 0 ? `<span class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] text-white" style="background:var(--nova-grad)">${c.unread}</span>` : ''}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-baseline">
                <p class="text-sm font-semibold truncate">${escapeHtml(other.displayName || 'Unknown')}</p>
                <span class="text-xs text-zinc-400 flex-shrink-0 ml-2">${timeStr}</span>
              </div>
              <p class="text-xs text-zinc-500 truncate ${c.unread > 0 ? 'font-medium text-zinc-700 dark:text-zinc-300' : ''}">${escapeHtml(lastText)}</p>
            </div>
          </div>`;
        }).join('');
      });
    });
  });
}

// ── FIND BATCHMATE ────────────────────────────────────────────────
function renderNewDM() {
  const p = getProfile();
  const currentUser = firebase.auth().currentUser;

  $("#app").innerHTML = `
    <div class="glass-card overflow-hidden">
      <div class="flex items-center gap-3 p-4 border-b dark:border-zinc-800">
        <button onclick="renderDMInbox()" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">←</button>
        <h2 class="text-base font-bold">New Message</h2>
      </div>

      <div class="p-4">
        <input id="dmSearch" placeholder="Search by name or roll code (e.g. 2023ucs1234)..." class="w-full input-nova px-3 py-2.5 text-sm mb-1" autofocus />
        <p class="text-xs text-zinc-400 mb-3">Search any student from any batch or year</p>
        <div id="dmUserList" class="space-y-1 max-h-[60vh] overflow-y-auto">
          <div class="text-sm text-zinc-400 text-center py-6">Loading students...</div>
        </div>
      </div>
    </div>
  `;

  loadBatchmates(p, currentUser);

  $("#dmSearch").oninput = function() {
    loadBatchmates(p, currentUser, this.value.trim().toLowerCase());
  };
}

function loadBatchmates(p, currentUser, query = '') {
  const list = $("#dmUserList");
  if (!list) return;
  list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-6">Searching...</div>';

  // If query looks like a roll code — use rollIndex for fast lookup
  const isRollCode = query && /^[a-z0-9]{8,15}$/.test(query) && /[0-9]/.test(query);

  if (isRollCode) {
    // Search rollIndex first
    firebase.database().ref('rollIndex').orderByValue().once('value', snap => {
      const matchUids = [];
      snap.forEach(c => {
        if (c.key.includes(query)) matchUids.push(c.val());
      });
      if (!matchUids.length) {
        list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-6">No student found with this roll code.</p>';
        return;
      }
      Promise.all(matchUids.map(uid =>
        firebase.database().ref('users/' + uid).once('value').then(s => ({ uid, ...s.val() }))
      )).then(users => renderUserList(users.filter(u => u.uid !== currentUser.uid), p, list));
    });
    return;
  }

  // General search — all users
  firebase.database().ref('users').once('value', snap => {
    const users = [];
    snap.forEach(c => {
      const u = { uid: c.key, ...c.val() };
      if (u.uid === currentUser.uid) return;
      if (query) {
        const q = query.toLowerCase();
        const matchName = (u.displayName || '').toLowerCase().includes(q);
        const matchRoll = (u.rollCode || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchEmail) return;
      }
      users.push(u);
    });
    renderUserList(users, p, list);
  });
}

function renderUserList(users, p, list) {
  if (!users.length) {
    list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-6">No students found.</p>';
    return;
  }

  // Sort: same batch first, then alphabetical
  users.sort((a, b) => {
    const aMatch = a.batch === p.batch && a.course === p.course;
    const bMatch = b.batch === p.batch && b.course === p.course;
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  list.innerHTML = users.map(u => {
    const initials = (u.displayName || 'U')[0].toUpperCase();
    const isSameBatch = u.batch === p.batch && u.course === p.course && u.program === p.program;
    const rollBadge = u.rollCode ? `<span class="font-mono text-orange-600 dark:text-pink-400">@${u.rollCode}</span>` : '';
    const batchInfo = u.program ? `${u.program}${u.batch ? ' · ' + u.batch : ''}` : '';

    return `
      <div onclick="openDM('${u.uid}')"
           class="flex items-center gap-3 p-3 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
        <span onclick="event.stopPropagation(); viewUserProfile('${u.uid}')" title="View profile" class="flex-shrink-0">
        ${u.photoURL
          ? `<img src="${u.photoURL}" class="w-10 h-10 rounded-full object-cover flex-shrink-0" />`
          : `<div class="w-10 h-10 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center font-bold text-orange-700 dark:text-blue-200 flex-shrink-0 text-sm">${initials}</div>`}
        </span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-sm font-medium truncate">${escapeHtml(u.displayName || 'Unknown')}</p>
            ${isSameBatch ? '<span class="text-xs bg-orange-100 dark:bg-pink-900 text-orange-600 dark:text-pink-300 px-1.5 py-0.5 rounded-full">Your Batch</span>' : ''}
          </div>
          <p class="text-xs text-zinc-400 truncate">${rollBadge}${batchInfo ? ' · ' + escapeHtml(batchInfo) : ''}</p>
        </div>
        <span class="text-orange-600 text-lg flex-shrink-0">→</span>
      </div>`;
  }).join('');
}

// ── OPEN DM CONVERSATION ─────────────────────────────────────────
let dmTypingRef = null;
let dmTypingTimeout = null;

async function openDM(otherUid) {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) { renderLogin(); return; }

  currentDmUid = otherUid;
  const roomKey = getDMRoomKey(currentUser.uid, otherUid);

  // Fetch other user's info
  const otherSnap = await firebase.database().ref(`users/${otherUid}`).once('value');
  const otherUser = otherSnap.val() || { displayName: 'Unknown' };
  const initials = (otherUser.displayName || 'U')[0].toUpperCase();

  // BUG FIX: the "Block" confirm dialog on a profile promises "they will not be able
  // to message you" but nothing ever actually enforced that — the DM screen worked
  // exactly the same whether blocked or not. Since a block list is only readable by
  // the person who made it (by design, so it stays private), this can only check the
  // direction I control: if *I* blocked them, sending is disabled here with a clear
  // banner and a one-tap unblock. (It can't check "did they block me" without exposing
  // their private block list, which would defeat the whole point of it being private.)
  const iBlockedThem = (await firebase.database().ref(`blocks/${currentUser.uid}/${otherUid}`).once('value')).exists();

  // Update URL without navigation
  history.pushState({}, '', `#dm-${otherUid}`);

  $("#app").innerHTML = `
    <div class="glass-card overflow-hidden flex flex-col" style="height: calc(100vh - 140px); min-height: 400px;">

      <!-- Header -->
      <div class="flex items-center gap-3 px-4 py-3 border-b dark:border-zinc-800 flex-shrink-0">
        <button onclick="renderDMInbox()" class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xl">←</button>
        ${otherUser.photoURL
          ? `<img src="${otherUser.photoURL}" class="w-9 h-9 rounded-full object-cover" />`
          : `<div class="w-9 h-9 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center font-bold text-orange-700 dark:text-blue-200 text-sm">${initials}</div>`}
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-sm cursor-pointer hover:underline" onclick="viewUserProfile('${otherUid}')" title="View profile">${escapeHtml(otherUser.displayName || 'Unknown')}</p>
          <p class="text-xs text-zinc-400" id="dmStatus">${otherUser.program || ''} ${otherUser.course ? '· ' + otherUser.course : ''}</p>
        </div>
      </div>

      <!-- Messages -->
      <div id="dmBox" class="flex-1 overflow-y-auto p-3 bg-white dark:bg-zinc-900 space-y-1">
        <div class="text-sm text-zinc-400 text-center py-8">Loading messages...</div>
      </div>

      <!-- Typing indicator -->
      <div id="dmTypingBar" class="hidden px-4 py-1 text-xs text-zinc-400 italic flex-shrink-0">${escapeHtml(otherUser.displayName)} is typing...</div>

      <!-- Reply preview -->
      <div id="dmReplyPreview" class="hidden px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-xs flex items-center justify-between gap-2 flex-shrink-0">
        <span id="dmReplyText" class="truncate text-zinc-600 dark:text-zinc-400"></span>
        <button onclick="cancelDMReply()" class="text-zinc-400 hover:text-red-400 flex-shrink-0">✕</button>
      </div>

      ${iBlockedThem ? `
      <!-- Blocked banner -->
      <div class="px-4 py-3 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800 flex-shrink-0 flex items-center justify-between gap-2">
        <span class="text-xs text-red-600 dark:text-red-300">🚫 You've blocked this user — unblock to message them.</span>
        <button onclick="unblockUser('${otherUid}'); openDM('${otherUid}');" class="text-xs underline text-red-600 dark:text-red-300 flex-shrink-0">Unblock</button>
      </div>` : `
      <!-- Input -->
      <div class="flex gap-2 p-3 border-t dark:border-zinc-800 flex-shrink-0">
        <label class="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm select-none flex-shrink-0" title="Attach file">
          📎<input type="file" id="dmFileInput" class="hidden" />
        </label>
        <input id="dmInput" placeholder="Message..." class="flex-1 input-nova px-3 py-2.5 text-sm" />
        <button id="dmSendBtn" onclick="sendDM()" class="btn-nova px-4 py-2 text-sm flex-shrink-0">Send</button>
      </div>`}
    </div>
  `;

  // Load messages
  if (dmQuery) dmQuery.off();
  if (dmRef) dmRef.off();
  dmRef = firebase.database().ref(`dms/${roomKey}/messages`);
  loadDMMessages(currentUser.uid);

  // Mark as read
  markDMRead(roomKey, currentUser.uid);

  // Typing indicator
  setupDMTyping(roomKey, currentUser.uid, otherUid);

  // Online/last seen status
  watchDMStatus(otherUid);

  // Input handlers (only present when not blocked)
  const input = $("#dmInput");
  if (input) {
    input.onkeypress = (e) => { if (e.key === 'Enter') sendDM(); };
    input.oninput = () => notifyTyping(roomKey, currentUser.uid);
  }

  // File attach
  const fileInput = $("#dmFileInput");
  if (fileInput) {
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) sendDMFile(file, roomKey, currentUser, otherUser);
      e.target.value = '';
    };
  }

  // Store room key for send function
  window._currentDMRoom = roomKey;
  window._dmOtherUser = otherUser;
  window._dmReplyingTo = null;
}

// ── LOAD MESSAGES ────────────────────────────────────────────────
function loadDMMessages(myUid) {
  const box = $("#dmBox");
  if (!box) return;
  box.innerHTML = '';

  dmQuery = dmRef.limitToLast(100);
  dmQuery.on('child_added', snap => {
    displayDMMessage(snap.val(), snap.key, myUid);
  });
  // BUG FIX: same class of bug as chat.js — deleteDMMessage() removed the row locally
  // for whoever clicked delete, but the other person's open DM never updated because
  // nothing listened for 'child_removed'. Now both sides see a delete immediately.
  dmQuery.on('child_removed', snap => {
    const el = document.querySelector(`[data-msg-id="${snap.key}"]`);
    if (el) el.remove();
  });

  setTimeout(() => {
    if (box && box.children.length === 0)
      box.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No messages yet. Say hi! 👋</div>';
  }, 2000);
}

function displayDMMessage(msgData, msgId, myUid) {
  const box = $("#dmBox");
  if (!box) return;

  const placeholder = box.querySelector('.text-zinc-400');
  if (placeholder) placeholder.remove();

  const isOwn = msgData.uid === myUid;
  const timeStr = formatDMTime(msgData.timestamp);

  const msg = document.createElement('div');
  msg.className = `flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`;
  msg.dataset.msgId = msgId;

  // Reply quote
  const replyHtml = msgData.replyTo ? `
    <div class="text-xs bg-black/10 dark:bg-white/10 rounded-lg px-2 py-1 mb-1 border-l-2 border-blue-400 max-w-full">
      <span class="font-semibold">${escapeHtml(msgData.replyTo.senderName)}:</span> ${escapeHtml(msgData.replyTo.text?.substring(0, 60) || '')}
    </div>` : '';

  if (msgData.type === 'file') {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(msgData.fileName || '');
    msg.innerHTML = `
      <div class="max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}">
        ${replyHtml}
        ${isImage
          ? `<a href="${msgData.fileUrl}" target="_blank"><img src="${msgData.fileUrl}" class="max-w-[200px] max-h-40 rounded-2xl object-cover" onerror="this.style.display='none'" /></a>`
          : `<a href="${msgData.fileUrl}" target="_blank"
               class="${isOwn ? 'bubble-mine text-white' : 'glass'} rounded-2xl px-3 py-2 flex items-center gap-2 no-underline text-sm">
               <span>📎</span>
               <span class="truncate max-w-32">${escapeHtml(msgData.fileName || 'File')}</span>
               <span class="opacity-70 text-xs">⬇</span>
             </a>`}
        <div class="flex items-center gap-1 mt-0.5 px-1">
          <span class="text-[10px] text-zinc-400">${timeStr}</span>
          ${isOwn ? `<button onclick="deleteDMMessage('${msgId}')" class="text-[10px] text-zinc-300 hover:text-red-400">🗑</button>` : ''}
        </div>
      </div>`;
  } else {
    msg.innerHTML = `
      <div class="max-w-[75%] flex flex-col ${isOwn ? 'items-end' : 'items-start'} group">
        ${replyHtml}
        <div class="${isOwn ? 'bubble-mine text-white rounded-2xl rounded-tr-sm' : 'glass rounded-2xl rounded-tl-sm'} px-3.5 py-2.5 text-sm leading-relaxed">
          ${escapeHtml(msgData.text)}
        </div>
        <div class="flex items-center gap-1 mt-0.5 px-1">
          <span class="text-[10px] text-zinc-400">${timeStr}</span>
          ${isOwn ? `
            ${msgData.read ? '<span class="text-[10px] text-pink-400" title="Seen">✓✓</span>' : '<span class="text-[10px] text-zinc-300">✓</span>'}
            <button onclick="deleteDMMessage('${msgId}')" class="text-[10px] text-zinc-300 hover:text-red-400 opacity-0 group-hover:opacity-100">🗑</button>
          ` : `<button onclick="setDMReply('${msgId}','${escapeHtml(msgData.text||'').replace(/'/g,"\\'")}','${escapeHtml(msgData.senderName||'')}')  " class="text-[10px] text-zinc-300 hover:text-pink-400 opacity-0 group-hover:opacity-100">↩</button>`}
        </div>
      </div>`;
  }

  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
}

// ── SEND DM ───────────────────────────────────────────────────────
function sendDM() {
  const input = $("#dmInput");
  // BUG FIX: `input?.value.trim()` only guards the .value access — if input is null
  // (e.g. the DM screen is currently showing the "blocked" banner instead of the input
  // box), .trim() would still be called on undefined and throw. Guard the whole chain.
  const val = input ? input.value.trim() : '';
  if (!val || !window._currentDMRoom) return;

  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;
  const p = getProfile();

  const box = $("#dmBox");
  const placeholder = box?.querySelector('.text-zinc-400');
  if (placeholder) placeholder.remove();

  const msgData = {
    type: 'text', text: val,
    uid: currentUser.uid,
    senderName: p.displayName || 'Student',
    timestamp: Date.now(), read: false
  };

  if (window._dmReplyingTo) {
    msgData.replyTo = window._dmReplyingTo;
    cancelDMReply();
  }

  dmRef.push(msgData).then(() => {
    input.value = '';
    indexDMRoom(window._currentDMRoom, currentUser.uid, currentDmUid);
  });
}

// BUG FIX (DM inbox never actually worked under the real security rules): loadDMInbox()
// used to read the ENTIRE /dms node and filter client-side for rooms containing your
// uid — but the rules only ever granted read access to a specific room path (rightly
// so; letting anyone read the whole /dms tree would mean anyone could read everyone's
// private messages). That mismatch meant the inbox has been silently failing with
// PERMISSION_DENIED this whole time. The fix: keep a tiny, per-user index of "which room
// keys am I part of" that only that user can read, populated here whenever either side
// of a conversation actually sends something. The inbox then reads its own short index
// instead of the whole collection, and fetches each individual room's data (which it IS
// allowed to read, since it's a participant) from there.
function indexDMRoom(roomKey, uidA, uidB) {
  if (!roomKey || !uidA || !uidB) return;
  firebase.database().ref(`dmIndex/${uidA}/${roomKey}`).set(true).catch(() => {});
  firebase.database().ref(`dmIndex/${uidB}/${roomKey}`).set(true).catch(() => {});
}

async function sendDMFile(file, roomKey, currentUser, otherUser) {
  const btn = $("#dmSendBtn");
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
  try {
    const p = getProfile();
    // DM images get the lightest compression (5% → quality 0.95) per spec;
    // non-image files go to the owner's Google Drive. No user login needed.
    const { url } = await uploadMedia(file, 'dm');
    await dmRef.push({
      type: 'file', fileName: file.name, fileSize: file.size, fileUrl: url,
      uid: currentUser.uid, senderName: p.displayName || 'Student',
      timestamp: Date.now(), read: false
    });
    indexDMRoom(roomKey, currentUser.uid, currentDmUid);
  } catch(err) { alert('File send failed: ' + err.message); }
  if (btn) { btn.textContent = 'Send'; btn.disabled = false; }
}

function deleteDMMessage(msgId) {
  if (!confirm('Delete this message?')) return;
  dmRef.child(msgId).remove();
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (el) el.remove();
}

// ── REPLY ─────────────────────────────────────────────────────────
function setDMReply(msgId, text, senderName) {
  window._dmReplyingTo = { msgId, text, senderName };
  const preview = $("#dmReplyPreview");
  const replyText = $("#dmReplyText");
  if (preview) preview.classList.remove('hidden');
  if (replyText) replyText.innerHTML = `↩ <strong>${escapeHtml(senderName)}:</strong> ${escapeHtml(text.substring(0,60))}`;
  $("#dmInput")?.focus();
}
function cancelDMReply() {
  window._dmReplyingTo = null;
  const p = $("#dmReplyPreview");
  if (p) p.classList.add('hidden');
}

// ── READ RECEIPTS ─────────────────────────────────────────────────
function markDMRead(roomKey, myUid) {
  firebase.database().ref(`dms/${roomKey}/messages`).once('value', snap => {
    const updates = {};
    snap.forEach(c => {
      const m = c.val();
      if (m.uid !== myUid && !m.read) updates[`${c.key}/read`] = true;
    });
    if (Object.keys(updates).length) firebase.database().ref(`dms/${roomKey}/messages`).update(updates).catch(() => {});
  });
}

// ── TYPING INDICATOR ─────────────────────────────────────────────
function notifyTyping(roomKey, myUid) {
  firebase.database().ref(`dms/${roomKey}/typing/${myUid}`).set(Date.now()).catch(() => {});
  clearTimeout(dmTypingTimeout);
  dmTypingTimeout = setTimeout(() => {
    firebase.database().ref(`dms/${roomKey}/typing/${myUid}`).remove().catch(() => {});
  }, 2000);
}

function setupDMTyping(roomKey, myUid, otherUid) {
  if (dmTypingRef) dmTypingRef.off();
  dmTypingRef = firebase.database().ref(`dms/${roomKey}/typing/${otherUid}`);
  dmTypingRef.on('value', snap => {
    const bar = $("#dmTypingBar");
    if (!bar) return;
    if (snap.exists() && Date.now() - snap.val() < 3000) {
      bar.classList.remove('hidden');
    } else {
      bar.classList.add('hidden');
    }
  });
}

// ── ONLINE STATUS ─────────────────────────────────────────────────
let dmStatusRef = null; // BUG FIX: this listener was never tracked or detached — every
// DM opened left a permanent 'value' listener on that user's lastSeen behind, so opening
// several conversations in a session meant several stacked, never-removed listeners.
function watchDMStatus(otherUid) {
  if (dmStatusRef) dmStatusRef.off();
  dmStatusRef = firebase.database().ref(`users/${otherUid}/lastSeen`);
  dmStatusRef.on('value', snap => {
    const statusEl = $("#dmStatus");
    if (!statusEl) return;
    const ls = snap.val();
    if (ls && Date.now() - ls < 120000) {
      statusEl.innerHTML = '<span class="text-green-500">● Online</span>';
    } else if (ls) {
      statusEl.textContent = `Last seen ${formatLastSeen(ls)}`;
    }
  });
}

// ── HELPERS ───────────────────────────────────────────────────────
function formatDMTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  const diff = now - d;
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString('en-IN', { weekday: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// NOTE: escapeHtml() lives in utils.js (loaded before this file) — removed the
// duplicate definition that used to be here to avoid two copies drifting apart.

function cleanupDM() {
  if (dmQuery) dmQuery.off();
  if (dmRef) dmRef.off();
  if (dmTypingRef) dmTypingRef.off();
  if (dmStatusRef) { dmStatusRef.off(); dmStatusRef = null; } // BUG FIX: see watchDMStatus()
  currentDmUid = null;
}
