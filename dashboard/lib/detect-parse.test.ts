import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectFromHtml,
  detectFromUrl,
  detectUnsupported,
  isIndia,
  jobLinks,
  parseJsonLdJobs,
  robotsAllows,
  siteName,
} from "./detect-parse";

describe("detectFromUrl", () => {
  const cases: [string, string, string][] = [
    ["https://boards.greenhouse.io/stripe", "greenhouse", "stripe"],
    ["https://job-boards.greenhouse.io/databricks/jobs/123", "greenhouse", "databricks"],
    ["https://job-boards.eu.greenhouse.io/valtech", "greenhouse", "valtech"],
    ["https://boards-api.greenhouse.io/v1/boards/airbnb/jobs", "greenhouse", "airbnb"],
    ["https://boards.greenhouse.io/embed/job_board?for=figma", "greenhouse", "figma"],
    ["https://jobs.lever.co/razorpay", "lever", "razorpay"],
    ["https://jobs.lever.co/razorpay/abc-123/apply", "lever", "razorpay"],
    ["https://api.lever.co/v0/postings/cred?mode=json", "lever", "cred"],
    ["https://jobs.ashbyhq.com/ramp", "ashby", "ramp"],
    ["https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite", "workday", "nvidia.wd5/NVIDIAExternalCareerSite"],
    ["https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/x", "workday", "nvidia.wd5/NVIDIAExternalCareerSite"],
    ["https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/Careers/jobs", "workday", "acme.wd1/Careers"],
  ];
  for (const [url, source, slug] of cases) {
    it(url, () => assert.deepEqual(detectFromUrl(url), { source, slug }));
  }

  it("ignores unrelated sites", () => assert.equal(detectFromUrl("https://example.com/careers"), null));
  it("does not treat the embed path as a slug", () => assert.equal(detectFromUrl("https://boards.greenhouse.io/embed/"), null));
});

describe("detectFromHtml", () => {
  it("finds an embedded Greenhouse board in a script src", () => {
    const html = `<div id="grnhse_app"></div><script src="https://boards.greenhouse.io/embed/job_board/js?for=notion"></script>`;
    assert.deepEqual(detectFromHtml(html), { source: "greenhouse", slug: "notion" });
  });

  it("finds a Lever iframe", () => {
    const html = `<iframe src="https://jobs.lever.co/meesho?embed=true"></iframe>`;
    assert.deepEqual(detectFromHtml(html), { source: "lever", slug: "meesho" });
  });

  it("finds an Ashby link", () => {
    const html = `<a href="https://jobs.ashbyhq.com/zepto/1234">Apply</a>`;
    assert.deepEqual(detectFromHtml(html), { source: "ashby", slug: "zepto" });
  });

  it("reads URLs with escaped slashes inside inline JSON", () => {
    const html = `<script>window.__DATA__={"apply":"https:\\/\\/jobs.lever.co\\/groww\\/x"}</script>`;
    assert.deepEqual(detectFromHtml(html), { source: "lever", slug: "groww" });
  });

  it("finds a Workday link with a locale", () => {
    const html = `<a href="https://walmart.wd5.myworkdayjobs.com/en-US/WalmartExternal">Jobs</a>`;
    assert.deepEqual(detectFromHtml(html), { source: "workday", slug: "walmart.wd5/WalmartExternal" });
  });

  it("returns null for a page with no board", () => {
    assert.equal(detectFromHtml(`<a href="/about">About</a><a href="https://twitter.com/acme">X</a>`), null);
  });
});

describe("detectUnsupported", () => {
  it("spots Keka", () => assert.equal(detectUnsupported(`<a href="https://acme.keka.com/careers">`), "Keka"));
  it("spots Darwinbox", () => assert.equal(detectUnsupported(`https://acme.darwinbox.in/ms/candidate/careers`), "Darwinbox"));
  it("spots Zoho Recruit", () => assert.equal(detectUnsupported(`https://acme.zohorecruit.in/jobs/Careers`), "Zoho Recruit"));
  it("spots SmartRecruiters", () => assert.equal(detectUnsupported(`https://jobs.smartrecruiters.com/Acme`), "SmartRecruiters"));
  it("spots Workable", () => assert.equal(detectUnsupported(`https://apply.workable.com/acme/`), "Workable"));
  it("ignores the plain word 'workable'", () => assert.equal(detectUnsupported(`<p>A workable plan</p>`), null));
});

describe("parseJsonLdJobs", () => {
  const posting = { "@context": "https://schema.org", "@type": "JobPosting", title: "SDE 1" };

  it("reads a single JobPosting", () => {
    const html = `<script type="application/ld+json">${JSON.stringify(posting)}</script>`;
    assert.equal(parseJsonLdJobs(html)[0]?.title, "SDE 1");
  });

  it("reads arrays and @graph, skipping other types", () => {
    const html = `
      <script type="application/ld+json">${JSON.stringify([posting, { "@type": "Organization" }])}</script>
      <script type='application/ld+json'>${JSON.stringify({ "@graph": [{ "@type": "WebPage" }, { ...posting, title: "Intern" }] })}</script>`;
    assert.deepEqual(parseJsonLdJobs(html).map((p) => p.title), ["SDE 1", "Intern"]);
  });

  it("skips malformed blocks but keeps good ones", () => {
    const html = `<script type="application/ld+json">{not json</script><script type="application/ld+json">${JSON.stringify(posting)}</script>`;
    assert.equal(parseJsonLdJobs(html).length, 1);
  });

  it("returns nothing when there is no JSON-LD", () => assert.deepEqual(parseJsonLdJobs("<p>hi</p>"), []));
});

describe("jobLinks", () => {
  it("keeps same-site job-looking links only", () => {
    const html = `
      <a href="/jobs/123">A</a><a href="https://acme.com/careers/backend">B</a>
      <a href="/about">C</a><a href="https://other.com/jobs/1">D</a><a href="/jobs/123">dup</a>`;
    assert.deepEqual(jobLinks(html, "https://acme.com/careers"), ["https://acme.com/jobs/123", "https://acme.com/careers/backend"]);
  });
});

describe("siteName", () => {
  it("prefers og:site_name", () => assert.equal(siteName(`<meta property="og:site_name" content="Razorpay"><title>Careers | X</title>`), "Razorpay"));
  it("falls back to the first part of the title", () => assert.equal(siteName(`<title>Acme | Careers</title>`), "Acme"));
});

describe("isIndia", () => {
  it("matches Indian locations", () => {
    assert.ok(isIndia("Bengaluru, Karnataka"));
    assert.ok(isIndia("Remote - India"));
    assert.ok(!isIndia("San Francisco, CA"));
  });
});

describe("robotsAllows", () => {
  const robots = `
User-agent: *
Disallow: /admin
Disallow: /careers/private
Allow: /careers/private/open

User-agent: BadBot
Disallow: /`;

  it("allows paths with no matching rule", () => assert.ok(robotsAllows(robots, "/careers")));
  it("blocks disallowed paths", () => assert.ok(!robotsAllows(robots, "/careers/private/x")));
  it("lets a longer Allow win", () => assert.ok(robotsAllows(robots, "/careers/private/open/1")));
  it("does not apply another bot's group", () => assert.ok(robotsAllows(robots, "/jobs")));
  it("supports wildcards", () => assert.ok(!robotsAllows("User-agent: *\nDisallow: /*.pdf$", "/files/x.pdf")));
  it("allows everything with an empty robots.txt", () => assert.ok(robotsAllows("", "/anything")));
});
