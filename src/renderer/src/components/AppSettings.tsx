import { useEffect, useState } from "react";
import type { DriveSyncStatus } from "@shared/types";
import { SHARED_GOOGLE_WIDGET_ID, GOOGLE_SERVICES } from "@shared/google";

interface Props {
  onClose: () => void;
}

function formatSyncTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

export function AppSettings({ onClose }: Props) {
  const [status, setStatus] = useState<DriveSyncStatus | null>(null);

  // Google Account (shared across all widgets)
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(
    null,
  );

  // Drive Sync
  const [driveClientId, setDriveClientId] = useState("");
  const [driveClientSecret, setDriveClientSecret] = useState("");
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveConnectError, setDriveConnectError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void window.cc.driveSync.getStatus().then(setStatus);
    return window.cc.driveSync.onStatusChanged(setStatus);
  }, []);

  useEffect(() => {
    void window.cc.google
      .isConnected(SHARED_GOOGLE_WIDGET_ID)
      .then(setGoogleConnected);
  }, []);

  async function handleGoogleConnect() {
    if (!googleClientId.trim() || !googleClientSecret.trim()) return;
    setGoogleConnecting(true);
    setGoogleConnectError(null);
    try {
      await window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, {
        clientId: googleClientId.trim(),
        clientSecret: googleClientSecret.trim(),
        scopes: [
          ...GOOGLE_SERVICES.gmail.defaultScopes,
          ...GOOGLE_SERVICES.calendar.defaultScopes,
          ...GOOGLE_SERVICES.contacts.defaultScopes,
        ],
      });
      setGoogleConnected(true);
      setGoogleClientId("");
      setGoogleClientSecret("");
    } catch (err) {
      setGoogleConnectError((err as Error).message ?? "Connection failed");
    } finally {
      setGoogleConnecting(false);
    }
  }

  async function handleGoogleDisconnect() {
    await window.cc.google.disconnect(SHARED_GOOGLE_WIDGET_ID);
    setGoogleConnected(false);
  }

  async function handleDriveConnect() {
    if (!driveClientId.trim() || !driveClientSecret.trim()) return;
    setDriveConnecting(true);
    setDriveConnectError(null);
    try {
      await window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, {
        clientId: driveClientId.trim(),
        clientSecret: driveClientSecret.trim(),
        service: "drive-sync",
      });
      await window.cc.driveSync.enable();
      setDriveClientId("");
      setDriveClientSecret("");
    } catch (err) {
      setDriveConnectError((err as Error).message ?? "Connection failed");
    } finally {
      setDriveConnecting(false);
    }
  }

  async function handleDriveDisconnect() {
    await window.cc.driveSync.disable();
    await window.cc.google.disconnect(SHARED_GOOGLE_WIDGET_ID, "drive-sync");
    setStatus((s) => s && { ...s, enabled: false, state: "disabled" });
  }

  const driveConnected = status?.state !== "disabled" && status?.enabled;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>App Settings</h2>
          <button className="ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <section>
            <h3>Google Account</h3>
            <p className="help-text">
              Connect your Google account once and all widgets (Gmail, Calendar,
              Contacts, etc.) will use it automatically. Requires a Google Cloud
              project with OAuth 2.0 credentials (Desktop app type) and the
              Gmail, Calendar, and People APIs enabled.
            </p>

            {googleConnected === null ? (
              <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Checking…
              </div>
            ) : !googleConnected ? (
              <div className="settings-form">
                <label>
                  Client ID
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    placeholder="your-client-id.apps.googleusercontent.com"
                    disabled={googleConnecting}
                  />
                </label>
                <label>
                  Client Secret
                  <input
                    type="password"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    placeholder="Client secret"
                    disabled={googleConnecting}
                  />
                </label>
                {googleConnectError && (
                  <p className="error-text">{googleConnectError}</p>
                )}
                <button
                  className="primary"
                  onClick={() => void handleGoogleConnect()}
                  disabled={
                    googleConnecting ||
                    !googleClientId.trim() ||
                    !googleClientSecret.trim()
                  }
                >
                  {googleConnecting ? "Connecting…" : "Connect with Google"}
                </button>
              </div>
            ) : (
              <div className="drive-sync-status">
                <div className="status-row">
                  <span className="status-dot ok" />
                  <span>Connected</span>
                </div>
                <div className="button-row">
                  <button
                    className="ghost danger"
                    onClick={() => void handleGoogleDisconnect()}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}
          </section>

          <section>
            <h3>Google Drive Sync</h3>
            <p className="help-text">
              Sync your dashboard layout and widget data across machines using
              Google Drive. Requires a Google Cloud project with the Drive API
              enabled and the <code>drive.appdata</code> scope on the OAuth
              consent screen.
            </p>

            {!driveConnected ? (
              <div className="settings-form">
                <label>
                  Client ID
                  <input
                    type="text"
                    value={driveClientId}
                    onChange={(e) => setDriveClientId(e.target.value)}
                    placeholder="your-client-id.apps.googleusercontent.com"
                    disabled={driveConnecting}
                  />
                </label>
                <label>
                  Client Secret
                  <input
                    type="password"
                    value={driveClientSecret}
                    onChange={(e) => setDriveClientSecret(e.target.value)}
                    placeholder="Client secret"
                    disabled={driveConnecting}
                  />
                </label>
                {driveConnectError && (
                  <p className="error-text">{driveConnectError}</p>
                )}
                <button
                  className="primary"
                  onClick={() => void handleDriveConnect()}
                  disabled={
                    driveConnecting ||
                    !driveClientId.trim() ||
                    !driveClientSecret.trim()
                  }
                >
                  {driveConnecting ? "Connecting…" : "Connect to Google Drive"}
                </button>
              </div>
            ) : (
              <div className="drive-sync-status">
                <div className="status-row">
                  <span
                    className={`status-dot ${status?.state === "error" ? "error" : status?.state === "idle" ? "ok" : "busy"}`}
                  />
                  <span>
                    {status?.state === "uploading" && "Uploading…"}
                    {status?.state === "downloading" && "Downloading…"}
                    {status?.state === "idle" && "Connected"}
                    {status?.state === "error" && "Error"}
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
                    disabled={
                      status?.state === "uploading" ||
                      status?.state === "downloading"
                    }
                  >
                    Push to Drive
                  </button>
                  <button
                    className="ghost"
                    onClick={() => void window.cc.driveSync.forcePull()}
                    disabled={
                      status?.state === "uploading" ||
                      status?.state === "downloading"
                    }
                  >
                    Pull from Drive
                  </button>
                  <button
                    className="ghost danger"
                    onClick={() => void handleDriveDisconnect()}
                  >
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
