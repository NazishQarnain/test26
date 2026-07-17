// ── CGPA CALCULATOR ──────────────────────────────────────────────
// MUJ Grading: O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0

const MUJ_GRADES = {
  'O': 10, 'A+': 9, 'A': 8, 'B+': 7,
  'B': 6, 'C': 5, 'P': 4, 'F': 0
};

function renderCGPA() {
  if (!isLoggedIn()) { renderLogin(); return; }

  // Load saved subjects from localStorage
  const saved = JSON.parse(localStorage.getItem('mujc_cgpa') || '{"semesters":[]}');

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">📊 CGPA Calculator</h2>
          <p class="text-xs text-zinc-500">MUJ Grading System · O=10, A+=9, A=8, B+=7, B=6, C=5, P=4, F=0</p>
        </div>
        <div id="cgpaResult" class="text-right">
          <div class="text-3xl font-bold text-orange-600" id="cgpaVal">—</div>
          <div class="text-xs text-zinc-500">Current CGPA</div>
        </div>
      </div>

      <!-- Semester tabs -->
      <div class="flex gap-2 overflow-x-auto pb-1" id="semTabs"></div>

      <!-- Add semester -->
      <button onclick="addSemester()" class="text-xs text-orange-600 underline">+ Add Semester</button>

      <!-- Current semester subjects -->
      <div id="semContent" class="space-y-3"></div>

      <!-- Add subject button -->
      <button onclick="addSubject()" id="addSubjectBtn" class="hidden text-xs border border-pink-300 text-orange-600 px-3 py-1.5 rounded-xl hover:bg-orange-50 dark:hover:bg-pink-950">+ Add Subject</button>

      <!-- Grade legend -->
      <div class="glass-card p-3">
        <p class="text-xs font-semibold mb-2 text-zinc-500">Grade Scale</p>
        <div class="flex flex-wrap gap-2">
          ${Object.entries(MUJ_GRADES).map(([g,p]) => `
            <div class="text-xs text-center">
              <div class="font-bold text-orange-600">${g}</div>
              <div class="text-zinc-400">${p}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Reset -->
      <button onclick="resetCGPA()" class="text-xs text-red-400 underline">Reset All Data</button>
    </div>
  `;

  renderCGPAData(saved);
}

let cgpaData = { semesters: [] };
let activeSem = 0;

function renderCGPAData(data) {
  cgpaData = data;
  if (!cgpaData.semesters.length) {
    cgpaData.semesters.push({ name: 'Semester 1', subjects: [] });
    activeSem = 0;
  }

  // Render tabs
  const tabs = $("#semTabs");
  if (tabs) {
    tabs.innerHTML = cgpaData.semesters.map((sem, i) => `
      <button onclick="switchSem(${i})" class="sem-tab flex-shrink-0 text-xs px-3 py-1.5 rounded-lg ${i === activeSem ? 'pill-active' : 'pill'}">
        ${sem.name}
        ${cgpaData.semesters.length > 1 ? `<span onclick="event.stopPropagation();deleteSemester(${i})" class="ml-1 text-zinc-400 hover:text-red-400">×</span>` : ''}
      </button>`).join('');
  }

  // Render subjects
  const sem = cgpaData.semesters[activeSem];
  const content = $("#semContent");
  const addBtn = $("#addSubjectBtn");
  if (addBtn) addBtn.classList.remove('hidden');

  if (content) {
    if (!sem.subjects.length) {
      content.innerHTML = '<p class="text-sm text-zinc-400 text-center py-4">No subjects yet. Add subjects to calculate SGPA.</p>';
    } else {
      content.innerHTML = sem.subjects.map((sub, i) => `
        <div class="flex items-center gap-2 flex-wrap glass-card p-3">
          <input value="${escapeHtml(sub.name)}" onchange="updateSubject(${i},'name',this.value)"
            placeholder="Subject name" class="flex-1 min-w-32 input-nova rounded-lg px-2 py-1 text-sm" />
          <input type="number" value="${sub.credits}" onchange="updateSubject(${i},'credits',this.value)"
            placeholder="Credits" min="1" max="6" class="w-20 input-nova rounded-lg px-2 py-1 text-sm" />
          <select onchange="updateSubject(${i},'grade',this.value)" class="input-nova rounded-lg px-2 py-1 text-sm">
            <option value="">Grade</option>
            ${Object.keys(MUJ_GRADES).map(g => `<option value="${g}" ${sub.grade === g ? 'selected' : ''}>${g} (${MUJ_GRADES[g]})</option>`).join('')}
          </select>
          <button onclick="deleteSubject(${i})" class="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>`).join('');
    }

    // SGPA for this semester
    const sgpa = calcSGPA(sem.subjects);
    if (sgpa !== null) {
      content.innerHTML += `
        <div class="flex items-center justify-between bg-orange-50 dark:bg-pink-950 border border-pink-200 dark:border-pink-800 rounded-xl px-4 py-3">
          <span class="text-sm font-medium">Semester GPA (SGPA)</span>
          <span class="text-xl font-bold text-orange-600">${sgpa.toFixed(2)}</span>
        </div>`;
    }
  }

  // Overall CGPA
  updateCGPA();
  saveCGPAData();
}

function calcSGPA(subjects) {
  const valid = subjects.filter(s => s.credits && s.grade && MUJ_GRADES[s.grade] !== undefined);
  if (!valid.length) return null;
  const totalPoints = valid.reduce((sum, s) => sum + (parseFloat(s.credits) * MUJ_GRADES[s.grade]), 0);
  const totalCredits = valid.reduce((sum, s) => sum + parseFloat(s.credits), 0);
  return totalCredits ? totalPoints / totalCredits : null;
}

function updateCGPA() {
  const allSubjects = cgpaData.semesters.flatMap(s => s.subjects);
  const cgpa = calcSGPA(allSubjects);
  const el = $("#cgpaVal");
  if (el) {
    el.textContent = cgpa !== null ? cgpa.toFixed(2) : '—';
    el.className = `text-3xl font-bold ${cgpa === null ? 'text-zinc-400' : cgpa >= 8 ? 'text-green-600' : cgpa >= 6 ? 'text-orange-600' : cgpa >= 4 ? 'text-yellow-600' : 'text-red-500'}`;
  }
}

function addSemester() {
  cgpaData.semesters.push({ name: `Semester ${cgpaData.semesters.length + 1}`, subjects: [] });
  activeSem = cgpaData.semesters.length - 1;
  renderCGPAData(cgpaData);
}

function deleteSemester(i) {
  if (!confirm(`Delete ${cgpaData.semesters[i].name}?`)) return;
  cgpaData.semesters.splice(i, 1);
  activeSem = Math.min(activeSem, cgpaData.semesters.length - 1);
  renderCGPAData(cgpaData);
}

function switchSem(i) { activeSem = i; renderCGPAData(cgpaData); }

function addSubject() {
  cgpaData.semesters[activeSem].subjects.push({ name: '', credits: 3, grade: '' });
  renderCGPAData(cgpaData);
}

function updateSubject(i, field, val) {
  cgpaData.semesters[activeSem].subjects[i][field] = val;
  updateCGPA();
  saveCGPAData();
}

function deleteSubject(i) {
  cgpaData.semesters[activeSem].subjects.splice(i, 1);
  renderCGPAData(cgpaData);
}

function saveCGPAData() {
  localStorage.setItem('mujc_cgpa', JSON.stringify(cgpaData));
}

function resetCGPA() {
  if (!confirm('Reset all CGPA data? This cannot be undone.')) return;
  localStorage.removeItem('mujc_cgpa');
  cgpaData = { semesters: [] };
  activeSem = 0;
  renderCGPA();
}

// ── ATTENDANCE TRACKER ───────────────────────────────────────────

function renderAttendance() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const data = JSON.parse(localStorage.getItem('mujc_attend') || '{"subjects":[]}');

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">📋 Attendance Tracker</h2>
          <p class="text-xs text-zinc-500">MUJ requires 75% attendance per subject</p>
        </div>
        <button onclick="addAttSubject()" class="text-sm btn-nova px-4 py-2">+ Add Subject</button>
      </div>

      <div id="attendList" class="space-y-3"></div>
    </div>
  `;

  renderAttendData(data);
}

let attendData = { subjects: [] };

function renderAttendData(data) {
  attendData = data;
  const list = $("#attendList");
  if (!list) return;

  if (!attendData.subjects.length) {
    list.innerHTML = '<p class="text-sm text-zinc-400 text-center py-8">No subjects added. Add subjects to track attendance.</p>';
    return;
  }

  list.innerHTML = attendData.subjects.map((sub, i) => {
    const total = sub.attended + sub.missed;
    const pct = total ? Math.round((sub.attended / total) * 100) : 0;
    const safe = pct >= 75;
    const canSkip = calcCanSkip(sub.attended, sub.missed);
    const needAttend = calcNeedAttend(sub.attended, sub.missed);

    return `
      <div class="glass-card p-4">
        <div class="flex items-start justify-between gap-2 mb-3">
          <div class="flex-1">
            <input value="${escapeHtml(sub.name)}" onchange="updateAttSubject(${i},'name',this.value)"
              class="font-semibold text-sm bg-transparent border-b border-zinc-200 dark:border-zinc-700 focus:border-blue-500 outline-none w-full pb-0.5" />
          </div>
          <button onclick="deleteAttSubject(${i})" class="text-red-400 hover:text-red-600 text-lg">×</button>
        </div>

        <!-- Progress bar -->
        <div class="mb-3">
          <div class="flex justify-between text-xs mb-1">
            <span class="${safe ? 'text-green-600' : 'text-red-500'} font-bold">${pct}%</span>
            <span class="text-zinc-400">${sub.attended}/${total} classes</span>
          </div>
          <div class="h-3 rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
            <div class="h-full rounded-full transition-all ${pct >= 75 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'}" style="width:${pct}%"></div>
          </div>
          <div class="flex justify-between items-center mt-1">
            <span class="text-xs ${safe ? 'text-green-600' : 'text-red-500'}">
              ${safe
                ? canSkip > 0 ? `✅ Can skip ${canSkip} more class${canSkip > 1 ? 'es' : ''}` : '✅ At limit'
                : `⚠️ Attend next ${needAttend} class${needAttend > 1 ? 'es' : ''} to reach 75%`}
            </span>
            <span class="text-xs text-zinc-400">75% = ${Math.ceil(total * 0.75)} needed</span>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-2">
          <button onclick="markAttend(${i}, 'attended')" class="flex-1 py-2 rounded-xl text-sm font-medium bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900 transition-colors">
            ✅ Present (+1)
          </button>
          <button onclick="markAttend(${i}, 'missed')" class="flex-1 py-2 rounded-xl text-sm font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900 transition-colors">
            ❌ Absent (+1)
          </button>
          <button onclick="undoAttend(${i})" class="px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Undo last">↩</button>
        </div>
        ${sub.history && sub.history.length ? `<p class="text-xs text-zinc-400 mt-2">Last: ${sub.history.slice(-5).map(h => h === 'attended' ? '✅' : '❌').join(' ')}</p>` : ''}
      </div>`;
  }).join('');
}

function calcCanSkip(attended, missed) {
  // How many more can be skipped while staying >= 75%
  // attended/(attended+missed+x) >= 0.75
  // attended >= 0.75*(attended+missed+x)
  // x <= attended/0.75 - attended - missed
  const x = Math.floor(attended / 0.75 - attended - missed);
  return Math.max(0, x);
}

function calcNeedAttend(attended, missed) {
  // How many must attend to reach 75%
  // (attended+x)/(attended+missed+x) >= 0.75
  // attended+x >= 0.75*attended + 0.75*missed + 0.75x
  // 0.25x >= 0.75*missed - 0.25*attended
  // x >= (3*missed - attended)
  const x = Math.ceil(3 * missed - attended);
  return Math.max(0, x);
}

function addAttSubject() {
  attendData.subjects.push({ name: 'New Subject', attended: 0, missed: 0, history: [] });
  saveAttendData();
  renderAttendData(attendData);
}

function deleteAttSubject(i) {
  if (!confirm(`Delete ${attendData.subjects[i].name}?`)) return;
  attendData.subjects.splice(i, 1);
  saveAttendData();
  renderAttendData(attendData);
}

function updateAttSubject(i, field, val) {
  attendData.subjects[i][field] = val;
  saveAttendData();
}

function markAttend(i, type) {
  attendData.subjects[i][type]++;
  if (!attendData.subjects[i].history) attendData.subjects[i].history = [];
  attendData.subjects[i].history.push(type);
  saveAttendData();
  renderAttendData(attendData);
}

function undoAttend(i) {
  const sub = attendData.subjects[i];
  if (!sub.history || !sub.history.length) return;
  const last = sub.history.pop();
  if (last === 'attended' && sub.attended > 0) sub.attended--;
  else if (last === 'missed' && sub.missed > 0) sub.missed--;
  saveAttendData();
  renderAttendData(attendData);
}

function saveAttendData() {
  localStorage.setItem('mujc_attend', JSON.stringify(attendData));
}

// ── ASSIGNMENT TRACKER ───────────────────────────────────────────

function renderAssignments() {
  if (!isLoggedIn()) { renderLogin(); return; }
  const data = JSON.parse(localStorage.getItem('mujc_assignments') || '{"tasks":[]}');

  $("#app").innerHTML = `
    <div class="glass-card p-4 space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold">📝 Assignment Tracker</h2>
          <p class="text-xs text-zinc-500">Track deadlines, never miss a submission</p>
        </div>
        <button onclick="showAddTask()" class="text-sm btn-nova px-4 py-2">+ Add Task</button>
      </div>

      <!-- Add form -->
      <div id="taskForm" class="hidden glass-card p-4 bg-zinc-50 dark:bg-zinc-900 space-y-3">
        <input id="taskName" placeholder="Assignment/Task name" class="w-full input-nova px-3 py-2.5 text-sm" />
        <input id="taskSubject" placeholder="Subject" class="w-full input-nova px-3 py-2.5 text-sm" />
        <input id="taskDeadline" type="datetime-local" class="w-full input-nova px-3 py-2.5 text-sm" />
        <select id="taskPriority" class="w-full input-nova px-3 py-2.5 text-sm">
          <option value="high">🔴 High Priority</option>
          <option value="medium" selected>🟡 Medium Priority</option>
          <option value="low">🟢 Low Priority</option>
        </select>
        <textarea id="taskNote" placeholder="Notes (optional)" rows="2" class="w-full input-nova px-3 py-2.5 text-sm resize-none"></textarea>
        <div class="flex gap-2 justify-end">
          <button onclick="hideTaskForm()" class="px-4 py-2 text-sm btn-ghost">Cancel</button>
          <button onclick="addTask()" class="px-4 py-2 text-sm btn-nova">Add</button>
        </div>
      </div>

      <!-- Filter -->
      <div class="flex gap-2">
        <button onclick="filterTasks('pending')" data-tf="pending" class="task-filter text-xs px-3 py-1.5 pill-active">📋 Pending</button>
        <button onclick="filterTasks('done')" data-tf="done" class="task-filter text-xs px-3 py-1.5 pill">✅ Done</button>
        <button onclick="filterTasks('all')" data-tf="all" class="task-filter text-xs px-3 py-1.5 pill">All</button>
      </div>

      <div id="taskList" class="space-y-2"></div>
    </div>
  `;

  window._assignData = data;
  renderTasks('pending');
}

function showAddTask() { $("#taskForm").classList.remove('hidden'); $("#taskName").focus(); }
function hideTaskForm() { $("#taskForm").classList.add('hidden'); }

function addTask() {
  const name = $("#taskName").value.trim();
  const subject = $("#taskSubject").value.trim();
  const deadline = $("#taskDeadline").value;
  const priority = $("#taskPriority").value;
  const note = $("#taskNote").value.trim();
  if (!name || !deadline) { alert('Please fill task name and deadline.'); return; }

  window._assignData.tasks.push({
    id: Date.now(), name, subject, deadline: new Date(deadline).getTime(),
    priority, note, done: false, createdAt: Date.now()
  });
  localStorage.setItem('mujc_assignments', JSON.stringify(window._assignData));
  hideTaskForm();
  ["taskName","taskSubject","taskDeadline","taskNote"].forEach(id => { const el = $(`#${id}`); if(el) el.value = ''; });
  renderTasks(document.querySelector('.task-filter.pill-active')?.dataset.tf || 'pending');
}

function filterTasks(filter) {
  document.querySelectorAll('.task-filter').forEach(btn => {
    btn.dataset.tf === filter
      ? (btn.className = 'task-filter text-xs px-3 py-1.5 pill-active')
      : (btn.className = 'task-filter text-xs px-3 py-1.5 pill');
  });
  renderTasks(filter);
}

function renderTasks(filter) {
  const list = $("#taskList");
  if (!list) return;
  let tasks = window._assignData.tasks || [];
  if (filter === 'pending') tasks = tasks.filter(t => !t.done);
  else if (filter === 'done') tasks = tasks.filter(t => t.done);

  // Sort by deadline
  tasks.sort((a, b) => a.deadline - b.deadline);

  if (!tasks.length) {
    list.innerHTML = `<p class="text-sm text-zinc-400 text-center py-8">${filter === 'done' ? 'No completed tasks.' : '🎉 No pending tasks!'}</p>`;
    return;
  }

  const now = Date.now();
  const priorityColors = { high: 'text-red-500', medium: 'text-yellow-500', low: 'text-green-500' };
  const priorityDots = { high: '🔴', medium: '🟡', low: '🟢' };

  list.innerHTML = tasks.map(task => {
    const diff = task.deadline - now;
    const isOverdue = diff < 0 && !task.done;
    const days = Math.floor(Math.abs(diff) / 86400000);
    const hours = Math.floor((Math.abs(diff) % 86400000) / 3600000);
    const timeLabel = isOverdue
      ? `⚠️ Overdue by ${days > 0 ? days + 'd ' : ''}${hours}h`
      : task.done ? '✅ Completed'
      : diff < 3600000 ? `🚨 Due in ${Math.floor(diff/60000)}min`
      : diff < 86400000 ? `⏰ Due in ${hours}h`
      : `📅 Due in ${days}d`;

    return `
      <div class="flex items-start gap-3 p-3 border rounded-xl dark:border-zinc-700 ${task.done ? 'opacity-60' : isOverdue ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950' : ''}">
        <button onclick="toggleTask(${task.id})" class="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 ${task.done ? 'bg-green-500 border-green-500' : 'border-zinc-300 dark:border-zinc-600'} flex items-center justify-center">
          ${task.done ? '<span class="text-white text-xs">✓</span>' : ''}
        </button>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium ${task.done ? 'line-through text-zinc-400' : ''}">${escapeHtml(task.name)}</p>
          ${task.subject ? `<p class="text-xs text-zinc-500">${escapeHtml(task.subject)}</p>` : ''}
          ${task.note ? `<p class="text-xs text-zinc-400 mt-0.5">${escapeHtml(task.note)}</p>` : ''}
          <p class="text-xs mt-1 ${isOverdue ? 'text-red-500 font-semibold' : 'text-zinc-400'}">${timeLabel}</p>
        </div>
        <div class="flex items-center gap-1 flex-shrink-0">
          <span class="text-xs">${priorityDots[task.priority]}</span>
          <button onclick="deleteTask(${task.id})" class="text-zinc-300 hover:text-red-400 text-lg leading-none">×</button>
        </div>
      </div>`;
  }).join('');
}

function toggleTask(id) {
  const task = window._assignData.tasks.find(t => t.id === id);
  if (task) task.done = !task.done;
  localStorage.setItem('mujc_assignments', JSON.stringify(window._assignData));
  renderTasks(document.querySelector('.task-filter.pill-active')?.dataset.tf || 'pending');
}

function deleteTask(id) {
  window._assignData.tasks = window._assignData.tasks.filter(t => t.id !== id);
  localStorage.setItem('mujc_assignments', JSON.stringify(window._assignData));
  renderTasks(document.querySelector('.task-filter.pill-active')?.dataset.tf || 'pending');
}

