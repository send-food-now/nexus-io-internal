import { writeResults } from "@/lib/google-sheets";
import type { CompanyProfile, EnrichedContact, OutreachDraft } from "@/lib/types";

export async function writePipelineToSheets(
  sheetId: string,
  profiles: CompanyProfile[],
  contacts: EnrichedContact[],
  drafts: OutreachDraft[]
): Promise<{ rowsWritten: number }> {
  await writeResults(sheetId, profiles, contacts, drafts);
  return { rowsWritten: contacts.length };
}
