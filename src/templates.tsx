import {
  Action,
  ActionPanel,
  Icon,
  List,
  LocalStorage,
  confirmAlert,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { createTask } from "./api/tasks";
import { getProjects } from "./api/projects";
import {
  deleteTemplate,
  recordRecentTask,
  getTemplates,
  saveTemplate,
  type TaskTemplate as StoredTemplate,
} from "./lib/storage";
import TemplateForm from "./components/template-form";

interface Template extends StoredTemplate {
  projectId?: string;
  custom?: boolean;
}

const FAV_KEY = "favorite-templates";

const BUILT_IN: Template[] = [
  {
    id: "builtin-daily",
    name: "日报",
    title: "写日报",
    content: "- 今天完成\n- 明天计划\n- 需要协调",
  },
  {
    id: "builtin-weekly",
    name: "周报",
    title: "写周报",
    content: "- 本周进展\n- 下周计划\n- 风险与求助",
  },
  { id: "builtin-shopping", name: "购物", title: "购物清单" },
  {
    id: "builtin-study",
    name: "学习",
    title: "学习",
    content: "- 主题\n- 时长\n- 笔记",
  },
  {
    id: "builtin-meeting",
    name: "会议准备",
    title: "会议准备",
    content: "- 议程\n- 参会人\n- 材料",
  },
];

export default function Templates() {
  const { push } = useNavigation();
  const [custom, setCustom] = useState<Template[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    (async () => {
      setCustom(await getTemplates(LocalStorage as never));
      setFavs(
        JSON.parse((await LocalStorage.getItem<string>(FAV_KEY)) ?? "[]"),
      );
      try {
        setProjects(
          (await getProjects()).map((p) => ({ id: p.id, name: p.name })),
        );
      } catch {
        // templates stay usable without the project list
      }
    })();
  }, []);

  const persistFavs = (ids: string[]) => {
    setFavs(ids);
    LocalStorage.setItem(FAV_KEY, JSON.stringify(ids));
  };

  const upsert = async (t: Template) => {
    await saveTemplate(LocalStorage as never, t);
    setCustom((await getTemplates(LocalStorage as never)) as Template[]);
  };

  const all = [...BUILT_IN, ...custom];
  const sorted = [...all].sort(
    (a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)),
  );

  return (
    <List
      actions={
        <ActionPanel>
          <Action
            title="New Template"
            icon={Icon.Plus}
            onAction={() =>
              push(
                <TemplateForm
                  projects={projects}
                  onSave={(t) =>
                    upsert({ ...t, id: crypto.randomUUID(), custom: true })
                  }
                />,
              )
            }
          />
        </ActionPanel>
      }
    >
      {sorted.map((t) => (
        <List.Item
          key={t.id}
          title={t.name}
          subtitle={t.title}
          accessories={[
            ...(favs.includes(t.id) ? [{ icon: Icon.Star }] : []),
            { tag: t.custom ? "custom" : "built-in" },
          ]}
          actions={
            <ActionPanel>
              <Action
                title="Apply"
                icon={Icon.Check}
                onAction={async () => {
                  const task = await createTask({
                    title: t.title,
                    content: t.content,
                    projectId: t.projectId,
                    priority: t.priority,
                  });
                  if (task) await recordRecentTask(LocalStorage, task);
                  await showToast({
                    style: Toast.Style.Success,
                    title: "已创建：" + t.title,
                  });
                }}
              />
              <Action
                title={favs.includes(t.id) ? "Unfavorite" : "Favorite"}
                icon={Icon.Star}
                onAction={() =>
                  persistFavs(
                    favs.includes(t.id)
                      ? favs.filter((f) => f !== t.id)
                      : [...favs, t.id],
                  )
                }
              />
              <Action
                title="Edit"
                icon={Icon.Pencil}
                onAction={() =>
                  push(
                    <TemplateForm
                      projects={projects}
                      initial={t}
                      onSave={(u) =>
                        upsert(
                          t.custom
                            ? { ...t, ...u }
                            : { ...u, id: crypto.randomUUID(), custom: true },
                        )
                      }
                    />,
                  )
                }
              />
              {t.custom && (
                <Action
                  title="Delete Template"
                  icon={Icon.Trash}
                  style={Action.Style.Destructive}
                  onAction={async () => {
                    if (
                      !(await confirmAlert({
                        title: "删除模板？",
                        message: "确定删除「" + t.name + "」？此操作不可撤销。",
                      }))
                    )
                      return;
                    await deleteTemplate(LocalStorage as never, t.id);
                    setCustom(
                      (await getTemplates(LocalStorage as never)) as Template[],
                    );
                  }}
                />
              )}
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
