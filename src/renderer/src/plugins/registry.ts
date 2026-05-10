import type { ComponentType } from 'react';
import type { WidgetManifest, WidgetSettings } from '@shared/types';
import type { WidgetApi } from './api';

export interface WidgetProps {
  api: WidgetApi;
  settings: WidgetSettings;
  setTitle: (title: string | undefined) => void;
}

export interface Widget {
  manifest: WidgetManifest;
  Component: ComponentType<WidgetProps>;
}

const VALID_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

const modules = import.meta.glob<{ default: Widget }>('../../../widgets/*/index.tsx', {
  eager: true
});

const registry = new Map<string, Widget>();

for (const filePath in modules) {
  const mod = modules[filePath];
  const widget = mod?.default;
  if (!widget?.manifest || !widget.Component) {
    console.warn(`[plugins] skipping invalid widget at ${filePath}`);
    continue;
  }
  const id = widget.manifest.id;
  if (!VALID_ID.test(id)) {
    console.warn(`[plugins] invalid widget id "${id}" at ${filePath}`);
    continue;
  }
  if (registry.has(id)) {
    console.warn(`[plugins] duplicate widget id "${id}" at ${filePath}`);
    continue;
  }
  registry.set(id, widget);
}

export function listWidgets(): Widget[] {
  return Array.from(registry.values()).sort((a, b) =>
    a.manifest.name.localeCompare(b.manifest.name)
  );
}

export function getWidget(id: string): Widget | undefined {
  return registry.get(id);
}

export function defaultSettingsFor(manifest: WidgetManifest): WidgetSettings {
  const out: WidgetSettings = {};
  for (const f of manifest.settings ?? []) {
    if ('default' in f && f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}
