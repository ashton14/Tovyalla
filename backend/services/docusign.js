import * as docusignModule from 'docusign-esign';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (two levels up from backend/services/)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Get DocuSign classes (handle both ES module and CommonJS patterns)
const docusign = docusignModule.default || docusignModule;

// DocuSign configuration from environment variables
const INTEGRATION_KEY = process.env.DOCUSIGN_INTEGRATION_KEY;
const USER_ID = process.env.DOCUSIGN_USER_ID;
const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;
const API_BASE_URL = process.env.DOCUSIGN_API_BASE_URL || 'https://demo.docusign.net/restapi';
const RSA_PRIVATE_KEY = process.env.DOCUSIGN_RSA_PRIVATE_KEY;

// Debug: Log which env vars are loaded (without showing sensitive values)
if (!INTEGRATION_KEY || !USER_ID || !ACCOUNT_ID) {
  console.warn('⚠️  DocuSign environment variables missing:');
  console.warn('   DOCUSIGN_INTEGRATION_KEY:', INTEGRATION_KEY ? '✓ Set' : '✗ Missing');
  console.warn('   DOCUSIGN_USER_ID:', USER_ID ? '✓ Set' : '✗ Missing');
  console.warn('   DOCUSIGN_ACCOUNT_ID:', ACCOUNT_ID ? '✓ Set' : '✗ Missing');
  console.warn('   DOCUSIGN_RSA_PRIVATE_KEY:', RSA_PRIVATE_KEY ? '✓ Set' : '✗ Missing');
  console.warn('   DOCUSIGN_API_BASE_URL:', API_BASE_URL);
  console.warn('   .env file location:', join(__dirname, '..', '..', '.env'));
}

// Cache for access token
let accessToken = null;
let tokenExpiry = null;

/**
 * Get RSA private key from environment variable or file
 */
function getPrivateKey() {
  if (!RSA_PRIVATE_KEY) {
    throw new Error('DOCUSIGN_RSA_PRIVATE_KEY not configured');
  }

  try {
    // Check if it's a file path (contains path separators and doesn't start with -----BEGIN)
    const isFilePath = (RSA_PRIVATE_KEY.includes('/') || RSA_PRIVATE_KEY.includes('\\')) && 
                      !RSA_PRIVATE_KEY.trim().startsWith('-----BEGIN');
    
    if (isFilePath) {
      // Read from file
      const keyPath = path.isAbsolute(RSA_PRIVATE_KEY) 
        ? RSA_PRIVATE_KEY 
        : join(__dirname, '..', '..', RSA_PRIVATE_KEY);
      
      if (!fs.existsSync(keyPath)) {
        throw new Error(`RSA private key file not found: ${keyPath}`);
      }
      
      const keyContent = fs.readFileSync(keyPath, 'utf8');
      return keyContent.trim();
    } else {
      // It's the key content itself - handle different formats
      let keyContent = RSA_PRIVATE_KEY;
      
      // Replace escaped newlines with actual newlines
      keyContent = keyContent.replace(/\\n/g, '\n');
      
      // Ensure proper line breaks
      if (!keyContent.includes('\n')) {
        // If no newlines, try to format it (though this is unlikely for a proper key)
        console.warn('⚠️  RSA key appears to be on a single line. Ensure it has proper newlines.');
      }
      
      // Validate it looks like a private key
      if (!keyContent.includes('-----BEGIN') || !keyContent.includes('-----END')) {
        throw new Error('RSA private key must start with "-----BEGIN" and end with "-----END"');
      }
      
      return keyContent.trim();
    }
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      throw new Error(`Failed to read RSA private key: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get JWT access token for DocuSign API
 */
export async function getAccessToken() {
  // Return cached token if still valid
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  if (!INTEGRATION_KEY || !USER_ID || !ACCOUNT_ID) {
    throw new Error('DocuSign configuration missing. Please set DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, and DOCUSIGN_ACCOUNT_ID');
  }

  // Set OAuth base path - must be just the domain name (no protocol, no path)
  // For demo environment: account-d.docusign.com
  // For production: account.docusign.com
  let oauthBasePath;
  if (API_BASE_URL.includes('demo.docusign.net')) {
    oauthBasePath = 'account-d.docusign.com';
  } else if (API_BASE_URL.includes('docusign.net')) {
    oauthBasePath = 'account.docusign.com';
  } else {
    // Fallback: try to extract domain from API_BASE_URL
    let domain = API_BASE_URL.replace('/restapi', '').replace('https://', '').replace('http://', '');
    // Remove any trailing slashes or paths
    domain = domain.split('/')[0];
    oauthBasePath = domain;
  }

  try {
    const privateKey = getPrivateKey();
    const apiClient = new docusign.ApiClient();
    
    apiClient.setOAuthBasePath(oauthBasePath);

    // Convert private key to Buffer if it's a string
    // The key should be in PEM format
    let keyBuffer;
    if (Buffer.isBuffer(privateKey)) {
      keyBuffer = privateKey;
    } else if (typeof privateKey === 'string') {
      keyBuffer = Buffer.from(privateKey, 'utf8');
    } else {
      throw new Error('Private key must be a string or Buffer');
    }

    // Verify the key looks like a valid RSA private key
    const keyString = keyBuffer.toString('utf8');
    if (!keyString.includes('-----BEGIN') || !keyString.includes('PRIVATE KEY')) {
      throw new Error('Invalid RSA private key format. Must be in PEM format with -----BEGIN and -----END markers.');
    }

    const results = await apiClient.requestJWTUserToken(
      INTEGRATION_KEY,
      USER_ID,
      'signature impersonation',
      keyBuffer,
      3600 // Token expires in 1 hour
    );

    accessToken = results.body.access_token;
    tokenExpiry = Date.now() + (results.body.expires_in * 1000) - 60000; // Subtract 1 minute for safety

    return accessToken;
  } catch (error) {
    console.error('Error getting DocuSign access token:', error);
    
    // Extract more detailed error information
    let errorMessage = error.message;
    let errorDetails = '';
    
    if (error.response) {
      errorDetails = JSON.stringify(error.response.body || error.response, null, 2);
      console.error('DocuSign API Error Response:', errorDetails);
      
      // Check for common error scenarios
      if (error.response.body) {
        const body = error.response.body;
        
        // Check for consent required error
        if (body.error === 'consent_required' || body.error_description?.includes('consent')) {
          // Use a standard redirect URI that should be registered
          const redirectUri = 'https://www.docusign.com';
          const consentUrl = body.consent_uri || 
            `https://${oauthBasePath}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${INTEGRATION_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}`;
          
          errorMessage = `Consent required. Please grant consent to your DocuSign integration.\n\nIMPORTANT: First, register a redirect URI in DocuSign Admin:\n1. Go to https://admin.docusign.com → Settings → Integrations\n2. Find your integration and add a redirect URI (e.g., https://www.docusign.com)\n3. Save the changes\n\nThen visit this URL to grant consent:\n${consentUrl}\n\nAfter granting consent, try again.`;
        } else if (body.error_description) {
          errorMessage = `${error.message}: ${body.error_description}`;
        }
      }
    } else if (error.body) {
      errorDetails = JSON.stringify(error.body, null, 2);
      console.error('DocuSign Error Body:', errorDetails);
      
      if (error.body.error === 'consent_required' || error.body.error_description?.includes('consent')) {
        // Use a standard redirect URI that should be registered
        const redirectUri = 'https://www.docusign.com';
        const consentUrl = error.body.consent_uri || 
          `https://${oauthBasePath}/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=${INTEGRATION_KEY}&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        errorMessage = `Consent required. Please grant consent to your DocuSign integration.\n\nIMPORTANT: First, register a redirect URI in DocuSign Admin:\n1. Go to https://admin.docusign.com → Settings → Integrations\n2. Find your integration and add a redirect URI (e.g., https://www.docusign.com)\n3. Save the changes\n\nThen visit this URL to grant consent:\n${consentUrl}\n\nAfter granting consent, try again.`;
      } else if (error.body.error_description) {
        errorMessage = `${error.message}: ${error.body.error_description}`;
      }
    }
    
    throw new Error(`Failed to authenticate with DocuSign: ${errorMessage}`);
  }
}

/**
 * Get account information
 */
export async function getAccountInfo() {
  const accessToken = await getAccessToken();
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(API_BASE_URL);
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

  const accountsApi = new docusign.AccountsApi(apiClient);
  const accountInfo = await accountsApi.getAccountInformation(ACCOUNT_ID);

  return accountInfo;
}

/**
 * Get user info and find the correct account
 * Returns account ID and base URL
 */
async function getAccountDetails() {
  try {
    const accessToken = await getAccessToken();
    const apiClient = new docusign.ApiClient();
    
    // Set OAuth base path for getting user info
    let oauthBasePath;
    if (API_BASE_URL.includes('demo.docusign.net')) {
      oauthBasePath = 'account-d.docusign.com';
    } else if (API_BASE_URL.includes('docusign.net')) {
      oauthBasePath = 'account.docusign.com';
    } else {
      let domain = API_BASE_URL.replace('/restapi', '').replace('https://', '').replace('http://', '');
      domain = domain.split('/')[0];
      oauthBasePath = domain;
    }
    
    apiClient.setOAuthBasePath(oauthBasePath);
    
    // Get user info to see all available accounts
    // getUserInfo uses the OAuth base path, not the API base path
    const userInfo = await apiClient.getUserInfo(accessToken);
    
    if (!userInfo.accounts || userInfo.accounts.length === 0) {
      throw new Error('No accounts found for this user. Please verify your DocuSign account has access.');
    }
    
    // Try to find the account matching ACCOUNT_ID
    let account = null;
    if (ACCOUNT_ID) {
      account = userInfo.accounts.find(acc => 
        acc.accountId === ACCOUNT_ID || 
        acc.accountIdGuid === ACCOUNT_ID ||
        String(acc.accountId) === String(ACCOUNT_ID) ||
        acc.accountIdGuid === ACCOUNT_ID.replace(/-/g, '') ||
        acc.accountIdGuid === ACCOUNT_ID.replace(/-/g, '').toLowerCase()
      );
    }
    
    // If not found, use the first account (default)
    if (!account) {
      if (ACCOUNT_ID) {
        console.warn(`Account ID ${ACCOUNT_ID} not found. Available accounts:`, 
          userInfo.accounts.map(a => ({ 
            accountId: a.accountId, 
            accountIdGuid: a.accountIdGuid, 
            name: a.accountName 
          })));
        console.warn('Using first available account instead.');
      }
      account = userInfo.accounts[0];
    }
    
    // Get base URI and ensure it includes /restapi
    const baseUri = account.baseUri;
    if (!baseUri) {
      throw new Error('Account base URI not found');
    }
    
    const baseUrl = baseUri.endsWith('/restapi') ? baseUri : `${baseUri}/restapi`;
    const accountId = account.accountIdGuid || account.accountId;
    
    return {
      accountId,
      baseUrl,
      accountName: account.accountName,
    };
  } catch (error) {
    console.error('Error getting account info:', error.message);
    throw error;
  }
}

/**
 * Get the correct base URL and verify account ID
 * This ensures we use the account-specific base URL
 */
async function getAccountBaseUrl() {
  try {
    const accountDetails = await getAccountDetails();
    return accountDetails.baseUrl;
  } catch (error) {
    console.error('Error getting account base URL:', error.message);
    // Fall back to configured URL but log a warning
    console.warn('Using configured base URL:', API_BASE_URL);
    return API_BASE_URL;
  }
}

/**
 * Create and send a DocuSign envelope
 * @param {Object} options - Envelope options
 * @param {Buffer} documentBuffer - Document file buffer
 * @param {string} documentName - Document file name
 * @param {string} recipientEmail - Recipient email address (owner)
 * @param {string} recipientName - Recipient name (owner)
 * @param {string} subject - Email subject
 * @param {string} emailBlurb - Email message body
 * @param {string[]} ccEmails - CC email addresses (optional)
 * @param {string[]} bccEmails - BCC email addresses (optional)
 * @param {string} companySignerEmail - Company signer email address (optional, if not provided, company signer won't be added)
 * @param {string} companyName - Company name for company signer (optional)
 * @param {string} companySignerName - Company signer's name (sender's name, optional)
 * @returns {Promise<string>} Envelope ID
 */
export async function createAndSendEnvelope({
  documentBuffer,
  documentName,
  recipientEmail,
  recipientName,
  subject,
  emailBlurb,
  ccEmails = [],
  bccEmails = [],
  companySignerEmail = null,
  companyName = null,
  companySignerName = null,
}) {
  const accessToken = await getAccessToken();
  
  // Get account details (ID and base URL)
  const accountDetails = await getAccountDetails();
  const accountId = accountDetails.accountId;
  const baseUrl = accountDetails.baseUrl;
  
  console.log(`Using account: ${accountDetails.accountName} (${accountId})`);
  
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(baseUrl);
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

  // Create document
  const document = docusign.Document.constructFromObject({
    documentBase64: documentBuffer.toString('base64'),
    name: documentName,
    fileExtension: path.extname(documentName).substring(1) || 'pdf',
    documentId: '1',
  });

  // Create signer
  const signer = docusign.Signer.constructFromObject({
    email: recipientEmail,
    name: recipientName || recipientEmail,
    recipientId: '1',
    routingOrder: '1',
  });

  // Create signature tabs for owner signature section
  // The PDF has "SIGNATURES" section header on the last page, followed by "OWNER" and "CONTRACTOR" sections
  // IMPORTANT: Anchor to "SIGNATURES" which only appears once on the last page to avoid matching other sections
  // The recipientId '1' ensures these tabs only appear for the owner signer
  
  // Signature tab - positioned at the signature line in the OWNER section
  // Anchor to "SIGNATURES" (unique to last page) and position relative to OWNER section below it
  const signHere = docusign.SignHere.constructFromObject({
    documentId: '1',
    recipientId: '1', // Must match owner signer's recipientId - this restricts tabs to owner signer only
    tabLabel: 'OwnerSignature',
    anchorString: 'SIGNATURES',
    anchorXOffset: '0',
    anchorYOffset: '100', // Position below "SIGNATURES" header, at OWNER signature line (adjust if needed)
    anchorUnits: 'pixels',
    anchorCaseSensitive: 'true', // Case-sensitive matching
  });

  // Printed name tab - positioned at the printed name line in OWNER section
  // Anchor to "SIGNATURES" to ensure we only get tabs on the last page signature section
  const textTab = docusign.Text.constructFromObject({
    documentId: '1',
    recipientId: '1', // Must match owner signer's recipientId - this restricts tabs to owner signer only
    tabLabel: 'OwnerPrintedName',
    anchorString: 'SIGNATURES',
    anchorXOffset: '0',
    anchorYOffset: '150', // Position at printed name line in OWNER section (below signature, adjust if needed)
    anchorUnits: 'pixels',
    anchorCaseSensitive: 'true', // Case-sensitive matching
    value: recipientName || recipientEmail, // Pre-fill with recipient name
    required: 'true',
    locked: 'false',
  });

  // Date signed tab - positioned at the date line (right side column in OWNER section)
  // Anchor to "SIGNATURES" to ensure we only get the date field on the last page
  const dateSigned = docusign.DateSigned.constructFromObject({
    documentId: '1',
    recipientId: '1', // Must match owner signer's recipientId - this restricts tabs to owner signer only
    tabLabel: 'OwnerDate',
    anchorString: 'SIGNATURES',
    anchorXOffset: '360', // Position at date column (200 + 160px right = 360px)
    anchorYOffset: '100', // Position at date line (same vertical position as signature in OWNER section)
    anchorUnits: 'pixels',
    anchorCaseSensitive: 'true', // Case-sensitive matching
    required: 'true',
  });

  // Create tabs for signer
  const tabs = docusign.Tabs.constructFromObject({
    signHereTabs: [signHere],
    dateSignedTabs: [dateSigned],
    textTabs: [textTab],
  });
  signer.tabs = tabs;

  // Create signers array - start with owner signer
  const signers = [signer];

  // Add company signer if provided (signs second with routingOrder '2')
  // Skip if company signer email matches owner email to avoid duplicate recipients error
  if (companySignerEmail && companySignerEmail.toLowerCase() !== recipientEmail.toLowerCase()) {
    const companySigner = docusign.Signer.constructFromObject({
      email: companySignerEmail,
      name: companySignerName || 'Contractor', // Use sender's name (not email)
      recipientId: '2',
      routingOrder: '2', // Signs after owner (routingOrder '1')
    });

    // Create signature tabs for CONTRACTOR section
    // The CONTRACTOR section appears below the OWNER section on the same page
    // Anchor to "SIGNATURES" and position lower (higher Y offset) for CONTRACTOR section
    
    // Signature tab - positioned at the signature line in the CONTRACTOR section
    // Moved 32px up from previous position (314 - 32 = 282)
    const companySignHere = docusign.SignHere.constructFromObject({
      documentId: '1',
      recipientId: '2', // Must match company signer's recipientId
      tabLabel: 'CompanySignature',
      anchorString: 'SIGNATURES',
      anchorXOffset: '0',
      anchorYOffset: '282', // Position for CONTRACTOR section (314 - 32px up = 282px)
      anchorUnits: 'pixels',
      anchorCaseSensitive: 'true',
    });

    // Printed name tab - positioned at the printed name line in CONTRACTOR section
    // Moved 32px up, using sender's name (not email)
    const companyTextTab = docusign.Text.constructFromObject({
      documentId: '1',
      recipientId: '2', // Must match company signer's recipientId
      tabLabel: 'CompanyPrintedName',
      anchorString: 'SIGNATURES',
      anchorXOffset: '0',
      anchorYOffset: '332', // Position at printed name line (364 - 32px up = 332px)
      anchorUnits: 'pixels',
      anchorCaseSensitive: 'true',
      value: companySignerName || 'Contractor', // Pre-fill with sender's name (not email)
      required: 'true',
      locked: 'false',
    });

    // Date signed tab - positioned at the date line (right side column in CONTRACTOR section)
    // Moved 32px up and 160px right
    const companyDateSigned = docusign.DateSigned.constructFromObject({
      documentId: '1',
      recipientId: '2', // Must match company signer's recipientId
      tabLabel: 'CompanyDate',
      anchorString: 'SIGNATURES',
      anchorXOffset: '360', // Position at date column (200 + 160px right = 360px)
      anchorYOffset: '282', // Position at date line (314 - 32px up = 282px)
      anchorUnits: 'pixels',
      anchorCaseSensitive: 'true',
      required: 'true',
    });

    // Create tabs for company signer
    const companyTabs = docusign.Tabs.constructFromObject({
      signHereTabs: [companySignHere],
      dateSignedTabs: [companyDateSigned],
      textTabs: [companyTextTab],
    });
    companySigner.tabs = companyTabs;

    signers.push(companySigner);
  } else if (companySignerEmail && companySignerEmail.toLowerCase() === recipientEmail.toLowerCase()) {
    // Log warning when company signer email matches owner email
    console.warn(`Company signer email (${companySignerEmail}) matches owner email (${recipientEmail}). Skipping company signer to avoid duplicate recipients.`);
  }

  // Create recipients
  const recipients = docusign.Recipients.constructFromObject({
    signers: signers,
  });

  // Add CC recipients if provided
  if (ccEmails.length > 0) {
    const carbonCopies = ccEmails.map((email, index) =>
      docusign.CarbonCopy.constructFromObject({
        email: email,
        name: email,
        recipientId: String(index + 2),
        routingOrder: '2',
      })
    );
    recipients.carbonCopies = carbonCopies;
  }

  // Create envelope definition
  const envelopeDefinition = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: subject,
    emailBlurb: emailBlurb,
    documents: [document],
    recipients: recipients,
    status: 'sent', // Send immediately
  });

  // Create and send envelope
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  
  try {
    const envelope = await envelopesApi.createEnvelope(accountId, {
      envelopeDefinition: envelopeDefinition,
    });

    return envelope.envelopeId;
  } catch (error) {
    console.error('Error creating envelope:', error);
    console.error('Account ID used:', accountId);
    console.error('Base URL:', baseUrl);
    
    // Provide more helpful error message
    if (error.status === 404) {
      throw new Error(`Envelope creation failed (404). Please verify:\n1. Account ID is correct: ${accountId}\n2. The account belongs to the user specified in DOCUSIGN_USER_ID\n3. The account is in the correct environment (demo vs production)`);
    }
    
    throw error;
  }
}

/**
 * Add company signer to an existing envelope
 * This is called after the owner has signed, to add the company signer
 * @param {string} envelopeId - DocuSign envelope ID
 * @param {string} companySignerEmail - Company signer email address
 * @param {string} companyName - Company name
 * @returns {Promise<void>}
 */
export async function addCompanySignerToEnvelope(envelopeId, companySignerEmail, companyName) {
  const accessToken = await getAccessToken();
  
  // Get account details (ID and base URL)
  const accountDetails = await getAccountDetails();
  const accountId = accountDetails.accountId;
  const baseUrl = accountDetails.baseUrl;
  
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(baseUrl);
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  // Create company signer (recipientId '2', routingOrder '2' - signs after owner)
  const companySigner = docusign.Signer.constructFromObject({
    email: companySignerEmail,
    name: companyName || companySignerEmail,
    recipientId: '2',
    routingOrder: '2',
  });

  // Create signature tabs for CONTRACTOR section
  // The CONTRACTOR section appears below the OWNER section on the same page
  // Anchor to "SIGNATURES" and position lower (higher Y offset) for CONTRACTOR section
  
  // Signature tab - positioned at the signature line in the CONTRACTOR section
  const companySignHere = docusign.SignHere.constructFromObject({
    documentId: '1',
    recipientId: '2', // Must match company signer's recipientId
    tabLabel: 'CompanySignature',
    anchorString: 'SIGNATURES',
    anchorXOffset: '0',
    anchorYOffset: '250', // Position lower for CONTRACTOR section (below OWNER section, adjust if needed)
    anchorUnits: 'pixels',
    anchorCaseSensitive: 'true',
  });

  // Printed name tab - positioned at the printed name line in CONTRACTOR section
  const companyTextTab = docusign.Text.constructFromObject({
    documentId: '1',
    recipientId: '2', // Must match company signer's recipientId
    tabLabel: 'CompanyPrintedName',
    anchorString: 'SIGNATURES',
    anchorXOffset: '0',
    anchorYOffset: '300', // Position at printed name line in CONTRACTOR section (adjust if needed)
    anchorUnits: 'pixels',
    anchorCaseSensitive: 'true',
    value: companyName || companySignerEmail, // Pre-fill with company name
    required: 'true',
    locked: 'false',
  });

  // Date signed tab - positioned at the date line (right side column in CONTRACTOR section)
  const companyDateSigned = docusign.DateSigned.constructFromObject({
    documentId: '1',
    recipientId: '2', // Must match company signer's recipientId
    tabLabel: 'CompanyDate',
    anchorString: 'SIGNATURES',
    anchorXOffset: '200', // Position at date column (right side of CONTRACTOR section, adjust if needed)
    anchorYOffset: '250', // Position at date line (same vertical position as signature in CONTRACTOR section)
    anchorUnits: 'pixels',
    anchorCaseSensitive: 'true',
    required: 'true',
  });

  // Create tabs for company signer
  const companyTabs = docusign.Tabs.constructFromObject({
    signHereTabs: [companySignHere],
    dateSignedTabs: [companyDateSigned],
    textTabs: [companyTextTab],
  });
  companySigner.tabs = companyTabs;

  // Create recipients object with the new company signer
  const recipients = docusign.Recipients.constructFromObject({
    signers: [companySigner],
  });

  // Create envelope update object
  const envelope = docusign.Envelope.constructFromObject({
    recipients: recipients,
  });

  try {
    // Update the envelope to add the company signer
    await envelopesApi.updateRecipients(accountId, envelopeId, {
      recipients: recipients,
    });

    console.log(`Company signer added to envelope ${envelopeId}`);
  } catch (error) {
    console.error('Error adding company signer to envelope:', error);
    console.error('Account ID used:', accountId);
    console.error('Base URL:', baseUrl);
    throw error;
  }
}

/**
 * Get envelope status
 * @param {string} envelopeId - DocuSign envelope ID
 * @returns {Promise<Object>} Envelope status information
 */
export async function getEnvelopeStatus(envelopeId) {
  const accessToken = await getAccessToken();
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(API_BASE_URL);
  apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const envelope = await envelopesApi.getEnvelope(ACCOUNT_ID, envelopeId);

  return {
    status: envelope.status,
    statusDateTime: envelope.statusDateTime,
    completedDateTime: envelope.completedDateTime,
  };
}