import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { shell } from 'electron';
import type { SecretsStore } from './secrets';
import type { GoogleConnectOptions } from '@shared/types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const OAUTH_CREDS_KEY = 'google_oauth_creds';
const OAUTH_TOKEN_KEY = 'google_oauth_token';
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface StoredCreds {
  clientId: string;
  clientSecret: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class OAuthManager {
  private pending = new Set<string>();

  constructor(private secrets: SecretsStore) {}

  async connect(widgetId: string, options: GoogleConnectOptions): Promise<void> {
    const { clientId, clientSecret, scopes } = options;
    if (this.pending.has(widgetId)) {
      throw new Error('A Google OAuth flow is already in progress for this widget');
    }
    this.pending.add(widgetId);
    try {
      const codeVerifier = base64url(randomBytes(32));
      const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());

      const { port, waitForCode } = await this.startRedirectServer();
      const redirectUri = `http://127.0.0.1:${port}`;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes.join(' '),
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
      });

      await shell.openExternal(`${GOOGLE_AUTH_URL}?${params.toString()}`);

      const code = await waitForCode;

      const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: codeVerifier,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }).toString(),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Google token exchange failed (${res.status}): ${body}`);
      }

      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      const creds: StoredCreds = { clientId, clientSecret };
      const tokens: StoredTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };

      await this.secrets.set(widgetId, OAUTH_CREDS_KEY, JSON.stringify(creds));
      await this.secrets.set(widgetId, OAUTH_TOKEN_KEY, JSON.stringify(tokens));
    } finally {
      this.pending.delete(widgetId);
    }
  }

  async getToken(widgetId: string): Promise<string | null> {
    const tokenRaw = await this.secrets.get(widgetId, OAUTH_TOKEN_KEY);
    if (!tokenRaw) return null;

    let tokens: StoredTokens;
    try {
      tokens = JSON.parse(tokenRaw) as StoredTokens;
    } catch {
      await this.secrets.del(widgetId, OAUTH_TOKEN_KEY);
      return null;
    }

    if (Date.now() < tokens.expiresAt) {
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      await this.secrets.del(widgetId, OAUTH_TOKEN_KEY);
      return null;
    }

    const credsRaw = await this.secrets.get(widgetId, OAUTH_CREDS_KEY);
    if (!credsRaw) {
      await this.secrets.del(widgetId, OAUTH_TOKEN_KEY);
      return null;
    }

    let creds: StoredCreds;
    try {
      creds = JSON.parse(credsRaw) as StoredCreds;
    } catch {
      await this.secrets.del(widgetId, OAUTH_TOKEN_KEY);
      return null;
    }

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!res.ok) {
      await this.secrets.del(widgetId, OAUTH_TOKEN_KEY);
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    tokens.accessToken = data.access_token;
    tokens.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    if (data.refresh_token) tokens.refreshToken = data.refresh_token;

    await this.secrets.set(widgetId, OAUTH_TOKEN_KEY, JSON.stringify(tokens));
    return tokens.accessToken;
  }

  async disconnect(widgetId: string): Promise<void> {
    await this.secrets.del(widgetId, OAUTH_CREDS_KEY);
    await this.secrets.del(widgetId, OAUTH_TOKEN_KEY);
  }

  async isConnected(widgetId: string): Promise<boolean> {
    return this.secrets.has(widgetId, OAUTH_TOKEN_KEY);
  }

  private startRedirectServer(): Promise<{ port: number; waitForCode: Promise<string> }> {
    return new Promise((resolveSetup, rejectSetup) => {
      let resolveCode!: (code: string) => void;
      let rejectCode!: (err: Error) => void;

      const waitForCode = new Promise<string>((res, rej) => {
        resolveCode = res;
        rejectCode = rej;
      });

      const timer = setTimeout(() => {
        server.close();
        rejectCode(new Error('Google OAuth timed out waiting for browser authorization'));
      }, OAUTH_TIMEOUT_MS);

      const server = createServer((req, res) => {
        clearTimeout(timer);
        server.close();

        const url = new URL(req.url ?? '/', 'http://127.0.0.1');
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        const html = code
          ? '<html><body style="font-family:sans-serif;padding:40px"><h2>✓ Authorization successful</h2><p>You may close this tab and return to Central Command.</p></body></html>'
          : `<html><body style="font-family:sans-serif;padding:40px"><h2>✗ Authorization failed</h2><p>${escapeHtml(error ?? 'Unknown error')}. You may close this tab.</p></body></html>`;

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);

        if (code) {
          resolveCode(code);
        } else {
          rejectCode(new Error(`Google OAuth denied: ${error ?? 'unknown'}`));
        }
      });

      server.on('error', (err) => {
        clearTimeout(timer);
        rejectSetup(err);
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          clearTimeout(timer);
          server.close();
          rejectSetup(new Error('Could not determine loopback server port'));
          return;
        }
        resolveSetup({ port: addr.port, waitForCode });
      });
    });
  }
}
