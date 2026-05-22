import { useState } from "react";

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const SIZE = 130;
const CX = SIZE / 2;
const CY = SIZE / 2;
const OUTER_R = 55;
const INNER_R = 30;

function polarToCartesian(r: number, angle: number) {
  return { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
}

function arcPath(
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number,
) {
  const p1 = polarToCartesian(outerR, startAngle);
  const p2 = polarToCartesian(outerR, endAngle);
  const p3 = polarToCartesian(innerR, endAngle);
  const p4 = polarToCartesian(innerR, startAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export function PieChart({ data }: { data: PieSlice[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = data.reduce((acc, d) => acc + d.value, 0);

  if (total === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-dim)",
          fontSize: 13,
        }}
      >
        No data
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const sweep = (d.value / total) * 2 * Math.PI;
      const start = angle;
      angle += sweep;
      return { ...d, startAngle: start, endAngle: angle };
    });

  const hovered = hoveredIdx !== null ? slices[hoveredIdx] : null;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      {/* Donut */}
      <div style={{ flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {slices.map((s, i) => (
            <path
              key={s.label}
              d={arcPath(INNER_R, OUTER_R, s.startAngle, s.endAngle)}
              fill={s.color}
              opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.4}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: "default", transition: "opacity 0.1s" }}
            />
          ))}
          {/* Center text */}
          <text
            x={CX}
            y={CY - 5}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="var(--text)"
          >
            {hovered ? hovered.value : total}
          </text>
          <text
            x={CX}
            y={CY + 9}
            textAnchor="middle"
            fontSize={7.5}
            fill="var(--text-dim)"
          >
            {hovered
              ? `${Math.round((hovered.value / total) * 100)}%`
              : "total"}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 0,
          overflowY: "auto",
        }}
      >
        {slices.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.4,
              transition: "opacity 0.1s",
              cursor: "default",
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: s.color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-dim)",
                flexShrink: 0,
                marginLeft: 4,
              }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
