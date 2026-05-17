import type { CSSProperties, ReactNode } from 'react';
import { buttonSmall } from './styles';

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
        ...buttonSmall,
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
