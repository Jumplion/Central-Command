import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { shell } from 'electron';
import { IS_WSL } from './platform';
import type { SecretsStore } from './secrets';
import type { GoogleConnectOptions } from '@shared/types';
import { getGoogleCredsKey, getGoogleTokenKey, getGoogleConnectionId, resolveGoogleScopes } from '@shared/google';
import type { GoogleServiceId } from '@shared/google';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

const HTML_ESCAPE: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
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
  return buf.toString('base64url');
}

export class OAuthManager {
  private pending = new Set<string>();
  private tokenCache = new Map<string, { accessToken: string; expiresAt: number }>();

  constructor(private secrets: SecretsStore) {}

  async connect(widgetId: string, options: GoogleConnectOptions): Promise<void> {
    const { clientId, clientSecret, service } = options;
    const scopes = resolveGoogleScopes(options);
    const connectionId = `${widgetId}::${getGoogleConnectionId(service)}`;
    if (this.pending.has(connectionId)) {
      throw new Error('A Google OAuth flow is already in progress for this widget');
    }
    this.pending.add(connectionId);
    try {
      const codeVerifier = base64url(randomBytes(32));
      const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest());

      const { port, waitForCode } = await this.startRedirectServer();
      // In WSL the Windows browser can't reach 127.0.0.1 (WSL-only loopback);
      // use localhost so WSL2 localhost-forwarding delivers the callback.
      const redirectUri = `http://${IS_WSL ? 'localhost' : '127.0.0.1'}:${port}`;

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

      const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
      if (IS_WSL) {
        // shell.openExternal doesn't work in WSL. Pass the URL via an env var
        // to avoid PowerShell command injection.
        await new Promise<void>((resolve) => {
          spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Start-Process -FilePath $env:CC_OPEN_URL'], {
            stdio: 'ignore',
            env: { ...process.env, CC_OPEN_URL: authUrl },
          }).on('close', () => resolve());
        });
      } else {
        await shell.openExternal(authUrl);
      }

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
        expiresAt: Date.now() + (data.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000,
      };

      await this.secrets.set(widgetId, getGoogleCredsKey(service), JSON.stringify(creds));
      await this.secrets.set(widgetId, getGoogleTokenKey(service), JSON.stringify(tokens));
    } finally {
      this.pending.delete(connectionId);
    }
  }

  async getToken(widgetId: string, service?: GoogleServiceId): Promise<string | null> {
    const tokenKey = getGoogleTokenKey(service);
    const credsKey = getGoogleCredsKey(service);
    const cacheKey = `${widgetId}::${tokenKey}`;

    // Fast path: return from memory cache if still valid (avoids secrets I/O + decrypt)
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

    const tokenRaw = await this.secrets.get(widgetId, tokenKey);
    if (!tokenRaw) return null;

    let tokens: StoredTokens;
    try {
      tokens = JSON.parse(tokenRaw) as StoredTokens;
    } catch {
      await this.secrets.del(widgetId, tokenKey);
      return null;
    }

    if (Date.now() < tokens.expiresAt) {
      this.tokenCache.set(cacheKey, tokens);
      return tokens.accessToken;
    }

    if (!tokens.refreshToken) {
      await this.secrets.del(widgetId, tokenKey);
      return null;
    }

    const credsRaw = await this.secrets.get(widgetId, credsKey);
    if (!credsRaw) {
      await this.secrets.del(widgetId, tokenKey);
      return null;
    }

    let creds: StoredCreds;
    try {
      creds = JSON.parse(credsRaw) as StoredCreds;
    } catch {
      await this.secrets.del(widgetId, tokenKey);
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
      await this.secrets.del(widgetId, tokenKey);
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    tokens.accessToken = data.access_token;
    tokens.expiresAt = Date.now() + (data.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000;
    if (data.refresh_token) tokens.refreshToken = data.refresh_token;

    await this.secrets.set(widgetId, tokenKey, JSON.stringify(tokens));
    this.tokenCache.set(cacheKey, { accessToken: tokens.accessToken, expiresAt: tokens.expiresAt });
    return tokens.accessToken;
  }

  async disconnect(widgetId: string, service?: GoogleServiceId): Promise<void> {
    this.tokenCache.delete(`${widgetId}::${getGoogleTokenKey(service)}`);
    await this.secrets.del(widgetId, getGoogleCredsKey(service));
    await this.secrets.del(widgetId, getGoogleTokenKey(service));
  }

  async isConnected(widgetId: string, service?: GoogleServiceId): Promise<boolean> {
    return this.secrets.has(widgetId, getGoogleTokenKey(service));
  }

  private startRedirectServer(): Promise<{ port: number; waitForCode: Promise<string> }> {
    return new Promise((resolveSetup, rejectSetup) => {
      let resolveCode: (code: string) => void = () => { /* assigned below */ };
      let rejectCode: (err: Error) => void = () => { /* assigned below */ };

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

      // Bind to 127.0.0.1 in all environments. WSL2's localhost-forwarding
      // delivers the browser callback to 127.0.0.1 inside WSL automatically.
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
