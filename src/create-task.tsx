import {
  Action,
  ActionPanel,
  Form,
  LocalStorage,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import { getProjects } from "./api/projects";
import { createTask } from "./api/tasks";
import { recordProjectVisit, recordRecentTask } from "./lib/storage";
import { TaskFormFields, formToTaskInput } from "./components/task-form";

export default function CreateTask() {
  const { pop } = useNavigation();
  const { data: projects = [], isLoading } = useCachedPromise(getProjects);

  async function handleSubmit(values: Record<string, unknown>) {
    const input = formToTaskInput(values);
    const task = await createTask(input);
    if (task) await recordRecentTask(LocalStorage, task);
    await showToast({ style: Toast.Style.Success, title: "任务已创建" });
    if (input.projectId)
      await recordProjectVisit(LocalStorage, input.projectId);
    pop();
  }

  return (
    <Form
      isLoading={isLoading}
      navigationTitle="Create Task"
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Task" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <TaskFormFields projects={projects} />
    </Form>
  );
}
