'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loadingEl     = document.getElementById('loading');
const errorEl       = document.getElementById('error-state');
const errorMsg      = document.getElementById('error-msg');
const errorAction   = document.getElementById('error-action');
const jobFormEl     = document.getElementById('job-form');
const audFormEl     = document.getElementById('audition-form');
const actionsEl     = document.getElementById('actions');
const statusEl      = document.getElementById('submit-status');
const submitBtn     = document.getElementById('submit-btn');
const cancelBtn     = document.getElementById('cancel-btn');
const settingsBtn   = document.getElementById('settings-btn');
const tabBar        = document.getElementById('tab-bar');
const tabJobBtn     = document.getElementById('tab-job');
const tabAudBtn     = document.getElementById('tab-aud');
const headerIcon    = document.getElementById('header-icon');
const headerTitle   = document.getElementById('header-title');

// ── State ─────────────────────────────────────────────────────────────────────
let currentTab = 'job'; // 'job' | 'aud'
let pageData   = { company: '', role: '', link: '' };

const jobFields = {
  company:    document.getElementById('company'),
  role:       document.getElementById('role'),
  link:       document.getElementById('link'),
  applied_at: document.getElementById('applied_at'),
  status:     document.getElementById('status'),
  notes:      document.getElementById('notes'),
};

const audFields = {
  project_title:       document.getElementById('aud-project-title'),
  role:                document.getElementById('aud-role'),
  project_type:        document.getElementById('aud-project-type'),
  status:              document.getElementById('aud-status'),
  casting_studio:      document.getElementById('aud-casting-studio'),
  location:            document.getElementById('aud-location'),
  pay_rate:            document.getElementById('aud-pay-rate'),
  submitted_at:        document.getElementById('aud-submitted-at'),
  submission_deadline: document.getElementById('aud-deadline'),
  shoot_date:          document.getElementById('aud-shoot-date'),
  link:                document.getElementById('aud-link'),
  notes:               document.getElementById('aud-notes'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

function showError(msg, actionLabel, actionFn) {
  hide(loadingEl);
  hide(jobFormEl);
  hide(audFormEl);
  hide(actionsEl);
  hide(tabBar);
  errorMsg.textContent = msg;
  errorAction.textContent = actionLabel;
  errorAction.onclick = (e) => { e.preventDefault(); actionFn(); };
  show(errorEl);
}

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = kind || '';
}

// ── Tab switching ──────────────────────────────────────────────────────────────

function switchTab(tab) {
  currentTab = tab;
  setStatus('', '');

  if (tab === 'job') {
    tabJobBtn.className = 'tab-btn active-job';
    tabAudBtn.className = 'tab-btn';
    headerIcon.textContent = '💼';
    headerTitle.textContent = 'Add to Job Tracker';
    submitBtn.className = 'primary-job';
    submitBtn.textContent = 'Add Job';
    show(jobFormEl);
    hide(audFormEl);
  } else {
    tabJobBtn.className = 'tab-btn';
    tabAudBtn.className = 'tab-btn active-aud';
    headerIcon.textContent = '🎭';
    headerTitle.textContent = 'Add to Audition Tracker';
    submitBtn.className = 'primary-aud';
    submitBtn.textContent = 'Add Audition';
    hide(jobFormEl);
    show(audFormEl);
  }
}

tabJobBtn.addEventListener('click', () => switchTab('job'));
tabAudBtn.addEventListener('click', () => switchTab('aud'));

// ── Settings ──────────────────────────────────────────────────────────────────

settingsBtn.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
  window.close();
});

cancelBtn.addEventListener('click', () => window.close());

// ── Populate forms with extracted page data ───────────────────────────────────

function populateForms(data) {
  // Job form
  jobFields.company.value    = data.company || '';
  jobFields.role.value       = data.role    || '';
  jobFields.link.value       = data.link    || '';
  jobFields.applied_at.value = today();
  jobFields.status.value     = 'Applied';
  jobFields.notes.value      = '';

  // Audition form — map extracted fields onto audition concepts:
  //   company → casting_studio, role → project_title, link → link
  audFields.project_title.value  = data.role    || '';
  audFields.role.value           = '';
  audFields.casting_studio.value = data.company || '';
  audFields.link.value           = data.link    || '';
  audFields.submitted_at.value   = today();
  audFields.status.value         = 'Interested';
  audFields.project_type.value   = 'TV';
  audFields.location.value       = '';
  audFields.pay_rate.value       = '';
  audFields.submission_deadline.value = '';
  audFields.shoot_date.value     = '';
  audFields.notes.value          = '';
}

// ── Init: extract page data from current tab ──────────────────────────────────

async function init() {
  const { port = 47293, token = '' } = await browser.storage.local.get(['port', 'token']);

  if (!token) {
    showError(
      'No token configured. Open settings to paste your token from the Job Tracker widget.',
      'Open settings',
      () => { browser.runtime.openOptionsPage(); window.close(); }
    );
    return;
  }

  // Extract page data
  let extracted = { company: '', role: '', link: '' };
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      extracted = await browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' });
    }
  } catch {
    extracted = { company: '', role: '', link: '' };
  }

  pageData = extracted;
  populateForms(pageData);

  hide(loadingEl);
  show(tabBar);
  switchTab('job'); // shows job form + actions
  show(actionsEl);

  // Focus first important empty field
  if (!jobFields.company.value) jobFields.company.focus();
  else if (!jobFields.role.value) jobFields.role.focus();

  // Background connection check
  pingServer(port).then((ok) => {
    if (!ok) setStatus('⚠ Central Command not reachable — is it running?', 'err');
  });
}

async function pingServer(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ping`);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

submitBtn.addEventListener('click', async () => {
  const { port = 47293, token = '' } = await browser.storage.local.get(['port', 'token']);

  if (currentTab === 'job') {
    await submitJob(port, token);
  } else {
    await submitAudition(port, token);
  }
});

async function submitJob(port, token) {
  const company    = jobFields.company.value.trim();
  const role       = jobFields.role.value.trim();
  const link       = jobFields.link.value.trim();
  const applied_at = jobFields.applied_at.value || today();
  const status     = jobFields.status.value;
  const notes      = jobFields.notes.value.trim();

  if (!company && !role) {
    setStatus('Please fill in at least Company or Role.', 'err');
    jobFields.company.focus();
    return;
  }

  submitBtn.disabled = true;
  setStatus('Sending…', '');

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/add-job`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ company, role, link, applied_at, status, notes, source: 'Browser Extension' }),
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok && body.ok) {
      setStatus('✓ Job added!', 'ok');
      setTimeout(() => window.close(), 1200);
    } else if (res.status === 401) {
      setStatus('Wrong token — check settings.', 'err');
      submitBtn.disabled = false;
    } else {
      setStatus(`Error ${res.status}: ${body.error || 'Unknown error'}`, 'err');
      submitBtn.disabled = false;
    }
  } catch {
    setStatus('Cannot reach Central Command. Is it running?', 'err');
    submitBtn.disabled = false;
  }
}

async function submitAudition(port, token) {
  const project_title       = audFields.project_title.value.trim();
  const role                = audFields.role.value.trim();
  const project_type        = audFields.project_type.value;
  const status              = audFields.status.value;
  const casting_studio      = audFields.casting_studio.value.trim();
  const location            = audFields.location.value.trim();
  const pay_rate            = audFields.pay_rate.value.trim();
  const submitted_at        = audFields.submitted_at.value || today();
  const submission_deadline = audFields.submission_deadline.value;
  const shoot_date          = audFields.shoot_date.value;
  const link                = audFields.link.value.trim();
  const notes               = audFields.notes.value.trim();

  if (!project_title) {
    setStatus('Project Title is required.', 'err');
    audFields.project_title.focus();
    return;
  }

  submitBtn.disabled = true;
  setStatus('Sending…', '');

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/add-audition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        project_title, role, project_type, status, casting_studio, location,
        pay_rate, submitted_at, submission_deadline, shoot_date, link, notes,
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok && body.ok) {
      setStatus('✓ Audition added!', 'ok');
      setTimeout(() => window.close(), 1200);
    } else if (res.status === 401) {
      setStatus('Wrong token — check settings.', 'err');
      submitBtn.disabled = false;
    } else {
      setStatus(`Error ${res.status}: ${body.error || 'Unknown error'}`, 'err');
      submitBtn.disabled = false;
    }
  } catch {
    setStatus('Cannot reach Central Command. Is it running?', 'err');
    submitBtn.disabled = false;
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
