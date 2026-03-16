let kvStore;

if (process.env.KV_REST_API_URL) {
  const { kv } = await import('@vercel/kv');
  kvStore = kv;
} else {
  // In-memory fallback for local development
  const store = new Map();
  kvStore = {
    async get(key) { return store.get(key) || null; },
    async set(key, value) { store.set(key, value); },
  };
  console.warn('[job-store] Using in-memory store (no KV_REST_API_URL set)');
}

const STAGES = ['profile', 'discover', 'categorize', 'enrich', 'outreach', 'sheets', 'notify'];

export async function createJob(jobId, candidateData) {
  const job = {
    id: jobId,
    status: 'pending',
    candidateData,
    stages: Object.fromEntries(STAGES.map(s => [s, { status: 'pending', result: null, error: null }])),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kvStore.set(`job:${jobId}`, job);
  return job;
}

export async function updateJobStage(jobId, stage, status, result = null, error = null) {
  const job = await kvStore.get(`job:${jobId}`);
  if (!job) throw new Error(`Job ${jobId} not found`);

  job.stages[stage] = { status, result, error };
  job.updatedAt = new Date().toISOString();

  // Update overall job status
  const stageStatuses = Object.values(job.stages).map(s => s.status);
  if (stageStatuses.some(s => s === 'error')) {
    job.status = 'error';
  } else if (stageStatuses.every(s => s === 'completed')) {
    job.status = 'completed';
  } else if (stageStatuses.some(s => s === 'running')) {
    job.status = 'running';
  } else {
    job.status = 'running';
  }

  await kvStore.set(`job:${jobId}`, job);
  return job;
}

export async function getJob(jobId) {
  return await kvStore.get(`job:${jobId}`);
}
