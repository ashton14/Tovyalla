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

## Required DocuSign Variables

Add these to your `.env` file:

```env
# DocuSign Configuration
DOCUSIGN_INTEGRATION_KEY=your-integration-key-here
DOCUSIGN_USER_ID=your-email@example.com
DOCUSIGN_ACCOUNT_ID=your-account-id-here
DOCUSIGN_RSA_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nYour key here\n-----END RSA PRIVATE KEY-----
DOCUSIGN_API_BASE_URL=https://demo.docusign.net/restapi
```

## Important Notes

1. **No spaces around `=`**: 
   ✅ Correct: `DOCUSIGN_INTEGRATION_KEY=value`
   ❌ Wrong: `DOCUSIGN_INTEGRATION_KEY = value`

2. **RSA Private Key** (IMPORTANT - This is the most common issue):
   
   **Option A: Use a file path** (Recommended):
   ```env
   DOCUSIGN_RSA_PRIVATE_KEY=C:/path/to/private_key.pem
   ```
   Or relative to project root:
   ```env
   DOCUSIGN_RSA_PRIVATE_KEY=keys/docusign_private_key.pem
   ```
   
   **Option B: Put the key directly in .env** (Use `\n` for newlines):
   ```env
   DOCUSIGN_RSA_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----
   ```
   
   **The key MUST:**
   - Start with `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----`
   - End with `-----END RSA PRIVATE KEY-----` or `-----END PRIVATE KEY-----`
   - Have proper newlines (use `\n` in .env file)
   - Be the complete key (not just part of it)
   
   **Example of correct format in .env:**
   ```env
   DOCUSIGN_RSA_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA1234567890abcdef...\n-----END RSA PRIVATE KEY-----
   ```

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

### "DocuSign configuration missing" error:

1. ✅ Verify `.env` file is in the project root (not in `backend/`)
2. ✅ Check for typos in variable names (case-sensitive)
3. ✅ Ensure no spaces around `=` sign
4. ✅ Restart your backend server
5. ✅ Check the debug output in console - it will show which variables are missing

### "secretOrPrivateKey must be an asymmetric key when using RS256" error:

This means your RSA private key format is incorrect. Common issues:

1. **Key is missing headers/footers**:
   - ✅ Must start with: `-----BEGIN RSA PRIVATE KEY-----` or `-----BEGIN PRIVATE KEY-----`
   - ✅ Must end with: `-----END RSA PRIVATE KEY-----` or `-----END PRIVATE KEY-----`

2. **Newlines not properly escaped**:
   - ✅ In `.env` file, use `\n` for each line break
   - ✅ Example: `-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----`

3. **Key is incomplete or corrupted**:
   - ✅ Make sure you copied the ENTIRE key (including headers/footers)
   - ✅ Check that no characters were accidentally removed

4. **Best solution: Use a file path instead**:
   ```env
   # Save your key to: backend/keys/docusign_private_key.pem
   # Then in .env:
   DOCUSIGN_RSA_PRIVATE_KEY=keys/docusign_private_key.pem
   ```
   
   This avoids newline escaping issues entirely.

5. **Verify your key format**:
   - Open the key file in a text editor
   - It should look like:
     ```
     -----BEGIN RSA PRIVATE KEY-----
     MIIEpAIBAAKCAQEA...
     (many lines of base64 encoded data)
     ...
     -----END RSA PRIVATE KEY-----
     ```
