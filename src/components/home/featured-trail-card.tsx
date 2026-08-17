import Link from "next/link";
import { requireOnboardedUser } from "@/lib/data";
import { isoWeekTag } from "@/lib/date";
import { pickFeaturedTrail } from "@/lib/notifications/featured-trail";
import { VERDICT_COLOR, VERDICT_LABEL } from "@/lib/basecamp/trail-assessment";

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

  return (
    <Link
      href={`/trails/preset/${preset.slug}`}
      className="block rounded-lg border border-blue-500/30 bg-blue-950/10 shadow-lg shadow-blue-500/10 p-5 space-y-3 hover:border-blue-400/60 transition"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-blue-400">
          [FEATURED · THIS WEEK]
        </div>
        <div className="text-[10px] text-muted">for Class {hikerClass}</div>
      </div>
      <div>
        <h3 className="text-lg font-semibold leading-tight">{preset.name}</h3>
        <div className="text-xs text-muted mt-0.5">{preset.region}</div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          <span className="text-foreground tabular-nums">
            {preset.distanceKm}
          </span>{" "}
          km
        </span>
        <span>
          <span className="text-foreground tabular-nums">
            +{preset.elevationGainFt.toLocaleString()}
          </span>{" "}
          ft
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
    </Link>
  );
}
