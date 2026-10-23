// Company website domains, used to fetch a logo. Most come from the job link (e.g. stripe.com/jobs),
// but companies whose jobs live on the ATS (job-boards.greenhouse.io/...) need an entry here.
// Keyed by board slug. Add more as you notice missing logos.
export const COMPANY_DOMAINS: Record<string, string> = {
  capco: "capco.com",
  zscaler: "zscaler.com",
  tide: "tide.co",
  zetaglobal: "zetaglobal.com",
  coherehealth: "coherehealth.com",
  zenoti: "zenoti.com",
  valtech: "valtech.com",
  anaplan: "anaplan.com",
  celonis: "celonis.com",
  airbound: "airbound.co",
  opengov: "opengov.com",
  alphasense: "alpha-sense.com",
  alphasenseindia: "alpha-sense.com",
  crunchyroll: "crunchyroll.com",
  addepar1: "addepar.com",
  xometry: "xometry.com",
  zinnia: "zinnia.com",
  bottomlinetechnologies: "bottomline.com",
  cognite: "cognite.com",
  devrev: "devrev.ai",
  truecaller: "truecaller.com",
  cloudsek: "cloudsek.com",
  stockx: "stockx.com",
};

// Hosts that belong to the job board, not the company
const ATS_HOSTS = /(greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|adzuna\.)/;

export function companyDomain(slug: string, jobUrl?: string): string | null {
  const known = COMPANY_DOMAINS[slug.toLowerCase()];
  if (known) return known;
  if (!jobUrl) return null;
  try {
    const host = new URL(jobUrl).hostname.replace(/^(www|careers|jobs)\./, "");
    return ATS_HOSTS.test(host) ? null : host;
  } catch {
    return null;
  }
}

// Each job board's own site, for its logo in the Companies table. Careers pages use their own site.
const BOARDS: Record<string, { label: string; domain: string }> = {
  greenhouse: { label: "Greenhouse", domain: "greenhouse.io" },
  lever: { label: "Lever", domain: "lever.co" },
  ashby: { label: "Ashby", domain: "ashbyhq.com" },
  workday: { label: "Workday", domain: "workday.com" },
};

export function boardInfo(source: string, slug: string): { label: string; domain: string | null } {
  const known = BOARDS[source];
  if (known) return known;
  if (source === "careers") {
    try {
      return { label: "Careers page", domain: new URL(slug).hostname };
    } catch {
      return { label: "Careers page", domain: null };
    }
  }
  return { label: source, domain: null };
}

// Free favicon service; 64px is crisp at the sizes we render
export function logoUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}
