import { spawn } from 'child_process';
import { ipcMain, shell, dialog, net } from 'electron';
import { IPC } from '@shared/ipc';
import type { AppState, DialogOpenPathOptions, NetFetchInit } from '@shared/types';
import type { Storage } from './storage';

const isString = (x: unknown): x is string => typeof x === 'string';
const isParams = (x: unknown): x is unknown[] => Array.isArray(x);

export function registerIpc(storage: Storage): void {
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
      return new Promise<void>((resolve) => {
        spawn('cmd.exe', ['/c', 'start', '', url], { stdio: 'ignore' }).on('close', () => resolve());
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
}
