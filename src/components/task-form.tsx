import { Form } from "@raycast/api";
import { useEffect, useState } from "react";
import type { ChecklistItem, Project, Task } from "../types/dida";
import {
  kindToRRULE,
  recurrenceToRRULE,
  rruleToKind,
  type RecurrenceKind,
  type RecurrenceUnit,
} from "../lib/recurrence";
import {
  reminderAmountToMinutes,
  reminderToTrigger,
  reminderTriggerToMinutes,
  splitReminderMinutes,
  type ReminderUnit,
} from "../lib/reminders";

const TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const PRIORITY_LABEL: Record<number, string> = {
  0: "None",
  1: "Low",
  3: "Medium",
  5: "High",
};
export const PRIORITY_OPTIONS = [
  { value: "5", title: "High" },
  { value: "3", title: "Medium" },
  { value: "1", title: "Low" },
  { value: "0", title: "None" },
];
export const REMINDER_PRESETS = ["0", "5", "15", "30", "60", "1440"];
export const REMINDER_PRESET_TITLES: Record<string, string> = {
  "0": "准时",
  "5": "提前5分钟",
  "15": "提前15分钟",
  "30": "提前30分钟",
  "60": "提前1小时",
  "1440": "提前1天",
};
const REMINDER_UNIT_OPTIONS: Array<[ReminderUnit, string]> = [
  ["minutes", "分钟"],
  ["hours", "小时"],
  ["days", "天"],
];

// Repeat uses Dida wording, so every option in this one control is Chinese.
const RECURRENCE_OPTIONS: Array<[RecurrenceKind, string]> = [
  ["none", "从不"],
  ["daily", "每天"],
  ["weekdays", "工作日"],
  ["weekly", "每周"],
  ["weeklyDays", "每周指定星期"],
  ["monthly", "每月"],
  ["monthlyDay", "每月指定日期"],
  ["yearly", "每年"],
  ["everyN", "每 N 天/周/月/年"],
  ["custom", "自定义 RRULE"],
];

// Dida wording again: the values are Dida day numbers, 0 = Sunday.
const WEEKDAY_OPTIONS: Array<[string, string]> = [
  ["1", "周一"],
  ["2", "周二"],
  ["3", "周三"],
  ["4", "周四"],
  ["5", "周五"],
  ["6", "周六"],
  ["0", "周日"],
];
const MONTH_DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const UNIT_OPTIONS: Array<[RecurrenceUnit, string]> = [
  ["days", "天"],
  ["weeks", "周"],
  ["months", "个月"],
  ["years", "年"],
];

export { reminderToTrigger, recurrenceToRRULE };
export const triggerToReminder = reminderTriggerToMinutes;

export type TaskFormValues = {
  title: string;
  projectId: string;
  priority: string;
  notes?: string;
  dueDate?: Date | null;
  isAllDay?: boolean;
  startDate?: Date | null;
  timeZone?: string;
  reminders?: string[];
  customReminder?: string;
  customReminderUnit?: ReminderUnit;
  recurrence?: RecurrenceKind;
  interval?: string;
  rrule?: string;
  weekdays?: string[];
  monthDay?: string;
  intervalUnit?: RecurrenceUnit;
  items?: string;
};

/** One checklist item per line; "[x] " prefix = done; order = line order. */
export function textToItems(
  text: string,
  existing?: ChecklistItem[],
): ChecklistItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const done = /^\[x\]/i.test(line);
      const title = line.replace(/^\[x\]\s?/i, "");
      const id = existing?.find((it) => it.title === title)?.id ?? genItemId();
      return { id, title, status: done ? 1 : 0, sortOrder: i }; // checklist status: 0 normal, 1 completed
    });
}

// ponytail: client-generated item id; the server may reassign on create.
function genItemId(): string {
  return "item-" + Math.random().toString(36).slice(2, 10);
}

export function itemsToText(items?: ChecklistItem[]): string {
  return (items ?? [])
    .map((it) => (it.status ? "[x] " : "[ ] ") + it.title)
    .join("\n");
}

export function formToTaskInput(
  values: Record<string, unknown>,
  existingItems?: ChecklistItem[],
) {
  const v = values as TaskFormValues;
  const due = v.dueDate instanceof Date ? v.dueDate : null;
  const start = v.startDate instanceof Date ? v.startDate : null;
  const dueDate = due
    ? (v.isAllDay
        ? new Date(due.getFullYear(), due.getMonth(), due.getDate())
        : due
      ).getTime()
    : undefined;
  const customMinutes = reminderAmountToMinutes(
    v.customReminder ?? "",
    v.customReminderUnit,
  );
  const reminderMinutes = [
    ...(v.reminders ?? []).map(Number).filter((n) => Number.isFinite(n)),
    ...(customMinutes === null ? [] : [customMinutes]),
  ];
  const rrule = kindToRRULE(v.recurrence, v.interval, v.rrule, {
    weekdays: (v.weekdays ?? []).map(Number),
    monthDay: v.monthDay,
    unit: v.intervalUnit,
  });
  const items = v.items?.trim()
    ? textToItems(v.items, existingItems)
    : undefined;
  return {
    projectId: v.projectId,
    title: v.title.trim(),
    // Notes absorb the legacy description field; clear desc so the text is not stored twice.
    content: v.notes?.trim() || undefined,
    desc: "",
    priority: Number(v.priority) || 0,
    startDate: start ? start.getTime() : undefined,
    dueDate,
    isAllDay: Boolean(v.isAllDay) && Boolean(dueDate),
    timeZone:
      dueDate && !v.isAllDay ? v.timeZone?.trim() || TIMEZONE : undefined,
    // A reminder offsets the due date, so it cannot exist without one.
    reminders:
      Boolean(dueDate) && reminderMinutes.length
        ? reminderMinutes.map(reminderToTrigger)
        : undefined,
    repeatFlag: rrule,
    items,
  };
}

export function taskToFormValues(task: Task): TaskFormValues {
  const reminderMins = (task.reminders ?? [])
    .map((t) => triggerToReminder(String(t)))
    .filter((n): n is number => n !== null)
    .map(String);
  const presets = reminderMins.filter((m) => REMINDER_PRESETS.includes(m));
  const custom = reminderMins.find((m) => !REMINDER_PRESETS.includes(m));
  const splitCustom = custom ? splitReminderMinutes(Number(custom)) : undefined;
  const parsed = rruleToKind(task.repeatFlag ? String(task.repeatFlag) : "");
  return {
    title: task.title,
    projectId: task.projectId,
    notes: [task.content, task.desc].filter(Boolean).join("\n") || undefined,
    priority: String(task.priority ?? 0),
    dueDate: task.dueDate ? new Date(task.dueDate) : null,
    isAllDay: Boolean(task.isAllDay),
    startDate: task.startDate ? new Date(task.startDate) : null,
    timeZone: task.timeZone,
    reminders: presets,
    customReminder: splitCustom?.value,
    customReminderUnit: splitCustom?.unit,
    recurrence: parsed.kind,
    interval: parsed.interval,
    rrule: parsed.rrule,
    weekdays: parsed.weekdays?.map(String),
    monthDay: parsed.monthDay,
    intervalUnit: parsed.unit,
    items: itemsToText(task.items),
  };
}

type FormState = {
  title: string;
  projectId: string;
  priority: string;
  dueDate: Date | null;
  isAllDay: boolean;
  startDate: Date | null;
  timeZone: string;
  recurrence: RecurrenceKind;
  interval: string;
  rrule: string;
  weekdays: string[];
  monthDay: string;
  intervalUnit: RecurrenceUnit;
  reminders: string[];
  customReminder: string;
  customReminderUnit: ReminderUnit;
  notes: string;
  items: string;
};

function initialState(values: Partial<TaskFormValues> | undefined): FormState {
  return {
    title: values?.title ?? "",
    projectId: values?.projectId ?? "",
    priority: values?.priority ?? "0",
    dueDate: values?.dueDate ?? null,
    isAllDay: Boolean(values?.isAllDay),
    startDate: values?.startDate ?? null,
    timeZone: values?.timeZone ?? "",
    recurrence: values?.recurrence ?? "none",
    interval: values?.interval ?? "",
    rrule: values?.rrule ?? "",
    weekdays: values?.weekdays ?? [],
    monthDay: values?.monthDay ?? "1",
    intervalUnit: values?.intervalUnit ?? "days",
    reminders: values?.reminders ?? [],
    customReminder: values?.customReminder ?? "",
    customReminderUnit: values?.customReminderUnit ?? "minutes",
    notes: values?.notes ?? "",
    items: values?.items ?? "",
  };
}

/**
 * Task fields with progressive disclosure: the extra repeat controls only show
 * for their own kind, the raw RRULE only for 自定义, and All day / Time Zone
 * only matter once a due date exists. Values are controlled so a re-render
 * never drops what was typed.
 */
export function TaskFormFields({
  projects,
  values,
}: {
  projects: Project[];
  values?: Partial<TaskFormValues>;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(values));

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Projects resolve after mount; fall back to the first one until the user picks.
  useEffect(() => {
    if (!form.projectId && projects.length > 0)
      setForm((prev) => ({ ...prev, projectId: projects[0].id }));
  }, [projects, form.projectId]);

  return (
    <>
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Task title"
        value={form.title}
        onChange={(v) => set("title", v)}
      />
      <Form.Dropdown
        id="projectId"
        title="Project"
        value={form.projectId}
        onChange={(v) => set("projectId", v)}
      >
        {projects.map((p) => (
          <Form.Dropdown.Item key={p.id} value={p.id} title={p.name} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown
        id="priority"
        title="Priority"
        value={form.priority}
        onChange={(v) => set("priority", v)}
      >
        {PRIORITY_OPTIONS.map((o) => (
          <Form.Dropdown.Item key={o.value} value={o.value} title={o.title} />
        ))}
      </Form.Dropdown>
      <Form.DatePicker
        id="dueDate"
        title="Due Date"
        type={
          form.isAllDay
            ? Form.DatePicker.Type.Date
            : Form.DatePicker.Type.DateTime
        }
        info="默认可选日期与具体时间点；勾选 All day 后只保留日期。"
        value={form.dueDate}
        onChange={(v) => set("dueDate", v)}
      />
      {form.dueDate && (
        <>
          <Form.Checkbox
            id="isAllDay"
            label="All day"
            value={form.isAllDay}
            onChange={(v) => set("isAllDay", v)}
          />
          {!form.isAllDay && (
            <Form.TextField
              id="timeZone"
              title="Time Zone"
              placeholder={TIMEZONE}
              info="IANA timezone for the due date, for example Asia/Shanghai."
              value={form.timeZone}
              onChange={(v) => set("timeZone", v)}
            />
          )}
          <Form.TagPicker
            id="reminders"
            title="Reminders"
            info="提醒是相对截止时间的提前量，选择一个或多个预设。"
            value={form.reminders}
            onChange={(v) => set("reminders", v)}
          >
            {REMINDER_PRESETS.map((m) => (
              <Form.TagPicker.Item
                key={m}
                value={m}
                title={REMINDER_PRESET_TITLES[m]}
              />
            ))}
          </Form.TagPicker>
          <Form.TextField
            id="customReminder"
            title="Custom Reminder"
            placeholder="90"
            info="自定义提醒：填数量，再选单位。"
            value={form.customReminder}
            onChange={(v) => set("customReminder", v)}
          />
          <Form.Dropdown
            id="customReminderUnit"
            title="Reminder Unit"
            value={form.customReminderUnit}
            onChange={(v) => set("customReminderUnit", v as ReminderUnit)}
          >
            {REMINDER_UNIT_OPTIONS.map(([value, title]) => (
              <Form.Dropdown.Item key={value} value={value} title={title} />
            ))}
          </Form.Dropdown>
        </>
      )}
      <Form.DatePicker
        id="startDate"
        title="Start Date"
        value={form.startDate}
        onChange={(v) => set("startDate", v)}
      />
      <Form.Dropdown
        id="recurrence"
        title="Repeat"
        info="可选预设，也可自选星期、每月日期或间隔；自定义 RRULE 可直接填写规则。"
        value={form.recurrence}
        onChange={(v) => set("recurrence", v as RecurrenceKind)}
      >
        {RECURRENCE_OPTIONS.map(([value, title]) => (
          <Form.Dropdown.Item key={value} value={value} title={title} />
        ))}
      </Form.Dropdown>
      {form.recurrence === "weeklyDays" && (
        <Form.TagPicker
          id="weekdays"
          title="Repeat Days"
          info="选择一个或多个星期，例如 周一、周三、周五。"
          value={form.weekdays}
          onChange={(v) => set("weekdays", v)}
        >
          {WEEKDAY_OPTIONS.map(([value, title]) => (
            <Form.TagPicker.Item key={value} value={value} title={title} />
          ))}
        </Form.TagPicker>
      )}
      {form.recurrence === "monthlyDay" && (
        <Form.Dropdown
          id="monthDay"
          title="Day of Month"
          value={form.monthDay}
          onChange={(v) => set("monthDay", v)}
        >
          {MONTH_DAY_OPTIONS.map((d) => (
            <Form.Dropdown.Item key={d} value={d} title={d + "日"} />
          ))}
        </Form.Dropdown>
      )}
      {form.recurrence === "everyN" && (
        <>
          <Form.TextField
            id="interval"
            title="Interval"
            placeholder="3"
            info="每 N 天/周/月/年：这里填 N。"
            value={form.interval}
            onChange={(v) => set("interval", v)}
          />
          <Form.Dropdown
            id="intervalUnit"
            title="Interval Unit"
            value={form.intervalUnit}
            onChange={(v) => set("intervalUnit", v as RecurrenceUnit)}
          >
            {UNIT_OPTIONS.map(([value, title]) => (
              <Form.Dropdown.Item key={value} value={value} title={title} />
            ))}
          </Form.Dropdown>
        </>
      )}
      {form.recurrence === "custom" && (
        <Form.TextField
          id="rrule"
          title="Custom RRULE"
          placeholder="RRULE:FREQ=WEEKLY;BYDAY=MO,FR"
          info="iCalendar RRULE, for example RRULE:FREQ=WEEKLY;BYDAY=MO,FR."
          value={form.rrule}
          onChange={(v) => set("rrule", v)}
        />
      )}
      <Form.TextArea
        id="notes"
        title="Notes"
        info="Saved as the task content. The older description field is merged here when editing."
        value={form.notes}
        onChange={(v) => set("notes", v)}
      />
      <Form.TextArea
        id="items"
        title="Checklist"
        info="One item per line; prefix [x] for done; order = line order."
        value={form.items}
        onChange={(v) => set("items", v)}
      />
    </>
  );
}
