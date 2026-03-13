import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function generateOutreachForStartup(startup, candidateProfile) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an expert career outreach strategist. Given the following candidate profile and startup information, generate personalized outreach content.

## Candidate Profile
**Technical Profile:** ${candidateProfile.technicalProfile}
**Narrative Profile:** ${candidateProfile.narrativeProfile}

## Startup Information
**Name:** ${startup.name}
**Description:** ${startup.description || 'N/A'}
**Tech Stack:** ${Array.isArray(startup.techStack) ? startup.techStack.join(', ') : startup.techStack || 'N/A'}
**Industry:** ${startup.industry || 'N/A'}
**Contacts:** ${JSON.stringify(startup.contacts || [])}
**Recent News:** ${startup.recentNews || startup.news || 'N/A'}

Generate the following in JSON format:
{
  "personalizedHook": "1-2 sentence attention grabber specific to this startup",
  "fitRationale": "2-3 sentences explaining why the candidate is a good fit for this startup",
  "emailShort": "Brief outreach email (3-4 sentences)",
  "emailLong": "Detailed outreach email (6-8 sentences)"
}

Respond ONLY with valid JSON, no markdown fences or extra text.`,
      },
    ],
  });

  const text = message.content[0].text;
  return JSON.parse(text);
}

async function processBucket(startups, candidateProfile) {
  const results = [];
  for (const startup of startups) {
    try {
      const outreach = await generateOutreachForStartup(startup, candidateProfile);
      results.push({
        ...startup,
        personalizedHook: outreach.personalizedHook,
        fitRationale: outreach.fitRationale,
        emailShort: outreach.emailShort,
        emailLong: outreach.emailLong,
      });
    } catch (error) {
      console.error(`Failed to generate outreach for ${startup.name}:`, error);
      results.push({
        ...startup,
        personalizedHook: null,
        fitRationale: null,
        emailShort: null,
        emailLong: null,
      });
    }
  }
  return results;
}

export async function generateOutreach({ categorizedStartups, candidateProfile }) {
  const [exact, recommended, luck] = await Promise.all([
    processBucket(categorizedStartups.exact || [], candidateProfile),
    processBucket(categorizedStartups.recommended || [], candidateProfile),
    processBucket(categorizedStartups.luck || [], candidateProfile),
  ]);

  return {
    exact,
    recommended,
    luck,
  };
}
