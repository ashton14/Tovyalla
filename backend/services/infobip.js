import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (two levels up from backend/services/)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Infobip configuration
const API_KEY = process.env.INFOBIP_API_KEY;
const BASE_URL = process.env.INFOBIP_BASE_URL; // e.g., https://xxxxx.api.infobip.com
const SENDER_ID = process.env.INFOBIP_SENDER_ID; // Phone number or alphanumeric sender ID
const WEBHOOK_URL = process.env.INFOBIP_WEBHOOK_URL;

// Debug: Log which env vars are loaded (without showing sensitive values)
if (!API_KEY || !BASE_URL || !SENDER_ID) {
  console.warn('⚠️  Infobip environment variables missing:');
  console.warn('   INFOBIP_API_KEY:', API_KEY ? '✓ Set' : '✗ Missing');
  console.warn('   INFOBIP_BASE_URL:', BASE_URL ? '✓ Set' : '✗ Missing');
  console.warn('   INFOBIP_SENDER_ID:', SENDER_ID ? '✓ Set' : '✗ Missing');
  console.warn('   INFOBIP_WEBHOOK_URL:', WEBHOOK_URL || '(not set - configure in Infobip portal)');
}

/**
 * Send an SMS message via Infobip
 * 
 * @param {string} to - Recipient phone number (E.164 format, e.g., +1234567890)
 * @param {string} body - Message body
 * @returns {Promise<Object>} Infobip message response with messageId and status
 */
export async function sendSMS(to, body) {
  if (!API_KEY || !BASE_URL) {
    throw new Error('Infobip not configured. Please set INFOBIP_API_KEY and INFOBIP_BASE_URL in your .env file.');
  }

  if (!SENDER_ID) {
    throw new Error('Infobip sender ID not configured. Please set INFOBIP_SENDER_ID in your .env file.');
  }

  // Validate phone number format
  const normalizedTo = normalizePhoneNumber(to);
  if (!normalizedTo) {
    throw new Error('Invalid phone number format. Please use E.164 format (e.g., +1234567890).');
  }

  // Remove the + prefix for Infobip (they expect numbers without +)
  const infobipTo = normalizedTo.startsWith('+') ? normalizedTo.substring(1) : normalizedTo;

  try {
    const response = await fetch(`${BASE_URL}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        'Authorization': `App ${API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to: infobipTo }],
            from: SENDER_ID,
            text: body,
          }
        ]
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.requestError?.serviceException?.text || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const message = data.messages?.[0];

    return {
      sid: message?.messageId || null,
      status: message?.status?.name?.toLowerCase() || 'sent',
      to: normalizedTo,
      from: SENDER_ID,
      dateCreated: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Infobip send error:', error.message);
    throw new Error(`Failed to send SMS: ${error.message}`);
  }
}

/**
 * Validate that an incoming webhook request is from Infobip
 * Note: Infobip uses IP whitelisting or basic auth for webhook security
 * 
 * @param {Object} req - Express request object
 * @returns {boolean} True if the request appears valid
 */
export function validateWebhook(req) {
  // Infobip doesn't use signature-based validation like Twilio
  // Instead, they recommend:
  // 1. IP whitelisting (configure in your firewall)
  // 2. Basic auth on your webhook endpoint
  // For now, we'll accept all requests but log a warning
  
  // You can add custom validation here, such as checking for a secret header
  const webhookSecret = process.env.INFOBIP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const providedSecret = req.headers['x-infobip-secret'] || req.query.secret;
    return providedSecret === webhookSecret;
  }
  
  // Without a secret configured, accept all requests (not recommended for production)
  return true;
}

/**
 * Normalize a phone number to E.164 format
 * 
 * @param {string} phone - Phone number in various formats
 * @returns {string|null} Normalized phone number or null if invalid
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return null;

  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If it starts with +, it's already in E.164 format
  if (cleaned.startsWith('+')) {
    // Basic validation: should be 10-15 digits after the +
    const digits = cleaned.substring(1);
    if (digits.length >= 10 && digits.length <= 15) {
      return cleaned;
    }
    return null;
  }

  // Remove leading 1 if present and re-add with +
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    return '+' + cleaned;
  }

  // Assume US number if 10 digits
  if (cleaned.length === 10) {
    return '+1' + cleaned;
  }

  // For other lengths, assume international with missing +
  if (cleaned.length >= 10 && cleaned.length <= 15) {
    return '+' + cleaned;
  }

  return null;
}

/**
 * Parse incoming Infobip webhook data (Delivery Reports or Incoming Messages)
 * 
 * @param {Object} body - The webhook request body
 * @returns {Object} Parsed message data
 */
export function parseIncomingMessage(body) {
  // Infobip sends incoming messages in a different format
  // Check if this is an incoming message webhook
  if (body.results && Array.isArray(body.results)) {
    // This is the standard Infobip incoming message format
    const message = body.results[0];
    return {
      messageSid: message?.messageId,
      from: message?.from ? `+${message.from}` : null,
      to: message?.to ? `+${message.to}` : null,
      body: message?.text || message?.message?.text || '',
      status: 'received',
      receivedAt: message?.receivedAt,
      keyword: message?.keyword,
    };
  }
  
  // Single message format (some webhook configurations)
  return {
    messageSid: body.messageId,
    from: body.from ? `+${body.from}` : null,
    to: body.to ? `+${body.to}` : null,
    body: body.text || body.message?.text || '',
    status: 'received',
    receivedAt: body.receivedAt,
  };
}

/**
 * Generate a simple JSON response for incoming messages
 * (Infobip doesn't use TwiML-style responses)
 * 
 * @param {string} [message] - Optional auto-reply message (not used, kept for API compatibility)
 * @returns {string} Empty response - auto-replies should be sent as new messages
 */
export function generateTwiMLResponse(message = null) {
  // Infobip doesn't support inline auto-replies like Twilio's TwiML
  // To send a reply, you would call sendSMS separately
  // Return empty JSON for webhook acknowledgment
  return JSON.stringify({ status: 'received' });
}

/**
 * Check if Infobip is properly configured
 * 
 * @returns {boolean} True if all required environment variables are set
 */
export function isConfigured() {
  return !!(API_KEY && BASE_URL && SENDER_ID);
}

/**
 * Get the configured sender ID (phone number or alphanumeric)
 * 
 * @returns {string|null} The configured sender ID or null
 */
export function getPhoneNumber() {
  return SENDER_ID || null;
}

/**
 * Get delivery reports for sent messages
 * 
 * @param {string} messageId - The message ID to check
 * @returns {Promise<Object>} Delivery report data
 */
export async function getDeliveryReport(messageId) {
  if (!API_KEY || !BASE_URL) {
    throw new Error('Infobip not configured.');
  }

  try {
    const response = await fetch(`${BASE_URL}/sms/1/reports?messageId=${messageId}`, {
      method: 'GET',
      headers: {
        'Authorization': `App ${API_KEY}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Infobip delivery report error:', error.message);
    throw error;
  }
}

export default {
  sendSMS,
  validateWebhook,
  normalizePhoneNumber,
  parseIncomingMessage,
  generateTwiMLResponse,
  isConfigured,
  getPhoneNumber,
  getDeliveryReport,
};
