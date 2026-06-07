import type { CSSProperties, ReactNode } from "react";

const cardStyle: CSSProperties = {
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: 8,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 12,
  marginTop: 8,
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  color: "var(--text-dim)",
};

/** Shared "Add <item>" card wrapper used by rule/folder/domain editors. */
export function AddItemCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      {children}
    </div>
  );
}
