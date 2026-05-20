import type { CSSProperties, ReactNode } from "react";

export const formBaseStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: 12,
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};

export const formSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 12,
  background: "var(--panel-1)",
  border: "1px solid var(--border)",
  borderRadius: 10,
};

export const formFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

export const formLabelStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-dim)",
};

export const formInputStyle: CSSProperties = {
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--panel-2)",
  color: "var(--text)",
  width: "100%",
  boxSizing: "border-box",
};

export const formHelperTextStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--text-dim)",
};

export const formActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  flexWrap: "wrap",
};

export function FormSection({
  title,
  description,
  children,
  style,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...formSectionStyle, ...style }}>
      {(title || description) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {title && (
            <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
          )}
          {description && <div style={formHelperTextStyle}>{description}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function FormField({
  label,
  htmlFor,
  helper,
  required = false,
  children,
  style,
}: {
  label: string;
  htmlFor?: string;
  helper?: string;
  required?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ ...formFieldStyle, ...style }}>
      <label htmlFor={htmlFor} style={formLabelStyle}>
        <span>{label}</span>
        {required && <span style={{ color: "var(--accent)" }}>*</span>}
      </label>
      {children}
      {helper && <div style={formHelperTextStyle}>{helper}</div>}
    </div>
  );
}

export function FormGrid({
  children,
  columns = 1,
  gap = 10,
  minColumnWidth = 180,
  style,
}: {
  children: ReactNode;
  columns?: number;
  gap?: number;
  minColumnWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          columns > 1
            ? `repeat(${columns}, minmax(0, 1fr))`
            : `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`,
        gap,
        width: "100%",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function FormActions({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...formActionsStyle, ...style }}>{children}</div>;
}
