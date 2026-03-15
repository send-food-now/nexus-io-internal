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

// Use explicit JWT auth
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
    console.log(`✓ Access token obtained`);
    console.log(`  Token type: ${tokenRes.token_type}\n`);
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

// Step 2: Test Drive API (list files)
console.log('Step 2: Testing Drive API (files.list)...');
try {
  const res = await drive.files.list({ pageSize: 1 });
  console.log(`✓ Drive API works (${res.data.files?.length ?? 0} files found)\n`);
} catch (err) {
  console.error(`✗ drive.files.list failed: ${err.message}`);
  process.exit(1);
}

// Step 3: Create spreadsheet via Drive API
console.log('Step 3: Creating spreadsheet via Drive API...');
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
