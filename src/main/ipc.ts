import { spawn } from 'child_process';
import { ipcMain, shell, dialog, net } from 'electron';
import { IPC } from '@shared/ipc';
import type { AppState, DialogOpenPathOptions, GoogleConnectOptions, NetFetchInit } from '@shared/types';
import { isGoogleServiceId } from '@shared/google';
import type { GoogleServiceId } from '@shared/google';
import type { Storage } from './storage';
import type { SecretsStore } from './secrets';
import type { OAuthManager } from './oauth';
import type { JobCaptureServer } from './job-capture-server';

const isString = (x: unknown): x is string => typeof x === 'string';
const isParams = (x: unknown): x is unknown[] => Array.isArray(x);

/** Assert that an optional `service` argument is a valid Google service id. */
function requireOptionalService(channel: string, service: unknown): void {
  if (service !== undefined && !isGoogleServiceId(service))
    throw new Error(`${channel}: invalid service`);
}

export function registerIpc(storage: Storage, secrets: SecretsStore, oauth: OAuthManager, captureServer: JobCaptureServer): void {
  ipcMain.handle(IPC.STATE_LOAD, () => storage.loadState());
  ipcMain.handle(IPC.STATE_SAVE, (_e, state: AppState) => storage.saveState(state));

  // ─── KV handlers ─────────────────────────────────────────────────────────────
  function kvHandler(channel: string, fn: (widgetId: string, key: string, value?: unknown) => unknown) {
    ipcMain.handle(channel, (_e, widgetId: unknown, key: unknown, value?: unknown) => {
      if (!isString(widgetId) || !isString(key)) throw new Error(`${channel}: invalid arguments`);
      return fn(widgetId, key, value);
    });
  }
  kvHandler(IPC.KV_GET,  (w, k) => storage.json.get(w, k));
  kvHandler(IPC.KV_SET,  (w, k, v) => storage.json.set(w, k, v));
  kvHandler(IPC.KV_DEL,  (w, k) => storage.json.del(w, k));
  ipcMain.handle(IPC.KV_KEYS, (_e, widgetId: unknown) => {
    if (!isString(widgetId)) throw new Error('kv.keys: invalid arguments');
    return storage.json.keys(widgetId);
  });

  // ─── SQL handlers ─────────────────────────────────────────────────────────────
  function sqlQueryHandler(channel: string, method: 'run' | 'all' | 'get') {
    ipcMain.handle(channel, (_e, widgetId: unknown, sql: unknown, params: unknown) => {
      if (!isString(widgetId) || !isString(sql) || !isParams(params))
        throw new Error(`${channel}: invalid arguments`);
      return storage.sqlite[method](widgetId, sql, params);
    });
  }
  sqlQueryHandler(IPC.SQL_RUN, 'run');
  sqlQueryHandler(IPC.SQL_ALL, 'all');
  sqlQueryHandler(IPC.SQL_GET, 'get');
  ipcMain.handle(IPC.SQL_EXEC, (_e, widgetId: unknown, sql: unknown) => {
    if (!isString(widgetId) || !isString(sql)) throw new Error('sql.exec: invalid arguments');
    return storage.sqlite.exec(widgetId, sql);
  });
  ipcMain.handle(IPC.SQL_RUN_BATCH, (_e, widgetId: unknown, items: unknown) => {
    if (!isString(widgetId) || !Array.isArray(items)) throw new Error('sql.runBatch: invalid arguments');
    return storage.sqlite.runBatch(widgetId, items as { sql: string; params?: unknown[] }[]);
  });

  const isWsl = !!(process.env['WSL_DISTRO_NAME'] ?? process.env['WSL_INTEROP']);

  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_e, url: unknown) => {
    if (!isString(url) || !/^(https?|mailto):/.test(url)) throw new Error('openExternal: url must be http(s) or mailto');
    if (isWsl) {
      const psUrl = (url as string).replace(/'/g, "''");
      return new Promise<void>((resolve) => {
        spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Start-Process '${psUrl}'`], { stdio: 'ignore' }).on('close', () => resolve());
      });
    }
    return shell.openExternal(url);
  });

  ipcMain.handle(IPC.SHELL_OPEN_PATH, (_e, path: unknown) => {
    if (!isString(path)) throw new Error('openPath: invalid argument');
    return shell.openPath(path);
  });

  ipcMain.handle(IPC.SHELL_SHOW_IN_FOLDER, (_e, path: unknown) => {
    if (!isString(path)) throw new Error('showItemInFolder: invalid argument');
    shell.showItemInFolder(path);
  });

  ipcMain.handle(IPC.DIALOG_OPEN_PATH, async (_e, options: unknown) => {
    const opts = options && typeof options === 'object' ? (options as DialogOpenPathOptions) : {};
    const result = await dialog.showOpenDialog({
      title: opts.title,
      defaultPath: opts.defaultPath,
      properties: opts.properties,
    });
    return result.canceled ? null : result.filePaths;
  });

  ipcMain.handle(IPC.NET_FETCH, async (_e, url: unknown, init: unknown) => {
    if (!isString(url) || !/^https?:\/\//.test(url)) throw new Error('net.fetch: url must be http(s)');
    const options: NetFetchInit = {};
    if (init && typeof init === 'object') {
      const i = init as Record<string, unknown>;
      if (typeof i.method === 'string') options.method = i.method;
      if (i.headers && typeof i.headers === 'object') options.headers = i.headers as Record<string, string>;
      if (typeof i.body === 'string') options.body = i.body;
    }
    const resp = await net.fetch(url, options);
    const body = await resp.text();
    return { ok: resp.ok, status: resp.status, body };
  });

  // ─── Secrets handlers ─────────────────────────────────────────────────────

  function secretsHandler(channel: string, fn: (widgetId: string, key: string) => unknown) {
    ipcMain.handle(channel, (_e, widgetId: unknown, key: unknown) => {
      if (!isString(widgetId) || !isString(key)) throw new Error(`${channel}: invalid arguments`);
      return fn(widgetId, key);
    });
  }
  secretsHandler(IPC.SECRETS_GET, (w, k) => secrets.get(w, k));
  secretsHandler(IPC.SECRETS_DEL, (w, k) => secrets.del(w, k));
  secretsHandler(IPC.SECRETS_HAS, (w, k) => secrets.has(w, k));

  ipcMain.handle(IPC.SECRETS_SET, (_e, widgetId: unknown, key: unknown, value: unknown) => {
    if (!isString(widgetId) || !isString(key) || !isString(value))
      throw new Error('secrets.set: invalid arguments');
    return secrets.set(widgetId, key, value);
  });

  // ─── Google OAuth handlers ─────────────────────────────────────────────────

  ipcMain.handle(IPC.GOOGLE_CONNECT, (_e, widgetId: unknown, options: unknown) => {
    if (!isString(widgetId) || !options || typeof options !== 'object')
      throw new Error('google.connect: invalid arguments');
    const o = options as Record<string, unknown>;
    if (!isString(o.clientId) || !isString(o.clientSecret))
      throw new Error('google.connect: invalid options');
    if (o.scopes !== undefined && !Array.isArray(o.scopes)) throw new Error('google.connect: invalid scopes');
    requireOptionalService('google.connect', o.service);
    return oauth.connect(widgetId, options as GoogleConnectOptions);
  });

  function googleServiceHandler(
    channel: string,
    fn: (widgetId: string, service?: GoogleServiceId) => unknown
  ) {
    ipcMain.handle(channel, (_e, widgetId: unknown, service?: unknown) => {
      if (!isString(widgetId)) throw new Error(`${channel}: invalid arguments`);
      requireOptionalService(channel, service);
      return fn(widgetId, service as GoogleServiceId | undefined);
    });
  }
  googleServiceHandler(IPC.GOOGLE_GET_TOKEN,    (w, s) => oauth.getToken(w, s));
  googleServiceHandler(IPC.GOOGLE_DISCONNECT,   (w, s) => oauth.disconnect(w, s));
  googleServiceHandler(IPC.GOOGLE_IS_CONNECTED, (w, s) => oauth.isConnected(w, s));

  // ─── Job Capture handlers ──────────────────────────────────────────────────
  ipcMain.handle(IPC.JOB_CAPTURE_STATUS, () => ({
    running: captureServer.isRunning,
    port:    captureServer.currentPort,
    token:   captureServer.currentToken,
  }));

  ipcMain.handle(IPC.JOB_CAPTURE_REGEN_TOKEN, () => captureServer.regenerateToken());
}
