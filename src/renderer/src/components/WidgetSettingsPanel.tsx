import { useState } from "react";
import type {
  SettingsField,
  SettingsFieldValue,
  WidgetInstance,
} from "@shared/types";
import type { Widget } from "@renderer/plugins/registry";
import { useDashboard } from "@renderer/state/dashboard";

interface Props {
  widget: Widget;
  instance: WidgetInstance;
  onClose: () => void;
}

type FieldValue = SettingsFieldValue;

export function WidgetSettingsPanel({ widget, instance, onClose }: Props) {
  const updateSettings = useDashboard((s) => s.updateSettings);
  const setTitle = useDashboard((s) => s.setTitle);
  const [draft, setDraft] = useState<Record<string, FieldValue>>({
    ...instance.settings,
  });
  const [titleDraft, setTitleDraft] = useState(instance.title ?? "");

  const fields = widget.manifest.settings ?? [];

  function update(key: string, value: FieldValue) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function save() {
    updateSettings(instance.instanceId, draft);
    setTitle(instance.instanceId, titleDraft.trim() || undefined);
    onClose();
  }

  return (
    <div
      className="settings-panel"
      role="dialog"
      aria-label={`${widget.manifest.name} settings`}
    >
      <div className="settings-header">
        <strong>{widget.manifest.name} settings</strong>
        <button className="ghost" onClick={onClose} aria-label="Close">
          ✕
        </button>
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
        {fields.map((field) => (
          <Field
            key={field.key}
            field={field}
            value={
              draft[field.key] ??
              ("default" in field ? field.default : undefined)
            }
            onChange={(value) => update(field.key, value)}
          />
        ))}
      </div>
      <div className="settings-footer">
        <button onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}>
          Save
        </button>
      </div>
    </div>
  );
}

interface FieldProps {
  field: SettingsField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function Field({ field, value, onChange }: FieldProps) {
  switch (field.kind) {
    case "string":
      return (
        <SettingsFieldString
          field={field}
          value={(value as string) ?? ""}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <SettingsFieldNumber
          field={field}
          value={value as number | undefined}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <SettingsFieldBoolean
          field={field}
          value={Boolean(value)}
          onChange={onChange}
        />
      );
    case "select":
      return (
        <SettingsFieldSelect
          field={field}
          value={(value as string) ?? ""}
          onChange={onChange}
        />
      );
  }
}

function SettingsFieldString({
  field,
  value,
  onChange,
}: {
  field: Extract<SettingsField, { kind: "string" }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{field.label}</span>
      {field.multiline ? (
        <textarea
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
        />
      ) : (
        <input
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function SettingsFieldNumber({
  field,
  value,
  onChange,
}: {
  field: Extract<SettingsField, { kind: "number" }>;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <label className="field">
      <span>{field.label}</span>
      <input
        type="number"
        value={value === undefined ? "" : String(value)}
        min={field.min}
        max={field.max}
        step={field.step}
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
      />
    </label>
  );
}

function SettingsFieldBoolean({
  field,
  value,
  onChange,
}: {
  field: Extract<SettingsField, { kind: "boolean" }>;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="field field-checkbox">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{field.label}</span>
    </label>
  );
}

function SettingsFieldSelect({
  field,
  value,
  onChange,
}: {
  field: Extract<SettingsField, { kind: "select" }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{field.label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
