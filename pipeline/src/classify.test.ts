import { test } from "node:test";
import assert from "node:assert/strict";
import { classify } from "./classify.js";

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
    assert.deepEqual(classify(title), { category, employment, seniority });
  });
}