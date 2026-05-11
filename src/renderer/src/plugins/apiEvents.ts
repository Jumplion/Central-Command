export interface ApiCallRecord {
  widgetId: string;
  url: string;
  method: string;
  timestamp: number;
  status: number;
  duration: number;
  ok: boolean;
}

type Listener = (record: ApiCallRecord) => void;

const listeners = new Set<Listener>();

export function subscribeApiCalls(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitApiCall(record: ApiCallRecord): void {
  for (const l of listeners) l(record);
}
