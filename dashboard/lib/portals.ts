// Job sites linked from the sidebar. Edit this list freely: order here is the order shown.
export type Portal = {
  name: string;
  url: string;
  note: string;
  logoDomain?: string; // when the site's own icon is missing or blank
};

export const PORTALS: Portal[] = [
  { name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs/", note: "Biggest network, easy apply" },
  { name: "Naukri", url: "https://www.naukri.com/fresher-jobs", note: "Fresher roles across India" },
  { name: "Indeed India", url: "https://in.indeed.com/jobs?q=software+developer+fresher&l=Bengaluru", note: "Fresher dev roles in Bengaluru" },
  { name: "Unstop", url: "https://unstop.com/jobs", note: "Campus hiring and challenges" },
  { name: "Internshala", url: "https://internshala.com/jobs/", note: "Internships and fresher jobs" },
  { name: "Wellfound", url: "https://wellfound.com/jobs", note: "Startup jobs" },
  { name: "YC Work at a Startup", url: "https://www.workatastartup.com/", note: "Y Combinator companies", logoDomain: "ycombinator.com" },
  { name: "Instahyre", url: "https://www.instahyre.com/", note: "Recruiters reach out to you" },
  { name: "Cutshort", url: "https://cutshort.io/jobs", note: "Tech jobs, AI matching" },
  { name: "Hirist", url: "https://www.hirist.tech/", note: "Tech-only job board" },
  { name: "foundit", url: "https://www.foundit.in/", note: "Formerly Monster India" },
  { name: "Glassdoor India", url: "https://www.glassdoor.co.in/Job/index.htm", note: "Jobs plus company reviews" },
];
