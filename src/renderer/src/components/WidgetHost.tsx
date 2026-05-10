import { Component, ReactNode, useMemo, useState } from 'react';
import type { WidgetInstance } from '@shared/types';
import type { Widget } from '@renderer/plugins/registry';
import { createWidgetApi } from '@renderer/plugins/api';
import { useDashboard } from '@renderer/state/dashboard';
import { WidgetSettingsPanel } from './WidgetSettingsPanel';

interface Props {
  instance: WidgetInstance;
  widget: Widget | undefined;
}

export function WidgetHost({ instance, widget }: Props) {
  const removeInstance = useDashboard((s) => s.removeInstance);
  const setTitle = useDashboard((s) => s.setTitle);
  const [showSettings, setShowSettings] = useState(false);

  const api = useMemo(
    () => (widget ? createWidgetApi(widget.manifest.id, instance.instanceId) : null),
    [widget, instance.instanceId]
  );

  if (!widget || !api) {
    return (
      <div className="widget widget-missing">
        <div className="widget-header">
          <span className="widget-icon">⚠</span>
          <span className="widget-title">Missing widget: {instance.widgetId}</span>
          <div className="widget-actions">
            <button onClick={() => removeInstance(instance.instanceId)} aria-label="Remove">✕</button>
          </div>
        </div>
        <div className="widget-body">
          <p>
            The widget plugin <code>{instance.widgetId}</code> is not installed. Add it under{' '}
            <code>src/widgets/</code> or remove this instance.
          </p>
        </div>
      </div>
    );
  }

  const Component = widget.Component;
  const title = instance.title || widget.manifest.name;
  const hasSettings = (widget.manifest.settings?.length ?? 0) > 0;

  return (
    <div className="widget">
      <div className="widget-header">
        <span className="widget-icon">{widget.manifest.icon ?? '◻'}</span>
        <span className="widget-title">{title}</span>
        <div className="widget-actions">
          {hasSettings && (
            <button
              className="ghost"
              onClick={() => setShowSettings((s) => !s)}
              aria-label="Settings"
              title="Settings"
            >
              ⚙
            </button>
          )}
          <button
            className="ghost"
            onClick={() => removeInstance(instance.instanceId)}
            aria-label="Remove widget"
            title="Remove"
          >
            ✕
          </button>
        </div>
      </div>
      <div className="widget-body">
        <ErrorBoundary widgetName={widget.manifest.name}>
          <Component
            api={api}
            settings={instance.settings}
            setTitle={(t) => setTitle(instance.instanceId, t)}
          />
        </ErrorBoundary>
      </div>
      {showSettings && (
        <WidgetSettingsPanel
          widget={widget}
          instance={instance}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

interface BoundaryProps {
  widgetName: string;
  children: ReactNode;
}
interface BoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error(`[widget:${this.props.widgetName}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="widget-error">
          <strong>Widget crashed.</strong>
          <pre>{this.state.error.message}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
