import { useState, useEffect, useCallback } from 'react';
import type { Widget, WidgetProps } from '@renderer/plugins/registry';

// ─── Types ─────────────────────────────────────────────────────────────────

interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

interface RawHeader {
  name: string;
  value: string;
}

interface RawMessage {
  id: string;
  threadId: string;
  snippet: string;
  payload?: {
    headers?: RawHeader[];
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getHeader(headers: RawHeader[], name: string): string {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function formatFrom(from: string): string {
  const match = /^"?([^"<]+)"?\s*</.exec(from);
  return match ? match[1].trim() : from;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SetupGuide() {
  return (
    <div style={{ padding: '12px 4px', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6 }}>
      <p style={{ marginBottom: 8, color: 'var(--text)', fontWeight: 500 }}>Setup required</p>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        <li>Create a project in <a href="https://console.cloud.google.com/" style={{ color: 'var(--accent)' }}>Google Cloud Console</a></li>
        <li>Enable the <strong>Gmail API</strong></li>
        <li>Create OAuth 2.0 credentials for a <strong>Desktop app</strong></li>
        <li>Add your email as a test user under the OAuth consent screen</li>
        <li>Paste the Client ID and Client Secret in this widget&apos;s settings</li>
      </ol>
    </div>
  );
}

function MessageRow({
  msg,
  onOpen,
}: {
  msg: GmailMessage;
  onOpen: (threadId: string) => void;
}) {
  return (
    <div
      style={{
        padding: '8px 4px',
        borderBottom: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: '120px 1fr auto',
        gap: '0 10px',
        alignItems: 'start',
        cursor: 'default',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-dim)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={msg.from}
      >
        {formatFrom(msg.from)}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={msg.subject}
        >
          {msg.subject}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-dim)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={msg.snippet}
        >
          {msg.snippet}
        </div>
      </div>
      <button
        className="ghost"
        style={{ fontSize: 11, padding: '1px 6px', flexShrink: 0 }}
        onClick={() => onOpen(msg.threadId)}
        title="Open in Gmail"
      >
        ↗
      </button>
    </div>
  );
}

// ─── Main widget ───────────────────────────────────────────────────────────

function GmailWidget({ api, settings, setTitle }: WidgetProps) {
  const clientId = (settings.googleClientId as string) ?? '';
  const clientSecret = (settings.googleClientSecret as string) ?? '';
  const maxMessages = Math.max(1, Math.min(50, (settings.maxMessages as number) || 10));

  const [connected, setConnected] = useState<boolean | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await api.google.getToken();
      if (!token) {
        setConnected(false);
        return;
      }

      const listRes = await api.net.fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxMessages}&labelIds=INBOX&fields=messages(id,threadId)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!listRes.ok) {
        if (listRes.status === 401) {
          setConnected(false);
          setError('Session expired — please reconnect.');
        } else {
          throw new Error(`Gmail API error: ${listRes.status}`);
        }
        return;
      }

      const listData = JSON.parse(listRes.body) as {
        messages?: { id: string; threadId: string }[];
      };

      if (!listData.messages?.length) {
        setMessages([]);
        setTitle?.('Gmail (0)');
        return;
      }

      const results = await Promise.allSettled(
        listData.messages.map(({ id, threadId }) =>
          api.net
            .fetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
                `?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date` +
                `&fields=id,threadId,snippet,payload(headers)`,
              { headers: { Authorization: `Bearer ${token}` } }
            )
            .then((r) => ({ r, threadId }))
        )
      );

      const msgs: GmailMessage[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.r.ok) {
          const raw = JSON.parse(result.value.r.body) as RawMessage;
          const headers = raw.payload?.headers ?? [];
          msgs.push({
            id: raw.id,
            threadId: result.value.threadId,
            subject: getHeader(headers, 'Subject') || '(no subject)',
            from: getHeader(headers, 'From'),
            date: getHeader(headers, 'Date'),
            snippet: raw.snippet ?? '',
          });
        }
      }

      setMessages(msgs);
      setTitle?.(`Gmail (${msgs.length})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, maxMessages, setTitle]);

  useEffect(() => {
    if (!clientId || !clientSecret) {
      setConnected(false);
      return;
    }
    api.google
      .isConnected()
      .then((c) => {
        setConnected(c);
      })
      .catch(() => setConnected(false));
  }, [api, clientId, clientSecret]);

  useEffect(() => {
    if (connected) void loadMessages();
  }, [connected, loadMessages]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await api.google.connect({
        clientId,
        clientSecret,
        scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      });
      setConnected(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await api.google.disconnect();
    setConnected(false);
    setMessages([]);
    setTitle?.(undefined);
  };

  const openInGmail = (threadId: string) => {
    void api.shell.openExternal(`https://mail.google.com/mail/u/0/#inbox/${threadId}`);
  };

  // ── Not configured ──────────────────────────────────────────────────────
  if (!clientId || !clientSecret) {
    return <SetupGuide />;
  }

  // ── Loading connection status ───────────────────────────────────────────
  if (connected === null) {
    return (
      <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 12 }}>Loading…</div>
    );
  }

  // ── Not connected ───────────────────────────────────────────────────────
  if (!connected) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>📬</div>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', textAlign: 'center', margin: 0 }}>
          Connect your Google account to see Gmail messages.
        </p>
        <button
          className="primary"
          style={{ fontSize: 13, padding: '6px 16px' }}
          onClick={() => void handleConnect()}
          disabled={connecting}
        >
          {connecting ? 'Waiting for browser…' : 'Connect with Google'}
        </button>
        {error && (
          <p style={{ fontSize: 11, color: '#ff6e6e', textAlign: 'center', margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          flexShrink: 0,
          paddingBottom: 4,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          className="ghost"
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => void loadMessages()}
          disabled={loading}
          title="Refresh messages"
        >
          {loading ? '…' : '↻ Refresh'}
        </button>
        <button
          className="ghost danger"
          style={{ fontSize: 11, padding: '2px 8px', marginLeft: 'auto' }}
          onClick={() => void handleDisconnect()}
          title="Disconnect Google account"
        >
          Disconnect
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 11, color: '#ff6e6e', flexShrink: 0 }}>{error}</div>
      )}

      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {messages.length === 0 && !loading ? (
          <div
            style={{
              padding: '24px 0',
              textAlign: 'center',
              color: 'var(--text-dim)',
              fontSize: 12,
            }}
          >
            No messages found.
          </div>
        ) : (
          messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} onOpen={openInGmail} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Widget export ─────────────────────────────────────────────────────────

const widget: Widget = {
  manifest: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Show recent inbox messages via the Gmail API. Requires a Google Cloud OAuth app.',
    version: '0.1.0',
    icon: '📬',
    defaultSize: { w: 6, h: 7 },
    minSize: { w: 4, h: 4 },
    permissions: { google: true },
    settings: [
      {
        kind: 'string',
        key: 'googleClientId',
        label: 'Google Client ID',
        placeholder: 'Paste your OAuth 2.0 Client ID',
      },
      {
        kind: 'string',
        key: 'googleClientSecret',
        label: 'Google Client Secret',
        placeholder: 'Paste your OAuth 2.0 Client Secret',
      },
      {
        kind: 'number',
        key: 'maxMessages',
        label: 'Messages to show',
        default: 10,
        min: 1,
        max: 50,
        step: 1,
      },
    ],
  },
  Component: GmailWidget,
};

export default widget;
