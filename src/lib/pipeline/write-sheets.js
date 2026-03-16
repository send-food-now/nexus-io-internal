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

export function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL,
  });
}

// Non-impersonating auth for Drive file creation — avoids impersonated user's quota limit
export function getDriveAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

// Delete old pipeline spreadsheets to free Drive quota
async function freeDriveQuota(drive, impersonatingDrive) {
  const clients = [drive, impersonatingDrive].filter(Boolean);
  console.log(`[freeDriveQuota] Starting cleanup with ${clients.length} Drive client(s)`);

  for (let i = 0; i < clients.length; i++) {
    const d = clients[i];
    const label = i === 0 ? 'service-account' : 'impersonating';
    console.log(`[freeDriveQuota] Listing old pipeline files via ${label} client`);

    const response = await d.files.list({
      q: "name contains 'H-1B1 Pipeline' and mimeType = 'application/vnd.google-apps.spreadsheet'",
      fields: 'files(id,name,createdTime)',
      pageSize: 100,
      supportsAllDrives: true,
    });
    const files = response.data.files || [];
    console.log(`[freeDriveQuota] Found ${files.length} old pipeline files via ${label} client`);

    let deleted = 0;
    let failed = 0;
    for (const f of files) {
      try {
        await d.files.delete({ fileId: f.id, supportsAllDrives: true });
        deleted++;
        console.log(`[freeDriveQuota] Deleted ${f.name} (${f.id}, created ${f.createdTime})`);
      } catch (err) {
        failed++;
        console.error(`[freeDriveQuota] Failed to delete ${f.name} (${f.id}): ${err.message}`);
      }
    }
    console.log(`[freeDriveQuota] ${label} client: ${deleted} deleted, ${failed} failed out of ${files.length} files`);

    try {
      await d.files.emptyTrash();
      console.log(`[freeDriveQuota] ${label} client: trash emptied`);
    } catch (err) {
      console.error(`[freeDriveQuota] ${label} client: emptyTrash failed: ${err.message}`);
    }
  }

  console.log(`[freeDriveQuota] Cleanup complete`);
}

// List ALL files owned by the service account and log total count + size
async function auditDriveUsage(drive) {
  let totalFiles = 0;
  let totalSize = 0;
  let pageToken;

  console.log(`[auditDrive] Listing all files owned by service account...`);
  do {
    const response = await drive.files.list({
      q: "'me' in owners",
      fields: 'nextPageToken,files(id,name,size,mimeType)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
    });
    const files = response.data.files || [];
    for (const f of files) {
      totalFiles++;
      totalSize += parseInt(f.size || '0', 10);
    }
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
  console.log(`[auditDrive] Service account owns ${totalFiles} file(s) totalling ${sizeMB} MB`);
  return { totalFiles, totalSize };
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
  // If cleanup fails, stop execution — creating more files will only worsen quota issues
  try {
    await freeDriveQuota(drive, impersonatingDrive);
  } catch (err) {
    console.error(`[writeSheets] freeDriveQuota failed, aborting to avoid worsening quota: ${err.message}`);
    throw new Error(`Drive cleanup failed, cannot create new spreadsheet: ${err.message}`);
  }

  // Audit total Drive usage before creating a new file
  try {
    await auditDriveUsage(drive);
  } catch (err) {
    console.error(`[writeSheets] Drive audit failed (non-fatal): ${err.message}`);
  }

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

  return { spreadsheetId, spreadsheetUrl };
}
