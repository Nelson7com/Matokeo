
var supabaseClient = null;

(function connectSupabase() {
  var SUPABASE_URL = 'https://nnytkdjooerftqowcxvu.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_OtNLdiJlOW40cDdLvLO3QA_CKBVmcws';

  if (typeof supabase !== 'undefined' && supabase.createClient) {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase library haijapakiwa. Weka <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> kabla ya app.js');
  }
})();

/* ---------- 2. HALI YA MFUMO ---------- */
var ADMIN_PASSWORD = 'admin123';   // Haijabadilishwa — kama ulivyoomba

var currentTeacher = null;   // object kutoka table teachers
var currentClass = '';
var currentRows = [];
var currentAdminName = '';
var currentAdminRole = '';
var currentAdminBio = '';

var myResults = [];      // matokeo ya mwalimu aliyeingia
var allResults = [];     // matokeo yote (admin)
var allTeachers = [];    // waalimu wote (admin)

var pages = [
  'landing', 'teacherLogin', 'teacherCreate', 'teacherProfile', 'teacherSettings',
  'classes', 'classInfo', 'results', 'review', 'postSubmit', 'history',
  'adminLogin', 'adminProfile', 'admin', 'adminTeachers', 'adminData', 'adminView'
];

/* ---------- 3. VISAIDIZI ---------- */
function showPage(id) {
  pages.forEach(function (p) {
    var el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== id);
  });
  window.scrollTo(0, 0);

  if (id === 'history') loadMyResults();
  if (id === 'admin') loadAllResults();
  if (id === 'adminTeachers') loadAllTeachers();
}

function $(id) { return document.getElementById(id); }
function val(id) { var el = $(id); return el ? el.value : ''; }
function setVal(id, v) { var el = $(id); if (el) el.value = v; }
function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
function setHTML(id, v) { var el = $(id); if (el) el.innerHTML = v; }

function sanitizeText(value) {
  return String(value === undefined || value === null ? '' : value).trim().replace(/[<>]/g, '');
}
function normalizeSubject(value) { return sanitizeText(value).replace(/\s+/g, ' '); }

function esc(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function grade(m) {
  m = Number(m);
  if (isNaN(m)) return '-';
  if (m >= 75) return 'A';
  if (m >= 65) return 'B';
  if (m >= 45) return 'C';
  if (m >= 30) return 'D';
  return 'F';
}

function fmtDate(v) {
  if (!v) return '-';
  var d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString('sw-TZ');
}

function busy(on, msg) {
  var el = $('loader');
  if (!el) return;
  el.textContent = msg || 'Inapakia...';
  el.classList.toggle('hidden', !on);
}

/* Password hashing (SHA-256). Si salama 100% kwa sababu inafanyika browser,
   lakini ni bora kuliko kuhifadhi password wazi kwenye database. */
async function hashPassword(plain) {
  var text = 'kasange::' + String(plain);
  if (window.crypto && window.crypto.subtle) {
    var buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }
  // Fallback kwa mazingira yasiyo na crypto.subtle (mfano http://)
  var h = 0;
  for (var i = 0; i < text.length; i++) { h = ((h << 5) - h) + text.charCodeAt(i); h |= 0; }
  return 'fb_' + Math.abs(h).toString(16);
}

function ensureDb() {
  if (!supabaseClient) {
    alert('Mfumo haujaunganishwa na Supabase. Angalia mtandao au funguo za Supabase.');
    return false;
  }
  return true;
}

/* ================================================================
   4. AKAUNTI YA MWALIMU
   ================================================================ */

/* Kutengeneza akaunti: Jina + Password tu */
async function createTeacherAccount() {
  if (!ensureDb()) return;

  var name = sanitizeText(val('teacherCreateName'));
  var pass = sanitizeText(val('teacherCreatePassword'));
  var pass2 = sanitizeText(val('teacherCreatePassword2'));

  if (!name || !pass) { alert('Jaza Jina na Password.'); return; }
  if (pass.length < 4) { alert('Password iwe na herufi 4 au zaidi.'); return; }
  if (pass2 && pass !== pass2) { alert('Password mbili hazifanani.'); return; }

  busy(true, 'Inatengeneza akaunti...');
  try {
    // Hakikisha jina halijatumika
    var exists = await supabaseClient.from('teachers').select('id').ilike('name', name);
    if (exists.error) throw exists.error;
    if (exists.data && exists.data.length) {
      alert('Jina hili tayari lina akaunti. Tumia jina lingine au ingia (login).');
      return;
    }

    var hash = await hashPassword(pass);
    var res = await supabaseClient.from('teachers').insert([{
      name: name,
      password_hash: hash,
      status: 'Active',
      role: 'Mwalimu',
      bio: ''
    }]).select();

    if (res.error) throw res.error;

    currentTeacher = res.data[0];
    setVal('profileName', currentTeacher.name);
    setVal('profileRole', currentTeacher.role || 'Mwalimu');
    alert('Akaunti imeundwa. Sasa weka namba ya simu.');
    showPage('teacherProfile');
  } catch (e) {
    console.error(e);
    alert('Imeshindikana kutengeneza akaunti: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

/* Kuingia: Jina + Password tu */
async function teacherEnter() {
  if (!ensureDb()) return;

  var name = sanitizeText(val('teacherLoginName'));
  var pass = sanitizeText(val('teacherLoginPassword'));
  if (!name || !pass) { alert('Jaza jina na password.'); return; }

  busy(true, 'Inaingia...');
  try {
    var res = await supabaseClient.from('teachers').select('*').ilike('name', name).limit(1);
    if (res.error) throw res.error;
    if (!res.data || !res.data.length) { alert('Jina halipo. Tengeneza akaunti kwanza.'); return; }

    var t = res.data[0];
    if (t.status && t.status !== 'Active') { alert('Akaunti yako imesimamishwa. Wasiliana na Admin.'); return; }

    var hash = await hashPassword(pass);
    if (t.password_hash !== hash) { alert('Password si sahihi.'); return; }

    currentTeacher = t;
    setVal('profileName', t.name);
    setVal('profileRole', t.role || 'Mwalimu');
    setVal('profileBio', t.bio || '');
    setVal('profilePhone', t.phone || '');
    setVal('profileEmail', t.email || '');
    setText('teacherBadge', t.name);

    showPage(t.phone ? 'classes' : 'teacherProfile');
  } catch (e) {
    console.error(e);
    alert('Imeshindikana kuingia: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

/* Hifadhi taarifa: namba ya simu ni lazima, email ni hiari */
async function confirmTeacherProfile() {
  if (!ensureDb() || !currentTeacher) { alert('Ingia kwanza.'); return; }

  var name = sanitizeText(val('profileName')) || currentTeacher.name;
  var role = sanitizeText(val('profileRole')) || 'Mwalimu';
  var bio = sanitizeText(val('profileBio'));
  var phone = sanitizeText(val('profilePhone'));
  var email = sanitizeText(val('profileEmail'));

  if (!phone) { alert('Weka namba ya simu.'); return; }
  if (!/^[0-9+\s-]{9,15}$/.test(phone)) { alert('Namba ya simu si sahihi. Mfano: 0712345678'); return; }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { alert('Email si sahihi. Unaweza kuiacha wazi.'); return; }

  busy(true, 'Inahifadhi...');
  try {
    var res = await supabaseClient.from('teachers').update({
      name: name, role: role, bio: bio, phone: phone, email: email || null
    }).eq('id', currentTeacher.id).select();

    if (res.error) throw res.error;
    currentTeacher = res.data[0];
    setText('teacherBadge', currentTeacher.name);
    alert('Taarifa zimehifadhiwa Supabase.');
    showPage('classes');
  } catch (e) {
    console.error(e);
    alert('Imeshindikana kuhifadhi: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

/* Kubadilisha password — hiari */
async function changeTeacherPassword() {
  if (!ensureDb() || !currentTeacher) { alert('Ingia kwanza.'); return; }

  var oldPass = sanitizeText(val('oldPassword'));
  var newPass = sanitizeText(val('newPassword'));
  var newPass2 = sanitizeText(val('newPassword2'));

  if (!oldPass || !newPass) { alert('Jaza password ya zamani na mpya.'); return; }
  if (newPass.length < 4) { alert('Password mpya iwe na herufi 4 au zaidi.'); return; }
  if (newPass !== newPass2) { alert('Password mpya hazifanani.'); return; }

  busy(true, 'Inabadilisha password...');
  try {
    var oldHash = await hashPassword(oldPass);
    if (oldHash !== currentTeacher.password_hash) { alert('Password ya zamani si sahihi.'); return; }

    var newHash = await hashPassword(newPass);
    var res = await supabaseClient.from('teachers')
      .update({ password_hash: newHash }).eq('id', currentTeacher.id).select();
    if (res.error) throw res.error;

    currentTeacher = res.data[0];
    setVal('oldPassword', ''); setVal('newPassword', ''); setVal('newPassword2', '');
    alert('Password imebadilishwa.');
    showPage('classes');
  } catch (e) {
    console.error(e);
    alert('Imeshindikana: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

function teacherLogout() {
  currentTeacher = null;
  currentRows = [];
  myResults = [];
  setText('teacherBadge', '');
  showPage('landing');
}

function preview(input, id) {
  if (input.files && input.files[0]) {
    var r = new FileReader();
    r.onload = function (e) {
      setHTML(id, '<img src="' + e.target.result + '" alt="Picha">');
    };
    r.readAsDataURL(input.files[0]);
  }
}

/* ================================================================
   5. KUJAZA NA KUTUMA MATOKEO
   ================================================================ */
function selectClass(c) {
  currentClass = c;
  setText('chosenClass', c);
  showPage('classInfo');
}

function goToResults() {
  var s = normalizeSubject(val('subject'));
  var t = sanitizeText(val('term'));
  var y = sanitizeText(val('year'));
  var stream = sanitizeText(val('stream')).toUpperCase() || 'A';

  if (!s || !t || !y) { alert('Jaza Somo, Term na Mwaka.'); return; }

  var who = currentTeacher ? currentTeacher.name : '';
  setText('infoSummary', currentClass + ' — ' + s + ' — ' + t + ' — ' + y + ' — Mkondo ' + stream + ' — Mwalimu: ' + who);
  setText('resultClass', currentClass);
  setText('resultMeta', s + ' | ' + t + ' | ' + y + ' | Mkondo ' + stream + ' | Mwalimu: ' + who);

  if (!currentRows.length) {
    currentRows = [{ name: '', adm: '', marks: '' }, { name: '', adm: '', marks: '' }];
  }
  renderRows();
  showPage('results');
}

function updateRow(i, field, value) {
  if (!currentRows[i]) return;
  if (field === 'marks') {
    currentRows[i].marks = value === '' ? '' : Math.max(0, Math.min(100, Number(value)));
  } else {
    currentRows[i][field] = sanitizeText(value);
  }
  renderRows();
}

function renderRows() {
  var tbody = $('resultBody');
  if (!tbody) return;

  tbody.innerHTML = currentRows.map(function (r, i) {
    return '<tr>' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input value="' + esc(r.name) + '" onchange="updateRow(' + i + ',\'name\',this.value)" placeholder="Jina la mwanafunzi"></td>' +
      '<td><input value="' + esc(r.adm) + '" onchange="updateRow(' + i + ',\'adm\',this.value)" placeholder="Namba ya usajili"></td>' +
      '<td><input type="number" min="0" max="100" value="' + esc(r.marks) + '" onchange="updateRow(' + i + ',\'marks\',this.value)" placeholder="0-100"></td>' +
      '<td><b>' + (r.marks !== '' ? grade(r.marks) : '-') + '</b></td>' +
      '<td><button class="small-btn" onclick="deleteStudent(' + i + ')">Futa</button></td>' +
      '</tr>';
  }).join('');
}

function addStudent() {
  currentRows.push({ name: '', adm: '', marks: '' });
  renderRows();
}

function deleteStudent(i) {
  currentRows.splice(i, 1);
  if (!currentRows.length) currentRows = [{ name: '', adm: '', marks: '' }];
  renderRows();
}

function reviewSubmission() {
  var s = normalizeSubject(val('subject'));
  var t = sanitizeText(val('term'));
  var y = sanitizeText(val('year'));
  var stream = sanitizeText(val('stream')).toUpperCase() || 'A';
  var filled = currentRows.filter(function (r) { return r.name && r.marks !== ''; });

  setHTML('reviewContent',
    '<div class="review-row"><b>Darasa</b><span>' + esc(currentClass) + ' (Mkondo ' + esc(stream) + ')</span></div>' +
    '<div class="review-row"><b>Somo</b><span>' + esc(s) + '</span></div>' +
    '<div class="review-row"><b>Kipindi</b><span>' + esc(t) + ' — ' + esc(y) + '</span></div>' +
    '<div class="review-row"><b>Mwalimu</b><span>' + esc(currentTeacher ? currentTeacher.name : '') + '</span></div>' +
    '<div class="review-row"><b>Simu</b><span>' + esc(currentTeacher ? currentTeacher.phone : '') + '</span></div>' +
    '<div class="review-row"><b>Wanafunzi</b><span>' + filled.length + '</span></div>' +
    buildResultTable(filled.map(function (r) {
      return { name: r.name, adm: r.adm, marks: Number(r.marks), grade: grade(r.marks) };
    }))
  );
  showPage('review');
}

async function submitResults() {
  if (!ensureDb() || !currentTeacher) { alert('Ingia kwanza.'); return; }

  var rows = currentRows
    .filter(function (r) { return sanitizeText(r.name) && r.marks !== ''; })
    .map(function (r) {
      return {
        name: sanitizeText(r.name),
        adm: sanitizeText(r.adm),
        marks: Number(r.marks),
        grade: grade(r.marks)
      };
    });

  if (!rows.length) { alert('Hakuna mwanafunzi mwenye jina na alama.'); return; }

  var item = {
    class_name: currentClass,
    subject: normalizeSubject(val('subject')),
    term: sanitizeText(val('term')),
    year: sanitizeText(val('year')),
    stream: sanitizeText(val('stream')).toUpperCase() || 'A',
    teacher_id: currentTeacher.id,
    teacher_name: currentTeacher.name,
    teacher_phone: currentTeacher.phone || '',
    teacher_email: currentTeacher.email || '',
    status: 'Pending Admin',
    rows: rows
  };

  busy(true, 'Inatuma matokeo...');
  try {
    var res = await supabaseClient.from('results').insert([item]).select();
    if (res.error) throw res.error;
    alert('Matokeo yametumwa na kuhifadhiwa Supabase.');
    currentRows = [];
    showPage('postSubmit');
  } catch (e) {
    console.error(e);
    alert('Imeshindikana kutuma: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

/* ================================================================
   6. HISTORIA YA MWALIMU
   ================================================================ */
async function loadMyResults() {
  if (!ensureDb() || !currentTeacher) return;
  busy(true, 'Inapakia historia...');
  try {
    var res = await supabaseClient.from('results').select('*')
      .eq('teacher_id', currentTeacher.id).order('id', { ascending: false });
    if (res.error) throw res.error;
    myResults = res.data || [];
    renderHistory();
  } catch (e) {
    console.error(e);
    setHTML('historyList', '<div class="card">Imeshindikana kupakia: ' + esc(e.message) + '</div>');
  } finally {
    busy(false);
  }
}

function renderHistory() {
  if (!myResults.length) {
    setHTML('historyList', '<div class="card">Bado hujatuma matokeo yoyote.</div>');
    return;
  }
  setHTML('historyList', myResults.map(function (x) {
    return '<div class="history-item">' +
      '<div><b>' + esc(x.class_name) + ' — ' + esc(x.subject) + '</b>' +
      '<div class="muted">' + esc(x.term) + ' ' + esc(x.year) + ' • Mkondo ' + esc(x.stream || 'A') +
      ' • Wanafunzi ' + ((x.rows && x.rows.length) || 0) + ' • ' + esc(fmtDate(x.created_at)) + '</div></div>' +
      '<div><span class="status ' + statusClass(x.status) + '">' + esc(x.status) + '</span>' +
      '<button class="small-btn" onclick="openResult(' + x.id + ',\'teacher\')">Fungua</button></div>' +
      '</div>';
  }).join(''));
}

function statusClass(s) {
  return s === 'Approved' ? 'ok' : 'wait';
}

/* ================================================================
   7. ADMIN
   ================================================================ */
async function adminEnter() {
  var name = sanitizeText(val('adminName'));
  var pass = sanitizeText(val('adminPassword'));

  if (!name || !pass) { alert('Jaza jina na password.'); return; }
  if (pass !== ADMIN_PASSWORD) { alert('Password si sahihi.'); return; }

  currentAdminName = name;
  setVal('adminProfileName', name);
  setText('adminBadge', name);
  showPage('adminProfile');
}

async function saveAdminProfile() {
  var name = sanitizeText(val('adminProfileName')) || currentAdminName || 'Admin';
  var role = sanitizeText(val('adminRole')) || 'Msimamizi Mkuu';
  var bio = sanitizeText(val('adminBio'));

  currentAdminName = name;
  currentAdminRole = role;
  currentAdminBio = bio;
  setText('adminBadge', name);

  if (supabaseClient) {
    busy(true, 'Inahifadhi...');
    try {
      var found = await supabaseClient.from('admins').select('id').ilike('name', name).limit(1);
      if (found.data && found.data.length) {
        await supabaseClient.from('admins').update({ role: role, bio: bio }).eq('id', found.data[0].id);
      } else {
        await supabaseClient.from('admins').insert([{ name: name, role: role, bio: bio }]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      busy(false);
    }
  }
  showPage('admin');
}

function adminLogout() {
  currentAdminName = '';
  allResults = [];
  allTeachers = [];
  setText('adminBadge', '');
  showPage('landing');
}

/* --- Matokeo yote --- */
async function loadAllResults() {
  if (!ensureDb()) return;
  busy(true, 'Inapakia matokeo...');
  try {
    var res = await supabaseClient.from('results').select('*').order('id', { ascending: false });
    if (res.error) throw res.error;
    allResults = res.data || [];
    renderAdmin();
  } catch (e) {
    console.error(e);
    setHTML('adminList', '<div class="card">Imeshindikana kupakia: ' + esc(e.message) + '</div>');
  } finally {
    busy(false);
  }
}

function adminFilteredResults() {
  var q = sanitizeText(val('adminSearch')).toLowerCase();
  var f = val('adminStatusFilter');
  return allResults.filter(function (x) {
    var okStatus = !f || f === 'all' || x.status === f;
    var hay = [x.teacher_name, x.class_name, x.subject, x.term, x.year, x.stream].join(' ').toLowerCase();
    return okStatus && (!q || hay.indexOf(q) > -1);
  });
}

function renderAdmin() {
  var pending = allResults.filter(function (x) { return x.status !== 'Approved'; }).length;
  setText('pendingCount', pending);
  setText('totalCount', allResults.length);
  setText('teacherCount', new Set(allResults.map(function (x) { return x.teacher_name; })).size);

  var list = adminFilteredResults();
  if (!list.length) {
    setHTML('adminList', '<div class="card">Hakuna matokeo yanayolingana na utafutaji.</div>');
    return;
  }

  setHTML('adminList',
    '<div class="table-wrap"><table class="grid">' +
    '<thead><tr><th>#</th><th>Mwalimu</th><th>Simu</th><th>Darasa</th><th>Somo</th><th>Term</th><th>Mwaka</th><th>Mkondo</th><th>Wanafunzi</th><th>Tarehe</th><th>Hali</th><th>Vitendo</th></tr></thead><tbody>' +
    list.map(function (x, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + esc(x.teacher_name) + '</td>' +
        '<td>' + esc(x.teacher_phone || '-') + '</td>' +
        '<td>' + esc(x.class_name) + '</td>' +
        '<td>' + esc(x.subject) + '</td>' +
        '<td>' + esc(x.term) + '</td>' +
        '<td>' + esc(x.year) + '</td>' +
        '<td>' + esc(x.stream || 'A') + '</td>' +
        '<td>' + ((x.rows && x.rows.length) || 0) + '</td>' +
        '<td>' + esc(fmtDate(x.created_at)) + '</td>' +
        '<td><span class="status ' + statusClass(x.status) + '">' + esc(x.status) + '</span></td>' +
        '<td class="actions">' +
        '<button class="small-btn" onclick="openResult(' + x.id + ',\'admin\')">Angalia</button>' +
        (x.status === 'Approved' ? '' : '<button class="small-btn ok" onclick="approve(' + x.id + ')">Thibitisha</button>') +
        '<button class="small-btn danger" onclick="deleteResult(' + x.id + ')">Futa</button>' +
        '</td></tr>';
    }).join('') +
    '</tbody></table></div>'
  );
}

async function approve(id) {
  if (!ensureDb()) return;
  busy(true, 'Inathibitisha...');
  try {
    var res = await supabaseClient.from('results')
      .update({ status: 'Approved', approved_at: new Date().toISOString(), admin_name: currentAdminName || 'Admin' })
      .eq('id', id).select();
    if (res.error) throw res.error;
    await loadAllResults();
  } catch (e) {
    console.error(e);
    alert('Imeshindikana kuthibitisha: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

async function deleteResult(id) {
  if (!ensureDb()) return;
  if (!confirm('Una uhakika unataka kufuta matokeo haya? Hayatarudi.')) return;

  busy(true, 'Inafuta...');
  try {
    var res = await supabaseClient.from('results').delete().eq('id', id);
    if (res.error) throw res.error;
    await loadAllResults();
    showPage('admin');
  } catch (e) {
    console.error(e);
    alert('Imeshindikana kufuta: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

/* --- Kufungua matokeo moja kwa mfumo wa safu na mistari --- */
function buildResultTable(rows) {
  if (!rows || !rows.length) return '<div class="card">Hakuna wanafunzi kwenye matokeo haya.</div>';

  var marks = rows.map(function (r) { return Number(r.marks) || 0; });
  var avg = (marks.reduce(function (a, b) { return a + b; }, 0) / marks.length).toFixed(1);
  var top = Math.max.apply(null, marks);
  var low = Math.min.apply(null, marks);
  var pass = rows.filter(function (r) { return Number(r.marks) >= 40; }).length;

  var sorted = rows.slice().sort(function (a, b) { return Number(b.marks) - Number(a.marks); });

  return '<div class="table-wrap"><table class="grid">' +
    '<thead><tr><th>Nafasi</th><th>Jina</th><th>Namba ya usajili</th><th>Alama</th><th>Daraja</th></tr></thead><tbody>' +
    sorted.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.adm || '-') +
        '</td><td>' + esc(r.marks) + '</td><td><b>' + esc(r.grade || grade(r.marks)) + '</b></td></tr>';
    }).join('') +
    '</tbody></table></div>' +
    '<div class="stats">' +
    '<div><span>' + rows.length + '</span>Wanafunzi</div>' +
    '<div><span>' + avg + '</span>Wastani</div>' +
    '<div><span>' + top + '</span>Juu</div>' +
    '<div><span>' + low + '</span>Chini</div>' +
    '<div><span>' + pass + '</span>Wamefaulu</div>' +
    '</div>';
}

function openResult(id, from) {
  var pool = from === 'admin' ? allResults : myResults;
  var x = pool.filter(function (r) { return String(r.id) === String(id); })[0];
  if (!x) { alert('Matokeo hayakupatikana.'); return; }

  setHTML('adminViewContent',
    '<div class="meta-grid">' +
    '<div><b>Darasa</b>' + esc(x.class_name) + '</div>' +
    '<div><b>Somo</b>' + esc(x.subject) + '</div>' +
    '<div><b>Kipindi</b>' + esc(x.term) + ' — ' + esc(x.year) + '</div>' +
    '<div><b>Mkondo</b>' + esc(x.stream || 'A') + '</div>' +
    '<div><b>Mwalimu</b>' + esc(x.teacher_name) + '</div>' +
    '<div><b>Simu</b>' + esc(x.teacher_phone || '-') + '</div>' +
    '<div><b>Email</b>' + esc(x.teacher_email || '-') + '</div>' +
    '<div><b>Imetumwa</b>' + esc(fmtDate(x.created_at)) + '</div>' +
    '<div><b>Hali</b>' + esc(x.status) + '</div>' +
    '<div><b>Imethibitishwa</b>' + esc(fmtDate(x.approved_at)) + '</div>' +
    '</div>' +
    buildResultTable(x.rows || []) +
    (from === 'admin'
      ? '<div class="row-btns">' +
        (x.status === 'Approved' ? '' : '<button class="primary" onclick="approve(' + x.id + ');showPage(\'admin\')">Thibitisha</button>') +
        '<button class="danger" onclick="deleteResult(' + x.id + ')">Futa matokeo</button>' +
        '<button class="ghost" onclick="showPage(\'admin\')">Rudi</button></div>'
      : '<div class="row-btns"><button class="ghost" onclick="showPage(\'history\')">Rudi</button></div>')
  );
  showPage('adminView');
}

/* --- Taarifa za waalimu --- */
async function loadAllTeachers() {
  if (!ensureDb()) return;
  busy(true, 'Inapakia waalimu...');
  try {
    var t = await supabaseClient.from('teachers').select('*').order('id', { ascending: false });
    if (t.error) throw t.error;
    allTeachers = t.data || [];

    if (!allResults.length) {
      var r = await supabaseClient.from('results').select('*').order('id', { ascending: false });
      if (!r.error) allResults = r.data || [];
    }
    renderTeachers();
  } catch (e) {
    console.error(e);
    setHTML('teacherTable', '<div class="card">Imeshindikana kupakia: ' + esc(e.message) + '</div>');
  } finally {
    busy(false);
  }
}

function renderTeachers() {
  if (!allTeachers.length) {
    setHTML('teacherTable', '<div class="card">Hakuna mwalimu aliyejisajili bado.</div>');
    return;
  }

  setHTML('teacherTable',
    '<div class="table-wrap"><table class="grid">' +
    '<thead><tr><th>#</th><th>Jina</th><th>Wadhifa</th><th>Simu</th><th>Email</th><th>Matokeo</th><th>Amejisajili</th><th>Hali</th><th>Vitendo</th></tr></thead><tbody>' +
    allTeachers.map(function (t, i) {
      var count = allResults.filter(function (r) { return String(r.teacher_id) === String(t.id); }).length;
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + esc(t.name) + '</td>' +
        '<td>' + esc(t.role || 'Mwalimu') + '</td>' +
        '<td>' + esc(t.phone || '-') + '</td>' +
        '<td>' + esc(t.email || '-') + '</td>' +
        '<td>' + count + '</td>' +
        '<td>' + esc(fmtDate(t.created_at)) + '</td>' +
        '<td><span class="status ' + (t.status === 'Active' ? 'ok' : 'wait') + '">' + esc(t.status || 'Active') + '</span></td>' +
        '<td class="actions">' +
        '<button class="small-btn" onclick="viewTeacherHistory(' + t.id + ')">Historia</button>' +
        '<button class="small-btn" onclick="toggleTeacherStatus(' + t.id + ')">' +
        (t.status === 'Active' ? 'Simamisha' : 'Rudisha') + '</button>' +
        '</td></tr>';
    }).join('') +
    '</tbody></table></div>'
  );
}

function viewTeacherHistory(teacherId) {
  var t = allTeachers.filter(function (x) { return String(x.id) === String(teacherId); })[0];
  var mine = allResults.filter(function (x) { return String(x.teacher_id) === String(teacherId); });

  setHTML('adminViewContent',
    '<h3>' + esc(t ? t.name : 'Mwalimu') + '</h3>' +
    '<div class="meta-grid">' +
    '<div><b>Wadhifa</b>' + esc(t && t.role || 'Mwalimu') + '</div>' +
    '<div><b>Simu</b>' + esc(t && t.phone || '-') + '</div>' +
    '<div><b>Email</b>' + esc(t && t.email || '-') + '</div>' +
    '<div><b>Hali</b>' + esc(t && t.status || 'Active') + '</div>' +
    '<div><b>Amejisajili</b>' + esc(fmtDate(t && t.created_at)) + '</div>' +
    '<div><b>Matokeo</b>' + mine.length + '</div>' +
    '</div>' +
    (t && t.bio ? '<p class="muted">' + esc(t.bio) + '</p>' : '') +
    (mine.length
      ? '<div class="table-wrap"><table class="grid"><thead><tr><th>#</th><th>Darasa</th><th>Somo</th><th>Term</th><th>Mwaka</th><th>Wanafunzi</th><th>Tarehe</th><th>Hali</th><th></th></tr></thead><tbody>' +
        mine.map(function (x, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.class_name) + '</td><td>' + esc(x.subject) +
            '</td><td>' + esc(x.term) + '</td><td>' + esc(x.year) + '</td><td>' + ((x.rows && x.rows.length) || 0) +
            '</td><td>' + esc(fmtDate(x.created_at)) + '</td><td>' + esc(x.status) + '</td>' +
            '<td class="actions"><button class="small-btn" onclick="openResult(' + x.id + ',\'admin\')">Angalia</button>' +
            '<button class="small-btn danger" onclick="deleteResult(' + x.id + ')">Futa</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="card">Mwalimu huyu hajatuma matokeo bado.</div>') +
    '<div class="row-btns"><button class="ghost" onclick="showPage(\'adminTeachers\')">Rudi kwa waalimu</button></div>'
  );
  showPage('adminView');
}

async function toggleTeacherStatus(id) {
  if (!ensureDb()) return;
  var t = allTeachers.filter(function (x) { return String(x.id) === String(id); })[0];
  if (!t) return;
  var next = t.status === 'Active' ? 'Suspended' : 'Active';

  busy(true, 'Inabadilisha hali...');
  try {
    var res = await supabaseClient.from('teachers').update({ status: next }).eq('id', id);
    if (res.error) throw res.error;
    await loadAllTeachers();
  } catch (e) {
    console.error(e);
    alert('Imeshindikana: ' + (e.message || e));
  } finally {
    busy(false);
  }
}

/* --- Kuona data halisi za Supabase (teachers / results / admins) --- */
async function loadRawTable() {
  if (!ensureDb()) return;
  var table = val('rawTable') || 'teachers';

  busy(true, 'Inasoma jedwali ' + table + '...');
  try {
    var res = await supabaseClient.from(table).select('*').order('id', { ascending: false }).limit(200);
    if (res.error) throw res.error;
    renderRawTable(table, res.data || []);
  } catch (e) {
    console.error(e);
    setHTML('rawOutput', '<div class="card">Imeshindikana kusoma jedwali: ' + esc(e.message) + '</div>');
  } finally {
    busy(false);
  }
}

function renderRawTable(table, rows) {
  if (!rows.length) {
    setHTML('rawOutput', '<div class="card">Jedwali <b>' + esc(table) + '</b> halina data.</div>');
    return;
  }

  var cols = Object.keys(rows[0]).filter(function (c) { return c !== 'password_hash'; });

  setHTML('rawOutput',
    '<p class="muted">Jedwali <b>' + esc(table) + '</b> • rekodi ' + rows.length +
    ' • safu ' + cols.length + ' (password_hash imefichwa)</p>' +
    '<div class="table-wrap"><table class="grid"><thead><tr>' +
    cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
    '</tr></thead><tbody>' +
    rows.map(function (r) {
      return '<tr>' + cols.map(function (c) {
        var v = r[c];
        if (v && typeof v === 'object') v = Array.isArray(v) ? v.length + ' rekodi' : JSON.stringify(v);
        if (c.indexOf('_at') > -1) v = fmtDate(r[c]);
        return '<td>' + esc(v === null || v === undefined ? '-' : v) + '</td>';
      }).join('') + '</tr>';
    }).join('') +
    '</tbody></table></div>'
  );
}

/* Pakua matokeo yote kama CSV */
function exportResultsCSV() {
  if (!allResults.length) { alert('Hakuna matokeo ya kupakua.'); return; }

  var lines = [['Mwalimu', 'Simu', 'Darasa', 'Somo', 'Term', 'Mwaka', 'Mkondo', 'Mwanafunzi', 'Usajili', 'Alama', 'Daraja', 'Hali'].join(',')];
  allResults.forEach(function (x) {
    (x.rows || []).forEach(function (r) {
      lines.push([x.teacher_name, x.teacher_phone, x.class_name, x.subject, x.term, x.year,
        x.stream, r.name, r.adm, r.marks, r.grade, x.status]
        .map(function (v) { return '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"'; })
        .join(','));
    });
  });

  var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'matokeo-kasange.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ================================================================
   8. KUANZA
   ================================================================ */
function init() {
  showPage('landing');
  if (!supabaseClient) {
    alert('Supabase haijaunganishwa. Angalia script ya supabase-js kwenye HTML.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}