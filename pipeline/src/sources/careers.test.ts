import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toJob } from "./careers.js";

const PAGE = "https://www.acme.com/careers";

describe("careers toJob", () => {
  it("maps a full JobPosting", () => {
    const job = toJob(
      {
        "@type": "JobPosting",
        title: "Software Engineer I",
        url: "https://www.acme.com/careers/sde-1",
        datePosted: "2026-10-20",
        description: "<p>Build <strong>things</strong></p>",
        hiringOrganization: { "@type": "Organization", name: "Acme" },
        jobLocation: { address: { addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" } },
      },
      PAGE
    );
    assert.ok(job);
    assert.equal(job.company, "Acme");
    assert.equal(job.location, "Bengaluru, Karnataka, India");
    assert.equal(job.description, "Build things");
    assert.equal(job.postedAt, "2026-10-20T00:00:00.000Z");
    assert.match(job.id, /^careers:acme\.com:[0-9a-f]{12}$/);
  });

  it("handles several locations, country objects and remote roles", () => {
    const job = toJob(
      {
        title: "Backend Intern",
        jobLocationType: "TELECOMMUTE",
        jobLocation: [{ address: { addressLocality: "Pune", addressCountry: { name: "India" } } }, { address: "Remote" }],
      },
      PAGE
    );
    assert.equal(job?.location, "Pune, India; Remote");
    assert.equal(job?.isRemote, true);
    assert.equal(job?.company, "acme.com"); // no hiringOrganization: falls back to the site
    assert.equal(job?.url, PAGE);
  });

  it("skips postings without a title, and ignores bad optional fields", () => {
    assert.equal(toJob({ description: "no title" }, PAGE), null);
    const job = toJob({ title: "SDE", url: "not a url", datePosted: 42, jobLocation: "???" }, PAGE);
    assert.equal(job?.url, PAGE);
    assert.equal(job?.postedAt, null);
    assert.equal(job?.location, "Unknown");
  });

  it("gives different roles on the same page different ids", () => {
    assert.notEqual(toJob({ title: "A" }, PAGE)?.id, toJob({ title: "B" }, PAGE)?.id);
  });
});
