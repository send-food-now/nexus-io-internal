import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

export async function profileCandidate({ resumeText, coverLetterText }) {
  const [technicalRes, narrativeRes] = await Promise.all([
    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are an expert technical recruiter. Extract a structured technical profile from the candidate's resume. Return valid JSON only, no markdown.

Schema:
{
  "skills": string[],
  "seniority": "junior" | "mid" | "senior" | "staff",
  "domains": string[],
  "yearsExperience": number,
  "education": string,
  "certifications": string[]
}`,
      messages: [{ role: 'user', content: `Resume:\n\n${resumeText}` }],
    }),

    client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are an expert career coach. Extract a narrative profile from the candidate's cover letter. Return valid JSON only, no markdown.

Schema:
{
  "motivation": string,
  "values": string[],
  "communicationStyle": string,
  "careerGoals": string
}`,
      messages: [{ role: 'user', content: `Cover Letter:\n\n${coverLetterText}` }],
    }),
  ]);

  const technicalProfile = JSON.parse(technicalRes.content[0].text);
  const narrativeProfile = JSON.parse(narrativeRes.content[0].text);

  return { technicalProfile, narrativeProfile };
}
