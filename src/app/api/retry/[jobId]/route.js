import { NextResponse } from 'next/server';
import { getJob, updateStage } from '@/lib/job-store';
import { inngest } from '@/lib/inngest-client';

export async function POST(request, { params }) {
  const { jobId } = params;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Find the first failed stage
  const failedStage = Object.entries(job.stages).find(([, s]) => s.status === 'failed');
  if (!failedStage) {
    return NextResponse.json({ error: 'No failed stage to retry' }, { status: 400 });
  }

  const [stageName] = failedStage;

  // Reset the failed stage to pending
  await updateStage(jobId, stageName, 'pending');

  // Send retry event
  await inngest.send({
    name: 'h1b1/stage.retry',
    data: {
      jobId,
      stage: stageName,
      candidateName: job.candidateName,
    },
  });

  return NextResponse.json({ success: true, retryingStage: stageName });
}
