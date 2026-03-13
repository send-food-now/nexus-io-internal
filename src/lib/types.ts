// Shared types for the Nexus.io H-1B1 pipeline
// All types are JSON-serializable (no Date objects) for Inngest step isolation

export type TechnicalProfile = {
  skills: string[];
  seniority: string;
  domains: string[];
};

export type NarrativeProfile = {
  motivation: string;
  values: string[];
  communicationStyle: string;
};

export type CandidateProfile = {
  name: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  resumeText: string;
  coverLetterText: string;
  technicalProfile: TechnicalProfile | null;
  narrativeProfile: NarrativeProfile | null;
};

export type SearchParameters = {
  fundingStages: string[];
  teamSizes: string[];
  industries: string[];
  locations: string[];
  techStack: string[];
  customInterests: string[];
};

export type CompanyProfile = {
  name: string;
  slug: string;
  url: string;
  description: string;
  recentNews: string[];
  techStack: string[];
  openRoles: string[];
  stage: string;
  headcount: string;
  rawContent: string;
};

export type StartupScores = {
  technicalFit: number;
  parameterMatch: number;
  visaFriendliness: number;
  trending: number;
};

export type EnrichedContact = {
  name: string;
  email: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  source: string;
};

export type StartupMatch = CompanyProfile & {
  scores: StartupScores;
  category: "exact" | "recommended" | "luck";
  contacts: EnrichedContact[];
  news: string[];
  careerPageUrl: string;
  immigrantWorkforcePercent: string;
};

export type OutreachDraft = {
  contactEmail: string;
  contactName: string;
  company: string;
  subject: string;
  body: string;
  hook: string;
  fitRationale: string;
  shortVariant: string;
  longVariant: string;
  generatedAt: string;
};

export const PIPELINE_STAGES = [
  "profile",
  "discover",
  "categorize",
  "enrich",
  "outreach",
  "sheets",
  "notify",
] as const;

export type StageName = (typeof PIPELINE_STAGES)[number];

export type StageStatus = "pending" | "running" | "completed" | "failed";

export type JobStatus = {
  jobId: string;
  status: "running" | "completed" | "failed";
  stages: Record<StageName, StageStatus>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type PipelineEvents = {
  "pipeline/run": {
    data: {
      jobId: string;
      candidate: CandidateProfile;
      searchParams: SearchParameters;
      sheetId: string;
      adminEmail: string;
    };
  };
};
