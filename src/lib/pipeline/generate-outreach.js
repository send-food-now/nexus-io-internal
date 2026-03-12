import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function generateForStartup(startup, technicalProfile, narrativeProfile) {
  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are an expert cold outreach copywriter for job seekers. Given a candidate profile and startup context, generate personalized outreach materials.
Return ONLY valid JSON with this shape:
{
  "hook": string (1-2 compelling sentences connecting the candidate to this specific company),
  "fitRationale": string (2-3 sentences explaining why this candidate is right for this startup),
  "shortEmail": string (professional cold email, ~100 words, direct and personal),
  "longEmail": string (detailed cold email, ~250 words, with specific examples and enthusiasm)
}`,
    messages: [
      {
        role: 'user',
        content: `Candidate:
Skills: ${technicalProfile.skills?.join(', ')}
Seniority: ${technicalProfile.seniority}
Domains: ${technicalProfile.domains?.join(', ')}
Motivation: ${narrativeProfile.motivation}
Values: ${narrativeProfile.values?.join(', ')}
Communication style: ${narrativeProfile.communicationStyle}

Startup:
Name: ${startup.name}
Industry: ${startup.industry}
Description: ${startup.description}
Location: ${startup.location}
Funding: ${startup.fundingStage}
Team size: ${startup.teamSize}
Recent news: ${startup.recentNews?.headline || 'N/A'}
Scoring rationale: ${startup.rationale}`,
      },
    ],
  });

  try {
    return JSON.parse(result.content[0].text);
  } catch {
    return {
      hook: `I'm excited about ${startup.name}'s work in ${startup.industry}.`,
      fitRationale: `With experience in ${technicalProfile.domains?.join(' and ')}, I'd bring relevant expertise to ${startup.name}.`,
      shortEmail: `Hi, I'm a ${technicalProfile.seniority} engineer interested in ${startup.name}. My background in ${technicalProfile.skills?.slice(0, 3).join(', ')} aligns well with your team. Would love to chat about opportunities.`,
      longEmail: `Hi, I'm a ${technicalProfile.seniority} engineer with expertise in ${technicalProfile.skills?.slice(0, 5).join(', ')}. I'm reaching out because ${startup.name}'s work in ${startup.industry} resonates with my career goals. I'd welcome the chance to discuss how I could contribute to your team.`,
    };
  }
}

export async function generateOutreach(categorized, technicalProfile, narrativeProfile) {
  const concurrencyLimit = 3;
  const allStartups = [...categorized.exact, ...categorized.recommended, ...categorized.luck];
  const withOutreach = [];

  for (let i = 0; i < allStartups.length; i += concurrencyLimit) {
    const batch = allStartups.slice(i, i + concurrencyLimit);
    const results = await Promise.all(
      batch.map(async (startup) => {
        const outreach = await generateForStartup(startup, technicalProfile, narrativeProfile);
        return { ...startup, outreach };
      })
    );
    withOutreach.push(...results);
  }

  return {
    exact: withOutreach.filter((s) => s.category === 'exact'),
    recommended: withOutreach.filter((s) => s.category === 'recommended'),
    luck: withOutreach.filter((s) => s.category === 'luck'),
  };
}
