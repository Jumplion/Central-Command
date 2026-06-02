import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ThreeDie } from "./ThreeDie";

type DieType = "d2" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20";
type CoinSide = "heads" | "tails";

const DIE_SIDES: Record<DieType, number> = {
  d2: 2,
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
};

// Pip positions [x%, y%] within a d6 face
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [68, 28],
    [32, 72],
  ],
  3: [
    [68, 28],
    [50, 50],
    [32, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 22],
    [28, 50],
    [28, 78],
    [72, 22],
    [72, 50],
    [72, 78],
  ],
};

// SVG polygon points in a 0 0 100 100 viewBox
const SVG_SHAPES: Record<string, string> = {
  d4: "50,8 93,88 7,88",
  d8: "50,5 95,50 50,95 5,50",
  d10: "50,5 93,40 75,92 25,92 7,40",
  d12: "50,5 7,34 22,87 78,87 93,34",
  d20: "50,5 97,92 3,92",
};

// Approximate centroid y for text placement per die type
const TEXT_Y: Record<string, number> = {
  d4: 65,
  d8: 52,
  d10: 57,
  d12: 52,
  d20: 66,
};

const ROLL_DURATION = 1400;

const DIE_TYPES: DieType[] = ["d2", "d4", "d6", "d8", "d10", "d12", "d20"];

function PipLayout({ face, size }: { face: number; size: number }) {
  const pips = PIPS[face];
  const pipSize = size * 0.14;
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {pips.map(([x, y], i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: pipSize,
            height: pipSize,
            borderRadius: "50%",
            backgroundColor: "#dde2ec",
            left: `${x}%`,
            top: `${y}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

function D6Cube({ result, rolling }: { result: number; rolling: boolean }) {
  const cubeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rolling || !cubeRef.current) return;
    const el = cubeRef.current;
    el.style.animation = "none";
    el.style.transform = "rotateX(20deg) rotateY(-30deg)";
    void el.offsetHeight;
    el.style.animation = `d6-spin-${result} ${ROLL_DURATION}ms cubic-bezier(0.25,0.1,0.25,1) forwards`;
  }, [rolling, result]);

  const size = 88;
  const half = size / 2;

  const faceBase: CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    backgroundColor: "#1a1d2a",
    border: "1.5px solid #3a4060",
    borderRadius: 10,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  const faces: { face: number; transform: string }[] = [
    { face: 1, transform: `translateZ(${half}px)` },
    { face: 6, transform: `rotateY(180deg) translateZ(${half}px)` },
    { face: 2, transform: `rotateY(90deg) translateZ(${half}px)` },
    { face: 5, transform: `rotateY(-90deg) translateZ(${half}px)` },
    { face: 3, transform: `rotateX(-90deg) translateZ(${half}px)` },
    { face: 4, transform: `rotateX(90deg) translateZ(${half}px)` },
  ];

  return (
    <div
      style={{ perspective: 280, width: size, height: size, margin: "auto" }}
    >
      <div
        ref={cubeRef}
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
          transform: "rotateX(20deg) rotateY(-30deg)",
        }}
      >
        {faces.map(({ face, transform }) => (
          <div key={face} style={{ ...faceBase, transform }}>
            <PipLayout face={face} size={size} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SvgDie({
  type,
  result,
  rolling,
}: {
  type: DieType;
  result: number;
  rolling: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [displayNum, setDisplayNum] = useState<number>(result);
  const sides = DIE_SIDES[type];

  useEffect(() => {
    setDisplayNum(result);
  }, [result]);

  useEffect(() => {
    if (!rolling || !svgRef.current) return;
    const el = svgRef.current;
    el.style.animation = "none";
    void (el as unknown as HTMLElement).offsetHeight;
    el.style.animation = `svg-roll ${ROLL_DURATION}ms ease-out forwards`;

    let count = 0;
    const interval = setInterval(() => {
      count++;
      setDisplayNum(Math.floor(Math.random() * sides) + 1);
      if (count >= 12) {
        clearInterval(interval);
        setDisplayNum(result);
      }
    }, ROLL_DURATION / 13);

    return () => clearInterval(interval);
  }, [rolling, result, sides]);

  const shape = SVG_SHAPES[type];
  const textY = TEXT_Y[type] ?? 54;
  const fontSize = type === "d10" ? 19 : type === "d12" ? 21 : 23;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      width={100}
      height={100}
      style={{ display: "block", margin: "auto", overflow: "visible" }}
    >
      <defs>
        <filter id="die-shadow">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity="0.5"
          />
        </filter>
      </defs>
      <polygon
        points={shape}
        fill="#1a1d2a"
        stroke="#4a5580"
        strokeWidth="2.5"
        strokeLinejoin="round"
        filter="url(#die-shadow)"
      />
      <text
        x="50"
        y={textY}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#dde2ec"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        style={{ userSelect: "none" }}
      >
        {displayNum}
      </text>
    </svg>
  );
}

function CoinVisual({
  result,
  rolling,
}: {
  result: CoinSide | null;
  rolling: boolean;
}) {
  const coinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rolling || !coinRef.current || result === null) return;
    const el = coinRef.current;
    el.style.animation = "none";
    void el.offsetHeight;
    el.style.animation = `coin-flip-${result} ${ROLL_DURATION}ms cubic-bezier(0.25,0.1,0.25,1) forwards`;
  }, [rolling, result]);

  const size = 96;
  const faceBase: CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  return (
    <div
      style={{ perspective: 400, width: size, height: size, margin: "auto" }}
    >
      <div
        ref={coinRef}
        style={{
          width: size,
          height: size,
          position: "relative",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            ...faceBase,
            background: "radial-gradient(circle at 38% 35%, #f5d060, #c8960a)",
            border: "3px solid #a07820",
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.3)",
          }}
        >
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#7a5000",
              letterSpacing: -1,
              userSelect: "none",
            }}
          >
            H
          </span>
        </div>
        <div
          style={{
            ...faceBase,
            background: "radial-gradient(circle at 38% 35%, #c8d4e8, #7888a8)",
            border: "3px solid #607090",
            boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.3)",
            transform: "rotateY(180deg)",
          }}
        >
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#3a4f6e",
              letterSpacing: -1,
              userSelect: "none",
            }}
          >
            T
          </span>
        </div>
      </div>
    </div>
  );
}

export function DiceRoller() {
  const [selected, setSelected] = useState<DieType>("d6");
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<number>(1);
  const [hasRolled, setHasRolled] = useState(false);
  const [history, setHistory] = useState<{ die: DieType; value: number }[]>([]);

  const handleRoll = () => {
    if (rolling) return;
    const value = Math.floor(Math.random() * DIE_SIDES[selected]) + 1;
    setResult(value);
    setRolling(true);
    setHasRolled(true);
    setTimeout(() => {
      setRolling(false);
      setHistory((prev) => [{ die: selected, value }, ...prev].slice(0, 12));
    }, ROLL_DURATION + 80);
  };

  // Reset result display when switching die type
  useEffect(() => {
    setHasRolled(false);
    setResult(1);
  }, [selected]);

  const btnBase: CSSProperties = {
    padding: "4px 0",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 600,
    flex: 1,
    transition: "background 0.15s, color 0.15s",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        height: "100%",
      }}
    >
      {/* Die type selector */}
      <div style={{ display: "flex", gap: 3 }}>
        {DIE_TYPES.map((d) => (
          <button
            key={d}
            onClick={() => {
              if (!rolling) setSelected(d);
            }}
            style={{
              ...btnBase,
              background: selected === d ? "var(--accent)30" : "transparent",
              border: `1px solid ${selected === d ? "var(--accent)" : "var(--border)"}`,
              color: selected === d ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            {d.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Die visual — click to roll */}
      <div
        onClick={handleRoll}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 110,
          cursor: rolling ? "default" : "pointer",
        }}
      >
        {selected === "d2" ? (
          <CoinVisual
            result={hasRolled ? (result === 1 ? "heads" : "tails") : null}
            rolling={rolling}
          />
        ) : selected === "d6" ? (
          <D6Cube result={result} rolling={rolling} />
        ) : selected === "d10" ? (
          <SvgDie type={selected} result={result} rolling={rolling} />
        ) : (
          <ThreeDie
            type={selected}
            result={result}
            rolling={rolling}
            size={110}
          />
        )}
      </div>

      {/* Result */}
      <div
        style={{
          textAlign: "center",
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {rolling ? (
          <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {selected === "d2" ? "flipping…" : "rolling…"}
          </span>
        ) : (
          hasRolled && (
            <span
              key={`${selected}-${result}`}
              style={{
                fontSize: selected === "d2" ? 18 : 26,
                fontWeight: 800,
                color:
                  selected === "d2"
                    ? result === 1
                      ? "#f5c030"
                      : "#8898b8"
                    : "var(--accent)",
                display: "inline-block",
                animation: "result-pop 0.25s ease-out",
                fontFamily: "ui-monospace, monospace",
                textTransform: selected === "d2" ? "uppercase" : undefined,
                letterSpacing: selected === "d2" ? 1 : undefined,
              }}
            >
              {selected === "d2" ? (result === 1 ? "Heads" : "Tails") : result}
            </span>
          )
        )}
      </div>

      {/* Roll button */}
      <button
        onClick={handleRoll}
        disabled={rolling}
        style={{
          padding: "7px 0",
          background: rolling ? "transparent" : "var(--accent)20",
          border: `1px solid ${rolling ? "var(--border)" : "var(--accent)50"}`,
          borderRadius: 6,
          color: rolling ? "var(--text-dim)" : "var(--accent)",
          cursor: rolling ? "default" : "pointer",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {rolling
          ? "…"
          : selected === "d2"
            ? "Flip Coin"
            : `Roll ${selected.toUpperCase()}`}
      </button>

      {/* History */}
      {history.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
          {history.map((h, i) => (
            <div
              key={i}
              title={`${h.die}: ${h.die === "d2" ? (h.value === 1 ? "Heads" : "Tails") : h.value}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "2px 5px",
                background: "var(--panel-2)",
                borderRadius: 4,
                minWidth: 26,
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: "var(--text-dim)",
                  lineHeight: 1.2,
                }}
              >
                {h.die}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    h.die === "d2"
                      ? h.value === 1
                        ? "#f5c030"
                        : "#8898b8"
                      : "var(--text)",
                  lineHeight: 1.4,
                }}
              >
                {h.die === "d2" ? (h.value === 1 ? "H" : "T") : h.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
