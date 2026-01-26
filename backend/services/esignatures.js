import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { DocumentApi, DocumentSigner, FormField, Rectangle, SendForSign } from 'boldsign';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (two levels up from backend/services/)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// BoldSign configuration
const API_KEY = process.env.BOLDSIGN_API_KEY;
const API_BASE_URL = 'https://api.boldsign.com/v1';
const WEBHOOK_URL = process.env.BOLDSIGN_WEBHOOK_URL;

// Debug: Log which env vars are loaded (without showing sensitive values)
if (!API_KEY) {
  console.warn('⚠️  BoldSign environment variables missing:');
  console.warn('   BOLDSIGN_API_KEY:', API_KEY ? '✓ Set' : '✗ Missing');
  console.warn('   BOLDSIGN_WEBHOOK_URL:', WEBHOOK_URL || '(not set - configure in BoldSign dashboard)');
}

/**
 * Download a file from a URL and return it as a Buffer
 * @param {string} url - URL to download from
 * @returns {Promise<Buffer>} File buffer
 */
async function downloadFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Count the number of pages in a PDF
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<number>} Number of pages
 */
async function countPdfPages(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    return 1; // Default to 1 if we can't count
  }
}

/**
 * Send a contract for electronic signature via BoldSign
 * 
 * @param {Object} options - Contract options
 * @param {string} options.documentUrl - URL to the PDF document
 * @param {string} options.documentName - Name of the document
 * @param {string} options.recipientEmail - Owner/customer email (first signer)
 * @param {string} options.recipientName - Owner/customer name
 * @param {string} options.subject - Email subject line
 * @param {string} options.message - Email message body
 * @param {string} options.companySignerEmail - Company signer email (second signer, optional)
 * @param {string} options.companySignerName - Company signer name (optional)
 * @param {string} options.companyName - Company name for branding (optional)
 * @param {string} options.companyLogoUrl - Company logo URL for branding (optional)
 * @returns {Promise<Object>} Contract response with ID and status
 */
export async function sendContractForSignature({
  documentUrl,
  documentName,
  recipientEmail,
  recipientName,
  subject,
  message,
  companySignerEmail = null,
  companySignerName = null,
  companyName = null,
  companyLogoUrl = null,
}) {
  if (!API_KEY) {
    throw new Error('BoldSign API key not configured. Please set BOLDSIGN_API_KEY in your .env file.');
  }

  // Initialize the BoldSign API client
  const documentApi = new DocumentApi();
  documentApi.setApiKey(API_KEY);

  // Download the PDF
  const documentBuffer = await downloadFile(documentUrl);
  const fileName = documentName.endsWith('.pdf') ? documentName : `${documentName}.pdf`;

  // Count pages to place signatures on the LAST page
  const pageCount = await countPdfPages(documentBuffer);
  const lastPage = pageCount; // BoldSign uses 1-indexed page numbers
  

  // Write buffer to a temp file (BoldSign SDK requires a file stream)
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `boldsign_${Date.now()}_${fileName}`);
  fs.writeFileSync(tempFilePath, documentBuffer);

  try {
    // Create form fields for OWNER signature section
    const ownerSignatureBounds = new Rectangle();
    ownerSignatureBounds.x = 50;      // +10 right
    ownerSignatureBounds.y = 290;
    ownerSignatureBounds.width = 280;
    ownerSignatureBounds.height = 28;

    const ownerSignatureField = new FormField();
    ownerSignatureField.id = 'owner_signature';
    ownerSignatureField.fieldType = FormField.FieldTypeEnum.Signature;
    ownerSignatureField.pageNumber = lastPage;
    ownerSignatureField.isRequired = true;
    ownerSignatureField.bounds = ownerSignatureBounds;

    // OWNER Printed Name field
    const ownerNameBounds = new Rectangle();
    ownerNameBounds.x = 50;           // +10 right
    ownerNameBounds.y = 370;          // +10 down for printed name
    ownerNameBounds.width = 280;
    ownerNameBounds.height = 22;

    const ownerNameField = new FormField();
    ownerNameField.id = 'owner_name';
    ownerNameField.fieldType = FormField.FieldTypeEnum.TextBox;
    ownerNameField.pageNumber = lastPage;
    ownerNameField.isRequired = true;
    ownerNameField.bounds = ownerNameBounds;
    ownerNameField.placeHolder = 'Printed Name';

    // OWNER Date field
    const ownerDateBounds = new Rectangle();
    ownerDateBounds.x = 475;          // +10 right
    ownerDateBounds.y = 290;
    ownerDateBounds.width = 140;
    ownerDateBounds.height = 22;

    const ownerDateField = new FormField();
    ownerDateField.id = 'owner_date';
    ownerDateField.fieldType = FormField.FieldTypeEnum.DateSigned;
    ownerDateField.pageNumber = lastPage;
    ownerDateField.isRequired = false;
    ownerDateField.bounds = ownerDateBounds;
    ownerDateField.dateFormat = 'MM/dd/yyyy';

    // Create OWNER signer
    const ownerSigner = new DocumentSigner();
    ownerSigner.name = recipientName || recipientEmail;
    ownerSigner.emailAddress = recipientEmail;
    ownerSigner.signerOrder = 1;
    ownerSigner.signerType = DocumentSigner.SignerTypeEnum.Signer;
    ownerSigner.formFields = [ownerSignatureField, ownerNameField, ownerDateField];

    const signers = [ownerSigner];

    // Create CONTRACTOR signer if different from owner
    if (companySignerEmail && companySignerEmail.toLowerCase() !== recipientEmail.toLowerCase()) {
      // CONTRACTOR Signature field
      const contractorSignatureBounds = new Rectangle();
      contractorSignatureBounds.x = 50;      // +10 right
      contractorSignatureBounds.y = 534;     // +72 down
      contractorSignatureBounds.width = 280;
      contractorSignatureBounds.height = 28;

      const contractorSignatureField = new FormField();
      contractorSignatureField.id = 'contractor_signature';
      contractorSignatureField.fieldType = FormField.FieldTypeEnum.Signature;
      contractorSignatureField.pageNumber = lastPage;
      contractorSignatureField.isRequired = true;
      contractorSignatureField.bounds = contractorSignatureBounds;

      // CONTRACTOR Printed Name field
      const contractorNameBounds = new Rectangle();
      contractorNameBounds.x = 50;           // +10 right
      contractorNameBounds.y = 614;          // +72 down + 10 for printed name
      contractorNameBounds.width = 280;
      contractorNameBounds.height = 22;

      const contractorNameField = new FormField();
      contractorNameField.id = 'contractor_name';
      contractorNameField.fieldType = FormField.FieldTypeEnum.TextBox;
      contractorNameField.pageNumber = lastPage;
      contractorNameField.isRequired = true;
      contractorNameField.bounds = contractorNameBounds;
      contractorNameField.placeHolder = 'Printed Name';

      // CONTRACTOR Date field
      const contractorDateBounds = new Rectangle();
      contractorDateBounds.x = 475;          // +10 right
      contractorDateBounds.y = 534;          // +72 down
      contractorDateBounds.width = 140;
      contractorDateBounds.height = 22;

      const contractorDateField = new FormField();
      contractorDateField.id = 'contractor_date';
      contractorDateField.fieldType = FormField.FieldTypeEnum.DateSigned;
      contractorDateField.pageNumber = lastPage;
      contractorDateField.isRequired = false;
      contractorDateField.bounds = contractorDateBounds;
      contractorDateField.dateFormat = 'MM/dd/yyyy';

      // Create CONTRACTOR signer
      const contractorSigner = new DocumentSigner();
      contractorSigner.name = companySignerName || companySignerEmail;
      contractorSigner.emailAddress = companySignerEmail;
      contractorSigner.signerOrder = 2;
      contractorSigner.signerType = DocumentSigner.SignerTypeEnum.Signer;
      contractorSigner.formFields = [contractorSignatureField, contractorNameField, contractorDateField];

      signers.push(contractorSigner);
    }

    // Create the send request
    const sendForSign = new SendForSign();
    sendForSign.title = subject || documentName;
    sendForSign.message = message || 'Please review and sign this document.';
    sendForSign.signers = signers;
    sendForSign.files = [fs.createReadStream(tempFilePath)];
    sendForSign.enableSigningOrder = true;

    // Send the document
    const response = await documentApi.sendDocument(sendForSign);


    return {
      contractId: response.documentId,
      status: 'sent',
      signers: signers.map(s => ({ email: s.emailAddress, name: s.name })),
    };
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (e) {
      console.warn('Failed to clean up temp file:', e.message);
    }
  }
}

/**
 * Get document status from BoldSign
 * 
 * @param {string} documentId - The document ID
 * @returns {Promise<Object>} Document status information
 */
export async function getContractStatus(documentId) {
  if (!API_KEY) {
    throw new Error('BoldSign API key not configured.');
  }

  const documentApi = new DocumentApi();
  documentApi.setApiKey(API_KEY);

  const response = await documentApi.getProperties(documentId);

  return {
    status: mapBoldSignStatus(response.status),
    signers: response.signerDetails,
  };
}

/**
 * Map BoldSign status to internal status
 * 
 * @param {string} boldSignStatus - The BoldSign status
 * @returns {string} Internal status
 */
function mapBoldSignStatus(boldSignStatus) {
  const statusMap = {
    'Draft': 'draft',
    'Sent': 'sent',
    'InProgress': 'sent',
    'Completed': 'completed',
    'Declined': 'declined',
    'Expired': 'voided',
    'Revoked': 'voided',
  };

  return statusMap[boldSignStatus] || 'sent';
}

/**
 * Map BoldSign webhook event to internal status
 * 
 * @param {string} event - The webhook event type
 * @param {Object} data - The webhook data
 * @returns {string|null} Internal status or null if not mapped
 */
export function mapWebhookEventToStatus(event, data = {}) {
  // BoldSign webhook events - handle various formats
  const eventMap = {
    // PascalCase
    'Sent': 'sent',
    'Viewed': 'delivered',
    'Signed': 'signed',
    'Completed': 'completed',
    'Declined': 'declined',
    'Expired': 'voided',
    'Revoked': 'voided',
    'Reassigned': 'sent',
    // BoldSign actual event types (camelCase with prefix)
    'DocumentSent': 'sent',
    'DocumentViewed': 'delivered',
    'DocumentSigned': 'signed',
    'DocumentCompleted': 'completed',
    'DocumentDeclined': 'declined',
    'DocumentExpired': 'voided',
    'DocumentRevoked': 'voided',
    'SignerCompleted': 'signed',
    // Skip verification events
    'Verification': null,
  };

  // Handle different event formats
  const eventType = event || data.event?.eventType || data.eventType || data.Event;
  
  return eventMap[eventType] || null;
}

/**
 * Download the signed document from BoldSign
 * 
 * @param {string} documentId - The document ID
 * @returns {Promise<Buffer>} The signed PDF as a buffer
 */
export async function downloadSignedDocument(documentId) {
  if (!API_KEY) {
    throw new Error('BoldSign API key not configured.');
  }

  // BoldSign download endpoint
  const downloadUrl = `${API_BASE_URL}/document/download?documentId=${documentId}`;
  
  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: {
      'X-API-KEY': API_KEY,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download signed document: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export default {
  sendContractForSignature,
  getContractStatus,
  mapWebhookEventToStatus,
  downloadSignedDocument,
};
