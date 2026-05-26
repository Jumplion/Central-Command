import { useEffect, useState } from "react";
import type { DriveSyncStatus } from "@shared/types";
import { SHARED_GOOGLE_WIDGET_ID } from "@shared/google";
import { GoogleAccountSection } from "./GoogleAccountSection";
import { DriveSyncSection } from "./DriveSyncSection";

interface Props {
  onClose: () => void;
}

export function AppSettings({ onClose }: Props) {
  const [status, setStatus] = useState<DriveSyncStatus | null>(null);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");

  useEffect(() => {
    void window.cc.driveSync.getStatus().then(setStatus);
    return window.cc.driveSync.onStatusChanged(setStatus);
  }, []);

  useEffect(() => {
    void window.cc.google
      .isConnected(SHARED_GOOGLE_WIDGET_ID)
      .then(setGoogleConnected);
  }, []);

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
          <GoogleAccountSection
            connected={googleConnected}
            onConnectedChange={setGoogleConnected}
            clientId={googleClientId}
            clientSecret={googleClientSecret}
            onClientIdChange={setGoogleClientId}
            onClientSecretChange={setGoogleClientSecret}
          />
          <DriveSyncSection
            googleConnected={googleConnected}
            status={status}
            onStatusChange={setStatus}
            clientId={googleClientId}
            clientSecret={googleClientSecret}
          />
        </div>
      </div>
    </div>
  );
}
