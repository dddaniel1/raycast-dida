import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getProjectWithData } from "../api/projects";
import { colorName, viewModeLabel } from "../lib/project-display";
import type { Column, Project, Task } from "../types/dida";

export function ProjectDetail({ project }: { project: Project }) {
  const { data, isLoading } = useCachedPromise(getProjectWithData, [
    project.id,
  ]);
  const tasks = data?.tasks ?? [];
  const columns = data?.columns ?? [];

  const lines = [
    "# " + project.name,
    "",
    project.viewMode ? "- View Mode: " + viewModeLabel(project.viewMode) : "",
    project.color && colorName(project.color)
      ? "- Color: " + colorName(project.color)
      : "",
    "",
    "Tasks: " + tasks.length,
  ].filter((l) => l !== "");

  return (
    <List isLoading={isLoading} navigationTitle={project.name}>
      <List.Item
        title="Overview"
        icon={Icon.Info}
        detail={<List.Item.Detail markdown={lines.join("\n")} />}
        actions={
          <ActionPanel>
            <Action.CopyToClipboard
              title="Copy Project ID"
              content={project.id}
            />
          </ActionPanel>
        }
      />
      {columns.length > 0 && (
        <List.Section title="Columns">
          {columns.map((col: Column) => (
            <List.Item
              key={col.id}
              title={col.name ?? col.id}
              subtitle={
                col.sortOrder != null
                  ? "order " + String(col.sortOrder)
                  : undefined
              }
            />
          ))}
        </List.Section>
      )}
      <List.Section title={"Tasks (" + tasks.length + ")"}>
        {tasks.length === 0 && <List.Item title="No tasks in this project" />}
        {tasks.map((task: Task) => (
          <List.Item
            key={task.id}
            title={task.title}
            subtitle={
              task.dueDate ? new Date(task.dueDate).toLocaleString() : undefined
            }
          />
        ))}
      </List.Section>
    </List>
  );
}
