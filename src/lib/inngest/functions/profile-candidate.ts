import { extractTechnicalProfile, extractNarrativeProfile } from "@/lib/anthropic";
import type { CandidateProfile } from "@/lib/types";

export async function profileCandidate(
  candidate: CandidateProfile
): Promise<CandidateProfile> {
  const [technicalProfile, narrativeProfile] = await Promise.all([
    candidate.resumeText
      ? extractTechnicalProfile(candidate.resumeText)
      : Promise.resolve(null),
    candidate.coverLetterText
      ? extractNarrativeProfile(candidate.coverLetterText)
      : Promise.resolve(null),
  ]);

  return {
    ...candidate,
    technicalProfile,
    narrativeProfile,
  };
}
