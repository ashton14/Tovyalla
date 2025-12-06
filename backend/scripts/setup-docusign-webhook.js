/**
 * Script to set up DocuSign Connect (webhook) configuration via API
 * 
 * Run this script after setting up your DocuSign credentials:
 * node backend/scripts/setup-docusign-webhook.js
 */

import * as docusignService from '../services/docusign.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const WEBHOOK_URL = process.env.DOCUSIGN_WEBHOOK_URL || 'https://your-domain.com/api/docusign/webhook';
const ACCOUNT_ID = process.env.DOCUSIGN_ACCOUNT_ID;

async function setupWebhook() {
  try {
    console.log('Setting up DocuSign Connect webhook...');
    console.log('Webhook URL:', WEBHOOK_URL);
    console.log('Account ID:', ACCOUNT_ID);

    if (!ACCOUNT_ID) {
      throw new Error('DOCUSIGN_ACCOUNT_ID not set in .env');
    }

    if (WEBHOOK_URL.includes('your-domain.com')) {
      console.warn('\n⚠️  WARNING: Please update DOCUSIGN_WEBHOOK_URL in .env with your actual domain!');
      console.warn('   For local testing, use ngrok: https://ngrok.com/\n');
    }

    const accessToken = await docusignService.getAccessToken();
    const apiClient = new (await import('docusign-esign')).default.ApiClient();
    apiClient.setBasePath(process.env.DOCUSIGN_API_BASE_URL || 'https://demo.docusign.net/restapi');
    apiClient.addDefaultHeader('Authorization', `Bearer ${accessToken}`);

    const connectApi = new (await import('docusign-esign')).default.ConnectApi(apiClient);

    // Create Connect configuration
    const connectConfig = {
      name: 'Tovyalla CRM Webhook',
      url: WEBHOOK_URL,
      enabled: 'true',
      requireAcknowledgement: 'true',
      signMessageWithX509Cert: 'false',
      includeDocuments: 'false',
      includeEnvelopeVoidReason: 'true',
      includeTimeZoneInformation: 'true',
      includeSenderAccountasCustomField: 'false',
      allUsers: 'true', // Apply to all users in account
      envelopeEvents: [
        { envelopeEventStatusCode: 'sent' },
        { envelopeEventStatusCode: 'delivered' },
        { envelopeEventStatusCode: 'completed' },
        { envelopeEventStatusCode: 'declined' },
        { envelopeEventStatusCode: 'voided' },
      ],
    };

    // Check if configuration already exists
    const existingConfigs = await connectApi.listConfigurations(ACCOUNT_ID);
    const existing = existingConfigs.configurations?.find(
      (config) => config.url === WEBHOOK_URL
    );

    if (existing) {
      console.log('Updating existing webhook configuration...');
      const result = await connectApi.updateConfiguration(ACCOUNT_ID, existing.connectId, {
        connectConfigInformation: connectConfig,
      });
      console.log('✅ Webhook configuration updated successfully!');
      console.log('   Connect ID:', existing.connectId);
    } else {
      console.log('Creating new webhook configuration...');
      const result = await connectApi.createConfiguration(ACCOUNT_ID, {
        connectConfigInformation: connectConfig,
      });
      console.log('✅ Webhook configuration created successfully!');
      console.log('   Connect ID:', result.connectId);
    }

    console.log('\n📋 Webhook Events Configured:');
    console.log('   - Envelope Sent');
    console.log('   - Envelope Delivered');
    console.log('   - Envelope Completed');
    console.log('   - Envelope Declined');
    console.log('   - Envelope Voided');
    console.log('\n✅ Setup complete!');
  } catch (error) {
    console.error('❌ Error setting up webhook:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.body, null, 2));
    }
    process.exit(1);
  }
}

setupWebhook();
