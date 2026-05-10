import { ipcMain, shell, dialog, net } from 'electron';
import { IPC } from '@shared/ipc';
import type { AppState, DialogOpenPathOptions, NetFetchInit } from '@shared/types';
import type { Storage } from './storage';

const isString = (x: unknown): x is string => typeof x === 'string';
const isParams = (x: unknown): x is unknown[] => Array.isArray(x);

export function registerIpc(storage: Storage): void {
  ipcMain.handle(IPC.STATE_LOAD, () => storage.loadState());
  ipcMain.handle(IPC.STATE_SAVE, (_e, state: AppState) => storage.saveState(state));

  ipcMain.handle(IPC.KV_GET, (_e, widgetId: unknown, key: unknown) => {
    if (!isString(widgetId) || !isString(key)) throw new Error('kv.get: invalid arguments');
    return storage.json.get(widgetId, key);
  });
  ipcMain.handle(IPC.KV_SET, (_e, widgetId: unknown, key: unknown, value: unknown) => {
    if (!isString(widgetId) || !isString(key)) throw new Error('kv.set: invalid arguments');
    return storage.json.set(widgetId, key, value);
  });
  ipcMain.handle(IPC.KV_DEL, (_e, widgetId: unknown, key: unknown) => {
    if (!isString(widgetId) || !isString(key)) throw new Error('kv.del: invalid arguments');
    return storage.json.del(widgetId, key);
  });
  ipcMain.handle(IPC.KV_KEYS, (_e, widgetId: unknown) => {
    if (!isString(widgetId)) throw new Error('kv.keys: invalid arguments');
    return storage.json.keys(widgetId);
  });

  ipcMain.handle(IPC.SQL_RUN, (_e, widgetId: unknown, sql: unknown, params: unknown) => {
    if (!isString(widgetId) || !isString(sql) || !isParams(params)) throw new Error('sql.run: invalid arguments');
    return storage.sqlite.run(widgetId, sql, params);
  });
  ipcMain.handle(IPC.SQL_ALL, (_e, widgetId: unknown, sql: unknown, params: unknown) => {
    if (!isString(widgetId) || !isString(sql) || !isParams(params)) throw new Error('sql.all: invalid arguments');
    return storage.sqlite.all(widgetId, sql, params);
  });
  ipcMain.handle(IPC.SQL_GET, (_e, widgetId: unknown, sql: unknown, params: unknown) => {
    if (!isString(widgetId) || !isString(sql) || !isParams(params)) throw new Error('sql.get: invalid arguments');
    return storage.sqlite.get(widgetId, sql, params);
  });
  ipcMain.handle(IPC.SQL_EXEC, (_e, widgetId: unknown, sql: unknown) => {
    if (!isString(widgetId) || !isString(sql)) throw new Error('sql.exec: invalid arguments');
    return storage.sqlite.exec(widgetId, sql);
  });

  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_e, url: unknown) => {
    if (!isString(url) || !/^(https?|mailto):/.test(url)) throw new Error('openExternal: url must be http(s) or mailto');
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
