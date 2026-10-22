"use client";

import { useId, useState } from "react";

type Point = { key: string; label: string; value: number };

/** Chemin lissé (Catmull-Rom → Bézier) passant par tous les points. */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Courbe mensuelle adoucie (une série) avec aire dégradée verte, points, infobulle au survol
 * ou au clavier, et tableau équivalent pour les lecteurs d'écran.
 */
export function MonthLine({ data, unit, label }: { data: Point[]; unit: string; label: string }) {
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 0);
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(max, 4) / 4)));
  const step = Math.max(1, Math.ceil(Math.max(max, 4) / 4 / magnitude) * magnitude);
  const top = step * 4;
  const W = 560;
  const H = 220;
  const pad = { l: 36, r: 16, t: 22, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = smooth(pts);
  const area = `${line} L${x(data.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;
  const shown = hover ?? data.length - 1;
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <figure className="month-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} : ${total} ${unit} sur ${data.length} mois`} className="h-auto w-full overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`a${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#009543" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#009543" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`l${gid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7cc79e" />
            <stop offset="100%" stopColor="#009543" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={pad.l} x2={W - pad.r} y1={y(step * i)} y2={y(step * i)} stroke={i === 0 ? "#c8ddd3" : "#edf2ee"} strokeDasharray={i === 0 ? undefined : "3 5"} />
            <text x={pad.l - 10} y={y(step * i)} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#6b8c7b">
              {step * i}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#a${gid})`} className="month-line-area" />
        <path d={line} fill="none" stroke={`url(#l${gid})`} strokeWidth={3} strokeLinecap="round" className="month-line-path" />
        <line x1={x(shown)} x2={x(shown)} y1={pad.t} y2={y(0)} stroke="#0a1f15" strokeOpacity={0.15} strokeDasharray="4 4" />
        {data.map((d, i) => (
          <g key={d.key}>
            <circle cx={x(i)} cy={y(d.value)} r={i === shown ? 6 : 3.5} fill={i === shown ? "#009543" : "#fff"} stroke="#009543" strokeWidth={2.5} />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fontWeight={i === shown ? 700 : 500} fill={i === shown ? "#0f1a14" : "#6b8c7b"}>
              {d.label}
            </text>
            {/* Zone de survol pleine hauteur, plus large que le point. */}
            <rect
              x={x(i) - iw / data.length / 2}
              y={pad.t}
              width={iw / data.length}
              height={ih}
              fill="transparent"
              tabIndex={0}
              aria-label={`${d.label} : ${d.value} ${unit}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              className="outline-none"
            />
          </g>
        ))}
        <g pointerEvents="none">
          <rect x={Math.min(Math.max(x(shown) - 34, pad.l), W - pad.r - 68)} y={Math.max(y(data[shown].value) - 40, 0)} width={68} height={26} rx={8} fill="#0a1f15" />
          <text x={Math.min(Math.max(x(shown), pad.l + 34), W - pad.r - 34)} y={Math.max(y(data[shown].value) - 27, 13)} textAnchor="middle" dominantBaseline="middle" fontSize="12" fontWeight={700} fill="#fbde4a">
            {data[shown].value}
          </text>
        </g>
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Mois</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.label}</td>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
