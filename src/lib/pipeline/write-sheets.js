import { google } from 'googleapis';

const COLUMN_HEADERS = [
  'Company',
  'Domain',
  'Industry',
  'Description',
  'Funding Stage',
  'Location',
  'Team Size',
  'Contact 1 Name',
  'Contact 1 Title',
  'Contact 1 Email',
  'Contact 2 Name',
  'Contact 2 Title',
  'Contact 2 Email',
  'Fit Score (/10)',
  'Narrative Fit',
  'Email Subject 1',
  'Email Subject 2',
  'Email Subject 3',
  'Recent News',
  'Career Page',
  'H-1B1 History',
  'Source',
  'Created At',
];

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL,
  });
}

function getDriveAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

async function freeDriveQuota(drive, impersonatingDrive) {
  for (const d of [drive, impersonatingDrive].filter(Boolean)) {
    try {
      const response = await d.files.list({
        q: "name contains 'H-1B1 Pipeline' and mimeType = 'application/vnd.google-apps.spreadsheet'",
        fields: 'files(id,name)',
        pageSize: 100,
        supportsAllDrives: true,
      });
      const files = response.data.files || [];
      console.log(`[writeSheets] Found ${files.length} old pipeline files to clean up`);
      for (const f of files) {
        try {
          await d.files.delete({ fileId: f.id, supportsAllDrives: true });
          console.log(`[writeSheets] Deleted ${f.name} (${f.id})`);
        } catch (err) {
          console.log(`[writeSheets] Could not delete ${f.id}: ${err.message}`);
        }
      }
      await d.files.emptyTrash().catch((err) =>
        console.log(`[writeSheets] emptyTrash failed: ${err.message}`)
      );
    } catch (err) {
      console.log(`[writeSheets] files.list failed: ${err.message}`);
    }
  }
}

function startupToRow(startup) {
  const contact1 = startup.contacts?.[0] || {};
  const contact2 = startup.contacts?.[1] || {};
  const subjects = startup.emailSubjectLines || [];

  return [
    startup.name || '',
    startup.domain || '',
    startup.industry || '',
    startup.description || '',
    startup.fundingStage || '',
    startup.location || '',
    startup.teamSize || '',
    contact1.name || '',
    contact1.title || '',
    contact1.email || '',
    contact2.name || '',
    contact2.title || '',
    contact2.email || '',
    startup.fitScore ?? '',
    startup.narrativeFit || '',
    subjects[0] || '',
    subjects[1] || '',
    subjects[2] || '',
    Array.isArray(startup.recentNews) ? startup.recentNews.map(n => n.title).join('; ') : startup.recentNews || '',
    startup.careerPageUrl || '',
    startup.h1b1Approvals ? `${startup.h1b1Approvals} approvals` : '',
    Array.isArray(startup.source) ? startup.source.join(', ') : startup.source || '',
    new Date().toISOString(),
  ];
}

export async function writeSheets({ startups, candidateData }) {
  const auth = getAuth();
  const driveAuth = getDriveAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth: driveAuth });
  const impersonatingDrive = process.env.GOOGLE_IMPERSONATE_EMAIL
    ? google.drive({ version: 'v3', auth })
    : null;

  console.log(`[writeSheets] GOOGLE_IMPERSONATE_EMAIL is ${process.env.GOOGLE_IMPERSONATE_EMAIL ? 'SET' : 'NOT SET'}`);
  console.log(`[writeSheets] GOOGLE_DRIVE_FOLDER_ID is ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'SET' : 'NOT SET'}`);

  const candidateName = candidateData.name || 'Unknown';
  const date = new Date().toISOString().split('T')[0];
  const title = `H-1B1 Pipeline — ${candidateName} — ${date}`;

  await freeDriveQuota(drive, impersonatingDrive);

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const createResponse = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      ...(folderId && { parents: [folderId] }),
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });

  const spreadsheetId = createResponse.data.id;
  const spreadsheetUrl = createResponse.data.webViewLink;

  // Sort startups by fit score descending
  const sorted = [...startups].sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
  const rows = [COLUMN_HEADERS, ...sorted.map(s => startupToRow(s))];

  // Rename default sheet
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: 0, title: 'Target List' }, fields: 'title' } },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Target List'!A1",
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // Format header row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMN_HEADERS.length },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.231, green: 0.51, blue: 0.965 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: COLUMN_HEADERS.length },
          },
        },
      ],
    },
  });

  if (candidateData.email) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type: 'user', role: 'writer', emailAddress: candidateData.email },
      supportsAllDrives: true,
    });
  }

  return { spreadsheetId, spreadsheetUrl };
}
