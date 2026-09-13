/**
 * Clipboard / local-model helpers. Raycast LocalStorage is only used at the
 * command layer; these functions are pure or injected so they stay testable.
 */

import { isOverdue } from "./dates.ts";
import type { TaskLike } from "./tasks.ts";

export interface ClipboardParse {
  title: string;
  description: string;
  url?: string;
}

const URL_RE = /https?:\/\/[^\s)]+/;

/** First line = title, rest = description, first URL promoted to url field. */
export function parseClipboard(text: string): ClipboardParse {
  const trimmed = text.trim();
  const lines = trimmed.split(/\r?\n/);
  const url = trimmed.match(URL_RE)?.[0];
  const title = lines[0]?.replace(URL_RE, "").trim() || url || "";
  const description = lines.slice(1).join("\n").trim();
  return { title, description, url };
}

export interface LocalStore {
  getItem(key: string): Promise<string | undefined>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface TaskTemplateStatsTask {
  completedTime?: number;
  dueDate?: string;
}

async function getJson<T>(
  store: LocalStore,
  key: string,
  fallback: T,
): Promise<T> {
  const raw = await store.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function recordProjectVisit(
  store: LocalStore,
  projectId: string,
): Promise<void> {
  const cur = await getJson<string[]>(store, "recent-projects", []);
  const next = [projectId, ...cur.filter((id) => id !== projectId)].slice(
    0,
    10,
  );
  await store.setItem("recent-projects", JSON.stringify(next));
}

export async function getRecentProjects(store: LocalStore): Promise<string[]> {
  return getJson<string[]>(store, "recent-projects", []);
}

export async function toggleFavoriteProject(
  store: LocalStore,
  projectId: string,
): Promise<void> {
  const cur = await getJson<string[]>(store, "favorite-projects", []);
  const next = cur.includes(projectId)
    ? cur.filter((id) => id !== projectId)
    : [projectId, ...cur];
  await store.setItem("favorite-projects", JSON.stringify(next));
}

export async function getFavoriteProjects(
  store: LocalStore,
): Promise<string[]> {
  return getJson<string[]>(store, "favorite-projects", []);
}

export interface RecentTask {
  id: string;
  projectId: string;
  title: string;
  createdAt: number;
}

export async function recordRecentTask(
  store: LocalStore,
  task: TaskLike,
): Promise<void> {
  const cur = await getJson<RecentTask[]>(store, "recent-tasks", []);
  const next = [
    {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      createdAt: Date.now(),
    },
    ...cur.filter((t) => t.id !== task.id),
  ].slice(0, 20);
  await store.setItem("recent-tasks", JSON.stringify(next));
}

export async function getRecentTasks(store: LocalStore): Promise<RecentTask[]> {
  return getJson<RecentTask[]>(store, "recent-tasks", []);
}

export interface FavoriteFilter {
  view: string;
  label: string;
}

export async function toggleFavoriteFilter(
  store: LocalStore,
  view: string,
  label: string,
): Promise<void> {
  const cur = await getJson<FavoriteFilter[]>(store, "favorite-filters", []);
  const next = cur.some((f) => f.view === view)
    ? cur.filter((f) => f.view !== view)
    : [...cur, { view, label }];
  await store.setItem("favorite-filters", JSON.stringify(next));
}

export async function getFavoriteFilters(
  store: LocalStore,
): Promise<FavoriteFilter[]> {
  return getJson<FavoriteFilter[]>(store, "favorite-filters", []);
}

export interface TaskTemplate {
  id: string;
  name: string;
  title: string;
  content?: string;
  priority?: number;
}

export async function getTemplates(store: LocalStore): Promise<TaskTemplate[]> {
  return getJson<TaskTemplate[]>(store, "templates", []);
}

export async function saveTemplate(
  store: LocalStore,
  template: TaskTemplate,
): Promise<void> {
  const cur = await getJson<TaskTemplate[]>(store, "templates", []);
  await store.setItem(
    "templates",
    JSON.stringify([...cur.filter((t) => t.id !== template.id), template]),
  );
}

export async function deleteTemplate(
  store: LocalStore,
  id: string,
): Promise<void> {
  const cur = await getJson<TaskTemplate[]>(store, "templates", []);
  await store.setItem(
    "templates",
    JSON.stringify(cur.filter((t) => t.id !== id)),
  );
}

// --- Statistics (pure; caller passes tasks) ---

export interface TaskStats {
  todayCompleted: number;
  weekCompleted: number;
  overdue: number;
  byProject: Record<string, number>;
  byPriority: Record<number, number>;
}

export function computeStats(tasks: TaskLike[], now = new Date()): TaskStats {
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const stats: TaskStats = {
    todayCompleted: 0,
    weekCompleted: 0,
    overdue: 0,
    byProject: {},
    byPriority: {},
  };
  for (const t of tasks) {
    if (t.completed) {
      // ponytail: completedTime when present; project-data payload has no completed
      // history, so dueDate stays as proxy fallback until a completed-tasks wrapper lands
      const d = t.completedTime
        ? new Date(t.completedTime)
        : t.dueDate
          ? new Date(t.dueDate)
          : null;
      if (d) {
        if (d >= todayStart) stats.todayCompleted++;
        if (d >= weekStart && d <= now) stats.weekCompleted++;
      }
      continue;
    }
    if (t.dueDate && isOverdue(new Date(t.dueDate), now)) stats.overdue++;
    stats.byProject[t.projectId] = (stats.byProject[t.projectId] ?? 0) + 1;
    const p = t.priority ?? 0;
    stats.byPriority[p] = (stats.byPriority[p] ?? 0) + 1;
  }
  return stats;
}
