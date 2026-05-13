'use strict';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const loadingEl    = document.getElementById('loading');
const errorEl      = document.getElementById('error-state');
const errorMsg     = document.getElementById('error-msg');
const errorAction  = document.getElementById('error-action');
const formEl       = document.getElementById('job-form');
const actionsEl    = document.getElementById('actions');
const statusEl     = document.getElementById('submit-status');
const submitBtn    = document.getElementById('submit-btn');
const cancelBtn    = document.getElementById('cancel-btn');
const settingsBtn  = document.getElementById('settings-btn');

const fields = {
  company:    document.getElementById('company'),
  role:       document.getElementById('role'),
  link:       document.getElementById('link'),
  applied_at: document.getElementById('applied_at'),
  status:     document.getElementById('status'),
  notes:      document.getElementById('notes'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

function showError(msg, actionLabel, actionFn) {
  hide(loadingEl);
  hide(formEl);
  hide(actionsEl);
  errorMsg.textContent = msg;
  errorAction.textContent = actionLabel;
  errorAction.onclick = (e) => { e.preventDefault(); actionFn(); };
  show(errorEl);
}

function showForm(data) {
  hide(loadingEl);
  hide(errorEl);
  fields.company.value    = data.company    || '';
  fields.role.value       = data.role       || '';
  fields.link.value       = data.link       || '';
  fields.applied_at.value = today();
  fields.status.value     = 'Applied';
  fields.notes.value      = '';
  show(formEl);
  show(actionsEl);
  // Focus first empty important field
  if (!fields.company.value) fields.company.focus();
  else if (!fields.role.value) fields.role.focus();
}

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = kind || '';
}

// ── Settings ──────────────────────────────────────────────────────────────────

settingsBtn.addEventListener('click', () => {
  browser.runtime.openOptionsPage();
  window.close();
});

cancelBtn.addEventListener('click', () => window.close());

// ── Init: extract job data from current tab ───────────────────────────────────

async function init() {
  // 1. Get saved settings
  const { port = 47293, token = '' } = await browser.storage.local.get(['port', 'token']);

  if (!token) {
    showError(
      'No token configured. Open settings to paste your token from the Job Tracker widget.',
      'Open settings',
      () => { browser.runtime.openOptionsPage(); window.close(); }
    );
    return;
  }

  // 2. Extract job data from the current tab DOM
  let extracted = { company: '', role: '', link: '' };
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id != null) {
      extracted = await browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_JOB' });
    }
  } catch {
    // Content script may not be injected on special pages (about:, moz-extension:, etc.)
    // Fall through with empty extracted data — user can fill in manually
    extracted = { company: '', role: '', link: window.location?.href || '' };
  }

  showForm(extracted);

  // 3. Check connection to Electron in the background (non-blocking)
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
  const company    = fields.company.value.trim();
  const role       = fields.role.value.trim();
  const link       = fields.link.value.trim();
  const applied_at = fields.applied_at.value || today();
  const status     = fields.status.value;
  const notes      = fields.notes.value.trim();

  if (!company && !role) {
    setStatus('Please fill in at least Company or Role.', 'err');
    fields.company.focus();
    return;
  }

  submitBtn.disabled = true;
  setStatus('Sending…', '');

  const { port = 47293, token = '' } = await browser.storage.local.get(['port', 'token']);

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
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
