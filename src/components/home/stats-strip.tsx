import Link from "next/link";
import { computeCharacterSheet, type StatKey } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";

export async function StatsStrip({
  userId,
  highlightStats = [],
}: {
  userId: number;
  highlightStats?: StatKey[];
}) {
  const sheet = await computeCharacterSheet(userId);
  const rank = computeRank(sheet);
  const order: StatKey[] = ["STR", "END", "POW", "REC", "WILL"];
  const highlightSet = new Set(highlightStats);

  return (
    <Link
      href="/progress"
      className="block rounded-lg border border-panel-border bg-panel/60 p-3 hover:border-blue-500/40 transition"
    >
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted">
          Class <span className="text-blue-300 font-mono">{rank.current}</span>
          <span className="ml-1.5 text-muted normal-case tracking-normal">
            · {rank.currentLabel}
          </span>
        </div>
        {rank.nextRank && (
          <div className="text-[10px] text-muted tabular-nums">
            {rank.progressPct}% → {rank.nextRank}
          </div>
        )}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {order.map((k) => {
          const s = sheet.stats[k];
          const highlighted = highlightSet.has(k);
          const tone =
            s.value >= 70
              ? "text-blue-300"
              : s.value >= 40
                ? "text-foreground"
                : "text-muted";
          const bar =
            s.value >= 70
              ? "bg-blue-400"
              : s.value >= 40
                ? "bg-blue-500/60"
                : "bg-blue-500/30";
          return (
            <div
              key={k}
              className={`space-y-1 rounded px-1 py-0.5 -mx-1 ${highlighted ? "cascade-highlight" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[9px] font-mono uppercase tracking-wider text-muted">
                  {k}
                </span>
                <span
                  className={`text-xs font-mono font-semibold tabular-nums ${s.hasEnoughData ? tone : "text-muted"}`}
                  title={
                    s.hasEnoughData
                      ? undefined
                      : "Not enough data yet — connect a source or log more."
                  }
                >
                  {s.hasEnoughData ? s.value : "—"}
                </span>
              </div>
              <div className="h-1 bg-panel-border rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${bar} ${highlighted ? "cascade-fill" : ""}`}
                  style={{
                    width: s.hasEnoughData
                      ? `${Math.max(2, s.value)}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}
