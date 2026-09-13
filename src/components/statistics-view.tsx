import { Action, ActionPanel, Detail, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { getProjects, getProjectData } from "../api/projects";
import { getCompletedTasks } from "../api/tasks";
import { computeStats } from "../lib/storage";
import { describeError } from "../lib/errors";
import { renderStatsMarkdown } from "../lib/statistics-markdown";
import { mapLimit, type TaskLike } from "../lib/tasks";

type RawTask = {
  id: string;
  title: string;
  projectId: string;
  dueDate?: number | string;
  priority?: number;
  status?: number;
  completed?: boolean;
  completedTime?: number | string;
};

function toTaskLike(t: RawTask): TaskLike {
  return {
    id: t.id,
    title: t.title,
    projectId: t.projectId,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
    priority: t.priority,
    completed: t.completed ?? t.status === 2,
  };
}

function toDoneTaskLike(t: RawTask): TaskLike {
  return {
    id: t.id,
    title: t.title,
    projectId: t.projectId,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
    completedTime:
      typeof t.completedTime === "number"
        ? t.completedTime
        : t.completedTime
          ? new Date(t.completedTime).getTime()
          : undefined,
    priority: t.priority,
    completed: true,
  };
}

export default function StatisticsView() {
  const [tasks, setTasks] = useState<TaskLike[]>([]);
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [scope, setScope] = useState<string | undefined>();
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const projects = await getProjects();
        setProjectNames(
          Object.fromEntries(projects.map((p) => [p.id, p.name])),
        );
        const active = await mapLimit(projects, 4, (p) =>
          getProjectData(p.id).then((d) =>
            ((d as { tasks?: RawTask[] }).tasks ?? []).map(toTaskLike),
          ),
        );
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
        weekStart.setHours(0, 0, 0, 0);
        const done = await getCompletedTasks({
          projectIds: projects.map((p) => p.id),
          start: weekStart,
          end: now,
        });
        setTasks([...active.flat(), ...done.map(toDoneTaskLike)]);
        if (done.length >= 200)
          setScope("已完成任务达到单次 200 条上限，今日/本周计数可能偏低");
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadKey]);

  if (loading) return <List isLoading />;

  if (error) {
    const info = describeError(error);
    return (
      <Detail
        markdown={"## Failed to load statistics\n\n" + info.description}
        actions={
          <ActionPanel>
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={() => {
                setLoading(true);
                setError(undefined);
                setScope(undefined);
                setReloadKey((k) => k + 1);
              }}
            />
          </ActionPanel>
        }
      />
    );
  }

  const stats = computeStats(tasks);

  const markdown = renderStatsMarkdown(stats, projectNames);
  const full = [scope ? `> ⚠️ ${scope}` : undefined, markdown]
    .filter(Boolean)
    .join("\n\n");

  return (
    <Detail
      markdown={full}
      actions={
        <ActionPanel>
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            onAction={() => {
              setLoading(true);
              setError(undefined);
              setScope(undefined);
              setReloadKey((k) => k + 1);
            }}
          />
        </ActionPanel>
      }
    />
  );
}
