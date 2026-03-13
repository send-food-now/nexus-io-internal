import { cacheGet, cacheSet } from "@/lib/kv";
import type { EnrichedContact, StartupMatch } from "@/lib/types";

// TODO: Integrate with Apollo.io for real contact enrichment
// POST https://api.apollo.io/v1/mixed_people/search
// Body: { q_organization_name: string, page: 1, per_page: 5 }

// TODO: Integrate with Serper for real news search
// POST https://google.serper.dev/search
// Body: { q: "company name recent news", num: 5 }

function mockContacts(startup: StartupMatch): EnrichedContact[] {
  const domain = startup.url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  return [
    {
      name: "Hiring Manager",
      email: `hiring@${domain}`,
      title: "Hiring Manager",
      company: startup.name,
      source: "mock",
    },
    {
      name: "Head of Talent",
      email: `talent@${domain}`,
      title: "Head of Talent Acquisition",
      company: startup.name,
      source: "mock",
    },
    {
      name: "Engineering Lead",
      email: `eng-lead@${domain}`,
      title: "VP of Engineering",
      company: startup.name,
      linkedinUrl: `https://linkedin.com/company/${startup.slug}`,
      source: "mock",
    },
  ];
}

function mockNews(startup: StartupMatch): string[] {
  // TODO: Replace with Serper API call
  return startup.recentNews.length > 0
    ? startup.recentNews
    : [`${startup.name} continues to grow in ${startup.stage} stage`];
}

function mockCareerPage(startup: StartupMatch): string {
  return `${startup.url}/careers`;
}

function mockImmigrantWorkforce(): string {
  // TODO: Estimate from H-1B1 data, company size, and industry signals
  return "unknown";
}

export async function enrichStartups(
  startups: StartupMatch[]
): Promise<StartupMatch[]> {
  const enriched: StartupMatch[] = [];

  for (const startup of startups) {
    const cacheKey = `enriched:${startup.slug}`;

    const cached = await cacheGet<StartupMatch>(cacheKey);
    if (cached) {
      enriched.push(cached);
      continue;
    }

    const enrichedStartup: StartupMatch = {
      ...startup,
      contacts: mockContacts(startup),
      news: mockNews(startup),
      careerPageUrl: mockCareerPage(startup),
      immigrantWorkforcePercent: mockImmigrantWorkforce(),
    };

    await cacheSet(cacheKey, enrichedStartup);
    enriched.push(enrichedStartup);
  }

  return enriched;
}
