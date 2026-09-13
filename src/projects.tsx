import { Action, ActionPanel, Icon, List, Keyboard } from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { useState } from "react";
import { getProjects } from "./api/projects";
import { describeError } from "./lib/errors";
import { hexToRaycastColor, viewModeLabel } from "./lib/project-display";
import type { Project } from "./types/dida";
import {
  CreateProjectAction,
  DeleteProjectAction,
  EditProjectAction,
  ProjectDetailPushAction,
} from "./components/project-actions";

export default function Projects() {
  const [search, setSearch] = useState("");
  const {
    data: projects,
    isLoading,
    mutate,
    error,
  } = useCachedPromise(getProjects);

  const filtered = (projects ?? []).filter((p: Project) =>
    p.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <List
      isLoading={isLoading}
      searchBarPlaceholder="Filter projects..."
      onSearchTextChange={setSearch}
      actions={
        <ActionPanel>
          <CreateProjectAction />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={() => mutate()}
          />
        </ActionPanel>
      }
    >
      {error && (
        <List.EmptyView
          title="Failed to load projects"
          description={describeError(error).description}
        />
      )}
      {!isLoading && filtered.length === 0 && !error && (
        <List.EmptyView
          title="No projects"
          description="Create your first project to get started."
        />
      )}
      {filtered.map((project: Project) => (
        <List.Item
          key={project.id}
          title={project.name}
          subtitle={viewModeLabel(project.viewMode)}
          accessories={
            project.color && hexToRaycastColor(project.color)
              ? [
                  {
                    icon: {
                      source: Icon.Circle,
                      tintColor: hexToRaycastColor(project.color),
                    },
                  },
                ]
              : []
          }
          actions={
            <ActionPanel>
              <ProjectDetailPushAction project={project} />
              <EditProjectAction project={project} mutate={mutate} />
              <DeleteProjectAction project={project} mutate={mutate} />
              <Action.CopyToClipboard
                title="Copy Project ID"
                content={project.id}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
