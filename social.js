// ── LEADERBOARD ──────────────────────────────────────────────────

function renderLeaderboard() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const p = getProfile();

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div>
        <h2 class="text-lg font-bold">🏆 Leaderboard</h2>
        <p class="text-xs text-zinc-500">Top contributors in ${p.program || 'your'} · ${p.course || 'course'}</p>
      </div>

      <div class="flex gap-2 flex-wrap">
        <button onclick="switchLB('messages')" data-lb="messages" class="lb-btn text-xs px-3 py-1.5 pill-active">💬 Messages</button>
        <button onclick="switchLB('resources')" data-lb="resources" class="lb-btn text-xs px-3 py-1.5 pill">📚 Resources</button>
        <button onclick="switchLB('helpful')" data-lb="helpful" class="lb-btn text-xs px-3 py-1.5 pill">🤝 Helpful</button>
      </div>

      <div id="lbList" class="space-y-2">
        <div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>
      </div>
    </div>
  `;
  loadLeaderboard('messages');
}

function switchLB(type) {
  document.querySelectorAll('.lb-btn').forEach(btn => {
    btn.dataset.lb === type
      ? (btn.className = 'lb-btn text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'lb-btn text-xs px-3 py-1.5 pill');
  });
  loadLeaderboard(type);
}

async function loadLeaderboard(type) {
  const list = $("#lbList");
  if (!list) return;
  list.innerHTML = '<div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>';

  const p = getProfile();
  const roomKey = buildRoomKey(p.program, p.course, p.batch);
  const currentUser = firebase.auth().currentUser;

  try {
    let scores = {};

    if (type === 'messages') {
      const snap = await firebase.database().ref(`chats/${roomKey}/messages`).once('value');
      snap.forEach(c => {
        const m = c.val();
        if (!m.uid || !m.displayName) return;
        if (!scores[m.uid]) scores[m.uid] = { name: m.displayName, score: 0, uid: m.uid };
        scores[m.uid].score++;
      });
    } else if (type === 'resources') {
      const resKey = `${p.program}_${p.course}`.replace(/[^a-zA-Z0-9_]/g, '-');
      const snap = await firebase.database().ref(`resources/${resKey}`).once('value');
      snap.forEach(c => {
        const r = c.val();
        if (!r.uid || !r.uploadedBy) return;
        if (!scores[r.uid]) scores[r.uid] = { name: r.uploadedBy, score: 0, uid: r.uid };
        scores[r.uid].score++;
      });
    } else if (type === 'helpful') {
      // Count reactions received on messages
      const snap = await firebase.database().ref(`chats/${roomKey}/messages`).once('value');
      snap.forEach(c => {
        const m = c.val();
        if (!m.uid || !m.displayName || !m.reactions) return;
        if (!scores[m.uid]) scores[m.uid] = { name: m.displayName, score: 0, uid: m.uid };
        Object.values(m.reactions).forEach(users => {
          scores[m.uid].score += Object.keys(users).length;
        });
      });
    }

    const sorted = Object.values(scores).sort((a, b) => b.score - a.score).slice(0, 10);

    if (!sorted.length) {
      list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No data yet.</div>';
      return;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const typeLabels = { messages: 'messages', resources: 'uploads', helpful: 'reactions' };

    list.innerHTML = sorted.map((user, i) => {
      const isMe = currentUser && user.uid === currentUser.uid;
      const badge = getUserBadge(type, user.score);
      return `
        <div onclick="viewUserProfile('${user.uid}')" title="View profile" class="flex items-center gap-3 p-3 border rounded-xl dark:border-zinc-700 cursor-pointer hover:-translate-y-0.5 transition-transform ${isMe ? 'border-pink-300 dark:border-pink-700 bg-orange-50 dark:bg-pink-950' : ''}">
          <span class="text-xl flex-shrink-0 w-8 text-center">${medals[i] || `#${i+1}`}</span>
          <div class="w-9 h-9 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center font-bold text-orange-700 dark:text-pink-300 text-sm flex-shrink-0">
            ${user.name[0].toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold truncate">${escapeHtml(user.name)} ${isMe ? '(You)' : ''}</p>
            ${badge ? `<span class="text-xs">${badge}</span>` : ''}
          </div>
          <div class="text-right flex-shrink-0">
            <p class="font-bold text-orange-600">${user.score}</p>
            <p class="text-xs text-zinc-400">${typeLabels[type]}</p>
          </div>
        </div>`;
    }).join('');
  } catch(err) {
    list.innerHTML = '<div class="text-sm text-red-400 text-center py-6">Could not load leaderboard.</div>';
  }
}

// ── BADGES ───────────────────────────────────────────────────────

function getUserBadge(type, score) {
  if (type === 'messages') {
    if (score >= 500) return '👑 Legend';
    if (score >= 200) return '🔥 Super Active';
    if (score >= 100) return '⚡ Active';
    if (score >= 50) return '💬 Chatter';
    return '';
  }
  if (type === 'resources') {
    if (score >= 50) return '📚 Resource King';
    if (score >= 20) return '📖 Top Contributor';
    if (score >= 5) return '📝 Helper';
    return '';
  }
  if (type === 'helpful') {
    if (score >= 100) return '🌟 Campus Star';
    if (score >= 50) return '❤️ Most Helpful';
    if (score >= 20) return '👍 Appreciated';
    return '';
  }
  return '';
}

// ── GROUP VIDEO CALL ─────────────────────────────────────────────

function renderGroupCall() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const p = getProfile();
  const roomKey = buildRoomKey(p.program, p.course, p.batch);
  const jitsiRoom = `MujConnects-${roomKey}`.replace(/[^a-zA-Z0-9-]/g, '-');

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div>
        <h2 class="text-lg font-bold">📹 Group Video Call</h2>
        <p class="text-xs text-zinc-500">${p.program} · ${p.course} · Batch ${p.batch}</p>
      </div>

      <div class="bg-orange-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-xl p-4 space-y-3">
        <p class="text-sm font-medium">Your batch room is ready</p>
        <p class="text-xs text-zinc-500">Powered by Jitsi Meet — free, no signup needed for joiners</p>
        <div class="bg-white dark:bg-zinc-900 rounded-xl p-3 font-mono text-xs break-all text-zinc-600 dark:text-zinc-400 border dark:border-zinc-700">
          ${jitsiRoom}
        </div>
        <div class="flex gap-2 flex-wrap">
          <a href="https://meet.jit.si/${jitsiRoom}" target="_blank"
             class="flex-1 text-center text-sm btn-nova px-4 py-3 no-underline">
            📹 Join Video Call
          </a>
          <button onclick="copyCallLink('${jitsiRoom}')" class="px-4 py-2.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">
            📋 Copy Link
          </button>
        </div>
      </div>

      <!-- Share in chat -->
      <button onclick="shareCallInChat('${jitsiRoom}')" class="w-full text-sm border border-pink-300 dark:border-pink-700 text-orange-600 py-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-pink-950 transition-colors">
        💬 Share Call Link in Batch Chat
      </button>

      <!-- Instructions -->
      <div class="glass-card p-4 space-y-2">
        <p class="text-sm font-semibold">How to use:</p>
        <ol class="text-xs text-zinc-500 space-y-1 list-decimal list-inside">
          <li>Click "Join Video Call" — opens Jitsi Meet</li>
          <li>Allow camera & mic access</li>
          <li>Share the link with batchmates via "Share in Chat"</li>
          <li>Up to 100 people can join simultaneously</li>
          <li>No account needed for others to join</li>
        </ol>
      </div>

      <!-- Google Meet alternative -->
      <div class="glass-card p-4">
        <p class="text-sm font-semibold mb-2">Or use Google Meet</p>
        <a href="https://meet.google.com/new" target="_blank"
           class="block text-center text-sm border border-zinc-300 dark:border-zinc-700 px-4 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 no-underline text-zinc-700 dark:text-zinc-300">
          🎥 Start Google Meet
        </a>
      </div>
    </div>
  `;
}

function copyCallLink(room) {
  const url = `https://meet.jit.si/${room}`;
  navigator.clipboard.writeText(url).then(() => {
    alert('Call link copied! Share it with your batchmates.');
  });
}

async function shareCallInChat(room) {
  const url = `https://meet.jit.si/${room}`;
  const p = getProfile();
  const user = firebase.auth().currentUser;
  if (!user) { alert('Please login.'); return; }

  const roomKey = buildRoomKey(p.program, p.course, p.batch);
  const msgRef = firebase.database().ref(`chats/${roomKey}/messages`);

  await msgRef.push({
    type: 'text',
    text: `📹 Join our batch video call!\n${url}`,
    displayName: p.displayName || 'Student',
    email: user.email, uid: user.uid, timestamp: Date.now()
  });
  alert('Call link shared in chat! Go to Chat to see it.');
}

