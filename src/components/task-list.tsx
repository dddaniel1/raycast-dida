import { Icon, List } from "@raycast/api";
import type { Project, Task } from "../types/dida";
import { formatRelative, isOverdue } from "../lib/dates";
import { PRIORITY_LABEL } from "./task-form";
import { TaskActionPanel } from "./task-actions";

interface Accessory {
  text?: string;
  icon?: Icon;
  tooltip?: string;
}

export function TaskListItem({
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
  const projectName = projects.find((p) => p.id === task.projectId)?.name;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const priority = task.priority ?? 0;
  const accessories: Accessory[] = [];
  const done = task.status === 2;
  if (done) accessories.push({ text: "✓", tooltip: "Completed" });
  if (priority > 0)
    accessories.push({ text: PRIORITY_LABEL[priority], icon: Icon.Flag });
  if (due) accessories.push({ text: formatRelative(due) });
  if (due && isOverdue(due))
    accessories.push({ icon: Icon.ExclamationMark, tooltip: "Overdue" });
  if (selection?.has(task.id))
    accessories.push({ icon: Icon.CheckCircle, tooltip: "Selected" });

  return (
    <List.Item
      key={task.id}
      title={task.title}
      subtitle={projectName}
      accessories={accessories}
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
