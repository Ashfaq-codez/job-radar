// Choices for onboarding and settings. Plain data, safe to import in client components.
// Keep ROLE_FAMILIES and LOCATIONS in sync with pipeline/src/classify.ts and pipeline/src/location.ts.

export const ROLE_FAMILIES = [
  { value: "software_dev", label: "Software development" },
  { value: "data_analyst", label: "Data analyst" },
  { value: "data_scientist", label: "Data scientist" },
  { value: "data_engineer", label: "Data engineer" },
  { value: "ml_ai", label: "ML / AI" },
  { value: "business_analyst", label: "Business analyst" },
  { value: "qa_testing", label: "QA / testing" },
  { value: "devops_cloud", label: "DevOps / cloud" },
] as const;

// Experience level → the most years a job may ask for and still be shown
export const EXPERIENCE_LEVELS = [
  { value: "fresher", label: "Fresher", maxMinYears: 1 },
  { value: "lt1", label: "Less than 1 year", maxMinYears: 1 },
  { value: "1-2", label: "1–2 years", maxMinYears: 2 },
  { value: "2-3", label: "2–3 years", maxMinYears: 3 },
  { value: "3plus", label: "3+ years", maxMinYears: 5 },
] as const;

export const JOB_TYPES = [
  { value: "internship", label: "Internship" },
  { value: "full_time", label: "Full-time" },
  { value: "both", label: "Both" },
] as const;

export const LOCATIONS = ["Bengaluru", "Hyderabad", "Pune", "Chennai", "Mumbai", "Delhi NCR", "Remote India"] as const;

export const WORK_MODES = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;

export const COMPANY_TYPES = [
  { value: "startup", label: "Startup" },
  { value: "product", label: "Product company" },
  { value: "services", label: "IT services" },
  { value: "mnc", label: "MNC" },
  { value: "gcc", label: "Global capability centre" },
] as const;

export const NOTICE_PERIODS = ["Immediate", "15 days", "30 days", "60 days", "90 days"] as const;

export const CONSENT_TEXT =
  "My resume text is stored to match me with jobs and is sent to an AI model (OpenAI) for scoring. The account owner's OpenAI project may share data with OpenAI to improve their models. I can delete my data anytime.";

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

// What the dashboard shows about a profile. The webhook URL itself never leaves the server.
export interface ProfileView {
  hasResume: boolean;
  resumeUpdatedAt: string | null;
  roleFamilies: string[];
  extraTitles: string[];
  experienceLevel: string | null;
  jobType: "internship" | "full_time" | "both";
  locations: string[];
  openToRelocate: boolean;
  workModes: string[];
  skills: string[];
  avoidKeywords: string[];
  avoidCompanies: string[];
  companyTypes: string[];
  gradYear: number | null;
  noticePeriod: string | null;
  minSalaryLpa: number | null;
  webhookLast4: string | null; // "Connected (…ab12)"
  minNotifyScore: number;
  consented: boolean;
  onboarded: boolean;
}
