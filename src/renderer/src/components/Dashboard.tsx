import { useEffect, useRef, useState } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import { useDashboard } from '@renderer/state/dashboard';
import { getWidget } from '@renderer/plugins/registry';
import { WidgetHost } from './WidgetHost';

const COLS = 12;
const ROW_HEIGHT = 60;

export function Dashboard() {
  const dashboard = useDashboard((s) => s.activeDashboard());
  const updateLayout = useDashboard((s) => s.updateLayout);

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setWidth(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout: Layout[] = dashboard.instances.map((i) => {
    const min = getWidget(i.widgetId)?.manifest.minSize;
    return {
      i: i.instanceId,
      x: i.layout.x,
      y: i.layout.y,
      w: i.layout.w,
      h: i.layout.h,
      minW: min?.w ?? 2,
      minH: min?.h ?? 2
    };
  });

  const handleChange = (next: Layout[]) => {
    updateLayout(
      next.map((l) => ({ instanceId: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
    );
  };

  return (
    <div className="dashboard" ref={containerRef}>
      {dashboard.instances.length === 0 ? (
        <div className="empty">
          <h2>No widgets yet</h2>
          <p>
            Click <strong>+ Add widget</strong> in the sidebar to get started, or create a new
            widget under <code>src/widgets/</code>.
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
          onDragStop={handleChange}
          onResizeStop={handleChange}
          compactType="vertical"
        >
          {dashboard.instances.map((i) => (
            <div key={i.instanceId}>
              <WidgetHost instance={i} widget={getWidget(i.widgetId)} />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
