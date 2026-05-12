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
  notes: {
    id: 'notes',
    name: 'Google Notes',
    description: 'Experimental Google Keep/Notes preset for accounts where Google exposes Keep API access.',
    apiBaseUrl: 'https://keep.googleapis.com/v1/',
    defaultScopes: ['https://www.googleapis.com/auth/keep.readonly'],
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
