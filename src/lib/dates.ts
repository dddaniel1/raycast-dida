export function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Accepts "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" (local time). */
export function parseDate(s: string): Date {
  const [datePart, timePart] = s.trim().split(" ");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h = 0, min = 0] = timePart ? timePart.split(":").map(Number) : [];
  return new Date(y, m - 1, d, h, min);
}

const WEEKDAYS = [
  "周日",
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
] as const;

export function formatRelative(d: Date, now = new Date()): string {
  const days = Math.round(
    (startOfDay(d).getTime() - startOfDay(now).getTime()) / 86400000,
  );
  if (days === 0) return "今天";
  if (days === 1) return "明天";
  if (days === 2) return "后天";
  if (days > 2 && days <= 7) return `${days}天后`;
  const time =
    d.getHours() || d.getMinutes()
      ? ` ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      : "";
  return `${d.getMonth() + 1}月${d.getDate()}日 ${WEEKDAYS[d.getDay()]}${time}`;
}

export function isOverdue(due: Date, now = new Date()): boolean {
  return due.getTime() < now.getTime() && !isSameDay(due, now);
}

/** Open API wire format: yyyy-MM-dd'T'HH:mm:ssZ, e.g. 2019-11-13T03:00:00+0000. */
export function toWireDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds()) +
    sign +
    pad(Math.floor(Math.abs(off) / 60)) +
    pad(Math.abs(off) % 60)
  );
}
