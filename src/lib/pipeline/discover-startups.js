import { readFileSync } from 'fs';
import { join } from 'path';
import { searchStartups } from '../mocks/crunchbase.js';
import { searchCompanies } from '../mocks/apollo.js';

async function searchSerper(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    });
    const data = await res.json();
    return (data.organic || []).map(r => ({
      name: r.title?.split(' - ')[0]?.split(' | ')[0]?.trim() || r.title,
      domain: new URL(r.link).hostname.replace('www.', ''),
      description: r.snippet || '',
      source: 'serper',
    }));
  } catch (e) {
    console.error('Serper search failed:', e.message);
    return [];
  }
}

function parseDolCsv() {
  try {
    const csvPath = join(process.cwd(), 'data', 'dol-h1b1.csv');
    const content = readFileSync(csvPath, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const row = {};
      headers.forEach((h, i) => { row[h.trim()] = values[i]?.trim(); });
      return {
        name: row.EMPLOYER_NAME,
        domain: row.EMPLOYER_NAME?.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
        location: `${row.CITY}, ${row.STATE}`,
        h1b1Approvals: parseInt(row.INITIAL_APPROVAL || '0') + parseInt(row.CONTINUING_APPROVAL || '0'),
        source: 'dol-h1b1',
      };
    });
  } catch (e) {
    console.error('Failed to parse DOL CSV:', e.message);
    return [];
  }
}

function deduplicateByDomain(startups) {
  const seen = new Map();
  for (const s of startups) {
    const key = s.domain?.toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      const existing = seen.get(key);
      seen.set(key, { ...existing, ...s, source: [existing.source, s.source].flat().filter(Boolean) });
    } else {
      seen.set(key, { ...s, source: [s.source].flat().filter(Boolean) });
    }
  }
  return Array.from(seen.values());
}

export async function discoverStartups({ candidateProfile, searchParams }) {
  const { industries = [], fundingStages = [], locations = [], teamSizes = [], techStack = [], customInterests = [] } = searchParams;

  const [crunchbaseResults, apolloResults, serperResults, dolResults] = await Promise.all([
    Promise.resolve(searchStartups({ industries, fundingStages, locations, teamSizes })),
    Promise.resolve(searchCompanies(industries.join(' '))),
    searchSerper(`hiring ${techStack.slice(0, 3).join(' ')} startup ${locations.slice(0, 2).join(' ')} ${industries.slice(0, 2).join(' ')}`),
    Promise.resolve(parseDolCsv()),
  ]);

  const all = [
    ...crunchbaseResults.map(s => ({ ...s, source: 'crunchbase' })),
    ...apolloResults.map(s => ({ ...s, source: 'apollo' })),
    ...serperResults,
    ...dolResults,
  ];

  return deduplicateByDomain(all);
}
