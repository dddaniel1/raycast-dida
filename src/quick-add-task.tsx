import {
  getPreferenceValues,
  Action,
  ActionPanel,
  Form,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useMemo, useRef } from "react";
import { getProjects } from "./api/projects";
import { createTask } from "./api/tasks";
import { parseQuickAdd, quickAddToTaskInput } from "./lib/quick-add";
import { parseRecurrence, rruleToKind } from "./lib/recurrence";
import { splitReminderMinutes } from "./lib/reminders";
import { recordProjectVisit, recordRecentTask } from "./lib/storage";
import {
  TaskFormFields,
  formToTaskInput,
  recurrenceToRRULE,
  REMINDER_PRESETS,
} from "./components/task-form";

const PRIORITY_VALUE: Record<string, string> = {
  high: "5",
  medium: "3",
  low: "1",
};

interface QuickAddPrefs {
  qaProjectMarker?: string;
  qaPriorityMarker?: string;
  qaDateMarker?: string;
  qaRepeatMarker?: string;
}

export default function QuickAddTask(props: {
  arguments?: Record<string, string>;
}) {
  const { pop } = useNavigation();
  const { data: projects = [], isLoading } = useCachedPromise(getProjects);
  const prefs = getPreferenceValues<QuickAddPrefs>();
  const markers = {
    project: prefs.qaProjectMarker || undefined,
    priority: prefs.qaPriorityMarker || undefined,
    date: prefs.qaDateMarker || undefined,
    repeat: prefs.qaRepeatMarker || undefined,
  };
  const raw =
    props.arguments?.query ??
    props.arguments?.input ??
    Object.values(props.arguments ?? {})[0] ??
    "";

  // No-view direct path: a launch argument creates the task immediately,
  // no form. Falls back to the interactive form when launched without one.
  const shouldAutoCreate = Boolean(raw.trim());
  const autoCreateStarted = useRef(false);
  useEffect(() => {
    if (!shouldAutoCreate || autoCreateStarted.current) return;
    autoCreateStarted.current = true;
    void (async () => {
      try {
        const projects = await getProjects();
        const input = quickAddToTaskInput(raw, projects);
        const created = await createTask(input);
        await recordRecentTask(LocalStorage, created);
        if (input.projectId)
          await recordProjectVisit(LocalStorage, input.projectId);
        await showToast({
          style: Toast.Style.Success,
          title: "任务已创建",
          message: input.title,
        });
      } catch (e) {
        await showToast({
          style: Toast.Style.Failure,
          title: "创建任务失败",
          message: e instanceof Error ? e.message : String(e),
        });
      }
    })();
  }, [shouldAutoCreate]);

  if (shouldAutoCreate) return null;

  // Prefill from launch argument; user confirms/adjusts in the form before submit.
  const values = useMemo(() => {
    const parsed = parseQuickAdd(raw, new Date(), markers);
    const match = parsed.project
      ? projects.find(
          (p) =>
            p.name === parsed.project ||
            p.name.toLowerCase() === parsed.project?.toLowerCase(),
        )
      : undefined;
    const mins = (parsed.reminders ?? []).map((r: { minutesBefore: number }) =>
      String(r.minutesBefore),
    );
    const customMinutes = (parsed.reminders ?? [])
      .map((r: { minutesBefore: number }) => r.minutesBefore)
      .find((m) => !REMINDER_PRESETS.includes(String(m)));
    const splitCustom =
      customMinutes === undefined
        ? undefined
        : splitReminderMinutes(customMinutes);
    const rec = parsed.recurrence ? parseRecurrence(parsed.recurrence) : null;
    // Map the parsed rule onto the form kind so the Repeat picker shows it.
    const repeat = rec ? rruleToKind(recurrenceToRRULE(rec)) : undefined;
    return {
      title: parsed.title,
      projectId: match?.id ?? "",
      priority: parsed.priority ? PRIORITY_VALUE[parsed.priority] : "0",
      dueDate: parsed.dueDate ?? null,
      isAllDay: parsed.isAllDay,
      reminders: mins.filter((m) => REMINDER_PRESETS.includes(m)),
      customReminder: splitCustom?.value,
      customReminderUnit: splitCustom?.unit,
      recurrence: repeat?.kind ?? "none",
      interval: repeat?.interval,
      rrule: repeat?.rrule,
      weekdays: repeat?.weekdays?.map(String),
      monthDay: repeat?.monthDay,
      intervalUnit: repeat?.unit,
    };
  }, [raw, projects]);

  async function handleSubmit(formValues: Record<string, unknown>) {
    const input = formToTaskInput(formValues);
    const created = await createTask(input);
    await recordRecentTask(LocalStorage, created);
    await showToast({
      style: Toast.Style.Success,
      title: "任务已创建",
      message: input.title,
    });
    if (input.projectId)
      await recordProjectVisit(LocalStorage, input.projectId);
    pop();
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Quick Add"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <TaskFormFields projects={projects} values={values} />
    </Form>
  );
}
