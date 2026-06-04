import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import { useDashboard } from "@renderer/state/dashboard";
import { getWidget } from "@renderer/plugins/registry";
import { WidgetHost } from "./WidgetHost";
import type { WidgetInstance, WidgetManifest } from "@shared/types";
import type { Widget } from "@renderer/plugins/registry";

const COLS = 12;
const ROW_HEIGHT = 60;
const MAX_HISTORY = 20;

type LayoutSnapshot = {
  instanceId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}[];

function ResizeHint({
  w,
  h,
  manifest,
}: {
  w: number;
  h: number;
  manifest?: WidgetManifest;
}) {
  const isGoodFit =
    manifest?.defaultSize != null &&
    w === manifest.defaultSize.w &&
    h === manifest.defaultSize.h;

  return (
    <div className={`resize-hint${isGoodFit ? " resize-hint--good-fit" : ""}`}>
      {isGoodFit && <span className="resize-hint__check">✓</span>}
      <span>
        {w} × {h}
      </span>
      {isGoodFit && <span className="resize-hint__label">Recommended</span>}
    </div>
  );
}

const GridCell = memo(function GridCell({
  instance,
  widget,
  isResizing,
  resizeW,
  resizeH,
}: {
  instance: WidgetInstance;
  widget: Widget | undefined;
  isResizing: boolean;
  resizeW: number;
  resizeH: number;
}) {
  return (
    <div data-instance-id={instance.instanceId}>
      <div className="widget-cell">
        <WidgetHost instance={instance} widget={widget} />
        {isResizing && (
          <ResizeHint w={resizeW} h={resizeH} manifest={widget?.manifest} />
        )}
      </div>
    </div>
  );
});

export function Dashboard() {
  const dashboard = useDashboard((s) => s.activeDashboard());
  const updateLayout = useDashboard((s) => s.updateLayout);

  const containerRef = useRef<HTMLDivElement>(null);
  const previousInstanceIdsRef = useRef<Set<string>>(new Set());
  const [width, setWidth] = useState(800);
  const [resizingItem, setResizingItem] = useState<{
    id: string;
    w: number;
    h: number;
  } | null>(null);
  const layoutHistoryRef = useRef<LayoutSnapshot[]>([]);
  const layoutFutureRef = useRef<LayoutSnapshot[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) {
          if (rafId !== null) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => {
            rafId = null;
            setWidth(w);
          });
        }
      }
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const widgetMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getWidget> | undefined>();
    for (const instance of dashboard.instances) {
      if (!map.has(instance.widgetId)) {
        map.set(instance.widgetId, getWidget(instance.widgetId));
      }
    }
    return map;
  }, [dashboard.instances]);

  const layout = useMemo<Layout[]>(
    () =>
      dashboard.instances.map((i) => {
        const min = widgetMap.get(i.widgetId)?.manifest.minSize;
        return {
          i: i.instanceId,
          x: i.layout.x,
          y: i.layout.y,
          w: i.layout.w,
          h: i.layout.h,
          minW: min?.w ?? 2,
          minH: min?.h ?? 2,
        };
      }),
    [dashboard.instances, widgetMap],
  );

  useEffect(() => {
    const currentIds = new Set(
      dashboard.instances.map((instance) => instance.instanceId),
    );
    const previousIds = previousInstanceIdsRef.current;
    const newInstanceIds = Array.from(currentIds).filter(
      (id) => !previousIds.has(id),
    );

    previousInstanceIdsRef.current = currentIds;

    if (newInstanceIds.length !== 1) return;

    const container = containerRef.current;
    if (!container) return;

    const target = container.querySelector<HTMLElement>(
      `[data-instance-id="${newInstanceIds[0]}"]`,
    );
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [dashboard.instances]);

  const snapshotCurrentLayout = useCallback(
    (): LayoutSnapshot =>
      dashboard.instances.map((i) => ({
        instanceId: i.instanceId,
        ...i.layout,
      })),
    [dashboard.instances],
  );

  const handleChange = useCallback(
    (next: Layout[]) => {
      updateLayout(
        next.map((l) => ({ instanceId: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
      );
    },
    [updateLayout],
  );

  const pushHistory = useCallback(() => {
    layoutFutureRef.current = [];
    const snap = snapshotCurrentLayout();
    layoutHistoryRef.current = [
      ...layoutHistoryRef.current.slice(-(MAX_HISTORY - 1)),
      snap,
    ];
  }, [snapshotCurrentLayout]);

  const handleDragStart = useCallback(() => {
    pushHistory();
  }, [pushHistory]);

  const handleResizeStart = useCallback(
    (_layout: Layout[], oldItem: Layout) => {
      pushHistory();
      setResizingItem({ id: oldItem.i, w: oldItem.w, h: oldItem.h });
    },
    [pushHistory],
  );

  const handleResize = useCallback(
    (_layout: Layout[], _oldItem: Layout, newItem: Layout) => {
      setResizingItem({ id: newItem.i, w: newItem.w, h: newItem.h });
    },
    [],
  );

  const handleResizeStop = useCallback(
    (next: Layout[]) => {
      setResizingItem(null);
      handleChange(next);
    },
    [handleChange],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const history = layoutHistoryRef.current;
        if (history.length === 0) return;
        const prev = history[history.length - 1];
        layoutHistoryRef.current = history.slice(0, -1);
        layoutFutureRef.current = [
          snapshotCurrentLayout(),
          ...layoutFutureRef.current.slice(0, MAX_HISTORY - 1),
        ];
        updateLayout(prev);
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        const future = layoutFutureRef.current;
        if (future.length === 0) return;
        const next = future[0];
        layoutFutureRef.current = future.slice(1);
        layoutHistoryRef.current = [
          ...layoutHistoryRef.current.slice(-(MAX_HISTORY - 1)),
          snapshotCurrentLayout(),
        ];
        updateLayout(next);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [snapshotCurrentLayout, updateLayout]);

  const gridItems = useMemo(
    () =>
      dashboard.instances.map((i) => {
        const widget = widgetMap.get(i.widgetId);
        const isResizing = resizingItem?.id === i.instanceId;
        return (
          <GridCell
            key={i.instanceId}
            instance={i}
            widget={widget}
            isResizing={isResizing}
            resizeW={isResizing ? resizingItem!.w : 0}
            resizeH={isResizing ? resizingItem!.h : 0}
          />
        );
      }),
    [dashboard.instances, widgetMap, resizingItem],
  );

  return (
    <div className="dashboard" ref={containerRef}>
      {dashboard.instances.length === 0 ? (
        <div className="empty">
          <h2>No widgets yet</h2>
          <p>
            Click <strong>+ Add widget</strong> in the sidebar to get started,
            or create a new widget under <code>src/widgets/</code>.
          </p>
        </div>
      ) : (
        <GridLayout
          className="layout"
          layout={layout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={width}
          margin={[12, 12]}
          containerPadding={[16, 16]}
          draggableHandle=".widget-header"
          draggableCancel=".widget-actions"
          onDragStart={handleDragStart}
          onDragStop={handleChange}
          onResizeStart={handleResizeStart}
          onResize={handleResize}
          onResizeStop={handleResizeStop}
          compactType={null}
          preventCollision={true}
        >
          {gridItems}
        </GridLayout>
      )}
    </div>
  );
}
