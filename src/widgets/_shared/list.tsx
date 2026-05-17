import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export const rowBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--border)',
  background: 'var(--panel-2)',
  color: 'var(--text)',
};

export const rowHoverStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
};

export const tableRowStyle: CSSProperties = {
  ...rowBaseStyle,
  padding: '12px 14px',
  borderRadius: 8,
};

export const tableHeaderStyle: CSSProperties = {
  ...tableRowStyle,
  borderBottom: '2px solid var(--border)',
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.02em',
};

export const tableCellStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

export function ListRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...rowBaseStyle, ...style }}>{children}</div>;
}

export function InteractiveListRow({
  children,
  onClick,
  disabled = false,
  style,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  style?: CSSProperties;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        all: 'unset',
        display: 'block',
        width: '100%',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 150ms ease',
        ...rowBaseStyle,
        ...(hover && !disabled ? rowHoverStyle : {}),
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function TableRow({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...tableRowStyle, ...style }}>{children}</div>;
}

export function TableHeader({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...tableHeaderStyle, ...style }}>{children}</div>;
}

export function TableCell({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{ ...tableCellStyle, ...style }}>{children}</div>;
}
