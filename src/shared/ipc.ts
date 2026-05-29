export const IPC = {
  STATE_LOAD: "cc:state:load",
  STATE_SAVE: "cc:state:save",

  KV_GET: "cc:kv:get",
  KV_SET: "cc:kv:set",
  KV_DEL: "cc:kv:del",
  KV_KEYS: "cc:kv:keys",
  KV_KEYS_PREFIX: "cc:kv:keys-prefix",

  SQL_RUN: "cc:sql:run",
  SQL_ALL: "cc:sql:all",
  SQL_GET: "cc:sql:get",
  SQL_EXEC: "cc:sql:exec",
  SQL_RUN_BATCH: "cc:sql:runBatch",

  SHELL_OPEN_EXTERNAL: "cc:shell:openExternal",
  SHELL_OPEN_PATH: "cc:shell:openPath",
  SHELL_SHOW_IN_FOLDER: "cc:shell:showInFolder",
  DIALOG_OPEN_PATH: "cc:dialog:openPath",

  NET_FETCH: "cc:net:fetch",

  SECRETS_GET: "cc:secrets:get",
  SECRETS_SET: "cc:secrets:set",
  SECRETS_DEL: "cc:secrets:del",
  SECRETS_HAS: "cc:secrets:has",

  GOOGLE_CONNECT: "cc:google:connect",
  GOOGLE_GET_TOKEN: "cc:google:get-token",
  GOOGLE_DISCONNECT: "cc:google:disconnect",
  GOOGLE_IS_CONNECTED: "cc:google:is-connected",

  DRIVE_SYNC_GET_STATUS: "cc:drive-sync:get-status",
  DRIVE_SYNC_ENABLE: "cc:drive-sync:enable",
  DRIVE_SYNC_DISABLE: "cc:drive-sync:disable",
  DRIVE_SYNC_FORCE_PUSH: "cc:drive-sync:force-push",
  DRIVE_SYNC_FORCE_PULL: "cc:drive-sync:force-pull",
  /** Push event from main → renderer on any status change or after a remote pull. */
  DRIVE_SYNC_STATUS_CHANGED: "cc:drive-sync:status-changed",

  CLIPBOARD_READ: "cc:clipboard:read",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
