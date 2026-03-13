import { google } from 'googleapis';

const COLUMN_HEADERS = [
  'Company',
  'Domain',
  'Industry',
  'Description',
  'Funding Stage',
  'Funding Amount',
  'Team Size',
  'Location',
  'Founded',
  'Tech Stack',
  'Technical Fit Score',
  'Parameter Match Score',
  'Visa Score',
  'Trending Score',
  'Overall Score',
  'Contact 1 Name',
  'Contact 1 Title',
  'Contact 1 Email',
  'Contact 1 LinkedIn',
  'Contact 2 Name',
  'Contact 2 Title',
  'Contact 2 Email',
  'Contact 2 LinkedIn',
  'Recent News',
  'Career Page',
  'Immigrant Workforce %',
  'Personalized Hook',
  'Fit Rationale',
  'Email (Short)',
  'Email (Long)',
  'H-1B1 History',
  'Category',
  'Created At',
];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

function startupToRow(startup, category) {
  const contact1 = startup.contacts?.[0] || {};
  const contact2 = startup.contacts?.[1] || {};

  return [
    startup.name || '',
    startup.domain || '',
    startup.industry || '',
    startup.description || '',
    startup.fundingStage || '',
    startup.fundingAmount || '',
    startup.teamSize || '',
    startup.location || '',
    startup.founded || '',
    Array.isArray(startup.techStack) ? startup.techStack.join(', ') : startup.techStack || '',
    startup.scores?.technicalFit ?? '',
    startup.scores?.parameterMatch ?? '',
    startup.scores?.visaFriendliness ?? '',
    startup.scores?.trendingSignal ?? '',
    startup.scores?.overall ?? '',
    contact1.name || '',
    contact1.title || '',
    contact1.email || '',
    contact1.linkedin || '',
    contact2.name || '',
    contact2.title || '',
    contact2.email || '',
    contact2.linkedin || '',
    Array.isArray(startup.recentNews) ? startup.recentNews.map(n => n.title).join('; ') : startup.recentNews || '',
    startup.careerPageUrl || '',
    '',
    startup.personalizedHook || '',
    startup.fitRationale || '',
    startup.emailShort || '',
    startup.emailLong || '',
    startup.h1b1History || '',
    category,
    new Date().toISOString(),
  ];
}

async function populateSheet(sheets, spreadsheetId, sheetId, sheetTitle, startups, category) {
  const rows = [COLUMN_HEADERS, ...startups.map(s => startupToRow(s, category))];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: COLUMN_HEADERS.length,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.231, green: 0.51, blue: 0.965 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: COLUMN_HEADERS.length,
            },
          },
        },
      ],
    },
  });
}

export async function writeSheets({ categorizedStartups, candidateData }) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const candidateName = candidateData.name || 'Unknown';
  const date = new Date().toISOString().split('T')[0];
  const title = `H-1B1 Pipeline — ${candidateName} — ${date}`;

  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { sheetId: 0, title: 'Exact Match' } },
        { properties: { sheetId: 1, title: 'Recommended' } },
        { properties: { sheetId: 2, title: 'Luck' } },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId;
  const spreadsheetUrl = createResponse.data.spreadsheetUrl;

  await Promise.all([
    populateSheet(sheets, spreadsheetId, 0, 'Exact Match', categorizedStartups.exact || [], 'Exact Match'),
    populateSheet(sheets, spreadsheetId, 1, 'Recommended', categorizedStartups.recommended || [], 'Recommended'),
    populateSheet(sheets, spreadsheetId, 2, 'Luck', categorizedStartups.luck || [], 'Luck'),
  ]);

  if (candidateData.email) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: candidateData.email,
      },
    });
  }

  return { spreadsheetId, spreadsheetUrl };
}
