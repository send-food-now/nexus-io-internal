import Papa from 'papaparse';
import { readFileSync } from 'fs';
import { join } from 'path';

const SERPER_API_URL = 'https://google.serper.dev/search';

// --- Mocked data sources ---

function queryCrunchbase(searchParams) {
  const mockStartups = [
    { name: 'TechFlow AI', domain: 'techflow.ai', industry: 'AI/ML', location: 'San Francisco, CA', fundingStage: 'Series A', teamSize: '11-50', description: 'AI-powered workflow automation platform' },
    { name: 'FinStack', domain: 'finstack.io', industry: 'Fintech', location: 'New York, NY', fundingStage: 'Series B', teamSize: '51-200', description: 'Modern financial infrastructure for startups' },
    { name: 'CloudNine Labs', domain: 'cloudnine.dev', industry: 'Developer Tools', location: 'San Francisco, CA', fundingStage: 'Seed', teamSize: '1-10', description: 'Next-gen cloud development platform' },
    { name: 'HealthBridge', domain: 'healthbridge.com', industry: 'Healthcare', location: 'Boston, MA', fundingStage: 'Series A', teamSize: '11-50', description: 'Patient data interoperability platform' },
    { name: 'DataWeave', domain: 'dataweave.io', industry: 'Data Infrastructure', location: 'Seattle, WA', fundingStage: 'Series B', teamSize: '51-200', description: 'Real-time data pipeline orchestration' },
    { name: 'SecureVault', domain: 'securevault.io', industry: 'Security', location: 'Austin, TX', fundingStage: 'Series A', teamSize: '11-50', description: 'Zero-trust security for cloud-native apps' },
    { name: 'GreenOps', domain: 'greenops.co', industry: 'Climate Tech', location: 'San Francisco, CA', fundingStage: 'Seed', teamSize: '1-10', description: 'Carbon footprint tracking for engineering teams' },
    { name: 'Paystream', domain: 'paystream.com', industry: 'Fintech', location: 'San Francisco, CA', fundingStage: 'Series A', teamSize: '11-50', description: 'Real-time payment processing infrastructure' },
  ];

  return mockStartups.filter((s) => {
    const matchesIndustry = !searchParams.industries?.length || searchParams.industries.some((i) => s.industry.toLowerCase().includes(i.toLowerCase()));
    const matchesLocation = !searchParams.locations?.length || searchParams.locations.some((l) => s.location.toLowerCase().includes(l.toLowerCase()));
    return matchesIndustry || matchesLocation;
  });
}

function queryApollo(searchParams) {
  const mockCompanies = [
    { name: 'NeuralPath', domain: 'neuralpath.ai', industry: 'AI/ML', location: 'San Francisco, CA', fundingStage: 'Series A', teamSize: '11-50', description: 'Enterprise AI model deployment platform' },
    { name: 'Stackwise', domain: 'stackwise.dev', industry: 'Developer Tools', location: 'Remote', fundingStage: 'Seed', teamSize: '1-10', description: 'AI-powered code review and refactoring' },
    { name: 'Vaultik', domain: 'vaultik.com', industry: 'Security', location: 'New York, NY', fundingStage: 'Series B', teamSize: '51-200', description: 'Digital identity verification platform' },
    { name: 'MedFlow', domain: 'medflow.health', industry: 'Healthcare', location: 'San Francisco, CA', fundingStage: 'Series A', teamSize: '11-50', description: 'Clinical workflow automation' },
    { name: 'Ledgr', domain: 'ledgr.finance', industry: 'Fintech', location: 'New York, NY', fundingStage: 'Seed', teamSize: '1-10', description: 'Crypto accounting for enterprises' },
  ];

  return mockCompanies.filter((s) => {
    const matchesSize = !searchParams.teamSizes?.length || searchParams.teamSizes.includes(s.teamSize);
    return matchesSize;
  });
}

// --- Real data sources ---

async function querySerper(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
    });

    if (!response.ok) return [];
    const data = await response.json();

    return (data.organic || []).map((result) => ({
      name: result.title.split(' - ')[0].split(' | ')[0].trim(),
      domain: new URL(result.link).hostname.replace('www.', ''),
      description: result.snippet || '',
      source: 'serper',
      sourceUrl: result.link,
    }));
  } catch {
    return [];
  }
}

function queryDolCsv(searchParams) {
  try {
    const csvPath = join(process.cwd(), 'data', 'dol-h1b1.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const { data } = Papa.parse(csvContent, { header: true, skipEmptyLines: true });

    return data
      .filter((row) => {
        const matchesIndustry = !searchParams.industries?.length || searchParams.industries.some((i) => (row.industry || '').toLowerCase().includes(i.toLowerCase()));
        const matchesLocation = !searchParams.locations?.length || searchParams.locations.some((l) => (row.city || '').toLowerCase().includes(l.toLowerCase()) || (row.state || '').toLowerCase().includes(l.toLowerCase()));
        return matchesIndustry || matchesLocation;
      })
      .map((row) => ({
        name: row.employer_name,
        domain: row.employer_name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
        industry: row.industry || '',
        location: `${row.city}, ${row.state}`,
        description: `${row.job_title} — $${row.wage}/yr (H-1B1 certified)`,
        source: 'dol-h1b1',
        visaSponsored: true,
      }));
  } catch {
    return [];
  }
}

// --- Main discovery function ---

export async function discoverStartups(technicalProfile, searchParams) {
  const skills = technicalProfile.skills?.join(' ') || '';
  const industries = searchParams.industries?.join(' ') || '';
  const locations = searchParams.locations?.join(' ') || '';

  const results = await Promise.allSettled([
    Promise.resolve(queryCrunchbase(searchParams)),
    Promise.resolve(queryApollo(searchParams)),
    querySerper(`${industries} startups hiring ${skills} ${locations} H-1B1`),
    querySerper(`YC startups ${industries} ${skills}`),
    Promise.resolve(queryDolCsv(searchParams)),
  ]);

  // Flatten successful results
  const allStartups = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  // Deduplicate by normalized company name
  const seen = new Set();
  const unique = [];
  for (const startup of allStartups) {
    const key = startup.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(startup);
    }
  }

  return unique;
}
