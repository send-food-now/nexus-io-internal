import { google, sheets_v4 } from "googleapis";
import type { CompanyProfile, EnrichedContact, OutreachDraft } from "./types";

function getAuthClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

const HEADER_ROW = [
  "Company",
  "Contact Name",
  "Title",
  "Email",
  "LinkedIn",
  "Subject Line",
  "Email Draft",
  "Company Description",
  "Stage",
  "Generated At",
];

export async function writeResults(
  sheetId: string,
  profiles: CompanyProfile[],
  contacts: EnrichedContact[],
  drafts: OutreachDraft[]
): Promise<void> {
  const sheets = getSheetsClient();

  const profileMap = new Map(profiles.map((p) => [p.name, p]));
  const draftMap = new Map(
    drafts.map((d) => [`${d.contactEmail}:${d.company}`, d])
  );

  const rows: string[][] = [HEADER_ROW];

  for (const contact of contacts) {
    const profile = profileMap.get(contact.company);
    const draft = draftMap.get(`${contact.email}:${contact.company}`);

    rows.push([
      contact.company,
      contact.name,
      contact.title,
      contact.email,
      contact.linkedinUrl || "",
      draft?.subject || "",
      draft?.body || "",
      profile?.description || "",
      profile?.stage || "",
      draft?.generatedAt || "",
    ]);
  }

  // Clear existing data and write fresh
  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: "Sheet1",
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: "Sheet1!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}
