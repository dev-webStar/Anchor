import { cn } from "@/lib/cn";

/*
  A reseller network drawn as a transit map: the company is the terminal,
  each region is a line, each seller a station. Lines draw in once on load.
*/

export type MapLine = { name: string; stations: { name: string; value?: string }[] };

const COLORS = ["#f2b300", "#1e3557", "#2f7d52", "#6b5a8e", "#d23f27"];
// y of each line's straight run, in drawing order (centre, up, down, further up, further down)
const LANES = [245, 147, 343, 62, 428];

export function NetworkMap({
  hub,
  lines,
  className,
  animate = true,
  maxStations = 4,
}: {
  hub: string;
  lines: MapLine[];
  className?: string;
  animate?: boolean;
  maxStations?: number;
}) {
  const W = 760;
  const shown = lines.slice(0, 5);
  const H = shown.length > 3 ? 490 : 420;
  const hx = 96;
  const hy = 245;
  const lanes = shown.length > 3 ? LANES : LANES.map((y) => y - 35);
  const maxDy = Math.max(0, ...shown.map((_, i) => Math.abs(lanes[i] - (shown.length > 3 ? hy : hy - 35))));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label={`Network map of ${hub}`}>
      {shown.map((line, i) => {
        const y = lanes[i];
        const cy = shown.length > 3 ? hy : hy - 35;
        const dy = Math.abs(y - cy);
        const bendX = hx + 46 + dy; // 45° diagonal from the hub to the lane
        const d = `M ${hx} ${cy} L ${hx + 46} ${cy} L ${bendX} ${y} L ${W - 30} ${y}`;
        const stations = line.stations.slice(0, maxStations);
        const more = line.stations.length - stations.length;
        const startX = hx + 46 + Math.max(98, maxDy) + 92; // same start for every line, clear of all diagonals
        const gap = stations.length > 1 ? (W - 70 - startX) / (stations.length - 1) : 0;
        const below = y > cy;
        const color = COLORS[i % COLORS.length];
        return (
          <g key={line.name}>
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              className={animate ? "animate-draw" : undefined}
              style={{ ["--len" as string]: 1, animationDelay: `${i * 160}ms` }}
            />
            <text x={y === cy ? hx + 46 + 112 : bendX + 8} y={y + (below ? -18 : 32)} className="fill-ink-3 text-[12px] font-bold">
              {line.name}
              {more > 0 ? ` · +${more}` : ""}
            </text>
            {stations.map((s, k) => {
              const x = startX + gap * k;
              const up = y === cy ? k % 2 === 0 : !below;
              return (
                <g key={s.name + k} className={animate ? "animate-pop" : undefined} style={{ animationDelay: `${700 + i * 160 + k * 90}ms`, transformOrigin: `${x}px ${y}px` }}>
                  <circle cx={x} cy={y} r={10} fill="#fbfbf8" stroke={color} strokeWidth={5} />
                  <text x={x} y={up ? y - 24 : y + 36} textAnchor="middle" className="fill-ink text-[14px] font-bold">
                    {s.name}
                  </text>
                  {s.value && (
                    <text x={x} y={up ? y - 42 : y + 54} textAnchor="middle" className="num fill-ink-2 text-[12px]">
                      {s.value}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
      {/* terminal */}
      <g transform={`translate(0 ${shown.length > 3 ? 0 : -35})`}>
        <rect x={hx - 40} y={hy - 40} width={80} height={80} rx={18} fill="#16181b" />
        <rect x={hx - 32} y={hy - 32} width={64} height={64} rx={13} fill="none" stroke="#fbfbf8" strokeOpacity={0.35} />
        <text x={hx} y={hy + 9} textAnchor="middle" className="fill-paper font-mincho text-[30px] font-extrabold">
          {hub.trim()[0]?.toUpperCase() ?? "A"}
        </text>
        <text x={hx} y={hy + 64} textAnchor="middle" className="fill-ink text-[13px] font-black">
          {hub.length > 18 ? hub.slice(0, 17) + "…" : hub}
        </text>
      </g>
    </svg>
  );
}
