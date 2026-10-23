import { test } from "node:test";
import assert from "node:assert/strict";
import { classify, extractExperience } from "./classify.js";

// [title, category, employment, seniority]
const cases: [string, string, string, string][] = [
  // General
  ["Software Engineer", "developer", "full_time", "entry"],
  ["Frontend Developer (React)", "developer", "full_time", "entry"],
  ["Software Engineer, Customer Platform", "developer", "full_time", "entry"],

  // Backend
  ["Backend Engineer", "developer", "full_time", "entry"],
  ["Node.js Backend Engineer", "developer", "full_time", "entry"],
  ["Java Developer (Freshers)", "developer", "full_time", "fresher"],

  // Interns
  ["Software Engineering Intern", "developer", "internship", "entry"],
  ["Backend Developer Intern", "developer", "internship", "entry"],

  // Freshers / associates
  ["SDE 1 - Backend", "developer", "full_time", "fresher"],
  ["Associate Software Engineer", "developer", "full_time", "fresher"],
  ["Graduate Engineer Trainee - Software", "developer", "full_time", "fresher"],

  // Senior (senior words beat "associate")
  ["Senior Software Engineer", "developer", "full_time", "senior"],
  ["Software Development Engineer II", "developer", "full_time", "senior"],
  ["Senior Associate, Software Engineering", "developer", "full_time", "senior"],

  // Not developer roles
  ["Sales Engineer", "other", "full_time", "entry"],
  ["Mechanical Design Engineer", "other", "full_time", "entry"],
  ["Data Analyst Intern", "other", "internship", "entry"],
  ["Account Executive", "other", "full_time", "entry"],
];

for (const [title, category, employment, seniority] of cases) {
  test(title, () => {
    const c = classify(title);
    assert.deepEqual({ category: c.category, employment: c.employment, seniority: c.seniority }, { category, employment, seniority });
  });
}

// ── Experience from the description ──

// [description, minYears or null]
const experience: [string, number | null][] = [
  ["We need 0-2 years of experience in Java.", 0],
  ["Experience: 1 to 3 years", 1],
  ["3+ years of experience with React", 3],
  ["minimum 2 years experience in backend", 2],
  ["2+ yrs exp in Node", 2],
  ["less than 2 years of experience", 0],
  ["Freshers are welcome to apply", 0],
  ["We were founded 10 years ago and serve 5M users.", null],
  ["expertise in 5 years of product growth", null],
  ["Experience: 1–3 years (en dash)", 1],
  ["Experience: 4+ years, or 2 years with a master's", 2],
  ["Experience with 20+ years old codebases", null],
];
for (const [text, minYears] of experience) {
  test(`extractExperience: ${text}`, () => {
    assert.equal(extractExperience(text)?.minYears ?? null, minYears);
  });
}

test("extractExperience returns the matched phrase", () => {
  assert.equal(extractExperience("Requires 0-2 years of experience")?.text, "0-2 years");
});

// [title, description, seniority, minYears]
const withDescription: [string, string, string, number | null][] = [
  ["Software Engineer", "0-2 years of experience", "fresher", 0],
  ["Software Engineer", "Experience: 1 to 3 years", "fresher", 1],
  ["Software Engineer", "3+ years of experience", "senior", 3],
  ["Software Engineer", "minimum 2 years experience", "senior", 2],
  ["Backend Developer", "2+ yrs exp", "senior", 2],
  ["Software Engineer", "less than 2 years of experience", "fresher", 0],
  ["Software Engineer", "Freshers are welcome", "fresher", 0],
  ["Software Engineer", "We were founded 10 years ago", "entry", null],
  ["Senior Software Engineer", "0-2 years of experience", "senior", 0], // title wins
  ["Junior Developer", "3+ years of experience", "senior", 3],          // years beat fresher title words
  ["SDE 1", "", "fresher", null],                                        // no years: title decides
];
for (const [title, description, seniority, minYears] of withDescription) {
  test(`classify: ${title} + "${description}"`, () => {
    const c = classify(title, description);
    assert.equal(c.seniority, seniority);
    assert.equal(c.minYears, minYears);
  });
}

