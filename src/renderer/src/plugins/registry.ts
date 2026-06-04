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

const loaders = import.meta.glob<{ default: Widget }>(
  "../../../widgets/*/index.tsx",
  { eager: false },
);

const registry = new Map<string, Widget>();
const registeredIds = new Set<string>();
let sortedWidgets: Widget[] = [];

let _initPromise: Promise<void> | null = null;

export function initRegistry(): Promise<void> {
  if (_initPromise) return _initPromise;
  _initPromise = Promise.all(
    Object.entries(loaders).map(async ([filePath, loader]) => {
      const mod = await loader();
      const error = getWidgetRegistrationError(
        mod,
        registeredIds,
        CURRENT_PLATFORM,
      );
      if (error) {
        if (error !== "unsupported platform") {
          console.warn(`[plugins] skipping widget at ${filePath}: ${error}`);
        }
        return;
      }
      const widget = mod.default;
      registeredIds.add(widget.manifest.id);
      registry.set(widget.manifest.id, widget);
    }),
  ).then(() => {
    sortedWidgets = Array.from(registry.values()).sort((a, b) =>
      a.manifest.name.localeCompare(b.manifest.name),
    );
  });
  return _initPromise;
}

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
