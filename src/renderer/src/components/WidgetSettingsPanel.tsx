import { useState } from 'react';
import type { SettingsField, WidgetInstance } from '@shared/types';
import type { Widget } from '@renderer/plugins/registry';
import { useDashboard } from '@renderer/state/dashboard';

interface Props {
  widget: Widget;
  instance: WidgetInstance;
  onClose: () => void;
}

export function WidgetSettingsPanel({ widget, instance, onClose }: Props) {
  const updateSettings = useDashboard((s) => s.updateSettings);
  const setTitle = useDashboard((s) => s.setTitle);
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...instance.settings });
  const [titleDraft, setTitleDraft] = useState(instance.title ?? '');

  const fields = widget.manifest.settings ?? [];

  function update(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    updateSettings(instance.instanceId, draft);
    setTitle(instance.instanceId, titleDraft.trim() || undefined);
    onClose();
  }

  return (
    <div className="settings-panel" role="dialog" aria-label={`${widget.manifest.name} settings`}>
      <div className="settings-header">
        <strong>{widget.manifest.name} settings</strong>
        <button className="ghost" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div className="settings-body">
        <label className="field">
          <span>Title (override)</span>
          <input
            value={titleDraft}
            placeholder={widget.manifest.name}
            onChange={(e) => setTitleDraft(e.target.value)}
          />
        </label>
        {fields.map((f) => (
          <Field
            key={f.key}
            field={f}
            value={draft[f.key] ?? ('default' in f ? f.default : undefined)}
            onChange={(v) => update(f.key, v)}
          />
        ))}
      </div>
      <div className="settings-footer">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}>Save</button>
      </div>
    </div>
  );
}

interface FieldProps {
  field: SettingsField;
  value: unknown;
  onChange: (v: unknown) => void;
}

function Field({ field, value, onChange }: FieldProps) {
  switch (field.kind) {
    case 'string':
      return (
        <label className="field">
          <span>{field.label}</span>
          {field.multiline ? (
            <textarea
              value={(value as string) ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
              rows={4}
            />
          ) : (
            <input
              value={(value as string) ?? ''}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </label>
      );
    case 'number':
      return (
        <label className="field">
          <span>{field.label}</span>
          <input
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>
      );
    case 'boolean':
      return (
        <label className="field field-checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    case 'select':
      return (
        <label className="field">
          <span>{field.label}</span>
          <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)}>
            {field.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );
  }
}
