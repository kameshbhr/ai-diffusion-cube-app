import nodemailer from 'nodemailer';

// Lazily created and reused across calls within the same server instance —
// nodemailer's transport keeps a small connection pool, no benefit to
// recreating it per send.
let transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SES_SMTP_HOST,
      port: Number(process.env.SES_SMTP_PORT ?? 587),
      secure: false, // STARTTLS on port 587 — set true only if using port 465
      auth: {
        user: process.env.SES_SMTP_USERNAME,
        pass: process.env.SES_SMTP_PASSWORD,
      },
    });
  }
  return transport;
}

async function sendEmail({ to, subject, html }: { to: string | string[]; subject: string; html: string }) {
  await getTransport().sendMail({ from: process.env.EMAIL_FROM_ADDRESS, to, subject, html });
}

// Sent to every address in ADMIN_EMAILS (comma-separated) the moment someone
// submits the "request access" form — one send with all admins in the "to"
// list, so each sees who else is on the approval team.
export async function sendAdminApprovalEmail(opts: { name: string; email: string; organization: string; approveUrl: string }) {
  const adminAddresses = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (adminAddresses.length === 0) throw new Error('ADMIN_EMAILS is not configured');

  await sendEmail({
    to: adminAddresses,
    subject: `New access request: ${opts.name}`,
    html: `
      <p>A new access request has come in for the AI Diffusion Studio.</p>
      <p>
        <strong>Name:</strong> ${escapeHtml(opts.name)}<br>
        <strong>Email:</strong> ${escapeHtml(opts.email)}<br>
        <strong>Organization:</strong> ${escapeHtml(opts.organization)}
      </p>
      <p><a href="${opts.approveUrl}">Review this request</a></p>
    `,
  });
}

// Sent once an admin approves a request — the link takes them straight to
// setting a password for the first time (see app/set-password/page.tsx).
export async function sendUserApprovedEmail(opts: { email: string; signInUrl: string }) {
  await sendEmail({
    to: opts.email,
    subject: 'Your access has been approved',
    html: `
      <p>Your registration has been approved! You can now click here to sign in.</p>
      <p><a href="${opts.signInUrl}">Set your password and sign in</a></p>
    `,
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
