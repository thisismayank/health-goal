import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data";
import { isoWeekTag } from "@/lib/date";
import { pickFeaturedTrail } from "@/lib/notifications/featured-trail";
import { generateFeaturedNarrative } from "@/lib/coach/featured-narrative";
import { VERDICT_COLOR, VERDICT_LABEL } from "@/lib/basecamp/trail-assessment";
import { TrailIcon } from "@/components/ui/icons";
import { formatFt, formatKm, pickUnits } from "@/lib/units";
import { TrailPhoto } from "@/components/trails/trail-photo";

// In-app companion to the Monday featured-trail email. Same pick logic
// so email + home show the same trail all week.
//
// Server component — fetches its own data. Home wraps in Suspense so
// the pick (~1s including assessment) doesn't block the initial render.
export async function FeaturedTrailCard() {
  const user = await requireOnboardedUser();
  const weekTag = isoWeekTag(new Date());
  const payload = await pickFeaturedTrail(user, weekTag);
  if (!payload) return null;

  const { preset, verdict, hikerClass, hikerClassLabel } = payload;
  const verdictColor = VERDICT_COLOR[verdict];
  const verdictLabel = VERDICT_LABEL[verdict];
  const units = pickUnits(user);
  const narrative = await generateFeaturedNarrative({
    userId: user.id,
    hikerClass,
    preset,
    weekTag,
  });

  return (
    <Link
      href={`/trails/preset/${preset.slug}`}
      className="block rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 overflow-hidden hover:border-blue-400/60 transition"
    >
      <div className="relative">
        <TrailPhoto preset={preset} aspect="wide" />
        <div className="absolute inset-x-0 top-0 p-3 flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-blue-300 bg-black/40 backdrop-blur px-2 py-0.5 rounded">
            <TrailIcon size={12} />
            Featured this week
          </div>
          <div className="text-[10px] text-white/70 bg-black/40 backdrop-blur px-2 py-0.5 rounded">
            for Class {hikerClass}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-lg font-semibold leading-tight text-white drop-shadow-lg">
            {preset.name}
          </h3>
          <div className="text-xs text-white/70 mt-0.5 drop-shadow">
            {preset.region}
          </div>
        </div>
      </div>
      <div className="p-4 pt-3 space-y-3">
      {narrative && (
        <div className="rounded-md border border-blue-500/20 bg-background/40 p-3 space-y-1.5">
          <div className="text-sm font-medium leading-snug">
            {narrative.hook}
          </div>
          <p className="text-xs text-muted leading-relaxed">{narrative.why}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span className="text-foreground tabular-nums">
          {formatKm(preset.distanceKm, units)}
        </span>
        <span className="text-foreground tabular-nums">
          +{formatFt(preset.elevationGainFt, units)}
        </span>
        <span>
          ~
          <span className="text-foreground tabular-nums">
            {preset.typicalHours}
          </span>
          h
        </span>
        <span>{preset.terrainGrade}</span>
      </div>
      <div className="pt-2 border-t border-panel-border flex items-baseline justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted">
            For you · {hikerClassLabel}
          </div>
          <div className={`text-sm font-medium ${verdictColor}`}>
            {verdictLabel}
          </div>
        </div>
        <span className="text-xs text-blue-300 whitespace-nowrap">
          See it →
        </span>
      </div>
      </div>
    </Link>
  );
}
