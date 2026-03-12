import { NextResponse } from 'next/server';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import { createJob, storeText } from '@/lib/job-store';
import { inngest } from '@/lib/inngest-client';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request) {
  try {
    const formData = await request.formData();

    // Extract text fields
    const candidateName = formData.get('candidateName');
    const candidateEmail = formData.get('candidateEmail');
    const phone = formData.get('phone');
    const visaStatus = formData.get('visaStatus');
    const targetStartDate = formData.get('targetStartDate');
    const searchParams = JSON.parse(formData.get('searchParams') || '{}');
    const techStack = JSON.parse(formData.get('techStack') || '[]');
    const customInterests = JSON.parse(formData.get('customInterests') || '[]');
    const additionalNotes = formData.get('additionalNotes') || '';

    // Extract and validate PDF files
    const resumeFile = formData.get('resume');
    const coverLetterFile = formData.get('coverLetter');

    if (!resumeFile || !coverLetterFile) {
      return NextResponse.json({ error: 'Both resume and cover letter PDFs are required' }, { status: 400 });
    }

    if (resumeFile.size > MAX_FILE_SIZE || coverLetterFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Each file must be under 10MB' }, { status: 400 });
    }

    // Extract text from PDFs
    const resumeBuffer = Buffer.from(await resumeFile.arrayBuffer());
    const coverLetterBuffer = Buffer.from(await coverLetterFile.arrayBuffer());

    const [resumeParsed, coverLetterParsed] = await Promise.all([
      pdf(resumeBuffer),
      pdf(coverLetterBuffer),
    ]);

    const resumeText = resumeParsed.text;
    const coverLetterText = coverLetterParsed.text;

    // Create job
    const jobId = crypto.randomUUID();
    await createJob(jobId, candidateName);

    // Store extracted text in KV to avoid Inngest payload limit
    await storeText(jobId, resumeText, coverLetterText);

    // Send Inngest event with metadata only (not full text)
    await inngest.send({
      name: 'h1b1/application.submitted',
      data: {
        jobId,
        candidateName,
        candidateEmail,
        phone,
        visaStatus,
        targetStartDate,
        searchParams,
        techStack,
        customInterests,
        additionalNotes,
      },
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    console.error('[submit] Error:', err);
    return NextResponse.json({ error: 'Failed to process submission' }, { status: 500 });
  }
}
