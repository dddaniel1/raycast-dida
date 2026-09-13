import { strict as assert } from "node:assert";
import { test } from "node:test";

import { formatRelative, isOverdue, parseDate } from "../dates.ts";
import {
  formatReminder,
  formatReminderTrigger,
  parseReminder,
  reminderAmountToMinutes,
  reminderToTrigger,
  reminderTriggerToMinutes,
  splitReminderMinutes,
} from "../reminders.ts";
import {
  formatRecurrence,
  kindToRRULE,
  nextAfter,
  parseRecurrence,
  recurrenceToRRULE,
  rruleToKind,
} from "../recurrence.ts";
import {
  parseChineseDate,
  parseQuickAdd,
  quickAddToTaskInput,
} from "../quick-add.ts";
import {
  filterTasks,
  menuBarCounts,
  postpone,
  sortTasks,
  type TaskLike,
} from "../tasks.ts";
import { computeStats, parseClipboard, type LocalStore } from "../storage.ts";

// -- dates --
test("parseDate handles date and datetime", () => {
  assert.equal(
    parseDate("2026-03-15").getTime(),
    new Date(2026, 2, 15).getTime(),
  );
  assert.equal(parseDate("2026-03-15 14:30").getHours(), 14);
});

test("formatRelative chinese", () => {
  const now = new Date(2026, 2, 10, 12, 0);
  assert.equal(formatRelative(new Date(2026, 2, 10), now), "今天");
  assert.equal(formatRelative(new Date(2026, 2, 11), now), "明天");
  assert.equal(formatRelative(new Date(2026, 2, 16), now), "6天后");
});

test("isOverdue", () => {
  const now = new Date(2026, 2, 10, 12, 0);
  assert.ok(isOverdue(new Date(2026, 2, 9, 12, 0), now));
  assert.ok(!isOverdue(new Date(2026, 2, 10, 9, 0), now)); // same day
});

// -- reminders --
test("parseReminder", () => {
  assert.deepEqual(parseReminder("准时"), { minutesBefore: 0 });
  assert.deepEqual(parseReminder("提前30分钟"), { minutesBefore: 30 });
  assert.deepEqual(parseReminder("提前2小时"), { minutesBefore: 120 });
  assert.deepEqual(parseReminder("提前1天"), { minutesBefore: 1440 });
  assert.equal(parseReminder("garbage"), null);
  assert.equal(formatReminder({ minutesBefore: 120 }), "提前2小时");
});

test("formatReminderTrigger reads Dida trigger strings", () => {
  assert.equal(formatReminderTrigger("TRIGGER:PT0S"), "准时");
  assert.equal(formatReminderTrigger("TRIGGER:P0D"), "准时");
  assert.equal(formatReminderTrigger("TRIGGER:-PT30M"), "提前30分钟");
  assert.equal(formatReminderTrigger("TRIGGER:-PT1H"), "提前1小时");
  assert.equal(formatReminderTrigger("TRIGGER:-P1D"), "提前1天");
  assert.equal(formatReminderTrigger("TRIGGER:-P1DT2H"), "提前1天2小时");
  assert.equal(formatReminderTrigger("TRIGGER:-PT90M"), "提前1小时30分钟");
  assert.equal(formatReminderTrigger("nonsense"), "nonsense");
});

test("reminder triggers round-trip through the form", () => {
  for (const minutes of [0, 5, 30, 60, 90, 1440, 1560])
    assert.equal(reminderTriggerToMinutes(reminderToTrigger(minutes)), minutes);
  assert.equal(reminderTriggerToMinutes("TRIGGER:PT0S"), 0);
  assert.equal(reminderTriggerToMinutes("not-a-trigger"), null);
});

test("custom reminder amounts convert through the chosen unit", () => {
  assert.equal(reminderAmountToMinutes("90", "minutes"), 90);
  assert.equal(reminderAmountToMinutes("2", "hours"), 120);
  assert.equal(reminderAmountToMinutes("1", "days"), 1440);
  assert.equal(reminderAmountToMinutes("1.5", "hours"), 90);
  assert.equal(reminderAmountToMinutes("30", undefined), 30);
  for (const bad of ["", "  ", "abc", "0", "-5"])
    assert.equal(reminderAmountToMinutes(bad, "minutes"), null);
});

test("splitting reminder minutes picks the largest whole unit", () => {
  assert.deepEqual(splitReminderMinutes(1440), { value: "1", unit: "days" });
  assert.deepEqual(splitReminderMinutes(120), { value: "2", unit: "hours" });
  assert.deepEqual(splitReminderMinutes(1500), { value: "25", unit: "hours" });
  assert.deepEqual(splitReminderMinutes(90), { value: "90", unit: "minutes" });
  assert.deepEqual(splitReminderMinutes(0), { value: "", unit: "minutes" });
});

// -- recurrence --
test("parseRecurrence", () => {
  assert.deepEqual(parseRecurrence("每天"), { freq: "daily" });
  assert.deepEqual(parseRecurrence("工作日"), {
    freq: "weekly",
    byWeekday: [1, 2, 3, 4, 5],
  });
  assert.deepEqual(parseRecurrence("每周一"), {
    freq: "weekly",
    byWeekday: [1],
  });
  assert.deepEqual(parseRecurrence("每3天"), { freq: "daily", interval: 3 });
  assert.equal(parseRecurrence("xyz"), null);
});

test("parseRecurrence picks weekdays and calendar days", () => {
  assert.deepEqual(parseRecurrence("每周一、三、五"), {
    freq: "weekly",
    byWeekday: [1, 3, 5],
  });
  assert.deepEqual(parseRecurrence("每周三、一"), {
    freq: "weekly",
    byWeekday: [1, 3],
  });
  assert.deepEqual(parseRecurrence("每月15日"), {
    freq: "monthly",
    byMonthDay: 15,
  });
  assert.deepEqual(parseRecurrence("每月15号"), {
    freq: "monthly",
    byMonthDay: 15,
  });
  assert.deepEqual(parseRecurrence("每年3月15日"), {
    freq: "yearly",
    byMonth: 3,
    byMonthDay: 15,
  });
  assert.deepEqual(parseRecurrence("每年3月"), { freq: "yearly", byMonth: 3 });
  assert.equal(parseRecurrence("每月99日"), null);
  assert.equal(parseRecurrence("每年13月1日"), null);
  // a month/day rule has no matching form control, so editing must keep it raw
  assert.deepEqual(rruleToKind("RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15"), {
    kind: "custom",
    rrule: "RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15",
  });

  assert.equal(
    recurrenceToRRULE(parseRecurrence("每周一、三")!),
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
  );
  assert.equal(
    recurrenceToRRULE(parseRecurrence("每月15日")!),
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=15",
  );
  assert.equal(
    recurrenceToRRULE(parseRecurrence("每年3月15日")!),
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15",
  );
});

test("quick add custom repeat phrases reach the payload", () => {
  const now = new Date(2026, 2, 10, 10, 0);
  const week = parseQuickAdd("写周报 ~每周一、三", now);
  assert.equal(week.title, "写周报");
  assert.equal(week.recurrence, "每周一、三");
  assert.equal(
    quickAddToTaskInput("写周报 ~每周一、三", [], now).repeatFlag,
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
  );
  assert.equal(
    quickAddToTaskInput("缴费 ~每月15日", [], now).repeatFlag,
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=15",
  );
});

test("nextAfter weekly monday", () => {
  // 2026-03-10 is a Tuesday
  const after = new Date(2026, 2, 10, 12, 0);
  const next = nextAfter({ freq: "weekly", byWeekday: [1] }, after);
  assert.equal(next.getDay(), 1);
  assert.equal(next.getDate(), 16);
});

test("kindToRRULE and rruleToKind round-trip form kinds", () => {
  assert.equal(kindToRRULE("none"), undefined);
  assert.equal(kindToRRULE(undefined), undefined);
  assert.equal(kindToRRULE("daily"), "RRULE:FREQ=DAILY");
  assert.equal(
    kindToRRULE("weekdays"),
    "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  );
  assert.equal(kindToRRULE("everyN", "3"), "RRULE:FREQ=DAILY;INTERVAL=3");
  assert.equal(
    kindToRRULE("custom", undefined, "RRULE:FREQ=WEEKLY;BYDAY=MO,FR"),
    "RRULE:FREQ=WEEKLY;BYDAY=MO,FR",
  );
  assert.equal(kindToRRULE("custom", undefined, "  "), undefined);
  assert.equal(
    kindToRRULE("weeklyDays", undefined, undefined, { weekdays: [1, 3, 5] }),
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR",
  );
  assert.equal(
    kindToRRULE("weeklyDays", undefined, undefined, { weekdays: [] }),
    undefined,
  );
  assert.equal(
    kindToRRULE("monthlyDay", undefined, undefined, { monthDay: "15" }),
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=15",
  );
  assert.equal(
    kindToRRULE("monthlyDay", undefined, undefined, { monthDay: "99" }),
    undefined,
  );
  assert.equal(
    kindToRRULE("everyN", "2", undefined, { unit: "weeks" }),
    "RRULE:FREQ=WEEKLY;INTERVAL=2",
  );

  assert.deepEqual(rruleToKind("RRULE:FREQ=DAILY"), { kind: "daily" });
  assert.deepEqual(rruleToKind("RRULE:FREQ=DAILY;INTERVAL=3"), {
    kind: "everyN",
    interval: "3",
  });
  assert.deepEqual(rruleToKind("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"), {
    kind: "weekdays",
  });
  assert.deepEqual(rruleToKind("RRULE:FREQ=WEEKLY"), { kind: "weekly" });
  assert.deepEqual(rruleToKind("RRULE:FREQ=WEEKLY;BYDAY=MO,FR"), {
    kind: "weeklyDays",
    weekdays: [1, 5],
  });
  assert.deepEqual(rruleToKind("RRULE:FREQ=MONTHLY;BYMONTHDAY=15"), {
    kind: "monthlyDay",
    monthDay: "15",
  });
  assert.deepEqual(rruleToKind("RRULE:FREQ=WEEKLY;INTERVAL=2"), {
    kind: "everyN",
    interval: "2",
    unit: "weeks",
  });
  assert.deepEqual(rruleToKind("RRULE:FREQ=MONTHLY;INTERVAL=2"), {
    kind: "everyN",
    interval: "2",
    unit: "months",
  });
  // combined shapes (interval plus a specific day) still stay custom
  for (const raw of [
    "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO",
    "RRULE:FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=1",
  ]) {
    const out = rruleToKind(raw);
    assert.equal(out.kind, "custom");
    assert.equal(out.rrule, raw);
  }
  // custom preserves the raw string so editing does not lose the rule
  const custom = kindToRRULE(
    "custom",
    undefined,
    "RRULE:FREQ=WEEKLY;BYDAY=MO,FR",
  );
  assert.equal(custom, "RRULE:FREQ=WEEKLY;BYDAY=MO,FR");
});

test("formatRecurrence speaks plain Chinese", () => {
  assert.equal(formatRecurrence("RRULE:FREQ=DAILY"), "每天");
  assert.equal(formatRecurrence("RRULE:FREQ=DAILY;INTERVAL=3"), "每3天");
  assert.equal(formatRecurrence("RRULE:FREQ=WEEKLY"), "每周");
  assert.equal(
    formatRecurrence("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"),
    "工作日",
  );
  assert.equal(formatRecurrence("RRULE:FREQ=WEEKLY;BYDAY=MO,FR"), "每周一、五");
  assert.equal(formatRecurrence("RRULE:FREQ=WEEKLY;INTERVAL=2"), "每2周");
  assert.equal(
    formatRecurrence("RRULE:FREQ=WEEKLY;BYDAY=MO;WKST=SU"),
    "每周一",
  );
  assert.equal(formatRecurrence("RRULE:FREQ=MONTHLY"), "每月");
  assert.equal(formatRecurrence("RRULE:FREQ=MONTHLY;INTERVAL=2"), "每2个月");
  assert.equal(
    formatRecurrence("RRULE:FREQ=MONTHLY;BYMONTHDAY=15"),
    "每月15日",
  );
  assert.equal(formatRecurrence("RRULE:FREQ=YEARLY"), "每年");
  assert.equal(
    formatRecurrence("RRULE:FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15"),
    "每年3月15日",
  );
  // Anything not understood stays visible as the raw rule instead of vanishing.
  assert.equal(formatRecurrence("FREQ=HOURLY"), "FREQ=HOURLY");
});

// -- quick add --
test("parseQuickAdd canonical example", () => {
  const now = new Date(2026, 2, 10, 10, 0);
  const r = parseQuickAdd("明天下午3点开会 #工作 !high", now);
  assert.equal(r.title, "开会");
  assert.equal(r.project, "工作");
  assert.equal(r.priority, "high");
  assert.equal(r.dueDate?.getDate(), 11);
  assert.equal(r.dueDate?.getHours(), 15);
  assert.equal(r.isAllDay, false);
});

test("parseQuickAdd @date syntax", () => {
  const r = parseQuickAdd("买猫粮 @2026-03-20 !low");
  assert.equal(r.title, "买猫粮");
  assert.equal(r.dueDate?.getMonth(), 2);
  assert.equal(r.priority, "low");
  assert.equal(r.isAllDay, true);
});

test("parseQuickAdd remind token", () => {
  const r = parseQuickAdd("交报告 @remind提前30分钟 @明天");
  assert.deepEqual(r.reminders, [{ minutesBefore: 30 }]);
  assert.ok(r.dueDate);
});

test("parseQuickAdd recurrence token", () => {
  const r = parseQuickAdd("写周报 ~每周五 下午5点");
  assert.equal(r.recurrence, "每周五");
  assert.ok(r.dueDate);
});

test("parseChineseDate phrases", () => {
  const now = new Date(2026, 2, 10, 9, 0);
  const twoHours = parseChineseDate("两小时后提醒我", now);
  assert.ok(
    Math.abs(twoHours!.date.getTime() - (now.getTime() + 7200000)) < 1000,
  );
  const weekday = parseChineseDate("下周一交报告", now);
  assert.equal(weekday?.date.getDay(), 1);
  assert.ok(weekday!.date.getTime() > now.getTime());
  const friday = parseChineseDate("每周五下午5点写周报", now);
  assert.equal(friday?.date.getDay(), 5);
  assert.equal(friday?.date.getHours(), 17);
  const monthEnd = parseChineseDate("月底前完成项目", now);
  assert.equal(monthEnd?.date.getMonth(), 2);
  assert.equal(monthEnd?.date.getDate(), 31);
});

test("parseQuickAdd multiple @tokens", () => {
  const now = new Date(2026, 2, 10, 10, 0);
  const r = parseQuickAdd("交报告 @remind提前30分钟 @明天", now);
  assert.deepEqual(r.reminders, [{ minutesBefore: 30 }]);
  assert.equal(r.dueDate?.getDate(), 11);
  assert.equal(r.title, "交报告");
});

test("parseQuickAdd custom markers", () => {
  const now = new Date(2026, 2, 10, 10, 0);
  const r = parseQuickAdd("开会 &工作 %high 下周一下午3点 $每周五", now, {
    project: "&",
    priority: "%",
    date: "@",
    repeat: "$",
  });
  assert.equal(r.title, "开会");
  assert.equal(r.project, "工作");
  assert.equal(r.priority, "high");
  assert.equal(r.recurrence, "每周五");
  assert.ok(r.dueDate);
  // default markers must stop matching when overridden
  const bare = parseQuickAdd("开会 #工作", now, { project: "&" });
  assert.equal(bare.project, undefined);
  assert.equal(bare.title, "开会 #工作");
});

// -- tasks filtering / sorting / postpone --
const tasks: TaskLike[] = [
  {
    id: "1",
    title: "a",
    projectId: "p1",
    dueDate: "2026-03-10T10:00:00",
    priority: 3,
  },
  {
    id: "2",
    title: "b",
    projectId: "p2",
    dueDate: "2026-03-11T10:00:00",
    priority: 1,
  },
  { id: "3", title: "c", projectId: "p1" },
  {
    id: "4",
    title: "done",
    projectId: "p1",
    dueDate: "2026-03-10T10:00:00",
    completed: true,
  },
];
const NOW = new Date(2026, 2, 10, 12, 0);

test("filterTasks", () => {
  assert.equal(filterTasks(tasks, { view: "today" }, NOW).length, 1);
  assert.equal(filterTasks(tasks, { view: "tomorrow" }, NOW).length, 1);
  assert.equal(filterTasks(tasks, { view: "next7" }, NOW).length, 2);
  assert.equal(filterTasks(tasks, { view: "no-date" }, NOW).length, 1);
  assert.equal(
    filterTasks(tasks, { view: "project", projectId: "p1" }, NOW).length,
    2,
  );
  assert.equal(
    filterTasks(tasks, { view: "priority", priority: 3 }, NOW).length,
    1,
  );
  assert.equal(filterTasks(tasks, { view: "text", query: "b" }, NOW).length, 1);
  assert.equal(filterTasks(tasks, { view: "all" }, NOW).length, 3);
  assert.equal(filterTasks(tasks, { view: "completed" }, NOW).length, 1);
  assert.equal(filterTasks(tasks, { view: "completed" }, NOW)[0].id, "4");
});

test("sortTasks", () => {
  assert.equal(sortTasks(tasks, "priority-desc")[0].id, "1");
  assert.equal(sortTasks(tasks, "due-asc")[0].id, "1");
});

test("postpone presets", () => {
  const t = tasks[0];
  assert.equal(new Date(postpone(t, "1h", NOW).dueDate!).getHours(), 11);
  assert.equal(new Date(postpone(t, "tomorrow", NOW).dueDate!).getDate(), 11);
  assert.equal(new Date(postpone(t, "next-monday", NOW).dueDate!).getDay(), 1);
});

test("menuBarCounts", () => {
  const now = new Date(2026, 2, 10, 12, 0);
  const t = (over: Partial<TaskLike>): TaskLike => ({
    id: "x",
    title: "x",
    projectId: "p1",
    ...over,
  });
  const counts = menuBarCounts(
    [
      t({ dueDate: "2026-03-10T15:00:00" }), // due today
      t({ dueDate: "2026-03-09T10:00:00" }), // overdue
      t({ dueDate: "2026-03-09T10:00:00", priority: 5 }), // overdue + high
      t({ priority: 5 }), // high, no date
      t({ dueDate: "2026-03-10T09:00:00", completed: true }), // done, ignored
    ],
    now,
  );
  assert.equal(counts.todayRemaining, 1);
  assert.equal(counts.overdue, 2);
  assert.equal(counts.highPriority, 2);
});

// -- clipboard --
test("parseClipboard", () => {
  const r = parseClipboard("买猫粮\n记得顺便买猫砂\nhttps://example.com/item");
  assert.equal(r.title, "买猫粮");
  assert.equal(r.description, "记得顺便买猫砂\nhttps://example.com/item");
  assert.equal(r.url, "https://example.com/item");
  const urlOnly = parseClipboard("https://example.com");
  assert.equal(urlOnly.title, "https://example.com");
});

// -- storage models (with fake LocalStore) --
function fakeStore(): LocalStore {
  const map = new Map<string, string>();
  return {
    getItem: async (k: string) => map.get(k),
    setItem: async (k: string, v: string) => void map.set(k, v),
    removeItem: async (k: string) => void map.delete(k),
  };
}

test("recent and favorite projects persist", async () => {
  const s = fakeStore();
  const {
    recordProjectVisit: rec,
    getRecentProjects: getRecent,
    toggleFavoriteProject: fav,
    getFavoriteProjects: getFav,
  } = await import("../storage.ts");
  await rec(s, "p1");
  await rec(s, "p2");
  await rec(s, "p1");
  assert.deepEqual(await getRecent(s), ["p1", "p2"]);
  await fav(s, "p1");
  await fav(s, "p2");
  await fav(s, "p1");
  assert.deepEqual(await getFav(s), ["p2"]);
});

test("computeStats", () => {
  const now = new Date(2026, 2, 10, 12, 0);
  const stats = computeStats(tasks, now);
  assert.equal(stats.todayCompleted, 1); // completed task with dueDate today (completion proxy)
  assert.equal(stats.overdue, 0);
  assert.equal(stats.byProject.p1, 2);
  assert.equal(stats.byPriority[3], 1);
});
