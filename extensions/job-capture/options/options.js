'use strict';

const portInput   = document.getElementById('port');
const tokenInput  = document.getElementById('token');
const saveBtn     = document.getElementById('save-btn');
const testBtn     = document.getElementById('test-btn');
const saveStatus  = document.getElementById('save-status');
const statusBanner = document.getElementById('connection-status');
const statusText   = document.getElementById('status-text');

// ── Load saved settings ───────────────────────────────────────────────────────

browser.storage.local.get(['port', 'token']).then(({ port, token }) => {
  if (port)  portInput.value  = port;
  if (token) tokenInput.value = token;
  checkConnection();
});

// ── Save ─────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', async () => {
  const port  = parseInt(portInput.value, 10) || 47293;
  const token = tokenInput.value.trim();

  await browser.storage.local.set({ port, token });

  saveStatus.textContent = '✓ Saved';
  saveStatus.style.color = 'var(--green)';
  setTimeout(() => { saveStatus.textContent = ''; }, 2000);

  checkConnection();
});

// ── Test connection ───────────────────────────────────────────────────────────

testBtn.addEventListener('click', () => checkConnection(true));

async function checkConnection(showResult = false) {
  const { port = 47293 } = await browser.storage.local.get('port');

  setStatus('idle', 'Checking connection…');

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ping`, {
      method: 'GET',
      headers: { 'X-Job-Capture': '1' },
    });

    if (res.ok) {
      setStatus('ok', `Connected — Central Command is listening on port ${port}`);
      if (showResult) flashSave('✓ Connection successful');
    } else {
      setStatus('err', `Central Command responded with status ${res.status}`);
    }
  } catch {
    setStatus('err', `Cannot reach Central Command on port ${port} — is it running?`);
  }
}

function setStatus(kind, text) {
  statusBanner.className = `status-banner ${kind}`;
  statusText.textContent = text;
}

function flashSave(msg) {
  saveStatus.textContent = msg;
  saveStatus.style.color = 'var(--green)';
  setTimeout(() => { saveStatus.textContent = ''; }, 3000);
}
