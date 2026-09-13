import {
  Action,
  ActionPanel,
  Icon,
  Keyboard,
  List,
  LocalStorage,
  showToast,
  Toast,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useEffect, useState } from "react";
import { aggregateTasks, getProjects } from "./api/projects";
import { getCompletedTasks } from "./api/tasks";
import { describeError } from "./lib/errors";
import { getInboxProjectId } from "./lib/preferences";
import type { Project, Task } from "./types/dida";
import {
  filterTasks,
  sortTasks,
  type TaskFilter,
  type TaskSort,
  type TaskView,
} from "./lib/tasks";
import {
  getFavoriteFilters,
  getFavoriteProjects,
  getRecentProjects,
  getRecentTasks,
} from "./lib/storage";
import CreateTask from "./create-task";
import QuickAddTask from "./quick-add-task";
import { TaskListItem } from "./components/task-list";
import { SettingsActions } from "./components/task-actions";

const VIEW_OPTIONS: Array<[TaskView, string]> = [
  ["all", "All Tasks"],
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["next7", "Next 7 Days"],
  ["overdue", "Overdue"],
  ["no-date", "No Date"],
  ["recent", "Recent"],
  ["completed", "Completed"],
];

const SORT_OPTIONS: Array<[TaskSort, string]> = [
  ["due-asc", "Due ↑"],
  ["due-desc", "Due ↓"],
  ["priority-desc", "Priority ↓"],
  ["priority-asc", "Priority ↑"],
  ["project", "Project"],
];

function launchFilter(props: {
  launchContext?: { filter?: string };
  arguments?: string[];
}): string {
  const arg = props.arguments?.[0];
  const ctx = props.launchContext?.filter;
  return arg ?? ctx ?? "";
}

function initialSelection(raw: string): string {
  if (!raw) return "view:all";
  if (VIEW_OPTIONS.some(([v]) => v === raw)) return "view:" + raw;
  if (raw.startsWith("priority:")) return raw;
  if (raw === "high") return "priority:5";
  return "name:" + raw; // resolved to a project id once projects load
}

export default function Tasks(props: {
  launchContext?: { filter?: string };
  arguments?: string[];
}) {
  const [selected, setSelected] = useState(() =>
    initialSelection(launchFilter(props)),
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<TaskSort>("due-asc");
  const [selection, setSelection] = useState<Set<string>>(new Set());

  const {
    data: rawTasks = [],
    isLoading,
    mutate,
    error,
  } = useCachedPromise(aggregateTasks);
  const { data: projects = [] } = useCachedPromise(getProjects);
  const { data: pins } = useCachedPromise(async () =>
    Promise.all([
      getFavoriteProjects(LocalStorage),
      getRecentProjects(LocalStorage),
      getFavoriteFilters(LocalStorage),
      getRecentTasks(LocalStorage),
    ]),
  );
  const favFilters = pins?.[2] ?? [];
  const recentTasks = pins?.[3] ?? [];

  const inboxProjectId = getInboxProjectId();
  const projectsWithInbox: Project[] =
    inboxProjectId && !projects.some((p) => p.id === inboxProjectId)
      ? [{ id: inboxProjectId, name: "Inbox" }, ...projects]
      : projects;

  // Launch argument may be a project name; resolve it once projects are loaded.
  const pending = selected.startsWith("name:") ? selected.slice(5) : null;
  const resolved = pending
    ? "project:" +
      (projectsWithInbox.find(
        (p: Project) =>
          p.name === pending || p.name.toLowerCase() === pending.toLowerCase(),
      )?.id ?? "")
    : selected;

  const tasks: Task[] = rawTasks.map((t) => ({
    ...t,
    completed: t.status === 2,
  }));

  const [kind, key] = resolved.split(":");
  const filter: TaskFilter = query.trim()
    ? { view: "text", query: query.trim() }
    : kind === "view"
      ? { view: key as TaskView }
      : kind === "project"
        ? { view: "project", projectId: key }
        : { view: "priority", priority: Number(key) };
  const isRecent = kind === "view" && key === "recent";
  const isCompletedView = kind === "view" && key === "completed";
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedReload, setCompletedReload] = useState(0);

  // /project/{id}/data returns undone tasks only, so the Completed view reads
  // the public POST /task/completed endpoint instead.
  useEffect(() => {
    if (!isCompletedView) return;
    let cancelled = false;
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    setCompletedLoading(true);
    getCompletedTasks({
      projectIds: projectsWithInbox.map((p) => p.id).filter(Boolean),
      start,
      end,
    })
      .then((rows) => {
        if (cancelled) return;
        setCompletedTasks(rows.map((t) => ({ ...t, completed: true })));
        if (rows.length >= 200)
          void showToast({
            style: Toast.Style.Failure,
            title: "已完成任务达到 200 条上限",
            message: "仅显示最近 30 天内最多 200 条。",
          });
      })
      .catch((e) => {
        if (cancelled) return;
        setCompletedTasks([]);
        void showToast({
          style: Toast.Style.Failure,
          title: "加载已完成任务失败",
          message: describeError(e).description,
        });
      })
      .finally(() => {
        if (!cancelled) setCompletedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCompletedView, projectsWithInbox.length, completedReload]);
  const visible: Task[] = isRecent
    ? recentTasks
        .map((r) => tasks.find((t) => t.id === r.id))
        .filter((t): t is Task => Boolean(t && t.status !== 2))
    : isCompletedView
      ? sortTasks(filterTasks(completedTasks, { view: "completed" }), sort)
      : sortTasks(filterTasks(tasks, filter), sort);
  const selectedTasks = visible.filter((t) => selection.has(t.id));

  // The Completed view reads a different endpoint, so refresh both sources.
  function refresh() {
    mutate();
    if (isCompletedView) setCompletedReload((k) => k + 1);
  }

  function toggle(id: string) {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Favorites first, then recently used, then the rest.
  const orderedProjects: Project[] = (() => {
    const favs = pins?.[0] ?? [];
    const recents = pins?.[1] ?? [];
    const byId = new Map(projectsWithInbox.map((p) => [p.id, p]));
    const head = [...favs, ...recents]
      .map((id) => byId.get(id))
      .filter((p): p is Project => Boolean(p));
    const seen = new Set(head.map((p) => p.id));
    return [...head, ...projectsWithInbox.filter((p) => !seen.has(p.id))];
  })();

  const emptyTitle = query.trim()
    ? "No matching tasks"
    : isCompletedView
      ? "No completed tasks"
      : (VIEW_OPTIONS.find(([v]) => v === key)?.[1] ?? "No tasks");

  return (
    <List
      isLoading={isLoading || completedLoading}
      searchBarPlaceholder="Search tasks..."
      onSearchTextChange={setQuery}
      searchBarAccessory={
        <List.Dropdown
          tooltip="Filter"
          value={pending ? undefined : resolved}
          onChange={setSelected}
          storeValue
        >
          {favFilters.length > 0 && (
            <List.Dropdown.Section title="Favorites">
              {favFilters.map((f) => (
                <List.Dropdown.Item
                  key={f.view}
                  value={
                    f.view.startsWith("priority:") ? f.view : "view:" + f.view
                  }
                  title={f.label}
                />
              ))}
            </List.Dropdown.Section>
          )}
          <List.Dropdown.Section title="Views">
            {VIEW_OPTIONS.map(([v, title]) => (
              <List.Dropdown.Item key={v} value={"view:" + v} title={title} />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Projects">
            {orderedProjects.map((p: Project) => (
              <List.Dropdown.Item
                key={p.id}
                value={"project:" + p.id}
                title={p.name}
              />
            ))}
          </List.Dropdown.Section>
          <List.Dropdown.Section title="Priority">
            <List.Dropdown.Item value="priority:5" title="High" />
            <List.Dropdown.Item value="priority:3" title="Medium" />
            <List.Dropdown.Item value="priority:1" title="Low" />
            <List.Dropdown.Item value="priority:0" title="None" />
          </List.Dropdown.Section>
        </List.Dropdown>
      }
      actions={
        <ActionPanel>
          {visible.length === 0 ? (
            <Action.Push
              title="Create Task"
              icon={Icon.PlusSquare}
              shortcut={Keyboard.Shortcut.Common.New}
              target={<CreateTask />}
            />
          ) : (
            <>
              <Action.Push
                title="Quick Add Task"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                target={<QuickAddTask />}
              />
              <Action.Push
                title="Create Task (Full Form)"
                icon={Icon.PlusSquare}
                target={<CreateTask />}
              />
            </>
          )}
          <ActionPanel.Submenu title="Sort by" icon={Icon.ArrowUp}>
            {SORT_OPTIONS.map(([s, title]) => (
              <Action key={s} title={title} onAction={() => setSort(s)} />
            ))}
          </ActionPanel.Submenu>
          <SettingsActions />
          {selection.size > 0 && (
            <Action
              title="Clear Selection"
              icon={Icon.XMarkCircle}
              onAction={() => setSelection(new Set())}
            />
          )}
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={refresh}
          />
        </ActionPanel>
      }
    >
      {error && (
        <List.EmptyView
          title="Failed to load tasks"
          description={describeError(error).description}
        />
      )}
      {!isLoading && !completedLoading && visible.length === 0 && !error && (
        <List.EmptyView
          title={emptyTitle}
          description={
            isCompletedView
              ? "Tasks completed in the last 30 days appear here."
              : "⌘N to create task"
          }
        />
      )}
      {visible.map((task) => (
        <TaskListItem
          key={task.id}
          task={task}
          projects={projectsWithInbox}
          mutate={refresh}
          selection={selection}
          selectedTasks={selectedTasks}
          onToggle={toggle}
          onClearSelection={() => setSelection(new Set())}
        />
      ))}
    </List>
  );
}
