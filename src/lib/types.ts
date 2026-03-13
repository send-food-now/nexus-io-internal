// Shared types for the Nexus.io pipeline
// All types are JSON-serializable (no Date objects) for Inngest step isolation

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

export type EnrichedContact = {
  name: string;
  email: string;
  title: string;
  company: string;
  linkedinUrl?: string;
  source: string;
};

export type OutreachDraft = {
  contactEmail: string;
  contactName: string;
  company: string;
  subject: string;
  body: string;
  generatedAt: string;
};

export type PipelineEvents = {
  "pipeline/run": {
    data: {
      companies: string[];
      sheetId: string;
      userId: string;
    };
  };
};
