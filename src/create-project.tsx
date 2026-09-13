import {
  Action,
  ActionPanel,
  Form,
  Toast,
  useNavigation,
  showToast,
} from "@raycast/api";
import { useState } from "react";
import { createProject } from "./api/projects";
import {
  ProjectFormFields,
  type ProjectFormValues,
} from "./components/project-form";

export default function CreateProject() {
  const { pop } = useNavigation();
  const [nameError, setNameError] = useState<string | undefined>();

  async function handleSubmit(values: ProjectFormValues) {
    if (!values.name || !values.name.trim()) {
      setNameError("Name is required");
      return;
    }
    await createProject(values);
    await showToast({ style: Toast.Style.Success, title: "项目已创建" });
    pop();
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create Project" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <ProjectFormFields nameError={nameError} />
    </Form>
  );
}
