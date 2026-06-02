import { useEffect } from "react";
import type { Widget } from "@renderer/plugins/registry";
import { DiceRoller } from "./DiceRoller";

// Inject CSS animations once per page load
let cssInjected = false;
function ensureCss() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    /* d6 landing rotations: 3 full spins + face-specific offset */
    @keyframes d6-spin-1 { 0%{transform:rotateX(0)rotateY(0)} 100%{transform:rotateX(1080deg)rotateY(1080deg)} }
    @keyframes d6-spin-2 { 0%{transform:rotateX(0)rotateY(0)} 100%{transform:rotateX(1080deg)rotateY(990deg)} }
    @keyframes d6-spin-3 { 0%{transform:rotateX(0)rotateY(0)} 100%{transform:rotateX(1170deg)rotateY(1080deg)} }
    @keyframes d6-spin-4 { 0%{transform:rotateX(0)rotateY(0)} 100%{transform:rotateX(990deg)rotateY(1080deg)} }
    @keyframes d6-spin-5 { 0%{transform:rotateX(0)rotateY(0)} 100%{transform:rotateX(1080deg)rotateY(1170deg)} }
    @keyframes d6-spin-6 { 0%{transform:rotateX(0)rotateY(0)} 100%{transform:rotateX(1080deg)rotateY(1260deg)} }

    /* SVG dice tumble (2 full spins with bounce easing) */
    @keyframes svg-roll {
      0%   { transform: rotate(0deg)   scale(1);    }
      20%  { transform: rotate(180deg) scale(0.85); }
      40%  { transform: rotate(360deg) scale(1);    }
      60%  { transform: rotate(540deg) scale(0.88); }
      80%  { transform: rotate(630deg) scale(0.93); }
      90%  { transform: rotate(660deg) scale(0.97); }
      100% { transform: rotate(720deg) scale(1);    }
    }

    /* Coin flip: heads=1800° (0° mod), tails=1980° (180° mod) */
    @keyframes coin-flip-heads { 0%{transform:rotateY(0)} 100%{transform:rotateY(1800deg)} }
    @keyframes coin-flip-tails { 0%{transform:rotateY(0)} 100%{transform:rotateY(1980deg)} }

    /* Result number pop-in */
    @keyframes result-pop {
      0%   { transform: scale(0.4); opacity: 0; }
      65%  { transform: scale(1.25); opacity: 1; }
      100% { transform: scale(1);    opacity: 1; }
    }
  `;
  document.head.appendChild(el);
}

const widget: Widget = {
  manifest: {
    id: "fidget-widget",
    name: "Fidget",
    description: "Quick micro-tools: animated dice roller with d2 coin flip",
    version: "0.1.0",
    icon: "🎲",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 5 },
  },
  Component(_props) {
    useEffect(() => {
      ensureCss();
    }, []);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <DiceRoller />
      </div>
    );
  },
};

export default widget;
