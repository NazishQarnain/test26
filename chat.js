let messagesRef;
let messagesQuery; // BUG FIX: keep a handle to the exact query .on() was called on, so .off() reliably detaches it
let onlineRef;
let currentRoomKey = '';
let replyingTo = null; // for reply feature
const avatarCache = {};
const REACTIONS = ['👍','❤️','😂','😮','😢','🔥'];

async function getUserPhoto(uid) {
  if (avatarCache[uid] !== undefined) return avatarCache[uid];
  try {
    const snap = await firebase.database().ref('users/' + uid + '/photoURL').once('value');
    avatarCache[uid] = snap.val() || null;
  } catch(e) { avatarCache[uid] = null; }
  return avatarCache[uid];
}

// ── ONLINE PRESENCE ──────────────────────────────────────────────
let connectedRef = null; // BUG FIX: this '.info/connected' listener was created fresh on
// every chat entry and never detached — each visit stacked another one, and every old
// listener still pointed at its old room's online/ path, silently re-marking you
// "online" in rooms you'd already left whenever the connection blipped.
function setupPresence(roomKey) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const p = getProfile();
  const userOnlineRef = firebase.database().ref(`chats/${roomKey}/online/${user.uid}`);
  if (connectedRef) connectedRef.off();
  connectedRef = firebase.database().ref('.info/connected');
  connectedRef.on('value', snap => {
    if (!snap.val()) return;
    userOnlineRef.onDisconnect().remove();
    userOnlineRef.set({ displayName: p.displayName, photoURL: p.photoURL || null, at: Date.now() }).catch(() => {});
  });
  onlineRef = userOnlineRef;
}

function cleanupPresence() {
  if (onlineRef) onlineRef.remove().catch(() => {});
  if (connectedRef) { connectedRef.off(); connectedRef = null; }
}

// ── RENDER CHAT ──────────────────────────────────────────────────
function renderChat() {
  const p = getProfile();
  if (!isLoggedIn()) { renderLogin(); return; }
  if (!p.program || !p.course || !p.batch || !p.batchConfirmed) { renderHome(); return; }

  currentRoomKey = buildRoomKey(p.program, p.course, p.batch);
  const roomLabel = `${p.program} · ${p.course} · ${p.batch}`;

  $("#app").innerHTML = `
    <div class="glass-card p-4">
      <div class="flex justify-between items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 class="text-base font-bold">${roomLabel}</h3>
          <div id="onlineBar" class="text-xs text-green-500 mt-0.5"></div>
        </div>
        <div class="flex items-center gap-1 flex-wrap">
          <button onclick="switchChatTab('announcements')" id="tabAnnounce" class="chat-tab text-xs px-3 py-1.5 pill">📢 Notices</button>
          <button onclick="switchChatTab('polls')" id="tabPolls" class="chat-tab text-xs px-3 py-1.5 pill">📊 Polls</button>
          <button onclick="switchChatTab('files')" id="tabFiles" class="chat-tab text-xs px-3 py-1.5 pill">📁 Files</button>
          <button onclick="switchChatTab('chat')" id="tabChat" class="chat-tab text-xs px-3 py-1.5 pill-active">💬 Chat</button>
        </div>
      </div>

      <!-- CHAT PANEL -->
      <div id="panelChat">
        <div id="pinnedBar" class="hidden mb-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl text-xs text-yellow-800 dark:text-yellow-200"></div>
        <div id="chatBox" class="h-[52vh] overflow-y-auto glass p-3 mb-2">
          <div class="text-sm text-zinc-400 text-center py-4">Loading messages...</div>
        </div>
        <!-- Reply preview -->
        <div id="replyPreview" class="hidden mb-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs flex items-center justify-between gap-2">
          <span id="replyText" class="truncate text-zinc-600 dark:text-zinc-400"></span>
          <button onclick="cancelReply()" class="text-zinc-400 hover:text-red-400 flex-shrink-0">✕</button>
        </div>
        <!-- Input row -->
        <div class="flex gap-2">
          <input id="msgInput" placeholder="Type a message..." class="flex-1 input-nova px-3 py-2.5 text-sm" />
          <label class="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm select-none" title="Attach file">
            📎<input type="file" id="attachInput" class="hidden" />
          </label>
          <button id="sendBtn" class="btn-nova px-4 py-2 text-sm">Send</button>
        </div>
        <div class="flex gap-3 mt-2">
          <button onclick="toggleSearch()" class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">🔍 Search</button>
          <button onclick="requestNotificationPermission()" class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">🔔 Notifications</button>
        </div>
        <div id="searchBar" class="mt-2 hidden">
          <input id="searchInput" placeholder="Search messages..." class="w-full input-nova px-3 py-2.5 text-sm" />
          <div id="searchResults" class="mt-1 space-y-1 max-h-40 overflow-y-auto"></div>
        </div>
      </div>

      <!-- ANNOUNCEMENTS PANEL -->
      <div id="panelAnnouncements" class="hidden">
        ${isAdmin() ? `
        <div class="mb-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <p class="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-2">📢 Post Announcement (Admin)</p>
          <textarea id="announceInput" placeholder="Write announcement..." rows="3" class="w-full input-nova px-3 py-2.5 text-sm mb-2"></textarea>
          <button onclick="postAnnouncement()" class="btn-ghost px-4 py-1.5 text-sm font-semibold text-yellow-600 dark:text-yellow-400">Post</button>
        </div>` : ''}
        <div id="announceList" class="space-y-3 max-h-[55vh] overflow-y-auto">
          <div class="text-sm text-zinc-400 text-center py-8">Loading announcements...</div>
        </div>
      </div>

      <!-- POLLS PANEL -->
      <div id="panelPolls" class="hidden">
        ${isAdmin() ? `
        <div class="mb-3 p-3 bg-orange-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-xl">
          <p class="text-xs font-semibold text-orange-700 dark:text-pink-300 mb-2">📊 Create Poll (Admin)</p>
          <input id="pollQuestion" placeholder="Poll question..." class="w-full input-nova px-3 py-2.5 text-sm mb-2" />
          <div id="pollOptions">
            <input placeholder="Option 1" class="poll-opt w-full input-nova px-3 py-2.5 text-sm mb-1" />
            <input placeholder="Option 2" class="poll-opt w-full input-nova px-3 py-2.5 text-sm mb-1" />
          </div>
          <div class="flex gap-2 mt-1">
            <button onclick="addPollOption()" class="text-xs text-orange-600 underline">+ Add option</button>
            <button onclick="postPoll()" class="btn-nova px-4 py-1.5 text-sm ml-auto">Create Poll</button>
          </div>
        </div>` : ''}
        <div id="pollList" class="space-y-3 max-h-[55vh] overflow-y-auto">
          <div class="text-sm text-zinc-400 text-center py-8">Loading polls...</div>
        </div>
      </div>

      <!-- FILES PANEL -->
      <div id="panelFiles" class="hidden">
        <div id="dropZone" class="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-6 text-center mb-3 cursor-pointer hover:border-blue-400 transition-colors">
          <div class="text-3xl mb-2">📤</div>
          <p class="text-sm text-zinc-500">Drop files here or <span class="text-orange-600 underline" id="browseBtn">browse</span></p>
          <p class="text-xs text-zinc-400 mt-1">Max 50MB per file</p>
          <input type="file" id="fileUploadInput" class="hidden" multiple />
        </div>
        <div id="uploadProgress" class="hidden mb-3 flex items-center gap-2 text-sm text-zinc-500">
          <div class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          <span id="uploadStatus">Uploading...</span>
        </div>
        <div id="fileList" class="space-y-2 max-h-[50vh] overflow-y-auto">
          <div class="text-sm text-zinc-400 text-center py-6">Loading files...</div>
        </div>
      </div>
    </div>
  `;

  if (messagesQuery) messagesQuery.off();
  if (messagesRef) messagesRef.off();
  messagesRef = firebase.database().ref('chats/' + currentRoomKey + '/messages');
  loadMessages();
  loadPinnedMessage();
  setupPresence(currentRoomKey);
  setupOnlineCounter();

  $("#sendBtn").onclick = sendMessage;
  $("#msgInput").onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
  $("#attachInput").onchange = (e) => {
    const file = e.target.files[0];
    if (file) uploadAndShareInChat(file);
    e.target.value = '';
  };

  const uploadInput = $("#fileUploadInput");
  if (uploadInput) {
    $("#browseBtn").onclick = () => uploadInput.click();
    $("#dropZone").onclick = (e) => { if (e.target.id !== 'browseBtn') uploadInput.click(); };
    uploadInput.onchange = (e) => handleFileUpload(Array.from(e.target.files));
    const dz = $("#dropZone");
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add('border-blue-500'); };
    dz.ondragleave = () => dz.classList.remove('border-blue-500');
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove('border-blue-500'); handleFileUpload(Array.from(e.dataTransfer.files)); };
  }
}

function switchChatTab(tab) {
  ['chat','announcements','polls','files'].forEach(t => {
    const panel = $(`#panel${t.charAt(0).toUpperCase()+t.slice(1)}`);
    const btn = $(`#tab${t.charAt(0).toUpperCase()+t.slice(1)}`);
    if (!panel || !btn) return;
    if (t === tab) {
      panel.classList.remove('hidden');
      btn.className = 'chat-tab text-xs px-3 py-1.5 pill-active';
    } else {
      panel.classList.add('hidden');
      btn.className = 'chat-tab text-xs px-3 py-1.5 pill';
    }
  });
  if (tab === 'announcements') loadAnnouncements();
  if (tab === 'polls') loadPolls();
  if (tab === 'files') loadFileList();
}

// ── ONLINE STATUS ────────────────────────────────────────────────
function setupOnlineCounter() {
  firebase.database().ref(`chats/${currentRoomKey}/online`).on('value', snap => {
    const bar = $("#onlineBar");
    if (!bar) return;
    const users = [];
    snap.forEach(c => users.push(c.val().displayName));
    bar.textContent = users.length > 0 ? `🟢 ${users.length} online` : '';
    bar.title = users.join(', ');
  });
}

// ── SEARCH ───────────────────────────────────────────────────────
function toggleSearch() {
  const bar = $("#searchBar");
  bar.classList.toggle('hidden');
  if (!bar.classList.contains('hidden')) $("#searchInput").focus();
  $("#searchInput").oninput = function() {
    const q = this.value.trim().toLowerCase();
    const results = $("#searchResults");
    if (!q) { results.innerHTML = ''; return; }
    messagesRef.once('value', snap => {
      const msgs = [];
      snap.forEach(child => {
        const m = child.val();
        if (m.type === 'text' && m.text && m.text.toLowerCase().includes(q)) msgs.push(m);
      });
      if (!msgs.length) { results.innerHTML = '<p class="text-xs text-zinc-400 px-2">No results</p>'; return; }
      results.innerHTML = msgs.slice(-10).map(m => `
        <div class="px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
          <span class="font-medium">${escapeHtml(m.displayName)}</span>: ${escapeHtml(m.text)}
        </div>`).join('');
    });
  };
}

// ── REPLY ────────────────────────────────────────────────────────
function setReply(msgId, text, senderName) {
  replyingTo = { msgId, text, senderName };
  const preview = $("#replyPreview");
  const replyText = $("#replyText");
  if (preview && replyText) {
    preview.classList.remove('hidden');
    replyText.innerHTML = `↩ <strong>${escapeHtml(senderName)}:</strong> ${escapeHtml(text.substring(0, 60))}${text.length > 60 ? '...' : ''}`;
  }
  $("#msgInput").focus();
}

function cancelReply() {
  replyingTo = null;
  const preview = $("#replyPreview");
  if (preview) preview.classList.add('hidden');
}

// ── REACTIONS ────────────────────────────────────────────────────
function toggleReactionPicker(msgId, btnEl) {
  // Remove any existing picker
  document.querySelectorAll('.reaction-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'reaction-picker absolute z-20 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-2xl shadow-lg p-2 flex gap-1';
  picker.style.bottom = '24px';
  picker.style.left = '0';

  REACTIONS.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.className = 'text-lg hover:scale-125 transition-transform px-1';
    btn.onclick = (e) => {
      e.stopPropagation();
      addReaction(msgId, emoji);
      picker.remove();
    };
    picker.appendChild(btn);
  });

  btnEl.parentElement.style.position = 'relative';
  btnEl.parentElement.appendChild(picker);

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', () => picker.remove(), { once: true });
  }, 0);
}

function addReaction(msgId, emoji) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const reactionRef = firebase.database().ref(`chats/${currentRoomKey}/messages/${msgId}/reactions/${emoji}/${user.uid}`);
  reactionRef.once('value', snap => {
    const action = snap.exists() ? reactionRef.remove() : reactionRef.set(true);
    action.catch(err => console.error('[MujConnects] Reaction failed:', err));
  });
}

function renderReactions(reactions, msgId) {
  if (!reactions) return '';
  const user = firebase.auth().currentUser;
  const entries = Object.entries(reactions);
  if (!entries.length) return '';
  return `<div class="flex flex-wrap gap-1 mt-1">
    ${entries.map(([emoji, users]) => {
      const count = Object.keys(users).length;
      if (!count) return '';
      const iMine = user && users[user.uid];
      return `<button onclick="addReaction('${msgId}','${emoji}')"
        class="text-xs px-1.5 py-0.5 rounded-full border ${iMine ? 'bg-orange-100 dark:bg-pink-900 border-pink-300 dark:border-pink-700' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'} hover:scale-110 transition-transform">
        ${emoji} ${count}
      </button>`;
    }).join('')}
  </div>`;
}

// ── ANNOUNCEMENTS ────────────────────────────────────────────────
function postAnnouncement() {
  if (!isAdmin()) return;
  const text = $("#announceInput").value.trim();
  if (!text) return;
  const user = firebase.auth().currentUser;
  firebase.database().ref(`chats/${currentRoomKey}/announcements`).push({
    text, displayName: getProfile().displayName, uid: user.uid, timestamp: Date.now(), pinned: false
  }).then(() => { $("#announceInput").value = ''; loadAnnouncements(); })
    .catch(err => alert('Could not post announcement: ' + err.message + adminPermissionHint(err)));
}

function loadAnnouncements() {
  const list = $("#announceList");
  if (!list) return;
  firebase.database().ref(`chats/${currentRoomKey}/announcements`).orderByChild('timestamp').once('value', snap => {
    if (!snap.exists()) { list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-8">No announcements yet.</p>'; return; }
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    list.innerHTML = items.reverse().map(a => `
      <div class="glass-card p-4 ${a.pinned ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1">
            ${a.pinned ? '<span class="text-xs text-yellow-600 font-semibold">📌 Pinned</span><br/>' : ''}
            <p class="text-sm">${escapeHtml(a.text)}</p>
            <p class="text-xs text-zinc-400 mt-1">${escapeHtml(a.displayName)} · ${new Date(a.timestamp).toLocaleDateString('en-IN')}</p>
          </div>
          ${isAdmin() ? `
          <div class="flex gap-1 flex-shrink-0">
            <button onclick="pinAnnouncement('${a.id}', ${!a.pinned})" class="text-xs px-2 py-1 rounded-lg border dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700">${a.pinned ? 'Unpin' : '📌 Pin'}</button>
            <button onclick="deleteAnnouncement('${a.id}')" class="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-950">🗑</button>
          </div>` : ''}
        </div>
      </div>`).join('');
  });
}

function pinAnnouncement(id, pin) {
  firebase.database().ref(`chats/${currentRoomKey}/announcements/${id}`).update({ pinned: pin })
    .then(loadAnnouncements)
    .catch(err => alert('Could not update announcement: ' + err.message + adminPermissionHint(err)));
}
function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  firebase.database().ref(`chats/${currentRoomKey}/announcements/${id}`).remove()
    .then(loadAnnouncements)
    .catch(err => alert('Could not delete announcement: ' + err.message + adminPermissionHint(err)));
}

// ── PIN MESSAGE ──────────────────────────────────────────────────
function pinMessage(msgId, text, senderName) {
  if (!isAdmin()) return;
  firebase.database().ref(`chats/${currentRoomKey}/pinnedMessage`).set({ msgId, text, senderName, at: Date.now() })
    .catch(err => alert('Could not pin message: ' + err.message + adminPermissionHint(err)));
}
function loadPinnedMessage() {
  firebase.database().ref(`chats/${currentRoomKey}/pinnedMessage`).on('value', snap => {
    const bar = $("#pinnedBar");
    if (!bar) return;
    if (snap.exists()) {
      const d = snap.val();
      bar.classList.remove('hidden');
      bar.innerHTML = `📌 <strong>${escapeHtml(d.senderName)}:</strong> ${escapeHtml(d.text)} ${isAdmin() ? `<button onclick="unpinMessage()" class="ml-2 underline text-yellow-600">Unpin</button>` : ''}`;
    } else {
      bar.classList.add('hidden');
    }
  });
}
function unpinMessage() {
  firebase.database().ref(`chats/${currentRoomKey}/pinnedMessage`).remove()
    .catch(err => alert('Could not unpin message: ' + err.message + adminPermissionHint(err)));
}

// ── POLLS ────────────────────────────────────────────────────────
function addPollOption() {
  const container = $("#pollOptions");
  const count = container.querySelectorAll('.poll-opt').length + 1;
  const inp = document.createElement('input');
  inp.placeholder = `Option ${count}`;
  inp.className = 'poll-opt w-full input-nova px-3 py-2.5 text-sm mb-1';
  container.appendChild(inp);
}
function postPoll() {
  if (!isAdmin()) return;
  const question = $("#pollQuestion").value.trim();
  const opts = Array.from(document.querySelectorAll('.poll-opt')).map(i => i.value.trim()).filter(Boolean);
  if (!question || opts.length < 2) { alert('Add a question and at least 2 options.'); return; }
  const user = firebase.auth().currentUser;
  const options = {};
  opts.forEach((o, i) => { options[`opt${i}`] = { text: o, votes: {} }; });
  firebase.database().ref(`chats/${currentRoomKey}/polls`).push({
    question, options, uid: user.uid, displayName: getProfile().displayName, timestamp: Date.now(), active: true
  }).then(() => { $("#pollQuestion").value = ''; loadPolls(); })
    .catch(err => alert('Could not create poll: ' + err.message + adminPermissionHint(err)));
}
function votePoll(pollId, optKey) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const pollRef = firebase.database().ref(`chats/${currentRoomKey}/polls/${pollId}/options`);
  pollRef.once('value', snap => {
    const updates = {};
    snap.forEach(opt => { updates[`${opt.key}/votes/${user.uid}`] = null; });
    updates[`${optKey}/votes/${user.uid}`] = true;
    pollRef.update(updates).then(loadPolls).catch(err => alert('Could not vote: ' + err.message));
  });
}
function loadPolls() {
  const list = $("#pollList");
  if (!list) return;
  const user = firebase.auth().currentUser;
  firebase.database().ref(`chats/${currentRoomKey}/polls`).orderByChild('timestamp').once('value', snap => {
    if (!snap.exists()) { list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-8">No polls yet.</p>'; return; }
    const polls = [];
    snap.forEach(c => polls.push({ id: c.key, ...c.val() }));
    list.innerHTML = polls.reverse().map(poll => {
      const opts = Object.entries(poll.options || {});
      const totalVotes = opts.reduce((s, [, o]) => s + Object.keys(o.votes || {}).length, 0);
      const myVote = opts.find(([, o]) => o.votes && o.votes[user.uid]);
      return `
        <div class="glass-card p-4">
          <p class="text-sm font-semibold mb-3">${escapeHtml(poll.question)}</p>
          <div class="space-y-2">
            ${opts.map(([key, opt]) => {
              const count = Object.keys(opt.votes || {}).length;
              const pct = totalVotes ? Math.round(count / totalVotes * 100) : 0;
              const voted = myVote && myVote[0] === key;
              return `<button onclick="votePoll('${poll.id}','${key}')" class="w-full text-left">
                <div class="flex justify-between text-xs mb-1">
                  <span class="${voted ? 'font-semibold text-orange-600' : ''}">${voted ? '✓ ' : ''}${escapeHtml(opt.text)}</span>
                  <span class="text-zinc-400">${count} (${pct}%)</span>
                </div>
                <div class="h-2 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
                  <div class="h-full rounded-full" style="width:${pct}%;${voted ? 'background:var(--nova-grad)' : 'background:var(--border)'}"></div>
                </div>
              </button>`;
            }).join('')}
          </div>
          <p class="text-xs text-zinc-400 mt-2">${totalVotes} vote${totalVotes !== 1 ? 's' : ''} · ${escapeHtml(poll.displayName)}</p>
          ${isAdmin() ? `<button onclick="deletePoll('${poll.id}')" class="text-xs text-red-400 underline mt-1">Delete poll</button>` : ''}
        </div>`;
    }).join('');
  });
}
function deletePoll(id) {
  if (!confirm('Delete this poll?')) return;
  firebase.database().ref(`chats/${currentRoomKey}/polls/${id}`).remove()
    .then(loadPolls)
    .catch(err => alert('Could not delete poll: ' + err.message + adminPermissionHint(err)));
}

// ── MESSAGES ─────────────────────────────────────────────────────
function loadMessages() {
  const chatBox = $("#chatBox");
  chatBox.innerHTML = '';
  // PERFORMANCE FIX: sendBroadcast() used to fetch the entire `chats` tree (every
  // message in every room) just to read off the room *names* — that gets slower and
  // more expensive the more the app is used. Recording each active room's key here in a
  // tiny, dedicated index means broadcast only ever needs to read that short list.
  firebase.database().ref(`roomIndex/${currentRoomKey}`).set(true).catch(() => {});
  messagesQuery = messagesRef.limitToLast(80);
  messagesQuery.on('child_added', snap => { displayMessage(snap.val(), snap.key); });
  // BUG FIX: deleteMessage() only ever removed the row from the DOM of the person
  // who clicked delete (plus writing the Firebase remove). No 'child_removed' listener
  // was ever registered, so everyone else who had the chat open kept seeing the
  // "deleted" message until they left and re-entered the room. This listener keeps
  // every open chat in sync in real time.
  messagesQuery.on('child_removed', snap => {
    const el = document.querySelector(`[data-msg-id="${snap.key}"]`);
    if (el) el.remove();
  });
  // Live reaction updates
  messagesQuery.on('child_changed', snap => {
    const msgData = snap.val();
    const msgId = snap.key;
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el) {
      const reactionEl = el.querySelector('.reaction-row');
      if (reactionEl) reactionEl.innerHTML = renderReactions(msgData.reactions, msgId);
    }
  });
  setTimeout(() => {
    if (chatBox && chatBox.children.length === 0)
      chatBox.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No messages yet. Say hello! 👋</div>';
  }, 2500);
}

function sendMessage() {
  const msgInput = $("#msgInput");
  const val = msgInput.value.trim();
  if (!val) return;
  const p = getProfile();
  const user = firebase.auth().currentUser;
  if (!user) { alert('Please login again.'); return; }

  const expectedRoom = buildRoomKey(p.program, p.course, p.batch);
  if (currentRoomKey !== expectedRoom) { alert('You can only send messages in your own batch room.'); return; }

  const chatBox = $("#chatBox");
  const placeholder = chatBox.querySelector('.text-zinc-400');
  if (placeholder) placeholder.remove();

  const msgData = {
    type: 'text', text: val,
    displayName: p.displayName || 'Student',
    email: user.email, uid: user.uid, timestamp: Date.now()
  };

  // Attach reply info if replying
  if (replyingTo) {
    msgData.replyTo = {
      msgId: replyingTo.msgId,
      text: replyingTo.text.substring(0, 100),
      senderName: replyingTo.senderName
    };
    cancelReply();
  }

  messagesRef.push(msgData)
    .then(() => { msgInput.value = ''; })
    .catch(err => alert('Failed to send: ' + err.message));
}

function displayMessage(msgData, msgId) {
  const chatBox = $("#chatBox");
  if (!chatBox) return;
  const placeholder = chatBox.querySelector('.text-zinc-400');
  if (placeholder) placeholder.remove();

  const currentUser = firebase.auth().currentUser;
  const isOwn = currentUser && msgData.uid === currentUser.uid;
  const timeStr = new Date(msgData.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  // BUG FIX (message ordering — "latest message shows up top/middle instead of at the
  // bottom"): this used to `await getUserPhoto(msgData.uid)` — a Firebase read — BEFORE
  // building and inserting the message's DOM node. Firebase fires 'child_added' events
  // in the correct chronological order, but the caller never awaited this function, so
  // several displayMessage() calls (e.g. the initial batch of up to 80 messages on
  // opening a chat, or two messages arriving close together) were all running
  // concurrently. Whichever one's photo lookup happened to resolve first got
  // appendChild'd first — regardless of which message was actually older. A sender
  // whose avatar was already cached would "win the race" and appear to jump ahead of an
  // earlier message still waiting on its own (uncached) photo lookup. Now the DOM node
  // is built and inserted immediately with a placeholder avatar — synchronously, in the
  // exact order Firebase delivered the events — and the real photo is patched in
  // afterward without affecting where the message sits.
  const initials = (msgData.displayName || 'S').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const placeholderAvatarHtml = `<div class="w-7 h-7 rounded-full bg-orange-100 dark:bg-blue-800 flex items-center justify-center text-[10px] font-bold text-orange-700 dark:text-blue-200 flex-shrink-0" data-avatar-for="${msgId}">${initials}</div>`;
  const ownPhotoURL = isOwn ? getProfile().photoURL : null;
  // Avatar + name now open the sender's public profile (own avatar opens yours)
  const profileClick = `onclick="viewUserProfile('${msgData.uid}')" style="cursor:pointer"`;
  const avatarHtml = `<span ${profileClick} title="View profile">${ownPhotoURL
    ? `<img src="${ownPhotoURL}" class="w-7 h-7 rounded-full object-cover flex-shrink-0" data-avatar-for="${msgId}" />`
    : placeholderAvatarHtml}</span>`;

  const msg = document.createElement("div");
  msg.className = `mt-3 flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : ''}`;
  msg.dataset.msgId = msgId;

  // Action buttons
  const replyBtn = `<button onclick="setReply('${msgId}','${escapeHtml(msgData.text || '').replace(/'/g,"\\'")}','${escapeHtml(msgData.displayName)}')" class="text-[10px] text-zinc-300 hover:text-pink-400 px-1" title="Reply">↩</button>`;
  const reactBtn = `<button onclick="toggleReactionPicker('${msgId}', this)" class="text-[10px] text-zinc-300 hover:text-yellow-400 px-1" title="React">😊</button>`;
  const pinBtn = isAdmin() && msgData.type === 'text'
    ? `<button onclick="pinMessage('${msgId}','${escapeHtml(msgData.text||'').replace(/'/g,"\\'")}','${escapeHtml(msgData.displayName)}')" class="text-[10px] text-zinc-300 hover:text-yellow-400 px-1" title="Pin">📌</button>`
    : '';
  const deleteBtn = isOwn
    ? `<button onclick="deleteMessage('${msgId}')" class="text-[10px] text-zinc-300 hover:text-red-400 px-1" title="Delete">🗑</button>`
    : '';

  // Reply quote
  const replyQuoteHtml = msgData.replyTo ? `
    <div class="text-xs bg-zinc-200 dark:bg-zinc-700 rounded-lg px-2 py-1 mb-1 border-l-2 border-blue-400">
      <span class="font-semibold">${escapeHtml(msgData.replyTo.senderName)}</span>: ${escapeHtml(msgData.replyTo.text)}
    </div>` : '';

  // Reactions row
  const reactionsHtml = `<div class="reaction-row">${renderReactions(msgData.reactions, msgId)}</div>`;

  if (msgData.type === 'file') {
    const icon = getFileIcon(msgData.fileName || '');
    const size = msgData.fileSize ? formatBytes(msgData.fileSize) : '';
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(msgData.fileName || '');
    const fileContent = isImage
      ? `<a href="${msgData.fileUrl}" target="_blank" class="block">
           <img src="${msgData.fileUrl}" alt="${escapeHtml(msgData.fileName)}"
             class="max-w-[220px] max-h-48 rounded-xl object-cover hover:opacity-90 transition-opacity cursor-pointer"
             onerror="this.style.display='none'" />
         </a>`
      : `<a href="${msgData.fileUrl}" target="_blank"
           class="${isOwn ? 'bg-orange-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800' : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'} border rounded-xl px-3 py-2 flex items-center gap-2 hover:opacity-80 transition-opacity no-underline">
          <span class="text-xl">${icon}</span>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate text-zinc-900 dark:text-zinc-100">${escapeHtml(msgData.fileName || 'File')}</p>
            ${size ? `<p class="text-xs text-zinc-400">${size}</p>` : ''}
          </div>
          <span class="text-orange-600 text-xs ml-1">⬇</span>
        </a>`;
    msg.innerHTML = `
      ${avatarHtml}
      <div class="flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]">
        <div class="text-xs font-semibold mb-1 text-zinc-500 px-1 cursor-pointer hover:underline" onclick="viewUserProfile('${msgData.uid}')" title="View profile">${isOwn ? 'You' : escapeHtml(msgData.displayName)}</div>
        ${replyQuoteHtml}
        ${fileContent}
        ${isImage ? `<p class="text-xs text-zinc-400 mt-1">${escapeHtml(msgData.fileName||'')} ${size ? '· '+size : ''}</p>` : ''}
        ${reactionsHtml}
        <div class="text-[10px] text-zinc-400 mt-1 px-1 flex items-center gap-1">${timeStr} ${reactBtn} ${replyBtn} ${deleteBtn}</div>
      </div>`;
  } else {
    msg.innerHTML = `
      ${avatarHtml}
      <div class="flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]">
        <div class="text-xs font-semibold mb-1 text-zinc-500 px-1 cursor-pointer hover:underline" onclick="viewUserProfile('${msgData.uid}')" title="View profile">${isOwn ? 'You' : escapeHtml(msgData.displayName)}</div>
        ${replyQuoteHtml}
        <div class="${isOwn ? 'bubble-mine text-white' : 'glass'} px-3.5 py-2.5 rounded-2xl ${isOwn ? 'rounded-tr-sm' : 'rounded-tl-sm'} text-sm leading-relaxed">
          ${escapeHtml(msgData.text)}
        </div>
        ${reactionsHtml}
        <div class="text-[10px] text-zinc-400 mt-1 px-1 flex items-center gap-1">${timeStr} ${reactBtn} ${replyBtn} ${pinBtn} ${deleteBtn}</div>
      </div>`;
  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Fetch the sender's real photo (if any) AFTER the message is already in its correct
  // place, and swap it in without moving/reordering anything.
  if (!isOwn) {
    getUserPhoto(msgData.uid).then(photoURL => {
      if (!photoURL) return;
      const el = chatBox.querySelector(`[data-avatar-for="${msgId}"]`);
      if (el && el.tagName !== 'IMG') {
        const img = document.createElement('img');
        img.src = photoURL;
        img.className = 'w-7 h-7 rounded-full object-cover flex-shrink-0';
        img.dataset.avatarFor = msgId;
        el.replaceWith(img);
      }
    }).catch(() => {});
  }

  if (!isOwn) {
    showNotification(`MujConnects — ${msgData.displayName}`, msgData.type === 'file' ? `📎 ${msgData.fileName}` : msgData.text);
  }
}

function deleteMessage(msgId) {
  if (!confirm('Delete this message?')) return;
  messagesRef.child(msgId).remove().catch(err => alert('Could not delete: ' + err.message));
  const el = document.querySelector(`[data-msg-id="${msgId}"]`);
  if (el) el.remove();
}

// ── FILE UPLOADS (ImgBB images / Google Drive files) ─────────────
// Puter.js is gone: images are compressed per-context and hosted on ImgBB;
// other files go to the owner's Google Drive via the Apps Script bridge
// (see utils.js uploadMedia / DRIVE_SETUP.md). Neither needs any user login.
// The Files tab is now driven by lightweight metadata stored in Firebase at
// chats/{room}/files — previously it listed a Puter folder, which stopped
// making sense once files live on Drive/ImgBB.

function recordRoomFile(fileName, fileSize, fileUrl, uid, displayName) {
  firebase.database().ref(`chats/${currentRoomKey}/files`).push({
    fileName, fileSize, fileUrl, uid, displayName, timestamp: Date.now()
  }).catch(() => {});
}

async function handleFileUpload(files) {
  if (!files.length) return;
  const progressEl = $("#uploadProgress");
  const statusEl = $("#uploadStatus");
  progressEl.classList.remove('hidden');
  for (const file of files) {
    statusEl.textContent = `Uploading ${file.name}...`;
    try {
      const { url } = await uploadMedia(file, 'chat');
      const user = firebase.auth().currentUser;
      const p = getProfile();
      if (messagesRef && user) {
        await messagesRef.push({ type: 'file', fileName: file.name, fileSize: file.size, fileUrl: url, displayName: p.displayName || 'Student', uid: user.uid, timestamp: Date.now() });
        recordRoomFile(file.name, file.size, url, user.uid, p.displayName || 'Student');
      }
    } catch (err) { alert(`Failed to upload ${file.name}: ${err.message}`); }
  }
  progressEl.classList.add('hidden');
  loadFileList();
}

async function uploadAndShareInChat(file) {
  const sendBtn = $("#sendBtn");
  sendBtn.textContent = '⏳'; sendBtn.disabled = true;
  try {
    const { url } = await uploadMedia(file, 'chat');
    const p = getProfile();
    const user = firebase.auth().currentUser;
    await messagesRef.push({ type: 'file', fileName: file.name, fileSize: file.size, fileUrl: url, displayName: p.displayName || 'Student', uid: user.uid, timestamp: Date.now() });
    recordRoomFile(file.name, file.size, url, user.uid, p.displayName || 'Student');
  } catch (err) { alert('File share failed: ' + err.message); }
  sendBtn.textContent = 'Send'; sendBtn.disabled = false;
}

function loadFileList() {
  const fileList = $("#fileList");
  if (!fileList) return;
  fileList.innerHTML = '<div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>';
  firebase.database().ref(`chats/${currentRoomKey}/files`).orderByChild('timestamp').once('value', snap => {
    if (!snap.exists()) { fileList.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No files yet. Upload the first one! 📂</div>'; return; }
    const items = [];
    snap.forEach(ch => items.push({ id: ch.key, ...ch.val() }));
    items.reverse(); // newest first
    fileList.innerHTML = items.map(item => {
      const icon = getFileIcon(item.fileName);
      const size = item.fileSize ? formatBytes(item.fileSize) : '';
      return `
        <div class="flex items-center gap-3 p-3 glass-card hover:-translate-y-0.5 transition-transform group">
          <span class="text-2xl flex-shrink-0">${icon}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">${escapeHtml(item.fileName)}</p>
            <p class="text-xs text-zinc-400">${size}${item.displayName ? ' · ' + escapeHtml(item.displayName) : ''}</p>
          </div>
          <a href="${item.fileUrl}" target="_blank" rel="noopener"
            class="opacity-0 group-hover:opacity-100 text-xs btn-nova px-3 py-1.5 transition-all no-underline">⬇ Download</a>
        </div>`;
    }).join('');
  }, () => { fileList.innerHTML = '<div class="text-sm text-red-400 text-center py-6">Could not load files.</div>'; });
}

// ── HELPERS ──────────────────────────────────────────────────────
function cleanupChat() {
  if (messagesQuery) messagesQuery.off();
  if (messagesRef) messagesRef.off();
  cleanupPresence();
  try {
    firebase.database().ref(`chats/${currentRoomKey}/online`).off();
    firebase.database().ref(`chats/${currentRoomKey}/pinnedMessage`).off();
  } catch(e) {}
  replyingTo = null;
}
