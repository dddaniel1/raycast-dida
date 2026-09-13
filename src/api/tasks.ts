import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import type { ChecklistItem, Task } from "../types/dida";
import { request } from "./client";

export interface TaskInput {
  title: string;
  projectId?: string;
  content?: string;
  desc?: string;
  priority?: number;
  startDate?: number;
  dueDate?: number;
  isAllDay?: boolean;
  timeZone?: string;
  reminders?: string[];
  repeatFlag?: string;
  sortOrder?: number;
  items?: ChecklistItem[];
}

export type TaskPatch = Partial<TaskInput> & { projectId: string };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Documented format: yyyy-MM-dd'T'HH:mm:ssZ (example 2019-11-13T03:00:00+0000). */
function dateToIso(ms: number, withMs = false): string {
  const d = new Date(ms);
  const minutes = -d.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const offset =
    sign +
    pad(Math.floor(Math.abs(minutes) / 60)) +
    pad(Math.abs(minutes) % 60);
  const base =
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
    pad(d.getSeconds());
  if (!withMs) return base + offset;
  // Doc example for /task/completed carries .SSS milliseconds before the offset.
  return base + "." + String(d.getMilliseconds()).padStart(3, "0") + offset;
}

/**
 * Serialize outgoing task bodies. Dates become ISO strings; checklist item
 * done is status 1 (task-level completed is 2, per the Definitions section).
 */
function toApiTask(input: Partial<TaskInput>) {
  return {
    title: input.title,
    projectId: input.projectId,
    content: input.content,
    desc: input.desc,
    priority: input.priority,
    startDate:
      input.startDate !== undefined ? dateToIso(input.startDate) : undefined,
    dueDate: input.dueDate !== undefined ? dateToIso(input.dueDate) : undefined,
    isAllDay: input.isAllDay,
    timeZone: input.timeZone,
    reminders: input.reminders,
    repeatFlag: input.repeatFlag,
    sortOrder: input.sortOrder,
    items: input.items?.map((it) => ({
      ...it,
      status: it.status === 1 || it.status === 2 ? 1 : 0,
    })),
  };
}

function invalidateForTask(projectId: string): Promise<void>[] {
  return [
    cacheInvalidate("project-data:" + projectId),
    cacheInvalidate("task:"),
  ];
}

export async function createTask(input: TaskInput): Promise<Task> {
  const task = await request<Task>("/task", {
    method: "POST",
    body: toApiTask(input),
  });
  await Promise.all(invalidateForTask(task.projectId || input.projectId || ""));
  return task;
}

export async function getTask(
  projectId: string,
  taskId: string,
): Promise<Task> {
  const key = "task:" + projectId + ":" + taskId;
  const cached = await cacheGet<Task>(key);
  if (cached) return cached;
  const task = await request<Task>("/project/" + projectId + "/task/" + taskId);
  await cacheSet(key, task);
  return task;
}

/** Update body must carry both id and projectId per the documented schema. */
export async function updateTask(
  projectId: string,
  taskId: string,
  patch: TaskPatch,
): Promise<Task> {
  const body = {
    ...toApiTask(patch),
    id: taskId,
  };
  const task = await request<Task>("/task/" + taskId, { method: "POST", body });
  await Promise.all(invalidateForTask(projectId));
  return task;
}

export async function completeTask(
  projectId: string,
  taskId: string,
): Promise<void> {
  await request<void>(
    "/project/" + projectId + "/task/" + taskId + "/complete",
    { method: "POST" },
  );
  await Promise.all(invalidateForTask(projectId));
}

/**
 * The public docs define no uncomplete endpoint; reopening a task goes
 * through the documented task update (POST /task/{taskId}) with status 0.
 */
export async function uncompleteTask(
  projectId: string,
  taskId: string,
): Promise<Task> {
  const task = await request<Task>("/task/" + taskId, {
    method: "POST",
    body: { id: taskId, projectId, status: 0 },
  });
  await Promise.all(invalidateForTask(projectId));
  return task;
}

export async function deleteTask(
  projectId: string,
  taskId: string,
): Promise<void> {
  await request<void>("/project/" + projectId + "/task/" + taskId, {
    method: "DELETE",
  });
  await Promise.all(invalidateForTask(projectId));
}

// ---- Public V2 endpoints (schemas verified at developer.dida365.com/docs#/openapi) ----

export interface CompleteTasksBody {
  projectId?: string;
  taskIds: string[];
}

/** Max 50 ids, same project. Returns the completed task ids. */
export async function completeTasks(
  body: CompleteTasksBody,
): Promise<string[]> {
  const taskIds = body.taskIds.slice(0, 50);
  const result = await request<string[]>("/task/completeTasks", {
    method: "POST",
    body: { projectId: body.projectId, taskIds },
  });
  await cacheInvalidate(
    body.projectId ? "project-data:" + body.projectId : "project-data:",
  );
  return result ?? [];
}

export interface MoveTaskItem {
  fromProjectId: string;
  toProjectId: string;
  taskId: string;
}

export interface MoveTaskResult {
  id: string;
  etag: string;
}

export async function moveTasks(
  items: MoveTaskItem[],
): Promise<MoveTaskResult[]> {
  const result = await request<MoveTaskResult[]>("/task/move", {
    method: "POST",
    body: items,
  });
  const prefixes = [
    ...new Set(items.flatMap((m) => [m.fromProjectId, m.toProjectId])),
  ];
  await Promise.all(prefixes.map((p) => cacheInvalidate("project-data:" + p)));
  return result ?? [];
}

export interface BatchTasksBody {
  add?: TaskInput[];
  update?: Array<Partial<TaskInput> & { id: string; projectId: string }>;
}

export interface BatchTasksResult {
  id2etag: Record<string, string>;
  id2error: Record<string, string>;
}

/** Documented max: 50 adds + 50 updates per call. */
export async function batchTasks(
  body: BatchTasksBody,
): Promise<BatchTasksResult> {
  const result = await request<BatchTasksResult>("/task/batch", {
    method: "POST",
    body: {
      add: body.add?.slice(0, 50).map(toApiTask),
      update: body.update
        ?.slice(0, 50)
        .map((u) => ({ ...toApiTask(u), id: u.id })),
    },
  });
  await cacheInvalidate("project-data:");
  return result ?? { id2etag: {}, id2error: {} };
}

export interface CompletedTasksQuery {
  projectIds?: string[];
  start?: Date;
  end?: Date;
}

/** Up to 200 completed tasks in the range. */
export async function getCompletedTasks(
  query: CompletedTasksQuery = {},
): Promise<Task[]> {
  const result = await request<Task[]>("/task/completed", {
    method: "POST",
    body: {
      projectIds: query.projectIds,
      startDate: query.start
        ? dateToIso(query.start.getTime(), true)
        : undefined,
      endDate: query.end ? dateToIso(query.end.getTime(), true) : undefined,
    },
  });
  return result ?? [];
}
