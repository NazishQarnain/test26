// ── EXAM COUNTDOWN ───────────────────────────────────────────────
function renderExamCountdown() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const p = getProfile();
  const examsRef = firebase.database().ref(`exams/${buildRoomKey(p.program, p.course, p.batch)}`);

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">⏳ Exam Countdown</h2>
          <p class="text-xs text-zinc-500">Upcoming exams for your batch</p>
        </div>
        ${isAdmin() ? `<button onclick="showAddExam()" class="text-sm btn-nova px-4 py-2">+ Add Exam</button>` : ''}
      </div>

      <!-- Add exam form (admin only, hidden by default) -->
      <div id="examForm" class="hidden glass-card p-4 bg-zinc-50 dark:bg-zinc-900 space-y-3">
        <h3 class="text-sm font-semibold">Add Exam</h3>
        <input id="examName" placeholder="Exam name (e.g. DSA Mid-term)" class="w-full input-nova px-3 py-2.5 text-sm" />
        <input id="examDate" type="datetime-local" class="w-full input-nova px-3 py-2.5 text-sm" />
        <input id="examVenue" placeholder="Venue (optional)" class="w-full input-nova px-3 py-2.5 text-sm" />
        <div class="flex gap-2 justify-end">
          <button onclick="hideExamForm()" class="px-4 py-2 text-sm btn-ghost">Cancel</button>
          <button onclick="addExam()" class="px-4 py-2 text-sm btn-nova">Add</button>
        </div>
      </div>

      <div id="examList" class="space-y-3">
        <div class="text-sm text-zinc-400 text-center py-8">Loading exams...</div>
      </div>
    </div>
  `;

  loadExams(examsRef);
}

function showAddExam() { $("#examForm").classList.remove('hidden'); }
function hideExamForm() { $("#examForm").classList.add('hidden'); }

function addExam() {
  if (!isAdmin()) return;
  const name = $("#examName").value.trim();
  const dateVal = $("#examDate").value;
  const venue = $("#examVenue").value.trim();
  if (!name || !dateVal) { alert('Please fill exam name and date.'); return; }

  const p = getProfile();
  firebase.database().ref(`exams/${buildRoomKey(p.program, p.course, p.batch)}`).push({
    name, date: new Date(dateVal).getTime(), venue,
    addedBy: getProfile().displayName, timestamp: Date.now()
  }).then(() => {
    hideExamForm();
    $("#examName").value = ''; $("#examDate").value = ''; $("#examVenue").value = '';
    renderExamCountdown();
  }).catch(err => alert('Could not add exam: ' + err.message + adminPermissionHint(err)));
}

let examsQuery = null; // BUG FIX: loadExams() re-registered a brand-new 'value' listener
// every time renderExamCountdown() ran, without ever detaching the previous one (unlike
// chat/DM, this page had no cleanup hook). Visiting the Exam Countdown tab a few times
// in one session stacked up duplicate listeners, so a single Firebase update fired the
// render function multiple times in a row and leaked memory over a long session.
function loadExams(examsRef) {
  const list = $("#examList");
  if (!list) return;

  if (examsQuery) examsQuery.off();
  examsQuery = examsRef.orderByChild('date');
  examsQuery.on('value', snap => {
    if (!snap.exists()) {
      list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No exams added yet.</div>';
      return;
    }
    const exams = [];
    snap.forEach(c => exams.push({ id: c.key, ...c.val() }));
    const now = Date.now();

    // Sort: upcoming first, then past
    exams.sort((a, b) => {
      const aUp = a.date > now, bUp = b.date > now;
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      return a.date - b.date;
    });

    list.innerHTML = exams.map(exam => {
      const diff = exam.date - now;
      const isPast = diff < 0;
      const days = Math.floor(Math.abs(diff) / 86400000);
      const hours = Math.floor((Math.abs(diff) % 86400000) / 3600000);
      const mins = Math.floor((Math.abs(diff) % 3600000) / 60000);

      let countdownHtml = '';
      if (isPast) {
        countdownHtml = `<span class="text-xs text-zinc-400">Completed</span>`;
      } else if (days > 0) {
        countdownHtml = `<div class="flex gap-2 mt-2">
          ${[['Days',days],['Hours',hours],['Mins',mins]].map(([l,v]) => `
            <div class="text-center bg-orange-50 dark:bg-pink-950 rounded-xl px-3 py-2">
              <div class="text-lg font-bold text-orange-700 dark:text-pink-300">${v}</div>
              <div class="text-[10px] text-zinc-500">${l}</div>
            </div>`).join('')}
        </div>`;
      } else {
        countdownHtml = `<div class="text-red-500 font-bold text-sm mt-1">🚨 Today! ${hours}h ${mins}m left</div>`;
      }

      return `
        <div class="glass-card p-4 ${isPast ? 'opacity-50' : ''} ${!isPast && days === 0 ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950' : ''}">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <h3 class="font-semibold text-sm">${escapeHtml(exam.name)}</h3>
              <p class="text-xs text-zinc-500 mt-0.5">📅 ${new Date(exam.date).toLocaleString('en-IN', {dateStyle:'medium', timeStyle:'short'})}</p>
              ${exam.venue ? `<p class="text-xs text-zinc-500">📍 ${escapeHtml(exam.venue)}</p>` : ''}
              ${countdownHtml}
            </div>
            ${isAdmin() ? `<button onclick="deleteExam('${exam.id}')" class="text-xs text-red-400 hover:text-red-600 flex-shrink-0">🗑</button>` : ''}
          </div>
        </div>`;
    }).join('');

    // Live countdown update every minute
    if (window._examInterval) clearInterval(window._examInterval);
    window._examInterval = setInterval(() => { if ($("#examList")) loadExams(examsRef); else clearInterval(window._examInterval); }, 60000);
  });
}

// BUG FIX: called from router() on every navigation (see main.js) so leaving the Exam
// Countdown page for any other tab detaches its live listener instead of leaving it
// running in the background for the rest of the session.
function cleanupExams() {
  if (examsQuery) { examsQuery.off(); examsQuery = null; }
  if (window._examInterval) { clearInterval(window._examInterval); window._examInterval = null; }
}

function deleteExam(id) {
  if (!isAdmin() || !confirm('Delete this exam?')) return;
  const p = getProfile();
  firebase.database().ref(`exams/${buildRoomKey(p.program, p.course, p.batch)}/${id}`).remove()
    .catch(err => alert('Could not delete exam: ' + err.message + adminPermissionHint(err)));
}

// ── CONFESSION BOX ───────────────────────────────────────────────
function renderConfessions() {
  if (!isLoggedIn()) { renderLogin(); return; }

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div>
        <h2 class="text-lg font-bold">🤫 Anonymous Confessions</h2>
        <p class="text-xs text-zinc-500">Campus-wide · Your name is never shown</p>
      </div>

      <!-- Post confession -->
      <div class="glass-card p-4 bg-zinc-50 dark:bg-zinc-900 space-y-3">
        <textarea id="confessionInput" placeholder="Confess something... 😶 (completely anonymous)" rows="3" class="w-full input-nova px-3 py-2.5 text-sm resize-none"></textarea>
        <div class="flex items-center justify-between">
          <p class="text-xs text-zinc-400">🔒 Your identity is completely hidden</p>
          <button onclick="postConfession()" class="text-sm bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 px-4 py-2 rounded-xl hover:opacity-80 transition-opacity">Post Anonymously</button>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-2 items-center flex-wrap">
        <button onclick="loadConfessions('new')" data-cf="new" class="cf-filter text-xs px-3 py-1.5 pill-active">🆕 New</button>
        <button onclick="loadConfessions('top')" data-cf="top" class="cf-filter text-xs px-3 py-1.5 pill">🔥 Top</button>
        ${dateFilterDropdown('cfDateFilter', "loadConfessions(document.querySelector('.cf-filter.pill-active')?.dataset.cf || 'new')")}
      </div>
      <p class="text-[11px] mt-1 flex items-center gap-2" style="color:var(--muted)"><span id="cfCount"></span> · Confessions auto-delete after 7 days</p>

      <div id="confessionList" class="space-y-3 max-h-[60vh] overflow-y-auto">
        <div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>
      </div>
    </div>
  `;

  loadConfessions('new');
}

function postConfession() {
  const text = $("#confessionInput").value.trim();
  if (!text) return;
  if (text.length < 10) { alert('Confession too short!'); return; }

  firebase.database().ref('confessions').push({
    text, timestamp: Date.now(), likes: {}
    // NO uid, NO displayName — completely anonymous
  }).then(() => {
    $("#confessionInput").value = '';
    const cdf = $("#cfDateFilter"); if (cdf) cdf.value = 'week'; // don't let a stale date filter hide the new confession
    showToast('✅ Confessed anonymously!');
    loadConfessions('new');
  }).catch(err => alert('Failed: ' + err.message));
}

function loadConfessions(sortBy) {
  const list = $("#confessionList");
  if (!list) return;
  list.innerHTML = '<div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>';

  document.querySelectorAll('.cf-filter').forEach(btn => {
    btn.dataset.cf === sortBy
      ? (btn.className = 'cf-filter text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'cf-filter text-xs px-3 py-1.5 pill');
  });

  const user = firebase.auth().currentUser;
  // Lazily delete anything older than 7 days (rules permit this for any signed-in user)
  cleanupExpiredPosts('confessions');
  firebase.database().ref('confessions').orderByChild('timestamp').limitToLast(50).once('value', snap => {
    if (!snap.exists()) { list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No confessions yet. Be the first! 🤫</div>'; return; }
    let items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));

    // Confession board only shows the last 7 days
    items = filterToLast7Days(items);
    const dateFilter = $("#cfDateFilter") ? $("#cfDateFilter").value : 'week';
    items = items.filter(i => dateFilterMatch(i, dateFilter));

    if (sortBy === 'top') {
      items.sort((a, b) => Object.keys(b.likes || {}).length - Object.keys(a.likes || {}).length);
    } else {
      items.reverse(); // newest first
    }

    const countEl = $("#cfCount");
    if (countEl) countEl.textContent = `${items.length} confession${items.length === 1 ? '' : 's'}`;

    if (!items.length) {
      list.innerHTML = `<div class="text-sm text-zinc-400 text-center py-8">No confessions in this range.
        <button onclick="const d=$('#cfDateFilter'); if(d) d.value='week'; loadConfessions('new');" class="block mx-auto mt-2 text-xs btn-nova px-4 py-1.5">Show last 7 days</button></div>`;
      return;
    }

    list.innerHTML = items.map((item, idx) => {
      const likeCount = Object.keys(item.likes || {}).length;
      const iLiked = user && item.likes && item.likes[user.uid];
      const timeAgo = formatLastSeen(item.timestamp);
      return `
        <div class="glass-card p-4">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="text-xs text-zinc-400 font-mono">#${String(idx+1).padStart(3,'0')}</span>
            <span class="text-xs text-zinc-400">${timeAgo}</span>
          </div>
          <p class="text-sm leading-relaxed">${escapeHtml(item.text)}</p>
          <div class="flex items-center gap-3 mt-3">
            <button onclick="likeConfession('${item.id}')" class="flex items-center gap-1 text-xs ${iLiked ? 'text-red-500 font-semibold' : 'text-zinc-400 hover:text-red-400'} transition-colors">
              ${iLiked ? '❤️' : '🤍'} ${likeCount}
            </button>
            ${isAdmin() ? `<button onclick="deleteConfession('${item.id}')" class="text-xs text-red-400 underline ml-auto">Delete</button>` : ''}
          </div>
        </div>`;
    }).join('');
  }, err => {
    list.innerHTML = `<div class="text-sm text-red-500 text-center py-8">Couldn't load confessions: ${err.message}</div>`;
  });
}

function likeConfession(id) {
  const user = firebase.auth().currentUser;
  if (!user) return;
  const ref = firebase.database().ref(`confessions/${id}/likes/${user.uid}`);
  ref.once('value', snap => {
    snap.exists() ? ref.remove() : ref.set(true);
    setTimeout(() => loadConfessions(document.querySelector('.cf-filter.pill-active')?.dataset.cf || 'new'), 300);
  });
}

function deleteConfession(id) {
  if (!isAdmin() || !confirm('Delete this confession?')) return;
  firebase.database().ref(`confessions/${id}`).remove()
    .then(() => loadConfessions('new'))
    .catch(err => alert('Could not delete confession: ' + err.message + adminPermissionHint(err)));
}

// ── MARKETPLACE ──────────────────────────────────────────────────
function renderMarketplace() {
  if (!isLoggedIn()) { renderLogin(); return; }

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">🛒 Campus Marketplace</h2>
          <p class="text-xs text-zinc-500">Buy & sell books, notes, items with batchmates</p>
        </div>
        <button onclick="showMarketForm()" class="text-sm btn-nova px-4 py-2">+ List Item</button>
      </div>

      <!-- Post form -->
      <div id="marketForm" class="hidden glass-card p-4 bg-zinc-50 dark:bg-zinc-900 space-y-3">
        <h3 class="text-sm font-semibold">List an Item</h3>
        <div class="flex gap-2">
          <button onclick="setMarketType('sell')" id="mTypeSell" class="flex-1 py-2 rounded-xl text-sm font-medium bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200">💰 Sell</button>
          <button onclick="setMarketType('free')" id="mTypeFree" class="flex-1 py-2 rounded-xl text-sm font-medium border border-zinc-300 dark:border-zinc-700">🎁 Free</button>
          <button onclick="setMarketType('wanted')" id="mTypeWanted" class="flex-1 py-2 rounded-xl text-sm font-medium border border-zinc-300 dark:border-zinc-700">🔍 Wanted</button>
        </div>
        <input id="mTitle" placeholder="Item name" class="w-full input-nova px-3 py-2.5 text-sm" />
        <textarea id="mDesc" placeholder="Description — condition, edition, etc." rows="2" class="w-full input-nova px-3 py-2.5 text-sm resize-none"></textarea>
        <div class="flex gap-2">
          <input id="mPrice" placeholder="Price (₹)" class="flex-1 input-nova px-3 py-2.5 text-sm" />
          <input id="mContact" placeholder="WhatsApp / contact" class="flex-1 input-nova px-3 py-2.5 text-sm" />
        </div>
        <div class="flex gap-2 justify-end">
          <button onclick="hideMarketForm()" class="px-4 py-2 text-sm btn-ghost">Cancel</button>
          <button onclick="submitMarketItem()" class="px-4 py-2 text-sm btn-nova">Post</button>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-2 flex-wrap items-center">
        <button onclick="filterMarket('all')" data-mf="all" class="mkt-filter text-xs px-3 py-1.5 pill-active">All</button>
        <button onclick="filterMarket('sell')" data-mf="sell" class="mkt-filter text-xs px-3 py-1.5 pill">💰 Sell</button>
        <button onclick="filterMarket('free')" data-mf="free" class="mkt-filter text-xs px-3 py-1.5 pill">🎁 Free</button>
        <button onclick="filterMarket('wanted')" data-mf="wanted" class="mkt-filter text-xs px-3 py-1.5 pill">🔍 Wanted</button>
        <button onclick="filterMarket('mine')" data-mf="mine" class="mkt-filter text-xs px-3 py-1.5 pill">👤 Mine</button>
        ${dateFilterDropdown('mktDateFilter', "loadMarketItems(window._mktFilter || 'all')")}
      </div>
      <p class="text-[11px] mt-1 flex items-center gap-2" style="color:var(--muted)"><span id="mktCount"></span> · Listings auto-delete after 7 days</p>

      <div id="marketList" class="space-y-3 max-h-[60vh] overflow-y-auto">
        <div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>
      </div>
    </div>
  `;
  window._mType = 'sell';
  loadMarketItems('all');
}

function showMarketForm() { $("#marketForm").classList.remove('hidden'); }
function hideMarketForm() { $("#marketForm").classList.add('hidden'); }

function setMarketType(type) {
  window._mType = type;
  ['sell','free','wanted'].forEach(t => {
    const btn = $(`#mType${t.charAt(0).toUpperCase()+t.slice(1)}`);
    if (!btn) return;
    const active = t === type;
    const colors = { sell: 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200', free: 'bg-orange-100 dark:bg-pink-950 text-orange-700 dark:text-pink-300 border-pink-200', wanted: 'bg-yellow-100 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200' };
    btn.className = `flex-1 py-2 rounded-xl text-sm font-medium border ${active ? colors[t] : 'border-zinc-300 dark:border-zinc-700'}`;
  });
  $("#mPrice").classList.toggle('hidden', type !== 'sell');
}

function submitMarketItem() {
  const title = $("#mTitle").value.trim();
  const desc = $("#mDesc").value.trim();
  const price = $("#mPrice").value.trim();
  const contact = $("#mContact").value.trim();
  if (!title || !contact) { alert('Please fill item name and contact.'); return; }

  const user = firebase.auth().currentUser;
  if (!user) { alert('Your session has expired — please refresh the page and login again.'); return; }
  const p = getProfile();
  try {
  firebase.database().ref('marketplace').push({
    type: window._mType || 'sell',
    title, desc, price, contact,
    postedBy: p.displayName || 'Student', uid: user.uid,
    status: 'available', timestamp: Date.now()
  }).then(() => {
    hideMarketForm();
    ["mTitle","mDesc","mPrice","mContact"].forEach(id => { const el = $(`#${id}`); if(el) el.value = ''; });
    // Same fix as Lost & Found: always land on "All" after posting (both the data AND
    // the tab highlight) so a new listing is guaranteed visible and the UI isn't
    // showing "All" results while a different tab looks selected.
    // ...and reset the date dropdown too — a restored "Yesterday" selection was
    // silently hiding brand-new (today's) listings.
    const mdf = $("#mktDateFilter"); if (mdf) mdf.value = 'week';
    showToast('✅ Listed!');
    filterMarket('all');
  }).catch(err => alert('Failed to post listing: ' + err.message));
  } catch (err) { alert('Failed to post listing: ' + err.message); }
}

function filterMarket(type) {
  window._mktFilter = type;
  document.querySelectorAll('.mkt-filter').forEach(btn => {
    btn.dataset.mf === type
      ? (btn.className = 'mkt-filter text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'mkt-filter text-xs px-3 py-1.5 pill');
  });
  loadMarketItems(type);
}

function loadMarketItems(filter) {
  const list = $("#marketList");
  if (!list) return;
  list.innerHTML = '<div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>';

  // Lazily delete anything older than 7 days (rules permit this for any signed-in user)
  cleanupExpiredPosts('marketplace');

  const user = firebase.auth().currentUser;
  firebase.database().ref('marketplace').orderByChild('timestamp').once('value', snap => {
    if (!snap.exists()) { list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No items yet. List something! 🛒</div>'; return; }
    let items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    items.reverse(); // newest first
    const hadAny = items.length; // pre-filter count, for the "hidden by filters" message

    // Listings board only shows the last 7 days
    items = filterToLast7Days(items);
    const dateFilter = $("#mktDateFilter") ? $("#mktDateFilter").value : 'week';
    items = items.filter(i => dateFilterMatch(i, dateFilter));

    if (filter === 'mine') items = items.filter(i => user && i.uid === user.uid);
    else if (filter !== 'all') items = items.filter(i => i.type === filter);

    const countEl = $("#mktCount");
    if (countEl) countEl.textContent = `${items.length} listing${items.length === 1 ? '' : 's'}`;

    if (!items.length && hadAny) {
      list.innerHTML = `<div class="text-sm text-zinc-400 text-center py-8">${hadAny} listing${hadAny === 1 ? '' : 's'} hidden by current filters.
        <button onclick="const d=$('#mktDateFilter'); if(d) d.value='week'; filterMarket('all');" class="block mx-auto mt-2 text-xs btn-nova px-4 py-1.5">Show all</button></div>`;
      return;
    }
    if (!items.length) { list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No items in this category.</div>'; return; }

    const badges = { sell: '💰 For Sale', free: '🎁 Free', wanted: '🔍 Wanted' };
    const badgeColors = { sell: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300', free: 'bg-orange-100 dark:bg-pink-900 text-orange-700 dark:text-pink-300', wanted: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' };

    list.innerHTML = items.map(item => {
      const isOwner = user && item.uid === user.uid;
      const isSold = item.status === 'sold';
      return `
        <div class="glass-card p-4 ${isSold ? 'opacity-50' : ''}">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[item.type]}">${badges[item.type]}</span>
            ${isSold ? '<span class="text-xs text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Sold/Closed</span>' : ''}
          </div>
          <h3 class="font-semibold text-sm mb-1">${escapeHtml(item.title)}</h3>
          ${item.desc ? `<p class="text-xs text-zinc-500 mb-2">${escapeHtml(item.desc)}</p>` : ''}
          <div class="flex items-center gap-3 flex-wrap">
            ${item.price && item.type === 'sell' ? `<span class="text-sm font-bold text-green-600">₹${escapeHtml(item.price)}</span>` : ''}
            <span class="text-xs text-zinc-500">📞 ${escapeHtml(item.contact)}</span>
            <span class="text-xs text-zinc-400 ml-auto">${escapeHtml(item.postedBy)}</span>
          </div>
          ${isOwner && !isSold ? `
          <div class="flex gap-2 mt-3">
            <button onclick="markSold('${item.id}')" class="text-xs bg-zinc-200 dark:bg-zinc-700 px-3 py-1 rounded-lg hover:bg-zinc-300 dark:hover:bg-zinc-600">✅ Mark Sold</button>
            <button onclick="deleteMarketItem('${item.id}')" class="text-xs border border-red-200 text-red-500 px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">🗑 Delete</button>
          </div>` : ''}
        </div>`;
    }).join('');
  }, err => {
    list.innerHTML = `<div class="text-sm text-red-500 text-center py-8">Couldn't load listings: ${err.message}</div>`;
  });
}

function markSold(id) {
  firebase.database().ref(`marketplace/${id}`).update({ status: 'sold' }).then(() => loadMarketItems(window._mktFilter || 'all')).catch(err => alert('Could not update listing: ' + err.message));
}
function deleteMarketItem(id) {
  if (!confirm('Delete this listing?')) return;
  firebase.database().ref(`marketplace/${id}`).remove().then(() => loadMarketItems(window._mktFilter || 'all')).catch(err => alert('Could not delete listing: ' + err.message));
}

// ── ADMIN PANEL ──────────────────────────────────────────────────
function renderAdmin() {
  if (!isLoggedIn()) { renderLogin(); return; }
  if (!isAdmin()) { renderHome(); return; }

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <h2 class="text-lg font-bold">⚙️ Admin Panel</h2>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3" id="adminStats">
        <div class="glass-card p-3 text-center">
          <div class="text-2xl font-bold" id="statUsers">—</div>
          <div class="text-xs text-zinc-500">Total Users</div>
        </div>
        <div class="glass-card p-3 text-center">
          <div class="text-2xl font-bold" id="statConfessions">—</div>
          <div class="text-xs text-zinc-500">Confessions</div>
        </div>
        <div class="glass-card p-3 text-center">
          <div class="text-2xl font-bold" id="statMarket">—</div>
          <div class="text-xs text-zinc-500">Market Items</div>
        </div>
        <div class="glass-card p-3 text-center">
          <div class="text-2xl font-bold" id="statLF">—</div>
          <div class="text-xs text-zinc-500">Lost & Found</div>
        </div>
      </div>

      <!-- Broadcast message -->
      <div class="glass-card p-4">
        <h3 class="text-sm font-semibold mb-3">📣 Broadcast Message</h3>
        <p class="text-xs text-zinc-500 mb-2">Send announcement to ALL batch rooms simultaneously</p>
        <textarea id="broadcastInput" placeholder="Write broadcast message..." rows="3" class="w-full input-nova px-3 py-2.5 text-sm mb-2 resize-none"></textarea>
        <button onclick="sendBroadcast()" class="w-full rounded-xl bg-orange-500 text-white py-2 text-sm hover:bg-orange-600 transition-colors">📣 Send to All Rooms</button>
      </div>

      <!-- User list -->
      <div class="glass-card p-4">
        <h3 class="text-sm font-semibold mb-3">👥 Registered Users</h3>
        <input id="userSearch" placeholder="Search by name or email..." class="w-full input-nova px-3 py-2.5 text-sm mb-3" />
        <div id="userList" class="space-y-2 max-h-64 overflow-y-auto">
          <div class="skeleton h-12 w-full"></div>
        </div>
      </div>
    </div>
  `;

  loadAdminStats();
  loadUserList();

  $("#userSearch").oninput = function() { loadUserList(this.value.trim().toLowerCase()); };
}

function loadAdminStats() {
  firebase.database().ref('users').once('value', s => { const el = $("#statUsers"); if(el) el.textContent = s.numChildren(); });
  firebase.database().ref('confessions').once('value', s => { const el = $("#statConfessions"); if(el) el.textContent = s.numChildren(); });
  firebase.database().ref('marketplace').once('value', s => { const el = $("#statMarket"); if(el) el.textContent = s.numChildren(); });
  firebase.database().ref('lostandfound').once('value', s => { const el = $("#statLF"); if(el) el.textContent = s.numChildren(); });
}

function loadUserList(query = '') {
  const list = $("#userList");
  if (!list) return;
  firebase.database().ref('users').once('value', snap => {
    if (!snap.exists()) { list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-4">No users yet.</div>'; return; }
    let users = [];
    snap.forEach(c => users.push({ uid: c.key, ...c.val() }));
    if (query) users = users.filter(u => (u.displayName||'').toLowerCase().includes(query) || (u.email||'').toLowerCase().includes(query));
    if (!users.length) { list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-4">No users found.</div>'; return; }

    list.innerHTML = users.map(u => `
      <div class="flex items-center justify-between p-3 border rounded-xl dark:border-zinc-700 gap-2 ${u.banned ? 'opacity-60' : ''}">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-full bg-orange-100 dark:bg-pink-900 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-pink-300 flex-shrink-0">
            ${(u.displayName||'S')[0].toUpperCase()}
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium truncate">${escapeHtml(u.displayName || 'Unknown')} ${u.banned ? '<span class="text-xs text-red-500">(Banned)</span>' : ''}</p>
            <p class="text-xs text-zinc-400 truncate">${escapeHtml(u.email || '')} · ${u.batch || 'No batch'}</p>
            <p class="text-xs text-zinc-400">Last seen: ${formatLastSeen(u.lastSeen)}</p>
          </div>
        </div>
        ${u.banned
          ? `<button onclick="unbanUser('${u.uid}', '${escapeHtml(u.displayName||'User')}')" class="text-xs border border-green-200 text-green-600 px-2 py-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-950 flex-shrink-0">Unban</button>`
          : `<button onclick="banUser('${u.uid}', '${escapeHtml(u.displayName||'User')}')" class="text-xs border border-red-200 text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0">Ban</button>`}
      </div>`).join('');
  });
}

async function sendBroadcast() {
  const text = $("#broadcastInput").value.trim();
  if (!text) return;
  if (!confirm(`Send this broadcast to ALL batch rooms?\n\n"${text}"`)) return;

  const user = firebase.auth().currentUser;
  const p = getProfile();
  const btn = document.querySelector('button[onclick="sendBroadcast()"]');
  btn.textContent = 'Sending...'; btn.disabled = true;

  try {
    // PERFORMANCE FIX: this used to be `firebase.database().ref('chats').once('value')`,
    // which pulls down every message ever sent in every room just to read off the room
    // keys. roomIndex/{roomKey} is a tiny dedicated list (see loadMessages() in chat.js)
    // that gives the same room keys for a fraction of the data transferred.
    const snap = await firebase.database().ref('roomIndex').once('value');
    const rooms = [];
    snap.forEach(c => rooms.push(c.key));

    // Post announcement to every room
    const promises = rooms.map(room =>
      firebase.database().ref(`chats/${room}/announcements`).push({
        text: `📣 BROADCAST: ${text}`,
        displayName: (p.displayName || 'Admin') + ' (Admin)',
        uid: user.uid, timestamp: Date.now(), pinned: true
      })
    );
    await Promise.all(promises);
    $("#broadcastInput").value = '';
    alert(`✅ Broadcast sent to ${rooms.length} rooms!`);
  } catch(err) {
    alert('Broadcast failed: ' + err.message);
  }
  btn.textContent = '📣 Send to All Rooms'; btn.disabled = false;
}

// BUG FIX: banUser() used to call ref.remove(), wiping the user's profile but leaving
// their Firebase Auth account fully active — they could still log back in with a verified
// email, just with a broken/empty profile that crashed several pages expecting profile data.
// Now we set a `banned` flag (enforced at login time in auth.js) so their data stays intact
// for records/appeals, and the ban is reversible.
function banUser(uid, name) {
  if (!confirm(`Ban ${name}?\n\nThey will be signed out and blocked from logging in again until unbanned.`)) return;
  firebase.database().ref(`users/${uid}/banned`).set(true).then(() => {
    alert(`${name} has been banned.`);
    loadUserList();
  }).catch(err => alert('Could not ban user: ' + err.message + adminPermissionHint(err)));
}

function unbanUser(uid, name) {
  if (!confirm(`Unban ${name}?`)) return;
  firebase.database().ref(`users/${uid}/banned`).remove().then(() => {
    alert(`${name} has been unbanned.`);
    loadUserList();
  }).catch(err => alert('Could not unban user: ' + err.message + adminPermissionHint(err)));
}

// ── HELPER ───────────────────────────────────────────────────────
