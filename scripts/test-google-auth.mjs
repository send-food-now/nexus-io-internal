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
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

console.log('=== Google Auth Diagnostic ===\n');

if (!email || !privateKey) {
  console.error('✗ Missing env vars:');
  if (!email) console.error('  - GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');
  if (!privateKey) console.error('  - GOOGLE_PRIVATE_KEY is not set');
  console.error('\nSet these in .env.local and retry.');
  process.exit(1);
}

if (!folderId) {
  console.error('✗ GOOGLE_DRIVE_FOLDER_ID is not set');
  console.error('\nSetup:');
  console.error('  1. Create a folder in Google Drive');
  console.error(`  2. Share it with ${email} as Editor`);
  console.error('  3. Copy the folder ID from the URL (after /folders/)');
  console.error('  4. Add GOOGLE_DRIVE_FOLDER_ID=<id> to .env.local');
  process.exit(1);
}

console.log(`Service account: ${email}`);
console.log(`Impersonating:   ${impersonateEmail || '(none — using service account directly)'}`);
console.log(`Folder ID:       ${folderId}`);
console.log(`Private key:     ${privateKey.substring(0, 30)}... (${privateKey.length} chars)\n`);

const auth = new google.auth.JWT({
  email,
  key: privateKey.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  subject: impersonateEmail,
});

// Step 1: Get access token
console.log('Step 1: Obtaining access token (JWT)...');
try {
  const tokenRes = await auth.authorize();
  if (tokenRes.access_token) {
    console.log('✓ Access token obtained\n');
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

// Step 2: Verify folder access
console.log('Step 2: Verifying folder access...');
try {
  const folder = await drive.files.get({ fileId: folderId, fields: 'id,name,mimeType' });
  console.log(`✓ Folder accessible: "${folder.data.name}"\n`);
} catch (err) {
  console.error(`✗ Cannot access folder: ${err.message}`);
  if (err.response?.status === 404) {
    console.error(`\n  Folder not found. Check the ID and ensure it's shared with ${email} as Editor.`);
  }
  process.exit(1);
}

// Step 3: Create spreadsheet in the shared folder
console.log('Step 3: Creating spreadsheet in shared folder...');
let spreadsheetId;
try {
  const res = await drive.files.create({
    requestBody: {
      name: 'Auth Test — DELETE ME',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
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
  process.exit(1);
}

// Step 4: Test Sheets batchUpdate (rename tab)
console.log('Step 4: Testing Sheets batchUpdate (rename tab)...');
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

// Step 5: Test Sheets values.update (write data)
console.log('Step 5: Testing Sheets values.update (write data)...');
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

// Step 6: Clean up
console.log('Step 6: Cleaning up test spreadsheet...');
try {
  await drive.files.delete({ fileId: spreadsheetId });
  console.log('✓ Test spreadsheet deleted\n');
} catch (err) {
  console.error(`⚠ Could not delete test spreadsheet: ${err.message}\n`);
}

console.log('=== All checks passed — Google auth is working correctly ===');
