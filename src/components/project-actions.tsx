import {
  Action,
  ActionPanel,
  confirmAlert,
  Form,
  Icon,
  Toast,
  showToast,
  useNavigation,
  Keyboard,
} from "@raycast/api";
import type { Project } from "../types/dida";
import { deleteProject, updateProject } from "../api/projects";
import { ProjectFormFields, type ProjectFormValues } from "./project-form";
import CreateProject from "../create-project";
import { ProjectDetail } from "./project-detail";

export function ProjectDetailPushAction({ project }: { project: Project }) {
  return (
    <Action.Push
      title="Show Details"
      icon={Icon.Sidebar}
      target={<ProjectDetail project={project} />}
    />
  );
}

export function CreateProjectAction() {
  return (
    <Action.Push
      title="Create Project"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<CreateProject />}
    />
  );
}

export function EditProjectAction({
  project,
  mutate,
}: {
  project: Project;
  mutate: () => void;
}) {
  const { pop } = useNavigation();

  async function handleSubmit(values: ProjectFormValues) {
    await updateProject(project.id, values);
    await showToast({ style: Toast.Style.Success, title: "项目已更新" });
    pop();
    mutate();
  }

  return (
    <Action.Push
      title="Edit Project"
      icon={Icon.Pencil}
      shortcut={Keyboard.Shortcut.Common.Edit}
      target={
        <Form
          actions={
            <ActionPanel>
              <Action.SubmitForm title="Save Changes" onSubmit={handleSubmit} />
            </ActionPanel>
          }
        >
          <ProjectFormFields
            values={{
              name: project.name,
              color: project.color,
              viewMode: project.viewMode,
              kind: project.kind,
              sortOrder:
                project.sortOrder != null
                  ? String(project.sortOrder)
                  : undefined,
            }}
          />
        </Form>
      }
    />
  );
}

export function DeleteProjectAction({
  project,
  mutate,
}: {
  project: Project;
  mutate: () => void;
}) {
  async function handleDelete() {
    if (
      !(await confirmAlert({
        title: "删除项目？",
        message: "确定删除「" + project.name + "」？此操作不可撤销。",
      }))
    ) {
      return;
    }
    await deleteProject(project.id);
    await showToast({ style: Toast.Style.Success, title: "项目已删除" });
    mutate();
  }

  return (
    <Action
      title="Delete Project"
      icon={Icon.Trash}
      style={Action.Style.Destructive}
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
      onAction={handleDelete}
    />
  );
}

export function CopyProjectIdAction({ project }: { project: Project }) {
  return (
    <Action.CopyToClipboard title="Copy Project ID" content={project.id} />
  );
}
