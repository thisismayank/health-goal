import Image from "next/image";
import type { TrailPreset } from "@/lib/basecamp/trail-library";

// Minimal shape TrailPhoto needs. Accepting this (instead of a full
// TrailPreset) lets us render destination tiles on /trails/discover
// with the same component, using a synthetic slug for the hash seed
// and a default terrain grade for the fallback tint.
export type PhotoSubject = Pick<
  TrailPreset,
  "name" | "photoUrl" | "photoAttribution" | "terrainGrade" | "slug"
>;

/**
 * Hero photo for a trail card/panel. When the preset has a
 * `photoUrl`, uses next/image with fill + cover. When it doesn't,
 * renders a topo-line SVG fallback tinted by the trail's terrain
 * grade so the card still has visual weight — better than a gray
 * placeholder and consistent with the expedition-tool aesthetic.
 *
 * `aspect` controls the container ratio. Cards use "card" (3:2),
 * detail-page top-bands use "wide" (16:6), hero grid uses "tile"
 * (4:3). Alt text falls back to the trail name.
 */
type Aspect = "card" | "wide" | "tile" | "square";

const ASPECT_CLASS: Record<Aspect, string> = {
  card: "aspect-[3/2]",
  wide: "aspect-[16/6]",
  tile: "aspect-[4/3]",
  square: "aspect-square",
};

export function TrailPhoto({
  preset,
  aspect = "card",
  showAttribution = false,
  priority = false,
  className = "",
}: {
  preset: PhotoSubject;
  aspect?: Aspect;
  showAttribution?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const cls = `relative w-full overflow-hidden ${ASPECT_CLASS[aspect]} ${className}`;

  if (preset.photoUrl) {
    return (
      <div className={cls}>
        <Image
          src={preset.photoUrl}
          alt={preset.name}
          fill
          priority={priority}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover"
        />
        {/* Subtle bottom-gradient so overlaid text is readable when a
            card renders name/metrics on top of the image. */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {showAttribution && preset.photoAttribution && (
          <div className="absolute bottom-1.5 right-2 text-[9px] text-white/60 font-mono">
            {preset.photoAttribution}
          </div>
        )}
      </div>
    );
  }

  return <TopoFallback preset={preset} className={cls} />;
}

// SVG topographic-line fallback. Tinted by terrain grade so a
// mountaineering trail feels different from a moderate one at a
// glance. Slug is hashed to seed the wave phase so different trails
// get visually distinct patterns without needing an image asset.
function TopoFallback({
  preset,
  className,
}: {
  preset: Pick<TrailPreset, "name" | "terrainGrade" | "slug">;
  className: string;
}) {
  const palette = TERRAIN_PALETTE[preset.terrainGrade] ?? TERRAIN_PALETTE.moderate;
  const seed = hashSeed(preset.slug);

  // 8 stacked wavy paths at descending y, each phase-shifted by seed.
  // Amplitude taller for higher-terrain-grade so mountaineering feels
  // more dramatic than easy.
  const amplitude = ({
    easy: 8,
    moderate: 12,
    hard: 18,
    technical: 24,
    mountaineering: 30,
  } as const)[preset.terrainGrade];
  const layers = Array.from({ length: 7 }, (_, i) => {
    const y = 30 + i * 12;
    const phase = seed + i * 0.7;
    const points: string[] = [];
    for (let x = 0; x <= 100; x += 5) {
      const yOff = Math.sin((x / 100) * Math.PI * 2 * 1.5 + phase) * amplitude;
      points.push(`${x},${(y + yOff).toFixed(1)}`);
    }
    return points.join(" ");
  });

  return (
    <div
      className={`${className} ${palette.bg}`}
      role="img"
      aria-label={`${preset.name} — no photo available`}
    >
      <svg
        viewBox="0 0 100 120"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        {/* Contour lines — cheap illusion of topography. */}
        {layers.map((pts, i) => (
          <polyline
            key={i}
            points={pts}
            fill="none"
            stroke={palette.stroke}
            strokeOpacity={0.35 - i * 0.02}
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Peak silhouette — a triangle at the horizon line so the
            card reads as "mountain," not "abstract pattern." */}
        <polygon
          points="15,60 40,25 55,45 68,20 88,60 100,60 100,120 0,120 0,60"
          fill={palette.silhouette}
          opacity={0.55}
        />
      </svg>
      {/* Terrain-grade label bottom-right so the fallback still
          carries information density. */}
      <div className="absolute bottom-1.5 right-2 text-[9px] font-mono uppercase tracking-widest text-white/40">
        {preset.terrainGrade}
      </div>
    </div>
  );
}

const TERRAIN_PALETTE: Record<
  string,
  { bg: string; stroke: string; silhouette: string }
> = {
  easy: {
    bg: "bg-gradient-to-br from-emerald-950 to-emerald-900",
    stroke: "#78c47a",
    silhouette: "#0f2818",
  },
  moderate: {
    bg: "bg-gradient-to-br from-blue-950 to-slate-900",
    stroke: "#6ea8d4",
    silhouette: "#0a1a2e",
  },
  hard: {
    bg: "bg-gradient-to-br from-amber-950 to-stone-900",
    stroke: "#d4a76e",
    silhouette: "#2a1a0a",
  },
  technical: {
    bg: "bg-gradient-to-br from-orange-950 to-stone-950",
    stroke: "#d47f6e",
    silhouette: "#2a120a",
  },
  mountaineering: {
    bg: "bg-gradient-to-br from-slate-950 to-neutral-950",
    stroke: "#c8ccd4",
    silhouette: "#050505",
  },
};

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h & 0xffff) / 0xffff) * Math.PI * 2;
}
