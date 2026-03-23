import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

function cleanJson(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

export async function identifyOpportunities({ candidateProfile, searchParams }) {
  const { riskAppetite, direction, regions } = searchParams;

  const isLowRisk = riskAppetite <= 3;
  const isDoubleDown = direction === 'double-down';

  const stageGuidance = isLowRisk
    ? 'Focus on late-stage, established companies (Series C and later). These are lower risk with more structured visa sponsorship processes.'
    : 'Focus on early-stage, high-growth companies (Series B and earlier). These are higher risk but may offer more opportunity for impact and growth.';

  const directionGuidance = isDoubleDown
    ? `The candidate wants to DOUBLE DOWN in their current domain (${candidateProfile.currentIndustry || 'their field'}). Build a market map of the most relevant and high-potential companies within this domain and closely related sub-sectors.`
    : `The candidate wants to PIVOT into new spaces. Based on their background in ${candidateProfile.currentIndustry || 'their field'}, build market maps of adjacent and complementary sectors where their skills transfer well.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: `You are a startup market strategist and career advisor with deep knowledge of the current tech landscape. Your job is to identify the best-fit sectors and opportunity areas for an H-1B1 visa candidate. Return valid JSON only, no markdown.

Schema:
{
  "targetSectors": [
    {
      "sector": string,
      "rationale": string,
      "fitScore": number (1-10),
      "marketTrend": string,
      "exampleCompanyTypes": string[]
    }
  ],
  "stageFilter": "early" | "late",
  "directionStrategy": "double-down" | "pivot",
  "searchGuidance": string,
  "keySkillsToHighlight": string[]
}`,
    messages: [{
      role: 'user',
      content: `Identify the best-fit opportunity areas for this candidate.

## Candidate Profile
${JSON.stringify(candidateProfile, null, 2)}

## Search Parameters
- Risk Appetite: ${riskAppetite}/6 ${isLowRisk ? '(low risk)' : '(high risk)'}
- Direction: ${direction}
- Preferred Regions: ${regions?.join(', ') || 'Any'}

## Guidance
${stageGuidance}

${directionGuidance}

Based on the latest market theses and the candidate's background, identify 3-5 high-potential sectors that best suit this candidate. For each sector, explain why it's a good fit and provide a fit score (1-10).`,
    }],
  });

  const result = JSON.parse(cleanJson(response.content[0].text));

  return {
    ...result,
    stageFilter: isLowRisk ? 'late' : 'early',
    directionStrategy: direction,
    riskAppetite,
  };
}
