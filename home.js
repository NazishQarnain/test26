// ── PROFILE PAGE ─────────────────────────────────────────────────

function renderProfile() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const p = getProfile();
  const initials = (p.displayName || "S").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarHtml = p.photoURL
    ? `<img src="${p.photoURL}" class="w-20 h-20 rounded-full object-cover" alt="Profile" />`
    : `<div class="w-20 h-20 rounded-full hero-panel flex items-center justify-center font-bold text-white text-2xl">${initials}</div>`;

  // Batch is locked — show lock icon if set
  const batchDisplay = p.batch
    ? `${escapeHtml(p.batch)} 🔒`
    : `<span style="color:var(--muted)">Not selected</span>`;

  $("#app").innerHTML = `
    <div class="max-w-md mx-auto p-6 glass-card pop-in">

      <!-- Avatar -->
      <div class="flex flex-col items-center mb-6">
        <span class="avatar-ring"><span class="avatar-ring-inner relative">${avatarHtml}
          <label id="avatarLabel" class="absolute bottom-0 right-0 btn-nova rounded-full w-7 h-7 flex items-center justify-center cursor-pointer text-xs" title="Change photo">
            ✏️
            <input type="file" id="avatarInput" accept="image/*" class="hidden" />
          </label>
        </span></span>
        <div id="uploadMsg" class="text-xs mt-2 hidden" style="color:var(--muted)">Uploading...</div>
        <p class="font-bold text-lg mt-3">${escapeHtml(p.displayName || "Student")}</p>
        <p class="text-xs badge-nova inline-block px-3 py-1 mt-1">MUJ Student</p>
      </div>

      <!-- Info fields -->
      <div class="space-y-2">
        ${[
          ["Email", p.email || "—"],
          ["Program", p.program || "Not selected"],
          ["Course", p.course || "Not selected"],
        ].map(([label, val]) => `
          <div class="glass rounded-2xl px-4 py-3">
            <p class="text-xs" style="color:var(--muted)">${label}</p>
            <p class="font-semibold text-sm mt-0.5">${escapeHtml(val)}</p>
          </div>`).join("")}

        <!-- Batch — locked field -->
        <div class="glass rounded-2xl px-4 py-3">
          <p class="text-xs" style="color:var(--muted)">Admission Batch</p>
          <p class="font-semibold text-sm mt-0.5">${batchDisplay}</p>
          ${p.batch ? `<p class="text-xs mt-1" style="color:var(--muted)">Batch is permanently locked. Delete account to change.</p>` : ''}
        </div>
      </div>

      <!-- Public profile link -->
      <a href="#myprofile" class="mt-5 block w-full btn-nova py-2.5 text-sm text-center no-underline">👤 View My Public Profile</a>

      <!-- Logout -->
      <button onclick="logout()" class="mt-3 w-full btn-ghost py-2.5 text-sm font-semibold">Logout</button>

      <!-- Delete Account — danger zone -->
      <div class="mt-4 rounded-2xl p-4" style="border:1.5px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06)">
        <p class="text-xs font-bold text-red-500 mb-1">⚠️ Danger Zone</p>
        <p class="text-xs mb-3" style="color:var(--muted)">Deleting your account is permanent. All your data will be removed and you can register again with the same email.</p>
        <button id="deleteBtn" class="w-full rounded-xl bg-red-500 text-white py-2.5 text-sm font-semibold hover:bg-red-600 transition-colors">Delete My Account</button>
      </div>

      <p class="text-center text-[10px] mt-4" style="color:var(--muted)">MujConnects · Build ${typeof APP_BUILD !== 'undefined' ? APP_BUILD : '?'}</p>
    </div>
  `;

  // Avatar upload
  $("#avatarInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('Image too large. Max 5MB.'); return; }

    const uploadMsg = $("#uploadMsg");
    const label = $("#avatarLabel");
    uploadMsg.classList.remove('hidden');
    uploadMsg.textContent = 'Uploading...';
    label.style.pointerEvents = 'none';

    try {
      const user = firebase.auth().currentUser;
      if (!user) throw new Error('Not logged in');

      // Profile pics get the heaviest compression (30% → quality 0.70) plus a
      // 512px resize — avatars render at ~80px, so this is visually lossless
      // while cutting the upload to a fraction of the original size.
      const { url: photoURL } = await uploadMedia(file, 'profile');

      await firebase.database().ref('users/' + user.uid + '/photoURL').set(photoURL);
      const pr = getProfile();
      pr.photoURL = photoURL;
      setProfile(pr);

      uploadMsg.textContent = '✅ Photo updated!';
      setTimeout(() => renderProfile(), 1000);
    } catch (err) {
      uploadMsg.textContent = '❌ Upload failed: ' + err.message;
      label.style.pointerEvents = 'auto';
    }
  };

  // Delete account
  $("#deleteBtn").onclick = () => deleteAccount();
}

async function deleteAccount() {
  const confirmed = confirm(
    "Are you sure you want to delete your account?\n\nThis will:\n• Delete all your account data\n• Remove you from your batch room\n• This action CANNOT be undone\n\nType OK to confirm."
  );
  if (!confirmed) return;

  const user = firebase.auth().currentUser;
  if (!user) { alert('Please login again to delete your account.'); return; }

  const btn = $("#deleteBtn");
  btn.textContent = 'Deleting...';
  btn.disabled = true;

  try {
    // 1. Delete user data from Firebase Database
    await firebase.database().ref('users/' + user.uid).remove();

    // 2. Delete Firebase Auth account
    await user.delete();

    // 3. Clear local session
    logoutSession();

    alert('Your account has been deleted. You can register again with the same email.');
    location.hash = 'register';
  } catch (err) {
    console.error('Delete account error:', err);
    if (err.code === 'auth/requires-recent-login') {
      // Firebase requires re-auth for sensitive operations
      alert('For security, please logout and login again before deleting your account.');
      btn.textContent = 'Delete My Account';
      btn.disabled = false;
    } else {
      alert('Failed to delete account: ' + err.message);
      btn.textContent = 'Delete My Account';
      btn.disabled = false;
    }
  }
}

// ── HOME PAGE ─────────────────────────────────────────────────────

function renderHome() {
  if (!isLoggedIn()) { renderLogin(); return; }

  const p = getProfile();
  const name = (p.displayName && p.displayName !== "Student")
    ? p.displayName
    : (p.email ? p.email.split('@')[0] : "Student");

  const initials = (p.displayName || "S").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarHtml = p.photoURL
    ? `<img src="${p.photoURL}" class="w-11 h-11 rounded-full object-cover" />`
    : `<div class="w-11 h-11 rounded-full hero-panel flex items-center justify-center font-bold text-white text-sm">${initials}</div>`;

  const user = firebase.auth().currentUser;
  const storyRingClass = "avatar-ring";

  // BUG FIX (the real root cause of "keeps asking to select batch after every logout"):
  // this used to check `if (p.program && p.course && p.batch)` to decide whether to show
  // the "already locked" screen. But those three fields get written to localStorage the
  // MOMENT a student taps a batch button below — immediately, in the same click handler,
  // long before they ever see or press "Confirm & Enter Chat". That means the very next
  // re-render (triggered by that same click) already satisfied this condition and jumped
  // straight to the "locked" screen's simple `Enter Batch Chat →` button — which just
  // navigates to #chat and was NEVER wired to write anything to Firebase (only the
  // onboarding screen's "Confirm & Enter Chat 🔒" button does that, and it was never
  // actually reached). So the batch only ever looked locked locally for the rest of that
  // browser session; nothing was ever saved server-side, and the very next login had
  // nothing to restore. A separate `batchConfirmed` flag — only ever set to true right
  // after the Firebase write in the onboarding flow actually succeeds (or after
  // syncProfileFromFirebase confirms Firebase already has all three fields) — fixes this
  // by making "locked" mean "server confirmed it", not just "all three fields are set".
  if (p.program && p.course && p.batch && p.batchConfirmed) {
    $("#app").innerHTML = `
      <div class="hero-panel p-6 space-y-4 pop-in">
        <div class="flex items-center gap-3 relative z-10">
          <span class="avatar-ring" style="padding:2.5px;background:rgba(255,255,255,.5)"><span class="avatar-ring-inner" style="background:transparent;padding:0">${avatarHtml}</span></span>
          <div>
            <h2 class="text-xl font-bold">Welcome, ${escapeHtml(name)} 👋</h2>
            <p class="text-sm text-white/80">Your batch is confirmed</p>
          </div>
        </div>

        <!-- BUG FIX: Story feed row was referenced by JS but never existed in the DOM,
             so stories always silently failed to render. Added the container + heading here. -->
        <div id="storyFeedWrap" class="hidden relative z-10">
          <p class="text-xs font-semibold text-white/70 mb-2">Stories</p>
          <div id="storyFeedRow" class="flex gap-3 overflow-x-auto pb-1"></div>
        </div>

        <div class="bg-white/15 backdrop-blur rounded-2xl px-4 py-4 relative z-10">
          <p class="text-[11px] text-white/70 font-semibold tracking-wide mb-1">YOUR BATCH · LOCKED 🔒</p>
          <p class="text-base font-bold">${escapeHtml(p.program)} · ${escapeHtml(p.course)}</p>
          <p class="text-sm text-white/80">Batch ${escapeHtml(p.batch)}</p>
        </div>
        <button id="goChat" class="w-full rounded-2xl bg-white text-orange-700 px-5 py-3 text-sm font-bold relative z-10 transition-transform active:scale-95" style="color:#c2410c">
          Enter Batch Chat →
        </button>
        <p class="text-xs text-white/60 text-center relative z-10">Wrong batch? Go to Profile → Delete Account to start over.</p>
      </div>
    `;
    $("#goChat").onclick = () => { location.hash = "chat"; };

    // Load story feed (fixed: container now exists — see #storyFeedWrap/#storyFeedRow above)
    if (typeof renderStoryFeed === 'function') {
      renderStoryFeed().then(storyUsers => {
        const wrap = $("#storyFeedWrap");
        const row = $("#storyFeedRow");
        if (!row || !wrap || !storyUsers.length) return;
        wrap.classList.remove('hidden');
        row.innerHTML = storyUsers.map(su => {
          const ini = (su.displayName || 'U')[0].toUpperCase();
          return `<div onclick="viewStories('${su.uid}')" class="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer">
            <span class="avatar-ring" style="padding:2px;background:rgba(255,255,255,.6)">
              ${su.photoURL
                ? `<img src="${su.photoURL}" class="w-12 h-12 rounded-full object-cover" />`
                : `<div class="w-12 h-12 rounded-full bg-white/25 flex items-center justify-center font-bold text-white">${ini}</div>`}
            </span>
            <span class="text-[10px] text-white/70 truncate max-w-12">${escapeHtml(su.displayName.split(' ')[0])}</span>
          </div>`;
        }).join('');
      }).catch(() => {});
    }
    return;
  }

  // First time — show selection UI
  const programKeys = Object.keys(MUJ_PROGRAMS);
  const selectedProgram = p.program || "";
  const courses = selectedProgram ? MUJ_PROGRAMS[selectedProgram].courses : [];
  const batches = selectedProgram ? getBatchesForProgram(selectedProgram) : [];

  $("#app").innerHTML = `
    <div class="p-6 glass-card space-y-5 pop-in">
      <div class="flex items-center gap-3">
        <span class="avatar-ring"><span class="avatar-ring-inner">${avatarHtml}</span></span>
        <div>
          <h2 class="text-xl font-bold">Welcome, ${escapeHtml(name)} 👋</h2>
          <p class="text-sm" style="color:var(--muted)">Choose carefully — your batch will be locked permanently</p>
        </div>
      </div>

      <!-- Step indicator -->
      <div class="flex items-center gap-2">
        ${['Program','Course','Batch'].map((step, i) => {
          const done = i === 0 ? !!selectedProgram : i === 1 ? !!p.course : !!p.batch;
          return `<div class="flex-1 h-1.5 rounded-full" style="background:${done ? 'var(--nova-grad)' : 'var(--border)'};${done ? 'background-image:var(--nova-grad)' : ''}"></div>`;
        }).join('')}
      </div>

      <div class="badge-nova px-4 py-3 text-xs !rounded-2xl block">
        ⚠️ <strong>Important:</strong> Once you confirm your batch, it cannot be changed. If you make a mistake, you'll need to delete your account and register again.
      </div>

      <!-- Program -->
      <div>
        <label class="block text-sm font-semibold mb-1.5">1. Program</label>
        <select id="sel-program" class="w-full input-nova px-3 py-2.5 text-sm">
          <option value="">-- Select Program --</option>
          ${programKeys.map(k => `<option value="${k}" ${k === selectedProgram ? "selected" : ""}>${k}</option>`).join("")}
        </select>
      </div>

      <!-- Course -->
      <div id="course-wrap" class="${selectedProgram ? "" : "hidden"}">
        <label class="block text-sm font-semibold mb-1.5">2. Course / Specialisation</label>
        <select id="sel-course" class="w-full input-nova px-3 py-2.5 text-sm">
          <option value="">-- Select Course --</option>
          ${courses.map(c => `<option value="${c}" ${c === p.course ? "selected" : ""}>${c}</option>`).join("")}
        </select>
      </div>

      <!-- Batch -->
      <div id="batch-wrap" class="${(selectedProgram && p.course) ? "" : "hidden"}">
        <label class="block text-sm font-semibold mb-1.5">3. Admission Batch</label>
        <p class="text-xs mb-2" style="color:var(--muted)">Choose the year you joined MUJ</p>
        <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1" id="batch-btns">
          ${batches.map(b => `
            <button data-batch="${b}" class="batch-btn text-sm px-4 py-2 ${p.batch === b ? "pill-active" : "pill"}">
              ${b}
            </button>`).join("")}
        </div>
      </div>

      <!-- Confirm button — only show when all 3 selected -->
      ${(selectedProgram && p.course && p.batch) ? `
      <div class="hero-panel px-4 py-3 text-sm">
        🎓 <strong>${escapeHtml(p.program)}</strong> · ${escapeHtml(p.course)} · Batch ${escapeHtml(p.batch)}
      </div>
      <button id="goChat" class="w-full btn-nova px-5 py-3 text-sm">
        Confirm & Enter Chat 🔒
      </button>` : `
      <button disabled class="w-full btn-nova px-5 py-3 text-sm opacity-40 cursor-not-allowed">
        Confirm & Enter Chat 🔒
      </button>`}
    </div>
  `;

  $("#sel-program").onchange = function () {
    const pr = getProfile(); pr.program = this.value; pr.course = ""; pr.batch = "";
    setProfile(pr); renderHome();
  };

  const selCourse = $("#sel-course");
  if (selCourse) {
    selCourse.onchange = function () {
      const pr = getProfile(); pr.course = this.value; pr.batch = "";
      setProfile(pr); renderHome();
    };
  }

  document.querySelectorAll(".batch-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const pr = getProfile(); pr.batch = btn.dataset.batch;
      setProfile(pr); renderHome();
    });
  });

  const goBtn = $("#goChat");
  if (goBtn) {
    goBtn.onclick = async () => {
      const pr = getProfile();
      if (!pr.program || !pr.course || !pr.batch) { alert("Please select your Program, Course and Batch!"); return; }

      // Final confirmation before locking
      const ok = confirm(`Confirm your batch:\n\n${pr.program} — ${pr.course}\nBatch: ${pr.batch}\n\nThis CANNOT be changed later. Proceed?`);
      if (!ok) return;

      const user = firebase.auth().currentUser;
      if (!user) { alert('Your session expired — please login again.'); location.hash = 'login'; return; }

      // BUG FIX: this Firebase write had no error handling at all. If it failed for any
      // reason (most commonly: Firebase security rules were never deployed to the
      // project, or the project's default "test mode" rules had expired and started
      // denying all writes), the batch would still LOOK locked for the rest of this
      // session — because the Program/Course/Batch pickers above already save to
      // localStorage the moment you pick them, independent of this write. The failure
      // was invisible. Then logging out wipes localStorage (by design, so a shared
      // device doesn't leak the previous student's profile — see logoutSession()), and
      // since Firebase never actually had the batch saved, the next login has nothing
      // to restore and the picker comes back — forever, on every single logout. Now a
      // failed save shows a clear error and does NOT proceed to chat, so the real cause
      // is visible immediately instead of surfacing two steps later as "it keeps asking
      // me again."
      goBtn.disabled = true;
      goBtn.textContent = 'Saving...';
      try {
        await firebase.database().ref('users/' + user.uid).update({
          program: pr.program,
          course: pr.course,
          batch: pr.batch,
          batchLockedAt: Date.now()
        });
        // Only NOW — after Firebase has actually confirmed the write — do we mark the
        // batch as truly locked locally. See the big comment above renderHome()'s
        // `if (p.program && p.course && p.batch && p.batchConfirmed)` check for why this
        // flag has to exist at all.
        pr.batchConfirmed = true;
        setProfile(pr);
        location.hash = "chat";
      } catch (err) {
        console.error('Batch lock save failed:', err);
        alert(
          'Could not save your batch to the server, so it will ask again after logout.\n\n' +
          'Reason: ' + (err.message || err.code || 'unknown error') + '\n\n' +
          (err.code === 'PERMISSION_DENIED'
            ? 'This usually means the Firebase Realtime Database security rules (FIREBASE_RULES.json) haven\'t been published in the Firebase Console yet, or the project\'s default rules have expired. Ask whoever set up Firebase to check Realtime Database → Rules.'
            : 'Please check your internet connection and try again.')
        );
        goBtn.disabled = false;
        goBtn.textContent = 'Confirm & Enter Chat 🔒';
      }
    };
  }
}
