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
  return () => {
    listeners.delete(listener);
  };
}

export function emitApiCall(record: ApiCallRecord): void {
  for (const l of listeners) l(record);
}

export type WidgetEventKind = 'mount' | 'unmount';

export interface WidgetLifecycleEvent {
  kind: WidgetEventKind;
  widgetId: string;
  instanceId: string;
  timestamp: number;
  durationMs?: number; // only present on 'unmount'
}

type WidgetListener = (event: WidgetLifecycleEvent) => void;
const widgetListeners = new Set<WidgetListener>();

export function subscribeWidgetEvents(listener: WidgetListener): () => void {
  widgetListeners.add(listener);
  return () => { widgetListeners.delete(listener); };
}

export function emitWidgetMount(instanceId: string, widgetId: string): void {
  const event: WidgetLifecycleEvent = {
    kind: 'mount', widgetId, instanceId, timestamp: Date.now(),
  };
  for (const l of widgetListeners) l(event);
}

export function emitWidgetUnmount(
  instanceId: string,
  widgetId: string,
  durationMs: number,
): void {
  const event: WidgetLifecycleEvent = {
    kind: 'unmount', widgetId, instanceId, timestamp: Date.now(), durationMs,
  };
  for (const l of widgetListeners) l(event);
}
