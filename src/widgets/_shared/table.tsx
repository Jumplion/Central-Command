export function Td({
  children,
  dim,
}: {
  children?: React.ReactNode;
  dim?: boolean;
}) {
  return (
    <td
      style={{
        padding: "5px 6px",
        verticalAlign: "middle",
        color: dim ? "var(--text-dim)" : undefined,
      }}
    >
      {children}
    </td>
  );
}

export function StatusBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      style={{
        background: color + "22",
        color,
        borderRadius: 4,
        padding: "1px 6px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}
