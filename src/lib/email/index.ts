import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? 're_placeholder');
}

const FROM = process.env.EMAIL_FROM || 'CRO Lab <noreply@crolab.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/api/auth/verify-email?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Verify your CRO Lab email',
    html: emailLayout(`
      <h2 style="margin:0 0 16px">Welcome to CRO Lab${name ? `, ${name}` : ''}!</h2>
      <p style="margin:0 0 24px;color:#6b7280">Click the button below to verify your email address and activate your account.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Verify email</a>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">Link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    `),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: 'Reset your CRO Lab password',
    html: emailLayout(`
      <h2 style="margin:0 0 16px">Reset your password</h2>
      <p style="margin:0 0 24px;color:#6b7280">We received a request to reset the password for your account. Click below to choose a new password.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Reset password</a>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">Link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    `),
  });
}

export async function sendInviteEmail(to: string, inviterName: string, orgName: string, token: string) {
  const link = `${APP_URL}/invite?token=${token}`;
  await getResend().emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to ${orgName} on CRO Lab`,
    html: emailLayout(`
      <h2 style="margin:0 0 16px">You're invited!</h2>
      <p style="margin:0 0 8px;color:#6b7280"><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on CRO Lab.</p>
      <p style="margin:0 0 24px;color:#6b7280">CRO Lab is an AI-powered conversion rate optimization platform.</p>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Accept invitation</a>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px">Invitation expires in 7 days.</p>
    `),
  });
}

function emailLayout(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:40px">
        <tr><td>
          <div style="margin-bottom:32px">
            <div style="width:40px;height:40px;background:#2563eb;border-radius:10px;display:inline-flex;align-items:center;justify-content:center">
              <span style="color:#fff;font-size:18px">⚗</span>
            </div>
            <span style="margin-left:10px;font-size:18px;font-weight:700;color:#111827;vertical-align:middle">CRO Lab</span>
          </div>
          ${body}
          <hr style="border:none;border-top:1px solid #f3f4f6;margin:32px 0">
          <p style="margin:0;color:#9ca3af;font-size:12px">CRO Lab · AI-powered conversion rate optimization</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
