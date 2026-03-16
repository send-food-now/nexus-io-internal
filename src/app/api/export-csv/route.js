import { getJob } from '@/lib/job-store';
import { COLUMN_HEADERS, startupToRow } from '@/lib/pipeline/write-sheets';

function escapeCSV(value) {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

  const outreach = job.stages?.outreach;
  if (outreach?.status !== 'completed' || !outreach?.result) {
    return Response.json({ error: 'Outreach data not available yet' }, { status: 400 });
  }

  const categorized = outreach.result;
  const rows = [COLUMN_HEADERS.map(escapeCSV).join(',')];

  for (const [category, startups] of [
    ['Exact Match', categorized.exact || []],
    ['Recommended', categorized.recommended || []],
    ['Luck', categorized.luck || []],
  ]) {
    for (const startup of startups) {
      rows.push(startupToRow(startup, category).map(escapeCSV).join(','));
    }
  }

  const csv = rows.join('\r\n');
  const candidateName = job.candidateData?.name || 'Unknown';
  const date = new Date().toISOString().split('T')[0];

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="H-1B1-Pipeline-${candidateName}-${date}.csv"`,
    },
  });
}
