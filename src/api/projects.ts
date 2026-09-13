import { cacheGet, cacheSet, cacheInvalidate } from "../lib/cache";
import { getInboxProjectId } from "../lib/preferences";
import type {
  Project,
  ProjectData,
  ProjectKind,
  ProjectViewMode,
  Task,
} from "../types/dida";
import { request } from "./client";

export interface ProjectFormInput {
  name: string;
  color?: string;
  sortOrder?: string;
  viewMode?: string;
  kind?: string;
}

/** Official view modes per the Open API schema. */
export const VIEW_MODES = ["list", "kanban", "timeline"] as const;

function coerceSortOrder(value?: string): number | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new Error("排序值必须是数字");
  return n;
}

function coerceColor(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) throw new Error("颜色格式需为 #RRGGBB");
  return "#" + hex;
}

function coerceViewMode(value?: string): ProjectViewMode | undefined {
  if (!value) return undefined;
  if ((VIEW_MODES as readonly string[]).includes(value))
    return value as ProjectViewMode;
  throw new Error("视图模式只能是 list / kanban / timeline");
}

function coerceKind(value?: string): ProjectKind | undefined {
  if (!value) return undefined;
  if (value === "TASK" || value === "NOTE") return value;
  throw new Error("类型只能是 TASK / NOTE");
}

function toPayload(values: ProjectFormInput) {
  return {
    name: values.name.trim(),
    color: coerceColor(values.color),
    sortOrder: coerceSortOrder(values.sortOrder),
    viewMode: coerceViewMode(values.viewMode),
    kind: coerceKind(values.kind),
  };
}

async function mutate<T>(
  path: string,
  method: string,
  body?: unknown,
  invalidations: string[] = [],
): Promise<T> {
  const result = await request<T>(path, { method, body });
  await Promise.all(invalidations.map((p) => cacheInvalidate(p)));
  return result;
}

export async function getProjects(params?: {
  offset?: number;
  limit?: number;
}): Promise<Project[]> {
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 200;
  const key = "projects:" + offset + ":" + limit;
  const cached = await cacheGet<Project[]>(key);
  if (cached) return cached;
  const projects = await request<Project[]>(
    "/project?offset=" + offset + "&limit=" + limit,
  );
  await cacheSet(key, projects);
  return projects;
}

export async function getProject(projectId: string): Promise<Project> {
  const key = "project:" + projectId;
  const cached = await cacheGet<Project>(key);
  if (cached) return cached;
  const project = await request<Project>("/project/" + projectId);
  await cacheSet(key, project);
  return project;
}

export async function getProjectData(projectId: string): Promise<ProjectData> {
  const key = "project-data:" + projectId;
  const cached = await cacheGet<ProjectData>(key);
  if (cached) return cached;
  const data = await request<ProjectData>("/project/" + projectId + "/data");
  await cacheSet(key, data);
  return data;
}

export const getProjectWithData = getProjectData;

export async function createProject(
  values: ProjectFormInput,
): Promise<Project> {
  return mutate<Project>("/project", "POST", toPayload(values), ["projects"]);
}

export async function updateProject(
  projectId: string,
  values: ProjectFormInput,
): Promise<Project> {
  return mutate<Project>("/project/" + projectId, "POST", toPayload(values), [
    "projects",
    "project:" + projectId,
    "project-data:" + projectId,
  ]);
}

export async function deleteProject(projectId: string): Promise<void> {
  await mutate<void>("/project/" + projectId, "DELETE", undefined, [
    "projects",
    "project:" + projectId,
    "project-data:" + projectId,
  ]);
}

/**
 * Cross-project task aggregation. Open API has no global GET /tasks, so tasks
 * are fetched per project with bounded concurrency (default 4). Projects that
 * fail to load (e.g. deleted mid-request) are skipped.
 */
export async function aggregateTasks(
  concurrency = 4,
  inboxProjectId = getInboxProjectId(),
): Promise<Task[]> {
  const projects = await getProjects();
  const tasks: Task[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < projects.length) {
      const project = projects[index++];
      try {
        const data = await getProjectData(project.id);
        tasks.push(...(data.tasks ?? []));
      } catch {
        // skip unreadable project
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, projects.length) }, worker),
  );
  if (inboxProjectId) {
    try {
      const inboxData = await getProjectData(inboxProjectId);
      tasks.push(...(inboxData.tasks ?? []));
    } catch (err) {
      throw new Error(
        "Unable to load Inbox tasks. Check the Inbox Project ID in extension preferences. " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }
  return tasks;
}
