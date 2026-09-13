export interface Reminder {
  /** Minutes before due date. 0 = at due time. */
  minutesBefore: number;
}

export type ReminderUnit = "minutes" | "hours" | "days";

const UNIT_MINUTES: Record<ReminderUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

/** Custom reminder input ("2" + hours) -> minutes before due. */
export function reminderAmountToMinutes(
  value: string,
  unit?: string,
): number | null {
  const raw = value.trim();
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount <= 0) return null;
  const factor = UNIT_MINUTES[unit as ReminderUnit] ?? UNIT_MINUTES.minutes;
  return Math.round(amount * factor);
}

/** Minutes before due -> the largest whole unit, for prefilling the form. */
export function splitReminderMinutes(minutes: number): {
  value: string;
  unit: ReminderUnit;
} {
  if (minutes <= 0) return { value: "", unit: "minutes" };
  for (const unit of ["days", "hours"] as ReminderUnit[]) {
    const factor = UNIT_MINUTES[unit];
    if (minutes % factor === 0)
      return { value: String(minutes / factor), unit };
  }
  return { value: String(minutes), unit: "minutes" };
}

export function reminderToTrigger(minutes: number): string {
  return minutes <= 0 ? "TRIGGER:P0D" : "TRIGGER:-PT" + String(minutes) + "M";
}

/** ISO-8601 duration after TRIGGER:, e.g. P0D / PT0S / -PT30M / -P1DT2H. */
const TRIGGER_DURATION =
  /^(-)?P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/**
 * Dida/TickTick reminder trigger -> minutes before dues. The API returns both
 * the P0D and PT0S spellings for a reminder at the due time, so accept either;
 * anything else we cannot read returns null.
 */
export function reminderTriggerToMinutes(trigger: string): number | null {
  const m = trigger.trim().match(/^TRIGGER:(.+)$/i);
  if (!m) return null;
  const d = m[1].match(TRIGGER_DURATION);
  if (!d) return null;
  const [, negative, days, hours, minutes, seconds] = d;
  const total =
    Number(days ?? 0) * 1440 +
    Number(hours ?? 0) * 60 +
    Number(minutes ?? 0) +
    Math.round(Number(seconds ?? 0) / 60);
  if (negative) return total;
  // Positive durations mean "at" (zero) or, unreleased by Dida, "after" a due
  // date; only the zero case has a meaning worth showing.
  return total === 0 ? 0 : null;
}

/** Dida trigger -> "准时" / "提前30分钟"; unknown triggers show as-is. */
export function formatReminderTrigger(trigger: string): string {
  const minutes = reminderTriggerToMinutes(trigger);
  return minutes === null
    ? trigger
    : formatReminder({ minutesBefore: minutes });
}

const UNITS: Array<[string, number]> = [
  ["分钟", 1],
  ["小时", 60],
  ["天", 1440],
];

/** "准时" → 0, "提前30分钟" → 30, "提前2小时" → 120, "提前1天" → 1440. */
export function parseReminder(s: string): Reminder | null {
  const t = s.trim();
  if (t === "准时" || t === "准时提醒") return { minutesBefore: 0 };
  const m = t.match(/^提前(\d+)(分钟|小时|天)$/);
  if (!m) return null;
  const unit = UNITS.find(([label]) => label === m[2]);
  return unit ? { minutesBefore: Number(m[1]) * unit[1] } : null;
}

export function formatReminder(r: Reminder): string {
  if (r.minutesBefore <= 0) return "准时";
  const parts = [
    [Math.floor(r.minutesBefore / 1440), "天"],
    [Math.floor((r.minutesBefore % 1440) / 60), "小时"],
    [r.minutesBefore % 60, "分钟"],
  ] as Array<[number, string]>;
  return (
    "提前" +
    parts
      .filter(([n]) => n > 0)
      .map(([n, label]) => n + label)
      .join("")
  );
}
