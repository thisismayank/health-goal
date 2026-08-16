import Link from "next/link";
import { getCurrentUser } from "@/lib/data";
import { computeCharacterSheet, currentStreakFromSheet } from "@/lib/basecamp/stats";
import { computeRank } from "@/lib/basecamp/rank";

export async function RankChip() {
  const user = await getCurrentUser();
  if (!user) return null;
  const sheet = await computeCharacterSheet(user.id);
  const rank = computeRank(sheet);
  const streak = currentStreakFromSheet(sheet);

  return (
    <Link
      href="/character"
      className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-950/20 px-2.5 py-1 text-xs shrink-0 hover:border-blue-500/60 transition"
      title={`${rank.currentLabel} · ${streak}-day streak`}
    >
      <span className="font-mono font-semibold text-blue-300 text-sm leading-none">
        {rank.current}
      </span>
      <span className="text-blue-500/50">·</span>
      <span className="tabular-nums text-muted">{streak}</span>
    </Link>
  );
}

export function RankChipSkeleton() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-panel-border px-2.5 py-1 text-xs shrink-0">
      <span className="font-mono text-muted animate-pulse">–</span>
    </div>
  );
}
