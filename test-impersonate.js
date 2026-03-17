const { google } = require('googleapis');

async function test() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/drive'],
    subject: process.env.GOOGLE_IMPERSONATE_EMAIL,
  });

  console.log('Impersonating:', process.env.GOOGLE_IMPERSONATE_EMAIL);
  
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    const about = await drive.about.get({ fields: 'user,storageQuota' });
    console.log('Authenticated as:', about.data.user.emailAddress);
    console.log('Storage quota:', JSON.stringify(about.data.storageQuota, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
