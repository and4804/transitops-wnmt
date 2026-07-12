import { useEffect, useState } from "react";

const NODES: [number, number][] = [
  [80, 90], [180, 60], [300, 110], [420, 70], [520, 140],
  [60, 220], [190, 190], [340, 230], [470, 260], [550, 320],
  [110, 340], [250, 380], [400, 400], [40, 470], [180, 510],
  [320, 540], [460, 500], [540, 560], [140, 630], [300, 660],
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 6], [1, 6], [2, 7], [3, 8], [4, 9],
  [5, 6], [6, 7], [7, 8], [8, 9], [5, 10], [6, 11], [7, 12], [8, 16],
  [10, 11], [11, 12], [12, 16], [9, 17], [10, 13], [11, 14], [12, 15],
  [13, 14], [14, 15], [15, 16], [16, 17], [14, 18], [15, 19], [18, 19],
];

const ROUTE_PATH = "M60,220 C150,260 160,380 250,380 S380,470 460,500 S520,540 540,560";

export default function AuthHero() {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    setAnimate(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  return (
    <svg className="auth-hero-visual" viewBox="0 0 600 720" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--auth-accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--auth-accent)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          x1={NODES[a][0]}
          y1={NODES[a][1]}
          x2={NODES[b][0]}
          y2={NODES[b][1]}
          stroke="var(--border)"
          strokeWidth="1"
        />
      ))}

      {NODES.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 3 : 2} fill="var(--text-dim)" opacity={0.6} />
      ))}

      <path d={ROUTE_PATH} fill="none" stroke="var(--auth-accent)" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 5" />

      <g>
        <circle r="14" fill="url(#nodeGlow)">
          {animate && <animateMotion dur="9s" repeatCount="indefinite" path={ROUTE_PATH} rotate="auto" />}
        </circle>
        <g transform="translate(-7,-4)">
          <rect width="14" height="8" rx="1.5" fill="var(--auth-accent)" />
          <circle cx="4" cy="9" r="1.6" fill="var(--text)" />
          <circle cx="11" cy="9" r="1.6" fill="var(--text)" />
          {animate && <animateMotion dur="9s" repeatCount="indefinite" path={ROUTE_PATH} rotate="auto" />}
        </g>
      </g>
    </svg>
  );
}
