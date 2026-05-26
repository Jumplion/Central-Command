// ─── Table helpers ────────────────────────────────────────────────────────

export function Th({
  children,
  onClick,
  sortIndicator,
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  sortIndicator?: "asc" | "desc" | null;
}) {
  const isClickable = Boolean(onClick);
  return (
    <th
      onClick={onClick}
      style={{
        padding: "4px 6px",
        fontWeight: 500,
        fontSize: 11,
        textAlign: "left",
        borderBottom: "1px solid var(--border)",
        cursor: isClickable ? "pointer" : "default",
        userSelect: "none",
        backgroundColor: isClickable ? "var(--hover-bg)" : "transparent",
        transition: "background-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = "rgba(110, 168, 255, 0.12)";
        }
      }}
      onMouseLeave={(e) => {
        if (isClickable) {
          e.currentTarget.style.backgroundColor = "var(--hover-bg)";
        } else {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        {children}
        {sortIndicator && (
          <span style={{ fontSize: "10px", opacity: 0.7 }}>
            {sortIndicator === "asc" ? "↑" : "↓"}
          </span>
        )}
      </span>
    </th>
  );
}
