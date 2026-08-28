import { useId } from 'react';

interface LinePoint {
  x: number;
  y: number;
}

function smoothPath(points: LinePoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const midX = (prev.x + cur.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${cur.y}, ${cur.x} ${cur.y}`;
  }
  return d;
}

export function LineChart({
  data,
  labels,
  height = 180,
  valueFmt = (v: number) => String(v),
  color = '#0284c7',
}: {
  data: Array<number | null>;
  labels: string[];
  height?: number;
  valueFmt?: (v: number) => string;
  color?: string;
}) {
  const gid = useId();
  const W = 600;
  const H = 220;
  const PAD_X = 8;
  const PAD_TOP = 14;
  const PAD_BOTTOM = 22;
  const values = data.map((v, i) => (v == null ? null : ({ i, v }))).filter((x): x is { i: number; v: number } => x !== null);
  if (values.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-slate-400">
        Pas encore de données
      </div>
    );
  }
  const min = Math.min(...values.map((p) => p.v), 0);
  const max = Math.max(...values.map((p) => p.v), 1);
  const span = max - min || 1;
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points: Array<{ i: number; x: number; y: number; v: number }> = values.map((p) => ({
    ...p,
    x: PAD_X + p.i * stepX,
    y: PAD_TOP + innerH - ((p.v - min) / span) * innerH,
  }));
  const path = smoothPath(points);

  const gridY = [0, 0.5, 1].map((f) => {
    const y = PAD_TOP + innerH - f * innerH;
    const labelV = min + f * span;
    return { y, labelV };
  });

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ height }} className="w-full">
        <defs>
          <linearGradient id={`${gid}-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridY.map((g) => (
          <g key={g.y}>
            <line x1={PAD_X} x2={W - PAD_X} y1={g.y} y2={g.y} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={PAD_X} y={g.y - 3} fontSize="9" fill="#94a3b8">
              {valueFmt(g.labelV)}
            </text>
          </g>
        ))}
        <path d={`M ${PAD_X} ${PAD_TOP + innerH} L ${W - PAD_X} ${PAD_TOP + innerH} L ${points[points.length - 1].x} ${points[points.length - 1].y} L ${points[0].x} ${points[0].y} Z`} fill={`url(#${gid}-grad)`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
        {points.map((p) => (
          <g key={p.i}>
            <circle cx={p.x} cy={p.y} r="3" fill={color} />
            <title>{labels[p.i] ?? ''} — {valueFmt(p.v)}</title>
          </g>
        ))}
        {data.map((v, i) =>
          v == null ? null : (
            <text key={i} x={PAD_X + i * stepX} y={H - 6} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {labels[i] ?? ''}
            </text>
          ),
        )}
      </svg>
    </div>
  );
}

export function BarChart({
  data,
  labels,
  height = 180,
  color = '#0284c7',
}: {
  data: number[];
  labels: string[];
  height?: number;
  color?: string;
}) {
  if (data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-slate-400">
        Pas encore de données
      </div>
    );
  }
  const W = 600;
  const H = 220;
  const PAD = 6;
  const max = Math.max(...data, 1);
  const stepX = W / data.length;
  const barW = Math.max(10, stepX * 0.55);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ height }} className="w-full">
      {data.map((v, i) => {
        const barH = (v / max) * (H - 30);
        return (
          <g key={i}>
            <rect x={PAD + i * stepX + (barW / 2)} y={H - 18 - barH} width={barW} height={barH} rx="3" fill={color} fillOpacity={0.85}>
              <title>{labels[i] ?? ''} — {v}</title>
            </rect>
            <text x={PAD + i * stepX + barW / 2 + barW / 2} y={H - 6} fontSize="9" fill="#94a3b8" textAnchor="middle">
              {labels[i] ?? ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  value,
  total,
  label,
  color,
}: {
  value: number;
  total: number;
  label: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const R = 40;
  const C = 2 * Math.PI * R;
  const fill = color ?? (pct >= 0.7 ? '#10b981' : pct >= 0.4 ? '#f59e0b' : '#ef4444');
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 100 100" className="h-24 w-24">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={fill}
          strokeWidth="10"
          strokeDasharray={`${C * pct} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fontSize="16" fontWeight="700" fill="#0f172a">
          {Math.round(pct * 100)}
        </text>
      </svg>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}