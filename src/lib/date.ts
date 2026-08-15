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
