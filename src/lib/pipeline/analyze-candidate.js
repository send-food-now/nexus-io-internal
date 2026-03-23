import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

function cleanJson(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function analyzeCandidate({ resumeText, coverLetterText, linkedinUrl, portfolioUrl, githubUrl }) {
  const supplementaryLinks = [
    linkedinUrl && `LinkedIn: ${linkedinUrl}`,
    portfolioUrl && `Portfolio: ${portfolioUrl}`,
    githubUrl && `GitHub: ${githubUrl}`,
  ].filter(Boolean).join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are an expert career strategist and technical recruiter. Analyze the candidate's full professional profile to establish a deep understanding of their skills, experiences, and career objectives. Return valid JSON only, no markdown.

Schema:
{
  "skills": string[],
  "seniority": "junior" | "mid" | "senior" | "staff" | "lead",
  "domains": string[],
  "yearsExperience": number,
  "education": string,
  "certifications": string[],
  "currentIndustry": string,
  "adjacentIndustries": string[],
  "careerObjectives": string,
  "motivation": string,
  "values": string[],
  "communicationStyle": string,
  "uniqueStrengths": string[]
}`,
    messages: [{
      role: 'user',
      content: `Analyze this candidate's complete professional profile:

## Resume
${resumeText || 'Not provided'}

## Cover Letter
${coverLetterText || 'Not provided'}

## Additional Links
${supplementaryLinks || 'None provided'}`,
    }],
  });

  return JSON.parse(cleanJson(response.content[0].text));
}
