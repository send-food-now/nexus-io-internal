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

// Log Drive quota usage for diagnostics
async function logDriveQuota(drive, label) {
  try {
    const res = await drive.about.get({ fields: 'storageQuota' });
    const q = res.data.storageQuota || {};
    const used = Number(q.usage || 0);
    const trash = Number(q.usageInDriveTrash || 0);
    const limit = Number(q.limit || 0);
    console.log(`[writeSheets] Quota (${label}): ${(used / 1024 / 1024).toFixed(1)}MB used, ${(trash / 1024 / 1024).toFixed(1)}MB in trash, ${limit ? (limit / 1024 / 1024).toFixed(0) + 'MB limit' : 'unlimited'}`);
    return { used, trash, limit };
  } catch (err) {
    console.log(`[writeSheets] Quota check (${label}) failed: ${err.message}`);
    return null;
  }
}

// Delete old pipeline spreadsheets to free Drive quota
async function freeDriveQuota(drive, impersonatingDrive) {
  let totalFound = 0;
  let totalDeleted = 0;

  // Clean up with both auth types — old files may be owned by either identity
  for (const [label, d] of [['service-account', drive], ['impersonating', impersonatingDrive]]) {
    if (!d) continue;

    // List ALL spreadsheets (not just name-matched) — per spec Section 7
    let pageToken = undefined;
    const allFiles = [];
    try {
      do {
        const response = await d.files.list({
          q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
          fields: 'files(id,name,size,createdTime),nextPageToken',
          pageSize: 100,
          supportsAllDrives: true,
          ...(pageToken && { pageToken }),
        });
        allFiles.push(...(response.data.files || []));
        pageToken = response.data.nextPageToken;
      } while (pageToken);
    } catch (err) {
      // files.list failure is fatal — if we can't list, we shouldn't create more files
      throw new Error(`[writeSheets] files.list failed for ${label}: ${err.message}`);
    }

    const totalSize = allFiles.reduce((sum, f) => sum + Number(f.size || 0), 0);
    console.log(`[writeSheets] Found ${allFiles.length} spreadsheet(s) via ${label} auth (${(totalSize / 1024 / 1024).toFixed(1)}MB total)`);
    for (const f of allFiles) {
      console.log(`[writeSheets]   - ${f.name} (${f.id}, ${f.size || '?'} bytes, ${f.createdTime})`);
    }
    totalFound += allFiles.length;

    for (const f of allFiles) {
      try {
        await d.files.delete({ fileId: f.id, supportsAllDrives: true });
        console.log(`[writeSheets] Deleted ${f.name} (${f.id})`);
        totalDeleted++;
      } catch (err) {
        console.warn(`[writeSheets] Could not delete ${f.id}: ${err.message}`);
      }
    }

    // Empty trash so deleted files stop counting against quota
    await d.files.emptyTrash().catch((err) =>
      console.warn(`[writeSheets] emptyTrash (${label}) failed: ${err.message}`)
    );
  }

  console.log(`[writeSheets] Cleanup complete: ${totalDeleted}/${totalFound} files deleted`);
  return { totalFound, totalDeleted };
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

  // Log quota before cleanup
  await logDriveQuota(drive, 'before-cleanup');

  // Free up quota by deleting old sheets + emptying trash (both auth types)
  await freeDriveQuota(drive, impersonatingDrive);

  // Wait for Google to propagate quota release
  await new Promise(r => setTimeout(r, 2000));
  await logDriveQuota(drive, 'after-cleanup');

  // Create spreadsheet with retry on quota errors
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const createRequest = {
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      ...(folderId && { parents: [folderId] }),
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  };

  let createResponse;
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[writeSheets] Creating spreadsheet "${title}" (attempt ${attempt}/${maxAttempts})`);
      createResponse = await drive.files.create(createRequest);
      break;
    } catch (err) {
      const isQuotaError = err.message?.toLowerCase().includes('quota') || err.code === 403 || err.code === 429;
      if (isQuotaError && attempt < maxAttempts) {
        const delay = attempt * 5000;
        console.warn(`[writeSheets] Quota error on attempt ${attempt}/${maxAttempts}, retrying in ${delay}ms: ${err.message}`);
        // Re-empty trash before retry
        await drive.files.emptyTrash().catch(() => {});
        await new Promise(r => setTimeout(r, delay));
        await logDriveQuota(drive, `retry-${attempt}`);
        continue;
      }
      throw err;
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
    console.log(`[writeSheets] Sharing spreadsheet with ${candidateData.email} (writer)`);
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

  // Transfer ownership so the file no longer counts against the service account's quota
  const ownerEmail = process.env.GOOGLE_IMPERSONATE_EMAIL || process.env.ADMIN_EMAIL;
  if (ownerEmail) {
    try {
      console.log(`[writeSheets] Transferring ownership to ${ownerEmail}`);
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
      console.warn(`[writeSheets] Ownership transfer failed (non-fatal): ${err.message}`);
    }
  }

  return { spreadsheetId, spreadsheetUrl };
}
