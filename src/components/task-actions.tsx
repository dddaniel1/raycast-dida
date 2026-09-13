import {
  Action,
  ActionPanel,
  Icon,
  Form,
  confirmAlert,
  showToast,
  Toast,
  useNavigation,
  Keyboard,
  openExtensionPreferences,
} from "@raycast/api";
import type { Project, Task } from "../types/dida";
import {
  batchTasks,
  completeTask,
  completeTasks,
  deleteTask,
  moveTasks,
  uncompleteTask,
  updateTask,
} from "../api/tasks";
import {
  mapLimit,
  postpone,
  type PostponePreset,
  type TaskLike,
} from "../lib/tasks";
import {
  PRIORITY_LABEL,
  TaskFormFields,
  formToTaskInput,
  taskToFormValues,
} from "./task-form";
import { TaskDetail } from "./task-detail";
import { validateToken } from "../api/client";

async function toast(title: string) {
  await showToast({ style: Toast.Style.Success, title });
}

async function validateApiToken() {
  try {
    await validateToken();
    await showToast({
      style: Toast.Style.Success,
      title: "Token 有效",
      message: "滴答清单 API Token 已验证。",
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Token 校验失败",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function SettingsActions() {
  return (
    <ActionPanel.Submenu title="Settings" icon={Icon.Gear}>
      <Action
        title="Validate API Token"
        icon={Icon.CheckCircle}
        onAction={validateApiToken}
      />
      <Action
        title="Open Extension Settings"
        icon={Icon.Gear}
        onAction={openExtensionPreferences}
      />
    </ActionPanel.Submenu>
  );
}

function isCompleted(t: Task): boolean {
  return (
    Boolean((t as { completed?: boolean }).completed) ||
    (t as { status?: number }).status === 2
  );
}

function dueMs(t: TaskLike): number | undefined {
  return t.dueDate ? new Date(t.dueDate).getTime() : undefined;
}

export function ShowDetailAction({
  task,
  projects,
  mutate,
}: {
  task: Task;
  projects: Project[];
  mutate: () => void;
}) {
  return (
    <Action.Push
      title="Show Details"
      icon={Icon.Sidebar}
      target={<TaskDetail task={task} projects={projects} mutate={mutate} />}
    />
  );
}

export function EditTaskAction({
  task,
  projects,
  mutate,
}: {
  task: Task;
  projects: Project[];
  mutate: () => void;
}) {
  const { pop } = useNavigation();
  async function handleSubmit(values: Record<string, unknown>) {
    const input = formToTaskInput(values, task.items);
    await updateTask(task.projectId, task.id, {
      ...input,
      projectId: input.projectId ?? task.projectId,
    });
    await toast("任务已更新");
    pop();
    mutate();
  }
  return (
    <Action.Push
      title="Edit Task"
      icon={Icon.Pencil}
      shortcut={Keyboard.Shortcut.Common.Edit}
      target={
        <Form
          isLoading={!projects.length}
          navigationTitle="Edit Task"
          actions={
            <ActionPanel>
              <Action.SubmitForm title="Save Changes" onSubmit={handleSubmit} />
            </ActionPanel>
          }
        >
          <TaskFormFields projects={projects} values={taskToFormValues(task)} />
        </Form>
      }
    />
  );
}

export function CompleteTaskAction({
  task,
  mutate,
}: {
  task: Task;
  mutate: () => void;
}) {
  return (
    <Action
      title="Complete Task"
      icon={Icon.Check}
      shortcut={{ modifiers: ["cmd"], key: "d" }}
      onAction={async () => {
        await completeTask(task.projectId, task.id);
        await toast("任务已完成");
        mutate();
      }}
    />
  );
}

export function UncompleteTaskAction({
  task,
  mutate,
}: {
  task: Task;
  mutate: () => void;
}) {
  return (
    <Action
      title="Uncomplete Task"
      icon={Icon.Undo}
      onAction={async () => {
        await uncompleteTask(task.projectId, task.id);
        await toast("任务已重新打开");
        mutate();
      }}
    />
  );
}

export function DeleteTaskAction({
  task,
  mutate,
}: {
  task: Task;
  mutate: () => void;
}) {
  return (
    <Action
      title="Delete Task"
      icon={Icon.Trash}
      style={Action.Style.Destructive}
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
      onAction={async () => {
        if (
          !(await confirmAlert({
            title: "删除任务？",
            message: "确定删除「" + task.title + "」？此操作不可撤销。",
          }))
        )
          return;
        await deleteTask(task.projectId, task.id);
        await toast("任务已删除");
        mutate();
      }}
    />
  );
}

export function PriorityAction({
  task,
  mutate,
}: {
  task: Task;
  mutate: () => void;
}) {
  return (
    <ActionPanel.Submenu title="Change Priority" icon={Icon.Flag}>
      {[5, 3, 1, 0].map((p) => (
        <Action
          key={p}
          title={PRIORITY_LABEL[p]}
          onAction={async () => {
            await updateTask(task.projectId, task.id, {
              priority: p,
              projectId: task.projectId,
            });
            await toast("优先级已更新");
            mutate();
          }}
        />
      ))}
    </ActionPanel.Submenu>
  );
}

export function MoveProjectAction({
  task,
  projects,
  mutate,
}: {
  task: Task;
  projects: Project[];
  mutate: () => void;
}) {
  return (
    <ActionPanel.Submenu title="Move to Project" icon={Icon.Folder}>
      {projects
        .filter((p) => p.id !== task.projectId)
        .map((p) => (
          <Action
            key={p.id}
            title={p.name}
            onAction={async () => {
              await moveTasks([
                {
                  fromProjectId: task.projectId,
                  toProjectId: p.id,
                  taskId: task.id,
                },
              ]);
              await toast("已移动到「" + p.name + "」");
              mutate();
            }}
          />
        ))}
    </ActionPanel.Submenu>
  );
}

const POSTPONE_LABELS: Array<[PostponePreset, string]> = [
  ["1h", "推迟 1 小时"],
  ["evening", "今天晚些时候"],
  ["tomorrow", "明天"],
  ["next-monday", "下周一"],
  ["next-week", "下周"],
];

export function PostponeAction({
  task,
  projects,
  mutate,
}: {
  task: Task;
  projects: Project[];
  mutate: () => void;
}) {
  return (
    <ActionPanel.Submenu title="推迟" icon={Icon.ArrowRight}>
      {POSTPONE_LABELS.map(([preset, label]) => (
        <Action
          key={preset}
          title={label}
          onAction={async () => {
            const next = postpone(task as TaskLike, preset);
            await updateTask(task.projectId, task.id, {
              dueDate: dueMs(next),
              projectId: task.projectId,
            });
            await toast(label);
            mutate();
          }}
        />
      ))}
      {/* ponytail: custom postpone date reuses the edit form; a dedicated date-only form is a second form for no gain. */}
      <Action.Push
        title="自定义日期…"
        icon={Icon.Calendar}
        target={
          <EditTaskAction task={task} projects={projects} mutate={mutate} />
        }
      />
    </ActionPanel.Submenu>
  );
}

export function CopyActions({ task }: { task: Task }) {
  return (
    <>
      <Action.CopyToClipboard title="Copy Title" content={task.title} />
      <Action.CopyToClipboard title="Copy Task ID" content={task.id} />
      <Action.CopyToClipboard
        title="Copy Project ID"
        content={task.projectId}
      />
    </>
  );
}

export function BatchActions({
  tasks,
  projects,
  mutate,
  clear,
}: {
  tasks: Task[];
  projects: Project[];
  mutate: () => void;
  clear: () => void;
}) {
  async function run(label: string, fn: () => Promise<unknown>) {
    await fn();
    await toast(label + " (" + String(tasks.length) + ")");
    clear();
    mutate();
  }
  function groupByProject(): Array<[string, Task[]]> {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      const g = m.get(t.projectId) ?? [];
      g.push(t);
      m.set(t.projectId, g);
    }
    return [...m];
  }
  function chunk50<T>(items: T[]): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += 50) out.push(items.slice(i, i + 50));
    return out;
  }
  return (
    <>
      <Action
        title={"Batch Complete (" + String(tasks.length) + ")"}
        icon={Icon.Check}
        onAction={() =>
          run("已完成", async () => {
            await mapLimit(groupByProject(), 4, ([pid, group]) =>
              mapLimit(chunk50(group), 1, (chunk) =>
                completeTasks({
                  projectId: pid,
                  taskIds: chunk.map((t) => t.id),
                }),
              ),
            );
          })
        }
      />
      <Action
        title={"Batch Delete (" + String(tasks.length) + ")"}
        icon={Icon.Trash}
        style={Action.Style.Destructive}
        onAction={async () => {
          if (
            !(await confirmAlert({
              title: "删除任务？",
              message:
                "确定删除 " +
                String(tasks.length) +
                " 个任务？此操作不可撤销。",
            }))
          )
            return;
          // ponytail: no batch delete endpoint; documented batch endpoints cover complete/move/batch only.
          await run("已删除", () =>
            mapLimit(tasks, 4, (t) => deleteTask(t.projectId, t.id)),
          );
        }}
      />
      <ActionPanel.Submenu title="Batch Move to Project" icon={Icon.Folder}>
        {projects.map((p) => (
          <Action
            key={p.id}
            title={p.name}
            onAction={() =>
              run("已移动到「" + p.name + "」", () =>
                moveTasks(
                  tasks.map((t) => ({
                    fromProjectId: t.projectId,
                    toProjectId: p.id,
                    taskId: t.id,
                  })),
                ),
              )
            }
          />
        ))}
      </ActionPanel.Submenu>
      <ActionPanel.Submenu title="Batch Change Priority" icon={Icon.Flag}>
        {[5, 3, 1, 0].map((p) => (
          <Action
            key={p}
            title={PRIORITY_LABEL[p]}
            onAction={() =>
              run("优先级已更新", async () => {
                await mapLimit(groupByProject(), 4, ([pid, group]) =>
                  mapLimit(chunk50(group), 1, (chunk) =>
                    batchTasks({
                      update: chunk.map((t) => ({
                        id: t.id,
                        projectId: pid,
                        priority: p,
                      })),
                    }),
                  ),
                );
              })
            }
          />
        ))}
      </ActionPanel.Submenu>
      <ActionPanel.Submenu title="Batch Postpone" icon={Icon.ArrowRight}>
        {POSTPONE_LABELS.map(([preset, label]) => (
          <Action
            key={preset}
            title={label}
            onAction={() =>
              run(label, async () => {
                await mapLimit(groupByProject(), 4, ([pid, group]) =>
                  mapLimit(chunk50(group), 1, (chunk) =>
                    batchTasks({
                      update: chunk.map((t) => ({
                        id: t.id,
                        projectId: pid,
                        dueDate: dueMs(postpone(t as TaskLike, preset)),
                      })),
                    }),
                  ),
                );
              })
            }
          />
        ))}
      </ActionPanel.Submenu>
    </>
  );
}

export function TaskActionPanel({
  task,
  projects,
  mutate,
  selection,
  selectedTasks,
  onToggle,
  onClearSelection,
}: {
  task: Task;
  projects: Project[];
  mutate: () => void;
  selection?: Set<string>;
  selectedTasks?: Task[];
  onToggle?: (id: string) => void;
  onClearSelection?: () => void;
}) {
  const isSelected = selection?.has(task.id) ?? false;
  return (
    <ActionPanel>
      <ActionPanel.Section>
        <ShowDetailAction task={task} projects={projects} mutate={mutate} />
        <EditTaskAction task={task} projects={projects} mutate={mutate} />
        {isCompleted(task) ? (
          <UncompleteTaskAction task={task} mutate={mutate} />
        ) : (
          <CompleteTaskAction task={task} mutate={mutate} />
        )}
      </ActionPanel.Section>
      <ActionPanel.Section title="Modify">
        <PriorityAction task={task} mutate={mutate} />
        <MoveProjectAction task={task} projects={projects} mutate={mutate} />
        <PostponeAction task={task} projects={projects} mutate={mutate} />
      </ActionPanel.Section>
      <ActionPanel.Section title="Copy">
        <CopyActions task={task} />
      </ActionPanel.Section>
      {(onToggle || (selectedTasks && selectedTasks.length > 0)) && (
        <ActionPanel.Section title="Batch">
          {onToggle && (
            <Action
              title={isSelected ? "Deselect" : "Select for Batch"}
              icon={Icon.CheckCircle}
              shortcut={{ modifiers: ["cmd"], key: "b" }}
              onAction={() => onToggle(task.id)}
            />
          )}
          {selectedTasks && selectedTasks.length > 0 && onClearSelection && (
            <BatchActions
              tasks={selectedTasks}
              projects={projects}
              mutate={mutate}
              clear={onClearSelection}
            />
          )}
        </ActionPanel.Section>
      )}
      <SettingsActions />
      <ActionPanel.Section>
        <DeleteTaskAction task={task} mutate={mutate} />
      </ActionPanel.Section>
    </ActionPanel>
  );
}
