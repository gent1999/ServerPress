import { Resend } from 'resend';

// Lazy init so a missing key doesn't crash the server at boot.
let _resend = null;
const getResend = () => {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
};

const fromAddress = () => process.env.CONTACT_FROM_EMAIL || process.env.OWNER_EMAIL || 'contact@pluggpress.com';

/**
 * Notify the PluggPress owner inbox that someone submitted the contact form.
 * Never throws -- a failed notification shouldn't fail the contact form submission.
 */
export async function sendContactNotification({ name, email, service, message }) {
  if (!process.env.OWNER_EMAIL) return;
  try {
    const { error } = await getResend().emails.send({
      from: `PluggPress <${fromAddress()}>`,
      to: process.env.OWNER_EMAIL,
      replyTo: email,
      subject: `📬 New contact form message — ${name}${service ? ` (${service})` : ''}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 24px 30px; color: #000;">
            <h1 style="margin: 0; font-size: 20px;">New message from the PluggPress contact form</h1>
          </div>
          <div style="padding: 24px 30px; background: #f9f9f9;">
            <p style="margin: 0 0 6px;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 0 0 6px;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            ${service ? `<p style="margin: 0 0 6px;"><strong>Service:</strong> ${service}</p>` : ''}
            <div style="margin-top: 16px; padding: 16px; background: white; border-radius: 8px;">
              <p style="white-space: pre-wrap; line-height: 1.6; margin: 0;">${message}</p>
            </div>
          </div>
          <div style="padding: 16px 30px; text-align: center; color: #666; font-size: 12px;">
            Reply directly to this email to respond to ${name}.
          </div>
        </div>
      `,
    });
    if (error) throw new Error(error.message);
    console.log('✅ Contact notification email sent successfully');
  } catch (error) {
    console.error('❌ Error sending contact notification email:', error.message);
  }
}
