// ── LOST & FOUND ─────────────────────────────────────────────────

function renderLostFound() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const p = getProfile();

  $("#app").innerHTML = `
    <div class="glass-card p-4">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">🔍 Lost & Found</h2>
          <p class="text-xs text-zinc-500">Campus-wide — post lost or found items</p>
        </div>
        <button onclick="showPostLF()" class="text-sm btn-nova px-4 py-2">+ Post Item</button>
      </div>

      <!-- Post form (hidden by default) -->
      <div id="lfForm" class="hidden mb-4 glass-card p-4 bg-zinc-50 dark:bg-zinc-900 space-y-3">
        <h3 class="text-sm font-semibold">Post an Item</h3>
        <div class="flex gap-2">
          <button onclick="setLFType('lost')" id="typeLost" class="flex-1 py-2 rounded-xl text-sm font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">😢 Lost</button>
          <button onclick="setLFType('found')" id="typeFound" class="flex-1 py-2 rounded-xl text-sm font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800">✅ Found</button>
        </div>
        <input id="lfTitle" placeholder="Item name (e.g. Blue Water Bottle)" class="w-full input-nova px-3 py-2.5 text-sm" />
        <textarea id="lfDesc" placeholder="Description — color, brand, where lost/found, when..." rows="3" class="w-full input-nova px-3 py-2.5 text-sm resize-none"></textarea>
        <input id="lfLocation" placeholder="Location (e.g. Library, Block A Cafeteria)" class="w-full input-nova px-3 py-2.5 text-sm" />
        <input id="lfContact" placeholder="Contact (WhatsApp number or email)" class="w-full input-nova px-3 py-2.5 text-sm" />
        <div class="flex gap-2 justify-end">
          <button onclick="hideLFForm()" class="px-4 py-2 text-sm btn-ghost">Cancel</button>
          <button onclick="submitLFPost()" class="px-4 py-2 text-sm btn-nova">Post</button>
        </div>
      </div>

      <!-- Filter tabs -->
      <div class="flex gap-2 mb-1 items-center flex-wrap">
        <button onclick="filterLF('all')" data-lf="all" class="lf-filter text-xs px-3 py-1.5 pill-active">All</button>
        <button onclick="filterLF('lost')" data-lf="lost" class="lf-filter text-xs px-3 py-1.5 pill">😢 Lost</button>
        <button onclick="filterLF('found')" data-lf="found" class="lf-filter text-xs px-3 py-1.5 pill">✅ Found</button>
        <button onclick="filterLF('resolved')" data-lf="resolved" class="lf-filter text-xs px-3 py-1.5 pill">🎉 Resolved</button>
        ${dateFilterDropdown('lfDateFilter', "loadLFPosts(window._lfFilter || 'all')")}
      </div>
      <p class="text-[11px] mb-2 flex items-center gap-2" style="color:var(--muted)"><span id="lfCount"></span> · Posts auto-delete after 7 days</p>

      <!-- Posts list -->
      <div id="lfList" class="space-y-3 max-h-[60vh] overflow-y-auto">
        <div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>
      </div>
    </div>
  `;

  window._lfType = 'lost';
  loadLFPosts('all');
}

function showPostLF() {
  $("#lfForm").classList.remove('hidden');
  $("#lfTitle").focus();
}
function hideLFForm() { $("#lfForm").classList.add('hidden'); }

function setLFType(type) {
  window._lfType = type;
  const lostBtn = $("#typeLost");
  const foundBtn = $("#typeFound");
  if (type === 'lost') {
    lostBtn.className = 'flex-1 py-2 rounded-xl text-sm font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800';
    foundBtn.className = 'flex-1 py-2 rounded-xl text-sm font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800';
  } else {
    foundBtn.className = 'flex-1 py-2 rounded-xl text-sm font-medium bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800';
    lostBtn.className = 'flex-1 py-2 rounded-xl text-sm font-medium border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800';
  }
}

function submitLFPost() {
  const title = $("#lfTitle").value.trim();
  const desc = $("#lfDesc").value.trim();
  const location = $("#lfLocation").value.trim();
  const contact = $("#lfContact").value.trim();

  if (!title || !desc || !contact) {
    alert('Please fill in item name, description, and contact.');
    return;
  }

  const user = firebase.auth().currentUser;
  // BUG FIX (the "posts silently vanish" class of failure): two things here could
  // throw SYNCHRONOUSLY — user being null (user.uid → TypeError) and
  // p.displayName being undefined (Firebase push() throws immediately on any
  // undefined property). A synchronous throw is NOT a rejected promise, so the
  // .catch() below never saw it: no alert, no post, form stays open — looked
  // like the app just ate the post. Guard both, and wrap in try/catch so any
  // similar throw becomes a visible alert instead of a silent console error.
  if (!user) { alert('Your session has expired — please refresh the page and login again.'); return; }
  const p = getProfile();

  try {
  firebase.database().ref('lostandfound').push({
    type: window._lfType || 'lost',
    title, desc, location, contact,
    status: 'active',
    postedBy: p.displayName || 'Student',
    uid: user.uid,
    timestamp: Date.now()
  }).then(() => {
    hideLFForm();
    // Clear form
    ["lfTitle","lfDesc","lfLocation","lfContact"].forEach(id => { const el = $(`#${id}`); if(el) el.value = ''; });
    // BUG FIX: this used to reload with whatever filter tab was already active
    // (window._lfFilter || 'all'). If you were on the "Lost" tab and posted a
    // "Found" item (or vice versa), the reload kept that same filter — so your
    // brand-new post was immediately filtered back out of view. Looked exactly
    // like "posting doesn't work," when really it just wasn't on-screen. Always
    // switch to "All" after posting, so whatever you just created is guaranteed
    // to be visible right away.
    // BUG FIX (part 2): the type-tab reset above wasn't enough — the DATE dropdown
    // could still hide a fresh post. Mobile browsers restore form state (a select
    // left on "Yesterday" comes back as "Yesterday" after navigation), and a
    // just-created post is from *today*, so it got date-filtered out while an
    // older post from yesterday still showed — "sirf ek purana post dikh raha".
    // Reset the date dropdown to the full 7-day view before reloading.
    const df = $("#lfDateFilter"); if (df) df.value = 'week';
    showToast('✅ Posted!');
    filterLF('all');
  }).catch(err => alert('Failed to post: ' + err.message));
  } catch (err) { alert('Failed to post: ' + err.message); }
}

function filterLF(type) {
  window._lfFilter = type;
  document.querySelectorAll('.lf-filter').forEach(btn => {
    btn.dataset.lf === type
      ? (btn.className = 'lf-filter text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'lf-filter text-xs px-3 py-1.5 pill');
  });
  loadLFPosts(type);
}

function loadLFPosts(filter) {
  const list = $("#lfList");
  if (!list) return;
  list.innerHTML = '<div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>';

  // Lazily delete anything older than 7 days (rules permit this for any signed-in user)
  cleanupExpiredPosts('lostandfound');

  firebase.database().ref('lostandfound').orderByChild('timestamp').once('value', snap => {
    if (!snap.exists()) {
      list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-10">No posts yet. Be the first to post! 🔍</div>';
      return;
    }
    let items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));

    // Posts board only shows the last 7 days
    items = filterToLast7Days(items);

    // Date dropdown (Today / Yesterday / Last 7 days)
    const dateFilter = $("#lfDateFilter") ? $("#lfDateFilter").value : 'week';
    items = items.filter(i => dateFilterMatch(i, dateFilter));

    const filtered = filter === 'all' ? items : items.filter(i =>
      filter === 'resolved' ? i.status === 'resolved' : (i.type === filter && i.status !== 'resolved')
    );

    // Show how many posts loaded — makes it obvious whether items are missing
    // vs simply filtered out or expired.
    const countEl = $("#lfCount");
    if (countEl) countEl.textContent = `${filtered.length} post${filtered.length === 1 ? '' : 's'}`;

    // If posts exist but every one got filtered out (type tab or date dropdown),
    // say so explicitly and offer a one-tap reset — otherwise it looks like
    // posting is broken when content is merely hidden by filters.
    if (!filtered.length && items.length) {
      list.innerHTML = `<div class="text-sm text-zinc-400 text-center py-10">
        ${items.length} post${items.length === 1 ? '' : 's'} hidden by current filters.
        <button onclick="const d=$('#lfDateFilter'); if(d) d.value='week'; filterLF('all');" class="block mx-auto mt-2 text-xs btn-nova px-4 py-1.5">Show all posts</button>
      </div>`;
      return;
    }
    if (!filtered.length) {
      list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-10">No posts in this category.</div>';
      return;
    }

    const user = firebase.auth().currentUser;
    list.innerHTML = filtered.reverse().map(item => {
      const isOwner = user && item.uid === user.uid;
      const isResolved = item.status === 'resolved';
      const typeColor = isResolved
        ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
        : item.type === 'lost'
          ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          : 'bg-orange-50 dark:bg-pink-950 border-pink-200 dark:border-pink-800';
      const typeBadge = isResolved ? '🎉 Resolved' : item.type === 'lost' ? '😢 Lost' : '✅ Found';
      const date = new Date(item.timestamp).toLocaleDateString('en-IN', { day:'numeric', month:'short' });

      return `
        <div class="border rounded-xl p-4 ${typeColor}">
          <div class="flex items-start justify-between gap-2 mb-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${isResolved ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' : item.type === 'lost' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' : 'bg-blue-200 dark:bg-blue-800 text-orange-800 dark:text-blue-200'}">${typeBadge}</span>
              <h3 class="text-sm font-semibold">${escapeHtml(item.title)}</h3>
            </div>
            <span class="text-xs text-zinc-400 flex-shrink-0">${date}</span>
          </div>
          <p class="text-sm text-zinc-600 dark:text-zinc-400 mb-2">${escapeHtml(item.desc)}</p>
          ${item.location ? `<p class="text-xs text-zinc-500">📍 ${escapeHtml(item.location)}</p>` : ''}
          <p class="text-xs text-zinc-500 mt-1">📞 ${escapeHtml(item.contact)}</p>
          <p class="text-xs text-zinc-400 mt-1">Posted by ${escapeHtml(item.postedBy)}</p>
          ${(isOwner || isAdmin()) && !isResolved ? `
          <div class="flex gap-2 mt-3">
            <button onclick="markResolved('${item.id}')" class="text-xs bg-green-500 text-white px-3 py-1 rounded-lg hover:bg-green-600">🎉 Mark Resolved</button>
            <button onclick="deleteLFPost('${item.id}')" class="text-xs border border-red-200 text-red-500 px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">🗑 Delete</button>
          </div>` : ''}
        </div>`;
    }).join('');
  }, err => {
    list.innerHTML = `<div class="text-sm text-red-500 text-center py-10">Couldn't load posts: ${err.message}</div>`;
  });
}

function markResolved(id) {
  firebase.database().ref(`lostandfound/${id}`).update({ status: 'resolved' })
    .then(() => loadLFPosts(window._lfFilter || 'all'))
    .catch(err => alert('Could not update post: ' + err.message));
}

function deleteLFPost(id) {
  if (!confirm('Delete this post?')) return;
  firebase.database().ref(`lostandfound/${id}`).remove()
    .then(() => loadLFPosts(window._lfFilter || 'all'))
    .catch(err => alert('Could not delete post: ' + err.message));
}

