import Anthropic from "@anthropic-ai/sdk";
import type {
  CompanyProfile,
  EnrichedContact,
  OutreachDraft,
  TechnicalProfile,
  NarrativeProfile,
  CandidateProfile,
  StartupMatch,
  StartupScores,
} from "./types";

const anthropic = new Anthropic();

const MODEL = "claude-sonnet-4-20250514";

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}

// --- Candidate Profiling ---

export async function extractTechnicalProfile(
  resumeText: string
): Promise<TechnicalProfile> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a technical recruiter. Analyze the resume and extract a structured technical profile. Return valid JSON:
{
  "skills": ["array of technical skills"],
  "seniority": "string - junior, mid, senior, staff, principal",
  "domains": ["array of domain expertise areas, e.g. backend, frontend, ML, devops"]
}
Return ONLY the JSON object.`,
    messages: [{ role: "user", content: resumeText.slice(0, 30000) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text) as TechnicalProfile;
  } catch {
    return { skills: [], seniority: "unknown", domains: [] };
  }
}

export async function extractNarrativeProfile(
  coverLetterText: string
): Promise<NarrativeProfile> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a career coach. Analyze the cover letter and extract a narrative profile capturing the candidate's personality and motivations. Return valid JSON:
{
  "motivation": "string - what drives this candidate",
  "values": ["array of core professional values"],
  "communicationStyle": "string - description of their writing/communication style"
}
Return ONLY the JSON object.`,
    messages: [{ role: "user", content: coverLetterText.slice(0, 15000) }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  try {
    return JSON.parse(text) as NarrativeProfile;
  } catch {
    return { motivation: "unknown", values: [], communicationStyle: "unknown" };
  }
}

// --- Company Research ---

export async function extractCompanyProfile(
  rawHtml: string,
  companyName: string,
  companyUrl: string
): Promise<CompanyProfile> {
  const content = stripHtml(rawHtml);
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a company research assistant. Extract structured information from the provided web content and return valid JSON matching this exact shape:
{
  "description": "string - company description/mission",
  "recentNews": ["array of recent news items or announcements"],
  "techStack": ["array of technologies used"],
  "openRoles": ["array of open job titles"],
  "stage": "string - company stage (seed, series-a, series-b, growth, public, unknown)",
  "headcount": "string - estimated employee count or range"
}
Return ONLY the JSON object, no markdown or explanation.`,
    messages: [
      {
        role: "user",
        content: `Company: ${companyName}\nURL: ${companyUrl}\n\nWeb content:\n${content}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      description: `${companyName} - unable to parse structured data`,
      recentNews: [],
      techStack: [],
      openRoles: [],
      stage: "unknown",
      headcount: "unknown",
    };
  }

  return {
    name: companyName,
    slug,
    url: companyUrl,
    description: (parsed.description as string) || "",
    recentNews: (parsed.recentNews as string[]) || [],
    techStack: (parsed.techStack as string[]) || [],
    openRoles: (parsed.openRoles as string[]) || [],
    stage: (parsed.stage as string) || "unknown",
    headcount: (parsed.headcount as string) || "unknown",
    rawContent: content.slice(0, 5000),
  };
}

// --- Categorization ---

export async function categorizeStartups(
  candidate: CandidateProfile,
  startups: CompanyProfile[]
): Promise<StartupMatch[]> {
  const techProfile = candidate.technicalProfile;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a startup-candidate matching expert. Score each startup on 4 dimensions (0-100) based on the candidate's profile, then assign a category.

Dimensions:
- technicalFit: How well the candidate's skills match the company's tech stack and open roles
- parameterMatch: How well the company matches the candidate's search preferences
- visaFriendliness: Likelihood the company sponsors H-1B1 visas (based on size, stage, international presence)
- trending: Company momentum signals (recent funding, growth, news)

Categories:
- "exact": Total score >= 300
- "recommended": Total score >= 200
- "luck": Total score < 200

Return valid JSON array:
[{
  "companySlug": "string",
  "scores": { "technicalFit": number, "parameterMatch": number, "visaFriendliness": number, "trending": number },
  "category": "exact" | "recommended" | "luck"
}]
Return ONLY the JSON array.`,
    messages: [
      {
        role: "user",
        content: `Candidate skills: ${techProfile?.skills.join(", ") || "unknown"}
Candidate seniority: ${techProfile?.seniority || "unknown"}
Candidate domains: ${techProfile?.domains.join(", ") || "unknown"}

Startups to evaluate:
${startups.map((s) => `- ${s.name} (${s.slug}): ${s.description}. Tech: ${s.techStack.join(", ")}. Stage: ${s.stage}. Roles: ${s.openRoles.join(", ")}`).join("\n")}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let scored: Array<{ companySlug: string; scores: StartupScores; category: "exact" | "recommended" | "luck" }>;
  try {
    scored = JSON.parse(text);
  } catch {
    scored = startups.map((s) => ({
      companySlug: s.slug,
      scores: { technicalFit: 50, parameterMatch: 50, visaFriendliness: 50, trending: 50 },
      category: "recommended" as const,
    }));
  }

  const scoreMap = new Map(scored.map((s) => [s.companySlug, s]));

  return startups.map((startup) => {
    const match = scoreMap.get(startup.slug);
    return {
      ...startup,
      scores: match?.scores || { technicalFit: 50, parameterMatch: 50, visaFriendliness: 50, trending: 50 },
      category: match?.category || "recommended",
      contacts: [],
      news: startup.recentNews,
      careerPageUrl: `${startup.url}/careers`,
      immigrantWorkforcePercent: "unknown",
    };
  });
}

// --- Outreach Generation ---

export async function generateOutreachEmail(
  profile: StartupMatch,
  contact: EnrichedContact,
  candidate: CandidateProfile
): Promise<OutreachDraft> {
  const narrative = candidate.narrativeProfile;
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a professional job seeker writing cold outreach emails on behalf of an H-1B1 visa candidate. Write personalized, warm but professional emails. Reference something specific about the company. Match the candidate's communication style.

Return valid JSON:
{
  "subject": "string - email subject line",
  "hook": "string - personalized opening hook about why this company",
  "fitRationale": "string - why this candidate is a great fit",
  "shortVariant": "string - complete short email under 100 words",
  "longVariant": "string - complete longer email under 200 words"
}
Return ONLY the JSON object.`,
    messages: [
      {
        role: "user",
        content: `Candidate: ${candidate.name}
Communication style: ${narrative?.communicationStyle || "professional"}
Motivation: ${narrative?.motivation || "career growth"}
Skills: ${candidate.technicalProfile?.skills.join(", ") || "various"}

Contact: ${contact.name} (${contact.title}) at ${profile.name}

Company details:
- Description: ${profile.description}
- Recent news: ${profile.recentNews.join(", ") || "None available"}
- Tech stack: ${profile.techStack.join(", ") || "Not specified"}
- Open roles: ${profile.openRoles.join(", ") || "Not specified"}
- Stage: ${profile.stage}
- Fit scores: Technical ${profile.scores.technicalFit}, Parameter ${profile.scores.parameterMatch}, Visa ${profile.scores.visaFriendliness}`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: { subject: string; hook: string; fitRationale: string; shortVariant: string; longVariant: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      subject: `Interested in opportunities at ${profile.name}`,
      hook: `I was excited to learn about ${profile.name}'s work in ${profile.description.slice(0, 50)}...`,
      fitRationale: `My background in ${candidate.technicalProfile?.skills.slice(0, 3).join(", ") || "software engineering"} aligns well with your team's needs.`,
      shortVariant: `Hi ${contact.name},\n\nI came across ${profile.name} and was impressed by what you're building. I'd love to learn more about opportunities on your team.\n\nBest regards,\n${candidate.name}`,
      longVariant: `Hi ${contact.name},\n\nI came across ${profile.name} and was impressed by what you're building. My background in ${candidate.technicalProfile?.skills.slice(0, 3).join(", ") || "software engineering"} aligns well with your team.\n\nI'd love to learn more about opportunities and how I could contribute.\n\nWould you be open to a brief chat?\n\nBest regards,\n${candidate.name}`,
    };
  }

  return {
    contactEmail: contact.email,
    contactName: contact.name,
    company: profile.name,
    subject: parsed.subject,
    body: parsed.longVariant,
    hook: parsed.hook,
    fitRationale: parsed.fitRationale,
    shortVariant: parsed.shortVariant,
    longVariant: parsed.longVariant,
    generatedAt: new Date().toISOString(),
  };
}
