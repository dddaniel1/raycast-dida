import {
  Action,
  ActionPanel,
  Icon,
  MenuBarExtra,
  open,
  Keyboard,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { aggregateTasks } from "./api/projects";
import { menuBarCounts } from "./lib/tasks";
import type { TaskLike } from "./lib/tasks";

// ASSUMPTION: extension slug is "dida"; adjust once package.json names the Tasks command.
const tasksLink = (filter: string) =>
  `raycast://extensions/dida/tasks?arguments=${encodeURIComponent(filter)}`;

export default function MenuBar() {
  const [tasks, setTasks] = useState<TaskLike[]>([]);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    try {
      setTasks(await aggregateTasks());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const now = new Date();
  const { todayRemaining, overdue, highPriority } = menuBarCounts(tasks, now);

  return (
    <MenuBarExtra
      icon={Icon.CheckList}
      title={failed ? "—/—/—" : `${todayRemaining}/${overdue}/${highPriority}`}
      tooltip={
        failed
          ? "Failed to load tasks. Check connection or token, then Refresh."
          : "Today / Overdue / High priority"
      }
    >
      <ActionPanel>
        {failed && (
          <Action
            title="Refresh to Retry"
            icon={Icon.ArrowClockwise}
            onAction={() => load()}
          />
        )}
        <Action
          title="Today"
          icon={Icon.Calendar}
          onAction={() => open(tasksLink("today"))}
        />
        <Action
          title="Overdue"
          icon={Icon.ExclamationMark}
          onAction={() => open(tasksLink("overdue"))}
        />
        <Action
          title="High Priority"
          icon={Icon.Flag}
          onAction={() => open(tasksLink("high"))}
        />
        <Action
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={Keyboard.Shortcut.Common.Refresh}
          onAction={() => load().catch(() => setTasks([]))}
        />
      </ActionPanel>
    </MenuBarExtra>
  );
}
