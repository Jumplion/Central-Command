import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

const FLIP_DURATION = 1400;

type CoinSide = 'heads' | 'tails';

function CoinVisual({ result, flipping }: { result: CoinSide | null; flipping: boolean }) {
  const coinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flipping || !coinRef.current || result === null) return;
    const el = coinRef.current;
    el.style.animation = 'none';
    void el.offsetHeight;
    // heads: lands at 1800° (5×360 = 0° mod 360 → front)
    // tails: lands at 1980° (5.5×360 = 180° mod 360 → back)
    el.style.animation = `coin-flip-${result} ${FLIP_DURATION}ms cubic-bezier(0.25,0.1,0.25,1) forwards`;
  }, [flipping, result]);

  const size = 96;

  const faceBase: CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  };

  return (
    <div style={{ perspective: 400, width: size, height: size, margin: 'auto' }}>
      <div
        ref={coinRef}
        style={{
          width: size,
          height: size,
          position: 'relative',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Heads — front */}
        <div
          style={{
            ...faceBase,
            background: 'radial-gradient(circle at 38% 35%, #f5d060, #c8960a)',
            border: '3px solid #a07820',
            boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.3)',
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 800, color: '#7a5000', letterSpacing: -1, userSelect: 'none' }}>
            H
          </span>
        </div>
        {/* Tails — back */}
        <div
          style={{
            ...faceBase,
            background: 'radial-gradient(circle at 38% 35%, #c8d4e8, #7888a8)',
            border: '3px solid #607090',
            boxShadow: 'inset 0 -3px 6px rgba(0,0,0,0.3)',
            transform: 'rotateY(180deg)',
          }}
        >
          <span style={{ fontSize: 30, fontWeight: 800, color: '#3a4f6e', letterSpacing: -1, userSelect: 'none' }}>
            T
          </span>
        </div>
      </div>
    </div>
  );
}

export function Coin() {
  const [flipping, setFlipping] = useState(false);
  const [result, setResult] = useState<CoinSide | null>(null);
  const [history, setHistory] = useState<CoinSide[]>([]);

  const handleFlip = () => {
    if (flipping) return;
    const r: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
    setResult(r);
    setFlipping(true);
    setTimeout(() => {
      setFlipping(false);
      setHistory(prev => [r, ...prev].slice(0, 16));
    }, FLIP_DURATION + 80);
  };

  const heads = history.filter(h => h === 'heads').length;
  const tails = history.length - heads;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      {/* Coin — click to flip */}
      <div
        onClick={handleFlip}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 110,
          cursor: flipping ? 'default' : 'pointer',
        }}
      >
        <CoinVisual result={result} flipping={flipping} />
      </div>

      {/* Result */}
      <div style={{ textAlign: 'center', height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {flipping
          ? <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>flipping…</span>
          : result !== null && (
            <span
              key={`${result}-${history.length}`}
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: result === 'heads' ? '#f5c030' : '#8898b8',
                display: 'inline-block',
                animation: 'result-pop 0.25s ease-out',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {result}
            </span>
          )
        }
      </div>

      {/* Flip button */}
      <button
        onClick={handleFlip}
        disabled={flipping}
        style={{
          padding: '7px 0',
          background: flipping ? 'transparent' : 'var(--accent)20',
          border: `1px solid ${flipping ? 'var(--border)' : 'var(--accent)50'}`,
          borderRadius: 6,
          color: flipping ? 'var(--text-dim)' : 'var(--accent)',
          cursor: flipping ? 'default' : 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {flipping ? '…' : 'Flip Coin'}
      </button>

      {/* Stats */}
      {history.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: '#f5c030', fontWeight: 600 }}>H: {heads}</span>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
          <span style={{ fontSize: 11, color: '#8898b8', fontWeight: 600 }}>T: {tails}</span>
          {history.length >= 4 && (
            <>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>·</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {Math.round((heads / history.length) * 100)}% H
              </span>
            </>
          )}
        </div>
      )}

      {/* History dots */}
      {history.length > 0 && (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'center', flexWrap: 'wrap' }}>
          {history.map((h, i) => (
            <div
              key={i}
              title={h}
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: h === 'heads'
                  ? 'radial-gradient(circle at 38% 35%, #f5d060, #c8960a)'
                  : 'radial-gradient(circle at 38% 35%, #c8d4e8, #7888a8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: h === 'heads' ? '#7a5000' : '#3a4f6e',
                flexShrink: 0,
              }}
            >
              {h === 'heads' ? 'H' : 'T'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
