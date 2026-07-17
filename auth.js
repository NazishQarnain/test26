// Firebase Authentication Functions

function renderLogin() {
  $("#app").innerHTML = `
    <div class="max-w-md mx-auto mt-6">
      <div class="text-center mb-6 pop-in">
        <div class="avatar-ring mx-auto mb-3" style="padding:4px;">
          <div class="avatar-ring-inner"><div class="w-16 h-16 rounded-full hero-panel flex items-center justify-center text-3xl">👋</div></div>
        </div>
        <h1 class="nova-brand text-3xl font-extrabold tracking-tight">MujConnects</h1>
        <p class="text-sm mt-1" style="color:var(--muted)">Your MUJ batch, all in one place</p>
      </div>
      <div class="max-w-md mx-auto p-6 glass-card pop-in">
        <h2 class="text-xl font-bold mb-4">Welcome back</h2>
        <form id="loginForm" class="space-y-3">
          <input id="email" type="email" placeholder="College Email (@muj.manipal.edu)" class="w-full input-nova px-4 py-3" required />
          <input id="pass" type="password" placeholder="Password" class="w-full input-nova px-4 py-3" required />
          <button type="submit" class="w-full btn-nova py-3 text-sm">Login</button>
          <p class="text-right text-xs" style="color:var(--muted)"><span class="underline cursor-pointer" id="forgotLink">Forgot password?</span></p>
          <p class="text-center text-sm" style="color:var(--muted)">No account? <a href="#register" class="font-semibold" style="color:#ea580c">Register</a></p>
        </form>
        <div id="errorMsg" class="text-red-500 text-sm mt-2 hidden"></div>
      </div>
    </div>
  `;

  // Login form submit
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#email").value;
    const password = $("#pass").value;
    const errorMsg = $("#errorMsg");
    errorMsg.classList.add('hidden');
    errorMsg.style.color = '';

    try {
      const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Block login if email not verified
      if (!user.emailVerified) {
        await firebase.auth().signOut();
        errorMsg.classList.remove('hidden');
        errorMsg.innerHTML = `Email not verified. <button id="resendBtn" class="underline text-orange-600">Resend verification email</button>`;
        document.getElementById('resendBtn').onclick = async () => {
          try {
            const tempCred = await firebase.auth().signInWithEmailAndPassword(email, password);
            await tempCred.user.sendEmailVerification();
            await firebase.auth().signOut();
            errorMsg.textContent = 'Verification email resent! Check your inbox.';
          } catch(err) {
            errorMsg.textContent = getFriendlyError(err.code);
          }
        };
        return;
      }

      // BUG FIX: previously "Ban User" in the admin panel only deleted the user's
      // /users/{uid} record, but never touched the Firebase Auth account — so a banned
      // student could still log back in with a verified email, just with a wiped/broken
      // profile. Now we check a `banned` flag stored under users/{uid} and block login here.
      const userSnap = await firebase.database().ref('users/' + user.uid).once('value');
      const userData = userSnap.val();
      if (userData && userData.banned) {
        await firebase.auth().signOut();
        errorMsg.classList.remove('hidden');
        errorMsg.textContent = 'This account has been suspended by an admin.';
        return;
      }

      const p = getProfile();
      p.email = user.email;
      p.uid = user.uid;
      p.displayName = user.displayName || p.displayName || "Student";
      setProfile(p);

      // BUG FIX: logoutSession() wipes the local profile (including program/course/batch)
      // on every logout. Previously nothing re-fetched that data from Firebase before
      // redirecting to #home — restoration only happened inside the separate, unawaited
      // onAuthStateChanged listener in setupAuthListener(), which raced against this
      // redirect and almost always lost. That's why a returning student who had already
      // locked their batch kept getting asked to pick it again after every login.
      // Awaiting the sync here guarantees program/course/batch are back before we navigate.
      await syncProfileFromFirebase(user, userData || {});
      loginSession(email);
      location.hash = "home";

    } catch (error) {
      console.error('Login error:', error);
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = getFriendlyError(error.code);
    }
  };

  // Forgot password handler
  $("#forgotLink").onclick = async () => {
    const email = $("#email").value.trim();
    const errorMsg = $("#errorMsg");
    errorMsg.style.color = '';

    if (!email) {
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = 'Please enter your MUJ email above first.';
      return;
    }
    if (!email.endsWith('@muj.manipal.edu')) {
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = 'Only @muj.manipal.edu emails are supported.';
      return;
    }
    try {
      await firebase.auth().sendPasswordResetEmail(email);
      errorMsg.classList.remove('hidden');
      errorMsg.style.color = '#16a34a';
      errorMsg.textContent = '✅ Password reset link sent! Check your MUJ inbox.';
    } catch (err) {
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = getFriendlyError(err.code);
    }
  };
}

function renderRegister() {
  $("#app").innerHTML = `
    <div class="max-w-md mx-auto mt-6">
      <div class="text-center mb-6 pop-in">
        <h1 class="nova-brand text-3xl font-extrabold tracking-tight">Join MujConnects</h1>
        <p class="text-sm mt-1" style="color:var(--muted)">One app for your whole batch</p>
      </div>
      <div class="max-w-md mx-auto p-6 glass-card pop-in">
        <h2 class="text-xl font-bold mb-3">Create account</h2>
        <p class="text-xs badge-nova inline-block px-3 py-1.5">Only MUJ students can register (@muj.manipal.edu)</p>
        <form id="regForm" class="space-y-3 mt-4">
          <input id="name" placeholder="Full Name" class="w-full input-nova px-4 py-3" required />
          <input id="email" type="email" placeholder="2023ucs1234@muj.manipal.edu" class="w-full input-nova px-4 py-3" required />
          <input id="pass" type="password" placeholder="Password (min 6 characters)" class="w-full input-nova px-4 py-3" required />
          <button type="submit" class="w-full btn-nova py-3 text-sm">Register</button>
          <p class="text-center text-sm" style="color:var(--muted)">Already have account? <a href="#login" class="font-semibold" style="color:#ea580c">Login</a></p>
        </form>
        <div id="errorMsg" class="text-red-500 text-sm mt-2 hidden"></div>
      </div>
    </div>
  `;

  $("#regForm").onsubmit = async (e) => {
    e.preventDefault();
    const name = $("#name").value.trim();
    const email = $("#email").value.trim();
    const password = $("#pass").value;
    const errorMsg = $("#errorMsg");
    errorMsg.classList.add('hidden');

    if (!email.endsWith('@muj.manipal.edu')) {
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = 'Only MUJ college emails are allowed (@muj.manipal.edu).';
      return;
    }

    try {
      const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Extract roll code and first name from email
      const rollCode = extractRollCode(email);
      const firstName = extractFirstName(email);
      const finalName = name || firstName || 'Student';

      await user.updateProfile({ displayName: finalName });

      await firebase.database().ref('users/' + user.uid).set({
        displayName: finalName,
        email: email,
        rollCode: rollCode,
        createdAt: Date.now()
      });

      // Also index by rollCode for fast search
      if (rollCode) {
        await firebase.database().ref('rollIndex/' + rollCode).set(user.uid);
      }

      // Send verification email, then sign out immediately
      await user.sendEmailVerification();
      await firebase.auth().signOut();

      $("#app").innerHTML = `
        <div class="max-w-md mx-auto mt-6 p-6 glass-card text-center pop-in">
          <div class="text-5xl mb-4">📧</div>
          <h2 class="text-xl font-bold mb-2">Verify Your Email</h2>
          <p class="text-sm mb-4" style="color:var(--muted)">
            A verification link has been sent to<br/>
            <strong style="color:var(--text)">${escapeHtml(email)}</strong>
          </p>
          <p class="text-sm mb-6" style="color:var(--muted)">Click the link in the email to activate your account, then come back and login.</p>
          <a href="#login" class="inline-block btn-nova px-6 py-2.5 text-sm no-underline">Go to Login</a>
          <p class="text-xs mt-4" style="color:var(--muted)">Didn't receive? Check your spam folder.</p>
        </div>
      `;
    } catch (error) {
      console.error('Registration error:', error);
      errorMsg.classList.remove('hidden');
      errorMsg.textContent = getFriendlyError(error.code);
    }
  };
}

function logout() {
  firebase.auth().signOut().then(() => {
    logoutSession();
    location.hash = "login";
  }).catch(() => {
    logoutSession();
    location.hash = "login";
  });
}

function getFriendlyError(code) {
  const messages = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return messages[code] || 'Something went wrong. Please try again.';
}

// ── SYNC LOCAL PROFILE FROM FIREBASE ──────────────────────────────
// Pulls displayName/photoURL/program/course/batch/rollCode from the user's Firebase
// record into the local (localStorage) profile cache, if the local copy is missing them.
// This is the single source of truth for "restore my profile after login/refresh" —
// both the login handler and the background auth listener call this instead of each
// keeping their own copy of the logic (which is how they drifted out of sync before).
async function syncProfileFromFirebase(user, preFetchedData) {
  const p = getProfile();
  let changed = false;

  if (!p.displayName || p.displayName === 'Student') {
    p.displayName = user.displayName || user.email.split('@')[0];
    changed = true;
  }

  try {
    const data = preFetchedData || (await firebase.database().ref('users/' + user.uid).once('value')).val() || {};
    // BUG FIX: this catch block used to swallow every error silently (`catch (e) {}`),
    // including a failed read of the user's own Firebase record — the #1 way that would
    // fail is permission-denied (rules not deployed/expired). That silent failure looked
    // identical to "this student genuinely hasn't picked a batch yet," so they got sent to
    // the picker with zero indication anything had gone wrong. Logging here means a future
    // occurrence is diagnosable from the browser console (F12) instead of a mystery.
    if (!data.program || !data.course || !data.batch) {
      console.warn('[MujConnects] No program/course/batch found in Firebase for this user yet — showing batch picker. If you already locked a batch before, this means the earlier save never actually reached Firebase (check Realtime Database → Rules, and look for a PERMISSION_DENIED error in this console when you confirm your batch).', data);
    }
    if (data.photoURL && !p.photoURL) { p.photoURL = data.photoURL; changed = true; }
    if (data.program && data.course && data.batch) {
      // BUG FIX: previously this only copied program/course/batch over when the local
      // profile was missing them, and never touched `batchConfirmed` at all (that flag
      // didn't exist yet — see the big comment in home.js's renderHome() for why it's
      // needed). Firebase having all three fields is, by definition, the actual source of
      // truth for "this student's batch is really locked" — so any time we see that, mark
      // it confirmed locally too, even if program/course/batch were already present
      // locally from an earlier, unconfirmed selection.
      if (!p.program || !p.course || !p.batch) {
        p.program = data.program; p.course = data.course; p.batch = data.batch;
      }
      if (!p.batchConfirmed) { p.batchConfirmed = true; }
      changed = true;
    }
    if (data.rollCode && !p.rollCode) { p.rollCode = data.rollCode; changed = true; }

    // Backfill rollCode for existing users who registered before this feature
    if (!data.rollCode && user.email) {
      const rc = extractRollCode(user.email);
      if (rc) {
        firebase.database().ref('users/' + user.uid + '/rollCode').set(rc).catch(() => {});
        firebase.database().ref('rollIndex/' + rc).set(user.uid).catch(() => {});
        p.rollCode = rc; changed = true;
      }
    }
  } catch (e) {
    console.error('[MujConnects] syncProfileFromFirebase failed — could not read this user\'s Firebase record at all (likely PERMISSION_DENIED from Realtime Database rules):', e);
  }

  if (changed) setProfile(p);
  return p;
}

function setupAuthListener() {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      await syncProfileFromFirebase(user);
    }
  });
}

window.logout = logout;
window.setupAuthListener = setupAuthListener;
window.syncProfileFromFirebase = syncProfileFromFirebase;
