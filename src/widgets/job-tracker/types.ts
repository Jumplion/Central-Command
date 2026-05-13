export type Status = 'Applied' | 'Phone' | 'Onsite' | 'Offer' | 'Rejected' | 'Ghosted';

export const STATUSES: Status[] = ['Applied', 'Phone', 'Onsite', 'Offer', 'Rejected', 'Ghosted'];

export const STATUS_COLOR: Record<Status, string> = {
  Applied: '#6ea8ff',
  Phone: '#a78bfa',
  Onsite: '#f59e0b',
  Offer: '#34d399',
  Rejected: '#ff6e6e',
  Ghosted: '#6b7280',
};

export interface Application {
  id: number;
  company: string;
  role: string;
  status: Status;
  applied_at: string;
  source: string;
  link: string;
  notes: string;
  last_updated: number;
}

export type AppFormData = Omit<Application, 'id' | 'last_updated'>;
