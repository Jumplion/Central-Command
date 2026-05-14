import { useEffect, useState } from 'react';
import type { DriveSyncStatus } from '@shared/types';
import { SHARED_GOOGLE_WIDGET_ID } from '@shared/google';

interface Props {
  onClose: () => void;
}

function formatSyncTime(ts: number | null): string {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export function AppSettings({ onClose }: Props) {
  const [status, setStatus] = useState<DriveSyncStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    void window.cc.driveSync.getStatus().then(setStatus);
    return window.cc.driveSync.onStatusChanged(setStatus);
  }, []);

  async function handleConnect() {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      await window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        service: 'drive-sync',
      });
      await window.cc.driveSync.enable();
      setClientId('');
      setClientSecret('');
    } catch (err) {
      setConnectError((err as Error).message ?? 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await window.cc.driveSync.disable();
    await window.cc.google.disconnect(SHARED_GOOGLE_WIDGET_ID, 'drive-sync');
    setStatus((s) => s && { ...s, enabled: false, state: 'disabled' });
  }

  const connected = status?.state !== 'disabled' && status?.enabled;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>App Settings</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          <section>
            <h3>Google Drive Sync</h3>
            <p className="help-text">
              Sync your dashboard layout and widget data across machines using Google Drive.
              Requires a Google Cloud project with the Drive API enabled and the{' '}
              <code>drive.appdata</code> scope on the OAuth consent screen.
            </p>

            {!connected ? (
              <div className="settings-form">
                <label>
                  Client ID
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="your-client-id.apps.googleusercontent.com"
                    disabled={connecting}
                  />
                </label>
                <label>
                  Client Secret
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="Client secret"
                    disabled={connecting}
                  />
                </label>
                {connectError && <p className="error-text">{connectError}</p>}
                <button
                  className="primary"
                  onClick={() => void handleConnect()}
                  disabled={connecting || !clientId.trim() || !clientSecret.trim()}
                >
                  {connecting ? 'Connecting…' : 'Connect to Google Drive'}
                </button>
              </div>
            ) : (
              <div className="drive-sync-status">
                <div className="status-row">
                  <span
                    className={`status-dot ${status?.state === 'error' ? 'error' : status?.state === 'idle' ? 'ok' : 'busy'}`}
                  />
                  <span>
                    {status?.state === 'uploading' && 'Uploading…'}
                    {status?.state === 'downloading' && 'Downloading…'}
                    {status?.state === 'idle' && 'Connected'}
                    {status?.state === 'error' && 'Error'}
                  </span>
                  <span className="muted">
                    Last synced: {formatSyncTime(status?.lastSyncedAt ?? null)}
                  </span>
                </div>
                {status?.lastError && (
                  <p className="error-text">{status.lastError}</p>
                )}
                <div className="button-row">
                  <button
                    className="ghost"
                    onClick={() => void window.cc.driveSync.forcePush()}
                    disabled={status?.state === 'uploading' || status?.state === 'downloading'}
                  >
                    Push to Drive
                  </button>
                  <button
                    className="ghost"
                    onClick={() => void window.cc.driveSync.forcePull()}
                    disabled={status?.state === 'uploading' || status?.state === 'downloading'}
                  >
                    Pull from Drive
                  </button>
                  <button className="ghost danger" onClick={() => void handleDisconnect()}>
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
