import { createJob } from '@/lib/job-store';
import { inngest } from '@/lib/inngest';
import pdf from 'pdf-parse';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();

    const name = formData.get('name');
    const email = formData.get('email');
    const visaStatus = formData.get('visaStatus');
    const fundingStages = JSON.parse(formData.get('fundingStages') || '[]');
    const teamSizes = JSON.parse(formData.get('teamSizes') || '[]');
    const industries = JSON.parse(formData.get('industries') || '[]');
    const locations = JSON.parse(formData.get('locations') || '[]');
    const techStack = JSON.parse(formData.get('techStack') || '[]');
    const customInterests = JSON.parse(formData.get('customInterests') || '[]');

    const resumeFile = formData.get('resume');
    const coverLetterFile = formData.get('coverLetter');

    let resumeText = '';
    let coverLetterText = '';

    if (resumeFile && resumeFile.size > 0) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      const parsed = await pdf(buffer);
      resumeText = parsed.text;
    }

    if (coverLetterFile && coverLetterFile.size > 0) {
      const buffer = Buffer.from(await coverLetterFile.arrayBuffer());
      const parsed = await pdf(buffer);
      coverLetterText = parsed.text;
    }

    const jobId = crypto.randomUUID();
    const candidateData = { name, email, visaStatus };
    const searchParams = { fundingStages, teamSizes, industries, locations, techStack, customInterests };

    await createJob(jobId, candidateData);

    await inngest.send({
      name: 'candidate/submitted',
      data: { jobId, candidateData, resumeText, coverLetterText, searchParams },
    });

    return Response.json({ jobId });
  } catch (error) {
    console.error('Submit error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
