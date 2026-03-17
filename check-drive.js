const { google } = require('googleapis');

async function listFiles() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });
  
  let allFiles = [];
  let pageToken = null;

  do {
    const res = await drive.files.list({
      pageSize: 100,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime)',
      pageToken: pageToken,
    });
    allFiles = allFiles.concat(res.data.files);
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Total files owned by service account: ${allFiles.length}\n`);
  
  for (const file of allFiles) {
    const sizeMB = file.size ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : 'unknown size';
    console.log(`${file.createdTime}  ${sizeMB}  ${file.name}`);
  }
}

listFiles().catch(console.error);
