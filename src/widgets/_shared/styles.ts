import type { CSSProperties } from 'react';

export const buttonDefault: CSSProperties = {
  fontSize: 12,
  padding: '4px 10px',
};

export const buttonSmall: CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
};

export const buttonTiny: CSSProperties = {
  fontSize: 11,
  padding: '1px 6px',
};

export const buttonExtraSmall: CSSProperties = {
  fontSize: 10,
  padding: '3px 5px',
  lineHeight: 1,
};

export const dimText: CSSProperties = {
  color: 'var(--text-dim)',
};

export const mutedText: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

export const smallDimText: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
};

export const inp: CSSProperties = {
  fontSize: 12,
  padding: '4px 6px',
};

export const inputBase: CSSProperties = {
  fontSize: 12,
  padding: '6px 8px',
};

export const centeredEmptyState: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  color: 'var(--text-dim)',
};

export const tooltipPanel: CSSProperties = {
  position: 'absolute',
  background: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  fontSize: 11,
  color: 'var(--text)',
  padding: '4px 8px',
  pointerEvents: 'none',
  zIndex: 10,
  whiteSpace: 'nowrap',
};

export const badgePill: CSSProperties = {
  fontSize: 10,
  padding: '1px 5px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
  fontWeight: 600,
};
