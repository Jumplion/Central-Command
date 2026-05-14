import { useMemo } from 'react';
import type { WidgetInstance } from '@shared/types';
import { getWidget } from '@renderer/plugins/registry';
import { WidgetHost } from './WidgetHost';

interface MobileLayoutProps {
  instances: WidgetInstance[];
}

export function MobileLayout({ instances }: MobileLayoutProps) {
  const sorted = useMemo(
    () => [...instances].sort((a, b) => a.layout.y * 12 + a.layout.x - (b.layout.y * 12 + b.layout.x)),
    [instances]
  );

  if (sorted.length === 0) {
    return (
      <div className="empty">
        <h2>No widgets yet</h2>
        <p>Tap <strong>+ Add widget</strong> in the menu to get started.</p>
      </div>
    );
  }

  return (
    <div className="mobile-layout">
      {sorted.map((instance) => (
        <div key={instance.instanceId} className="mobile-widget-row">
          <WidgetHost instance={instance} widget={getWidget(instance.widgetId)} />
        </div>
      ))}
    </div>
  );
}
