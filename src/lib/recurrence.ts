const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

export interface Recurrence {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  byWeekday?: number[];
  byMonth?: number;
  byMonthDay?: number;
}

const RRULE_FREQ: Record<Recurrence["freq"], string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};
const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Monday-first weekday numbers, i.e. the 工作日 set. */
const WEEKDAYS = [1, 2, 3, 4, 5];

function rruleFields(rrule: string): Record<string, string> | null {
  const body = rrule.trim().replace(/^RRULE:/i, "");
  const fields: Record<string, string> = {};
  for (const part of body.split(";")) {
    const [key, value] = part.split("=");
    if (key && value) fields[key.trim().toUpperCase()] = value.trim();
  }
  return fields.FREQ ? fields : null;
}

function bydayCodes(byday: string | undefined): string[] {
  return byday ? RRULE_DAYS.filter((code) => byday.includes(code)) : [];
}

/**
 * RRULE -> plain Chinese, e.g. "每周一、五", "每2周", "每月15日". Custom
 * rules Dida stores would otherwise read as an opaque "自定义重复" or a raw
 * RRULE string, so unknown shapes are returned unchanged for inspection.
 */
export function formatRecurrence(rrule: string): string {
  const f = rruleFields(rrule);
  if (!f) return rrule;
  const interval = Number(f.INTERVAL ?? 1) || 1;
  switch (f.FREQ) {
    case "DAILY":
      return interval > 1 ? `每${interval}天` : "每天";
    case "WEEKLY": {
      const codes = bydayCodes(f.BYDAY);
      const names = codes.map((c) => WEEKDAY_NAMES[RRULE_DAYS.indexOf(c)]);
      const isWeekdays =
        codes.length === WEEKDAYS.length &&
        WEEKDAYS.every((d) => codes.includes(RRULE_DAYS[d]));
      if (isWeekdays)
        return interval > 1 ? `每${interval}周的工作日` : "工作日";
      if (!names.length) return interval > 1 ? `每${interval}周` : "每周";
      return interval > 1
        ? `每${interval}周的` + names.map((n) => "周" + n).join("、")
        : "每周" + names.join("、");
    }
    case "MONTHLY": {
      const base = interval > 1 ? `每${interval}个月` : "每月";
      return f.BYMONTHDAY ? base + Number(f.BYMONTHDAY) + "日" : base;
    }
    case "YEARLY": {
      const month = f.BYMONTH ? Number(f.BYMONTH) + "月" : "";
      const day = f.BYMONTHDAY ? Number(f.BYMONTHDAY) + "日" : "";
      const base = interval > 1 ? `每${interval}年` : "每年";
      return base + month + day;
    }
    default:
      return rrule;
  }
}

export function recurrenceToRRULE(r: Recurrence): string {
  let s = "RRULE:FREQ=" + RRULE_FREQ[r.freq];
  if (r.interval && r.interval > 1) s += ";INTERVAL=" + String(r.interval);
  if (r.byWeekday?.length)
    s += ";BYDAY=" + r.byWeekday.map((d) => RRULE_DAYS[d]).join(",");
  if (r.byMonth) s += ";BYMONTH=" + String(r.byMonth);
  if (r.byMonthDay) s += ";BYMONTHDAY=" + String(r.byMonthDay);
  return s;
}

/**
 * "每天" "工作日" "每3天" "每2周" "每周一" "每周一、三" "每月" "每2月"
 * "每月15日" "每年" "每年3月" "每年3月15日".
 */
export function parseRecurrence(s: string): Recurrence | null {
  const t = s.trim();
  const simple: Record<string, Recurrence> = {
    每天: { freq: "daily" },
    每周: { freq: "weekly" },
    每月: { freq: "monthly" },
    每年: { freq: "yearly" },
    工作日: { freq: "weekly", byWeekday: [1, 2, 3, 4, 5] },
  };
  if (simple[t]) return simple[t];
  let m = t.match(/^每(\d+)天$/);
  if (m) return { freq: "daily", interval: Number(m[1]) };
  m = t.match(/^每(\d+)周$/);
  if (m) return { freq: "weekly", interval: Number(m[1]) };
  m = t.match(/^每周([日一二三四五六](?:[、,，][日一二三四五六])*)$/);
  if (m) {
    const byWeekday = weekdayNumbers(m[1]);
    return byWeekday.length ? { freq: "weekly", byWeekday } : null;
  }
  m = t.match(/^每(\d+)?月(\d{1,2})[日号]$/);
  if (m) {
    const day = Number(m[2]);
    if (day < 1 || day > 31) return null;
    const rec: Recurrence = { freq: "monthly", byMonthDay: day };
    if (m[1]) rec.interval = Number(m[1]);
    return rec;
  }
  m = t.match(/^每(\d+)?月$/);
  if (m) return { freq: "monthly", interval: m[1] ? Number(m[1]) : 1 };
  m = t.match(/^每(\d+)?年(\d{1,2})月(?:(\d{1,2})[日号])?$/);
  if (m) {
    const month = Number(m[2]);
    const day = m[3] ? Number(m[3]) : undefined;
    if (month < 1 || month > 12) return null;
    if (day !== undefined && (day < 1 || day > 31)) return null;
    const rec: Recurrence = { freq: "yearly", byMonth: month };
    if (m[1]) rec.interval = Number(m[1]);
    if (day !== undefined) rec.byMonthDay = day;
    return rec;
  }
  return null;
}

/** "一、三、五" -> [1, 3, 5], deduplicated and ordered like the RRULE codes. */
function weekdayNumbers(text: string): number[] {
  const days = text
    .split(/[、,，]/)
    .map((day) => WEEKDAY_NAMES.indexOf(day as (typeof WEEKDAY_NAMES)[number]))
    .filter((day) => day >= 0);
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Next occurrence strictly after `after`. */
export function nextAfter(r: Recurrence, after: Date): Date {
  const interval = r.interval ?? 1;
  const d = new Date(after);
  if (r.freq === "daily") {
    d.setDate(d.getDate() + interval);
  } else if (r.freq === "weekly") {
    const days = r.byWeekday?.length ? r.byWeekday : [d.getDay()];
    do {
      d.setDate(d.getDate() + 1);
    } while (!days.includes(d.getDay()));
  } else if (r.freq === "monthly") {
    d.setMonth(d.getMonth() + interval);
  } else {
    d.setFullYear(d.getFullYear() + interval);
  }
  return d;
}

/**
 * Form-level recurrence kinds used by TaskFormFields.
 * `everyN` needs an interval and unit; `weeklyDays` needs weekdays;
 * `monthlyDay` needs a day of month; `custom` keeps a raw RRULE string.
 */
export type RecurrenceKind =
  | "none"
  | "daily"
  | "weekdays"
  | "weekly"
  | "weeklyDays"
  | "monthly"
  | "monthlyDay"
  | "yearly"
  | "everyN"
  | "custom";

export type RecurrenceUnit = "days" | "weeks" | "months" | "years";

const UNIT_FREQ: Record<RecurrenceUnit, string> = {
  days: "DAILY",
  weeks: "WEEKLY",
  months: "MONTHLY",
  years: "YEARLY",
};

export interface RecurrenceExtra {
  /** 0 = Sunday … 6 = Saturday. */
  weekdays?: number[];
  monthDay?: string;
  unit?: RecurrenceUnit;
}

/** Form kind + params -> RRULE string, or undefined when none. */
export function kindToRRULE(
  kind: string | undefined,
  interval?: string,
  rrule?: string,
  extra?: RecurrenceExtra,
): string | undefined {
  switch (kind) {
    case "custom": {
      const raw = rrule?.trim();
      return raw || undefined;
    }
    case "daily":
    case "weekdays":
    case "weekly":
    case "monthly":
    case "yearly": {
      const table: Record<string, Recurrence> = {
        daily: { freq: "daily" },
        weekdays: { freq: "weekly", byWeekday: [1, 2, 3, 4, 5] },
        weekly: { freq: "weekly" },
        monthly: { freq: "monthly" },
        yearly: { freq: "yearly" },
      };
      return recurrenceToRRULE(table[kind]);
    }
    case "weeklyDays": {
      const days = extra?.weekdays ?? [];
      return days.length
        ? recurrenceToRRULE({ freq: "weekly", byWeekday: days })
        : undefined;
    }
    case "monthlyDay": {
      const day = Number(extra?.monthDay);
      return day >= 1 && day <= 31
        ? "RRULE:FREQ=MONTHLY;BYMONTHDAY=" + String(day)
        : undefined;
    }
    case "everyN": {
      const unit = extra?.unit ?? "days";
      return (
        "RRULE:FREQ=" +
        UNIT_FREQ[unit] +
        ";INTERVAL=" +
        String(Number(interval) || 1)
      );
    }
    default:
      return undefined;
  }
}

/** RRULE string -> form kind and params for prefill. */
export function rruleToKind(rrule: string): {
  kind: RecurrenceKind;
  interval?: string;
  rrule?: string;
  weekdays?: number[];
  monthDay?: string;
  unit?: RecurrenceUnit;
} {
  const raw = rrule.trim();
  const freq = raw.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/)?.[1];
  const interval = raw.match(/INTERVAL=(\d+)/)?.[1];
  const byday = raw.match(/BYDAY=([A-Z,]+)/)?.[1];
  const bymonth = raw.match(/BYMONTH=(\d+)/)?.[1];
  const bymonthday = raw.match(/BYMONTHDAY=(\d+)/)?.[1];
  const repeats = Boolean(interval && interval !== "1");
  if (freq === "DAILY")
    return repeats ? { kind: "everyN", interval } : { kind: "daily" };
  if (freq === "WEEKLY") {
    if (byday) {
      const days = byday
        .split(",")
        .map((code) => RRULE_DAYS.indexOf(code))
        .filter((d) => d >= 0);
      // "every N weeks on these days" is more than one control can express.
      if (repeats) return { kind: "custom", rrule: raw };
      const isWorkWeek =
        days.length === WEEKDAYS.length &&
        WEEKDAYS.every((d) => days.includes(d));
      return isWorkWeek
        ? { kind: "weekdays" }
        : { kind: "weeklyDays", weekdays: days };
    }
    return repeats
      ? { kind: "everyN", interval, unit: "weeks" }
      : { kind: "weekly" };
  }
  if (freq === "MONTHLY") {
    if (bymonthday)
      return repeats
        ? { kind: "custom", rrule: raw }
        : { kind: "monthlyDay", monthDay: String(Number(bymonthday)) };
    return repeats
      ? { kind: "everyN", interval, unit: "months" }
      : { kind: "monthly" };
  }
  if (freq === "YEARLY") {
    // A specific month/day has no form control, so keep the rule raw here
    // instead of reopening it as a plain 每年 and losing the date.
    if (bymonth || bymonthday) return { kind: "custom", rrule: raw };
    return repeats
      ? { kind: "everyN", interval, unit: "years" }
      : { kind: "yearly" };
  }
  return { kind: "custom", rrule: raw };
}
