import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function notifyAdmin({ jobId, candidateData, spreadsheetUrl }) {
  const candidateName = candidateData.name || 'Unknown';
  const candidateEmail = candidateData.email || 'N/A';
  const timestamp = new Date().toISOString();

  const sheetsRow = spreadsheetUrl
    ? `<tr>
          <td style="padding: 8px; font-weight: bold;">Google Sheet</td>
          <td style="padding: 8px;"><a href="${spreadsheetUrl}">${spreadsheetUrl}</a></td>
        </tr>`
    : `<tr>
          <td style="padding: 8px; font-weight: bold;">Google Sheet</td>
          <td style="padding: 8px; color: #e53e3e;">Export failed — CSV download available from the pipeline status page</td>
        </tr>`;

  const subject = spreadsheetUrl
    ? `Pipeline Complete: ${candidateName}`
    : `Pipeline Complete (CSV only): ${candidateName}`;

  const { data } = await resend.emails.send({
    from: 'Nexus Pipeline <onboarding@resend.dev>',
    to: process.env.ADMIN_EMAIL,
    subject,
    html: `
      <h2>Pipeline Complete</h2>
      <table style="border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Candidate</td>
          <td style="padding: 8px;">${candidateName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Email</td>
          <td style="padding: 8px;">${candidateEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Job ID</td>
          <td style="padding: 8px;">${jobId}</td>
        </tr>
        ${sheetsRow}
        <tr>
          <td style="padding: 8px; font-weight: bold;">Completed At</td>
          <td style="padding: 8px;">${timestamp}</td>
        </tr>
      </table>
    `,
  });

  return { emailId: data?.id };
}
