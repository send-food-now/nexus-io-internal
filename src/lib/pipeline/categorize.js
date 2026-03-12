import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function categorizeStartups(startups, technicalProfile, searchParams) {
  if (!startups.length) return { exact: [], recommended: [], luck: [] };

  // Process in batches of 10
  const batchSize = 10;
  const scoredStartups = [];

  for (let i = 0; i < startups.length; i += batchSize) {
    const batch = startups.slice(i, i + batchSize);
    const scored = await scoreBatch(batch, technicalProfile, searchParams);
    scoredStartups.push(...scored);
  }

  // Bucket by composite score
  const exact = [];
  const recommended = [];
  const luck = [];

  for (const startup of scoredStartups) {
    const avg = (startup.scores.technicalFit + startup.scores.parameterMatch + startup.scores.visaFriendliness + startup.scores.trendingSignal) / 4;
    startup.compositeScore = Math.round(avg);
    startup.category = avg >= 80 ? 'exact' : avg >= 50 ? 'recommended' : 'luck';

    if (startup.category === 'exact') exact.push(startup);
    else if (startup.category === 'recommended') recommended.push(startup);
    else luck.push(startup);
  }

  // Sort each bucket by composite score descending
  exact.sort((a, b) => b.compositeScore - a.compositeScore);
  recommended.sort((a, b) => b.compositeScore - a.compositeScore);
  luck.sort((a, b) => b.compositeScore - a.compositeScore);

  return { exact, recommended, luck };
}

async function scoreBatch(batch, technicalProfile, searchParams) {
  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a startup-candidate matching expert. Score each startup on these dimensions (0-100):
1. technicalFit: How well the candidate's skills match the startup's likely tech needs
2. parameterMatch: How well the startup matches the candidate's search criteria (funding stage, team size, location, industry)
3. visaFriendliness: Likelihood of H-1B1 visa sponsorship (companies with prior visa sponsorship history score higher, larger companies score higher)
4. trendingSignal: Recent growth indicators (recent funding, hiring signals, industry momentum)

Return ONLY a valid JSON array where each element has:
{
  "name": string (company name),
  "scores": { "technicalFit": number, "parameterMatch": number, "visaFriendliness": number, "trendingSignal": number },
  "rationale": string (brief explanation)
}`,
    messages: [
      {
        role: 'user',
        content: `Candidate profile:
Skills: ${technicalProfile.skills?.join(', ')}
Seniority: ${technicalProfile.seniority}
Domains: ${technicalProfile.domains?.join(', ')}

Search criteria:
Industries: ${searchParams.industries?.join(', ') || 'Any'}
Locations: ${searchParams.locations?.join(', ') || 'Any'}
Funding stages: ${searchParams.fundingStages?.join(', ') || 'Any'}
Team sizes: ${searchParams.teamSizes?.join(', ') || 'Any'}

Startups to score:
${JSON.stringify(batch, null, 2)}`,
      },
    ],
  });

  try {
    const scored = JSON.parse(result.content[0].text);
    // Merge scores back into startup objects
    return batch.map((startup) => {
      const match = scored.find((s) => s.name.toLowerCase() === startup.name.toLowerCase());
      return {
        ...startup,
        scores: match?.scores || { technicalFit: 50, parameterMatch: 50, visaFriendliness: 50, trendingSignal: 50 },
        rationale: match?.rationale || '',
      };
    });
  } catch {
    // Fallback: assign default scores
    return batch.map((startup) => ({
      ...startup,
      scores: { technicalFit: 50, parameterMatch: 50, visaFriendliness: startup.visaSponsored ? 80 : 50, trendingSignal: 50 },
      rationale: 'Auto-scored (scoring error)',
    }));
  }
}
