// Variable global badala ya const ili kuzuia 'already declared' error
var supabaseClient = null;

// Initialize Supabase Client salama
if (typeof supabase !== 'undefined' && supabase.createClient) {
  const SUPABASE_URL = 'https://nnytkdjooerftqowcxvu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_OtNLdiJlOW40cDdLvLO3QA_CKBVmcws';
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let currentClass = '';
let currentRows = [];
let currentTeacher = '';
let currentTeacherRole = '';
let currentTeacherBio = '';
let currentAdminName = '';
let currentAdminRole = '';
let currentAdminBio = '';
let history = [];
let submissions = [];

const pages = [
  'landing', 'teacherLogin', 'adminLogin', 'classes', 
  'teacherProfile', 'classInfo', 'results', 'review', 
  'postSubmit', 'history', 'admin', 'adminProfile'
];

const ADMIN_PASSWORD = 'admin123';
const TEACHER_PASSWORD = 'teacher123';

// Navigation Function
function showPage(id) {
  pages.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== id);
  });
  window.scrollTo(0, 0);
  if (id === 'history') renderHistory();
  if (id === 'admin') renderAdmin();
}

// Helpers
function sanitizeText(value) {
  return String(value || '').trim().replace(/[<>]/g, '');
}

function normalizeSubject(value) {
  return sanitizeText(value).replace(/\s+/g, ' ');
}

function grade(m) {
  m = Number(m);
  if (m >= 80) return 'A';
  if (m >= 70) return 'B+';
  if (m >= 60) return 'B';
  if (m >= 50) return 'C';
  if (m >= 40) return 'D';
  return 'F';
}

// Actions
function createTeacherAccount() {
  let name = sanitizeText(document.getElementById('teacherCreateName')?.value);
  let pass = sanitizeText(document.getElementById('teacherCreatePassword')?.value);

  if (!name || !pass) {
    alert('Tafadhali jaza Jina na Password!');
    return;
  }
  currentTeacher = name;
  let profName = document.getElementById('profileName');
  if (profName) profName.value = currentTeacher;
  alert('Akaunti imeundwa kikamilifu!');
  showPage('teacherProfile');
}

function teacherEnter() {
  let nameInput = document.getElementById('teacherLoginName');
  let passInput = document.getElementById('teacherLoginPassword');
  
  let teacherName = sanitizeText(nameInput ? nameInput.value : '');
  let teacherPassword = sanitizeText(passInput ? passInput.value : '');
  
  if (!teacherName || !teacherPassword) { alert('Jaza jina na password.'); return; }
  if (teacherPassword !== TEACHER_PASSWORD) { alert('Password si sahihi.'); return; }
  
  currentTeacher = teacherName;
  let profName = document.getElementById('profileName');
  if (profName) profName.value = currentTeacher;
  
  showPage('teacherProfile');
}

function adminEnter() {
  let nameInput = document.getElementById('adminName');
  let passInput = document.getElementById('adminPassword');
  
  let adminName = sanitizeText(nameInput ? nameInput.value : '');
  let adminPassword = sanitizeText(passInput ? passInput.value : '');
  
  if (!adminName || !adminPassword) { alert('Jaza jina na password.'); return; }
  if (adminPassword !== ADMIN_PASSWORD) { alert('Password si sahihi.'); return; }
  
  currentAdminName = adminName;
  showPage('adminProfile');
}

function preview(input, id) {
  if (input.files && input.files[0]) {
    let r = new FileReader();
    r.onload = e => {
      let previewEl = document.getElementById(id);
      if (previewEl) previewEl.innerHTML = `<img src="${e.target.result}" alt="Profile Preview">`;
    };
    r.readAsDataURL(input.files[0]);
  }
}

async function confirmTeacherProfile() {
  let n = sanitizeText(document.getElementById('profileName')?.value);
  let role = sanitizeText(document.getElementById('profileRole')?.value);
  let bio = sanitizeText(document.getElementById('profileBio')?.value);
  
  if (n) currentTeacher = n;
  currentTeacherRole = role || 'Mwalimu';
  currentTeacherBio = bio || '';

  if (supabaseClient) {
    const { error } = await supabaseClient.from('teachers').insert([{
      name: currentTeacher,
      role: currentTeacherRole,
      bio: currentTeacherBio
    }]);
    if (error) console.error('Error teacher:', error.message);
  }

  showPage('classes');
}

async function saveAdminProfile() {
  let name = sanitizeText(document.getElementById('adminProfileName')?.value);
  let role = sanitizeText(document.getElementById('adminRole')?.value);
  let bio = sanitizeText(document.getElementById('adminBio')?.value);
  
  if (name) currentAdminName = name;
  currentAdminRole = role || 'Msimamizi Mkuu';
  currentAdminBio = bio || '';

  if (supabaseClient) {
    const { error } = await supabaseClient.from('admins').insert([{
      name: currentAdminName || 'Admin',
      role: currentAdminRole,
      bio: currentAdminBio
    }]);
    if (error) console.error('Error admin:', error.message);
  }

  showPage('admin');
}

function selectClass(c) {
  currentClass = c;
  let chosenClassEl = document.getElementById('chosenClass');
  if (chosenClassEl) chosenClassEl.textContent = c;
  showPage('classInfo');
}

function goToResults() {
  let s = normalizeSubject(document.getElementById('subject')?.value);
  let t = sanitizeText(document.getElementById('term')?.value);
  let y = sanitizeText(document.getElementById('year')?.value);
  let stream = sanitizeText(document.getElementById('stream')?.value).toUpperCase() || 'A';
  
  if (!s || !t || !y) { alert('Jaza Somo, Term na Mwaka.'); return; }
  
  let infoSummary = document.getElementById('infoSummary');
  let resultClass = document.getElementById('resultClass');
  let resultMeta = document.getElementById('resultMeta');
  
  if (infoSummary) infoSummary.textContent = `${currentClass} — ${s} — ${t} — ${y} — Mkondo ${stream} — Mwalimu: ${currentTeacher}`;
  if (resultClass) resultClass.textContent = currentClass;
  if (resultMeta) resultMeta.textContent = `${s} | ${t} | ${y} | Mkondo ${stream} | Mwalimu: ${currentTeacher}`;
  
  if (!currentRows.length) {
    currentRows = [{ name: '', adm: '', marks: '' }, { name: '', adm: '', marks: '' }];
  }
  renderRows();
  showPage('results');
}

function renderRows() {
  let tbody = document.getElementById('resultBody');
  if (!tbody) return;
  
  tbody.innerHTML = currentRows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><input value="${sanitizeText(r.name)}" onchange="currentRows[${i}].name=sanitizeText(this.value)" placeholder="Jina la Mwanafunzi"></td>
      <td><input value="${sanitizeText(r.adm)}" onchange="currentRows[${i}].adm=sanitizeText(this.value)" placeholder="Admission No."></td>
      <td><input type="number" min="0" max="100" value="${r.marks}" onchange="currentRows[${i}].marks=Math.max(0,Math.min(100,Number(this.value)))" placeholder="0-100"></td>
      <td><b>${r.marks !== '' ? grade(r.marks) : '-'}</b></td>
      <td><button class="small-btn" onclick="deleteStudent(${i})">Futa</button></td>
    </tr>
  `).join('');
}

function addStudent() {
  currentRows.push({ name: '', adm: '', marks: '' });
  renderRows();
}

function deleteStudent(i) {
  if (currentRows.length > 1) {
    currentRows.splice(i, 1);
  } else {
    currentRows = [{ name: '', adm: '', marks: '' }];
  }
  renderRows();
}

function reviewSubmission() {
  let reviewContent = document.getElementById('reviewContent');
  if (!reviewContent) return;
  
  let s = normalizeSubject(document.getElementById('subject')?.value);
  let t = sanitizeText(document.getElementById('term')?.value);
  let y = sanitizeText(document.getElementById('year')?.value);
  let stream = sanitizeText(document.getElementById('stream')?.value).toUpperCase() || 'A';

  reviewContent.innerHTML = `
    <div class="review-row"><b>Darasa:</b> <span>${currentClass} (Mkondo ${stream})</span></div>
    <div class="review-row"><b>Somo:</b> <span>${s}</span></div>
    <div class="review-row"><b>Kipindi:</b> <span>${t} — ${y}</span></div>
    <div class="review-row"><b>Mwalimu:</b> <span>${currentTeacher} (${currentTeacherRole || 'Mwalimu'})</span></div>
    <div class="review-row"><b>Wanafunzi:</b> <span>${currentRows.length} Wanafunzi</span></div>
  `;
  showPage('review');
}

async function submitResults() {
  let item = {
    class_name: currentClass,
    subject: normalizeSubject(document.getElementById('subject')?.value),
    term: sanitizeText(document.getElementById('term')?.value),
    year: sanitizeText(document.getElementById('year')?.value),
    stream: sanitizeText(document.getElementById('stream')?.value).toUpperCase() || 'A',
    teacher_name: currentTeacher,
    teacher_role: currentTeacherRole || 'Mwalimu',
    teacher_bio: currentTeacherBio || '',
    admin_name: currentAdminName || 'Admin',
    status: 'Pending Admin',
    rows: currentRows.map(r => ({
      name: sanitizeText(r.name),
      adm: sanitizeText(r.adm),
      marks: Number(r.marks),
      grade: grade(r.marks)
    }))
  };

  if (supabaseClient) {
    const { data, error } = await supabaseClient.from('results').insert([item]).select();
    if (error) console.error('Supabase Error:', error.message);
    if (data && data.length) item.id = data[0].id;
  } else {
    item.id = Date.now();
  }

  submissions.unshift(item);
  history.unshift(item);
  alert('Matokeo yamefanikiwa kutumwa!');
  currentRows = [];
  showPage('postSubmit');
}

function renderHistory() {
  let list = document.getElementById('historyList');
  if (!list) return;

  list.innerHTML = history.length ? history.map(x => `
    <div class="history-item">
      <div>
        <b>${x.class_name || x.class} — ${x.subject}</b>
        <div>Mwalimu: ${x.teacher_name || x.teacher} | ${x.term} ${x.year} (Mkondo ${x.stream || 'A'})</div>
      </div>
      <span class="status">${x.status}</span>
    </div>
  `).join('') : '<div class="card">Hakuna historia ya matokeo.</div>';
}

function renderAdmin() {
  let pendingEl = document.getElementById('pendingCount');
  let adminList = document.getElementById('adminList');

  if (pendingEl) pendingEl.textContent = submissions.filter(x => x.status === 'Pending Admin').length;

  if (adminList) {
    adminList.innerHTML = submissions.length ? submissions.map(x => `
      <div class="history-item">
        <div>
          <b>${x.class_name || x.class} — ${x.subject}</b>
          <div>Mwalimu: ${x.teacher_name || x.teacher} (${x.term} ${x.year})</div>
        </div>
        <div>
          <span class="status">${x.status}</span>
          <button class="primary" style="margin-left:8px" onclick="approve('${x.id}')">Approve</button>
        </div>
      </div>
    `).join('') : '<div class="card">Hakuna matokeo yaliyotumwa bado.</div>';
  }
}

async function approve(id) {
  if (supabaseClient) {
    await supabaseClient.from('results').update({ status: 'Approved' }).eq('id', id);
  }
  submissions = submissions.map(x => x.id == id ? { ...x, status: 'Approved' } : x);
  history = history.map(x => x.id == id ? { ...x, status: 'Approved' } : x);
  renderAdmin();
  renderHistory();
}

async function loadFromSupabase() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from('results').select('*').order('id', { ascending: false });
  if (!error && data) {
    submissions = data;
    history = data;
  }
}

async function init() {
  await loadFromSupabase();
  showPage('landing');
}

// Anzisha mfumo
init();