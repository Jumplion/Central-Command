import { useState, useCallback } from "react";
import { tooltipPanel } from "./styles";

type LineDatum = Record<string, string | number>;

interface Series {
  key: string;
  color: string;
}

interface Tip {
  x: number;
  y: number;
  rightAlign: boolean;
  label: string;
  values: Record<string, number>;
}

const VW = 380;
const VH = 160;
const PAD = { top: 6, right: 4, bottom: 24, left: 26 };

export function LineChart({
  data,
  series,
}: {
  data: LineDatum[];
  series: Series[];
}) {
  const [tip, setTip] = useState<Tip | null>(null);

  const n = data.length;
  const innerW = VW - PAD.left - PAD.right;
  const innerH = VH - PAD.top - PAD.bottom;

  const maxVal = Math.max(
    1,
    ...data.flatMap((d) => series.map(({ key }) => Number(d[key]) || 0)),
  );

  const tickStep = Math.ceil(maxVal / 3) || 1;
  const ticks: number[] = [];
  for (let t = tickStep; t <= maxVal + tickStep * 0.5; t += tickStep)
    ticks.push(t);

  const toX = (i: number) =>
    PAD.left + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const toY = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * VW;
      const rawI = ((relX - PAD.left) / innerW) * (n - 1);
      const i = Math.max(0, Math.min(n - 1, Math.round(rawI)));
      if (n > 0) {
        setTip({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          rightAlign: i >= n / 2,
          label: String(data[i].label),
          values: Object.fromEntries(
            series.map(({ key }) => [key, Number(data[i][key]) || 0]),
          ),
        });
      }
    },
    [data, series, innerW, n],
  );

  // Determine which labels to show (skip to avoid crowding)
  const maxLabels = 12;
  const labelStep = n <= maxLabels ? 1 : Math.ceil(n / maxLabels);

  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ width: "100%", height: "100%", display: "block" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTip(null)}
      >
        {/* Y-axis grid lines and tick labels */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={toY(t)}
              x2={PAD.left + innerW}
              y2={toY(t)}
              stroke="var(--border)"
              strokeDasharray="3 2"
            />
            <text
              x={PAD.left - 3}
              y={toY(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={8}
              fill="var(--text-dim)"
            >
              {t}
            </text>
          </g>
        ))}

        {/* Axes */}
        <line
          x1={PAD.left}
          y1={PAD.top}
          x2={PAD.left}
          y2={PAD.top + innerH}
          stroke="var(--border)"
        />
        <line
          x1={PAD.left}
          y1={PAD.top + innerH}
          x2={PAD.left + innerW}
          y2={PAD.top + innerH}
          stroke="var(--border)"
        />

        {/* Lines */}
        {series.map(({ key, color }) => {
          const points = data
            .map((d, i) => `${toX(i)},${toY(Number(d[key]) || 0)}`)
            .join(" ");
          return (
            <polyline
              key={key}
              points={points}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Dots */}
        {series.map(({ key, color }) =>
          data.map((d, i) => {
            const v = Number(d[key]) || 0;
            return v > 0 ? (
              <circle
                key={`${key}-${i}`}
                cx={toX(i)}
                cy={toY(v)}
                r={2}
                fill={color}
              />
            ) : null;
          }),
        )}

        {/* X-axis labels */}
        {data.map((d, i) =>
          i % labelStep === 0 ? (
            <text
              key={i}
              x={toX(i)}
              y={PAD.top + innerH + 13}
              textAnchor="middle"
              fontSize={8}
              fill="var(--text-dim)"
            >
              {String(d.label)}
            </text>
          ) : null,
        )}
      </svg>

      {tip && (
        <div
          style={{
            ...tooltipPanel,
            left: tip.x,
            top: Math.max(0, tip.y - 10),
            transform: tip.rightAlign
              ? "translateX(calc(-100% - 8px))"
              : "translateX(8px)",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{tip.label}</div>
          {series
            .filter(({ key }) => tip.values[key] > 0)
            .map(({ key, color }) => (
              <div key={key} style={{ color }}>
                {key}: {tip.values[key]}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
