import { NextResponse } from 'next/server';
import { getJob } from '@/lib/job-store';

export async function GET(request, { params }) {
  const { jobId } = params;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json(job);
}
