import { useState } from "react";
import type { DriveSyncStatus } from "@shared/types";
import { SHARED_GOOGLE_WIDGET_ID } from "@shared/google";

function formatSyncTime(ts: number | null): string {
  if (!ts) return "Never";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return new Date(ts).toLocaleTimeString();
}

const STATE_LABELS: Record<string, string> = {
  uploading: "Uploading…",
  downloading: "Downloading…",
  idle: "Connected",
  error: "Error",
};

function statusDotClass(state: DriveSyncStatus["state"] | undefined): string {
  if (state === "error") return "status-dot error";
  if (state === "idle") return "status-dot ok";
  return "status-dot busy";
}

function isSyncBusy(status: DriveSyncStatus | null): boolean {
  return status?.state === "uploading" || status?.state === "downloading";
}

function ConnectedStatus({
  status,
  onDisconnect,
}: {
  status: DriveSyncStatus | null;
  onDisconnect: () => void;
}) {
  const busy = isSyncBusy(status);
  return (
    <div className="drive-sync-status">
      <div className="status-row">
        <span className={statusDotClass(status?.state)} />
        <span>{status?.state ? STATE_LABELS[status.state] : null}</span>
        <span className="muted">
          Last synced: {formatSyncTime(status?.lastSyncedAt ?? null)}
        </span>
      </div>
      {status?.lastError && <p className="error-text">{status.lastError}</p>}
      <div className="button-row">
        <button
          className="ghost"
          onClick={() => void window.cc.driveSync.forcePush()}
          disabled={busy}
        >
          Push to Drive
        </button>
        <button
          className="ghost"
          onClick={() => void window.cc.driveSync.forcePull()}
          disabled={busy}
        >
          Pull from Drive
        </button>
        <button className="ghost danger" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </div>
  );
}

interface Props {
  googleConnected: boolean | null;
  status: DriveSyncStatus | null;
  onStatusChange: (status: DriveSyncStatus) => void;
  /** Credentials from GoogleAccountSection, reused for Drive OAuth. */
  clientId: string;
  clientSecret: string;
}

export function DriveSyncSection({
  googleConnected,
  status,
  onStatusChange,
  clientId,
  clientSecret,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const driveConnected = status?.state !== "disabled" && status?.enabled;

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      await window.cc.google.connect(SHARED_GOOGLE_WIDGET_ID, {
        clientId,
        clientSecret,
        service: "drive-sync",
      });
      await window.cc.driveSync.enable();
    } catch (err) {
      setConnectError((err as Error).message ?? "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    await window.cc.driveSync.disable();
    await window.cc.google.disconnect(SHARED_GOOGLE_WIDGET_ID, "drive-sync");
    onStatusChange(
      status
        ? { ...status, enabled: false, state: "disabled" }
        : {
            enabled: false,
            state: "disabled",
            lastSyncedAt: null,
            lastError: null,
            stateChangedByRemote: false,
          },
    );
  }

  return (
    <section>
      <h3>Google Drive Sync</h3>
      <p className="help-text">
        Sync your dashboard layout and widget data across machines using Google
        Drive. Requires a Google Cloud project with the Drive API enabled and
        the <code>drive.appdata</code> scope on the OAuth consent screen.
      </p>

      {googleConnected === null ? (
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>Checking…</div>
      ) : !googleConnected ? (
        <div
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            padding: 12,
            backgroundColor: "var(--surface-secondary)",
            borderRadius: 4,
          }}
        >
          <strong>Connect Google Account first</strong>
          <p>Enable Google Account above to set up Drive Sync.</p>
        </div>
      ) : !driveConnected ? (
        <div className="settings-form">
          {connectError && <p className="error-text">{connectError}</p>}
          <button
            className="primary"
            onClick={() => void handleConnect()}
            disabled={connecting}
          >
            {connecting ? "Connecting…" : "Enable Drive Sync"}
          </button>
        </div>
      ) : (
        <ConnectedStatus
          status={status}
          onDisconnect={() => void handleDisconnect()}
        />
      )}
    </section>
  );
}
