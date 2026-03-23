import Anthropic from '@anthropic-ai/sdk';
import { getContacts } from '../mocks/apollo.js';

const client = new Anthropic();

function cleanJson(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

async function searchNews(companyName) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `"${companyName}" news funding 2025 2026`, num: 5 }),
    });
    const data = await res.json();
    return (data.organic || []).slice(0, 3).map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
    }));
  } catch (e) {
    console.error(`News search failed for ${companyName}:`, e.message);
    return [];
  }
}

async function generateFitContext(startup, candidateProfile, opportunities) {
  try {
    const sectorFit = opportunities.targetSectors?.find(s =>
      (startup.industry || '').toLowerCase().includes(s.sector.toLowerCase()) ||
      s.sector.toLowerCase().includes((startup.industry || '').toLowerCase())
    );

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Given this candidate and startup, provide outreach context. Return JSON only, no markdown.

Candidate: ${JSON.stringify({ skills: candidateProfile.skills, domains: candidateProfile.domains, careerObjectives: candidateProfile.careerObjectives })}
Startup: ${JSON.stringify({ name: startup.name, industry: startup.industry, description: startup.description })}
Sector Match Rationale: ${sectorFit?.rationale || 'General match'}

Schema:
{
  "fitScore": number (1-10),
  "narrativeFit": string (one-liner on strategic narrative fit),
  "emailSubjectLines": string[] (3 suggested email subject headlines)
}`,
      }],
    });

    return JSON.parse(cleanJson(response.content[0].text));
  } catch (e) {
    console.error(`Fit context generation failed for ${startup.name}:`, e.message);
    return { fitScore: 5, narrativeFit: '', emailSubjectLines: [] };
  }
}

async function enrichStartup(startup, candidateProfile, opportunities) {
  const [contacts, recentNews, fitContext] = await Promise.all([
    Promise.resolve(getContacts(startup.domain)),
    searchNews(startup.name),
    generateFitContext(startup, candidateProfile, opportunities),
  ]);

  const careerPageUrl = startup.domain ? `https://${startup.domain}/careers` : null;

  return {
    ...startup,
    contacts,
    recentNews,
    careerPageUrl,
    fitScore: fitContext.fitScore,
    narrativeFit: fitContext.narrativeFit,
    emailSubjectLines: fitContext.emailSubjectLines,
  };
}

export async function populateContext({ startups, candidateProfile, opportunities }) {
  const results = [];
  for (const startup of startups) {
    results.push(await enrichStartup(startup, candidateProfile, opportunities));
  }
  return results;
}
