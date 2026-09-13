import { Form, Action, ActionPanel, useNavigation } from "@raycast/api";

interface Props {
  projects: { id: string; name: string }[];
  initial?: {
    name: string;
    title: string;
    content?: string;
    projectId?: string;
    priority?: number;
  };
  onSave: (t: {
    name: string;
    title: string;
    content?: string;
    projectId?: string;
    priority?: number;
  }) => void;
}

export default function TemplateForm({ projects, initial, onSave }: Props) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Save Template"
            onSubmit={(values: {
              name: string;
              title: string;
              content?: string;
              projectId?: string;
              priority?: string;
            }) => {
              onSave({
                name: values.name,
                title: values.title,
                content: values.content || undefined,
                projectId: values.projectId || undefined,
                priority: values.priority ? Number(values.priority) : undefined,
              });
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="name"
        title="Template Name"
        defaultValue={initial?.name}
      />
      <Form.TextField
        id="title"
        title="Task Title"
        defaultValue={initial?.title}
      />
      <Form.TextArea
        id="content"
        title="Content"
        defaultValue={initial?.content}
      />
      <Form.Dropdown
        id="projectId"
        title="Project"
        defaultValue={initial?.projectId ?? ""}
      >
        <Form.Dropdown.Item value="" title="Inbox" />
        {projects.map((p) => (
          <Form.Dropdown.Item key={p.id} value={p.id} title={p.name} />
        ))}
      </Form.Dropdown>
      <Form.Dropdown
        id="priority"
        title="Priority"
        defaultValue={String(initial?.priority ?? "")}
      >
        <Form.Dropdown.Item value="" title="None" />
        <Form.Dropdown.Item value="0" title="Low" />
        <Form.Dropdown.Item value="3" title="Medium" />
        <Form.Dropdown.Item value="5" title="High" />
      </Form.Dropdown>
    </Form>
  );
}
