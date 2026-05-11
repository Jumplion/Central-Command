export const IPC = {
  STATE_LOAD: 'cc:state:load',
  STATE_SAVE: 'cc:state:save',

  KV_GET: 'cc:kv:get',
  KV_SET: 'cc:kv:set',
  KV_DEL: 'cc:kv:del',
  KV_KEYS: 'cc:kv:keys',

  SQL_RUN: 'cc:sql:run',
  SQL_ALL: 'cc:sql:all',
  SQL_GET: 'cc:sql:get',
  SQL_EXEC: 'cc:sql:exec',
  SQL_RUN_BATCH: 'cc:sql:runBatch',

  SHELL_OPEN_EXTERNAL: 'cc:shell:openExternal',
  SHELL_OPEN_PATH: 'cc:shell:openPath',
  SHELL_SHOW_IN_FOLDER: 'cc:shell:showInFolder',
  DIALOG_OPEN_PATH: 'cc:dialog:openPath',

  NET_FETCH: 'cc:net:fetch',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
