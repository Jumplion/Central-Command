import { useState, useEffect, useCallback } from 'react';
import type { WidgetApi } from '@renderer/plugins/api';
import type { CapturedAudition } from '@shared/types';

interface ServerStatus {
  running: boolean;
  port: number;
  token: string;
}

interface ExtensionTabProps {
  api: WidgetApi;
  onAuditionAdded: () => void;
}

export function ExtensionTab({ api: _api, onAuditionAdded }: ExtensionTabProps) {
  const [status, setStatus]           = useState<ServerStatus | null>(null);
  const [copied, setCopied]           = useState(false);
  const [regen, setRegen]             = useState(false);
  const [lastAudition, setLastAudition] = useState<CapturedAudition | null>(null);
  const [flash, setFlash]             = useState(false);

  const refreshStatus = useCallback(async () => {
    const s = await window.cc.jobCapture.status() as ServerStatus;
    setStatus(s);
  }, []);

  useEffect(() => {
    void refreshStatus();

    const unsub = window.cc.jobCapture.onAuditionAdded((aud) => {
      setLastAudition(aud);
      setFlash(true);
      setTimeout(() => setFlash(false), 3000);
      onAuditionAdded();
    });

    return unsub;
  }, [refreshStatus, onAuditionAdded]);

  const handleCopy = async () => {
    if (!status?.token) return;
    await navigator.clipboard.writeText(status.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegen = async () => {
    setRegen(true);
    try {
      await window.cc.jobCapture.regenerateToken();
      await refreshStatus();
    } finally {
      setRegen(false);
    }
  };

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 54 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'monospace' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: '4px 0' }}>

      {/* Connection status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        padding: '8px 12px', borderRadius: 6,
        background: status?.running ? '#34d39918' : '#ff6e6e18',
        border: `1px solid ${status?.running ? '#34d39944' : '#ff6e6e44'}`,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: status?.running ? '#34d399' : '#ff6e6e',
        }} />
        <span style={{ fontSize: 12, color: status?.running ? '#34d399' : '#ff6e6e' }}>
          {status == null
            ? 'Checking…'
            : status.running
              ? `Listening on port ${status.port}`
              : 'Server not running — restart Central Command'}
        </span>
      </div>

      {/* Token */}
      <div style={{
        background: 'var(--surface, #1e2028)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '12px 14px', marginBottom: 14,
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Authorization Token
        </div>

        {status?.token ? (
          <>
            {row('Port', status.port)}
            {row('Token',
              <span style={{ wordBreak: 'break-all', fontSize: 11 }}>
                {status.token.slice(0, 8)}••••••••{status.token.slice(-4)}
              </span>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button
                style={{ fontSize: 11, padding: '4px 12px', flex: 1 }}
                onClick={handleCopy}
              >
                {copied ? '✓ Copied!' : 'Copy full token'}
              </button>
              <button
                style={{ fontSize: 11, padding: '4px 12px', flex: 1 }}
                onClick={handleRegen}
                disabled={regen}
                title="Generate a new token and invalidate the old one"
              >
                {regen ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading token…</span>
        )}
      </div>

      {/* Last captured audition */}
      {lastAudition && (
        <div style={{
          background: flash ? '#c084fc18' : 'var(--surface, #1e2028)',
          border: `1px solid ${flash ? '#c084fc44' : 'var(--border)'}`,
          borderRadius: 6, padding: '10px 14px', marginBottom: 14,
          transition: 'background 0.4s, border-color 0.4s',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Last added via extension
          </div>
          <div style={{ fontSize: 12, color: 'var(--text)' }}>
            <strong>{lastAudition.project_title}</strong>
            {lastAudition.role && <> — {lastAudition.role}</>}
          </div>
          {lastAudition.casting_studio && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
              {lastAudition.casting_studio}
              {lastAudition.project_type && <> · {lastAudition.project_type}</>}
            </div>
          )}
          {lastAudition.link && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3, wordBreak: 'break-all' }}>
              {lastAudition.link.slice(0, 80)}{lastAudition.link.length > 80 ? '…' : ''}
            </div>
          )}
        </div>
      )}

      {/* Setup guide */}
      <div style={{
        background: 'var(--surface, #1e2028)', border: '1px solid var(--border)',
        borderRadius: 6, padding: '12px 14px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Setup Guide
        </div>
        {[
          'Install the Job Capture extension in Firefox (load from extensions/job-capture/ as a temporary add-on via about:debugging).',
          'Click the extension icon → ⚙ Settings.',
          `Set the port to ${status?.port ?? 47293} and paste the full token copied above.`,
          'Save settings. Click "Test connection" to verify.',
          'Browse to a casting breakdown, click the extension icon, switch to the 🎭 Audition tab, fill in the fields, and hit Add Audition.',
        ].map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
            <span style={{
              minWidth: 20, height: 20, borderRadius: '50%',
              background: '#c084fc22', color: '#c084fc',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
