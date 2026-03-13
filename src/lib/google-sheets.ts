import { google, sheets_v4 } from "googleapis";
import type { StartupMatch, OutreachDraft } from "./types";

function getAuthClient() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

function getSheetsClient(): sheets_v4.Sheets {
  const auth = getAuthClient();
  return google.sheets({ version: "v4", auth });
}

const HEADER_ROW = [
  "Company",
  "Description",
  "URL",
  "Career Page",
  "Stage",
  "Headcount",
  "Tech Stack",
  "Open Roles",
  "Recent News",
  "Immigrant Workforce %",
  "Technical Fit Score",
  "Parameter Match Score",
  "Visa Friendliness Score",
  "Trending Score",
  "Total Score",
  "Category",
  "Contact 1 Name",
  "Contact 1 Title",
  "Contact 1 Email",
  "Contact 1 LinkedIn",
  "Contact 2 Name",
  "Contact 2 Title",
  "Contact 2 Email",
  "Contact 2 LinkedIn",
  "Contact 3 Name",
  "Contact 3 Title",
  "Contact 3 Email",
  "Contact 3 LinkedIn",
  "Outreach Hook",
  "Fit Rationale",
  "Subject Line",
  "Short Email",
  "Long Email",
  "Generated At",
];

function buildRow(startup: StartupMatch, drafts: OutreachDraft[]): string[] {
  const draft = drafts.find((d) => d.company === startup.name);
  const totalScore =
    startup.scores.technicalFit +
    startup.scores.parameterMatch +
    startup.scores.visaFriendliness +
    startup.scores.trending;

  const contacts = startup.contacts.slice(0, 3);
  const contactFields: string[] = [];
  for (let i = 0; i < 3; i++) {
    const c = contacts[i];
    contactFields.push(
      c?.name || "",
      c?.title || "",
      c?.email || "",
      c?.linkedinUrl || ""
    );
  }

  return [
    startup.name,
    startup.description,
    startup.url,
    startup.careerPageUrl,
    startup.stage,
    startup.headcount,
    startup.techStack.join(", "),
    startup.openRoles.join(", "),
    startup.news.join(" | "),
    startup.immigrantWorkforcePercent,
    String(startup.scores.technicalFit),
    String(startup.scores.parameterMatch),
    String(startup.scores.visaFriendliness),
    String(startup.scores.trending),
    String(totalScore),
    startup.category,
    ...contactFields,
    draft?.hook || "",
    draft?.fitRationale || "",
    draft?.subject || "",
    draft?.shortVariant || "",
    draft?.longVariant || "",
    draft?.generatedAt || "",
  ];
}

async function ensureTab(
  sheets: sheets_v4.Sheets,
  sheetId: string,
  tabName: string
): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const existing = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === tabName
  );
  if (!existing) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }
}

async function writeTab(
  sheets: sheets_v4.Sheets,
  sheetId: string,
  tabName: string,
  startups: StartupMatch[],
  drafts: OutreachDraft[]
): Promise<void> {
  await ensureTab(sheets, sheetId, tabName);

  const rows: string[][] = [HEADER_ROW];
  for (const startup of startups) {
    rows.push(buildRow(startup, drafts));
  }

  await sheets.spreadsheets.values.clear({
    spreadsheetId: sheetId,
    range: tabName,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `${tabName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

export async function writeResults(
  sheetId: string,
  startups: StartupMatch[],
  drafts: OutreachDraft[],
  candidateEmail?: string
): Promise<string> {
  const sheets = getSheetsClient();

  const exact = startups.filter((s) => s.category === "exact");
  const recommended = startups.filter((s) => s.category === "recommended");
  const luck = startups.filter((s) => s.category === "luck");

  await writeTab(sheets, sheetId, "Exact Match", exact, drafts);
  await writeTab(sheets, sheetId, "Recommended", recommended, drafts);
  await writeTab(sheets, sheetId, "Luck", luck, drafts);

  // Remove default Sheet1 if it exists
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });
    const sheet1 = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === "Sheet1"
    );
    if (sheet1?.properties?.sheetId !== undefined) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            { deleteSheet: { sheetId: sheet1.properties.sheetId } },
          ],
        },
      });
    }
  } catch {
    // Sheet1 may not exist or may be the only sheet
  }

  // Share with candidate if email provided
  if (candidateEmail) {
    try {
      const auth = getAuthClient();
      const drive = google.drive({ version: "v3", auth });
      await drive.permissions.create({
        fileId: sheetId,
        requestBody: {
          type: "user",
          role: "reader",
          emailAddress: candidateEmail,
        },
      });
    } catch {
      // Ignore share errors
    }
  }

  return `https://docs.google.com/spreadsheets/d/${sheetId}`;
}
