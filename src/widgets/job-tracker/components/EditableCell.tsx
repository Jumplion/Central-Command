import { Td } from "@widgets/_shared/table";
import { STATUSES, STATUS_COLOR } from "../types";
import type { Application, Status } from "../types";
import { StatusBadge } from "@widgets/_shared/table";

const editInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "2px 4px",
  border: "1px solid var(--border)",
  borderRadius: 2,
  fontSize: 12,
};

type EditableField = "company" | "role" | "status" | "applied_at";

export function EditableCell({
  app,
  field,
  isEditing,
  value,
  onChangeValue,
  onStartEdit,
  onCommit,
  onCancel,
}: {
  app: Application;
  field: EditableField;
  isEditing: boolean;
  value: string;
  onChangeValue: (value: string) => void;
  onStartEdit: (value: string) => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onCommit(value);
    else if (e.key === "Escape") onCancel();
  };

  if (isEditing) {
    if (field === "status") {
      return (
        <Td>
          <select
            value={value}
            onChange={(e) => onCommit(e.target.value)}
            autoFocus
            style={editInputStyle}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Td>
      );
    }
    if (field === "applied_at") {
      return (
        <Td>
          <input
            type="date"
            value={value}
            onChange={(e) => onCommit(e.target.value)}
            autoFocus
            style={editInputStyle}
          />
        </Td>
      );
    }
    return (
      <Td>
        <input
          type="text"
          value={value}
          onChange={(e) => onChangeValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onCommit(value)}
          autoFocus
          style={editInputStyle}
        />
      </Td>
    );
  }

  return (
    <Td>
      <span
        onClick={() => onStartEdit(displayValue(app, field))}
        style={{ cursor: "pointer", padding: field === "status" ? 0 : "2px 4px" }}
        title="Click to edit"
      >
        {field === "status" ? (
          <StatusBadge label={app.status} color={STATUS_COLOR[app.status as Status]} />
        ) : (
          app[field]
        )}
      </span>
    </Td>
  );
}

function displayValue(app: Application, field: EditableField): string {
  return field === "status" ? app.status : app[field];
}
