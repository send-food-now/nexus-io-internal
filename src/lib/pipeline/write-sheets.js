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
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL,
  });
}

// Non-impersonating auth for Drive file creation — avoids impersonated user's quota limit
function getDriveAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

// Delete old spreadsheets to free Drive quota
async function freeDriveQuota(drive, impersonatingDrive) {
  // Clean up with both auth types — old files may be owned by either identity
  for (const d of [drive, impersonatingDrive].filter(Boolean)) {
    try {
      // Empty trash FIRST — trashed files still count against quota
      await d.files.emptyTrash().catch((err) =>
        console.log(`[writeSheets] emptyTrash failed: ${err.message}`)
      );

      // Paginate through ALL spreadsheets (not just 'H-1B1 Pipeline' named ones)
      let pageToken = undefined;
      let totalDeleted = 0;
      do {
        const response = await d.files.list({
          q: "mimeType = 'application/vnd.google-apps.spreadsheet'",
          fields: 'files(id,name),nextPageToken',
          pageSize: 100,
          pageToken,
          supportsAllDrives: true,
        });
        const files = response.data.files || [];
        pageToken = response.data.nextPageToken;
        for (const f of files) {
          try {
            await d.files.delete({ fileId: f.id, supportsAllDrives: true });
            totalDeleted++;
            console.log(`[writeSheets] Deleted ${f.name} (${f.id})`);
          } catch (err) {
            console.log(`[writeSheets] Could not delete ${f.id}: ${err.message}`);
          }
        }
      } while (pageToken);

      console.log(`[writeSheets] Cleanup complete: deleted ${totalDeleted} spreadsheets`);

      // Empty trash again after deleting files
      await d.files.emptyTrash().catch((err) =>
        console.log(`[writeSheets] emptyTrash (post-delete) failed: ${err.message}`)
      );
    } catch (err) {
      console.log(`[writeSheets] files.list failed: ${err.message}`);
    }
  }
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
    valueInputOption: 'USER_ENTERED',
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
                backgroundColor: { red: 0.267, green: 0.447, blue: 0.769 },
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
  const drive = google.drive({ version: 'v3', auth: driveAuth });
  // Impersonating Drive client — old files may have been created under this identity
  const impersonatingDrive = process.env.GOOGLE_IMPERSONATE_EMAIL
    ? google.drive({ version: 'v3', auth })
    : null;

  console.log(`[writeSheets] GOOGLE_IMPERSONATE_EMAIL is ${process.env.GOOGLE_IMPERSONATE_EMAIL ? 'SET' : 'NOT SET'}`);
  console.log(`[writeSheets] GOOGLE_DRIVE_FOLDER_ID is ${process.env.GOOGLE_DRIVE_FOLDER_ID ? 'SET' : 'NOT SET'}`);

  const candidateName = candidateData.name || 'Unknown';
  const date = new Date().toISOString().split('T')[0];
  const title = `H-1B1 Pipeline — ${candidateName} — ${date}`;

  // Free up quota by deleting old sheets + emptying trash (both auth types)
  await freeDriveQuota(drive, impersonatingDrive);

  // Wait for Google to propagate quota changes
  await new Promise(r => setTimeout(r, 5000));

  // Create spreadsheet with retry (quota propagation can be slow)
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  let createResponse;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      createResponse = await drive.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          ...(folderId && { parents: [folderId] }),
        },
        fields: 'id,webViewLink',
        supportsAllDrives: true,
      });
      break;
    } catch (err) {
      console.log(`[writeSheets] files.create attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < 2) {
        const delay = (attempt + 1) * 10000; // 10s, 20s
        console.log(`[writeSheets] Retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }

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

  return { spreadsheetId, spreadsheetUrl };
}
