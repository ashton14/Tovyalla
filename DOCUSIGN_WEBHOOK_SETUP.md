# DocuSign Webhook Setup Guide

## Overview
DocuSign webhooks (called "Connect") notify your application when envelope events occur (sent, delivered, signed, completed, etc.).

## Step 1: Get a Public URL for Your Webhook

### For Production:
Use your production domain:
```
https://your-domain.com/api/docusign/webhook
```

### For Local Development:
You need a public URL that tunnels to your local server. Use **ngrok**:

1. **Install ngrok**: Download from https://ngrok.com/download
2. **Start your backend server** (on port 5000):
   ```bash
   cd backend
   npm run dev
   ```
3. **Start ngrok** in a new terminal:
   ```bash
   ngrok http 5000
   ```
4. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)
5. **Use this URL** for your webhook: `https://abc123.ngrok.io/api/docusign/webhook`

⚠️ **Note**: The ngrok URL changes each time you restart ngrok (unless you have a paid plan). You'll need to update the webhook URL in DocuSign each time.

## Step 2: Configure Webhook in DocuSign

### Option A: Using DocuSign Admin Console (Easiest)

1. Go to **https://admin.docusign.com** (or **https://demo.docusign.com** for sandbox)
2. Navigate to **Connect** → **Connect Configurations**
3. Click **Add Configuration**
4. Fill in the form:
   - **Name**: `Tovyalla CRM Webhook`
   - **URL**: Your webhook URL (from Step 1)
   - **HTTP Method**: `POST`
   - **Include Certificate**: ✅ Yes (recommended for security)
   - **Include Documents**: ❌ No (unless you need document content)
   - **Include Envelope Void Reason**: ✅ Yes
   - **Include Time Zone Information**: ✅ Yes
5. **Select Events** to subscribe to:
   - ✅ Envelope Sent
   - ✅ Envelope Delivered
   - ✅ Envelope Signed
   - ✅ Envelope Completed
   - ✅ Envelope Declined
   - ✅ Envelope Voided
6. Click **Save**

### Option B: Using API Script (Programmatic)

1. **Add to your `.env` file**:
   ```env
   DOCUSIGN_WEBHOOK_URL=https://your-domain.com/api/docusign/webhook
   ```

2. **Run the setup script**:
   ```bash
   node backend/scripts/setup-docusign-webhook.js
   ```

## Step 3: Test the Webhook

1. **Send a test document** via DocuSign using the "Send" button in your app
2. **Check your backend logs** for webhook requests:
   ```
   Updated document <id> with DocuSign status: sent
   ```
3. **Check DocuSign Connect logs**:
   - Go to **Connect** → **Connect Logs** in DocuSign Admin
   - Look for successful deliveries (status 200)

## Step 4: Verify Webhook Security (Production)

For production, you should verify webhook signatures:

1. **Enable HMAC verification** in DocuSign Connect settings
2. **Add signature verification** to your webhook endpoint (future enhancement)

Currently, the webhook accepts all requests. In production, add HMAC signature verification.

## Troubleshooting

### Webhook not receiving events:
- ✅ Check that your webhook URL is publicly accessible
- ✅ Verify the URL is correct in DocuSign Connect settings
- ✅ Check that events are enabled in Connect configuration
- ✅ Look at Connect Logs in DocuSign Admin for error messages
- ✅ Check your backend server logs for incoming requests

### Common Errors:
- **404 Not Found**: Webhook URL is incorrect or server is not running
- **500 Internal Server Error**: Check backend logs for database/processing errors
- **SSL Certificate Error**: Ensure your URL uses HTTPS (required by DocuSign)

### Testing Locally:
- Use ngrok for a public HTTPS URL
- Keep ngrok running while testing
- Update webhook URL in DocuSign if ngrok URL changes

## Environment Variables

Add to your `.env` file:
```env
# DocuSign Configuration
DOCUSIGN_INTEGRATION_KEY=your-integration-key
DOCUSIGN_USER_ID=your-email@example.com
DOCUSIGN_ACCOUNT_ID=your-account-id
DOCUSIGN_RSA_PRIVATE_KEY=your-private-key-or-path-to-pem-file
DOCUSIGN_API_BASE_URL=https://demo.docusign.net/restapi
DOCUSIGN_WEBHOOK_URL=https://your-domain.com/api/docusign/webhook
```

## Next Steps

After webhook is set up:
1. ✅ Send a test document
2. ✅ Verify status updates in your database
3. ✅ Check that status badges appear in the UI
4. ✅ Monitor Connect Logs for any issues
