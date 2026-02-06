import emailjs from '@emailjs/nodejs';

/**
 * Send welcome email with Company ID after successful registration
 * Uses EmailJS - create a template in EmailJS dashboard with variables: {{to_email}}, {{company_id}}, {{company_name}}, {{owner_name}}, {{login_url}}
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.companyId - The user's Company ID
 * @param {string} [options.companyName] - Company name (optional)
 * @param {string} [options.ownerName] - Owner/user name for personalized greeting (optional)
 */
export async function sendRegistrationWelcome({ to, companyId, companyName, ownerName }) {
  const serviceId = (process.env.EMAILJS_SERVICE_ID || '').trim();
  const templateId = (process.env.EMAILJS_TEMPLATE_ID || '').trim();
  const publicKey = (process.env.EMAILJS_PUBLIC_KEY || '').trim();
  const privateKey = (process.env.EMAILJS_PRIVATE_KEY || '').trim();

  // Debug: which env vars are set (don't log values)
  console.log('[EmailJS] Config check:', {
    EMAILJS_SERVICE_ID: serviceId ? `set (${serviceId.length} chars)` : 'MISSING',
    EMAILJS_TEMPLATE_ID: templateId ? `set (${templateId.length} chars)` : 'MISSING',
    EMAILJS_PUBLIC_KEY: publicKey ? 'set' : 'MISSING',
    EMAILJS_PRIVATE_KEY: privateKey ? 'set' : 'MISSING',
  });

  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.warn('[EmailJS] Skipped: missing required config (EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, EMAILJS_PRIVATE_KEY)');
    return { sent: false };
  }

  const loginUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  const templateParams = {
    to_email: to,
    company_id: companyId,
    company_name: companyName || '',
    owner_name: ownerName || '',
    login_url: loginUrl,
  };

  console.log('[EmailJS] Sending welcome email:', {
    serviceId,
    templateId,
    to_email: to,
    company_id: companyId,
  });

  try {
    const result = await emailjs.send(serviceId, templateId, templateParams, {
      publicKey,
      privateKey,
    });
    console.log('[EmailJS] Send success:', { status: result?.status, text: result?.text });
    return { sent: true };
  } catch (err) {
    const errMsg = err?.message || err?.text || err?.statusText || (typeof err === 'object' ? JSON.stringify(err) : String(err));
    console.error('[EmailJS] Send failed:', errMsg || 'Unknown error');
    console.error('[EmailJS] Error details:', {
      name: err?.name,
      status: err?.status,
      text: err?.text,
      message: err?.message,
      constructor: err?.constructor?.name,
    });
    return { sent: false };
  }
}
