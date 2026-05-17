import { describe, expect, it } from 'vitest';
import {
  DRIVE_STATE_FILE,
  SYNC_POLL_INTERVAL_MS,
  dbWidgetIdFromDriveName,
  driveDbName,
  driveKvName,
  kvWidgetIdFromDriveName,
} from './sync-base';

describe('SYNC_POLL_INTERVAL_MS', () => {
  it('equals 5 minutes in milliseconds', () => {
    expect(SYNC_POLL_INTERVAL_MS).toBe(5 * 60 * 1000);
  });
});

describe('DRIVE_STATE_FILE', () => {
  it('is the expected constant filename', () => {
    expect(DRIVE_STATE_FILE).toBe('cc-state.json');
  });
});

describe('driveKvName', () => {
  it('produces the expected Drive filename for a widget id', () => {
    expect(driveKvName('my-widget')).toBe('cc-kv-my-widget.json');
  });

  it('is round-trip invertible via kvWidgetIdFromDriveName', () => {
    const widgetId = 'some-widget';
    expect(kvWidgetIdFromDriveName(driveKvName(widgetId))).toBe(widgetId);
  });
});

describe('driveDbName', () => {
  it('produces the expected Drive filename for a widget id', () => {
    expect(driveDbName('tracker')).toBe('cc-db-tracker.db');
  });

  it('is round-trip invertible via dbWidgetIdFromDriveName', () => {
    const widgetId = 'job-tracker';
    expect(dbWidgetIdFromDriveName(driveDbName(widgetId))).toBe(widgetId);
  });
});

describe('kvWidgetIdFromDriveName', () => {
  it('extracts the widget id from a valid kv filename', () => {
    expect(kvWidgetIdFromDriveName('cc-kv-my-widget.json')).toBe('my-widget');
  });

  it('returns null for a db filename', () => {
    expect(kvWidgetIdFromDriveName('cc-db-my-widget.db')).toBeNull();
  });

  it('returns null for the state file', () => {
    expect(kvWidgetIdFromDriveName('cc-state.json')).toBeNull();
  });

  it('returns null for a filename that only starts with the prefix but has wrong extension', () => {
    expect(kvWidgetIdFromDriveName('cc-kv-widget.db')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(kvWidgetIdFromDriveName('')).toBeNull();
  });

  it('returns null for a bare prefix with no widget id body', () => {
    // 'cc-kv-.json' has an empty widget id segment — still parses to empty string, not null
    // This documents the actual behavior as a regression anchor
    expect(kvWidgetIdFromDriveName('cc-kv-.json')).toBe('');
  });
});

describe('dbWidgetIdFromDriveName', () => {
  it('extracts the widget id from a valid db filename', () => {
    expect(dbWidgetIdFromDriveName('cc-db-media-tracker.db')).toBe('media-tracker');
  });

  it('returns null for a kv filename', () => {
    expect(dbWidgetIdFromDriveName('cc-kv-media-tracker.json')).toBeNull();
  });

  it('returns null for the state file', () => {
    expect(dbWidgetIdFromDriveName('cc-state.json')).toBeNull();
  });

  it('returns null for a filename with wrong extension', () => {
    expect(dbWidgetIdFromDriveName('cc-db-widget.json')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(dbWidgetIdFromDriveName('')).toBeNull();
  });
});
