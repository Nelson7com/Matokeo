// Supabase Configuration
var SUPABASE_URL = 'https://nnytkdjooerftqowcxvu.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_OtNLdiJlOW40cDdLvLO3QA_CKBVmcws';

// Tumia supabaseClient ili kuepuka migongano ya majina (SyntaxError)
const supabaseClient = (window.supabase && typeof window.supabase.createClient === 'function') 
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) 
  : null;

// App State
let currentUser = null;
let currentRole = null; // 'teacher' au 'admin'
let selectedClass = '';
let currentSubject = '';
let currentTerm = '';
let currentYear = '';
let currentStream = '';
let studentsData = [];
let submissions = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSubmissions();
  setupEventListeners();
});

function setupEventListeners() {
  const themeBtn = document.getElementById('themeBtn');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }
}

function toggleTheme() {
  document.body.classList.toggle('dark');
}

// Navigation Function
function showPage(pageId) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.add('hidden'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove('hidden');
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    if (pageId === 'landing' || pageId === 'teacherLogin' || pageId === 'adminLogin') {
      logoutBtn.classList.add('hidden');
    } else {
      logoutBtn.classList.remove('hidden');
    }
  }
}

// Preview Profile Image
function preview(input, previewId) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const container = document.getElementById(previewId);
      if (container) {
        container.innerHTML = `<img src="${e.target.result}" alt="Profile Preview">`;
      }
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Teacher Authentication
function createTeacherAccount() {
  const name = document.getElementById('teacherCreateName').value.trim();
  const email = document.getElementById('teacherCreateEmail').value.trim();
  const password = document.getElementById('teacherCreatePassword').value;

  if (!name || !password) {
    alert('Tafadhali jaza jina na password!');
    return;
  }

  currentUser = { name, email, role: 'Teacher' };
  currentRole = 'teacher';
  alert('Akaunti imeundwa kikamilifu!');
  showPage('classes');
}

function teacherEnter() {
  const name = document.getElementById('teacherLoginName').value.trim();
  const password = document.getElementById('teacherLoginPassword').value;

  if (!name || !password) {
    alert('Tafadhali jaza jina na password!');
    return;
  }

  currentUser = { name, role: 'Teacher' };
  currentRole = 'teacher';
  showPage('classes');
}

// Admin Authentication
function adminEnter() {
  const name = document.getElementById('adminName').value.trim();
  const password = document.getElementById('adminPassword').value;

  if (!name || !password) {
    alert('Tafadhali jaza jina na password ya admin!');
    return;
  }

  currentUser = { name, role: 'Admin' };
  currentRole = 'admin';
  loadAdminDashboard();
  showPage('admin');
}

// Class Selection & Information Entry
function selectClass(className) {
  selectedClass = className;
  document.getElementById('chosenClass').textContent = className;
  showPage('classInfo');
}

function goToResults() {
  currentSubject = document.getElementById('subject').value.trim();
  currentTerm = document.getElementById('term').value.trim();
  currentYear = document.getElementById('year').value.trim();
  currentStream = document.getElementById('stream').value.trim();

  if (!currentSubject || !currentTerm || !currentYear) {
    alert('Tafadhali jaza somo, term na mwaka!');
    return;
  }

  document.getElementById('resultClass').textContent = selectedClass;
  document.getElementById('resultMeta').textContent = `${currentSubject} | ${currentTerm} (${currentYear}) | Mkondo: ${currentStream || 'A'}`;

  if (studentsData.length === 0) {
    studentsData = [{ fullname: '', adm: '', marks: '' }];
  }

  renderStudentsTable();
  showPage('results');
}

// Student Marks Table Operations
function renderStudentsTable() {
  const tbody = document.getElementById('resultBody');
  if (!tbody) return;

  tbody.innerHTML = studentsData.map((st, index) => {
    const grade = calculateGrade(st.marks);
    return `
      <tr>
        <td>${index + 1}</td>
        <td><input type="text" value="${st.fullname}" onchange="updateStudent(${index}, 'fullname', this.value)" placeholder="Jina la mwanafunzi"></td>
        <td><input type="text" value="${st.adm}" onchange="updateStudent(${index}, 'adm', this.value)" placeholder="Adm No"></td>
        <td><input type="number" min="0" max="100" value="${st.marks}" onchange="updateStudent(${index}, 'marks', this.value)" placeholder="Marks"></td>
        <td><b>${grade}</b></td>
        <td><button class="danger" onclick="removeStudent(${index})">Odoa</button></td>
      </tr>
    `;
  }).join('');
}

function updateStudent(index, field, value) {
  studentsData[index][field] = value;
  renderStudentsTable();
}

function addStudent() {
  studentsData.push({ fullname: '', adm: '', marks: '' });
  renderStudentsTable();
}

function removeStudent(index) {
  studentsData.splice(index, 1);
  renderStudentsTable();
}

function calculateGrade(marks) {
  if (marks === '' || marks === null || marks === undefined) return '-';
  const score = Number(marks);
  if (isNaN(score)) return '-';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// Review and Submission
function reviewSubmission() {
  const validStudents = studentsData.filter(st => st.fullname.trim() !== '');
  if (validStudents.length === 0) {
    alert('Tafadhali ingiza angalau mwanafunzi mmoja kabla ya kusubmit!');
    return;
  }

  const reviewContent = document.getElementById('reviewContent');
  reviewContent.innerHTML = `
    <p><b>Darasa:</b> ${selectedClass}</p>
    <p><b>Somo:</b> ${currentSubject}</p>
    <p><b>Term / Mwaka:</b> ${currentTerm} (${currentYear})</p>
    <p><b>Mkondo:</b> ${currentStream || 'A'}</p>
    <p><b>Jumla ya Wanafunzi:</b> ${validStudents.length}</p>
  `;

  showPage('review');
}

async function submitResults() {
  const validStudents = studentsData.filter(st => st.fullname.trim() !== '').map(st => ({
    fullname: st.fullname,
    adm: st.adm,
    marks: st.marks,
    grade: calculateGrade(st.marks)
  }));

  const payload = {
    class_name: selectedClass,
    subject: currentSubject,
    term: currentTerm,
    year: currentYear,
    stream: currentStream || 'A',
    teacher_name: currentUser ? currentUser.name : 'Mwalimu',
    status: 'Pending Admin',
    created_at: new Date().toISOString(),
    rows: validStudents
  };

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('results').insert([payload]);
      if (error) console.error('Supabase Error:', error);
    } catch (e) {
      console.error(e);
    }
  }

  submissions.unshift(payload);
  studentsData = [];
  showPage('postSubmit');
}

// Load Submissions
async function loadSubmissions() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.from('results').select('*').order('id', { ascending: false });
      if (!error && data) {
        submissions = data;
      }
    } catch (e) {
      console.error(e);
    }
  }
}

// Admin Dashboard
function loadAdminDashboard() {
  const pendingCountEl = document.getElementById('pendingCount');
  const adminListEl = document.getElementById('adminList');

  const pending = submissions.filter(s => s.status === 'Pending Admin');
  if (pendingCountEl) pendingCountEl.textContent = pending.length;

  if (!adminListEl) return;

  if (submissions.length === 0) {
    adminListEl.innerHTML = '<p>Hakuna matokeo yaliyowasilishwa bado.</p>';
    return;
  }

  adminListEl.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Darasa</th>
            <th>Somo</th>
            <th>Term</th>
            <th>Mwaka</th>
            <th>Mkondo</th>
            <th>Wanafunzi</th>
            <th>Tarehe</th>
            <th>Hali</th>
            <th>Vitendo</th>
          </tr>
        </thead>
        <tbody>
          ${submissions.map((s, idx) => {
            const studentCount = Array.isArray(s.rows) ? s.rows.length : (s.row && s.row.students ? s.row.students.length : 0);
            return `
              <tr>
                <td>${s.id || idx + 1}</td>
                <td>${s.class_name || s.class || ''}</td>
                <td>${s.subject || ''}</td>
                <td>${s.term || ''}</td>
                <td>${s.year || ''}</td>
                <td>${s.stream || 'A'}</td>
                <td>${studentCount}</td>
                <td>${s.created_at ? new Date(s.created_at).toLocaleString('sw-TZ') : ''}</td>
                <td><span class="pill">${s.status || 'Pending'}</span></td>
                <td>
                  <button class="primary" onclick="viewResultDetails('${s.id || idx}')">Angalia</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// View Result Modal
function viewResultDetails(id) {
  let res = submissions.find((x, idx) => String(x.id) === String(id) || String(idx) === String(id));
  if (!res) {
    alert("Matokeo hayakupatikana!");
    return;
  }

  const modal = document.getElementById('viewResultModal');
  const title = document.getElementById('modalTitle');
  const subTitle = document.getElementById('modalSubTitle');
  const container = document.getElementById('modalStudentTableContainer');

  if (!modal || !container) return;

  title.textContent = `Matokeo: ${res.class_name || res.class || ''} — ${res.subject || ''}`;
  subTitle.textContent = `Mwalimu: ${res.teacher_name || res.teacher || 'N/A'} | Term: ${res.term || ''} (${res.year || ''}) | Mkondo: ${res.stream || 'A'}`;

  let studentList = [];
  if (Array.isArray(res.rows)) {
    studentList = res.rows;
  } else if (res.row && Array.isArray(res.row.students)) {
    studentList = res.row.students;
  } else if (typeof res.rows === 'string') {
    try { studentList = JSON.parse(res.rows); } catch (e) {}
  }

  if (studentList && studentList.length > 0) {
    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <thead>
          <tr style="background:#f4f6f8; text-align:left;">
            <th style="padding:10px; border-bottom:1px solid #ddd;">#</th>
            <th style="padding:10px; border-bottom:1px solid #ddd;">Jina la Mwanafunzi</th>
            <th style="padding:10px; border-bottom:1px solid #ddd;">Admission No</th>
            <th style="padding:10px; border-bottom:1px solid #ddd;">Alama (%)</th>
            <th style="padding:10px; border-bottom:1px solid #ddd;">Daraja</th>
          </tr>
        </thead>
        <tbody>
          ${studentList.map((st, i) => `
            <tr>
              <td style="padding:10px; border-bottom:1px solid #eee;">${i + 1}</td>
              <td style="padding:10px; border-bottom:1px solid #eee;"><b>${st.fullname || st.name || 'N/A'}</b></td>
              <td style="padding:10px; border-bottom:1px solid #eee;">${st.adm || st.admission_number || '-'}</td>
              <td style="padding:10px; border-bottom:1px solid #eee;">${st.marks !== undefined ? st.marks : '-'}</td>
              <td style="padding:10px; border-bottom:1px solid #eee;"><b>${st.grade || calculateGrade(st.marks)}</b></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    container.innerHTML = `<p style="padding:15px; color:#e74c3c;">Hakuna taarifa za wanafunzi zilizopatikana kwenye matokeo haya.</p>`;
  }

  modal.classList.remove('hidden');
}

function closeResultModal() {
  const modal = document.getElementById('viewResultModal');
  if (modal) modal.classList.add('hidden');
}