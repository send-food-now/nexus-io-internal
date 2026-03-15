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

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: email,
    private_key: privateKey.replace(/\\n/g, '\n'),
  },
  projectId: projectId !== '(unknown)' ? projectId : undefined,
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

// Step 1: Get access token
console.log('Step 1: Obtaining access token...');
try {
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  if (tokenRes.token) {
    console.log('✓ Access token obtained successfully\n');
  } else {
    console.error('✗ No token returned (but no error thrown). Check credentials.\n');
    process.exit(1);
  }
} catch (err) {
  console.error(`✗ Failed to get access token: ${err.message}`);
  console.error('\nTroubleshooting:');
  console.error('  1. Verify GOOGLE_PRIVATE_KEY is the full key from the JSON file');
  console.error('  2. Verify GOOGLE_SERVICE_ACCOUNT_EMAIL matches the key');
  console.error('  3. Check that the service account is not disabled in GCP IAM');
  process.exit(1);
}

// Step 2: Create a test spreadsheet
console.log('Step 2: Creating test spreadsheet (Sheets API)...');
const sheets = google.sheets({ version: 'v4', auth });
const drive = google.drive({ version: 'v3', auth });

let spreadsheetId;
try {
  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: 'Auth Test — DELETE ME' },
    },
  });
  spreadsheetId = res.data.spreadsheetId;
  console.log(`✓ Spreadsheet created: ${res.data.spreadsheetUrl}\n`);
} catch (err) {
  console.error(`✗ sheets.spreadsheets.create failed: ${err.message}`);
  if (err.response) {
    console.error(`  HTTP status: ${err.response.status}`);
    console.error(`  Response: ${JSON.stringify(err.response.data?.error, null, 2)}`);
  }
  console.error('\nTroubleshooting:');
  console.error(`  1. Go to https://console.cloud.google.com/apis/library?project=${projectId}`);
  console.error('  2. Ensure "Google Sheets API" is ENABLED in this specific project');
  console.error('  3. Ensure "Google Drive API" is ENABLED in this specific project');
  console.error('  4. If APIs are enabled in a DIFFERENT project, that won\'t work —');
  console.error('     they must be in the same project as the service account.');
  process.exit(1);
}

// Step 3: Clean up — delete the test spreadsheet
console.log('Step 3: Cleaning up test spreadsheet (Drive API)...');
try {
  await drive.files.delete({ fileId: spreadsheetId });
  console.log('✓ Test spreadsheet deleted\n');
} catch (err) {
  console.error(`⚠ Could not delete test spreadsheet: ${err.message}`);
  console.error('  (Not critical — you can delete it manually from Drive)\n');
}

console.log('=== All checks passed — Google auth is working correctly ===');
