import { fetchGreenhouseJobs } from "./sources/greenhouse.js";

const companies = ["stripe", "airbnb"];

for (const company of companies) {
  const jobs = await fetchGreenhouseJobs(company);
  console.log(`${company}: ${jobs.length} open jobs`);

  const indiaJobs = jobs.filter((job) =>
    /bengaluru|bangalore|india/i.test(job.location.name)
  );
  console.log(`In India: ${indiaJobs.length}\n`);

  for (const job of indiaJobs.slice(0, 10)) {
    console.log(`- ${job.title} | ${job.location.name}`);
    console.log(`  ${job.absolute_url}`);
  }
  console.log();
}
