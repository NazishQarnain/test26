// ── CAMPUS MAP ───────────────────────────────────────────────────
// MUJ Campus center: Dehmi Kalan, Off Jaipur-Ajmer Expressway
// Lat: 26.8467, Lng: 75.6900 (approximate campus center)

const MUJ_LOCATIONS = [
  // Academic
  { id: 'ab1', name: 'Academic Block 1 (Admin)', emoji: '🏛️', category: 'academic', lat: 26.8472, lng: 75.6895, desc: 'Administration, Dean offices, Registrar', hours: 'Mon-Sat 9AM-5PM' },
  { id: 'ab2', name: 'Academic Block 2', emoji: '🎓', category: 'academic', lat: 26.8468, lng: 75.6902, desc: 'Engineering classrooms, Faculty rooms', hours: 'Mon-Sat 8AM-6PM' },
  { id: 'ab3', name: 'Academic Block 3', emoji: '🎓', category: 'academic', lat: 26.8463, lng: 75.6908, desc: '50 classrooms, Auditorium (385 seats), Library', hours: 'Mon-Sat 8AM-6PM' },
  { id: 'ab4', name: 'Academic Block 4 (Law & Design)', emoji: '⚖️', category: 'academic', lat: 26.8458, lng: 75.6912, desc: 'Law School, Design School, Fine Arts', hours: 'Mon-Sat 8AM-6PM' },
  { id: 'lib', name: 'Central Library', emoji: '📚', category: 'academic', lat: 26.8465, lng: 75.6898, desc: '2319 sq.m, 700 seats, AC, 19,718+ books, Digital resources', hours: 'Mon-Sat 8AM-10PM, Sun 10AM-6PM' },

  // Food
  { id: 'mess1', name: 'Old Mess (Main Cafeteria)', emoji: '🍽️', category: 'food', lat: 26.8478, lng: 75.6905, desc: 'Main campus cafeteria, variety of food', hours: '7AM-10PM' },
  { id: 'cafe1', name: 'Food Court', emoji: '🍕', category: 'food', lat: 26.8460, lng: 75.6895, desc: 'Multiple food stalls, snacks, beverages', hours: '8AM-11PM' },
  { id: 'cafe2', name: 'Hostel Mess', emoji: '🥘', category: 'food', lat: 26.8485, lng: 75.6918, desc: 'Hostel dining — breakfast, lunch, dinner', hours: '7AM-9PM' },

  // Hostels
  { id: 'bh', name: "Boys' Hostel Complex", emoji: '🏠', category: 'hostel', lat: 26.8488, lng: 75.6920, desc: 'Multiple blocks, AC rooms, WiFi, Laundry, Gym', hours: 'Always open' },
  { id: 'gh', name: "Girls' Hostel Complex", emoji: '🏠', category: 'hostel', lat: 26.8482, lng: 75.6928, desc: 'Separate complex, AC rooms, WiFi, 24/7 security', hours: 'Always open' },

  // Sports
  { id: 'sports', name: 'Sports Complex', emoji: '⚽', category: 'sports', lat: 26.8455, lng: 75.6920, desc: 'Basketball, Badminton, Tennis, Football, Cricket, Gym', hours: '6AM-9PM' },
  { id: 'gym', name: 'Gymnasium', emoji: '💪', category: 'sports', lat: 26.8452, lng: 75.6915, desc: 'Full equipped gym, individual coaches', hours: '6AM-9PM' },
  { id: 'pool', name: 'Swimming Pool', emoji: '🏊', category: 'sports', lat: 26.8450, lng: 75.6922, desc: 'Olympic size pool', hours: '6AM-8PM' },

  // Facilities
  { id: 'med', name: 'Medical Centre', emoji: '🏥', category: 'facility', lat: 26.8475, lng: 75.6888, desc: 'Resident doctor, 24/7 ambulance, Emergency care', hours: '24/7' },
  { id: 'atm', name: 'ATM / Bank', emoji: '🏦', category: 'facility', lat: 26.8470, lng: 75.6892, desc: 'ATM and banking services on campus', hours: 'ATM 24/7' },
  { id: 'wifi', name: 'WiFi Zone (Central)', emoji: '📶', category: 'facility', lat: 26.8466, lng: 75.6900, desc: 'High-speed WiFi throughout campus', hours: 'Always' },
  { id: 'aud', name: 'Main Auditorium', emoji: '🎭', category: 'facility', lat: 26.8461, lng: 75.6905, desc: 'Designed by Hafeez Contractor, major events venue', hours: 'Event days' },
  { id: 'gate', name: 'Main Gate', emoji: '🚪', category: 'facility', lat: 26.8478, lng: 75.6880, desc: 'Security check, visitor entry', hours: '24/7' },
  { id: 'park', name: 'Parking Area', emoji: '🚗', category: 'facility', lat: 26.8480, lng: 75.6875, desc: 'Two-wheeler and four-wheeler parking', hours: '24/7' },
];

const MAP_CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🗺️' },
  { id: 'academic', label: 'Academic', emoji: '🎓' },
  { id: 'food', label: 'Food', emoji: '🍽️' },
  { id: 'hostel', label: 'Hostel', emoji: '🏠' },
  { id: 'sports', label: 'Sports', emoji: '⚽' },
  { id: 'facility', label: 'Facilities', emoji: '🏥' },
];

function renderCampusMap() {
  if (!isLoggedIn()) { renderLogin(); return; }

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div>
        <h2 class="text-lg font-bold">🗺️ Campus Map</h2>
        <p class="text-xs text-zinc-500">Manipal University Jaipur · Dehmi Kalan, Jaipur-Ajmer Expressway</p>
      </div>

      <!-- Google Maps embed -->
      <div class="rounded-xl overflow-hidden border dark:border-zinc-700" style="height:280px">
        <iframe
          src="https://maps.google.com/maps?q=Manipal+University+Jaipur,+Dehmi+Kalan,+Rajasthan&t=k&z=17&output=embed&hl=en"
          width="100%" height="280" style="border:0" allowfullscreen loading="lazy"
          referrerpolicy="no-referrer-when-downgrade">
        </iframe>
      </div>

      <!-- Open in Google Maps -->
      <a href="https://maps.google.com/?q=Manipal+University+Jaipur+Dehmi+Kalan+Rajasthan" target="_blank"
         class="flex items-center justify-center gap-2 text-sm text-orange-600 border border-pink-200 dark:border-pink-800 rounded-xl py-2 hover:bg-orange-50 dark:hover:bg-pink-950 transition-colors no-underline">
        📍 Open in Google Maps
      </a>

      <!-- Search -->
      <input id="mapSearch" placeholder="🔍 Search locations (library, mess, gym...)" class="w-full input-nova px-3 py-2.5 text-sm" />

      <!-- Category filter -->
      <div class="flex gap-2 flex-wrap">
        ${MAP_CATEGORIES.map(c => `
          <button onclick="filterMapCat('${c.id}')" data-cat="${c.id}"
            class="map-cat-btn text-xs px-3 py-1.5 rounded-lg ${c.id === 'all' ? 'pill-active' : 'pill'}">
            ${c.emoji} ${c.label}
          </button>`).join('')}
      </div>

      <!-- Location cards -->
      <div id="mapList" class="space-y-2 max-h-[45vh] overflow-y-auto"></div>
    </div>
  `;

  renderMapList('all', '');

  $("#mapSearch").oninput = function() {
    const cat = document.querySelector('.map-cat-btn.pill-active')?.dataset.cat || 'all';
    renderMapList(cat, this.value.trim().toLowerCase());
  };
}

function filterMapCat(cat) {
  document.querySelectorAll('.map-cat-btn').forEach(btn => {
    btn.dataset.cat === cat
      ? (btn.className = 'map-cat-btn text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'map-cat-btn text-xs px-3 py-1.5 pill');
  });
  const q = $("#mapSearch")?.value.trim().toLowerCase() || '';
  renderMapList(cat, q);
}

function renderMapList(cat, query) {
  const list = $("#mapList");
  if (!list) return;

  let locs = MUJ_LOCATIONS;
  if (cat !== 'all') locs = locs.filter(l => l.category === cat);
  if (query) locs = locs.filter(l => l.name.toLowerCase().includes(query) || l.desc.toLowerCase().includes(query));

  if (!locs.length) {
    list.innerHTML = '<div class="text-sm text-zinc-400 text-center py-6">No locations found.</div>';
    return;
  }

  list.innerHTML = locs.map(loc => `
    <div class="flex items-start gap-3 p-3 glass-card hover:-translate-y-0.5 transition-transform cursor-pointer"
         onclick="openInMaps('${loc.name}', ${loc.lat}, ${loc.lng})">
      <span class="text-2xl flex-shrink-0 mt-0.5">${loc.emoji}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold">${escapeHtml(loc.name)}</p>
        <p class="text-xs text-zinc-500 mt-0.5">${escapeHtml(loc.desc)}</p>
        <div class="flex items-center gap-3 mt-1 flex-wrap">
          <span class="text-xs text-green-600 dark:text-green-400">🕐 ${loc.hours}</span>
          <span class="text-xs text-orange-500 hover:underline">📍 Directions →</span>
        </div>
      </div>
    </div>`).join('');
}

function openInMaps(name, lat, lng) {
  const url = `https://maps.google.com/?q=${lat},${lng}&label=${encodeURIComponent(name + ' - MUJ')}`;
  window.open(url, '_blank');
}

