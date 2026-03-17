const { google } = require('googleapis');

async function checkTrash() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  const trashed = await drive.files.list({
    q: 'trashed = true',
    pageSize: 100,
    fields: 'files(id, name, size, createdTime)',
  });
  console.log(`Trashed files: ${trashed.data.files.length}`);
  for (const file of trashed.data.files) {
    console.log(`  ${file.createdTime}  ${file.name}`);
  }

  const about = await drive.about.get({
    fields: 'storageQuota',
  });
  console.log('\nStorage quota:');
  console.log(JSON.stringify(about.data.storageQuota, null, 2));
}

checkTrash().catch(console.error);
