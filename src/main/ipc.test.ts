import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IPC } from '@shared/ipc';
import { registerIpc } from './ipc';

// handlers map must exist before vi.mock factories run
const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) => handlers.set(channel, fn),
  },
  shell: {
    openExternal: vi.fn().mockResolvedValue(undefined),
    openPath: vi.fn().mockResolvedValue(''),
    showItemInFolder: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: ['/tmp/selected'] }),
  },
  net: {
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{}'),
    }),
  },
}));

vi.mock('./platform', () => ({ IS_WSL: false, openExternal: vi.fn().mockResolvedValue(undefined) }));

// ── Minimal mock dependencies ────────────────────────────────────────────────

const mockStorage = {
  json: {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
    keysWithPrefix: vi.fn().mockResolvedValue([]),
  },
  sqlite: {
    run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 }),
    all: vi.fn().mockReturnValue([]),
    get: vi.fn().mockReturnValue(undefined),
    exec: vi.fn(),
    runBatch: vi.fn().mockReturnValue([]),
  },
  loadState: vi.fn(),
  saveState: vi.fn(),
};

const mockSecrets = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  has: vi.fn().mockResolvedValue(false),
};

const mockOAuth = {
  connect: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockResolvedValue(null),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockResolvedValue(false),
};

const mockSyncManager = {
  getStatus: vi.fn().mockReturnValue({ state: 'disabled', enabled: false }),
  enable: vi.fn(),
  disable: vi.fn(),
  forcePush: vi.fn().mockResolvedValue(undefined),
  forcePull: vi.fn().mockResolvedValue(undefined),
};

// Register all handlers once
beforeAll(() => {
  registerIpc(
    mockStorage as never,
    mockSecrets as never,
    mockOAuth as never,
    mockSyncManager as never,
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  mockStorage.json.get.mockResolvedValue(undefined);
  mockStorage.json.keys.mockResolvedValue([]);
  mockStorage.sqlite.run.mockReturnValue({ changes: 0, lastInsertRowid: 0 });
  mockStorage.sqlite.all.mockReturnValue([]);
});

/** Calls a registered handler with a null event object. */
function call(channel: string, ...args: unknown[]) {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler registered for channel: ${channel}`);
  return fn(null, ...args);
}

// ── KV handlers ───────────────────────────────────────────────────────────────

describe('KV handlers', () => {
  it('throws when widgetId is not a string', () => {
    expect(() => call(IPC.KV_GET, 42, 'key')).toThrow('invalid arguments');
    expect(() => call(IPC.KV_SET, null, 'key', 1)).toThrow('invalid arguments');
    expect(() => call(IPC.KV_DEL, true, 'key')).toThrow('invalid arguments');
  });

  it('throws when key is not a string', () => {
    expect(() => call(IPC.KV_GET, 'w', null)).toThrow('invalid arguments');
    expect(() => call(IPC.KV_SET, 'w', 42, 'val')).toThrow('invalid arguments');
  });

  it('delegates kv.get to storage.json.get', async () => {
    mockStorage.json.get.mockResolvedValue('stored-value');
    expect(await call(IPC.KV_GET, 'w', 'k')).toBe('stored-value');
    expect(mockStorage.json.get).toHaveBeenCalledWith('w', 'k');
  });

  it('throws on kv.keys when widgetId is not a string', () => {
    expect(() => call(IPC.KV_KEYS, 123)).toThrow('invalid arguments');
  });

  it('throws on kv.keysWithPrefix when prefix is not a string', () => {
    expect(() => call(IPC.KV_KEYS_PREFIX, 'w', 99)).toThrow('invalid arguments');
  });
});

// ── SQL handlers ──────────────────────────────────────────────────────────────

describe('SQL handlers', () => {
  it('throws when widgetId is not a string', () => {
    expect(() => call(IPC.SQL_RUN, 42, 'SELECT 1', [])).toThrow('invalid arguments');
    expect(() => call(IPC.SQL_ALL, null, 'SELECT 1', [])).toThrow('invalid arguments');
    expect(() => call(IPC.SQL_GET, {}, 'SELECT 1', [])).toThrow('invalid arguments');
  });

  it('throws when sql is not a string', () => {
    expect(() => call(IPC.SQL_RUN, 'w', 42, [])).toThrow('invalid arguments');
  });

  it('throws when params is not an array', () => {
    expect(() => call(IPC.SQL_ALL, 'w', 'SELECT 1', 'not-an-array')).toThrow('invalid arguments');
    expect(() => call(IPC.SQL_GET, 'w', 'SELECT 1', {})).toThrow('invalid arguments');
  });

  it('throws on sql.exec when widgetId is not a string', () => {
    expect(() => call(IPC.SQL_EXEC, 42, 'SELECT 1')).toThrow('invalid arguments');
  });

  it('throws on sql.runBatch when items is not an array', () => {
    expect(() => call(IPC.SQL_RUN_BATCH, 'w', 'not-an-array')).toThrow('invalid arguments');
  });

  it('delegates sql.run to storage.sqlite.run', () => {
    mockStorage.sqlite.run.mockReturnValue({ changes: 1, lastInsertRowid: 5 });
    const result = call(IPC.SQL_RUN, 'w', 'INSERT INTO t VALUES (?)', [1]);
    expect(result).toEqual({ changes: 1, lastInsertRowid: 5 });
    expect(mockStorage.sqlite.run).toHaveBeenCalledWith('w', 'INSERT INTO t VALUES (?)', [1]);
  });
});

// ── Shell handlers ────────────────────────────────────────────────────────────

describe('SHELL_OPEN_EXTERNAL', () => {
  it('throws for ftp:// URLs', () => {
    expect(() => call(IPC.SHELL_OPEN_EXTERNAL, 'ftp://example.com')).toThrow('url must be http(s) or mailto');
  });

  it('throws for javascript: URLs', () => {
    expect(() => call(IPC.SHELL_OPEN_EXTERNAL, 'javascript:alert(1)')).toThrow();
  });

  it('throws when url is not a string', () => {
    expect(() => call(IPC.SHELL_OPEN_EXTERNAL, 123)).toThrow();
  });

  it('accepts https:// URLs without throwing', () => {
    expect(() => call(IPC.SHELL_OPEN_EXTERNAL, 'https://example.com')).not.toThrow();
  });

  it('accepts http:// URLs without throwing', () => {
    expect(() => call(IPC.SHELL_OPEN_EXTERNAL, 'http://example.com')).not.toThrow();
  });

  it('accepts mailto: URLs without throwing', () => {
    expect(() => call(IPC.SHELL_OPEN_EXTERNAL, 'mailto:user@example.com')).not.toThrow();
  });
});

describe('SHELL_OPEN_PATH', () => {
  it('throws when path is not a string', () => {
    expect(() => call(IPC.SHELL_OPEN_PATH, 42)).toThrow('invalid argument');
  });
});

describe('SHELL_SHOW_IN_FOLDER', () => {
  it('throws when path is not a string', () => {
    expect(() => call(IPC.SHELL_SHOW_IN_FOLDER, null)).toThrow('invalid argument');
  });
});

// ── Net fetch ─────────────────────────────────────────────────────────────────

describe('NET_FETCH', () => {
  it('rejects non-http(s) URLs', async () => {
    await expect(call(IPC.NET_FETCH, 'ftp://bad.com', {})).rejects.toThrow('url must be http(s)');
  });

  it('rejects non-string url', async () => {
    await expect(call(IPC.NET_FETCH, null, {})).rejects.toThrow('url must be http(s)');
  });

  it('rejects javascript: URLs', async () => {
    await expect(call(IPC.NET_FETCH, 'javascript:alert(1)', {})).rejects.toThrow('url must be http(s)');
  });
});

// ── Secrets handlers ──────────────────────────────────────────────────────────

describe('Secrets handlers', () => {
  it('throws when widgetId is not a string', () => {
    expect(() => call(IPC.SECRETS_GET, 42, 'key')).toThrow('invalid arguments');
    expect(() => call(IPC.SECRETS_DEL, null, 'key')).toThrow('invalid arguments');
    expect(() => call(IPC.SECRETS_HAS, {}, 'key')).toThrow('invalid arguments');
  });

  it('throws when key is not a string', () => {
    expect(() => call(IPC.SECRETS_GET, 'w', null)).toThrow('invalid arguments');
  });

  it('throws on secrets.set when value is not a string', () => {
    expect(() => call(IPC.SECRETS_SET, 'w', 'key', 123)).toThrow('invalid arguments');
    expect(() => call(IPC.SECRETS_SET, 'w', 'key', null)).toThrow('invalid arguments');
  });

  it('delegates secrets.get to secrets store', async () => {
    mockSecrets.get.mockResolvedValue('secret-value');
    expect(await call(IPC.SECRETS_GET, 'w', 'k')).toBe('secret-value');
    expect(mockSecrets.get).toHaveBeenCalledWith('w', 'k');
  });
});

// ── Google OAuth handlers ─────────────────────────────────────────────────────

describe('GOOGLE_CONNECT', () => {
  it('throws when widgetId is not a string', () => {
    expect(() => call(IPC.GOOGLE_CONNECT, 42, { clientId: 'id', clientSecret: 'sec' })).toThrow('invalid arguments');
  });

  it('throws when options is null or not an object', () => {
    expect(() => call(IPC.GOOGLE_CONNECT, 'w', null)).toThrow('invalid arguments');
    expect(() => call(IPC.GOOGLE_CONNECT, 'w', 'string')).toThrow('invalid arguments');
  });

  it('throws when clientId is missing', () => {
    expect(() => call(IPC.GOOGLE_CONNECT, 'w', { clientSecret: 'sec' })).toThrow('invalid options');
  });

  it('throws when clientSecret is missing', () => {
    expect(() => call(IPC.GOOGLE_CONNECT, 'w', { clientId: 'id' })).toThrow('invalid options');
  });

  it('throws when scopes is present but not an array', () => {
    expect(() =>
      call(IPC.GOOGLE_CONNECT, 'w', { clientId: 'id', clientSecret: 'sec', scopes: 'not-array' })
    ).toThrow('invalid scopes');
  });

  it('throws when service is not a known Google service id', () => {
    expect(() =>
      call(IPC.GOOGLE_CONNECT, 'w', { clientId: 'id', clientSecret: 'sec', service: 'unknown-service' })
    ).toThrow('invalid service');
  });

  it('accepts a valid known service id', () => {
    expect(() =>
      call(IPC.GOOGLE_CONNECT, 'w', { clientId: 'id', clientSecret: 'sec', service: 'gmail' })
    ).not.toThrow();
  });
});

describe('Google service handlers (getToken / disconnect / isConnected)', () => {
  it('throws when widgetId is not a string', () => {
    expect(() => call(IPC.GOOGLE_GET_TOKEN, 42)).toThrow('invalid arguments');
    expect(() => call(IPC.GOOGLE_DISCONNECT, null)).toThrow('invalid arguments');
    expect(() => call(IPC.GOOGLE_IS_CONNECTED, {})).toThrow('invalid arguments');
  });

  it('throws when service is present but not a known id', () => {
    expect(() => call(IPC.GOOGLE_GET_TOKEN, 'w', 'not-a-service')).toThrow('invalid service');
    expect(() => call(IPC.GOOGLE_DISCONNECT, 'w', 'bad-service')).toThrow('invalid service');
  });

  it('accepts an undefined service (default connection)', () => {
    expect(() => call(IPC.GOOGLE_GET_TOKEN, 'w', undefined)).not.toThrow();
    expect(() => call(IPC.GOOGLE_IS_CONNECTED, 'w', undefined)).not.toThrow();
  });

  it('accepts a known service id', () => {
    expect(() => call(IPC.GOOGLE_GET_TOKEN, 'w', 'calendar')).not.toThrow();
  });
});

// ── State handlers ────────────────────────────────────────────────────────────

describe('STATE_LOAD / STATE_SAVE', () => {
  it('delegates STATE_LOAD to storage.loadState', async () => {
    const fakeState = { version: 1, dashboards: [], activeDashboardId: 'x' };
    mockStorage.loadState.mockResolvedValue(fakeState);
    expect(await call(IPC.STATE_LOAD)).toEqual(fakeState);
    expect(mockStorage.loadState).toHaveBeenCalledOnce();
  });

  it('delegates STATE_SAVE to storage.saveState', async () => {
    const state = { version: 1, dashboards: [], activeDashboardId: 'x' };
    await call(IPC.STATE_SAVE, state);
    expect(mockStorage.saveState).toHaveBeenCalledWith(state);
  });
});

// ── KV delegation ─────────────────────────────────────────────────────────────

describe('KV delegation', () => {
  it('delegates kv.set to storage.json.set', async () => {
    await call(IPC.KV_SET, 'w', 'key', { nested: true });
    expect(mockStorage.json.set).toHaveBeenCalledWith('w', 'key', { nested: true });
  });

  it('delegates kv.del to storage.json.del', async () => {
    await call(IPC.KV_DEL, 'w', 'key');
    expect(mockStorage.json.del).toHaveBeenCalledWith('w', 'key');
  });

  it('delegates kv.keys to storage.json.keys', async () => {
    mockStorage.json.keys.mockResolvedValue(['a', 'b']);
    expect(await call(IPC.KV_KEYS, 'w')).toEqual(['a', 'b']);
    expect(mockStorage.json.keys).toHaveBeenCalledWith('w');
  });

  it('delegates kv.keysWithPrefix to storage.json.keysWithPrefix', async () => {
    mockStorage.json.keysWithPrefix.mockResolvedValue(['ns::a']);
    expect(await call(IPC.KV_KEYS_PREFIX, 'w', 'ns::')).toEqual(['ns::a']);
    expect(mockStorage.json.keysWithPrefix).toHaveBeenCalledWith('w', 'ns::');
  });
});

// ── SQL delegation ────────────────────────────────────────────────────────────

describe('SQL delegation', () => {
  it('delegates sql.all to storage.sqlite.all', () => {
    mockStorage.sqlite.all.mockReturnValue([{ id: 1 }]);
    const result = call(IPC.SQL_ALL, 'w', 'SELECT * FROM t', []);
    expect(result).toEqual([{ id: 1 }]);
    expect(mockStorage.sqlite.all).toHaveBeenCalledWith('w', 'SELECT * FROM t', []);
  });

  it('delegates sql.get to storage.sqlite.get', () => {
    mockStorage.sqlite.get.mockReturnValue({ id: 1 });
    const result = call(IPC.SQL_GET, 'w', 'SELECT * FROM t WHERE id = ?', [1]);
    expect(result).toEqual({ id: 1 });
    expect(mockStorage.sqlite.get).toHaveBeenCalledWith('w', 'SELECT * FROM t WHERE id = ?', [1]);
  });

  it('delegates sql.exec to storage.sqlite.exec', () => {
    call(IPC.SQL_EXEC, 'w', 'CREATE TABLE t (id INTEGER PRIMARY KEY)');
    expect(mockStorage.sqlite.exec).toHaveBeenCalledWith('w', 'CREATE TABLE t (id INTEGER PRIMARY KEY)');
  });

  it('delegates sql.runBatch to storage.sqlite.runBatch', () => {
    const batch = [{ sql: 'INSERT INTO t VALUES (?)', params: [1] }];
    mockStorage.sqlite.runBatch.mockReturnValue([{ changes: 1, lastInsertRowid: 1 }]);
    const result = call(IPC.SQL_RUN_BATCH, 'w', batch);
    expect(result).toEqual([{ changes: 1, lastInsertRowid: 1 }]);
    expect(mockStorage.sqlite.runBatch).toHaveBeenCalledWith('w', batch);
  });
});

// ── Secrets delegation ────────────────────────────────────────────────────────

describe('Secrets delegation', () => {
  it('delegates secrets.set to secrets store', async () => {
    await call(IPC.SECRETS_SET, 'w', 'api-key', 'my-secret');
    expect(mockSecrets.set).toHaveBeenCalledWith('w', 'api-key', 'my-secret');
  });

  it('delegates secrets.del to secrets store', async () => {
    await call(IPC.SECRETS_DEL, 'w', 'api-key');
    expect(mockSecrets.del).toHaveBeenCalledWith('w', 'api-key');
  });

  it('delegates secrets.has to secrets store', async () => {
    mockSecrets.has.mockResolvedValue(true);
    expect(await call(IPC.SECRETS_HAS, 'w', 'api-key')).toBe(true);
    expect(mockSecrets.has).toHaveBeenCalledWith('w', 'api-key');
  });
});

// ── Google delegation ─────────────────────────────────────────────────────────

describe('Google delegation', () => {
  it('delegates google.getToken to oauth.getToken', async () => {
    mockOAuth.getToken.mockResolvedValue({ access_token: 'tok' });
    const token = await call(IPC.GOOGLE_GET_TOKEN, 'w', 'calendar');
    expect(token).toEqual({ access_token: 'tok' });
    expect(mockOAuth.getToken).toHaveBeenCalledWith('w', 'calendar');
  });

  it('delegates google.isConnected to oauth.isConnected', async () => {
    mockOAuth.isConnected.mockResolvedValue(true);
    expect(await call(IPC.GOOGLE_IS_CONNECTED, 'w', undefined)).toBe(true);
    expect(mockOAuth.isConnected).toHaveBeenCalledWith('w', undefined);
  });

  it('delegates google.disconnect to oauth.disconnect', async () => {
    await call(IPC.GOOGLE_DISCONNECT, 'w', 'drive');
    expect(mockOAuth.disconnect).toHaveBeenCalledWith('w', 'drive');
  });
});

// ── Drive Sync handlers ───────────────────────────────────────────────────────

describe('Drive Sync handlers', () => {
  it('delegates DRIVE_SYNC_GET_STATUS to syncManager.getStatus', () => {
    const status = { state: 'idle', enabled: true, lastSyncedAt: null, lastError: null, stateChangedByRemote: false };
    mockSyncManager.getStatus.mockReturnValue(status);
    expect(call(IPC.DRIVE_SYNC_GET_STATUS)).toEqual(status);
    expect(mockSyncManager.getStatus).toHaveBeenCalledOnce();
  });

  it('delegates DRIVE_SYNC_ENABLE to syncManager.enable', () => {
    call(IPC.DRIVE_SYNC_ENABLE);
    expect(mockSyncManager.enable).toHaveBeenCalledOnce();
  });

  it('delegates DRIVE_SYNC_DISABLE to syncManager.disable', () => {
    call(IPC.DRIVE_SYNC_DISABLE);
    expect(mockSyncManager.disable).toHaveBeenCalledOnce();
  });

  it('delegates DRIVE_SYNC_FORCE_PUSH to syncManager.forcePush', () => {
    mockSyncManager.forcePush.mockResolvedValue(undefined);
    call(IPC.DRIVE_SYNC_FORCE_PUSH);
    expect(mockSyncManager.forcePush).toHaveBeenCalledOnce();
  });

  it('delegates DRIVE_SYNC_FORCE_PULL to syncManager.forcePull', () => {
    mockSyncManager.forcePull.mockResolvedValue(undefined);
    call(IPC.DRIVE_SYNC_FORCE_PULL);
    expect(mockSyncManager.forcePull).toHaveBeenCalledOnce();
  });
});

// ── NET_FETCH delegation ──────────────────────────────────────────────────────

describe('NET_FETCH delegation', () => {
  it('returns ok, status, and body on success', async () => {
    const { net } = await import('electron');
    vi.mocked(net.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('{"data":1}'),
    } as never);
    const result = await call(IPC.NET_FETCH, 'https://api.example.com/data', {});
    expect(result).toEqual({ ok: true, status: 200, body: '{"data":1}' });
  });

  it('forwards method, headers, and body from init', async () => {
    const { net } = await import('electron');
    await call(IPC.NET_FETCH, 'https://api.example.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"x":1}',
    });
    expect(net.fetch).toHaveBeenCalledWith(
      'https://api.example.com/',
      expect.objectContaining({ method: 'POST', body: '{"x":1}' }),
    );
  });
});

// ── DIALOG_OPEN_PATH ──────────────────────────────────────────────────────────

describe('DIALOG_OPEN_PATH', () => {
  it('returns selected file paths when not canceled', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/home/user/doc.txt'] });
    expect(await call(IPC.DIALOG_OPEN_PATH, {})).toEqual(['/home/user/doc.txt']);
  });

  it('returns null when the dialog is canceled', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
    expect(await call(IPC.DIALOG_OPEN_PATH, {})).toBeNull();
  });

  it('works with no options argument (uses empty defaults)', async () => {
    const { dialog } = await import('electron');
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/tmp/file'] });
    expect(await call(IPC.DIALOG_OPEN_PATH)).toEqual(['/tmp/file']);
  });
});

