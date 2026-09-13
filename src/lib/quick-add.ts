import type { TaskInput } from "../api/tasks.ts";
import { recurrenceToRRULE, parseRecurrence } from "./recurrence.ts";
import { reminderToTrigger } from "./reminders.ts";

export interface ParsedQuickAdd {
  title: string;
  dueDate?: Date;
  priority?: "high" | "medium" | "low";
  project?: string;
  reminders?: Array<{ minutesBefore: number }>;
  recurrence?: string;
  isAllDay: boolean;
}

export interface QuickAddMarkers {
  project: string;
  priority: string;
  date: string;
  repeat: string;
}

export const DEFAULT_MARKERS: QuickAddMarkers = {
  project: "#",
  priority: "!",
  date: "@",
  repeat: "~",
};

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PRIORITIES: Record<string, "high" | "medium" | "low"> = {
  high: "high",
  h: "high",
  高: "high",
  medium: "medium",
  med: "medium",
  m: "medium",
  中: "medium",
  low: "low",
  l: "low",
  低: "low",
};

const PRIORITY_NUM: Record<"high" | "medium" | "low", number> = {
  high: 5,
  medium: 3,
  low: 1,
};

const WEEKDAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"] as const;

interface DateMatch {
  date: Date;
  hasTime: boolean;
  raw: string;
}

/** Local Chinese relative/weekday/concrete date + time parsing. */
export function parseChineseDate(
  text: string,
  now = new Date(),
): DateMatch | null {
  // Duration: 两小时后 / 30分钟后 / 半小时后
  let m = text.match(/(两|半|(\d{1,3}))个?(小时|分钟)后/);
  if (m) {
    const n = m[1] === "两" ? 2 : m[1] === "半" ? 0.5 : Number(m[2]);
    const ms = m[3] === "小时" ? 3600000 : 60000;
    return { date: new Date(now.getTime() + n * ms), hasTime: true, raw: m[0] };
  }

  // Relative: 今天 / 明天 / 后天 / 大后天 / N天后
  m = text.match(/(今天|明天|后天|大后天|(\d+)天后)/);
  if (m) {
    const offset =
      m[1] === "今天"
        ? 0
        : m[1] === "明天"
          ? 1
          : m[1] === "后天"
            ? 2
            : m[1] === "大后天"
              ? 3
              : Number(m[2]);
    const time = parseTime(text);
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    if (time) {
      d.setHours(time.hours, time.minutes, 0, 0);
      return { date: d, hasTime: true, raw: m[0] + time.raw };
    }
    d.setHours(0, 0, 0, 0);
    return { date: d, hasTime: false, raw: m[0] };
  }

  // Weekday: 下周X / 这周X / 周X / 每周X (first occurrence)
  m = text.match(/(下|这|每)?(?:周|星期)([日一二三四五六])/);
  if (m) {
    const target = WEEKDAY_NAMES.indexOf(
      m[2] as (typeof WEEKDAY_NAMES)[number],
    );
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    let delta: number;
    if (m[1] === "下") {
      // 下周X = weekday X of next calendar week
      const toNextMonday = (8 - d.getDay()) % 7 || 7;
      delta = toNextMonday + ((target + 6) % 7);
    } else {
      delta = (target - d.getDay() + 7) % 7 || 7; // always strictly future
    }
    d.setDate(d.getDate() + delta);
    const time = parseTime(text);
    if (time) {
      d.setHours(time.hours, time.minutes, 0, 0);
      return { date: d, hasTime: true, raw: m[0] + time.raw };
    }
    return { date: d, hasTime: false, raw: m[0] };
  }

  // Concrete: X月X日(号)
  // 月底(前) → last day of current month
  m = text.match(/月底前?/);
  if (m) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    d.setHours(0, 0, 0, 0);
    return { date: d, hasTime: false, raw: m[0] };
  }

  m = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (m) {
    const d = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
    if (d.getTime() < now.getTime() - 86400000)
      d.setFullYear(d.getFullYear() + 1);
    const time = parseTime(text);
    if (time) {
      d.setHours(time.hours, time.minutes, 0, 0);
      return { date: d, hasTime: true, raw: m[0] + time.raw };
    }
    d.setHours(0, 0, 0, 0);
    return { date: d, hasTime: false, raw: m[0] };
  }

  // Time only (today, rolls to tomorrow if passed)
  const time = parseTime(text);
  if (time) {
    const d = new Date(now);
    d.setHours(time.hours, time.minutes, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return { date: d, hasTime: true, raw: time.raw };
  }

  return null;
}

interface TimeMatch {
  hours: number;
  minutes: number;
  raw: string;
}

/** "下午3点" "15:30" "3点半" "9点15分" "上午10点" "中午12点" */
function parseTime(text: string): TimeMatch | null {
  const m = text.match(
    /(上午|早上|下午|晚上|中午)?(\d{1,2})[点:：](\d{1,2})?分?/,
  );
  if (!m) return null;
  let hours = Number(m[2]);
  const minutes = m[3] ? Number(m[3]) : 0;
  const period = m[1];
  if ((period === "下午" || period === "晚上") && hours < 12) hours += 12;
  if (hours > 23 || minutes > 59) return null;
  // raw must not swallow trailing chars beyond the time expression
  return { hours, minutes, raw: m[0] };
}

/**
 * V1/V2 Quick Add syntax:
 *   #project  !high  @明天  @2024-03-15  @15:30  ~每周一  @remind提前30分钟
 * Unprefixed Chinese date phrases ("明天下午3点") are also parsed and stripped.
 */
export function parseQuickAdd(
  input: string,
  now = new Date(),
  markers: Partial<QuickAddMarkers> = {},
): ParsedQuickAdd {
  const mk = { ...DEFAULT_MARKERS, ...markers };
  let text = input.trim();
  const result: ParsedQuickAdd = { title: "", isAllDay: true };

  text = text.replace(
    new RegExp(esc(mk.project) + "(\\S+)", "g"),
    (_, name: string) => {
      result.project = name;
      return "";
    },
  );

  text = text.replace(
    new RegExp(esc(mk.priority) + "(\\S+)", "g"),
    (_, tag: string) => {
      const p = PRIORITIES[tag.toLowerCase()];
      if (p) result.priority = p;
      return "";
    },
  );

  text = text.replace(
    new RegExp(esc(mk.repeat) + "(\\S+)", "g"),
    (_, rule: string) => {
      result.recurrence = rule;
      return "";
    },
  );

  text = text.replace(
    new RegExp(esc(mk.date) + "(\\S+)", "g"),
    (_, token: string) => {
      if (token.startsWith("remind")) {
        const r = parseReminderShorthand(token.slice(6));
        if (r) {
          result.reminders = [r];
          return "";
        }
      }
      const d = parseDateToken(token, now);
      if (d) {
        result.dueDate = d.date;
        result.isAllDay = !d.hasTime;
        return "";
      }
      return mk.date + token;
    },
  );

  if (!result.dueDate) {
    const match = parseChineseDate(text, now);
    if (match) {
      result.dueDate = match.date;
      result.isAllDay = !match.hasTime;
      text = text.replace(match.raw, "");
    }
  }

  text = text.replace(/提醒我/, "");
  result.title = text.replace(/\s+/g, " ").trim();
  return result;
}

/** Direct TaskInput from one Quick Add line — the no-form path for launch arguments. */
export function quickAddToTaskInput(
  raw: string,
  projects: Array<{ id: string; name: string }>,
  now = new Date(),
  markers: Partial<QuickAddMarkers> = {},
): TaskInput {
  const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const parsed = parseQuickAdd(raw, now, markers);
  const projectName = parsed.project;
  const match = projectName
    ? projects.find(
        (p) =>
          p.name === projectName ||
          p.name.toLowerCase() === projectName.toLowerCase(),
      )
    : undefined;
  const mins = (parsed.reminders ?? []).map((r) => r.minutesBefore);
  return {
    title: parsed.title,
    projectId: match?.id,
    priority: parsed.priority ? PRIORITY_NUM[parsed.priority] : undefined,
    dueDate: parsed.dueDate?.getTime(),
    isAllDay: parsed.isAllDay,
    timeZone: parsed.dueDate && !parsed.isAllDay ? TIMEZONE : undefined,
    reminders: mins.map(reminderToTrigger),
    repeatFlag: (() => {
      const rec = parsed.recurrence ? parseRecurrence(parsed.recurrence) : null;
      return rec ? recurrenceToRRULE(rec) : undefined;
    })(),
  };
}

function parseReminderShorthand(s: string): { minutesBefore: number } | null {
  if (s === "准时" || s === "") return { minutesBefore: 0 };
  const m = s.match(/^(?:提前)?(\d+)(分钟|小时|天)/);
  if (!m) return null;
  const factor = m[2] === "分钟" ? 1 : m[2] === "小时" ? 60 : 1440;
  return { minutesBefore: Number(m[1]) * factor };
}

function parseDateToken(
  token: string,
  now: Date,
): { date: Date; hasTime: boolean } | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
    const [y, mo, d] = token.split("-").map(Number);
    return { date: new Date(y, mo - 1, d, 0, 0, 0, 0), hasTime: false };
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/.test(token)) {
    const [datePart, timePart] = token.split(/[T ]/);
    const [y, mo, d] = datePart.split("-").map(Number);
    const [h, mi] = timePart.split(":").map(Number);
    return { date: new Date(y, mo - 1, d, h, mi, 0, 0), hasTime: true };
  }
  if (/^\d{1,2}:\d{2}$/.test(token)) {
    const [h, mi] = token.split(":").map(Number);
    const d = new Date(now);
    d.setHours(h, mi, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return { date: d, hasTime: true };
  }
  const inner = parseChineseDate(token, now);
  if (inner) return { date: inner.date, hasTime: inner.hasTime };
  return null;
}
