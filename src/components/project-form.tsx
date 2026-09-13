import { Form } from "@raycast/api";
import { VIEW_MODES } from "../api/projects";

export type ProjectFormValues = {
  name: string;
  color?: string;
  sortOrder?: string;
  viewMode: string;
  kind?: string;
};

export function ProjectFormFields({
  values,
  nameError,
}: {
  values?: Partial<ProjectFormValues>;
  nameError?: string;
}) {
  return (
    <>
      <Form.TextField
        id="name"
        title="Name"
        placeholder="My project"
        defaultValue={values?.name}
        error={nameError}
      />
      <Form.TextField
        id="color"
        title="Color"
        placeholder="#F18181"
        defaultValue={values?.color}
      />
      <Form.Dropdown
        id="viewMode"
        title="View Mode"
        defaultValue={values?.viewMode ?? "list"}
      >
        {VIEW_MODES.map((mode) => (
          <Form.Dropdown.Item
            key={mode}
            value={mode}
            title={mode[0].toUpperCase() + mode.slice(1)}
          />
        ))}
      </Form.Dropdown>
      <Form.Dropdown
        id="kind"
        title="Kind"
        defaultValue={values?.kind ?? "TASK"}
      >
        <Form.Dropdown.Item value="TASK" title="Task" />
        <Form.Dropdown.Item value="NOTE" title="Note" />
      </Form.Dropdown>
      <Form.TextField
        id="sortOrder"
        title="Sort Order"
        placeholder="Leave empty to sort at end"
        defaultValue={values?.sortOrder}
      />
    </>
  );
}
