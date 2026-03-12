import { kv } from '@vercel/kv';

const STAGE_NAMES = ['profile', 'discover', 'categorize', 'enrich', 'outreach', 'sheets', 'notify'];
const JOB_TTL_SECONDS = 86400; // 24 hours

// Fallback in-memory store for local dev when KV is not configured
const memoryStore = new Map();
const useMemory = !process.env.KV_REST_API_URL;

if (useMemory) {
  console.warn('[job-store] KV_REST_API_URL not set — using in-memory store (local dev only)');
}

function makeInitialJob(jobId, candidateName) {
  const stages = {};
  for (const name of STAGE_NAMES) {
    stages[name] = { status: 'pending', result: null, error: null };
  }
  return {
    jobId,
    status: 'pending',
    stages,
    candidateName,
    createdAt: new Date().toISOString(),
  };
}

export async function createJob(jobId, candidateName) {
  const job = makeInitialJob(jobId, candidateName);
  if (useMemory) {
    memoryStore.set(`job:${jobId}`, job);
  } else {
    await kv.set(`job:${jobId}`, job, { ex: JOB_TTL_SECONDS });
  }
  return job;
}

export async function getJob(jobId) {
  if (useMemory) {
    return memoryStore.get(`job:${jobId}`) || null;
  }
  return await kv.get(`job:${jobId}`);
}

export async function updateStage(jobId, stage, status, result = null, error = null) {
  const job = await getJob(jobId);
  if (!job) return null;

  job.stages[stage] = { status, result, error };

  // Update overall job status
  const allStages = Object.values(job.stages);
  if (allStages.some((s) => s.status === 'failed')) {
    job.status = 'failed';
  } else if (allStages.some((s) => s.status === 'running')) {
    job.status = 'running';
  } else if (allStages.every((s) => s.status === 'completed')) {
    job.status = 'completed';
  } else {
    job.status = 'running';
  }

  if (useMemory) {
    memoryStore.set(`job:${jobId}`, job);
  } else {
    await kv.set(`job:${jobId}`, job, { ex: JOB_TTL_SECONDS });
  }
  return job;
}

export async function storeText(jobId, resumeText, coverLetterText) {
  const data = { resumeText, coverLetterText };
  if (useMemory) {
    memoryStore.set(`text:${jobId}`, data);
  } else {
    await kv.set(`text:${jobId}`, data, { ex: JOB_TTL_SECONDS });
  }
}

export async function getText(jobId) {
  if (useMemory) {
    return memoryStore.get(`text:${jobId}`) || null;
  }
  return await kv.get(`text:${jobId}`);
}

export { STAGE_NAMES };
