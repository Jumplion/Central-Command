import { useEffect, useState } from "react";
import { SHARED_GOOGLE_WIDGET_ID, GOOGLE_SERVICES } from "@shared/google";

interface Props {
  /** Whether the user is currently connected — null means still loading. */
  connected: boolean | null;
  onConnectedChange: (connected: boolean) => void;
  /** Credentials shared with DriveSyncSection so it can reuse them. */
  clientId: string;
  clientSecret: string;
  onClientIdChange: (id: string) => void;
  onClientSecretChange: (secret: string) => void;
}

export function GoogleAccountSection({
  connected,
  onConnectedChange,
  clientId,
  clientSecret,
  onClientIdChange,
  onClientSecretChange,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function handleConnect() {
    if (!clientId.trim() || !clientSecret.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      await window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        scopes: [
          ...GOOGLE_SERVICES.gmail.defaultScopes,
          ...GOOGLE_SERVICES.calendar.defaultScopes,
          ...GOOGLE_SERVICES.contacts.defaultScopes,
        ],
      });
      onConnectedChange(true);
    } catch (err) {
      setConnectError((err as Error).message ?? "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await window.cc.google.disconnect(SHARED_GOOGLE_WIDGET_ID);
    onConnectedChange(false);
  }

  return (
    <section>
      <h3>Google Account</h3>
      <p className="help-text">
        Connect your Google account once and all widgets (Gmail, Calendar,
        Contacts, etc.) will use it automatically. Requires a Google Cloud
        project with OAuth 2.0 credentials (Desktop app type) and the Gmail,
        Calendar, and People APIs enabled.
      </p>

      {connected === null ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Checking…</div>
      ) : !connected ? (
        <div className="settings-form">
          <label>
            Client ID
            <input
              type="text"
              value={clientId}
              onChange={(e) => onClientIdChange(e.target.value)}
              placeholder="your-client-id.apps.googleusercontent.com"
              disabled={connecting}
            />
          </label>
          <label>
            Client Secret
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => onClientSecretChange(e.target.value)}
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
            {connecting ? "Connecting…" : "Connect with Google"}
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
              onClick={() => void handleDisconnect()}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
