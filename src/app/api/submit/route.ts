import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { inngest } from "@/lib/inngest/client";
import { createJob } from "@/lib/job-store";
import type { CandidateProfile, SearchParameters } from "@/lib/types";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract candidate info
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const linkedinUrl = formData.get("linkedinUrl") as string;
    const sheetId = formData.get("sheetId") as string;
    const adminEmail = formData.get("adminEmail") as string;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    // Extract PDF text from resume and cover letter
    let resumeText = "";
    let coverLetterText = "";

    const resumeFile = formData.get("resume") as File | null;
    if (resumeFile) {
      const buffer = Buffer.from(await resumeFile.arrayBuffer());
      resumeText = await extractPdfText(buffer);
    }

    const coverLetterFile = formData.get("coverLetter") as File | null;
    if (coverLetterFile) {
      const buffer = Buffer.from(await coverLetterFile.arrayBuffer());
      coverLetterText = await extractPdfText(buffer);
    }

    // Parse search parameters
    const searchParams: SearchParameters = {
      fundingStages: JSON.parse(
        (formData.get("fundingStages") as string) || "[]"
      ),
      teamSizes: JSON.parse((formData.get("teamSizes") as string) || "[]"),
      industries: JSON.parse((formData.get("industries") as string) || "[]"),
      locations: JSON.parse((formData.get("locations") as string) || "[]"),
      techStack: JSON.parse((formData.get("techStack") as string) || "[]"),
      customInterests: JSON.parse(
        (formData.get("customInterests") as string) || "[]"
      ),
    };

    const candidate: CandidateProfile = {
      name,
      email,
      phone: phone || "",
      linkedinUrl: linkedinUrl || "",
      resumeText,
      coverLetterText,
      technicalProfile: null,
      narrativeProfile: null,
    };

    // Generate job ID and create job
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    createJob(jobId);

    // Trigger Inngest pipeline
    await inngest.send({
      name: "pipeline/run",
      data: {
        jobId,
        candidate,
        searchParams,
        sheetId: sheetId || "",
        adminEmail: adminEmail || email,
      },
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Submission failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
