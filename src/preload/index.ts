import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { IPC } from '../shared/ipc';
import type { AppState, CCApi, CapturedJob, CapturedAudition, DialogOpenPathOptions, DriveSyncStatus, GoogleConnectOptions, NetFetchInit, NetFetchResponse, SqlRunResult } from '../shared/types';
import { GOOGLE_SERVICES } from '../shared/google';
import type { GoogleServiceId } from '../shared/google';

const api: CCApi = {
  state: {
    load: (): Promise<AppState> => ipcRenderer.invoke(IPC.STATE_LOAD),
    save: (state: AppState): Promise<void> => ipcRenderer.invoke(IPC.STATE_SAVE, state)
  },
  kv: {
    get: (widgetId, key) => ipcRenderer.invoke(IPC.KV_GET, widgetId, key),
    set: (widgetId, key, value) => ipcRenderer.invoke(IPC.KV_SET, widgetId, key, value),
    del: (widgetId, key) => ipcRenderer.invoke(IPC.KV_DEL, widgetId, key),
    keys: (widgetId) => ipcRenderer.invoke(IPC.KV_KEYS, widgetId),
    keysWithPrefix: (widgetId, prefix) => ipcRenderer.invoke(IPC.KV_KEYS_PREFIX, widgetId, prefix)
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
  },
  secrets: {
    get: (widgetId: string, key: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC.SECRETS_GET, widgetId, key),
    set: (widgetId: string, key: string, value: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SECRETS_SET, widgetId, key, value),
    del: (widgetId: string, key: string): Promise<void> =>
      ipcRenderer.invoke(IPC.SECRETS_DEL, widgetId, key),
    has: (widgetId: string, key: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC.SECRETS_HAS, widgetId, key)
  },
  google: {
    services: GOOGLE_SERVICES,
    connect: (widgetId: string, options: GoogleConnectOptions): Promise<void> =>
      ipcRenderer.invoke(IPC.GOOGLE_CONNECT, widgetId, options),
    getToken: (widgetId: string, service?: GoogleServiceId) =>
      ipcRenderer.invoke(IPC.GOOGLE_GET_TOKEN, widgetId, service),
    disconnect: (widgetId: string, service?: GoogleServiceId) =>
      ipcRenderer.invoke(IPC.GOOGLE_DISCONNECT, widgetId, service),
    isConnected: (widgetId: string, service?: GoogleServiceId) =>
      ipcRenderer.invoke(IPC.GOOGLE_IS_CONNECTED, widgetId, service)
  },
  driveSync: {
    getStatus: (): Promise<DriveSyncStatus> => ipcRenderer.invoke(IPC.DRIVE_SYNC_GET_STATUS),
    enable: (): Promise<void> => ipcRenderer.invoke(IPC.DRIVE_SYNC_ENABLE),
    disable: (): Promise<void> => ipcRenderer.invoke(IPC.DRIVE_SYNC_DISABLE),
    forcePush: (): Promise<void> => ipcRenderer.invoke(IPC.DRIVE_SYNC_FORCE_PUSH),
    forcePull: (): Promise<void> => ipcRenderer.invoke(IPC.DRIVE_SYNC_FORCE_PULL),
    onStatusChanged: (cb: (status: DriveSyncStatus) => void) => {
      const handler = (_event: IpcRendererEvent, status: DriveSyncStatus) => cb(status);
      ipcRenderer.on(IPC.DRIVE_SYNC_STATUS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC.DRIVE_SYNC_STATUS_CHANGED, handler);
    },
  },
  jobCapture: {
    status: () => ipcRenderer.invoke(IPC.JOB_CAPTURE_STATUS),
    regenerateToken: () => ipcRenderer.invoke(IPC.JOB_CAPTURE_REGEN_TOKEN),
    onJobAdded: (cb: (job: CapturedJob) => void) => {
      const handler = (_event: IpcRendererEvent, job: CapturedJob) => cb(job);
      ipcRenderer.on(IPC.JOB_CAPTURE_JOB_ADDED, handler);
      return () => ipcRenderer.removeListener(IPC.JOB_CAPTURE_JOB_ADDED, handler);
    },
    onAuditionAdded: (cb: (audition: CapturedAudition) => void) => {
      const handler = (_event: IpcRendererEvent, audition: CapturedAudition) => cb(audition);
      ipcRenderer.on(IPC.JOB_CAPTURE_AUDITION_ADDED, handler);
      return () => ipcRenderer.removeListener(IPC.JOB_CAPTURE_AUDITION_ADDED, handler);
    },
  }
};

contextBridge.exposeInMainWorld('cc', api);
