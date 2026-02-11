# Environment Variables Setup

## Location
Your `.env` file should be in the **project root** (same directory as `backend/` and `frontend/`):
```
Tovyalla/
├── .env          ← HERE
├── backend/
├── frontend/
└── ...
```

## Optional Radar Variables (Address Autocomplete)

Add this to your `.env` file for address/location autocomplete in Customers and Projects:

```env
# Radar Maps (address autocomplete - backend proxy keeps key server-side)
RADAR_PUBLISHABLE_KEY=prj_test_pk_... or prj_live_pk_...
```

| Variable | Required | Description |
|----------|----------|-------------|
| `RADAR_PUBLISHABLE_KEY` | No | Radar publishable API key. Backend proxies requests so the key stays server-side. Use Test key for dev, Live for production. |

**Note:** If not set, address autocomplete will show "No addresses found". Get your key at [Radar Dashboard](https://dashboard.radar.com/settings). **On Railway:** Add `RADAR_PUBLISHABLE_KEY` to your backend service env vars (no `VITE_` prefix).

---

## Required BoldSign Variables

Add these to your `.env` file for electronic signature functionality:

```env
# BoldSign Configuration
BOLDSIGN_API_KEY=your-api-key
BOLDSIGN_WEBHOOK_URL=https://your-domain.com/api/esign/webhook
```

### Setting up BoldSign:

1. Create an account at [BoldSign](https://www.boldsign.com/) (100 free documents/month)
2. Go to Settings → API
3. Copy your **API Key** and add it as `BOLDSIGN_API_KEY`
4. Set up your webhook URL in the BoldSign dashboard:
   - For production: `https://your-domain.com/api/esign/webhook`
   - For local development: Use a tunneling service like [ngrok](https://ngrok.com/) to expose your local server

**Note:** The `BOLDSIGN_WEBHOOK_URL` is optional for sending documents. Configure your webhook endpoint in the BoldSign dashboard to receive status updates.

## Required Google Calendar Variables

Add these to your `.env` file for Google Calendar integration:

```env
# Google Calendar OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth/callback
FRONTEND_URL=http://localhost:3000
```

**Note:** For production, update `GOOGLE_REDIRECT_URI` and `FRONTEND_URL` to your production URLs.

### Setting up Google Calendar OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:5000/api/google/oauth/callback` (or your production URL)
7. Copy the Client ID and Client Secret to your `.env` file

## Required Infobip Variables (SMS Messaging)

Add these to your `.env` file for SMS messaging functionality:

```env
# Infobip Configuration
INFOBIP_API_KEY=your-api-key
INFOBIP_BASE_URL=https://xxxxx.api.infobip.com
INFOBIP_SENDER_ID=+1234567890
INFOBIP_WEBHOOK_URL=https://your-domain.com/api/sms/webhook
INFOBIP_WEBHOOK_SECRET=your-optional-secret
```

### Setting up Infobip:

1. Create an account at [Infobip](https://portal.infobip.com/) (free trial available)
2. Find your credentials:
   - **API Key**: Go to your profile settings or API Keys section
   - **Base URL**: Found on your dashboard (unique to your account, e.g., `https://xxxxx.api.infobip.com`)
3. Set up a phone number or sender ID:
   - Go to **Channels and Numbers** → **Numbers**
   - Purchase or register a phone number, or use an alphanumeric sender ID
   - Copy it to `INFOBIP_SENDER_ID`
4. Configure your webhook URL for incoming messages:
   - Go to **Channels and Numbers** → **Numbers** → Select your number
   - Under **Forward to HTTP**, set the URL to your backend endpoint
   - For production: `https://your-domain.com/api/sms/webhook`
   - For local development: Use a tunneling service like [ngrok](https://ngrok.com/)

**Note:** The `INFOBIP_WEBHOOK_SECRET` is optional but recommended. If set, add it as a query parameter or header when configuring the webhook in Infobip (e.g., `https://your-domain.com/api/sms/webhook?secret=your-secret`).

### Infobip Pricing:
- Pricing varies by country and volume
- Free trial includes credits for testing
- Visit [Infobip Pricing](https://www.infobip.com/pricing) for details

## Required Stripe Variables (Billing / New Company Signup)

Add these to your `.env` file for Business Plan subscriptions ($299/mo):

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
STRIPE_PRICE_ID=price_your-price-id
FRONTEND_URL=http://localhost:3000
```

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (starts with `sk_test_` or `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Yes (for webhooks) | Webhook signing secret (starts with `whsec_`) |
| `STRIPE_PRICE_ID` | Yes | Price ID for $299/month Business Plan (from Stripe Dashboard) |
| `FRONTEND_URL` | Yes (if not set) | Base URL for success/cancel redirects. Dev: `http://localhost:3000` (matches Vite port) |

**Frontend:** No Stripe keys needed. All billing is done server-side via Checkout redirects.

## Optional EmailJS Variables (Welcome Email with Company ID)

Add these to your `.env` file to email new users their Company ID after successful registration:

```env
# EmailJS Configuration (for registration welcome email)
EMAILJS_SERVICE_ID=your-service-id
EMAILJS_TEMPLATE_ID=your-template-id
EMAILJS_PUBLIC_KEY=your-public-key
EMAILJS_PRIVATE_KEY=your-private-key
```

| Variable | Required | Description |
|----------|----------|-------------|
| `EMAILJS_SERVICE_ID` | Yes (if email enabled) | Email service ID from EmailJS dashboard |
| `EMAILJS_TEMPLATE_ID` | Yes (if email enabled) | Email template ID from EmailJS dashboard |
| `EMAILJS_PUBLIC_KEY` | Yes (if email enabled) | Public key from EmailJS dashboard |
| `EMAILJS_PRIVATE_KEY` | Yes (if email enabled) | Private key from EmailJS dashboard (keep secret!) |

**Note:** If EmailJS is not configured, registration still succeeds; the welcome email is simply skipped.

**Template variables:** Create a template in EmailJS with these variables: `{{to_email}}`, `{{company_id}}`, `{{company_name}}`, `{{owner_name}}`, `{{login_url}}`

**Important:** Enable API requests for Node.js in EmailJS: Account → Security → allow non-browser applications

### Setting up Stripe:

1. Create an account at [Stripe](https://dashboard.stripe.com/)
2. Create a Product + Price: "Business Plan" at $299/month recurring
3. Copy the Price ID (e.g. `price_xxx`) and add as `STRIPE_PRICE_ID`
4. Copy your Secret Key from Developers → API keys → add as `STRIPE_SECRET_KEY`
5. For webhooks:
   - **Production:** Add endpoint `https://your-domain.com/api/billing/webhook`, subscribe to: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - **Local dev:** Use Stripe CLI: `stripe listen --forward-to localhost:5000/api/billing/webhook` to get `STRIPE_WEBHOOK_SECRET`

## Important Notes

1. **No spaces around `=`**: 
   ✅ Correct: `BOLDSIGN_API_KEY=value`
   ❌ Wrong: `BOLDSIGN_API_KEY = value`

2. **Keep your API key secret**:
   - Never commit your `.env` file to version control
   - Never expose your API key in client-side code
   - Rotate your key if it's ever compromised

3. **Restart your server** after adding/updating env variables:
   ```bash
   # Stop the server (Ctrl+C)
   # Then restart:
   cd backend
   npm run dev
   ```

## Verify Variables Are Loaded

After restarting, check the console output. You should see:
- ✅ If variables are loaded correctly: No warnings
- ⚠️ If variables are missing: Warning messages showing which ones are missing

## Troubleshooting

### "BoldSign API key not configured" error:

1. ✅ Verify `.env` file is in the project root (not in `backend/`)
2. ✅ Check for typos in variable names (case-sensitive)
3. ✅ Ensure no spaces around `=` sign
4. ✅ Restart your backend server
5. ✅ Check the debug output in console - it will show which variables are missing

### "API request failed" errors:

1. **Check your API key**:
   - Make sure the key is copied correctly from your BoldSign account
   - Verify you're using the API Key from Settings → API

2. **Check rate limits**:
   - BoldSign has API rate limits
   - Use webhooks for status updates instead of polling

3. **Free tier limits**:
   - BoldSign offers 100 free documents/month
   - Upgrade your plan if you need more

### Webhook not receiving updates:

1. **Check the webhook URL**:
   - Must be publicly accessible (not `localhost` unless using ngrok)
   - Must use HTTPS in production

2. **Configure in BoldSign dashboard**:
   - Go to Settings → Webhooks
   - Add your webhook URL
   - Select the events you want to receive (Sent, Viewed, Signed, Completed, Declined, Expired)

3. **Check your firewall/security settings**:
   - Allow incoming POST requests to `/api/esign/webhook`
