/** Types for the public Dida365/TickTick Open API payloads only. */

export type ProjectViewMode = "list" | "kanban" | "timeline";
export type ProjectKind = "TASK" | "NOTE";

export interface Project {
  id: string;
  name: string;
  color?: string;
  sortOrder?: number;
  viewMode?: ProjectViewMode;
  kind?: ProjectKind;
  closed?: boolean;
  groupId?: string;
  permission?: "read" | "write" | "comment";
}

export interface Column {
  id: string;
  name?: string;
  sortOrder?: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  status?: number; // 0 normal, 1 completed
  completedTime?: number;
  startDate?: number;
  isAllDay?: boolean;
  timeZone?: string;
  sortOrder?: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  content?: string;
  desc?: string;
  priority?: number;
  status?: number; // -1 abandoned, 0 normal, 2 completed
  startDate?: number;
  dueDate?: number;
  isAllDay?: boolean;
  timeZone?: string;
  reminders?: string[];
  repeatFlag?: string;
  sortOrder?: number;
  items?: ChecklistItem[];
  completedTime?: number;
  tags?: string[];
  parentId?: string;
}

export interface ProjectData {
  project?: Project;
  tasks?: Task[];
  columns?: Column[];
}
