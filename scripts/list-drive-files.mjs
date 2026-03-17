#!/usr/bin/env node

// Read-only diagnostic: list ALL files owned by the service account (and impersonating identity).
// Does NOT delete anything.
// Usage: node scripts/list-drive-files.mjs

import { google } from 'googleapis';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAuth, getDriveAuth } from '../src/lib/pipeline/write-sheets.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

async function listAllFiles(drive, label) {
  console.log(`\n=== ${label} ===`);

  let pageToken;
  const allFiles = [];

  do {
    const response = await drive.files.list({
      q: "'me' in owners",
      fields: 'nextPageToken,files(id,name,size,mimeType,createdTime)',
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
    });
    const files = response.data.files || [];
    allFiles.push(...files);
    pageToken = response.data.nextPageToken;
  } while (pageToken);

  if (allFiles.length === 0) {
    console.log('(no files found)');
    return;
  }

  // Sort by creation date descending (newest first)
  allFiles.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

  // Print table
  const nameWidth = Math.min(50, Math.max(20, ...allFiles.map(f => (f.name || '').length)));
  console.log(
    'Name'.padEnd(nameWidth) + '  ' +
    'Size'.padStart(10) + '  ' +
    'Created'.padEnd(20) + '  ' +
    'MIME Type'.padEnd(40) + '  ' +
    'ID'
  );
  console.log('-'.repeat(nameWidth + 10 + 20 + 40 + 44 + 8));

  let totalSize = 0;
  for (const f of allFiles) {
    const size = parseInt(f.size || '0', 10);
    totalSize += size;
    const name = (f.name || '(unnamed)').substring(0, nameWidth).padEnd(nameWidth);
    const created = (f.createdTime || '').substring(0, 19).padEnd(20);
    const mime = (f.mimeType || '').padEnd(40);
    console.log(`${name}  ${formatSize(size).padStart(10)}  ${created}  ${mime}  ${f.id}`);
  }

  console.log(`\nTotal: ${allFiles.length} file(s), ${formatSize(totalSize)}`);
}

// Service account (non-impersonating)
const driveAuth = getDriveAuth();
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const impersonateEmail = process.env.GOOGLE_IMPERSONATE_EMAIL;

console.log('Drive File Audit (read-only)');
console.log(`Service account: ${email}`);
console.log(`Impersonating:   ${impersonateEmail || '(none)'}`);

const drive = google.drive({ version: 'v3', auth: driveAuth });
await listAllFiles(drive, `Service account (${email})`);

// Impersonating identity
if (impersonateEmail) {
  const impersonatingAuth = getAuth();
  const impersonatingDrive = google.drive({ version: 'v3', auth: impersonatingAuth });
  try {
    await listAllFiles(impersonatingDrive, `Impersonating (${impersonateEmail})`);
  } catch (err) {
    console.error(`\nFailed to list files as ${impersonateEmail}: ${err.message}`);
  }
}
