import type { CSSProperties, ReactNode } from "react";

export interface TabDef<T extends string> {
  value: T;
  label: ReactNode;
}

interface TabBarProps<T extends string> {
  tabs: TabDef<T>[];
  active: T;
  onChange: (value: T) => void;
  /** Extra styles on the outer container div (e.g. marginLeft, flexShrink). */
  containerStyle?: CSSProperties;
  /** Font size for tab buttons. Defaults to 11. */
  fontSize?: number;
  /** Padding for tab buttons. Defaults to "3px 10px". */
  padding?: string;
  /** When true, each button gets flex: 1 to share space equally. */
  equalWidth?: boolean;
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  containerStyle,
  fontSize = 11,
  padding = "3px 10px",
  equalWidth = false,
}: TabBarProps<T>) {
  return (
    <div
      style={{
        display: "flex",
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
        ...containerStyle,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          style={{
            fontSize,
            padding,
            border: "none",
            cursor: "pointer",
            background:
              active === tab.value ? "var(--accent)22" : "transparent",
            color: active === tab.value ? "var(--accent)" : "var(--text-dim)",
            ...(equalWidth ? { flex: 1 } : {}),
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
