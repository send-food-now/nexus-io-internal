import { google } from 'googleapis';

export const COLUMN_HEADERS = [
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
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL,
  });
}

// Non-impersonating SA auth — only used for cleanup of old SA-owned files
function getDriveAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

// Delete old pipeline spreadsheets to free Drive quota
async function freeDriveQuota(drive, impersonatingDrive) {
  // Clean up with both auth types — old files may be owned by either identity
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

export function startupToRow(startup, category) {
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
  const driveAuth = getDriveAuth();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });                   // impersonating — has Drive quota
  const saDrive = google.drive({ version: 'v3', auth: driveAuth });      // SA direct — cleanup only

  console.log(`[writeSheets] GOOGLE_IMPERSONATE_EMAIL is ${process.env.GOOGLE_IMPERSONATE_EMAIL ? 'SET' : 'NOT SET'}`);
  console.log(`[writeSheets] GOOGLE_DRIVE_FOLDER_ID is ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'SET' : 'NOT SET'}`);

  const candidateName = candidateData.name || 'Unknown';
  const date = new Date().toISOString().split('T')[0];
  const title = `H-1B1 Pipeline — ${candidateName} — ${date}`;

  // Free up quota by deleting old sheets + emptying trash (both auth types)
  await freeDriveQuota(drive, saDrive);

  // Create spreadsheet (optionally in a specific folder for organization)
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

  // Add the 3 tabs (rename default Sheet1 + add 2 more)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: 0, title: 'Exact Match' }, fields: 'title' } },
        { addSheet: { properties: { sheetId: 1, title: 'Recommended' } } },
        { addSheet: { properties: { sheetId: 2, title: 'Luck' } } },
      ],
    },
  });

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
      supportsAllDrives: true,
    });
  }

  // Transfer ownership to admin — file no longer counts against SA quota
  const ownerEmail = process.env.ADMIN_EMAIL || process.env.GOOGLE_IMPERSONATE_EMAIL;
  if (ownerEmail) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        requestBody: {
          type: 'user',
          role: 'owner',
          emailAddress: ownerEmail,
        },
        transferOwnership: true,
        supportsAllDrives: true,
      });
      console.log(`[writeSheets] Transferred ownership to ${ownerEmail}`);
    } catch (err) {
      console.log(`[writeSheets] Ownership transfer failed (${err.message}) — file still accessible via sharing`);
    }
  }

  return { spreadsheetId, spreadsheetUrl };
}
