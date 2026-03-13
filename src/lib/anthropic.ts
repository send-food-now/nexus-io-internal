import Anthropic from "@anthropic-ai/sdk";
import type { CompanyProfile, EnrichedContact, OutreachDraft } from "./types";

const anthropic = new Anthropic();

const MODEL = "claude-sonnet-4-20250514";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50000);
}

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

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

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

export async function generateOutreachEmail(
  profile: CompanyProfile,
  contact: EnrichedContact
): Promise<OutreachDraft> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: `You are a professional job seeker writing cold outreach emails. Write personalized, warm but professional emails. Keep them under 150 words. Reference something specific about the company. Return valid JSON with this shape:
{
  "subject": "string - email subject line",
  "body": "string - email body"
}
Return ONLY the JSON object.`,
    messages: [
      {
        role: "user",
        content: `Write a cold email to ${contact.name} (${contact.title}) at ${profile.name}.

Company details:
- Description: ${profile.description}
- Recent news: ${profile.recentNews.join(", ") || "None available"}
- Tech stack: ${profile.techStack.join(", ") || "Not specified"}
- Open roles: ${profile.openRoles.join(", ") || "Not specified"}
- Stage: ${profile.stage}`,
      },
    ],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: { subject: string; body: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      subject: `Interested in opportunities at ${profile.name}`,
      body: `Hi ${contact.name},\n\nI came across ${profile.name} and was impressed by what you're building. I'd love to learn more about opportunities on your team.\n\nWould you be open to a brief chat?\n\nBest regards`,
    };
  }

  return {
    contactEmail: contact.email,
    contactName: contact.name,
    company: profile.name,
    subject: parsed.subject,
    body: parsed.body,
    generatedAt: new Date().toISOString(),
  };
}
