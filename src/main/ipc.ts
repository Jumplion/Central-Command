import { ipcMain } from 'electron';
import { IPC } from '@shared/ipc';
import type { AppState } from '@shared/types';
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
}
