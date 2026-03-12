import { Resend } from 'resend';

export async function notifyAdmin(candidateName, spreadsheetUrl, stats) {
  const apiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!apiKey || !adminEmail) {
    console.warn('[notify] RESEND_API_KEY or ADMIN_EMAIL not set — skipping notification');
    return { emailSent: false };
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: 'Nexus Pipeline <notifications@resend.dev>',
    to: adminEmail,
    subject: `H-1B1 Pipeline Complete — ${candidateName}`,
    html: `
      <h2>Pipeline Complete</h2>
      <p>The H-1B1 candidate pipeline for <strong>${candidateName}</strong> has finished processing.</p>
      <h3>Results</h3>
      <ul>
        <li><strong>Exact Match:</strong> ${stats.exact} startups</li>
        <li><strong>Recommended:</strong> ${stats.recommended} startups</li>
        <li><strong>Worth a Shot:</strong> ${stats.luck} startups</li>
        <li><strong>Total:</strong> ${stats.exact + stats.recommended + stats.luck} startups</li>
      </ul>
      <p><a href="${spreadsheetUrl}">View Google Sheet</a></p>
    `,
  });

  return { emailSent: true };
}
