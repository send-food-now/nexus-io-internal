import Anthropic from '@anthropic-ai/sdk';
import { getText } from '@/lib/job-store';

const anthropic = new Anthropic();

export async function profileCandidate(jobId) {
  const texts = await getText(jobId);
  if (!texts) throw new Error('No extracted text found for job ' + jobId);

  const { resumeText, coverLetterText } = texts;

  const [technicalResult, narrativeResult] = await Promise.all([
    anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are an expert technical recruiter. Analyze this resume and extract a structured profile.
Return ONLY valid JSON with this shape:
{
  "skills": string[],
  "seniority": "junior" | "mid" | "senior" | "staff" | "principal",
  "domains": string[],
  "yearsExperience": number,
  "education": string,
  "notableAchievements": string[]
}`,
      messages: [{ role: 'user', content: resumeText }],
    }),
    anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are a career counselor analyzing a cover letter. Extract the candidate's motivations and personality.
Return ONLY valid JSON with this shape:
{
  "motivation": string,
  "values": string[],
  "communicationStyle": string,
  "careerGoals": string,
  "cultureFit": string[]
}`,
      messages: [{ role: 'user', content: coverLetterText }],
    }),
  ]);

  const technicalProfile = JSON.parse(technicalResult.content[0].text);
  const narrativeProfile = JSON.parse(narrativeResult.content[0].text);

  return { technicalProfile, narrativeProfile };
}
