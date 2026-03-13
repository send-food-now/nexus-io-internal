import { cacheGet, cacheSet } from "@/lib/kv";
import { generateOutreachEmail } from "@/lib/anthropic";
import type { CandidateProfile, StartupMatch, OutreachDraft } from "@/lib/types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateOutreach(
  candidate: CandidateProfile,
  startups: StartupMatch[]
): Promise<OutreachDraft[]> {
  const drafts: OutreachDraft[] = [];
  let callCount = 0;

  for (const startup of startups) {
    for (const contact of startup.contacts) {
      const cacheKey = `outreach:${contact.email}:${startup.slug}`;

      const cached = await cacheGet<OutreachDraft>(cacheKey);
      if (cached) {
        drafts.push(cached);
        continue;
      }

      // Rate limiting: 1s delay between Claude API calls
      if (callCount > 0) {
        await delay(1000);
      }

      const draft = await generateOutreachEmail(startup, contact, candidate);

      await cacheSet(cacheKey, draft);
      drafts.push(draft);
      callCount++;
    }
  }

  return drafts;
}
