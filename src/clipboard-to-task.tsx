import {
  Action,
  ActionPanel,
  Clipboard,
  Form,
  Icon,
  LocalStorage,
  getSelectedText,
  showHUD,
  Toast,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { createTask } from "./api/tasks";
import { getProjects } from "./api/projects";
import {
  parseClipboard,
  recordRecentTask,
  type ClipboardParse,
} from "./lib/storage";
import type { Project } from "./types/dida";

export default function ClipboardToTask() {
  const { pop } = useNavigation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [parsed, setParsed] = useState<ClipboardParse>({
    title: "",
    description: "",
  });

  useEffect(() => {
    (async () => {
      let text = "";
      try {
        text = (await getSelectedText()) ?? "";
      } catch {
        // no selection (or unsupported app): fall back to clipboard
      }
      if (!text.trim()) text = (await Clipboard.readText()) ?? "";
      setParsed(parseClipboard(text));
      try {
        setProjects(await getProjects());
      } catch {
        // project dropdown stays Inbox-only on error
      }
    })();
  }, []);

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title="Create Task"
            icon={Icon.Plus}
            onSubmit={async (values: {
              title: string;
              content?: string;
              projectId?: string;
            }) => {
              const title = values.title.trim();
              if (!title) {
                showToast({
                  style: Toast.Style.Failure,
                  title: "请填写标题",
                });
                return;
              }
              // keep URL at the end of the description so it is never lost
              const content =
                [values.content?.trim(), parsed.url]
                  .filter(Boolean)
                  .join("\n\n") || undefined;
              const created = await createTask({
                title,
                content,
                projectId: values.projectId || undefined,
              });
              await recordRecentTask(LocalStorage, created);
              await showHUD("Task created");
              pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="title"
        title="Title"
        defaultValue={parsed.title}
        storeValue
      />
      <Form.TextArea
        id="content"
        title="Description"
        defaultValue={parsed.description}
        storeValue
      />
      <Form.Dropdown id="projectId" title="Project" storeValue defaultValue="">
        <Form.Dropdown.Item value="" title="Inbox" />
        {projects.map((p) => (
          <Form.Dropdown.Item key={p.id} value={p.id} title={p.name} />
        ))}
      </Form.Dropdown>
    </Form>
  );
}
