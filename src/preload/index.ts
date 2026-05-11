import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type { AppState, CCApi, DialogOpenPathOptions, NetFetchInit, NetFetchResponse, SqlRunResult } from '../shared/types';

const api: CCApi = {
  state: {
    load: (): Promise<AppState> => ipcRenderer.invoke(IPC.STATE_LOAD),
    save: (state: AppState): Promise<void> => ipcRenderer.invoke(IPC.STATE_SAVE, state)
  },
  kv: {
    get: (widgetId, key) => ipcRenderer.invoke(IPC.KV_GET, widgetId, key),
    set: (widgetId, key, value) => ipcRenderer.invoke(IPC.KV_SET, widgetId, key, value),
    del: (widgetId, key) => ipcRenderer.invoke(IPC.KV_DEL, widgetId, key),
    keys: (widgetId) => ipcRenderer.invoke(IPC.KV_KEYS, widgetId)
  },
  sql: {
    run: (widgetId, sql, params = []): Promise<SqlRunResult> =>
      ipcRenderer.invoke(IPC.SQL_RUN, widgetId, sql, params),
    all: (widgetId, sql, params = []) => ipcRenderer.invoke(IPC.SQL_ALL, widgetId, sql, params),
    get: (widgetId, sql, params = []) => ipcRenderer.invoke(IPC.SQL_GET, widgetId, sql, params),
    exec: (widgetId, sql) => ipcRenderer.invoke(IPC.SQL_EXEC, widgetId, sql),
    runBatch: (widgetId, items) => ipcRenderer.invoke(IPC.SQL_RUN_BATCH, widgetId, items)
  },
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke(IPC.SHELL_OPEN_PATH, path),
    showItemInFolder: (path: string): Promise<void> => ipcRenderer.invoke(IPC.SHELL_SHOW_IN_FOLDER, path)
  },
  dialog: {
    openPath: (options?: DialogOpenPathOptions): Promise<string[] | null> =>
      ipcRenderer.invoke(IPC.DIALOG_OPEN_PATH, options)
  },
  net: {
    fetch: (url: string, init?: NetFetchInit): Promise<NetFetchResponse> =>
      ipcRenderer.invoke(IPC.NET_FETCH, url, init)
  }
};

contextBridge.exposeInMainWorld('cc', api);
