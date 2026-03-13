import type { JobStatus, StageName, StageStatus, PIPELINE_STAGES } from "./types";

// In-memory job state tracking
// Suitable for single-server dev; production should use Vercel KV/Redis
const jobs = new Map<string, JobStatus>();

function defaultStages(): Record<StageName, StageStatus> {
  return {
    profile: "pending",
    discover: "pending",
    categorize: "pending",
    enrich: "pending",
    outreach: "pending",
    sheets: "pending",
    notify: "pending",
  };
}

export function createJob(jobId: string): JobStatus {
  const job: JobStatus = {
    jobId,
    status: "running",
    stages: defaultStages(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);
  return job;
}

export function updateStage(
  jobId: string,
  stage: StageName,
  status: StageStatus
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.stages[stage] = status;
  job.updatedAt = new Date().toISOString();
}

export function setResult(
  jobId: string,
  result: Record<string, unknown>
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "completed";
  job.result = result;
  job.updatedAt = new Date().toISOString();
}

export function setError(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "failed";
  job.error = error;
  job.updatedAt = new Date().toISOString();
}

export function getJob(jobId: string): JobStatus | null {
  return jobs.get(jobId) ?? null;
}
