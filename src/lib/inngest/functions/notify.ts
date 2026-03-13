import { Resend } from "resend";

function getResendClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function notifyAdmin(
  adminEmail: string,
  sheetUrl: string,
  stats: { exact: number; recommended: number; luck: number; duration: string }
): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: "Nexus Pipeline <onboarding@resend.dev>",
    to: adminEmail,
    subject: "Pipeline Complete — Startup Matches Ready",
    html: `
      <h2>Pipeline Complete</h2>
      <p>The H-1B1 candidate pipeline has finished processing.</p>
      <ul>
        <li><strong>Exact Matches:</strong> ${stats.exact}</li>
        <li><strong>Recommended:</strong> ${stats.recommended}</li>
        <li><strong>Luck:</strong> ${stats.luck}</li>
      </ul>
      <p><strong>Duration:</strong> ${stats.duration}</p>
      <p><a href="${sheetUrl}">View Results in Google Sheets</a></p>
    `,
  });
}
