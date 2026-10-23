import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { JobToNotify } from "../db/jobs.js";
import { chunk, header, isDiscordWebhook, toEmbed } from "./format.js";

const job = (o: Partial<JobToNotify> = {}): JobToNotify => ({
  id: "x", company: "Acme", title: "SDE 1", location: "Bengaluru", url: "https://acme.com/j/1",
  fit_score: 75, fit_reasons: JSON.stringify({ reasons: ["Knows React"] }), employment: "full_time", seniority: "entry",
  ...o,
});

describe("header", () => {
  it("counts fresher and internship roles", () => {
    const jobs = [job(), job({ seniority: "fresher" }), job({ employment: "internship" })];
    assert.equal(header(jobs), "🎯 3 new matches · 1 fresher · 1 internship");
  });
  it("leaves out zero counts", () => assert.equal(header([job()]), "🎯 1 new match"));
});

describe("toEmbed", () => {
  it("is amber for 70-79 and green for 80+", () => {
    assert.equal(toEmbed(job({ fit_score: 79 })).color, 0xf59e0b);
    assert.equal(toEmbed(job({ fit_score: 80 })).color, 0x22c55e);
  });
  it("shows company, location and the first reason", () => {
    assert.equal(toEmbed(job()).description, "**Acme** · Bengaluru\nKnows React");
  });
  it("survives bad stored reasons", () => {
    assert.equal(toEmbed(job({ fit_reasons: "{oops" })).description, "**Acme** · Bengaluru");
  });
  it("marks internships and freshers", () => {
    const names = toEmbed(job({ employment: "internship", seniority: "fresher" })).fields.map((f) => `${f.name}:${f.value}`);
    assert.deepEqual(names, ["Score:75", "Type:Internship", "Fresher:✓"]);
  });
});

describe("chunk", () => {
  it("splits into groups of 10", () => {
    assert.deepEqual(chunk(Array.from({ length: 23 }, (_, i) => i)).map((c) => c.length), [10, 10, 3]);
  });
});

describe("isDiscordWebhook", () => {
  const id = "123456789012345678";
  const token = "a".repeat(68);
  it("accepts Discord webhook URLs", () => {
    assert.ok(isDiscordWebhook(`https://discord.com/api/webhooks/${id}/${token}`));
    assert.ok(isDiscordWebhook(`https://canary.discordapp.com/api/webhooks/${id}/${token}`));
  });
  it("rejects anything else", () => {
    assert.ok(!isDiscordWebhook(`http://discord.com/api/webhooks/${id}/${token}`));
    assert.ok(!isDiscordWebhook(`https://discord.com.evil.io/api/webhooks/${id}/${token}`));
    assert.ok(!isDiscordWebhook(`https://169.254.169.254/latest/meta-data`));
  });
});
