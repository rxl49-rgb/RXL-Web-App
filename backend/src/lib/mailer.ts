// Real outbound email requires SMTP credentials in the backend .env:
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
// Until those are set, sendMail() logs what WOULD have been sent instead of failing the
// request — so the automation jobs and admin "Send now" actions still work end-to-end
// for testing, they just won't leave this server until real credentials are supplied.
//
// The 'nodemailer' package is loaded lazily via require() + try/catch (rather than a
// static import) so that if it hasn't been installed yet (e.g. `npm install` wasn't run
// after this feature was added), the whole backend still boots — only email sending is
// disabled, instead of the entire API (including login) failing to start.
let nodemailerLib: typeof import('nodemailer') | null | undefined;

function getNodemailer() {
  if (nodemailerLib === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nodemailerLib = require('nodemailer');
    } catch {
      console.warn('[mailer] "nodemailer" is not installed — run `npm install` in backend/. Email sending is disabled until then.');
      nodemailerLib = null;
    }
  }
  return nodemailerLib;
}

let transporter: any = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  const nodemailer = getNodemailer();
  if (!nodemailer) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export interface SendMailResult {
  sent: boolean; // true if actually handed to an SMTP server
  simulated: boolean; // true if just logged because no SMTP is configured
}

// html is optional — plain-text callers (receipts, reminders, welcome email) are
// unaffected; HTML campaigns (Newsletter) pass a rendered HTML body as the 4th arg.
export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<SendMailResult> {
  const t = getTransporter();
  if (!t) {
    console.log(`[mailer] SMTP not configured — simulated send to ${to}: "${subject}"`);
    return { sent: false, simulated: true };
  }
  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
  return { sent: true, simulated: false };
}
