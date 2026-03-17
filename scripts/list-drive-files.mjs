import { google } from 'googleapis';
import { config } from 'dotenv';

config({ path: '.env.local' });

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });

let allFiles = [];
let pageToken = null;

do {
  const res = await drive.files.list({
    q: "trashed = false",
    fields: "nextPageToken, files(id, name, size, createdTime, mimeType)",
    orderBy: "createdTime desc",
    pageSize: 100,
    pageToken,
  });
  allFiles = allFiles.concat(res.data.files || []);
  pageToken = res.data.nextPageToken;
} while (pageToken);

console.log(`\nTotal files: ${allFiles.length}`);
let totalSize = 0;
for (const f of allFiles) {
  const size = parseInt(f.size || '0');
  totalSize += size;
  console.log(`${f.name} | ${(size / 1024).toFixed(1)} KB | ${f.createdTime} | ${f.mimeType}`);
}
console.log(`\nTotal size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
