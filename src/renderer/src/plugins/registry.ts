import type { ComponentType } from "react";
import type { WidgetManifest, WidgetSettings } from "@shared/types";
import type { WidgetApi } from "./api";
import { getWidgetRegistrationError } from "./registry-validator";

const CURRENT_PLATFORM: "desktop" = "desktop";

export interface WidgetProps {
  api: WidgetApi;
  settings: WidgetSettings;
  setTitle: (title: string | undefined) => void;
}

export interface Widget {
  manifest: WidgetManifest;
  Component: ComponentType<WidgetProps>;
}

const modules = import.meta.glob<{ default: Widget }>(
  "../../../widgets/*/index.tsx",
  {
    eager: true,
  },
);

const registry = new Map<string, Widget>();
const registeredIds = new Set<string>();

for (const filePath in modules) {
  const mod = modules[filePath];
  const error = getWidgetRegistrationError(
    mod,
    registeredIds,
    CURRENT_PLATFORM,
  );
  if (error) {
    if (error !== "unsupported platform") {
      console.warn(`[plugins] skipping widget at ${filePath}: ${error}`);
    }
    continue;
  }

  const widget = mod!.default;
  registeredIds.add(widget.manifest.id);
  registry.set(widget.manifest.id, widget);
}

const sortedWidgets: Widget[] = Array.from(registry.values()).sort((a, b) =>
  a.manifest.name.localeCompare(b.manifest.name),
);

export function listWidgets(): Widget[] {
  return sortedWidgets;
}

export function getWidget(id: string): Widget | undefined {
  return registry.get(id);
}

export function defaultSettingsFor(manifest: WidgetManifest): WidgetSettings {
  const out: WidgetSettings = {};
  for (const f of manifest.settings ?? []) {
    if ("default" in f && f.default !== undefined) out[f.key] = f.default;
  }
  return out;
}
