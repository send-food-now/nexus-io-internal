import { categorizeStartups } from "@/lib/anthropic";
import { cacheGet, cacheSet } from "@/lib/kv";
import type { CandidateProfile, CompanyProfile, StartupMatch } from "@/lib/types";

export async function categorize(
  candidate: CandidateProfile,
  startups: CompanyProfile[]
): Promise<StartupMatch[]> {
  const cacheKey = `categorized:${candidate.email}`;

  const cached = await cacheGet<StartupMatch[]>(cacheKey);
  if (cached) return cached;

  const matches = await categorizeStartups(candidate, startups);

  await cacheSet(cacheKey, matches);
  return matches;
}
