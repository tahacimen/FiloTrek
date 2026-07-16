/**
 * Pure date math for the dock reservation weekly calendar — no library
 * (date-fns/dayjs/react-big-calendar aren't in this project, and adding one
 * for a single 7-day grid isn't worth it). Runs on both server (to compute
 * the fetch window) and client (to lay out the grid), so it has no "use
 * client"/"use server" directive and no I/O.
 */

export const DAY_LABELS = [
  "Pazar",
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
] as const;

export type DockWorkingHourRow = {
  dayOfWeek: number; // 0=Pazar..6=Cumartesi, matches JS Date.getDay()
  isOpen: boolean;
  openTime: string; // "HH:mm"
  closeTime: string; // "HH:mm"
};

export type WeekDay = {
  date: Date; // local midnight
  dayOfWeek: number;
  label: string;
};

export type WeekGridCell = {
  dayIndex: number; // index into days[] (0=Monday..6=Sunday, display order)
  timeLabel: string; // "09:00"
  start: Date;
  end: Date;
  isOpen: boolean;
};

/** Monday 00:00:00 local time of the week containing `date` — display order starts Monday regardless of the 0=Pazar dayOfWeek storage convention. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const jsDay = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function buildWeekGrid(
  weekStart: Date,
  workingHours: DockWorkingHourRow[],
  slotDurationMinutes: number
): { days: WeekDay[]; timeRows: string[]; cells: WeekGridCell[] } {
  const hoursByDay = new Map(workingHours.map((row) => [row.dayOfWeek, row]));

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const dayOfWeek = date.getDay();
    return { date, dayOfWeek, label: DAY_LABELS[dayOfWeek] };
  });

  // Union of every open day's slot-start minutes-of-day, so the grid has one
  // shared row axis instead of each day scrolling independently.
  const rowMinutes = new Set<number>();
  for (const day of days) {
    const hours = hoursByDay.get(day.dayOfWeek);
    if (!hours?.isOpen) continue;
    const openMin = parseTime(hours.openTime);
    const closeMin = parseTime(hours.closeTime);
    for (let t = openMin; t + slotDurationMinutes <= closeMin; t += slotDurationMinutes) {
      rowMinutes.add(t);
    }
  }
  const sortedMinutes = Array.from(rowMinutes).sort((a, b) => a - b);
  const timeRows = sortedMinutes.map(minutesToLabel);

  const cells: WeekGridCell[] = [];
  days.forEach((day, dayIndex) => {
    const hours = hoursByDay.get(day.dayOfWeek);
    for (const minutes of sortedMinutes) {
      const start = new Date(day.date);
      start.setMinutes(start.getMinutes() + minutes);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + slotDurationMinutes);

      const openMin = hours ? parseTime(hours.openTime) : 0;
      const closeMin = hours ? parseTime(hours.closeTime) : 0;
      const isOpen =
        !!hours?.isOpen && minutes >= openMin && minutes + slotDurationMinutes <= closeMin;

      cells.push({ dayIndex, timeLabel: minutesToLabel(minutes), start, end, isOpen });
    }
  });

  return { days, timeRows, cells };
}

/**
 * Total number of bookable slots across [rangeStart, rangeEnd) — the
 * report page's denominator for occupancy %. Same day-by-day open/close
 * math as buildWeekGrid above, generalized to an arbitrary span (a report's
 * date range, not necessarily aligned to a week) rather than exactly 7 days.
 */
export function countOpenSlotsInRange(
  workingHours: DockWorkingHourRow[],
  slotDurationMinutes: number,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const hoursByDay = new Map(workingHours.map((row) => [row.dayOfWeek, row]));
  let count = 0;
  let cursor = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    rangeStart.getDate()
  );
  while (cursor < rangeEnd) {
    const hours = hoursByDay.get(cursor.getDay());
    if (hours?.isOpen) {
      const openMin = parseTime(hours.openTime);
      const closeMin = parseTime(hours.closeTime);
      for (let t = openMin; t + slotDurationMinutes <= closeMin; t += slotDurationMinutes) {
        count++;
      }
    }
    cursor = addDays(cursor, 1);
  }
  return count;
}

/** "2026-08-03" (local date, no time) — used as the ?week= search param. */
export function toWeekParam(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseWeekParam(param: string | undefined): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [y, m, d] = param.split("-").map(Number);
    return getWeekStart(new Date(y, m - 1, d));
  }
  return getWeekStart(new Date());
}
