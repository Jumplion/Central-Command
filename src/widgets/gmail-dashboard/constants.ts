// Default job-search folder + rule seed data
// Inserted once when the widget is first used (checked via folder count)
export const DEFAULT_FOLDERS = [
  { name: "Job Search", parent_id: null, sort_order: 0, icon: "💼" },
  {
    name: "Applied",
    parent_id: -1 /* resolved below */,
    sort_order: 0,
    icon: "📩",
  },
  { name: "Interviews", parent_id: -1, sort_order: 1, icon: "🎤" },
  { name: "Rejections", parent_id: -1, sort_order: 2, icon: "❌" },
  { name: "Offers", parent_id: -1, sort_order: 3, icon: "🎉" },
  { name: "Alerts", parent_id: -1, sort_order: 4, icon: "🔔" },
];

// [folder_name, field, operator, value, priority]
export const DEFAULT_RULES: [string, string, string, string, number][] = [
  // Offers — highest priority
  ["Offers", "subject", "contains", "offer letter", 100],
  ["Offers", "subject", "contains", "job offer", 100],
  ["Offers", "subject", "contains", "pleased to offer", 100],
  ["Offers", "snippet", "contains", "compensation package", 90],
  ["Offers", "snippet", "contains", "pleased to offer", 90],

  // Rejections
  ["Rejections", "subject", "contains", "unfortunately", 80],
  ["Rejections", "subject", "contains", "not moving forward", 80],
  ["Rejections", "subject", "contains", "other candidates", 80],
  ["Rejections", "subject", "contains", "not selected", 80],
  ["Rejections", "snippet", "contains", "regret to inform", 75],
  ["Rejections", "snippet", "contains", "not moving forward", 75],
  ["Rejections", "snippet", "contains", "other candidates", 75],
  ["Rejections", "snippet", "contains", "not been selected", 75],
  ["Rejections", "snippet", "contains", "unfortunately", 70],

  // Interviews
  ["Interviews", "subject", "contains", "interview invitation", 60],
  ["Interviews", "subject", "contains", "interview request", 60],
  ["Interviews", "subject", "contains", "phone screen", 60],
  ["Interviews", "subject", "contains", "technical screen", 60],
  ["Interviews", "subject", "contains", "next steps", 55],
  ["Interviews", "snippet", "contains", "schedule a call", 50],
  ["Interviews", "snippet", "contains", "schedule an interview", 50],
  ["Interviews", "snippet", "contains", "next steps", 45],

  // Job alerts from common platforms
  ["Alerts", "from", "contains", "jobalerts@linkedin.com", 40],
  ["Alerts", "from", "contains", "alerts@indeed.com", 40],
  ["Alerts", "from", "contains", "ziprecruiter.com", 40],
  ["Alerts", "from", "contains", "glassdoor.com", 40],
  ["Alerts", "subject", "contains", "job alert", 35],
  ["Alerts", "subject", "contains", "new jobs for you", 35],
  ["Alerts", "subject", "contains", "jobs matching", 35],

  // Applied — catch-all for application confirmations
  ["Applied", "subject", "contains", "thank you for applying", 20],
  ["Applied", "subject", "contains", "we received your application", 20],
  ["Applied", "subject", "contains", "application received", 20],
  ["Applied", "subject", "contains", "application submitted", 20],
  ["Applied", "subject", "contains", "your application", 15],
  ["Applied", "snippet", "contains", "thank you for applying", 10],
  ["Applied", "snippet", "contains", "we have received your application", 10],
];

export const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
