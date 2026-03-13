import { writeResults } from "@/lib/google-sheets";
import type { StartupMatch, OutreachDraft } from "@/lib/types";

export async function writePipelineToSheets(
  sheetId: string,
  startups: StartupMatch[],
  drafts: OutreachDraft[],
  candidateEmail?: string
): Promise<{ rowsWritten: number; sheetUrl: string }> {
  const sheetUrl = await writeResults(sheetId, startups, drafts, candidateEmail);
  return { rowsWritten: startups.length, sheetUrl };
}
