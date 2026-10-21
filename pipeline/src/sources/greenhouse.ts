// The shape of one job from Greenhouse. We only list the fields we use.
export interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at: string;
  location: { name: string };
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

export async function fetchGreenhouseJobs(boardToken: string): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Greenhouse "${boardToken}" failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GreenhouseResponse;
  return data.jobs;
}