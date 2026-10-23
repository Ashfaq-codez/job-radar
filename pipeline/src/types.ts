export type Source = "greenhouse" | "lever" | "ashby" | "workday" | "careers";

// One job in OUR shape. Every source gets converted into this.
export interface Job {
  id: string;              // "lever:leverdemo:abc-123", unique across ALL sources
  source: Source;
  company: string;
  title: string;
  location: string;
  isRemote: boolean;
  url: string;
  description: string;     // plain text, used for scoring
  descriptionHtml: string; // sanitized HTML, shown in the dashboard
  postedAt: string | null; // ISO date, or null if the source doesn't say
}

export interface CompanyTarget {
  source: Source;
  slug: string;            // the company's name in the API URL
}