import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as docusignService from './services/docusign.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (one level up from backend/)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not found in .env file');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tovyalla CRM API is running' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { companyID, username, password } = req.body;

    if (!companyID || !username || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyID, username, and password are required' 
      });
    }

    // Attempt to sign in with Supabase Auth
    // Note: Supabase Auth uses email by default, so username should be an email
    // If you want to use a custom username, you'll need to store it in user_metadata
    const { data, error } = await supabase.auth.signInWithPassword({
      email: username, // Assuming username is email
      password: password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Verify companyID matches user metadata
    const userCompanyID = data.user?.user_metadata?.companyID;
    if (userCompanyID !== companyID) {
      return res.status(403).json({ error: 'Invalid company ID' });
    }

    // Update employee last_logon timestamp (handled by separate endpoint called from frontend)

    res.json({
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register endpoint - checks whitelist before allowing registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { companyID, email, password } = req.body;

    if (!companyID || !email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyID, email, and password are required' 
      });
    }

    // Check if this company ID exists in the whitelist at all
    const { data: companyWhitelist, error: companyCheckError } = await supabase
      .from('company_whitelist')
      .select('*')
      .eq('company_id', companyID);

    // If company doesn't exist in whitelist, allow first user to register
    // This creates the company and adds them as the first user
    if (!companyCheckError && (!companyWhitelist || companyWhitelist.length === 0)) {
      // Company doesn't exist yet - allow registration and create whitelist entry
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            companyID: companyID,
          },
        },
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Create whitelist entry for this first user
      await supabase
        .from('company_whitelist')
        .insert([
          {
            company_id: companyID,
            email: email.toLowerCase(),
            registered: true,
            registered_at: new Date().toISOString(),
          },
        ]);

      res.json({
        user: data.user,
        session: data.session,
      });
      return;
    }

    // Company exists - check if email is whitelisted
    const { data: whitelistData, error: whitelistError } = await supabase
      .from('company_whitelist')
      .select('*')
      .eq('company_id', companyID)
      .eq('email', email.toLowerCase())
      .single();

    if (whitelistError || !whitelistData) {
      return res.status(403).json({ 
        error: 'This email is not authorized to register with this Company ID. Please contact your company administrator to add your email to the whitelist.' 
      });
    }

    // Email is whitelisted - proceed with registration
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          companyID: companyID,
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Mark whitelist entry as used
    await supabase
      .from('company_whitelist')
      .update({ registered: true, registered_at: new Date().toISOString() })
      .eq('company_id', companyID)
      .eq('email', email.toLowerCase());

    res.json({
      user: data.user,
      session: data.session,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update last logon timestamp
app.post('/api/auth/update-last-logon', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const userEmail = user.email;
    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    const currentTimestamp = new Date().toISOString();

    const { data: updateResult, error: updateError } = await supabase
      .from('employees')
      .update({ last_logon: currentTimestamp })
      .eq('email_address', userEmail.toLowerCase())
      .eq('company_id', companyID)
      .select('id, name, email_address, last_logon');

    if (updateError) {
      console.error('Error updating last_logon:', updateError);
      return res.status(500).json({ error: 'Failed to update last logon' });
    }

    if (!updateResult || updateResult.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ success: true, employee: updateResult[0] });
  } catch (error) {
    console.error('Error updating last_logon:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected route example
app.get('/api/user', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ user });
  } catch (error) {
    console.error('User fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get whitelist for a company
app.get('/api/whitelist', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('company_whitelist')
      .select('*')
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ whitelist: data || [] });
  } catch (error) {
    console.error('Get whitelist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add email to whitelist
app.post('/api/whitelist', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists in whitelist
    const { data: existing, error: checkError } = await supabase
      .from('company_whitelist')
      .select('*')
      .eq('company_id', companyID)
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Email is already in the whitelist' });
    }

    // Add to whitelist
    const { data, error } = await supabase
      .from('company_whitelist')
      .insert([
        {
          company_id: companyID,
          email: email.toLowerCase(),
          added_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ whitelistEntry: data });
  } catch (error) {
    console.error('Add to whitelist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Remove email from whitelist
app.delete('/api/whitelist/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify the whitelist entry belongs to the user's company
    const { data: entry, error: checkError } = await supabase
      .from('company_whitelist')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !entry) {
      return res.status(404).json({ error: 'Whitelist entry not found' });
    }

    // Delete the entry
    const { error } = await supabase
      .from('company_whitelist')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Remove from whitelist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== COMPANY INFO ENDPOINTS ==========

// Get company information
app.get('/api/company', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyID)
      .single();

    if (companyError && companyError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, we'll create it
      return res.status(500).json({ error: companyError.message });
    }

    // If company doesn't exist, return empty object
    res.json({ company: company || null });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update company information
app.put('/api/company', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const {
      company_name,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      phone,
      email,
      website,
      license_numbers,
      terms_of_service,
    } = req.body;

    // Check if company exists
    const { data: existing, error: checkError } = await supabase
      .from('companies')
      .select('company_id')
      .eq('company_id', companyID)
      .single();

    let result;
    if (checkError && checkError.code === 'PGRST116') {
      // Company doesn't exist, create it
      const { data, error } = await supabase
        .from('companies')
        .insert([
          {
            company_id: companyID,
            company_name: company_name || null,
            address_line1: address_line1 || null,
            address_line2: address_line2 || null,
            city: city || null,
            state: state || null,
            zip_code: zip_code || null,
            country: country || 'USA',
            phone: phone || null,
            email: email || null,
            website: website || null,
            license_numbers: license_numbers || [],
            terms_of_service: terms_of_service || null,
          },
        ])
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      result = data;
    } else {
      // Company exists, update it
      const { data, error } = await supabase
        .from('companies')
        .update({
          company_name: company_name || null,
          address_line1: address_line1 || null,
          address_line2: address_line2 || null,
          city: city || null,
          state: state || null,
          zip_code: zip_code || null,
          country: country || 'USA',
          phone: phone || null,
          email: email || null,
          website: website || null,
          license_numbers: license_numbers !== undefined ? license_numbers : undefined,
          terms_of_service: terms_of_service !== undefined ? terms_of_service : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyID)
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      result = data;
    }

    res.json({ company: result });
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload company logo
app.post('/api/company/logo', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { file_data, file_name, content_type } = req.body;

    if (!file_data || !file_name || !content_type) {
      return res.status(400).json({ error: 'file_data, file_name, and content_type are required' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(content_type)) {
      return res.status(400).json({ error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, SVG' });
    }

    // Convert base64 to buffer
    const base64Data = file_data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique file path
    const fileExt = file_name.split('.').pop();
    const filePath = `logos/${companyID}/logo_${Date.now()}.${fileExt}`;

    // Delete old logo if exists
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('logo_url')
      .eq('company_id', companyID)
      .single();

    if (existingCompany?.logo_url) {
      // Extract old file path from URL and delete it
      const oldPath = existingCompany.logo_url.split('/company-logos/')[1];
      if (oldPath) {
        await supabase.storage.from('company-logos').remove([oldPath]);
      }
    }

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(filePath, buffer, {
        contentType: content_type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload logo: ' + uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('company-logos')
      .getPublicUrl(filePath);

    const logoUrl = urlData.publicUrl;

    // Update company with logo URL
    const { data: company, error: updateError } = await supabase
      .from('companies')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyID)
      .select()
      .single();

    if (updateError) {
      // If company doesn't exist, create it
      if (updateError.code === 'PGRST116') {
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert([{
            company_id: companyID,
            logo_url: logoUrl,
          }])
          .select()
          .single();

        if (insertError) {
          return res.status(500).json({ error: insertError.message });
        }

        return res.json({ company: newCompany, logo_url: logoUrl });
      }
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ company, logo_url: logoUrl });
  } catch (error) {
    console.error('Upload logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete company logo
app.delete('/api/company/logo', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    // Get current logo URL
    const { data: company } = await supabase
      .from('companies')
      .select('logo_url')
      .eq('company_id', companyID)
      .single();

    if (company?.logo_url) {
      // Extract file path from URL and delete it
      const filePath = company.logo_url.split('/company-logos/')[1];
      if (filePath) {
        await supabase.storage.from('company-logos').remove([filePath]);
      }
    }

    // Update company to remove logo URL
    const { data: updatedCompany, error: updateError } = await supabase
      .from('companies')
      .update({
        logo_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyID)
      .select()
      .single();

    if (updateError && updateError.code !== 'PGRST116') {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ success: true, company: updatedCompany });
  } catch (error) {
    console.error('Delete logo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all customers for a company
app.get('/api/customers', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ customers: data || [] });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single customer
app.get('/api/customers/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer: data });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new customer
app.post('/api/customers', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const {
      first_name,
      last_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      referred_by,
      pipeline_status,
      notes,
      estimated_value,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    const initialStatus = pipeline_status || 'lead';

    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          company_id: companyID,
          first_name,
          last_name,
          email: email || null,
          phone: phone || null,
          address_line1: address_line1 || null,
          address_line2: address_line2 || null,
          city: city || null,
          state: state || null,
          zip_code: zip_code || null,
          country: country || 'USA',
          referred_by: referred_by || null,
          pipeline_status: initialStatus,
          notes: notes || null,
          estimated_value: estimated_value || null,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Track initial status
    await supabase
      .from('customer_status_history')
      .insert({
        customer_id: data.id,
        company_id: companyID,
        status: initialStatus,
        changed_at: new Date().toISOString(),
      });

    res.json({ customer: data });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      country,
      referred_by,
      pipeline_status,
      notes,
      estimated_value,
    } = req.body;

    // Verify customer belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const newStatus = pipeline_status || 'lead';
    const statusChanged = existing.pipeline_status !== newStatus;

    const { data, error } = await supabase
      .from('customers')
      .update({
        first_name,
        last_name,
        email: email || null,
        phone: phone || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        state: state || null,
        zip_code: zip_code || null,
        country: country || 'USA',
        referred_by: referred_by || null,
        pipeline_status: newStatus,
        notes: notes || null,
        estimated_value: estimated_value || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Track status change if status changed
    if (statusChanged) {
      await supabase
        .from('customer_status_history')
        .upsert({
          customer_id: id,
          company_id: companyID,
          status: newStatus,
          changed_at: new Date().toISOString(),
        }, {
          onConflict: 'customer_id,status',
          ignoreDuplicates: false,
        });
    }

    res.json({ customer: data });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify customer belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all projects for a company
app.get('/api/projects', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        customers:customer_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('company_id', companyID)
      .order('updated_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ projects: data || [] });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get project statistics (total est_value and profit) with date filtering
// IMPORTANT: This must be BEFORE /api/projects/:id route
app.get('/api/projects/statistics', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { period = 'total' } = req.query; // day, week, month, 6mo, year, total

    // Calculate date range based on period
    let startDate = null;
    if (period !== 'total') {
      const now = new Date();
      switch (period) {
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '6mo':
          startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          break;
        case 'year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Get projects marked as sold or complete from status history
    let soldQuery = supabase
      .from('project_status_history')
      .select('project_id, projects!inner(est_value)')
      .eq('company_id', companyID)
      .eq('status', 'sold');

    let completeQuery = supabase
      .from('project_status_history')
      .select('project_id, projects!inner(est_value)')
      .eq('company_id', companyID)
      .eq('status', 'complete');

    if (startDate) {
      soldQuery = soldQuery.gte('changed_at', startDate.toISOString());
      completeQuery = completeQuery.gte('changed_at', startDate.toISOString());
    }

    const [{ data: soldHistory }, { data: completeHistory }] = await Promise.all([
      soldQuery,
      completeQuery,
    ]);

    // Combine sold and complete, avoiding duplicates
    const processedProjectIds = new Set();
    const allProjects = [
      ...(soldHistory || []),
      ...(completeHistory || []),
    ];

    if (allProjects.length === 0) {
      return res.json({
        totalEstValue: 0,
        totalProfit: 0,
        totalExpenses: 0,
        projectCount: 0,
        period: period,
      });
    }

    // Calculate value and expenses for sold/complete projects
    let totalEstValue = 0;
    let totalExpenses = 0;
    let projectCount = 0;

    for (const record of allProjects) {
      // Skip duplicates
      if (processedProjectIds.has(record.project_id)) continue;
      processedProjectIds.add(record.project_id);

      const estValue = parseFloat(record.projects?.est_value || 0);
      totalEstValue += estValue;
      projectCount++;

      // Get expenses for this project
      const { data: subcontractorFees } = await supabase
        .from('project_subcontractor_fees')
        .select('flat_fee')
        .eq('project_id', record.project_id);

      const { data: materials } = await supabase
        .from('project_materials')
        .select('quantity, unit_cost')
        .eq('project_id', record.project_id);

      const { data: additionalExpenses } = await supabase
        .from('project_additional_expenses')
        .select('amount')
        .eq('project_id', record.project_id);

      // Calculate subcontractor costs
      let subcontractorTotal = 0;
      if (subcontractorFees) {
        subcontractorFees.forEach((entry) => {
          subcontractorTotal += parseFloat(entry.flat_fee || 0);
        });
      }

      // Calculate materials costs
      let materialsTotal = 0;
      if (materials) {
        materials.forEach((entry) => {
          materialsTotal += parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0);
        });
      }

      // Calculate additional expenses
      let additionalTotal = 0;
      if (additionalExpenses) {
        additionalExpenses.forEach((entry) => {
          additionalTotal += parseFloat(entry.amount || 0);
        });
      }

      totalExpenses += subcontractorTotal + materialsTotal + additionalTotal;
    }

    const totalProfit = totalEstValue - totalExpenses;

    res.json({
      totalEstValue: totalEstValue,
      totalProfit: totalProfit,
      totalExpenses: totalExpenses,
      projectCount: projectCount,
      period: period,
    });
  } catch (error) {
    console.error('Get project statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get monthly statistics for dashboard chart
app.get('/api/projects/monthly-statistics', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { year = new Date().getFullYear() } = req.query;
    const yearNum = parseInt(year);

    // Initialize monthly data
    const monthlyData = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(yearNum, month, 1);
      const endDate = new Date(yearNum, month + 1, 0, 23, 59, 59);

      // Get projects that were marked as SOLD in this month (from status history)
      const { data: soldHistory } = await supabase
        .from('project_status_history')
        .select('project_id, projects!inner(est_value)')
        .eq('company_id', companyID)
        .eq('status', 'sold')
        .gte('changed_at', startDate.toISOString())
        .lte('changed_at', endDate.toISOString());

      // Get projects that were marked as COMPLETE in this month (from status history)
      const { data: completedHistory } = await supabase
        .from('project_status_history')
        .select('project_id, projects!inner(est_value)')
        .eq('company_id', companyID)
        .eq('status', 'complete')
        .gte('changed_at', startDate.toISOString())
        .lte('changed_at', endDate.toISOString());

      // Get customers who became leads in this month (from status history)
      const { data: leadsHistory } = await supabase
        .from('customer_status_history')
        .select('customer_id')
        .eq('company_id', companyID)
        .eq('status', 'lead')
        .gte('changed_at', startDate.toISOString())
        .lte('changed_at', endDate.toISOString());

      // Get customers who signed in this month (from status history)
      const { data: signedHistory } = await supabase
        .from('customer_status_history')
        .select('customer_id')
        .eq('company_id', companyID)
        .eq('status', 'signed')
        .gte('changed_at', startDate.toISOString())
        .lte('changed_at', endDate.toISOString());

      // Get total customers created in this month
      const { data: totalCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', companyID)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      // Calculate value and profit from SOLD or COMPLETE projects in this month
      let monthValue = 0;
      let monthExpenses = 0;
      const soldCount = soldHistory?.length || 0;
      const completedCount = completedHistory?.length || 0;

      // Combine sold and complete projects, avoiding duplicates
      const processedProjectIds = new Set();
      const allProfitProjects = [
        ...(soldHistory || []),
        ...(completedHistory || []),
      ];

      // Calculate value and expenses from projects sold or completed this month
      for (const record of allProfitProjects) {
        // Skip if we've already processed this project (could be in both sold and complete)
        if (processedProjectIds.has(record.project_id)) continue;
        processedProjectIds.add(record.project_id);

        const estValue = parseFloat(record.projects?.est_value || 0);
        monthValue += estValue;

        // Get expenses for this project
        const { data: subcontractorFees } = await supabase
          .from('project_subcontractor_fees')
          .select('flat_fee')
          .eq('project_id', record.project_id);

        const { data: materials } = await supabase
          .from('project_materials')
          .select('quantity, unit_cost')
          .eq('project_id', record.project_id);

        const { data: additionalExpenses } = await supabase
          .from('project_additional_expenses')
          .select('amount')
          .eq('project_id', record.project_id);

        // Calculate subcontractor costs
        if (subcontractorFees) {
          subcontractorFees.forEach((entry) => {
            monthExpenses += parseFloat(entry.flat_fee || 0);
          });
        }

        // Calculate materials costs
        if (materials) {
          materials.forEach((entry) => {
            monthExpenses += parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0);
          });
        }

        // Calculate additional expenses
        if (additionalExpenses) {
          additionalExpenses.forEach((entry) => {
            monthExpenses += parseFloat(entry.amount || 0);
          });
        }
      }

      monthlyData.push({
        month: monthNames[month],
        monthIndex: month + 1,
        value: monthValue,
        profit: monthValue - monthExpenses,
        expenses: monthExpenses,
        leads: leadsHistory?.length || 0,
        customersSigned: signedHistory?.length || 0,
        sold: soldCount,
        totalCustomers: totalCustomers?.length || 0,
        completedProjects: completedCount,
      });
    }

    res.json({
      year: yearNum,
      monthlyData,
    });
  } catch (error) {
    console.error('Get monthly statistics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single project
app.get('/api/projects/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        customers:customer_id (
          id,
          first_name,
          last_name,
          email,
          phone
        )
      `)
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project: data });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new project
app.post('/api/projects', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const {
      customer_id,
      address,
      project_type,
      pool_or_spa,
      sq_feet,
      status,
      accessories_features,
      est_value,
      project_manager,
      notes,
      documents,
    } = req.body;

    if (!project_type || !pool_or_spa) {
      return res.status(400).json({ error: 'Project type and pool/spa selection are required' });
    }

    const initialStatus = status || 'proposal_request';

    const { data, error } = await supabase
      .from('projects')
      .insert([
        {
          company_id: companyID,
          customer_id: customer_id || null,
          address: address || null,
          project_type,
          pool_or_spa,
          sq_feet: sq_feet ? parseFloat(sq_feet) : null,
          status: initialStatus,
          accessories_features: accessories_features || null,
          est_value: est_value ? parseFloat(est_value) : null,
          project_manager: project_manager || null,
          notes: notes || null,
          documents: documents || [],
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Track initial status
    await supabase
      .from('project_status_history')
      .insert({
        project_id: data.id,
        company_id: companyID,
        status: initialStatus,
        changed_at: new Date().toISOString(),
      });

    res.json({ project: data });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a project
app.put('/api/projects/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const {
      customer_id,
      address,
      project_type,
      pool_or_spa,
      sq_feet,
      status,
      accessories_features,
      est_value,
      project_manager,
      notes,
      documents,
    } = req.body;

    // Verify project belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const newStatus = status || 'proposal_request';
    const statusChanged = existing.status !== newStatus;

    const { data, error } = await supabase
      .from('projects')
      .update({
        customer_id: customer_id || null,
        address: address || null,
        project_type,
        pool_or_spa,
        sq_feet: sq_feet ? parseFloat(sq_feet) : null,
        status: newStatus,
        accessories_features: accessories_features || null,
        est_value: est_value ? parseFloat(est_value) : null,
        project_manager: project_manager || null,
        notes: notes || null,
        documents: documents || [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Track status change if status changed
    if (statusChanged) {
      await supabase
        .from('project_status_history')
        .upsert({
          project_id: id,
          company_id: companyID,
          status: newStatus,
          changed_at: new Date().toISOString(),
        }, {
          onConflict: 'project_id,status',
          ignoreDuplicates: false,
        });
    }

    res.json({ project: data });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify project belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== PROJECT EXPENSES ENDPOINTS ==========

// Get all expenses for a project with calculations
app.get('/api/projects/:id/expenses', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, est_value')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get subcontractor fees with subcontractor details
    const { data: subcontractorFees, error: feesError } = await supabase
      .from('project_subcontractor_fees')
      .select(`
        *,
        subcontractors (
          id,
          name
        )
      `)
      .eq('project_id', id)
      .order('date_added', { ascending: false });

    if (feesError) {
      return res.status(500).json({ error: feesError.message });
    }

    // Get materials with inventory details
    const { data: materials, error: materialsError } = await supabase
      .from('project_materials')
      .select(`
        *,
        inventory (
          id,
          name,
          unit
        )
      `)
      .eq('project_id', id)
      .order('date_used', { ascending: false });

    if (materialsError) {
      return res.status(500).json({ error: materialsError.message });
    }

    // Get additional expenses
    const { data: additionalExpenses, error: additionalError } = await supabase
      .from('project_additional_expenses')
      .select('*')
      .eq('project_id', id)
      .order('expense_date', { ascending: false });

    if (additionalError) {
      return res.status(500).json({ error: additionalError.message });
    }

    // Get equipment expenses
    const { data: equipment, error: equipmentError } = await supabase
      .from('project_equipment')
      .select('*')
      .eq('project_id', id)
      .order('date_ordered', { ascending: false });

    if (equipmentError) {
      console.log('Equipment query error (table may not exist yet):', equipmentError.message);
      // Don't fail - table might not exist yet
    }

    // Calculate totals (actual)
    let subcontractorTotal = 0;
    let subcontractorExpected = 0;
    if (subcontractorFees) {
      subcontractorFees.forEach((entry) => {
        subcontractorTotal += parseFloat(entry.flat_fee || 0);
        subcontractorExpected += parseFloat(entry.expected_value || 0);
      });
    }

    let materialsTotal = 0;
    let materialsExpected = 0;
    if (materials) {
      materials.forEach((entry) => {
        materialsTotal += parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0);
        materialsExpected += parseFloat(entry.expected_value || 0);
      });
    }

    let additionalTotal = 0;
    let additionalExpected = 0;
    if (additionalExpenses) {
      additionalExpenses.forEach((entry) => {
        additionalTotal += parseFloat(entry.amount || 0);
        additionalExpected += parseFloat(entry.expected_value || 0);
      });
    }

    let equipmentTotal = 0;
    let equipmentExpected = 0;
    if (equipment) {
      equipment.forEach((entry) => {
        equipmentTotal += parseFloat(entry.actual_price || 0) * parseFloat(entry.quantity || 1);
        equipmentExpected += parseFloat(entry.expected_price || 0) * parseFloat(entry.quantity || 1);
      });
    }

    const totalExpenses = subcontractorTotal + materialsTotal + additionalTotal + equipmentTotal;
    const totalExpected = subcontractorExpected + materialsExpected + additionalExpected + equipmentExpected;
    const estValue = parseFloat(project.est_value || 0);
    const profit = estValue - totalExpenses;
    const expectedProfit = estValue - totalExpected;

    res.json({
      subcontractorFees: subcontractorFees || [],
      materials: materials || [],
      additionalExpenses: additionalExpenses || [],
      equipment: equipment || [],
      totals: {
        subcontractors: subcontractorTotal,
        subcontractorsExpected: subcontractorExpected,
        materials: materialsTotal,
        materialsExpected: materialsExpected,
        additional: additionalTotal,
        additionalExpected: additionalExpected,
        equipment: equipmentTotal,
        equipmentExpected: equipmentExpected,
        total: totalExpenses,
        totalExpected: totalExpected,
      },
      project: {
        estValue: estValue,
        profit: profit,
        expectedProfit: expectedProfit,
      },
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add subcontractor fee
app.post('/api/projects/:id/expenses/subcontractor-fees', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { subcontractor_id, flat_fee, expected_value, date_added, status, notes, job_description } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!subcontractor_id || !date_added) {
      return res.status(400).json({ error: 'subcontractor_id and date_added are required' });
    }

    const { customer_price } = req.body;

    const { data, error } = await supabase
      .from('project_subcontractor_fees')
      .insert([{
        project_id: id,
        subcontractor_id,
        flat_fee: flat_fee ? parseFloat(flat_fee) : null,
        expected_value: expected_value ? parseFloat(expected_value) : null,
        customer_price: customer_price ? parseFloat(customer_price) : null,
        date_added,
        status: status || 'incomplete',
        notes: notes || null,
        job_description: job_description || null,
      }])
      .select(`
        *,
        subcontractors (
          id,
          name
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ subcontractorFee: data });
  } catch (error) {
    console.error('Add subcontractor fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Batch update customer prices for subcontractor fees
// NOTE: This route MUST be before the /:feeId route to avoid matching 'batch-update-prices' as a feeId
app.put('/api/projects/:id/expenses/subcontractor-fees/batch-update-prices', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { prices } = req.body; // Array of { id, customer_price }

    if (!prices || !Array.isArray(prices)) {
      return res.status(400).json({ error: 'prices array is required' });
    }

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Update each fee's customer_price
    const updatePromises = prices.map(({ id: feeId, customer_price }) =>
      supabase
        .from('project_subcontractor_fees')
        .update({ 
          customer_price: customer_price ? parseFloat(customer_price) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', feeId)
        .eq('project_id', id)
    );

    await Promise.all(updatePromises);

    res.json({ success: true, message: 'Customer prices updated successfully' });
  } catch (error) {
    console.error('Batch update customer prices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update subcontractor fee
app.put('/api/projects/:id/expenses/subcontractor-fees/:feeId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, feeId } = req.params;
    const { flat_fee, expected_value, date_added, status, notes, job_description, customer_price } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (flat_fee !== undefined) updateData.flat_fee = flat_fee ? parseFloat(flat_fee) : null;
    if (expected_value !== undefined) updateData.expected_value = expected_value ? parseFloat(expected_value) : null;
    if (customer_price !== undefined) updateData.customer_price = customer_price ? parseFloat(customer_price) : null;
    if (date_added !== undefined) updateData.date_added = date_added;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;
    if (job_description !== undefined) updateData.job_description = job_description || null;

    const { data, error } = await supabase
      .from('project_subcontractor_fees')
      .update(updateData)
      .eq('id', feeId)
      .eq('project_id', id)
      .select(`
        *,
        subcontractors (
          id,
          name
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ subcontractorFee: data });
  } catch (error) {
    console.error('Update subcontractor fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete subcontractor fee
app.delete('/api/projects/:id/expenses/subcontractor-fees/:feeId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, feeId } = req.params;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { error } = await supabase
      .from('project_subcontractor_fees')
      .delete()
      .eq('id', feeId)
      .eq('project_id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete subcontractor fee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add material
app.post('/api/projects/:id/expenses/materials', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { inventory_id, quantity, unit_cost, expected_value, date_used, status, notes } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!inventory_id || !date_used) {
      return res.status(400).json({ error: 'inventory_id and date_used are required' });
    }

    const { data, error } = await supabase
      .from('project_materials')
      .insert([{
        project_id: id,
        inventory_id,
        quantity: quantity ? parseFloat(quantity) : null,
        unit_cost: unit_cost ? parseFloat(unit_cost) : null,
        expected_value: expected_value ? parseFloat(expected_value) : null,
        date_used,
        status: status || 'incomplete',
        notes: notes || null,
      }])
      .select(`
        *,
        inventory (
          id,
          name,
          unit
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ material: data });
  } catch (error) {
    console.error('Add material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update material
app.put('/api/projects/:id/expenses/materials/:materialId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, materialId } = req.params;
    const { quantity, unit_cost, expected_value, date_used, status, notes } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (quantity !== undefined) updateData.quantity = quantity ? parseFloat(quantity) : null;
    if (unit_cost !== undefined) updateData.unit_cost = unit_cost ? parseFloat(unit_cost) : null;
    if (expected_value !== undefined) updateData.expected_value = expected_value ? parseFloat(expected_value) : null;
    if (date_used !== undefined) updateData.date_used = date_used;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;

    const { data, error } = await supabase
      .from('project_materials')
      .update(updateData)
      .eq('id', materialId)
      .eq('project_id', id)
      .select(`
        *,
        inventory (
          id,
          name,
          unit
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ material: data });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete material
app.delete('/api/projects/:id/expenses/materials/:materialId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, materialId } = req.params;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { error } = await supabase
      .from('project_materials')
      .delete()
      .eq('id', materialId)
      .eq('project_id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add additional expense
app.post('/api/projects/:id/expenses/additional', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { description, amount, expected_value, expense_date, status, category, notes } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!description || !expense_date) {
      return res.status(400).json({ error: 'description and expense_date are required' });
    }

    const { data, error } = await supabase
      .from('project_additional_expenses')
      .insert([{
        project_id: id,
        description,
        amount: amount ? parseFloat(amount) : null,
        expected_value: expected_value ? parseFloat(expected_value) : null,
        expense_date,
        status: status || 'incomplete',
        category: category || null,
        notes: notes || null,
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ expense: data });
  } catch (error) {
    console.error('Add additional expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update additional expense
app.put('/api/projects/:id/expenses/additional/:expenseId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, expenseId } = req.params;
    const { description, amount, expected_value, expense_date, status, category, notes } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (description !== undefined) updateData.description = description;
    if (amount !== undefined) updateData.amount = amount ? parseFloat(amount) : null;
    if (expected_value !== undefined) updateData.expected_value = expected_value ? parseFloat(expected_value) : null;
    if (expense_date !== undefined) updateData.expense_date = expense_date;
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category || null;
    if (notes !== undefined) updateData.notes = notes || null;

    const { data, error } = await supabase
      .from('project_additional_expenses')
      .update(updateData)
      .eq('id', expenseId)
      .eq('project_id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ expense: data });
  } catch (error) {
    console.error('Update additional expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete additional expense
app.delete('/api/projects/:id/expenses/additional/:expenseId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, expenseId } = req.params;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { error } = await supabase
      .from('project_additional_expenses')
      .delete()
      .eq('id', expenseId)
      .eq('project_id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete additional expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== EQUIPMENT EXPENSE ENDPOINTS ==========

// Add equipment expense
app.post('/api/projects/:id/expenses/equipment', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { name, description, expected_price, actual_price, quantity, date_ordered, date_received, status, vendor, notes } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!name) {
      return res.status(400).json({ error: 'Equipment name is required' });
    }

    const { data, error } = await supabase
      .from('project_equipment')
      .insert([{
        project_id: id,
        company_id: companyID,
        name,
        description: description || null,
        expected_price: expected_price ? parseFloat(expected_price) : null,
        actual_price: actual_price ? parseFloat(actual_price) : null,
        quantity: quantity ? parseInt(quantity) : 1,
        date_ordered: date_ordered || null,
        date_received: date_received || null,
        status: status || 'pending',
        vendor: vendor || null,
        notes: notes || null,
      }])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ equipment: data });
  } catch (error) {
    console.error('Add equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update equipment expense
app.put('/api/projects/:id/expenses/equipment/:equipmentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, equipmentId } = req.params;
    const { name, description, expected_price, actual_price, quantity, date_ordered, date_received, status, vendor, notes } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (expected_price !== undefined) updateData.expected_price = expected_price ? parseFloat(expected_price) : null;
    if (actual_price !== undefined) updateData.actual_price = actual_price ? parseFloat(actual_price) : null;
    if (quantity !== undefined) updateData.quantity = quantity ? parseInt(quantity) : 1;
    if (date_ordered !== undefined) updateData.date_ordered = date_ordered || null;
    if (date_received !== undefined) updateData.date_received = date_received || null;
    if (status !== undefined) updateData.status = status;
    if (vendor !== undefined) updateData.vendor = vendor || null;
    if (notes !== undefined) updateData.notes = notes || null;

    const { data, error } = await supabase
      .from('project_equipment')
      .update(updateData)
      .eq('id', equipmentId)
      .eq('project_id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ equipment: data });
  } catch (error) {
    console.error('Update equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete equipment expense
app.delete('/api/projects/:id/expenses/equipment/:equipmentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id, equipmentId } = req.params;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const { error } = await supabase
      .from('project_equipment')
      .delete()
      .eq('id', equipmentId)
      .eq('project_id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete equipment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== DOCUMENT GENERATION ENDPOINTS ==========

// Generate a document (contract/proposal/change_order) for a project
app.post('/api/projects/:id/contract', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { document_type = 'contract' } = req.body; // 'contract', 'proposal', or 'change_order'

    // Verify project belongs to user's company and get full project data with customer
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        customers (
          id,
          first_name,
          last_name,
          email,
          phone,
          address_line1,
          address_line2,
          city,
          state,
          zip_code,
          country
        )
      `)
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get company info and current document number
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('*')
      .eq('company_id', companyID)
      .single();

    if (companyError) {
      console.error('Error fetching company:', companyError);
      return res.status(500).json({ error: 'Failed to fetch company info' });
    }

    // Get the next document number from the company
    const documentNumber = company.next_document_number || 1;
    const documentDate = new Date().toISOString().split('T')[0];
    const formattedNumber = String(documentNumber).padStart(5, '0');

    // Increment the company's document number for next time
    const { error: updateError } = await supabase
      .from('companies')
      .update({ next_document_number: documentNumber + 1 })
      .eq('company_id', companyID);

    if (updateError) {
      console.error('Error updating document number:', updateError);
    }

    // Create document type labels for the name
    const typeLabels = {
      contract: 'Contract',
      proposal: 'Proposal',
      change_order: 'Change Order',
    };
    const typeName = typeLabels[document_type] || 'Document';

    // Get expenses for the project
    const { data: subcontractorFees } = await supabase
      .from('project_subcontractor_fees')
      .select(`
        *,
        subcontractors (
          id,
          name
        )
      `)
      .eq('project_id', id)
      .order('date_added', { ascending: true });

    const { data: materials } = await supabase
      .from('project_materials')
      .select(`
        *,
        inventory (
          id,
          name,
          unit
        )
      `)
      .eq('project_id', id)
      .order('date_used', { ascending: true });

    const { data: additionalExpenses } = await supabase
      .from('project_additional_expenses')
      .select('*')
      .eq('project_id', id)
      .order('expense_date', { ascending: true });

    const { data: equipment } = await supabase
      .from('project_equipment')
      .select('*')
      .eq('project_id', id)
      .order('date_ordered', { ascending: true });

    // Calculate totals
    let subcontractorTotal = 0;
    if (subcontractorFees) {
      subcontractorFees.forEach((entry) => {
        subcontractorTotal += parseFloat(entry.expected_value || entry.flat_fee || 0);
      });
    }

    let materialsTotal = 0;
    if (materials) {
      materials.forEach((entry) => {
        materialsTotal += parseFloat(entry.expected_value || 0) || (parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0));
      });
    }

    let additionalTotal = 0;
    if (additionalExpenses) {
      additionalExpenses.forEach((entry) => {
        additionalTotal += parseFloat(entry.expected_value || entry.amount || 0);
      });
    }

    let equipmentTotal = 0;
    if (equipment) {
      equipment.forEach((entry) => {
        equipmentTotal += parseFloat(entry.expected_price || entry.actual_price || 0) * parseFloat(entry.quantity || 1);
      });
    }

    // Get saved milestones for this project (to use as starting customer prices)
    const { data: savedMilestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true });

    res.json({
      documentNumber: formattedNumber,
      documentDate,
      documentType: document_type,
      company: company || {},
      project,
      customer: project.customers || null,
      expenses: {
        subcontractorFees: subcontractorFees || [],
        materials: materials || [],
        additionalExpenses: additionalExpenses || [],
        equipment: equipment || [],
      },
      totals: {
        subcontractors: subcontractorTotal,
        materials: materialsTotal,
        additional: additionalTotal,
        equipment: equipmentTotal,
        initialFee: 1000,
        finalInspection: 1000,
        grandTotal: parseFloat(project.est_value || 0),
      },
      savedMilestones: savedMilestones || [], // Previously saved customer prices for this project
    });
  } catch (error) {
    console.error('Generate document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== MILESTONES ENDPOINTS ====================

// Get milestones for a project (optionally filtered by document number)
app.get('/api/projects/:id/milestones', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get milestones for the project
    const { data: milestones, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ milestones: milestones || [] });
  } catch (error) {
    console.error('Get milestones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save/update milestones for a project (batch operation)
app.put('/api/projects/:id/milestones', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { milestones } = req.body;

    if (!milestones || !Array.isArray(milestones)) {
      return res.status(400).json({ error: 'milestones array is required' });
    }

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Delete existing milestones for this project
    await supabase
      .from('milestones')
      .delete()
      .eq('project_id', id)
      .eq('company_id', companyID);

    // Insert new milestones
    const milestonesToInsert = milestones.map((m, index) => ({
      company_id: companyID,
      project_id: id,
      name: m.name,
      milestone_type: m.milestone_type || 'subcontractor',
      cost: parseFloat(m.cost) || 0,
      customer_price: parseFloat(m.customer_price) || 0,
      subcontractor_fee_id: m.subcontractor_fee_id || null,
      sort_order: index,
    }));

    const { data: savedMilestones, error: insertError } = await supabase
      .from('milestones')
      .insert(milestonesToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting milestones:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    // Calculate grand total from customer prices
    const grandTotal = savedMilestones.reduce((sum, m) => sum + parseFloat(m.customer_price || 0), 0);

    res.json({ 
      milestones: savedMilestones,
      grandTotal,
    });
  } catch (error) {
    console.error('Save milestones error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all inventory items for a company
app.get('/api/inventory', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ materials: data || [] });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single inventory item
app.get('/api/inventory/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json({ material: data });
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new inventory item
app.post('/api/inventory', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const {
      name,
      stock,
      unit,
      brand,
      model,
      color,
      unit_price,
    } = req.body;

    if (!name || !unit) {
      return res.status(400).json({ error: 'Name and unit are required' });
    }

    const { data, error } = await supabase
      .from('inventory')
      .insert([
        {
          company_id: companyID,
          name,
          stock: stock ? parseInt(stock) : 0,
          unit,
          brand: brand || null,
          model: model || null,
          color: color || null,
          unit_price: unit_price ? parseFloat(unit_price) : 0,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ material: data });
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an inventory item
app.put('/api/inventory/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const {
      name,
      stock,
      unit,
      brand,
      model,
      color,
      unit_price,
    } = req.body;

    // Verify inventory item belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const { data, error } = await supabase
      .from('inventory')
      .update({
        name,
        stock: stock ? parseInt(stock) : 0,
        unit,
        brand: brand || null,
        model: model || null,
        color: color || null,
        unit_price: unit_price ? parseFloat(unit_price) : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ material: data });
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an inventory item
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify inventory item belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all subcontractors for a company
app.get('/api/subcontractors', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ subcontractors: data || [] });
  } catch (error) {
    console.error('Get subcontractors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single subcontractor
app.get('/api/subcontractors/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    res.json({ subcontractor: data });
  } catch (error) {
    console.error('Get subcontractor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new subcontractor
app.post('/api/subcontractors', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const {
      name,
      primary_contact_name,
      primary_contact_phone,
      primary_contact_email,
      rate,
      coi_expiration,
      coi_documents,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const { data, error } = await supabase
      .from('subcontractors')
      .insert([
        {
          company_id: companyID,
          name,
          primary_contact_name: primary_contact_name || null,
          primary_contact_phone: primary_contact_phone || null,
          primary_contact_email: primary_contact_email || null,
          rate: rate ? parseFloat(rate) : null,
          coi_expiration: coi_expiration || null,
          coi_documents: coi_documents || [],
          notes: notes || null,
          created_by: user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ subcontractor: data });
  } catch (error) {
    console.error('Create subcontractor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a subcontractor
app.put('/api/subcontractors/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const {
      name,
      primary_contact_name,
      primary_contact_phone,
      primary_contact_email,
      rate,
      coi_expiration,
      coi_documents,
      notes,
    } = req.body;

    // Verify subcontractor belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const { data, error } = await supabase
      .from('subcontractors')
      .update({
        name,
        primary_contact_name: primary_contact_name || null,
        primary_contact_phone: primary_contact_phone || null,
        primary_contact_email: primary_contact_email || null,
        rate: rate ? parseFloat(rate) : null,
        coi_expiration: coi_expiration || null,
        coi_documents: coi_documents || [],
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ subcontractor: data });
  } catch (error) {
    console.error('Update subcontractor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a subcontractor
app.delete('/api/subcontractors/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify subcontractor belongs to user's company
    const { data: existing, error: checkError } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Subcontractor not found' });
    }

    const { error } = await supabase
      .from('subcontractors')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete subcontractor error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== EMPLOYEES ENDPOINTS ====================

// Get all employees for a company
app.get('/api/employees', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ employees: data || [] });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single employee
app.get('/api/employees/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee: data });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new employee
app.post('/api/employees', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const {
      name,
      user_type,
      user_role,
      email_address,
      phone,
      current,
      is_project_manager,
      is_sales_person,
      is_foreman,
      registered_time_zone,
      color,
    } = req.body;

    if (!name || !email_address) {
      return res.status(400).json({ error: 'Name and email address are required' });
    }

    const insertData = {
      company_id: companyID,
      name,
      user_type: user_type || 'employee',
      user_role: user_role || null,
      email_address,
      phone: phone || null,
      current: current || false,
      is_project_manager: is_project_manager || false,
      is_sales_person: is_sales_person || false,
      is_foreman: is_foreman || false,
      registered_time_zone: registered_time_zone || null,
    };

    // Handle color - ensure it's a string and trim it, or set to null if empty
    if (color !== undefined && color !== null && typeof color === 'string' && color.trim() !== '') {
      insertData.color = color.trim();
    } else {
      insertData.color = null;
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([insertData])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ employee: data });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an employee
app.put('/api/employees/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify employee belongs to company
    const { data: existingEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (fetchError || !existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const {
      name,
      user_type,
      user_role,
      email_address,
      phone,
      current,
      is_project_manager,
      is_sales_person,
      is_foreman,
      registered_time_zone,
      color,
    } = req.body;

    if (!name || !email_address) {
      return res.status(400).json({ error: 'Name and email address are required' });
    }

    const updateData = {
      name,
      user_type: user_type || 'employee',
      user_role: user_role || null,
      email_address,
      phone: phone || null,
      current: current || false,
      is_project_manager: is_project_manager || false,
      is_sales_person: is_sales_person || false,
      is_foreman: is_foreman || false,
      registered_time_zone: registered_time_zone || null,
      updated_at: new Date().toISOString(),
    };

    // Handle color - ensure it's a string and trim it, or set to null if empty
    if (color !== undefined && color !== null && typeof color === 'string' && color.trim() !== '') {
      updateData.color = color.trim();
    } else {
      updateData.color = null;
    }

    const { data, error } = await supabase
      .from('employees')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ employee: data });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify employee belongs to company
    const { data: existingEmployee, error: fetchError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (fetchError || !existingEmployee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== EVENTS ENDPOINTS ====================

// Get all events for a company
app.get('/api/events', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        employees (
          id,
          name,
          color
        )
      `)
      .eq('company_id', companyID)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Transform data to include employee name and color
    const eventsWithEmployeeName = (data || []).map((event) => ({
      ...event,
      employee_name: event.employees?.name || null,
      employee_color: event.employees?.color || null,
    }));

    res.json({ events: eventsWithEmployeeName });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        employees (
          id,
          name,
          color
        )
      `)
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ 
      event: {
        ...data,
        employee_name: data.employees?.name || null,
        employee_color: data.employees?.color || null,
      }
    });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new event
app.post('/api/events', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { name, date, time, employee_id } = req.body;

    if (!name || !date || !time) {
      return res.status(400).json({ error: 'Name, date, and time are required' });
    }

    const { data, error } = await supabase
      .from('events')
      .insert([
        {
          company_id: companyID,
          name,
          date,
          time,
          employee_id: employee_id || null,
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ event: data });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an event
app.put('/api/events/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify event belongs to company
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (fetchError || !existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { name, date, time, employee_id } = req.body;

    if (!name || !date || !time) {
      return res.status(400).json({ error: 'Name, date, and time are required' });
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        name,
        date,
        time,
        employee_id: employee_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ event: data });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an event
app.delete('/api/events/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify event belongs to company
    const { data: existingEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (fetchError || !existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== DOCUMENT MANAGEMENT ENDPOINTS ==========

// List documents for an entity
app.get('/api/documents/:entityType/:entityId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { entityType, entityId } = req.params;
    const validEntityTypes = ['customers', 'projects', 'inventory', 'subcontractors', 'employees'];
    
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Verify entity belongs to user's company
    const tableName = entityType === 'inventory' ? 'inventory' : entityType;
    const { data: entity, error: entityError } = await supabase
      .from(tableName)
      .select('id, company_id')
      .eq('id', entityId)
      .eq('company_id', companyID)
      .single();

    if (entityError || !entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // For projects, fetch from project_documents table
    if (entityType === 'projects') {
      const { data: projectDocs, error: docsError } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', entityId)
        .eq('company_id', companyID)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching project documents:', docsError);
        return res.status(500).json({ error: docsError.message });
      }

      const documents = (projectDocs || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        document_type: doc.document_type,
        document_number: doc.document_number,
        document_date: doc.document_date,
        status: doc.status,
        file_name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size,
        mime_type: doc.mime_type,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      }));

      return res.json({ documents });
    }

    // For other entity types, list files from Supabase Storage
    // IMPORTANT: Do NOT include "documents" in the path - .from('documents') already specifies the bucket
    const storagePath = `${entityType}/${companyID}/${entityId}`;
    
    const { data: files, error: storageError } = await supabase.storage
      .from('documents')
      .list(storagePath);

    if (storageError) {
      console.error('  - Storage Error Details:', {
        message: storageError.message,
        statusCode: storageError.statusCode,
        error: storageError.error,
      });
      // If bucket doesn't exist or path doesn't exist, return empty array
      if (storageError.message.includes('not found') || storageError.message.includes('Bucket')) {
        return res.json({ documents: [] });
      }
      return res.status(500).json({ error: storageError.message });
    }

    // Format file list
    const documents = (files || []).map(file => ({
      name: file.name,
      path: `${storagePath}/${file.name}`,
      size: file.metadata?.size || 0,
      created_at: file.created_at,
      updated_at: file.updated_at,
    }));

    res.json({ documents });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload document via backend (bypasses RLS using service role key)
// This endpoint accepts file uploads via multipart/form-data and uses the service role key to bypass RLS
app.post('/api/documents/:entityType/:entityId/upload', upload.single('file'), async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { entityType, entityId } = req.params;
    const { name, document_type = 'other' } = req.body;
    const validEntityTypes = ['customers', 'projects', 'inventory', 'subcontractors', 'employees'];
    
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Verify entity belongs to user's company
    const tableName = entityType === 'inventory' ? 'inventory' : entityType;
    const { data: entity, error: entityError } = await supabase
      .from(tableName)
      .select('id, company_id')
      .eq('id', entityId)
      .eq('company_id', companyID)
      .single();

    if (entityError || !entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Upload using service role key (bypasses RLS)
    const storagePath = `${entityType}/${companyID}/${entityId}/${req.file.originalname}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: uploadError.message });
    }

    // For projects, save document metadata to project_documents table
    if (entityType === 'projects') {
      const validDocTypes = ['contract', 'proposal', 'change_order', 'other'];
      const docType = validDocTypes.includes(document_type) ? document_type : 'other';
      
      const { data: docRecord, error: docError } = await supabase
        .from('project_documents')
        .insert([{
          company_id: companyID,
          project_id: entityId,
          name: name || req.file.originalname,
          document_type: docType,
          file_name: req.file.originalname,
          file_path: storagePath,
          file_size: req.file.size,
          mime_type: req.file.mimetype,
        }])
        .select()
        .single();

      if (docError) {
        console.error('Error saving document metadata:', docError);
        // Don't fail the upload, just log the error
    }

    res.json({ 
      success: true, 
      path: uploadData.path,
        document: docRecord || null,
      message: 'Document uploaded successfully'
    });
    } else {
      res.json({ 
        success: true, 
        path: uploadData.path,
        message: 'Document uploaded successfully'
      });
    }
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document metadata (for project documents)
app.put('/api/documents/projects/:projectId/:documentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { projectId, documentId } = req.params;
    const { name, document_type, status } = req.body;

    // Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, company_id')
      .eq('id', projectId)
      .eq('company_id', companyID)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Validate document_type
    const validDocTypes = ['contract', 'proposal', 'change_order', 'other'];
    const docType = validDocTypes.includes(document_type) ? document_type : undefined;

    // Validate status
    const validStatuses = ['draft', 'sent', 'signed', 'cancelled', 'expired'];
    const docStatus = validStatuses.includes(status) ? status : undefined;

    // Build update object
    const updateData = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updateData.name = name;
    if (docType !== undefined) updateData.document_type = docType;
    if (docStatus !== undefined) updateData.status = docStatus;

    // Update the document
    const { data: updatedDoc, error: updateError } = await supabase
      .from('project_documents')
      .update(updateData)
      .eq('id', documentId)
      .eq('company_id', companyID)
      .eq('project_id', projectId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating document:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ success: true, document: updatedDoc });
  } catch (error) {
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete document
app.delete('/api/documents/:entityType/:entityId/:fileName', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { entityType, entityId, fileName } = req.params;
    const validEntityTypes = ['customers', 'projects', 'inventory', 'subcontractors', 'employees'];
    
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Verify entity belongs to user's company
    const tableName = entityType === 'inventory' ? 'inventory' : entityType;
    const { data: entity, error: entityError } = await supabase
      .from(tableName)
      .select('id, company_id')
      .eq('id', entityId)
      .eq('company_id', companyID)
      .single();

    if (entityError || !entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    const { documentId } = req.query;

    // Delete file from Supabase Storage
    // IMPORTANT: Do NOT include "documents" in the path - .from('documents') already specifies the bucket
    const storagePath = `${entityType}/${companyID}/${entityId}/${fileName}`;
    console.log('🗑️ Delete Document Debug:');
    console.log('  - Storage Path:', storagePath);
    console.log('  - Document ID:', documentId);
    
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([storagePath]);

    console.log('  - Delete Response:', { error: deleteError });

    if (deleteError) {
      console.error('  - Delete Error Details:', {
        message: deleteError.message,
        statusCode: deleteError.statusCode,
        error: deleteError.error,
      });
      // Don't fail if storage delete fails - file might already be gone
    }

    // If documentId provided and this is a project, also delete from project_documents table
    if (documentId && entityType === 'projects') {
      const { error: dbDeleteError } = await supabase
        .from('project_documents')
        .delete()
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('project_id', entityId);

      if (dbDeleteError) {
        console.error('Error deleting from project_documents:', dbDeleteError);
      }
    }

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get document download URL
app.get('/api/documents/:entityType/:entityId/:fileName/download', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { entityType, entityId, fileName } = req.params;
    const validEntityTypes = ['customers', 'projects', 'inventory', 'subcontractors', 'employees'];
    
    if (!validEntityTypes.includes(entityType)) {
      return res.status(400).json({ error: 'Invalid entity type' });
    }

    // Verify entity belongs to user's company
    const tableName = entityType === 'inventory' ? 'inventory' : entityType;
    const { data: entity, error: entityError } = await supabase
      .from(tableName)
      .select('id, company_id')
      .eq('id', entityId)
      .eq('company_id', companyID)
      .single();

    if (entityError || !entity) {
      return res.status(404).json({ error: 'Entity not found' });
    }

    // Get signed URL for download (valid for 1 hour)
    // IMPORTANT: Do NOT include "documents" in the path - .from('documents') already specifies the bucket
    const storagePath = `${entityType}/${companyID}/${entityId}/${fileName}`;
    console.log('⬇️ Download URL Debug:');
    console.log('  - Storage Path:', storagePath);
    console.log('  - Path parts:', storagePath.split('/'));
    console.log('  - Expected companyID at index [1]:', storagePath.split('/')[1]);
    
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    console.log('  - URL Response:', { url: urlData?.signedUrl ? 'Generated' : 'None', error: urlError });

    if (urlError) {
      console.error('  - URL Error Details:', {
        message: urlError.message,
        statusCode: urlError.statusCode,
        error: urlError.error,
      });
      return res.status(500).json({ error: urlError.message });
    }

    res.json({ url: urlData.signedUrl });
  } catch (error) {
    console.error('Get download URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate data point value
async function calculateDataPointValue(dataPointType, companyID, startDate) {
  switch (dataPointType) {
    case 'profit': {
      // Get projects marked as sold or complete from status history (consistent with dashboard)
      let soldQuery = supabase
        .from('project_status_history')
        .select('project_id, projects!inner(id, est_value)')
        .eq('company_id', companyID)
        .eq('status', 'sold');

      let completeQuery = supabase
        .from('project_status_history')
        .select('project_id, projects!inner(id, est_value)')
        .eq('company_id', companyID)
        .eq('status', 'complete');

      if (startDate) {
        soldQuery = soldQuery.gte('changed_at', startDate.toISOString());
        completeQuery = completeQuery.gte('changed_at', startDate.toISOString());
      }

      const [{ data: soldHistory }, { data: completeHistory }] = await Promise.all([
        soldQuery,
        completeQuery,
      ]);

      // Combine sold and complete, avoiding duplicates
      const processedProjectIds = new Set();
      const allProjects = [
        ...(soldHistory || []),
        ...(completeHistory || []),
      ];

      if (allProjects.length === 0) return 0;

      let totalEstValue = 0;
      let totalExpenses = 0;

      for (const record of allProjects) {
        // Skip duplicates
        if (processedProjectIds.has(record.project_id)) continue;
        processedProjectIds.add(record.project_id);

        const estValue = parseFloat(record.projects?.est_value || 0);
        totalEstValue += estValue;

        // Get expenses for this project
        const { data: subcontractorFees } = await supabase
          .from('project_subcontractor_fees')
          .select('flat_fee')
          .eq('project_id', record.project_id);

        const { data: materials } = await supabase
          .from('project_materials')
          .select('quantity, unit_cost')
          .eq('project_id', record.project_id);

        const { data: additionalExpenses } = await supabase
          .from('project_additional_expenses')
          .select('amount')
          .eq('project_id', record.project_id);

        // Calculate subcontractor costs
        let subcontractorTotal = 0;
        if (subcontractorFees) {
          subcontractorFees.forEach((entry) => {
            subcontractorTotal += parseFloat(entry.flat_fee || 0);
          });
        }

        // Calculate materials costs
        let materialsTotal = 0;
        if (materials) {
          materials.forEach((entry) => {
            materialsTotal += parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0);
          });
        }

        // Calculate additional expenses
        let additionalTotal = 0;
        if (additionalExpenses) {
          additionalExpenses.forEach((entry) => {
            additionalTotal += parseFloat(entry.amount || 0);
          });
        }

        totalExpenses += subcontractorTotal + materialsTotal + additionalTotal;
      }

      return totalEstValue - totalExpenses;
    }

    case 'est_value': {
      // Get projects marked as sold or complete from status history (consistent with dashboard)
      let soldQuery = supabase
        .from('project_status_history')
        .select('project_id, projects!inner(est_value)')
        .eq('company_id', companyID)
        .eq('status', 'sold');

      let completeQuery = supabase
        .from('project_status_history')
        .select('project_id, projects!inner(est_value)')
        .eq('company_id', companyID)
        .eq('status', 'complete');

      if (startDate) {
        soldQuery = soldQuery.gte('changed_at', startDate.toISOString());
        completeQuery = completeQuery.gte('changed_at', startDate.toISOString());
      }

      const [{ data: soldHistory }, { data: completeHistory }] = await Promise.all([
        soldQuery,
        completeQuery,
      ]);

      // Combine sold and complete, avoiding duplicates
      const processedProjectIds = new Set();
      const allProjects = [
        ...(soldHistory || []),
        ...(completeHistory || []),
      ];

      let total = 0;
      for (const record of allProjects) {
        if (processedProjectIds.has(record.project_id)) continue;
        processedProjectIds.add(record.project_id);
        total += parseFloat(record.projects?.est_value || 0);
      }

      return total;
    }

    case 'leads': {
      let customersQuery = supabase
        .from('customers')
        .select('id, created_at')
        .eq('company_id', companyID)
        .eq('pipeline_status', 'lead');

      if (startDate) {
        customersQuery = customersQuery.gte('created_at', startDate.toISOString());
      }

      const { data: leads, error: leadsError } = await customersQuery;
      if (leadsError) return 0;

      return (leads || []).length;
    }

    case 'projects_sold': {
      let projectsQuery = supabase
        .from('projects')
        .select('id, status, created_at')
        .eq('company_id', companyID)
        .eq('status', 'sold');

      if (startDate) {
        projectsQuery = projectsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError) return 0;

      return (projects || []).length;
    }

    case 'total_customers': {
      let customersQuery = supabase
        .from('customers')
        .select('id, created_at')
        .eq('company_id', companyID);

      if (startDate) {
        customersQuery = customersQuery.gte('created_at', startDate.toISOString());
      }

      const { data: customers, error: customersError } = await customersQuery;
      if (customersError) return 0;

      return (customers || []).length;
    }

    case 'active_projects': {
      let projectsQuery = supabase
        .from('projects')
        .select('id, status, created_at')
        .eq('company_id', companyID)
        .in('status', ['signed', 'in_progress']);

      if (startDate) {
        projectsQuery = projectsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError) return 0;

      return (projects || []).length;
    }

    case 'completed_projects': {
      let projectsQuery = supabase
        .from('projects')
        .select('id, status, created_at')
        .eq('company_id', companyID)
        .eq('status', 'completed');

      if (startDate) {
        projectsQuery = projectsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError) return 0;

      return (projects || []).length;
    }

    default:
      return 0;
  }
}

// Get available data point types
app.get('/api/goals/data-points', async (req, res) => {
  res.json({
    dataPoints: [
      { value: 'profit', label: 'Profit', icon: '💰', format: 'currency' },
      { value: 'est_value', label: 'Estimated Value', icon: '📊', format: 'currency' },
      { value: 'leads', label: 'Leads', icon: '🎯', format: 'number' },
      { value: 'projects_sold', label: 'Projects Sold', icon: '✅', format: 'number' },
      { value: 'total_customers', label: 'Total Customers', icon: '👥', format: 'number' },
      { value: 'active_projects', label: 'Active Projects', icon: '🚧', format: 'number' },
      { value: 'completed_projects', label: 'Completed Projects', icon: '🏁', format: 'number' },
    ],
  });
});

// Goals endpoints
// Get all goals for a company
app.get('/api/goals', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    // Get all goals for this company
    const { data: goals, error: goalsError } = await supabase
      .from('goals')
      .select('*')
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (goalsError) {
      return res.status(500).json({ error: goalsError.message });
    }

    // Calculate progress for each goal
    const goalsWithProgress = await Promise.all(
      (goals || []).map(async (goal) => {
        // Use start_date if provided, otherwise use all time (null)
        const startDate = goal.start_date ? new Date(goal.start_date) : null;
        
        const currentValue = await calculateDataPointValue(
          goal.data_point_type,
          companyID,
          startDate
        );

        // Check if goal is overdue
        const now = new Date();
        const targetDate = goal.target_date ? new Date(goal.target_date) : null;
        const isOverdue = targetDate && now > targetDate && currentValue < goal.target_value;

        return {
          ...goal,
          current_value: currentValue,
          progress_percentage: goal.target_value > 0 
            ? Math.min((currentValue / goal.target_value) * 100, 100)
            : 0,
          is_overdue: isOverdue,
        };
      })
    );

    res.json({
      goals: goalsWithProgress,
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new goal
app.post('/api/goals', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { goal_name, data_point_type, target_value, start_date, target_date } = req.body;

    if (!goal_name || !data_point_type || target_value === undefined) {
      return res.status(400).json({ error: 'Missing required fields: goal_name, data_point_type, and target_value are required' });
    }

    const insertData = {
      company_id: companyID,
      goal_name,
      data_point_type,
      target_value: parseFloat(target_value),
    };

    // Add start_date if provided
    if (start_date) {
      insertData.start_date = new Date(start_date).toISOString();
    }

    // Add target_date if provided
    if (target_date) {
      insertData.target_date = new Date(target_date).toISOString();
    }

    const { data: newGoal, error: createError } = await supabase
      .from('goals')
      .insert([insertData])
      .select()
      .single();

    if (createError) {
      return res.status(500).json({ error: createError.message });
    }

    res.json({ goal: newGoal, message: 'Goal created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a goal
app.put('/api/goals/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;
    const { goal_name, data_point_type, target_value, start_date, target_date } = req.body;

    // Verify goal belongs to company
    const { data: existingGoal, error: checkError } = await supabase
      .from('goals')
      .select('*')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const updateData = {};
    if (goal_name !== undefined) updateData.goal_name = goal_name;
    if (data_point_type !== undefined) updateData.data_point_type = data_point_type;
    if (target_value !== undefined) updateData.target_value = parseFloat(target_value);
    if (start_date !== undefined) {
      // If start_date is empty string, set to null (use Total/all time)
      updateData.start_date = start_date ? new Date(start_date).toISOString() : null;
    }
    if (target_date !== undefined) {
      // If target_date is empty string, set to null (remove target date)
      updateData.target_date = target_date ? new Date(target_date).toISOString() : null;
    }

    const { data: updatedGoal, error: updateError } = await supabase
      .from('goals')
      .update(updateData)
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    res.json({ goal: updatedGoal, message: 'Goal updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a goal
app.delete('/api/goals/:id', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { id } = req.params;

    // Verify goal belongs to company
    const { data: existingGoal, error: checkError } = await supabase
      .from('goals')
      .select('id')
      .eq('id', id)
      .eq('company_id', companyID)
      .single();

    if (checkError || !existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const { error: deleteError } = await supabase
      .from('goals')
      .delete()
      .eq('id', id)
      .eq('company_id', companyID);

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== DOCUSIGN ENDPOINTS ====================

// Send document via DocuSign for e-signature
app.post('/api/docusign/send', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const companyID = user.user_metadata?.companyID;
    if (!companyID) {
      return res.status(400).json({ error: 'User does not have a company ID' });
    }

    const { documentUrl, documentName, recipientEmail, recipientName, subject, message, cc, bcc, documentId } = req.body;

    if (!documentUrl || !documentName) {
      return res.status(400).json({ error: 'Document URL and name are required' });
    }

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    // Download document from the URL
    let documentBuffer;
    try {
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      documentBuffer = Buffer.from(arrayBuffer);
    } catch (fetchError) {
      console.error('Error downloading document:', fetchError);
      return res.status(500).json({ error: 'Failed to download document: ' + fetchError.message });
    }

    // Parse CC and BCC emails
    const ccEmails = cc ? (Array.isArray(cc) ? cc : cc.split(',').map(e => e.trim()).filter(Boolean)) : [];
    const bccEmails = bcc ? (Array.isArray(bcc) ? bcc : bcc.split(',').map(e => e.trim()).filter(Boolean)) : [];

    // Create and send DocuSign envelope
    let envelopeId;
    try {
      envelopeId = await docusignService.createAndSendEnvelope({
        documentBuffer,
        documentName,
        recipientEmail,
        recipientName: recipientName || recipientEmail,
        subject,
        emailBlurb: message || '',
        ccEmails,
        bccEmails,
      });
    } catch (docusignError) {
      console.error('DocuSign error:', docusignError);
      return res.status(500).json({ error: 'Failed to send via DocuSign: ' + docusignError.message });
    }

    // Update project_documents table with envelope ID if documentId is provided
    if (documentId) {
      const { error: updateError } = await supabase
        .from('project_documents')
        .update({
          docusign_envelope_id: envelopeId,
          docusign_status: 'sent',
          docusign_sent_at: new Date().toISOString(),
          docusign_sender_email: user.email, // Store sender email for notifications
          docusign_sender_company_id: companyID, // Store company ID for company signer
        })
        .eq('id', documentId)
        .eq('company_id', companyID);

      if (updateError) {
        console.error('Error updating document with envelope ID:', updateError);
        // Don't fail the request if update fails
      }
    }

    res.json({ 
      success: true, 
      message: 'Document sent for signature via DocuSign',
      envelopeId,
    });
  } catch (error) {
    console.error('DocuSign send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send document for signature' });
  }
});

// DocuSign webhook endpoint for status updates
app.post('/api/docusign/webhook', async (req, res) => {
  try {
    // DocuSign webhook format: { data: { envelopeId, status, ... }, event: 'envelope-sent', ... }
    const webhookData = req.body;
    
    // DocuSign can send different webhook formats
    // Format 1: { data: { envelopeId, status }, event: 'envelope-sent' }
    // Format 2: { envelopeId, status, event } (direct properties)
    let envelopeId = webhookData.data?.envelopeId || webhookData.envelopeId;
    let event = webhookData.event || webhookData.data?.event;
    let status = webhookData.data?.status || webhookData.status;

    if (!envelopeId) {
      console.error('Webhook missing envelopeId:', webhookData);
      // Still return 200 to prevent DocuSign from retrying
      return res.status(200).json({ received: true, error: 'Missing envelopeId' });
    }

    // Map DocuSign status/event to our status
    // DocuSign status values: 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided'
    if (!status && event) {
      // Map event to status if status not provided
      switch (event) {
        case 'envelope-sent':
          status = 'sent';
          break;
        case 'envelope-delivered':
          status = 'delivered';
          break;
        case 'envelope-signed':
          status = 'signed';
          break;
        case 'envelope-completed':
          status = 'completed';
          break;
        case 'envelope-declined':
          status = 'declined';
          break;
        case 'envelope-voided':
          status = 'voided';
          break;
        default:
          status = 'sent';
      }
    }

    // Normalize status to our allowed values
    const validStatuses = ['sent', 'delivered', 'signed', 'completed', 'declined', 'voided'];
    if (!validStatuses.includes(status)) {
      status = 'sent'; // Default fallback
    }

    // Find document by envelope ID and get sender info
    const { data: documents, error: findError } = await supabase
      .from('project_documents')
      .select('id, name, docusign_sender_email, docusign_sender_company_id, docusign_status')
      .eq('docusign_envelope_id', envelopeId)
      .limit(1);

    if (findError) {
      console.error('Error finding document:', findError);
      // Still return 200 to prevent DocuSign from retrying
      return res.status(200).json({ received: true, error: 'Database error' });
    }

    if (documents && documents.length > 0) {
      const document = documents[0];
      const updateData = {
        docusign_status: status,
      };

      // Set completed_at if status is completed
      if (status === 'completed') {
        updateData.docusign_completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('project_documents')
        .update(updateData)
        .eq('id', document.id);

      if (updateError) {
        console.error('Error updating document status:', updateError);
        // Still return 200 to prevent DocuSign from retrying
        return res.status(200).json({ received: true, error: 'Update failed' });
      }

      console.log(`Updated document ${document.id} with DocuSign status: ${status}`);

      // Check if customer (first signer) has signed and company signer hasn't been added yet
      // Detect customer signing: 
      // - Status changed to 'signed' (customer signed, but envelope not yet completed)
      // - Event is 'recipient-signed' with routingOrder 1 (first signer)
      // - Previous status was not 'signed' (only trigger once)
      const previousStatus = document.docusign_status;
      const recipientRoutingOrder = webhookData.data?.routingOrder || webhookData.routingOrder;
      const isCustomerSigned = 
        (status === 'signed' || 
         event === 'recipient-signed' || 
         event === 'envelope-signed') &&
        previousStatus !== 'signed' && // Only trigger once (status changed from non-signed to signed)
        (recipientRoutingOrder === '1' || recipientRoutingOrder === 1 || !recipientRoutingOrder) && // First signer or no routing order specified
        document.docusign_sender_email && // Must have sender email
        document.docusign_sender_company_id && // Must have company ID
        status !== 'completed'; // Don't trigger if envelope is already completed

      if (isCustomerSigned) {
        console.log(`Customer has signed envelope ${envelopeId}. Adding company signer...`);
        
        try {
          // Get company name from companies table
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('company_name')
            .eq('company_id', document.docusign_sender_company_id)
            .single();

          if (companyError || !company) {
            console.error('Error fetching company name:', companyError);
            // Use company ID as fallback
            var companyName = document.docusign_sender_company_id;
          } else {
            var companyName = company.company_name || document.docusign_sender_company_id;
          }

          // Add company signer to envelope
          // DocuSign will automatically email the company signer when they're added
          await docusignService.addCompanySignerToEnvelope(
            envelopeId,
            document.docusign_sender_email,
            companyName
          );

          console.log(`✅ Company signer added to envelope ${envelopeId}. DocuSign will email them automatically.`);
        } catch (signerError) {
          console.error('Error adding company signer:', signerError);
          // Don't fail the webhook, but log the error
        }
      }
    } else {
      console.log(`No document found for envelope ID: ${envelopeId}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent DocuSign from retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

