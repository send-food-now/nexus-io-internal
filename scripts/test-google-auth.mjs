#!/usr/bin/env node

// Diagnostic script to verify Google Sheets/Drive service account credentials.
// Usage: node scripts/test-google-auth.mjs

import { google } from 'googleapis';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;

console.log('=== Google Auth Diagnostic ===\n');

if (!email || !privateKey) {
  console.error('✗ Missing env vars:');
  if (!email) console.error('  - GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');
  if (!privateKey) console.error('  - GOOGLE_PRIVATE_KEY is not set');
  console.error('\nSet these in .env.local and retry.');
  process.exit(1);
}

const projectId = email.includes('@')
  ? email.split('@')[1]?.replace('.iam.gserviceaccount.com', '')
  : '(unknown)';

console.log(`Service account: ${email}`);
console.log(`Derived project: ${projectId}`);
console.log(`Private key:     ${privateKey.substring(0, 30)}... (${privateKey.length} chars)\n`);

const auth = new google.auth.JWT({
  email,
  key: privateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

// Step 1: Get access token
console.log('Step 1: Obtaining access token (JWT)...');
try {
  const tokenRes = await auth.authorize();
  if (tokenRes.access_token) {
    console.log(`✓ Access token obtained\n`);
  } else {
    console.error('✗ No token returned. Check credentials.\n');
    process.exit(1);
  }
} catch (err) {
  console.error(`✗ JWT authorize failed: ${err.message}`);
  process.exit(1);
}

const drive = google.drive({ version: 'v3', auth });
const sheets = google.sheets({ version: 'v4', auth });

// Step 2: Check storage quota
console.log('Step 2: Checking Drive storage quota...');
try {
  const about = await drive.about.get({ fields: 'storageQuota' });
  const q = about.data.storageQuota;
  const usedMB = (Number(q.usage) / 1024 / 1024).toFixed(2);
  const limitMB = q.limit ? (Number(q.limit) / 1024 / 1024).toFixed(2) : 'unlimited';
  const trashMB = (Number(q.usageInDriveTrash) / 1024 / 1024).toFixed(2);
  console.log(`  Usage: ${usedMB} MB / ${limitMB} MB`);
  console.log(`  In trash: ${trashMB} MB`);
  if (Number(q.usageInDriveTrash) > 0) {
    console.log(`  ⚠ Trash is using storage — will empty it\n`);
  } else {
    console.log('');
  }
} catch (err) {
  console.error(`  ⚠ Could not check quota: ${err.message}\n`);
}

// Step 3: List and clean up trashed files
console.log('Step 3: Checking for trashed files...');
try {
  const trashed = await drive.files.list({
    q: 'trashed=true',
    fields: 'files(id,name,size)',
    pageSize: 100,
  });
  const trashedFiles = trashed.data.files || [];
  console.log(`  Found ${trashedFiles.length} trashed file(s)`);

  if (trashedFiles.length > 0) {
    for (const f of trashedFiles.slice(0, 5)) {
      console.log(`    - ${f.name} (${f.size ? (Number(f.size) / 1024).toFixed(1) + ' KB' : 'unknown size'})`);
    }
    if (trashedFiles.length > 5) console.log(`    ... and ${trashedFiles.length - 5} more`);

    console.log('  Emptying trash...');
    await drive.files.emptyTrash();
    console.log('  ✓ Trash emptied\n');
  } else {
    console.log('  No trashed files found\n');
  }
} catch (err) {
  console.error(`  ⚠ Could not clean trash: ${err.message}\n`);
}

// Also list non-trashed files and delete old test files
console.log('Step 4: Checking for leftover files...');
try {
  const allFiles = await drive.files.list({
    fields: 'files(id,name,createdTime)',
    pageSize: 100,
  });
  const files = allFiles.data.files || [];
  console.log(`  Found ${files.length} file(s) in Drive`);
  for (const f of files.slice(0, 5)) {
    console.log(`    - ${f.name} (${f.createdTime})`);
  }
  if (files.length > 5) console.log(`    ... and ${files.length - 5} more`);
  console.log('');
} catch (err) {
  console.error(`  ⚠ Could not list files: ${err.message}\n`);
}

// Step 5: Create spreadsheet via Drive API
console.log('Step 5: Creating spreadsheet via Drive API...');
let spreadsheetId;
try {
  const res = await drive.files.create({
    requestBody: {
      name: 'Auth Test — DELETE ME',
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
    fields: 'id,webViewLink',
  });
  spreadsheetId = res.data.id;
  console.log(`✓ Spreadsheet created: ${res.data.webViewLink}\n`);
} catch (err) {
  console.error(`✗ drive.files.create failed: ${err.message}`);
  if (err.response) {
    console.error(`  HTTP status: ${err.response.status}`);
    console.error(`  Response: ${JSON.stringify(err.response.data?.error, null, 2)}`);
  }
  if (err.message?.includes('storageQuota')) {
    console.error('\n  Storage quota still exceeded after emptying trash.');
    console.error('  The service account may have a 0 MB quota or org restriction.');
    console.error('  Consider creating a new service account or requesting quota increase.');
  }
  process.exit(1);
}

// Step 6: Test Sheets batchUpdate (rename tab)
console.log('Step 6: Testing Sheets batchUpdate (rename tab)...');
try {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        { updateSheetProperties: { properties: { sheetId: 0, title: 'Test Tab' }, fields: 'title' } },
      ],
    },
  });
  console.log('✓ Sheets batchUpdate works\n');
} catch (err) {
  console.error(`✗ sheets.spreadsheets.batchUpdate failed: ${err.message}`);
  if (err.response) {
    console.error(`  HTTP status: ${err.response.status}`);
    console.error(`  Response: ${JSON.stringify(err.response.data?.error, null, 2)}`);
  }
  process.exit(1);
}

// Step 7: Test Sheets values.update (write data)
console.log('Step 7: Testing Sheets values.update (write data)...');
try {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "'Test Tab'!A1",
    valueInputOption: 'RAW',
    requestBody: { values: [['Hello', 'World'], ['Test', 'Data']] },
  });
  console.log('✓ Sheets values.update works\n');
} catch (err) {
  console.error(`✗ sheets.spreadsheets.values.update failed: ${err.message}`);
  if (err.response) {
    console.error(`  HTTP status: ${err.response.status}`);
    console.error(`  Response: ${JSON.stringify(err.response.data?.error, null, 2)}`);
  }
  process.exit(1);
}

// Step 8: Clean up
console.log('Step 8: Cleaning up test spreadsheet...');
try {
  await drive.files.delete({ fileId: spreadsheetId });
  console.log('✓ Test spreadsheet deleted\n');
} catch (err) {
  console.error(`⚠ Could not delete test spreadsheet: ${err.message}\n`);
}

console.log('=== All checks passed — Google auth is working correctly ===');
