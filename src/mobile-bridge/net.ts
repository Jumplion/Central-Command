import type { NetFetchInit, NetFetchResponse } from '@shared/types';

export const netApi = {
  async fetch(url: string, init?: NetFetchInit): Promise<NetFetchResponse> {
    const resp = await fetch(url, {
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
    });
    const body = await resp.text();
    return { ok: resp.ok, status: resp.status, body };
  },
};
