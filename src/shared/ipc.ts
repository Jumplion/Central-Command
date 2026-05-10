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
  SQL_EXEC: 'cc:sql:exec'
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
