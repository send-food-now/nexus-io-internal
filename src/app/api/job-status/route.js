import { getJob } from '@/lib/job-store';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return Response.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await getJob(jobId);

  if (!job) {
    return Response.json({ error: 'Job not found' }, { status: 404 });
  }

  return Response.json(job);
}
