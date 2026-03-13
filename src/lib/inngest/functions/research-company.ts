import { cacheGet, cacheSet } from "@/lib/kv";
import { extractCompanyProfile } from "@/lib/anthropic";
import type { CompanyProfile } from "@/lib/types";

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
  // Infer URL from company name
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
        "User-Agent":
          "Mozilla/5.0 (compatible; NexusBot/1.0; +https://nexus.io)",
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

export async function researchCompanies(
  companies: string[]
): Promise<CompanyProfile[]> {
  const profiles: CompanyProfile[] = [];

  for (const company of companies) {
    const slug = slugify(company);
    const cacheKey = `company:${slug}`;

    // Check cache first
    const cached = await cacheGet<CompanyProfile>(cacheKey);
    if (cached) {
      profiles.push(cached);
      continue;
    }

    const url = inferUrl(company);
    const rawHtml = await fetchPageContent(url);
    const profile = await extractCompanyProfile(rawHtml, company, url);

    await cacheSet(cacheKey, profile);
    profiles.push(profile);
  }

  return profiles;
}
