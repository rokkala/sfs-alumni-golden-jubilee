import { appOrigin } from '@/lib/auth/app-origin';

export async function sendPasswordResetEmail(to: string, plainToken: string): Promise<void> {
  const link = `${appOrigin()}/reset-password/${encodeURIComponent(plainToken)}`;
  const from = process.env.EMAIL_FROM?.trim() || 'SFS Alumni <admin@alumnicorner.org>';
  const apiKey = process.env.RESEND_API_KEY?.trim();

  const subject = 'Reset your SFS Alumni password';
  const html = `
    <p>Hello,</p>
    <p>We received a request to reset the password for your SFS Alumni account.</p>
    <p><a href="${link}">Choose a new password</a></p>
    <p>This link expires in one hour. If you did not ask for a reset, you can ignore this email.</p>
    <p>— SFS Alumni Committee</p>
  `;

  if (!apiKey) {
    // ponytail: no mailer in local/dev — log the link; upgrade: set RESEND_API_KEY
    console.info('[password-reset] RESEND_API_KEY unset; reset link:', link);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('resend password reset', res.status, detail);
    throw new Error('Could not send reset email');
  }
}
