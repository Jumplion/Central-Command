export const SHARED_GOOGLE_WIDGET_ID = 'google';

export const GOOGLE_SERVICES = {
  gmail: {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email and inbox data via the Gmail API.',
    apiBaseUrl: 'https://gmail.googleapis.com/gmail/v1/',
    defaultScopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },
  calendar: {
    id: 'calendar',
    name: 'Google Calendar',
    description: 'Calendars and events via the Google Calendar API.',
    apiBaseUrl: 'https://www.googleapis.com/calendar/v3/',
    defaultScopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  },
  drive: {
    id: 'drive',
    name: 'Google Drive',
    description: 'Files and metadata via the Google Drive API.',
    apiBaseUrl: 'https://www.googleapis.com/drive/v3/',
    defaultScopes: ['https://www.googleapis.com/auth/drive.readonly'],
  },
  contacts: {
    id: 'contacts',
    name: 'Google Contacts',
    description: 'Contacts via the Google People API.',
    apiBaseUrl: 'https://people.googleapis.com/v1/',
    defaultScopes: ['https://www.googleapis.com/auth/contacts.readonly'],
  },
  notes: {
    id: 'notes',
    name: 'Google Notes',
    description: 'Notes data via Google Keep APIs when available.',
    apiBaseUrl: 'https://keep.googleapis.com/v1/',
    defaultScopes: ['https://www.googleapis.com/auth/keep.readonly'],
  },
  'drive-sync': {
    id: 'drive-sync',
    name: 'Drive Sync',
    description: 'Private app-data folder for cross-machine state sync.',
    apiBaseUrl: 'https://www.googleapis.com/drive/v3/',
    defaultScopes: ['https://www.googleapis.com/auth/drive.appdata'],
  },
} as const;

export type GoogleServiceId = keyof typeof GOOGLE_SERVICES;

export type GoogleServiceDefinition = (typeof GOOGLE_SERVICES)[GoogleServiceId];

export interface GoogleConnectOptions {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  service?: GoogleServiceId;
}

const DEFAULT_CONNECTION_ID = 'default';
const OAUTH_CREDS_KEY_PREFIX = 'google_oauth_creds';
const OAUTH_TOKEN_KEY_PREFIX = 'google_oauth_token';

export function isGoogleServiceId(value: unknown): value is GoogleServiceId {
  return typeof value === 'string' && value in GOOGLE_SERVICES;
}

export interface StoredGoogleCreds {
  clientId: string;
  clientSecret: string;
}

export function resolveGoogleScopes(options: GoogleConnectOptions): string[] {
  const scopes = options.scopes?.filter((scope) => typeof scope === 'string' && scope.trim().length > 0) ?? [];
  if (scopes.length > 0) return Array.from(new Set(scopes));
  if (options.service) return [...GOOGLE_SERVICES[options.service].defaultScopes];
  throw new Error('Google connection requires scopes or a known service');
}

export function getGoogleConnectionId(service?: GoogleServiceId): string {
  return service ?? DEFAULT_CONNECTION_ID;
}

export function getGoogleCredsKey(service?: GoogleServiceId): string {
  return `${OAUTH_CREDS_KEY_PREFIX}:${getGoogleConnectionId(service)}`;
}

export function getGoogleTokenKey(service?: GoogleServiceId): string {
  return `${OAUTH_TOKEN_KEY_PREFIX}:${getGoogleConnectionId(service)}`;
}

export function parseStoredGoogleCreds(raw: string | null): StoredGoogleCreds | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredGoogleCreds;
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (typeof parsed.clientId !== 'string' || typeof parsed.clientSecret !== 'string') return null;
    return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
  } catch {
    return null;
  }
}

export function getGoogleReconnectOptions(raw: string | null, service?: GoogleServiceId): GoogleConnectOptions | null {
  const creds = parseStoredGoogleCreds(raw);
  if (!creds) return null;
  return { clientId: creds.clientId, clientSecret: creds.clientSecret, service };
}
