import { useState, useCallback } from 'react';
import { tooltipPanel } from './styles';

type BarDatum = Record<string, string | number>;
interface Series { key: string; color: string; }
interface Tip { x: number; y: number; rightAlign: boolean; label: string; values: Record<string, number>; }

// Internal SVG coordinate space
const VW = 380;
const VH = 160;
const PAD = { top: 6, right: 4, bottom: 24, left: 26 };

export function StackedBarChart({ data, series }: { data: BarDatum[]; series: Series[] }) {
  const [tip, setTip] = useState<Tip | null>(null);

  const n = data.length;
  const innerW = VW - PAD.left - PAD.right;
  const innerH = VH - PAD.top - PAD.bottom;
  const barStep = n > 0 ? innerW / n : innerW;
  const barW = barStep * 0.78;
  const barOffset = barStep * 0.11;

  const maxVal = Math.max(1, ...data.map(d =>
    series.reduce((acc, { key }) => acc + (Number(d[key]) || 0), 0)
  ));

  const tickStep = Math.ceil(maxVal / 3) || 1;
  const ticks: number[] = [];
  for (let t = tickStep; t <= maxVal + tickStep * 0.5; t += tickStep) ticks.push(t);

  const toY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VW;
    const i = Math.floor((relX - PAD.left) / barStep);
    if (i >= 0 && i < n) {
      setTip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        rightAlign: i >= n / 2,
        label: String(data[i].label),
        values: Object.fromEntries(series.map(({ key }) => [key, Number(data[i][key]) || 0])),
      });
    } else {
      setTip(null);
    }
  }, [data, series, barStep, n]);

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTip(null)}
      >
        {/* Y-axis grid lines and tick labels */}
        {ticks.map(t => (
          <g key={t}>
            <line
              x1={PAD.left} y1={toY(t)} x2={PAD.left + innerW} y2={toY(t)}
              stroke="var(--border)" strokeDasharray="3 2"
            />
            <text
              x={PAD.left - 3} y={toY(t)}
              textAnchor="end" dominantBaseline="middle"
              fontSize={8} fill="var(--text-dim)"
            >{t}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="var(--border)" />
        <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="var(--border)" />

        {/* Stacked bars and X-axis labels */}
        {data.map((d, i) => {
          const x = PAD.left + i * barStep + barOffset;
          let bottom = PAD.top + innerH;
          return (
            <g key={String(d.label)}>
              {series.map(({ key, color }) => {
                const v = Number(d[key]) || 0;
                const h = (v / maxVal) * innerH;
                const y = bottom - h;
                bottom = y;
                return h > 0 ? <rect key={key} x={x} y={y} width={barW} height={h} fill={color} /> : null;
              })}
              <text
                x={x + barW / 2} y={PAD.top + innerH + 13}
                textAnchor="middle" fontSize={8} fill="var(--text-dim)"
              >{String(d.label)}</text>
            </g>
          );
        })}
      </svg>

      {tip && (
        <div style={{
          ...tooltipPanel,
          left: tip.x,
          top: Math.max(0, tip.y - 10),
          transform: tip.rightAlign ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tip.label}</div>
          {series.filter(({ key }) => tip.values[key] > 0).map(({ key, color }) => (
            <div key={key} style={{ color }}>{key}: {tip.values[key]}</div>
          ))}
        </div>
      )}
    </div>
  );
}
