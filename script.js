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

// Supabase Configuration - Weka Keys Zako Hapa
const SUPABASE_URL = 'https://nnytkdjooerftqowcxvu.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_PUBLISHABLE_OR_ANON_KEY_HERE';

const supabase = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'https://your-project-ref.supabase.co') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// Page Navigation
function showPage(id) {
  pages.forEach(p => {
    const el = document.getElementById(p);
    if (el) el.classList.toggle('hidden', p !== id);
  });
  window.scrollTo(0, 0);
  if (id === 'history') renderHistory();
  if (id === 'admin') renderAdmin();
}

// Dark / Light Theme Toggle
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) {
  themeBtn.onclick = () => document.body.classList.toggle('dark');
}

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.onclick = () => {
    logoutBtn.classList.add('hidden');
    showPage('landing');
  };
}

// Teacher Authentication
function teacherEnter() {
  let nameInput = document.getElementById('teacherName');
  let passInput = document.getElementById('teacherPassword');
  
  let teacherName = sanitizeText(nameInput ? nameInput.value : '');
  let teacherPassword = sanitizeText(passInput ? passInput.value : '');
  
  if (!teacherName) { alert('Jina la mwalimu linahitajika.'); return; }
  if (!teacherPassword) { alert('Weka password ya mwalimu.'); return; }
  if (teacherPassword !== TEACHER_PASSWORD) { alert('Password ya mwalimu si sahihi.'); return; }
  
  currentTeacher = teacherName;
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  
  // Jaza jina kwenye profile
  let profName = document.getElementById('profileName');
  if (profName) profName.value = currentTeacher;
  
  showPage('teacherProfile');
}

// Admin Authentication
function adminEnter() {
  let nameInput = document.getElementById('adminName');
  let passInput = document.getElementById('adminPassword');
  
  let adminName = sanitizeText(nameInput ? nameInput.value : '');
  let adminPassword = sanitizeText(passInput ? passInput.value : '');
  
  if (!adminName) { alert('Jina la admin linahitajika.'); return; }
  if (!adminPassword) { alert('Weka password ya admin.'); return; }
  if (adminPassword !== ADMIN_PASSWORD) { alert('Password ya admin si sahihi.'); return; }
  
  currentAdminName = adminName;
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  showPage('adminProfile');
}

// Image Preview for Profile Photos
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

// Save Teacher Profile to Supabase
async function confirmTeacherProfile() {
  let n = sanitizeText(document.getElementById('profileName')?.value);
  let role = sanitizeText(document.getElementById('profileRole')?.value);
  let bio = sanitizeText(document.getElementById('profileBio')?.value);
  
  if (n) currentTeacher = n;
  currentTeacherRole = role || 'Mwalimu';
  currentTeacherBio = bio || '';

  if (supabase) {
    const { error } = await supabase.from('teachers').insert([{
      name: currentTeacher,
      role: currentTeacherRole,
      bio: currentTeacherBio
    }]);
    if (error) console.error('Error saving teacher profile:', error.message);
  }

  showPage('classes');
}

// Save Admin Profile to Supabase
async function saveAdminProfile() {
  let role = sanitizeText(document.getElementById('adminRole')?.value);
  let bio = sanitizeText(document.getElementById('adminBio')?.value);
  
  currentAdminRole = role || 'Msimamizi Mkuu';
  currentAdminBio = bio || '';

  if (supabase) {
    const { error } = await supabase.from('admins').insert([{
      name: currentAdminName || 'Admin',
      role: currentAdminRole,
      bio: currentAdminBio
    }]);
    if (error) console.error('Error saving admin profile:', error.message);
  }

  showPage('admin');
}

function selectClass(c) {
  currentClass = c;
  let chosenClassEl = document.getElementById('chosenClass');
  if (chosenClassEl) chosenClassEl.textContent = c;
  showPage('classInfo');
}

function sanitizeText(value) {
  return String(value || '').trim().replace(/[<>]/g, '');
}

function normalizeSubject(value) {
  return sanitizeText(value).replace(/\s+/g, ' ');
} 

function goToResults() {
  let s = normalizeSubject(document.getElementById('subject')?.value);
  let t = sanitizeText(document.getElementById('term')?.value);
  let y = sanitizeText(document.getElementById('year')?.value);
  let stream = sanitizeText(document.getElementById('stream')?.value).toUpperCase() || 'A';
  
  if (!s || !t || !y) { alert('Jaza Somo, Term na Mwaka kabla ya kuendelea.'); return; }
  
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

function grade(m) {
  m = Number(m);
  if (m >= 80) return 'A';
  if (m >= 70) return 'B+';
  if (m >= 60) return 'B';
  if (m >= 50) return 'C';
  if (m >= 40) return 'D';
  return 'F';
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

// Submit Results to Supabase
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

  if (supabase) {
    const { data, error } = await supabase.from('results').insert([item]).select();
    if (error) {
      alert('Hitilafu ya kuhifadhi Supabase: ' + error.message);
      return;
    }
    if (data && data.length) item.id = data[0].id;
  } else {
    item.id = Date.now();
  }

  submissions.unshift(item);
  history.unshift(item);
  alert('Matokeo yamefanikiwa kutumwa kwa Admin!');
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
  `).join('') : '<div class="card">Hakuna historia ya matokeo kwa sasa.</div>';
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
          <button class="secondary" style="margin-left:8px" onclick="viewSubmission('${x.id}')">View</button>
        </div>
      </div>
    `).join('') : '<div class="card">Hakuna matokeo yaliyotumwa bado.</div>';
  }
}

function viewSubmission(id) {
  let item = submissions.find(x => x.id == id);
  if (!item) return;

  let rowDetail = (item.rows || []).map(r => `${r.name} (${r.adm || 'No Adm'}) : <b>${r.marks}</b> (${r.grade})`).join('<br>');

  let detailContent = document.getElementById('adminDetailContent');
  let detailCard = document.getElementById('adminDetail');

  if (detailContent) {
    detailContent.innerHTML = `
      <div class="review-row"><b>Mwalimu:</b> <span>${item.teacher_name || item.teacher} (${item.teacher_role || '—'})</span></div>
      <div class="review-row"><b>Bio / CV ya Mwalimu:</b> <span>${item.teacher_bio || '—'}</span></div>
      <div class="review-row"><b>Darasa & Somo:</b> <span>${item.class_name || item.class} — ${item.subject} (${item.term} ${item.year})</span></div>
      <hr>
      <div class="review-row"><b>Matokeo ya Wanafunzi:</b><br><span>${rowDetail}</span></div>
    `;
  }
  if (detailCard) detailCard.classList.remove('hidden');
}

async function approve(id) {
  if (supabase) {
    await supabase.from('results').update({ status: 'Approved' }).eq('id', id);
  }
  submissions = submissions.map(x => x.id == id ? { ...x, status: 'Approved' } : x);
  history = history.map(x => x.id == id ? { ...x, status: 'Approved' } : x);
  renderAdmin();
  renderHistory();
}

async function loadFromSupabase() {
  if (!supabase) return;
  const { data, error } = await supabase.from('results').select('*').order('id', { ascending: false });
  if (error) { console.error(error); return; }
  if (data) {
    submissions = data;
    history = data;
  }
}

async function init() {
  await loadFromSupabase();
  showPage('landing');
}

init();