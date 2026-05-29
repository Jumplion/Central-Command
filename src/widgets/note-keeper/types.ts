export interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export interface KeepNote {
  name: string;
  title?: string;
  body?: {
    text?: { text: string };
    list?: {
      listItems: Array<{
        text: { text: string };
        checked: boolean;
      }>;
    };
  };
  trashed: boolean;
  archived: boolean;
  pinned: boolean;
  createTime: string;
  updateTime: string;
  labels?: Array<{ name: string }>;
}

export interface KeepNotesList {
  notes?: KeepNote[];
  nextPageToken?: string;
}
