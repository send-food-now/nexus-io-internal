import { cacheGet, cacheSet } from "@/lib/kv";
import { generateOutreachEmail } from "@/lib/anthropic";
import type { CompanyProfile, EnrichedContact, OutreachDraft } from "@/lib/types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateOutreach(
  profiles: CompanyProfile[],
  contacts: EnrichedContact[]
): Promise<OutreachDraft[]> {
  const profileMap = new Map(profiles.map((p) => [p.name, p]));
  const drafts: OutreachDraft[] = [];

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const cacheKey = `outreach:${contact.email}:${contact.company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

    const cached = await cacheGet<OutreachDraft>(cacheKey);
    if (cached) {
      drafts.push(cached);
      continue;
    }

    const profile = profileMap.get(contact.company);
    if (!profile) continue;

    // Rate limiting: 1s delay between Claude API calls (skip before the first)
    if (i > 0) {
      await delay(1000);
    }

    const draft = await generateOutreachEmail(profile, contact);

    await cacheSet(cacheKey, draft);
    drafts.push(draft);
  }

  return drafts;
}
