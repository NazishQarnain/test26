// ── STUDY RESOURCES ──────────────────────────────────────────────
// Common resource library — shared across all batches of same program+course


function renderResources() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const p = getProfile();

  $("#app").innerHTML = `
    <div class="glass-card p-4">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">📚 Study Resources</h2>
          <p class="text-xs text-zinc-500">Shared materials for ${p.program || 'your program'} · ${p.course || 'your course'}</p>
        </div>
      </div>

      <!-- Upload section -->
      <div id="resDropZone" class="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-5 text-center mb-4 cursor-pointer hover:border-blue-400 transition-colors">
        <div class="text-3xl mb-1">📤</div>
        <p class="text-sm text-zinc-500">Upload study material — notes, papers, books</p>
        <p class="text-xs text-zinc-400 mt-1">Visible to all batches of your course · Max 50MB</p>
        <input type="file" id="resUploadInput" class="hidden" multiple />
      </div>

      <div id="resUploadProgress" class="hidden mb-3 flex items-center gap-2 text-sm text-zinc-500">
        <div class="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        <span id="resUploadStatus">Uploading...</span>
      </div>

      <!-- Subject filter -->
      <div class="flex gap-2 mb-3 flex-wrap" id="subjectFilters">
        <button onclick="filterResources('')" data-filter="" class="res-filter-btn text-xs px-3 py-1.5 pill-active">All</button>
        <button onclick="filterResources('notes')" data-filter="notes" class="res-filter-btn text-xs px-3 py-1.5 pill">📝 Notes</button>
        <button onclick="filterResources('papers')" data-filter="papers" class="res-filter-btn text-xs px-3 py-1.5 pill">📄 Papers</button>
        <button onclick="filterResources('books')" data-filter="books" class="res-filter-btn text-xs px-3 py-1.5 pill">📚 Books</button>
        <button onclick="filterResources('other')" data-filter="other" class="res-filter-btn text-xs px-3 py-1.5 pill">📁 Other</button>
      </div>

      <!-- File list -->
      <div id="resList" class="space-y-2 max-h-[50vh] overflow-y-auto">
        <div class="text-sm text-zinc-400 text-center py-8">Loading resources...</div>
      </div>
    </div>
  `;

  const uploadInput = $("#resUploadInput");
  const dropZone = $("#resDropZone");

  dropZone.onclick = () => uploadInput.click();
  uploadInput.onchange = (e) => uploadResource(Array.from(e.target.files));

  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('border-blue-500'); };
  dropZone.ondragleave = () => dropZone.classList.remove('border-blue-500');
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-blue-500');
    uploadResource(Array.from(e.dataTransfer.files));
  };

  loadResources('');
}

async function uploadResource(files) {
  if (!files.length) return;
  const progressEl = $("#resUploadProgress");
  const statusEl = $("#resUploadStatus");
  progressEl.classList.remove('hidden');

  for (const file of files) {
    statusEl.textContent = `Uploading ${file.name}...`;
    try {
      // Images → ImgBB, documents/PDFs → owner's Google Drive (see utils.js).
      // Resource documents are NOT compressed — see the note in DRIVE_SETUP.md:
      // meaningful client-side compression isn't possible for PDFs/docs, and
      // study material must stay byte-perfect anyway.
      const { url } = await uploadMedia(file, 'chat');

      // Save metadata to Firebase for search/filter
      const p = getProfile();
      const user = firebase.auth().currentUser;
      const category = guessCategory(file.name);
      const resKey = `${p.program}_${p.course}`.replace(/[^a-zA-Z0-9_]/g, '-');
      await firebase.database().ref(`resources/${resKey}`).push({
        name: file.name, size: file.size, url, category,
        uploadedBy: p.displayName || 'Student', uid: user.uid,
        timestamp: Date.now()
      });
    } catch (err) {
      alert(`Failed to upload ${file.name}: ${err.message}`);
    }
  }
  progressEl.classList.add('hidden');
  // BUG FIX: same class of bug as Lost & Found/Marketplace — reloading with whatever
  // category filter was already active could filter a freshly-uploaded file right back
  // out of view (e.g. viewing "Notes" but uploading a "Papers" file). Always land on
  // "All" after uploading so the new file is guaranteed visible.
  filterResources('');
}

function guessCategory(filename) {
  const name = filename.toLowerCase();
  if (name.includes('note') || name.includes('notes')) return 'notes';
  if (name.includes('paper') || name.includes('pyq') || name.includes('exam')) return 'papers';
  if (name.includes('book') || name.includes('textbook') || name.endsWith('.pdf')) return 'books';
  return 'other';
}

function filterResources(cat) {
  window._currentResFilter = cat;
  document.querySelectorAll('.res-filter-btn').forEach(btn => {
    btn.dataset.filter === cat
      ? (btn.className = 'res-filter-btn text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'res-filter-btn text-xs px-3 py-1.5 pill');
  });
  loadResources(cat);
}

function loadResources(filterCat) {
  const list = $("#resList");
  if (!list) return;
  list.innerHTML = '<div class="space-y-3 py-2"><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div><div class="skeleton h-16 w-full"></div></div>';

  const p = getProfile();
  const resKey = `${p.program}_${p.course}`.replace(/[^a-zA-Z0-9_]/g, '-');
  let query = firebase.database().ref(`resources/${resKey}`).orderByChild('timestamp');

  query.once('value', snap => {
    if (!snap.exists()) {
      list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No resources yet. Be the first to upload! 📚</div>';
      return;
    }
    const items = [];
    snap.forEach(c => items.push({ id: c.key, ...c.val() }));
    const filtered = filterCat ? items.filter(i => i.category === filterCat) : items;
    if (!filtered.length) {
      list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-8">No files in this category.</div>';
      return;
    }

    const user = firebase.auth().currentUser;
    list.innerHTML = filtered.reverse().map(item => {
      const icon = getFileIcon(item.name);
      const size = item.size ? formatBytes(item.size) : '';
      const catBadge = { notes: '📝 Notes', papers: '📄 Papers', books: '📚 Books', other: '📁 Other' }[item.category] || '📁';
      const isOwner = user && item.uid === user.uid;
      return `
        <div class="flex items-center gap-3 p-3 glass-card hover:-translate-y-0.5 transition-transform group">
          <span class="text-2xl flex-shrink-0">${icon}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">${escapeHtml(item.name)}</p>
            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
              <span class="text-xs text-zinc-400">${catBadge}</span>
              ${size ? `<span class="text-xs text-zinc-400">· ${size}</span>` : ''}
              <span class="text-xs text-zinc-400">· ${escapeHtml(item.uploadedBy)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <a href="${item.url}" target="_blank" class="text-xs btn-nova px-3 py-1.5 no-underline">⬇ Download</a>
            ${isOwner || isAdmin() ? `<button onclick="deleteResource('${item.id}')" class="text-xs border border-red-200 text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">🗑</button>` : ''}
          </div>
        </div>`;
    }).join('');
  }, err => {
    list.innerHTML = `<div class="text-sm text-red-500 text-center py-8">Couldn't load resources: ${err.message}</div>`;
  });
}

function deleteResource(id) {
  if (!confirm('Delete this resource?')) return;
  const p = getProfile();
  const resKey = `${p.program}_${p.course}`.replace(/[^a-zA-Z0-9_]/g, '-');
  firebase.database().ref(`resources/${resKey}/${id}`).remove()
    .then(() => loadResources(window._currentResFilter || ''))
    .catch(err => alert('Could not delete resource: ' + err.message));
}

