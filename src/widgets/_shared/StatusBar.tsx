import { Chip } from './Chip';

export interface StatusBarItem<T extends string> {
  value: T;
  label: string;
  count: number;
  color: string;
}

export interface StatusBarProps<T extends string> {
  items: StatusBarItem<T>[];
  selected: T | 'All';
  onSelect: (value: T | 'All') => void;
  allLabel: string;
  allCount: number;
  allColor?: string;
}

export function StatusBar<T extends string>({
  items,
  selected,
  onSelect,
  allLabel,
  allCount,
  allColor = 'var(--accent)',
}: StatusBarProps<T>) {
  return (
    <div style={{ flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
        <Chip active={selected === 'All'} color={allColor} onClick={() => onSelect('All')}>
          {allLabel} ({allCount})
        </Chip>
        {items.map((item) => (
          <Chip
            key={item.value}
            active={selected === item.value}
            color={item.color}
            onClick={() => onSelect(item.value)}
          >
            {item.label} ({item.count})
          </Chip>
        ))}
      </div>

      {allCount > 0 && (
        <div style={{ display: 'flex', height: 3, borderRadius: 2, overflow: 'hidden', gap: 1 }}>
          {items.filter((item) => item.count > 0).map((item) => (
            <div
              key={item.value}
              style={{ width: `${(item.count / allCount) * 100}%`, background: item.color }}
              title={`${item.label}: ${item.count}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
