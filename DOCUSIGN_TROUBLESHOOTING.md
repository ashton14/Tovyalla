# DocuSign Authentication Troubleshooting

## "Bad Request" Error

If you see "Failed to authenticate with DocuSign: Bad Request", it's usually one of these issues:

### 1. Consent Not Granted (Most Common)

**Problem**: Your DocuSign integration needs user consent before it can authenticate.

**Solution**: 

**STEP 1: Register a Redirect URI in DocuSign Admin**

Before granting consent, you must register at least one redirect URI:

1. Go to **https://admin.docusign.com** (or **https://demo.docusign.com** for sandbox)
2. Navigate to **Settings** → **Integrations**
3. Find your integration (by Integration Key)
4. Click **Edit** or **Settings**
5. Under **Redirect URIs**, click **Add URI**
6. Add at least one redirect URI. Common options:
   - `https://www.docusign.com` (standard)
   - `https://localhost` (for local testing)
   - `https://your-domain.com` (your actual domain)
7. Click **Save**

**STEP 2: Grant Consent**

1. **For Demo Environment**:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://www.docusign.com
   ```
   Replace `YOUR_INTEGRATION_KEY` with your actual integration key.
   Replace `https://www.docusign.com` with one of the redirect URIs you registered.

2. **For Production**:
   ```
   https://account.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://www.docusign.com
   ```

3. **Steps**:
   - Visit the URL above (with your integration key and registered redirect URI)
   - Log in with your DocuSign account (the one matching `DOCUSIGN_USER_ID`)
   - Click "Allow" to grant consent
   - You'll be redirected - this is normal
   - Try your request again

**Note**: The redirect URI in the consent URL must exactly match one of the redirect URIs you registered in DocuSign Admin.

### 2. Invalid Credentials

**Check these in your `.env` file**:

- ✅ `DOCUSIGN_INTEGRATION_KEY` - Should match your Integration Key from DocuSign
- ✅ `DOCUSIGN_USER_ID` - Should be the email of the DocuSign user (must match the account you grant consent with)
- ✅ `DOCUSIGN_ACCOUNT_ID` - Should be your DocuSign Account ID (found in account settings)
- ✅ `DOCUSIGN_RSA_PRIVATE_KEY` - Must match the public key you uploaded to DocuSign

**How to find your Account ID**:
1. Log into DocuSign Admin (https://admin.docusign.com)
2. Go to **Settings** → **Integrations**
3. Your Account ID is shown at the top

### 3. Private Key Mismatch

**Problem**: The RSA private key in your `.env` doesn't match the public key registered in DocuSign.

**Solution**:
1. Go to DocuSign Admin → **Settings** → **Integrations**
2. Find your integration
3. Check the RSA public key that's registered
4. Ensure your private key matches (they're a key pair)
5. If they don't match, either:
   - Update the public key in DocuSign to match your private key, OR
   - Update your private key in `.env` to match the public key in DocuSign

### 4. Wrong Environment

**Problem**: Using production credentials with demo API or vice versa.

**Check**:
- Demo environment: `DOCUSIGN_API_BASE_URL=https://demo.docusign.net/restapi`
- Production: `DOCUSIGN_API_BASE_URL=https://account.docusign.com/restapi` (or your account's base URL)

### 5. Account ID Mismatch

**Problem**: The `DOCUSIGN_ACCOUNT_ID` doesn't match the account you're using.

**Solution**:
1. Log into DocuSign Admin
2. Go to **Settings** → **Integrations**
3. Copy the Account ID shown at the top
4. Update `DOCUSIGN_ACCOUNT_ID` in your `.env` file

## Getting More Details

After the fix, the error messages will show more details. Check your console output for:
- The actual error response from DocuSign
- Whether consent is required
- Any specific validation errors

## Quick Checklist

Before trying again, verify:

- [ ] Consent has been granted (visit the consent URL)
- [ ] Integration Key is correct
- [ ] User ID (email) matches the account you granted consent with
- [ ] Account ID is correct
- [ ] Private key matches the public key in DocuSign
- [ ] Environment (demo vs production) matches your credentials
- [ ] Server has been restarted after updating `.env`

## Still Having Issues?

1. Check the console output - it now shows detailed error messages
2. Verify all credentials in DocuSign Admin
3. Make sure you're using the correct environment (demo vs production)
4. Try granting consent again (sometimes it needs to be re-granted)
