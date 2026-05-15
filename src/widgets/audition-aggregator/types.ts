export type Status = 'Interested' | 'Submitted' | 'Callback' | 'Booked' | 'Released' | 'Passed';
export type ProjectType = 'Film' | 'TV' | 'Commercial' | 'Theater' | 'Voiceover' | 'Student/Indie';

export interface Audition {
  id: number;
  project_title: string;
  role: string;
  project_type: ProjectType;
  status: Status;
  casting_studio: string;
  location: string;
  pay_rate: string;
  submitted_at: string;
  submission_deadline: string;
  shoot_date: string;
  link: string;
  notes: string;
  last_updated: number;
}

export type AuditionFormData = Omit<Audition, 'id' | 'last_updated'>;

export interface CastingSite {
  id: string;
  name: string;
  url: string;
}
