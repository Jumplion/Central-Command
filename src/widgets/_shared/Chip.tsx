import type { CSSProperties, ReactNode } from 'react';

export interface ChipProps {
  active: boolean;
  color: string;
  onClick: () => void;
  children: ReactNode;
  style?: CSSProperties;
}

export function Chip({ active, color, onClick, children, style }: ChipProps) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        padding: '2px 8px',
        background: active ? color + '22' : 'transparent',
        border: active ? `1px solid ${color}55` : '1px solid transparent',
        color: active ? color : 'var(--text-dim)',
        borderRadius: 4,
        cursor: 'pointer',
        transition: 'all 0.1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
