import { addDays, differenceInCalendarWeeks, formatISO, startOfWeek } from "date-fns";

export const ymd = (d: Date) => formatISO(d, { representation: "date" });

export const parseYmd = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayYmd = () => ymd(new Date());

// Timezone-aware YYYY-MM-DD via Intl (no extra deps). en-CA gives ISO ordering.
const ymdFormatCache = new Map<string, Intl.DateTimeFormat>();
function ymdFormatter(tz: string): Intl.DateTimeFormat {
  let f = ymdFormatCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    ymdFormatCache.set(tz, f);
  }
  return f;
}

export const ymdInTimeZone = (d: Date, tz: string): string =>
  ymdFormatter(tz).format(d);

export const todayInTimeZone = (tz: string): string =>
  ymdFormatter(tz).format(new Date());

export function nowInTimeZone(tz: string): {
  hour: number;
  minute: number;
  wallClock: string;
  weekdayIndex: number; // 0=Mon..6=Sun (matches weekStartsOn:1)
} {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
    timeZone: tz,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const weekdayShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  return {
    hour,
    minute,
    wallClock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    weekdayIndex: map[weekdayShort] ?? 0,
  };
}

export const weekStart = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });

export const weekDays = (anchor: Date) => {
  const start = weekStart(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const weeksUntil = (targetYmd: string): number => {
  const target = parseYmd(targetYmd);
  const diff = differenceInCalendarWeeks(target, new Date(), { weekStartsOn: 1 });
  return Math.max(0, diff);
};

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * ISO-week tag ('2026-W33') — used as a dedupe key for weekly emails and
 * as a rotation seed for the featured trail. Same input → same tag.
 */
export function isoWeekTag(now: Date): string {
  const target = new Date(now.valueOf());
  const dayNr = (target.getUTCDay() + 6) % 7; // Mon = 0
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const weekNo =
    1 +
    Math.round(
      ((target.getTime() - firstThu.getTime()) / 86_400_000 -
        3 +
        ((firstThu.getUTCDay() + 6) % 7)) /
        7,
    );
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
