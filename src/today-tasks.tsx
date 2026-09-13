import Tasks from "./tasks";

export default function TodayTasks() {
  return <Tasks launchContext={{ filter: "today" }} />;
}
