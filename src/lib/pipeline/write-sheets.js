import { google } from 'googleapis';

const COLUMNS = [
  'Company Name', 'Domain', 'Industry', 'Location', 'Funding Stage', 'Team Size',
  'Tech Fit', 'Param Match', 'Visa Score', 'Trending', 'Composite Score',
  'Contact 1 Name', 'Contact 1 Title', 'Contact 1 Email',
  'Contact 2 Name', 'Contact 2 Title', 'Contact 2 Email',
  'Recent News', 'Careers URL', 'Immigrant Workforce %',
  'Hook', 'Fit Rationale', 'Short Email', 'Long Email',
];

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

function startupToRow(s) {
  const c1 = s.contacts?.[0] || {};
  const c2 = s.contacts?.[1] || {};
  return [
    s.name || '', s.domain || '', s.industry || '', s.location || '',
    s.fundingStage || '', s.teamSize || '',
    s.scores?.technicalFit || '', s.scores?.parameterMatch || '',
    s.scores?.visaFriendliness || '', s.scores?.trendingSignal || '',
    s.compositeScore || '',
    c1.name || '', c1.title || '', c1.email || '',
    c2.name || '', c2.title || '', c2.email || '',
    s.recentNews?.headline || '', s.careersUrl || '', s.immigrantPct || '',
    s.outreach?.hook || '', s.outreach?.fitRationale || '',
    s.outreach?.shortEmail || '', s.outreach?.longEmail || '',
  ];
}

export async function writeSheets(categorized, candidateName, candidateEmail) {
  const auth = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const dateStr = new Date().toISOString().split('T')[0];
  const title = `H-1B1 Pipeline — ${candidateName} — ${dateStr}`;

  // Create spreadsheet with 3 tabs
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: 'Exact Match' } },
        { properties: { title: 'Recommended' } },
        { properties: { title: 'Worth a Shot' } },
      ],
    },
  });

  const spreadsheetId = spreadsheet.data.spreadsheetId;

  // Write data to each tab
  const tabData = [
    { tab: 'Exact Match', startups: categorized.exact },
    { tab: 'Recommended', startups: categorized.recommended },
    { tab: 'Worth a Shot', startups: categorized.luck },
  ];

  const batchData = [];
  const formatRequests = [];

  for (const { tab, startups } of tabData) {
    const rows = [COLUMNS, ...startups.map(startupToRow)];
    batchData.push({
      range: `'${tab}'!A1`,
      values: rows,
    });

    // Find sheet ID for formatting
    const sheetMeta = spreadsheet.data.sheets.find((s) => s.properties.title === tab);
    const sheetId = sheetMeta?.properties?.sheetId;

    if (sheetId !== undefined) {
      // Bold header row
      formatRequests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true } } },
          fields: 'userEnteredFormat.textFormat.bold',
        },
      });
      // Freeze header row
      formatRequests.push({
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount',
        },
      });
      // Auto-resize columns
      formatRequests.push({
        autoResizeDimensions: {
          dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: COLUMNS.length },
        },
      });
    }
  }

  // Batch write all data
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: batchData,
    },
  });

  // Apply formatting
  if (formatRequests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: formatRequests },
    });
  }

  // Share with candidate (viewer) and admin (editor)
  const sharePromises = [];
  if (candidateEmail) {
    sharePromises.push(
      drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { type: 'user', role: 'reader', emailAddress: candidateEmail },
        sendNotificationEmail: false,
      })
    );
  }
  if (process.env.ADMIN_EMAIL) {
    sharePromises.push(
      drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: { type: 'user', role: 'writer', emailAddress: process.env.ADMIN_EMAIL },
        sendNotificationEmail: false,
      })
    );
  }
  await Promise.allSettled(sharePromises);

  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  return { spreadsheetId, spreadsheetUrl };
}
