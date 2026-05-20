import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GridLayout, { Layout } from "react-grid-layout";
import { useDashboard } from "@renderer/state/dashboard";
import { getWidget } from "@renderer/plugins/registry";
import { WidgetHost } from "./WidgetHost";

const COLS = 12;
const ROW_HEIGHT = 60;

export function Dashboard() {
  const dashboard = useDashboard((s) => s.activeDashboard());
  const updateLayout = useDashboard((s) => s.updateLayout);

  const containerRef = useRef<HTMLDivElement>(null);
  const previousInstanceIdsRef = useRef<Set<string>>(new Set());
  const [width, setWidth] = useState(800);

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

  const gridItems = useMemo(
    () =>
      dashboard.instances.map((i) => (
        <div key={i.instanceId} data-instance-id={i.instanceId}>
          <WidgetHost instance={i} widget={widgetMap.get(i.widgetId)} />
        </div>
      )),
    [dashboard.instances, widgetMap],
  );

  const handleChange = useCallback(
    (next: Layout[]) => {
      updateLayout(
        next.map((l) => ({ instanceId: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
      );
    },
    [updateLayout],
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
          onDragStop={handleChange}
          onResizeStop={handleChange}
          compactType={null}
          preventCollision={true}
        >
          {gridItems}
        </GridLayout>
      )}
    </div>
  );
}
