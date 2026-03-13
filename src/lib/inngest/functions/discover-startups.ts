import { cacheGet, cacheSet } from "@/lib/kv";
import { extractCompanyProfile, stripHtml } from "@/lib/anthropic";
import type { CandidateProfile, CompanyProfile, SearchParameters } from "@/lib/types";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferUrl(companyInput: string): string {
  if (companyInput.startsWith("http")) {
    return companyInput;
  }
  const domain = companyInput
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  return `https://${domain}.com`;
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NexusBot/1.0; +https://nexus.io)",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return `Failed to fetch ${url}: ${response.status}`;
    }
    return await response.text();
  } catch {
    return `Failed to fetch ${url}`;
  }
}

// --- Mock data sources ---
// TODO: Replace with real API integrations

function mockCrunchbaseSearch(params: SearchParameters): string[] {
  // Mock: return startup names based on search parameters
  // Real: POST https://api.crunchbase.com/api/v4/searches/organizations
  const mockStartups: Record<string, string[]> = {
    "series-a": ["Vercel", "Linear", "Resend"],
    "series-b": ["Anthropic", "Figma", "Notion"],
    seed: ["Arc", "Warp", "Railway"],
  };
  const results: string[] = [];
  for (const stage of params.fundingStages) {
    results.push(...(mockStartups[stage] || []));
  }
  return results.length > 0 ? results : ["Vercel", "Linear", "Anthropic"];
}

function mockApolloSearch(params: SearchParameters): string[] {
  // Mock: return company names based on industries
  // Real: POST https://api.apollo.io/v1/mixed_companies/search
  return [];
}

function mockYCSearch(params: SearchParameters): string[] {
  // Mock: return YC company names
  // Real: GET https://api.ycombinator.com/v0.1/companies
  return [];
}

function mockSerperSearch(
  candidate: CandidateProfile,
  params: SearchParameters
): string[] {
  // Mock: return company names from web search
  // Real: POST https://google.serper.dev/search
  return [];
}

function searchDolH1b1Csv(params: SearchParameters): string[] {
  // TODO: Parse src/data/dol-h1b1.csv and match against search params
  // For V1, return empty — CSV lookup is a placeholder
  return [];
}

export async function discoverStartups(
  candidate: CandidateProfile,
  searchParams: SearchParameters
): Promise<CompanyProfile[]> {
  // Aggregate startup names from multiple sources
  const sources = [
    ...mockCrunchbaseSearch(searchParams),
    ...mockApolloSearch(searchParams),
    ...mockYCSearch(searchParams),
    ...mockSerperSearch(candidate, searchParams),
    ...searchDolH1b1Csv(searchParams),
  ];

  // Deduplicate by name
  const uniqueNames = Array.from(new Set(sources));

  const profiles: CompanyProfile[] = [];

  for (const name of uniqueNames) {
    const slug = slugify(name);
    const cacheKey = `company:${slug}`;

    const cached = await cacheGet<CompanyProfile>(cacheKey);
    if (cached) {
      profiles.push(cached);
      continue;
    }

    const url = inferUrl(name);
    const rawHtml = await fetchPageContent(url);
    const profile = await extractCompanyProfile(rawHtml, name, url);

    await cacheSet(cacheKey, profile);
    profiles.push(profile);
  }

  return profiles;
}
