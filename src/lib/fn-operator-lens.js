import Anthropic from '@anthropic-ai/sdk';
import { inngest } from './inngest';
import { getPipelineData, setPipelineData } from './job-store';

const client = new Anthropic();
const MODEL = 'claude-sonnet-4-20250514';

function cleanJson(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const ANALYZE_PROFILE_SYSTEM = `You are an expert career strategist and technical recruiter. Analyze the candidate's full professional profile. Extract their key skills, years of experience by domain, career trajectory pattern, and career objectives. Return valid JSON only, no markdown.

Schema:
{
  "keySkills": string[],
  "experienceByDomain": { [domain: string]: number },
  "trajectoryPattern": "linear" | "non-linear",
  "statedObjectives": string,
  "impliedObjectives": string
}`;

const BUILD_MARKET_MAP_DOUBLE_DOWN_SYSTEM = `You are a startup market strategist with deep knowledge of the current tech landscape. The candidate wants to double down in their existing domain. Build a market map of sectors directly aligned with their experience and the latest market theses. Return valid JSON only, no markdown.

Schema:
{
  "sectors": [
    {
      "name": string,
      "thesis": string,
      "relevance": string,
      "keyPlayers": string[]
    }
  ]
}`;

const BUILD_MARKET_MAP_PIVOT_SYSTEM = `You are a startup market strategist with deep knowledge of the current tech landscape. The candidate wants to pivot into new spaces. Build adjacent market maps where the candidate's transferable skills apply, using the latest market theses. Return valid JSON only, no markdown.

Schema:
{
  "sectors": [
    {
      "name": string,
      "thesis": string,
      "transferableSkills": string[],
      "adjacencyRationale": string,
      "keyPlayers": string[]
    }
  ]
}`;

const FILTER_BY_RISK_LATE_SYSTEM = `You are a startup market strategist. The candidate has a low risk appetite. Filter and prioritise the following market map for late-stage firms (Series C or later). Reorder sectors by strength of late-stage opportunity and remove or deprioritise sectors dominated by early-stage players. Return valid JSON only, no markdown.

Schema:
{
  "sectors": [
    {
      "name": string,
      "thesis": string,
      "stageRationale": string,
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

const FILTER_BY_RISK_EARLY_SYSTEM = `You are a startup market strategist. The candidate has a high risk appetite. Filter and prioritise the following market map for early-stage firms (Series B or earlier). Reorder sectors by strength of early-stage opportunity and highlight sectors with high growth potential. Return valid JSON only, no markdown.

Schema:
{
  "sectors": [
    {
      "name": string,
      "thesis": string,
      "stageRationale": string,
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

const MATCH_SECTOR_SYSTEM = `You are a startup market strategist and career advisor. Match the candidate's background to the highest-potential sectors from the filtered list. Produce a ranked list of best-fit sectors with reasoning. Return valid JSON only, no markdown.

Schema:
{
  "rankedSectors": [
    {
      "sector": string,
      "rank": number,
      "fitScore": number (1-10),
      "reasoning": string,
      "keyStrengths": string[]
    }
  ]
}`;

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export const operatorLensFunction = inngest.createFunction(
  { id: 'fn-operator-lens', name: 'Operator Lens' },
  { event: 'pipeline/operator-lens.start' },
  async ({ event, step }) => {
    const { candidateId } = event.data;

    // Step 1: Analyze profile
    await step.run('analyze-profile', async () => {
      const profileData = await getPipelineData(candidateId, '1.1');
      if (!profileData) {
        throw new Error(`No profile data at pipeline:${candidateId}:1.1`);
      }

      let result;
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: ANALYZE_PROFILE_SYSTEM,
          messages: [{
            role: 'user',
            content: `Analyze this candidate profile:\n\n${JSON.stringify(profileData, null, 2)}`,
          }],
        });
        result = JSON.parse(cleanJson(response.content[0].text));
      } catch (error) {
        console.error('[analyze-profile] Failed', { key: `pipeline:${candidateId}:2.0`, error: error.message });
        throw error;
      }

      await setPipelineData(candidateId, '2.0', result);
    });

    // Step 2: Build market map
    await step.run('build-market-map', async () => {
      const profileAnalysis = await getPipelineData(candidateId, '2.0');
      const searchParams = await getPipelineData(candidateId, '1.0');
      if (!profileAnalysis) {
        throw new Error(`No profile analysis at pipeline:${candidateId}:2.0`);
      }
      if (!searchParams) {
        throw new Error(`No search params at pipeline:${candidateId}:1.0`);
      }

      const isDoubleDown = searchParams.direction === 'double-down';
      const systemPrompt = isDoubleDown
        ? BUILD_MARKET_MAP_DOUBLE_DOWN_SYSTEM
        : BUILD_MARKET_MAP_PIVOT_SYSTEM;

      let result;
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Build a market map for this candidate.

## Profile Analysis
${JSON.stringify(profileAnalysis, null, 2)}

## Search Parameters
- Direction: ${searchParams.direction}
- Preferred Regions: ${searchParams.regions?.join(', ') || 'Any'}`,
          }],
        });
        result = JSON.parse(cleanJson(response.content[0].text));
      } catch (error) {
        console.error('[build-market-map] Failed', { key: `pipeline:${candidateId}:2.1a`, error: error.message });
        throw error;
      }

      await setPipelineData(candidateId, '2.1a', result);
    });

    // Step 3: Filter by risk
    await step.run('filter-by-risk', async () => {
      const marketMap = await getPipelineData(candidateId, '2.1a');
      const searchParams = await getPipelineData(candidateId, '1.0');
      if (!marketMap) {
        throw new Error(`No market map at pipeline:${candidateId}:2.1a`);
      }
      if (!searchParams) {
        throw new Error(`No search params at pipeline:${candidateId}:1.0`);
      }

      const isLowRisk = searchParams.riskAppetite <= 3;
      const systemPrompt = isLowRisk
        ? FILTER_BY_RISK_LATE_SYSTEM
        : FILTER_BY_RISK_EARLY_SYSTEM;

      let result;
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Filter this market map by risk appetite.

## Market Map
${JSON.stringify(marketMap, null, 2)}

## Risk Appetite: ${searchParams.riskAppetite}/6 (${isLowRisk ? 'low risk — prefer late-stage' : 'high risk — prefer early-stage'})`,
          }],
        });
        result = JSON.parse(cleanJson(response.content[0].text));
      } catch (error) {
        console.error('[filter-by-risk] Failed', { key: `pipeline:${candidateId}:2.1b`, error: error.message });
        throw error;
      }

      await setPipelineData(candidateId, '2.1b', result);
    });

    // Step 4: Match sector
    const sectors = await step.run('match-sector', async () => {
      const filteredResults = await getPipelineData(candidateId, '2.1b');
      const profileAnalysis = await getPipelineData(candidateId, '2.0');
      if (!filteredResults) {
        throw new Error(`No filtered results at pipeline:${candidateId}:2.1b`);
      }
      if (!profileAnalysis) {
        throw new Error(`No profile analysis at pipeline:${candidateId}:2.0`);
      }

      let result;
      try {
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: MATCH_SECTOR_SYSTEM,
          messages: [{
            role: 'user',
            content: `Match this candidate to the best-fit sectors.

## Candidate Profile Analysis
${JSON.stringify(profileAnalysis, null, 2)}

## Risk-Filtered Sectors
${JSON.stringify(filteredResults, null, 2)}`,
          }],
        });
        result = JSON.parse(cleanJson(response.content[0].text));
      } catch (error) {
        console.error('[match-sector] Failed', { key: `pipeline:${candidateId}:2.1c`, error: error.message });
        throw error;
      }

      await setPipelineData(candidateId, '2.1c', result);
      return result.rankedSectors;
    });

    // Emit completion event
    await step.sendEvent('operator-lens-complete', {
      name: 'pipeline/operator-lens.complete',
      data: { candidateId, sectors },
    });

    return { candidateId, sectors };
  }
);
