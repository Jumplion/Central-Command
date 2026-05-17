import { describe, expect, it } from 'vitest';
import {
  GOOGLE_SERVICES,
  getGoogleCredsKey,
  getGoogleTokenKey,
  resolveGoogleScopes,
  parseStoredGoogleCreds,
  getGoogleReconnectOptions,
} from './google';

describe('GOOGLE_SERVICES', () => {
  it('defines API base URLs for all built-in services', () => {
    expect(GOOGLE_SERVICES.gmail.apiBaseUrl).toBe('https://gmail.googleapis.com/gmail/v1/');
    expect(GOOGLE_SERVICES.calendar.apiBaseUrl).toBe('https://www.googleapis.com/calendar/v3/');
    expect(GOOGLE_SERVICES.drive.apiBaseUrl).toBe('https://www.googleapis.com/drive/v3/');
    expect(GOOGLE_SERVICES.contacts.apiBaseUrl).toBe('https://people.googleapis.com/v1/');
    expect(GOOGLE_SERVICES.notes.apiBaseUrl).toBe('https://keep.googleapis.com/v1/');
  });

  it('keeps every service definition structurally complete', () => {
    for (const [serviceId, definition] of Object.entries(GOOGLE_SERVICES)) {
      expect(definition.id).toBe(serviceId);
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.apiBaseUrl).toMatch(/^https:\/\/.+\/$/);
      expect(definition.defaultScopes.length).toBeGreaterThan(0);
      expect(definition.defaultScopes.every((scope) => scope.startsWith('https://'))).toBe(true);
    }
  });

  it('uses least-privilege default scopes for built-in services', () => {
    expect(GOOGLE_SERVICES.gmail.defaultScopes).toEqual(['https://www.googleapis.com/auth/gmail.readonly']);
    expect(GOOGLE_SERVICES.calendar.defaultScopes).toEqual(['https://www.googleapis.com/auth/calendar.readonly']);
    expect(GOOGLE_SERVICES.drive.defaultScopes).toEqual(['https://www.googleapis.com/auth/drive.readonly']);
    expect(GOOGLE_SERVICES.contacts.defaultScopes).toEqual(['https://www.googleapis.com/auth/contacts.readonly']);
    expect(GOOGLE_SERVICES.notes.defaultScopes).toEqual(['https://www.googleapis.com/auth/keep.readonly']);
  });
});

describe('resolveGoogleScopes', () => {
  it('uses explicit scopes when provided', () => {
    expect(
      resolveGoogleScopes({
        clientId: 'id',
        clientSecret: 'secret',
        service: 'calendar',
        scopes: ['scope:a', 'scope:a', 'scope:b'],
      }),
    ).toEqual(['scope:a', 'scope:b']);
  });

  it('falls back to built-in service scopes', () => {
    expect(
      resolveGoogleScopes({
        clientId: 'id',
        clientSecret: 'secret',
        service: 'contacts',
      }),
    ).toEqual(['https://www.googleapis.com/auth/contacts.readonly']);
  });

  it('rejects missing scopes for ad-hoc connections', () => {
    expect(() =>
      resolveGoogleScopes({
        clientId: 'id',
        clientSecret: 'secret',
      }),
    ).toThrow('Google connection requires scopes or a known service');
  });
});

describe('google secret keys', () => {
  it('separates stored credentials and tokens by service connection', () => {
    expect(getGoogleCredsKey('calendar')).toBe('google_oauth_creds:calendar');
    expect(getGoogleTokenKey('drive')).toBe('google_oauth_token:drive');
    expect(getGoogleTokenKey()).toBe('google_oauth_token:default');
  });
});

describe('stored Google creds helpers', () => {
  it('parses valid stored Google credentials', () => {
    expect(
      parseStoredGoogleCreds(JSON.stringify({ clientId: 'id', clientSecret: 'secret' })),
    ).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });

  it('returns null for invalid stored Google credentials', () => {
    expect(parseStoredGoogleCreds(null)).toBeNull();
    expect(parseStoredGoogleCreds('not-json')).toBeNull();
    expect(parseStoredGoogleCreds(JSON.stringify({ clientId: 'id' }))).toBeNull();
  });

  it('builds reconnect options from stored credentials', () => {
    expect(
      getGoogleReconnectOptions(JSON.stringify({ clientId: 'id', clientSecret: 'secret' }), 'gmail'),
    ).toEqual({ clientId: 'id', clientSecret: 'secret', service: 'gmail' });
    expect(getGoogleReconnectOptions(null, 'gmail')).toBeNull();
  });
});
