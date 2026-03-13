import { cacheGet, cacheSet } from "@/lib/kv";
import type { CompanyProfile, EnrichedContact } from "@/lib/types";

// TODO: Integrate with Apollo.io or Hunter.io for real contact enrichment.
// Expected API shape for Apollo:
//   POST https://api.apollo.io/v1/mixed_people/search
//   Body: { q_organization_name: string, page: 1, per_page: 5 }
//   Response: { people: [{ name, email, title, linkedin_url }] }
//
// Expected API shape for Hunter:
//   GET https://api.hunter.io/v2/domain-search?domain=example.com&api_key=KEY
//   Response: { data: { emails: [{ value, first_name, last_name, position }] } }

function generateMockContacts(profile: CompanyProfile): EnrichedContact[] {
  const domain = profile.url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  return [
    {
      name: "Hiring Manager",
      email: `hiring@${domain}`,
      title: "Hiring Manager",
      company: profile.name,
      source: "mock",
    },
    {
      name: "Head of Talent",
      email: `talent@${domain}`,
      title: "Head of Talent Acquisition",
      company: profile.name,
      source: "mock",
    },
    {
      name: "Engineering Lead",
      email: `eng-lead@${domain}`,
      title: "VP of Engineering",
      company: profile.name,
      linkedinUrl: `https://linkedin.com/company/${profile.slug}`,
      source: "mock",
    },
  ];
}

export async function enrichContacts(
  profiles: CompanyProfile[]
): Promise<EnrichedContact[]> {
  const allContacts: EnrichedContact[] = [];

  for (const profile of profiles) {
    const cacheKey = `contacts:${profile.slug}`;

    const cached = await cacheGet<EnrichedContact[]>(cacheKey);
    if (cached) {
      allContacts.push(...cached);
      continue;
    }

    const contacts = generateMockContacts(profile);

    await cacheSet(cacheKey, contacts);
    allContacts.push(...contacts);
  }

  return allContacts;
}
