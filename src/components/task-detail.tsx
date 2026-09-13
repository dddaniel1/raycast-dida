import { Detail, Icon } from "@raycast/api";
import type { Project, Task } from "../types/dida";
import { formatRelative } from "../lib/dates";
import { formatRecurrence } from "../lib/recurrence";
import { formatReminderTrigger } from "../lib/reminders";
import { PRIORITY_LABEL } from "./task-form";
import { TaskActionPanel } from "./task-actions";

export function TaskDetail({
  task,
  projects,
  mutate,
  selection,
  selectedTasks,
  onToggle,
  onClearSelection,
}: {
  task: Task;
  projects: Project[];
  mutate: () => void;
  selection?: Set<string>;
  selectedTasks?: Task[];
  onToggle?: (id: string) => void;
  onClearSelection?: () => void;
}) {
  const completed =
    Boolean((task as { completed?: boolean }).completed) ||
    (task as { status?: number }).status === 2;
  const projectName =
    projects.find((p) => p.id === task.projectId)?.name ?? task.projectId;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const start = task.startDate ? new Date(task.startDate) : null;
  const repeat = task.repeatFlag
    ? formatRecurrence(String(task.repeatFlag))
    : "";
  const lines = [
    "# " + task.title,
    completed ? "✅ Completed" : "",
    "",
    "- Project: " + projectName,
    "- Priority: " + PRIORITY_LABEL[task.priority ?? 0],
    due
      ? "- Due: " +
        formatRelative(due) +
        (task.isAllDay
          ? " (全天)"
          : " " +
            due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
      : "",
    start ? "- Start: " + formatRelative(start) : "",
    task.timeZone ? "- Time Zone: " + task.timeZone : "",
    (task.reminders ?? []).length
      ? "- Reminders: " +
        (task.reminders ?? [])
          .map((r) => formatReminderTrigger(String(r)))
          .join(", ")
      : "",
    repeat ? "- Repeat: " + repeat : "",
    task.desc ? "\n> " + String(task.desc).replace(/\n/g, "\n> ") : "",
    task.content ? "\n---\n\n" + String(task.content) : "",
    (task.items ?? []).length
      ? "\n## Checklist\n\n" +
        (task.items ?? [])
          .map((it) => "- [" + (it.status ? "x" : " ") + "] " + it.title)
          .join("\n")
      : "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return (
    <Detail
      markdown={lines}
      navigationTitle={task.title}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Project" text={projectName} />
          <Detail.Metadata.Label
            title="Priority"
            text={PRIORITY_LABEL[task.priority ?? 0]}
            icon={Icon.Flag}
          />
          {due && (
            <Detail.Metadata.Label title="Due" text={formatRelative(due)} />
          )}
          {task.isAllDay && (
            <Detail.Metadata.Label title="Type" text="All day" />
          )}
        </Detail.Metadata>
      }
      actions={
        <TaskActionPanel
          task={task}
          projects={projects}
          mutate={mutate}
          selection={selection}
          selectedTasks={selectedTasks}
          onToggle={onToggle}
          onClearSelection={onClearSelection}
        />
      }
    />
  );
}
