import { isOverdue, startOfDay } from "./dates.ts";

export interface TaskLike {
  id: string;
  title: string;
  projectId: string;
  dueDate?: string | number;
  completedTime?: number;
  priority?: number;
  completed?: boolean;
}

export type TaskView =
  | "all"
  | "today"
  | "tomorrow"
  | "next7"
  | "overdue"
  | "no-date"
  | "recent"
  | "completed"
  | "project"
  | "priority"
  | "text";

export interface TaskFilter {
  view: TaskView;
  projectId?: string;
  priority?: number;
  query?: string;
}

function due(task: TaskLike): Date | null {
  return task.dueDate ? new Date(task.dueDate) : null;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function filterTasks<T extends TaskLike>(
  tasks: T[],
  filter: TaskFilter,
  now = new Date(),
): T[] {
  const active = (t: TaskLike) => !t.completed;
  switch (filter.view) {
    case "all":
      return tasks.filter(active);
    case "today":
      return tasks.filter((t) => active(t) && due(t) && sameDay(due(t)!, now));
    case "tomorrow": {
      const tmr = new Date(now);
      tmr.setDate(tmr.getDate() + 1);
      return tasks.filter((t) => active(t) && due(t) && sameDay(due(t)!, tmr));
    }
    case "next7": {
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      return tasks.filter((t) => {
        const d = due(t);
        return active(t) && d && d >= startOfDay(now) && d <= end;
      });
    }
    case "overdue":
      return tasks.filter(
        (t) => active(t) && due(t) && isOverdue(due(t)!, now),
      );
    case "no-date":
      return tasks.filter((t) => active(t) && !due(t));
    case "recent":
      return tasks.filter(active);
    case "completed":
      return tasks.filter((t) => Boolean(t.completed));
    case "project":
      return tasks.filter((t) => active(t) && t.projectId === filter.projectId);
    case "priority":
      return tasks.filter((t) => active(t) && t.priority === filter.priority);
    case "text": {
      const q = (filter.query ?? "").toLowerCase();
      return tasks.filter((t) => t.title.toLowerCase().includes(q));
    }
  }
}

export type TaskSort =
  "due-asc" | "due-desc" | "priority-desc" | "priority-asc" | "project";

/** Run async work with bounded concurrency; results keep input order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

export function sortTasks<T extends TaskLike>(tasks: T[], sort: TaskSort): T[] {
  const copy = [...tasks];
  switch (sort) {
    case "due-asc":
      return copy.sort(
        (a, b) =>
          (due(a)?.getTime() ?? Infinity) - (due(b)?.getTime() ?? Infinity),
      );
    case "due-desc":
      return copy.sort(
        (a, b) =>
          (due(b)?.getTime() ?? -Infinity) - (due(a)?.getTime() ?? -Infinity),
      );
    case "priority-desc":
      return copy.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    case "priority-asc":
      return copy.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    case "project":
      return copy.sort((a, b) => a.projectId.localeCompare(b.projectId));
  }
}

export type PostponePreset =
  "1h" | "evening" | "tomorrow" | "next-monday" | "next-week" | "custom";

/** Menu-bar counters over active tasks. Local aggregation; no such API. */
export function menuBarCounts(
  tasks: TaskLike[],
  now = new Date(),
): { todayRemaining: number; overdue: number; highPriority: number } {
  const start = startOfDay(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const active = tasks.filter((t) => !t.completed);
  const due = (t: TaskLike) =>
    t.dueDate ? new Date(t.dueDate).getTime() : undefined;
  return {
    todayRemaining: active.filter((t) => {
      const d = due(t);
      return d !== undefined && d >= start.getTime() && d <= end.getTime();
    }).length,
    overdue: active.filter((t) => {
      const d = due(t);
      return d !== undefined && d < start.getTime();
    }).length,
    highPriority: active.filter((t) => (t.priority ?? 0) >= 5).length,
  };
}

export function postpone(
  task: TaskLike,
  preset: PostponePreset,
  now = new Date(),
  custom?: Date,
): TaskLike {
  const d = due(task) ?? new Date(now);
  let next: Date;
  switch (preset) {
    case "1h":
      next = new Date(d.getTime() + 3600000);
      break;
    case "evening":
      next = new Date(d);
      next.setHours(18, 0, 0, 0);
      if (next <= d) next.setDate(next.getDate() + 1);
      break;
    case "tomorrow":
      next = new Date(d);
      next.setDate(next.getDate() + 1);
      break;
    case "next-monday":
      next = new Date(d);
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() !== 1);
      break;
    case "next-week":
      next = new Date(d);
      next.setDate(next.getDate() + 7);
      break;
    case "custom":
      next = custom ?? d;
      break;
  }
  return { ...task, dueDate: next.toISOString() };
}
