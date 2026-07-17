// BUG FIX: cache name bumped so clients still on the old (incomplete/broken) cache
// pick up this fix on next visit — the activate handler below purges old caches.
const CACHE = 'mujconnects-v3';

// BUG FIX: paths were absolute ("/index.html"), which resolve against the site ROOT.
// That's wrong for a GitHub Pages *project* site (e.g. https://user.github.io/MujConnects/),
// where the app actually lives under a subpath — every one of these requests 404'd and the
// whole install() step silently failed (caught by .catch()), so the PWA never really worked
// offline. Relative paths resolve correctly regardless of the deployment subpath.
// Also added the files that were introduced later but never added here: academic.js,
// social.js, dm.js, profile.js, manifest.json.
const STATIC = [
  './', './index.html', './style.css', './manifest.json',
  './utils.js', './auth.js', './home.js', './chat.js',
  './resources.js', './lostandfound.js', './extras.js',
  './campusmap.js', './academic.js', './social.js', './dm.js',
  './profile.js', './main.js', './firebase-config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for Firebase/Puter, cache fallback for static
  if (e.request.url.includes('firebase') || e.request.url.includes('puter') || e.request.url.includes('googleapis')) {
    return;
  }
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
