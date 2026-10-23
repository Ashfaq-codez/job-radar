import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classify, roleFamily } from "./classify.js";
import { isIndiaLocation, matchesLocation } from "./location.js";
import { matchesProfile, type MatchJob, type MatchProfile } from "./match.js";

describe("roleFamily from the title", () => {
  // [title, family]
  const cases: [string, string][] = [
    ["Software Engineer", "software_dev"],
    ["Backend Developer (Node.js)", "software_dev"],
    ["Data Analyst", "data_analyst"],
    ["BI Analyst", "data_analyst"],
    ["Business Intelligence Developer", "data_analyst"],
    ["MIS Analyst", "data_analyst"],
    ["MIS Executive", "data_analyst"],
    ["Reporting Analyst", "data_analyst"],
    ["Analytics Intern", "data_analyst"],
    ["Power BI Developer", "data_analyst"],
    ["Data Analyst - Finance", "data_analyst"],
    ["Data Scientist", "data_scientist"],
    ["Junior Data Science Associate", "data_scientist"],
    ["Data Engineer", "data_engineer"],
    ["ETL Developer", "data_engineer"],
    ["Machine Learning Engineer", "ml_ai"],
    ["AI Engineer Intern", "ml_ai"],
    ["GenAI Developer", "ml_ai"],
    ["Business Analyst", "business_analyst"],
    ["QA Engineer", "qa_testing"],
    ["SDET", "qa_testing"],
    ["Software Engineer in Test", "qa_testing"],
    ["Manual Tester", "qa_testing"],
    ["DevOps Engineer", "devops_cloud"],
    ["Site Reliability Engineer", "devops_cloud"],
    ["Cloud Engineer - AWS", "devops_cloud"],
    // Look-alikes that are NOT data/BA roles
    ["Sales Analyst", "other"],
    ["Financial Analyst", "other"],
    ["Credit Analyst", "other"],
    ["SOC Analyst", "other"],
    ["Security Analyst", "other"],
    ["Business Analyst - Finance", "other"],
    ["Marketing Analyst", "other"],
    ["Mechanical Design Engineer", "other"],
    ["Account Executive", "other"],
  ];
  for (const [title, family] of cases) {
    it(title, () => assert.equal(classify(title).roleFamily, family));
  }
});

describe("roleFamily falls back to the description for vague titles", () => {
  it("Graduate Trainee with SQL and dashboards → data_analyst", () => {
    const d = "You will write SQL, build dashboards in Power BI and own weekly reporting. Strong Excel skills.";
    assert.equal(roleFamily("Graduate Trainee", d), "data_analyst");
  });
  it("needs several hints, not one", () => assert.equal(roleFamily("Graduate Trainee", "Knowledge of SQL is a plus."), "other"));
  it("never for clearly non-tech titles", () => {
    assert.equal(roleFamily("Sales Associate", "SQL SQL SQL dashboards reporting"), "other");
  });
});

describe("India locations", () => {
  for (const loc of ["Bangalore", "Secunderabad, Telangana", "Navi Mumbai", "Gurgaon", "Noida, UP", "Kochi", "Remote - India", "India", "2 Locations (India)"]) {
    it(`${loc} is in India`, () => assert.ok(isIndiaLocation(loc)));
  }
  for (const loc of ["San Francisco, CA", "London", "Remote - US", "Indianapolis, IN"]) {
    it(`${loc} is not in India`, () => assert.ok(!isIndiaLocation(loc)));
  }
});

describe("matchesLocation", () => {
  it("matches a chosen city by alias", () => assert.ok(matchesLocation("Bangalore, KA", ["Bengaluru"], false)));
  it("rejects another city", () => assert.ok(!matchesLocation("Pune", ["Bengaluru"], false)));
  it("Delhi NCR covers Gurugram and Noida", () => {
    assert.ok(matchesLocation("Gurugram", ["Delhi NCR"], false));
    assert.ok(matchesLocation("Noida", ["Delhi NCR"], false));
  });
  it("open to relocate accepts any Indian city", () => assert.ok(matchesLocation("Chennai", ["Bengaluru"], true)));
  it("relocation never means abroad", () => assert.ok(!matchesLocation("Berlin", ["Bengaluru"], true)));
  it("Remote India accepts remote Indian jobs", () => {
    assert.ok(matchesLocation("Remote - India", ["Remote India"], false));
    assert.ok(matchesLocation("India", ["Remote India"], false, true));
  });
  it("remote jobs need Remote India picked", () => assert.ok(!matchesLocation("Remote, India", ["Bengaluru"], false)));
  it("plain 'India' could be anywhere, so it matches", () => assert.ok(matchesLocation("3 Locations (India)", ["Pune"], false)));
  it("no cities chosen means anywhere in India", () => assert.ok(matchesLocation("Kolkata", [], false)));
});

describe("matchesProfile", () => {
  const job: MatchJob = {
    title: "Software Engineer", company: "acme", location: "Bengaluru", is_remote: false,
    employment: "full_time", role_family: "software_dev", min_years: null, description: "Build APIs in Java.",
  };
  const profile: MatchProfile = {
    role_families: ["software_dev"], extra_titles: [], job_types: ["internship", "full_time"],
    locations: ["Bengaluru"], open_to_relocate: false, max_min_years: 1, avoid_keywords: [], avoid_companies: [],
  };

  it("matches a fitting job", () => assert.ok(matchesProfile(job, profile)));
  it("needs a wanted role family", () => assert.ok(!matchesProfile({ ...job, role_family: "data_analyst" }, profile)));
  it("extra titles widen the net", () => {
    const j = { ...job, title: "Salesforce Developer Trainee", role_family: "other" };
    assert.ok(matchesProfile(j, { ...profile, extra_titles: ["salesforce developer"] }));
  });
  it("respects job type", () => assert.ok(!matchesProfile({ ...job, employment: "internship" }, { ...profile, job_types: ["full_time"] })));
  it("respects location", () => assert.ok(!matchesProfile({ ...job, location: "Pune" }, profile)));
  it("rejects too many years", () => assert.ok(!matchesProfile({ ...job, min_years: 2 }, profile)));
  it("accepts years within the limit", () => assert.ok(matchesProfile({ ...job, min_years: 2 }, { ...profile, max_min_years: 2 })));
  it("rejects senior titles", () => assert.ok(!matchesProfile({ ...job, title: "Senior Software Engineer" }, { ...profile, max_min_years: 5 })));
  it("rejects avoided keywords in title or description", () => {
    assert.ok(!matchesProfile(job, { ...profile, avoid_keywords: ["java"] }));
    assert.ok(matchesProfile(job, { ...profile, avoid_keywords: ["javascript"] }));
  });
  it("rejects avoided companies", () => {
    assert.ok(!matchesProfile(job, { ...profile, avoid_companies: ["ACME"] }));
    assert.ok(!matchesProfile({ ...job, company: "wunderman-thompson" }, { ...profile, avoid_companies: ["Wunderman Thompson"] }));
  });
});
