import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import type { GoogleConnectOptions, GoogleServiceId } from '@shared/types';
import {
  GOOGLE_SERVICES,
  getGoogleCredsKey,
  getGoogleTokenKey,
  resolveGoogleScopes,
} from '@shared/google';
import { secretsApi } from './secrets';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const TOKEN_EXPIRY_BUFFER_SECONDS = 60;

// Key used to stash the PKCE verifier while the browser is open
const PENDING_VERIFIER_KEY = '__oauth_pending_verifier__';
const PENDING_CLIENT_KEY = '__oauth_pending_client__';

interface StoredCreds {
  clientId: string;
  clientSecret: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

async function sha256base64url(plain: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function randomBase64url(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function googleConnect(widgetId: string, options: GoogleConnectOptions): Promise<void> {
  const { clientId, clientSecret, service } = options;
  const scopes = resolveGoogleScopes(options);

  const codeVerifier = randomBase64url(32);
  const codeChallenge = await sha256base64url(codeVerifier);

  // Store verifier and client details temporarily so they survive the app backgrounding
  await secretsApi.set(widgetId, PENDING_VERIFIER_KEY, codeVerifier);
  await secretsApi.set(
    widgetId,
    PENDING_CLIENT_KEY,
    JSON.stringify({ clientId, clientSecret, service })
  );

  // Google's reverse-DNS redirect URI for installed/mobile apps
  const redirectUri = `com.googleusercontent.apps.${clientId.split('-')[0]}:/oauth2redirect`;

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

  return new Promise<void>((resolve, reject) => {
    let handled = false;

    const cleanup = App.addListener('appUrlOpen', async (event: { url: string }) => {
      if (handled) return;
      if (!event.url.includes('oauth2redirect')) return;

      handled = true;
      void cleanup.then((l) => l.remove());
      await Browser.close();

      try {
        const url = new URL(event.url);
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (!code) {
          await cleanupPending(widgetId);
          reject(new Error(`Google OAuth denied: ${error ?? 'unknown'}`));
          return;
        }

        const pendingClient = await secretsApi.get(widgetId, PENDING_CLIENT_KEY);
        const verifier = await secretsApi.get(widgetId, PENDING_VERIFIER_KEY);
        await cleanupPending(widgetId);

        if (!verifier || !pendingClient) {
          reject(new Error('OAuth state lost'));
          return;
        }

        const { clientId: cId, clientSecret: cSecret, service: svc } = JSON.parse(pendingClient) as {
          clientId: string;
          clientSecret: string;
          service?: GoogleServiceId;
        };

        const resolvedRedirect = `com.googleusercontent.apps.${cId.split('-')[0]}:/oauth2redirect`;

        const res = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: cId,
            client_secret: cSecret,
            code,
            code_verifier: verifier,
            grant_type: 'authorization_code',
            redirect_uri: resolvedRedirect,
          }).toString(),
        });

        if (!res.ok) {
          const body = await res.text();
          reject(new Error(`Google token exchange failed (${res.status}): ${body}`));
          return;
        }

        const data = (await res.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
        };

        const creds: StoredCreds = { clientId: cId, clientSecret: cSecret };
        const tokens: StoredTokens = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in - TOKEN_EXPIRY_BUFFER_SECONDS) * 1000,
        };

        await secretsApi.set(widgetId, getGoogleCredsKey(svc), JSON.stringify(creds));
        await secretsApi.set(widgetId, getGoogleTokenKey(svc), JSON.stringify(tokens));
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    Browser.open({ url: authUrl }).catch(reject);
  });
}

async function cleanupPending(widgetId: string): Promise<void> {
  await secretsApi.del(widgetId, PENDING_VERIFIER_KEY);
  await secretsApi.del(widgetId, PENDING_CLIENT_KEY);
}

export async function googleGetToken(
  widgetId: string,
  service?: GoogleServiceId
): Promise<string | null> {
  const tokenKey = getGoogleTokenKey(service);
  const credsKey = getGoogleCredsKey(service);

  const tokenRaw = await secretsApi.get(widgetId, tokenKey);
  if (!tokenRaw) return null;

  let tokens: StoredTokens;
  try {
    tokens = JSON.parse(tokenRaw) as StoredTokens;
  } catch {
    await secretsApi.del(widgetId, tokenKey);
    return null;
  }

  if (Date.now() < tokens.expiresAt) return tokens.accessToken;

  if (!tokens.refreshToken) {
    await secretsApi.del(widgetId, tokenKey);
    return null;
  }

  const credsRaw = await secretsApi.get(widgetId, credsKey);
  if (!credsRaw) {
    await secretsApi.del(widgetId, tokenKey);
    return null;
  }

  let creds: StoredCreds;
  try {
    creds = JSON.parse(credsRaw) as StoredCreds;
  } catch {
    await secretsApi.del(widgetId, tokenKey);
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
    await secretsApi.del(widgetId, tokenKey);
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

  await secretsApi.set(widgetId, tokenKey, JSON.stringify(tokens));
  return tokens.accessToken;
}

export async function googleDisconnect(widgetId: string, service?: GoogleServiceId): Promise<void> {
  await secretsApi.del(widgetId, getGoogleCredsKey(service));
  await secretsApi.del(widgetId, getGoogleTokenKey(service));
}

export async function googleIsConnected(
  widgetId: string,
  service?: GoogleServiceId
): Promise<boolean> {
  return secretsApi.has(widgetId, getGoogleTokenKey(service));
}

export const googleApi = {
  services: GOOGLE_SERVICES,
  connect: googleConnect,
  getToken: googleGetToken,
  disconnect: googleDisconnect,
  isConnected: googleIsConnected,
};
