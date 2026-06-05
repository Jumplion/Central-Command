export interface TodoistProject {
  id: string;
  name: string;
  color: string;
  is_inbox_project: boolean;
  is_favorite: boolean;
  order: number;
  parent_id: string | null;
}

export interface TodoistDue {
  date: string;
  is_recurring: boolean;
  datetime: string | null;
  string: string;
  timezone: string | null;
}

export interface TodoistTask {
  id: string;
  project_id: string;
  content: string;
  description: string;
  is_completed: boolean;
  priority: 1 | 2 | 3 | 4;
  due: TodoistDue | null;
  order: number;
  parent_id: string | null;
  section_id: string | null;
  labels: string[];
  url: string;
  created_at: string;
}
