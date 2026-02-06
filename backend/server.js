import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as esignaturesService from './services/esignatures.js';
import * as googleCalendarService from './services/googleCalendar.js';
import * as smsService from './services/infobip.js';

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

    // Check if employee is active (current = true)
    const { data: employee } = await supabase
      .from('employees')
      .select('current')
      .eq('email_address', username.toLowerCase())
      .eq('company_id', companyID)
      .single();

    // If employee exists and is marked as inactive, reject login
    if (employee && employee.current === false) {
      // Sign out the user since they authenticated but shouldn't have access
      await supabase.auth.signOut();
      return res.status(403).json({ 
        error: 'Your account has been deactivated. Please contact an administrator.' 
      });
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

// Register endpoint - requires company to exist and email to be whitelisted
app.post('/api/auth/register', async (req, res) => {
  try {
    const { companyID, email, password } = req.body;

    if (!companyID || !email || !password) {
      return res.status(400).json({ 
        error: 'Missing required fields: companyID, email, and password are required' 
      });
    }

    // First, check if the company ID exists in the companies table
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('company_id')
      .eq('company_id', companyID)
      .single();

    if (companyError || !company) {
      return res.status(403).json({ 
        error: 'Invalid Company ID. Please contact your administrator to get the correct Company ID.' 
      });
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

    // Check if this email has already been registered
    if (whitelistData.registered) {
      return res.status(400).json({ 
        error: 'This email has already been registered. Please try logging in instead.' 
      });
    }

    // Email is whitelisted and not yet registered - proceed with registration
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          companyID: companyID,
        },
        emailRedirectTo: `${frontendUrl}/login`,
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

// Check if employee is active
app.post('/api/auth/check-active', async (req, res) => {
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
    const userEmail = user.email;

    if (!companyID || !userEmail) {
      // If missing data, allow access (don't block)
      return res.json({ active: true });
    }

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('current')
      .eq('email_address', userEmail.toLowerCase())
      .eq('company_id', companyID)
      .maybeSingle();

    if (empError) {
      console.error('Error checking employee active status:', empError);
      // On error, allow access (don't block due to errors)
      return res.json({ active: true });
    }

    // If no employee record found, allow access
    if (!employee) {
      return res.json({ active: true });
    }

    // Return the active status
    return res.json({ active: employee.current !== false });
  } catch (error) {
    console.error('Error in check-active:', error);
    // On error, allow access
    return res.json({ active: true });
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
      default_initial_fee_percent,
      default_final_fee_percent,
      default_initial_fee_min,
      default_initial_fee_max,
      default_final_fee_min,
      default_final_fee_max,
      auto_include_initial_payment,
      auto_include_final_payment,
      auto_include_subcontractor,
      auto_include_equipment_materials,
      auto_include_additional_expenses,
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
            default_initial_fee_percent: default_initial_fee_percent ?? 20,
            default_final_fee_percent: default_final_fee_percent ?? 80,
            default_initial_fee_min: default_initial_fee_min || null,
            default_initial_fee_max: default_initial_fee_max || null,
            default_final_fee_min: default_final_fee_min || null,
            default_final_fee_max: default_final_fee_max || null,
            auto_include_initial_payment: auto_include_initial_payment ?? true,
            auto_include_final_payment: auto_include_final_payment ?? true,
            auto_include_subcontractor: auto_include_subcontractor ?? true,
            auto_include_equipment_materials: auto_include_equipment_materials ?? true,
            auto_include_additional_expenses: auto_include_additional_expenses ?? true,
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
          default_initial_fee_percent: default_initial_fee_percent !== undefined ? default_initial_fee_percent : undefined,
          default_final_fee_percent: default_final_fee_percent !== undefined ? default_final_fee_percent : undefined,
          default_initial_fee_min: default_initial_fee_min !== undefined ? (default_initial_fee_min || null) : undefined,
          default_initial_fee_max: default_initial_fee_max !== undefined ? (default_initial_fee_max || null) : undefined,
          default_final_fee_min: default_final_fee_min !== undefined ? (default_final_fee_min || null) : undefined,
          default_final_fee_max: default_final_fee_max !== undefined ? (default_final_fee_max || null) : undefined,
          auto_include_initial_payment: auto_include_initial_payment !== undefined ? auto_include_initial_payment : undefined,
          auto_include_final_payment: auto_include_final_payment !== undefined ? auto_include_final_payment : undefined,
          auto_include_subcontractor: auto_include_subcontractor !== undefined ? auto_include_subcontractor : undefined,
          auto_include_equipment_materials: auto_include_equipment_materials !== undefined ? auto_include_equipment_materials : undefined,
          auto_include_additional_expenses: auto_include_additional_expenses !== undefined ? auto_include_additional_expenses : undefined,
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
      .order('created_at', { ascending: false });

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
      .select('project_id, projects!inner(est_value, closing_price)')
      .eq('company_id', companyID)
      .eq('status', 'sold');

    let completeQuery = supabase
      .from('project_status_history')
      .select('project_id, projects!inner(est_value, closing_price)')
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

    // Calculate revenue (from milestones customer_price) and expenses for sold/complete projects
    let totalRevenue = 0;
    let totalEstValue = 0;
    let totalExpenses = 0;
    let projectCount = 0;

    for (const record of allProjects) {
      // Skip duplicates
      if (processedProjectIds.has(record.project_id)) continue;
      processedProjectIds.add(record.project_id);

      const estValue = parseFloat(record.projects?.est_value || 0);
      const closingPrice = parseFloat(record.projects?.closing_price || 0);
      totalEstValue += estValue;
      projectCount++;

      // Calculate revenue: Use closing_price if available, otherwise use milestones or est_value
      let projectRevenue = 0;
      
      if (closingPrice > 0) {
        // Priority 1: Use closing_price if set
        projectRevenue = closingPrice;
      } else {
        // Priority 2: Get revenue from milestones (customer_price)
        const { data: milestones } = await supabase
          .from('milestones')
          .select('customer_price')
          .eq('project_id', record.project_id);

        if (milestones) {
          milestones.forEach((milestone) => {
            projectRevenue += parseFloat(milestone.customer_price || 0);
          });
        }
        // Priority 3: Fall back to est_value
        if (projectRevenue === 0) {
          projectRevenue = estValue;
        }
      }
      totalRevenue += projectRevenue;

      // Get expenses for this project
      const { data: subcontractorFees } = await supabase
        .from('project_subcontractor_fees')
        .select('flat_fee')
        .eq('project_id', record.project_id);

      const { data: materials } = await supabase
        .from('project_materials')
        .select('actual_price')
        .eq('project_id', record.project_id);

      const { data: equipment } = await supabase
        .from('project_equipment')
        .select('actual_price')
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
          materialsTotal += parseFloat(entry.actual_price || 0);
        });
      }

      // Calculate equipment costs
      let equipmentTotal = 0;
      if (equipment) {
        equipment.forEach((entry) => {
          equipmentTotal += parseFloat(entry.actual_price || 0);
        });
      }

      // Calculate additional expenses
      let additionalTotal = 0;
      if (additionalExpenses) {
        additionalExpenses.forEach((entry) => {
          additionalTotal += parseFloat(entry.amount || 0);
        });
      }

      totalExpenses += subcontractorTotal + materialsTotal + equipmentTotal + additionalTotal;
    }

    const totalProfit = totalRevenue - totalExpenses;

    res.json({
      totalEstValue: totalEstValue,
      totalRevenue: totalRevenue,
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
    
    // Date range for the entire year
    const yearStart = new Date(yearNum, 0, 1).toISOString();
    const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59).toISOString();

    // Batch all queries in parallel - only 5 database calls instead of 60+
    const [
      { data: soldHistory },
      { data: completedHistory },
      { data: leadsHistory },
      { data: signedHistory },
      { data: totalCustomers }
    ] = await Promise.all([
      // Get all sold projects for the year
      supabase
        .from('project_status_history')
        .select('project_id, changed_at, projects!inner(est_value, closing_price)')
        .eq('company_id', companyID)
        .eq('status', 'sold')
        .gte('changed_at', yearStart)
        .lte('changed_at', yearEnd),
      
      // Get all completed projects for the year
      supabase
        .from('project_status_history')
        .select('project_id, changed_at, projects!inner(est_value, closing_price)')
        .eq('company_id', companyID)
        .eq('status', 'complete')
        .gte('changed_at', yearStart)
        .lte('changed_at', yearEnd),
      
      // Get all leads for the year
      supabase
        .from('customer_status_history')
        .select('customer_id, changed_at')
        .eq('company_id', companyID)
        .eq('status', 'lead')
        .gte('changed_at', yearStart)
        .lte('changed_at', yearEnd),
      
      // Get all signed customers for the year
      supabase
        .from('customer_status_history')
        .select('customer_id, changed_at')
        .eq('company_id', companyID)
        .eq('status', 'signed')
        .gte('changed_at', yearStart)
        .lte('changed_at', yearEnd),
      
      // Get all customers created in the year
      supabase
        .from('customers')
        .select('id, created_at')
        .eq('company_id', companyID)
        .gte('created_at', yearStart)
        .lte('created_at', yearEnd)
    ]);

    // Collect unique project IDs that need expense calculations
    const projectIds = new Set();
    (soldHistory || []).forEach(h => projectIds.add(h.project_id));
    (completedHistory || []).forEach(h => projectIds.add(h.project_id));
    const projectIdArray = Array.from(projectIds);

    // Batch fetch all expense data for relevant projects in parallel
    let milestones = [], subcontractorFees = [], materials = [], additionalExpenses = [], equipment = [];
    
    if (projectIdArray.length > 0) {
      const [
        { data: milestonesData },
        { data: subcontractorFeesData },
        { data: materialsData },
        { data: additionalExpensesData },
        { data: equipmentData }
      ] = await Promise.all([
        supabase
          .from('milestones')
          .select('project_id, customer_price')
          .in('project_id', projectIdArray),
        supabase
          .from('project_subcontractor_fees')
          .select('project_id, flat_fee')
          .in('project_id', projectIdArray),
        supabase
          .from('project_materials')
          .select('project_id, actual_price')
          .in('project_id', projectIdArray),
        supabase
          .from('project_additional_expenses')
          .select('project_id, amount')
          .in('project_id', projectIdArray),
        supabase
          .from('project_equipment')
          .select('project_id, actual_price')
          .in('project_id', projectIdArray)
      ]);
      
      milestones = milestonesData || [];
      subcontractorFees = subcontractorFeesData || [];
      materials = materialsData || [];
      additionalExpenses = additionalExpensesData || [];
      equipment = equipmentData || [];
    }

    // Pre-compute expense totals per project
    const projectExpenses = {};
    const projectRevenue = {};
    const projectEstValue = {};
    const projectClosingPrice = {};
    
    // Build lookup for est_value and closing_price from sold/completed history
    (soldHistory || []).forEach(h => {
      projectEstValue[h.project_id] = parseFloat(h.projects?.est_value || 0);
      projectClosingPrice[h.project_id] = parseFloat(h.projects?.closing_price || 0);
    });
    (completedHistory || []).forEach(h => {
      projectEstValue[h.project_id] = parseFloat(h.projects?.est_value || 0);
      projectClosingPrice[h.project_id] = parseFloat(h.projects?.closing_price || 0);
    });
    
    // Calculate revenue per project from milestones (only used if no closing_price)
    milestones.forEach(m => {
      if (!projectRevenue[m.project_id]) projectRevenue[m.project_id] = 0;
      projectRevenue[m.project_id] += parseFloat(m.customer_price || 0);
    });
    
    // Calculate expenses per project
    projectIdArray.forEach(id => {
      projectExpenses[id] = 0;
    });
    
    subcontractorFees.forEach(f => {
      projectExpenses[f.project_id] = (projectExpenses[f.project_id] || 0) + parseFloat(f.flat_fee || 0);
    });
    materials.forEach(m => {
      projectExpenses[m.project_id] = (projectExpenses[m.project_id] || 0) + parseFloat(m.actual_price || 0);
    });
    additionalExpenses.forEach(e => {
      projectExpenses[e.project_id] = (projectExpenses[e.project_id] || 0) + parseFloat(e.amount || 0);
    });
    equipment.forEach(e => {
      projectExpenses[e.project_id] = (projectExpenses[e.project_id] || 0) + parseFloat(e.actual_price || 0);
    });

    // Helper to get month index (0-11) from ISO date string
    const getMonthIndex = (dateStr) => new Date(dateStr).getMonth();

    // Initialize monthly data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = monthNames.map((name, idx) => ({
      month: name,
      monthIndex: idx + 1,
      value: 0,
      revenue: 0,
      profit: 0,
      expenses: 0,
      leads: 0,
      customersSigned: 0,
      sold: 0,
      totalCustomers: 0,
      completedProjects: 0,
      _processedProjects: new Set() // Track processed projects to avoid duplicates
    }));

    // Helper to get revenue: closing_price > milestones > est_value
    const getProjectRevenue = (projectId) => {
      const closingPrice = projectClosingPrice[projectId] || 0;
      if (closingPrice > 0) return closingPrice;
      const milestonesRev = projectRevenue[projectId] || 0;
      if (milestonesRev > 0) return milestonesRev;
      return projectEstValue[projectId] || 0;
    };

    // Process sold projects
    (soldHistory || []).forEach(record => {
      const monthIdx = getMonthIndex(record.changed_at);
      const monthData = monthlyData[monthIdx];
      monthData.sold++;
      
      if (!monthData._processedProjects.has(record.project_id)) {
        monthData._processedProjects.add(record.project_id);
        const estValue = projectEstValue[record.project_id] || 0;
        monthData.value += estValue;
        const rev = getProjectRevenue(record.project_id);
        monthData.revenue += rev;
        monthData.expenses += projectExpenses[record.project_id] || 0;
      }
    });

    // Process completed projects
    (completedHistory || []).forEach(record => {
      const monthIdx = getMonthIndex(record.changed_at);
      const monthData = monthlyData[monthIdx];
      monthData.completedProjects++;
      
      if (!monthData._processedProjects.has(record.project_id)) {
        monthData._processedProjects.add(record.project_id);
        const estValue = projectEstValue[record.project_id] || 0;
        monthData.value += estValue;
        const rev = getProjectRevenue(record.project_id);
        monthData.revenue += rev;
        monthData.expenses += projectExpenses[record.project_id] || 0;
      }
    });

    // Process leads
    (leadsHistory || []).forEach(record => {
      const monthIdx = getMonthIndex(record.changed_at);
      monthlyData[monthIdx].leads++;
    });

    // Process signed customers
    (signedHistory || []).forEach(record => {
      const monthIdx = getMonthIndex(record.changed_at);
      monthlyData[monthIdx].customersSigned++;
    });

    // Process total customers
    (totalCustomers || []).forEach(record => {
      const monthIdx = getMonthIndex(record.created_at);
      monthlyData[monthIdx].totalCustomers++;
    });

    // Calculate profit and clean up internal tracking
    monthlyData.forEach(m => {
      m.profit = m.revenue - m.expenses;
      delete m._processedProjects; // Remove internal tracking property
    });

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
      project_name,
      customer_id,
      address,
      project_type,
      pool_or_spa,
      sq_feet,
      status,
      accessories_features,
      est_value,
      closing_price,
      project_manager,
      notes,
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
          project_name: project_name || null,
          customer_id: customer_id || null,
          address: address || null,
          project_type,
          pool_or_spa,
          sq_feet: sq_feet ? parseFloat(sq_feet) : null,
          status: initialStatus,
          accessories_features: accessories_features || null,
          est_value: est_value ? parseFloat(est_value) : null,
          closing_price: closing_price ? parseFloat(closing_price) : null,
          project_manager: project_manager || null,
          notes: notes || null,
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
      project_name,
      customer_id,
      address,
      project_type,
      pool_or_spa,
      sq_feet,
      status,
      accessories_features,
      est_value,
      closing_price,
      project_manager,
      notes,
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
        project_name: project_name || null,
        customer_id: customer_id || null,
        address: address || null,
        project_type,
        pool_or_spa,
        sq_feet: sq_feet ? parseFloat(sq_feet) : null,
        status: newStatus,
        accessories_features: accessories_features || null,
        est_value: est_value ? parseFloat(est_value) : null,
        closing_price: closing_price ? parseFloat(closing_price) : null,
        project_manager: project_manager || null,
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
      .select('id, est_value, closing_price')
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
      .order('created_at', { ascending: false });

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
      .order('created_at', { ascending: false });

    if (materialsError) {
      console.error('Error fetching materials:', materialsError);
      return res.status(500).json({ error: materialsError.message });
    }

    // Get additional expenses
    const { data: additionalExpenses, error: additionalError } = await supabase
      .from('project_additional_expenses')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (additionalError) {
      return res.status(500).json({ error: additionalError.message });
    }

    // Get equipment expenses with inventory join
    const { data: equipment, error: equipmentError } = await supabase
      .from('project_equipment')
      .select('*, inventory(id, name, unit_price)')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

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
        materialsTotal += parseFloat(entry.actual_price || 0);
        materialsExpected += parseFloat(entry.expected_price || 0);
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
        equipmentTotal += parseFloat(entry.actual_price || 0);
        equipmentExpected += parseFloat(entry.expected_price || 0);
      });
    }

    const totalExpenses = subcontractorTotal + materialsTotal + additionalTotal + equipmentTotal;
    const totalExpected = subcontractorExpected + materialsExpected + additionalExpected + equipmentExpected;
    const estValue = parseFloat(project.est_value || 0);
    const closingPrice = parseFloat(project.closing_price || 0);
    // Use closing_price for profit if set, otherwise fall back to est_value
    const revenueForProfit = closingPrice > 0 ? closingPrice : estValue;
    const profit = revenueForProfit - totalExpenses;
    const expectedProfit = revenueForProfit - totalExpected;

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
        closingPrice: closingPrice,
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

    const { data, error } = await supabase
      .from('project_subcontractor_fees')
      .insert([{
        project_id: id,
        subcontractor_id,
        flat_fee: flat_fee ? parseFloat(flat_fee) : null,
        expected_value: expected_value ? parseFloat(expected_value) : null,
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

    // Note: customer_price column doesn't exist in project_subcontractor_fees table
    // Customer prices are stored in milestones table instead
    // This endpoint is kept for backwards compatibility but doesn't update anything
    // Return success to avoid breaking existing clients
    res.json({ success: true, message: 'Customer prices are managed via milestones table' });
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
    const { flat_fee, expected_value, date_added, status, notes, job_description } = req.body;

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
    const { inventory_id, quantity, date_ordered, date_received, status, expected_price, actual_price, notes } = req.body;

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

    if (!inventory_id) {
      return res.status(400).json({ error: 'inventory_id is required' });
    }

    const { data, error } = await supabase
      .from('project_materials')
      .insert([{
        project_id: id,
        inventory_id,
        quantity: quantity ? parseFloat(quantity) : null,
        date_ordered: date_ordered || null,
        date_received: date_received || null,
        status: status || 'incomplete',
        expected_price: expected_price ? parseFloat(expected_price) : null,
        actual_price: actual_price ? parseFloat(actual_price) : null,
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
    const { inventory_id, quantity, date_ordered, date_received, status, expected_price, actual_price, notes } = req.body;

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

    if (inventory_id !== undefined) updateData.inventory_id = inventory_id;
    if (quantity !== undefined) updateData.quantity = quantity ? parseFloat(quantity) : null;
    if (date_ordered !== undefined) updateData.date_ordered = date_ordered || null;
    if (date_received !== undefined) updateData.date_received = date_received || null;
    if (status !== undefined) updateData.status = status;
    if (expected_price !== undefined) updateData.expected_price = expected_price ? parseFloat(expected_price) : null;
    if (actual_price !== undefined) updateData.actual_price = actual_price ? parseFloat(actual_price) : null;
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
    const { inventory_id, expected_price, actual_price, quantity, date_ordered, date_received, status, notes } = req.body;

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

    if (!inventory_id) {
      return res.status(400).json({ error: 'Equipment inventory item is required' });
    }

    // Fetch inventory item to get the name (required by schema constraint)
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from('inventory')
      .select('name')
      .eq('id', inventory_id)
      .eq('company_id', companyID)
      .single();

    if (inventoryError || !inventoryItem) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const { data, error } = await supabase
      .from('project_equipment')
      .insert([{
        project_id: id,
        company_id: companyID,
        inventory_id: inventory_id,
        name: inventoryItem.name, // Required by schema constraint
        expected_price: expected_price ? parseFloat(expected_price) : null,
        actual_price: actual_price ? parseFloat(actual_price) : null,
        quantity: quantity ? parseInt(quantity) : 1,
        date_ordered: date_ordered || null,
        date_received: date_received || null,
        status: status || 'pending',
        notes: notes || null,
      }])
      .select('*, inventory(id, name, unit_price)')
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
    const { inventory_id, expected_price, actual_price, quantity, date_ordered, date_received, status, notes } = req.body;

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

    // If inventory_id is being updated, fetch the new inventory item name
    if (inventory_id !== undefined) {
      updateData.inventory_id = inventory_id;
      
      // Fetch inventory item to get the name (required by schema constraint)
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from('inventory')
        .select('name')
        .eq('id', inventory_id)
        .eq('company_id', companyID)
        .single();

      if (inventoryError || !inventoryItem) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      updateData.name = inventoryItem.name; // Required by schema constraint
    }

    if (expected_price !== undefined) updateData.expected_price = expected_price ? parseFloat(expected_price) : null;
    if (actual_price !== undefined) updateData.actual_price = actual_price ? parseFloat(actual_price) : null;
    if (quantity !== undefined) updateData.quantity = quantity ? parseInt(quantity) : 1;
    if (date_ordered !== undefined) updateData.date_ordered = date_ordered || null;
    if (date_received !== undefined) updateData.date_received = date_received || null;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;

    const { data, error } = await supabase
      .from('project_equipment')
      .update(updateData)
      .eq('id', equipmentId)
      .eq('project_id', id)
      .eq('company_id', companyID)
      .select('*, inventory(id, name, unit_price)')
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
      .order('created_at', { ascending: false });

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
      .order('created_at', { ascending: false });

    const { data: additionalExpenses } = await supabase
      .from('project_additional_expenses')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    // Get equipment expenses with inventory join (same as expenses endpoint)
    const { data: equipment, error: equipmentError } = await supabase
      .from('project_equipment')
      .select('*, inventory(id, name, unit_price)')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (equipmentError) {
      console.error('Error fetching equipment for contract:', equipmentError);
      // Don't fail - return empty array, but log the error
    }

    // Calculate totals
    let subcontractorTotal = 0;
    if (subcontractorFees) {
      subcontractorFees.forEach((entry) => {
        subcontractorTotal += parseFloat(entry.expected_value || entry.flat_fee || 0);
      });
    }

    let materialsTotal = 0;
    let materialsExpectedTotal = 0;
    if (materials) {
      materials.forEach((entry) => {
        materialsTotal += parseFloat(entry.actual_price || 0);
        materialsExpectedTotal += parseFloat(entry.expected_price || entry.actual_price || 0);
      });
    }

    let additionalTotal = 0;
    if (additionalExpenses) {
      additionalExpenses.forEach((entry) => {
        additionalTotal += parseFloat(entry.expected_value || entry.amount || 0);
      });
    }

    let equipmentTotal = 0;
    let equipmentExpectedTotal = 0;
    if (equipment) {
      equipment.forEach((entry) => {
        // Match expenses endpoint calculation: prices are totals, not per-unit
        equipmentTotal += parseFloat(entry.actual_price || 0);
        equipmentExpectedTotal += parseFloat(entry.expected_price || 0);
      });
    }

    // Get saved milestones for this project filtered by document type
    const { data: savedMilestones } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id)
      .eq('document_type', document_type)
      .order('sort_order', { ascending: true });

    // Get saved scope of work items for this project filtered by document type
    const { data: savedScopeOfWork } = await supabase
      .from('scope_of_work')
      .select('*')
      .eq('project_id', id)
      .eq('document_type', document_type)
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
        materialsExpected: materialsExpectedTotal,
        additional: additionalTotal,
        equipment: equipmentTotal,
        equipmentExpected: equipmentExpectedTotal,
        initialFee: 1000,
        finalInspection: 1000,
        grandTotal: parseFloat(project.est_value || 0),
      },
      savedMilestones: savedMilestones || [], // Previously saved customer prices for this project
      savedScopeOfWork: savedScopeOfWork || [], // Previously saved scope of work items for this project
      savedCustomerPrice: project.customer_price ? parseFloat(project.customer_price) : null, // Total customer price from project
    });
  } catch (error) {
    console.error('Generate document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== MILESTONES ENDPOINTS ====================

// Get milestones for a project (optionally filtered by document type)
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
    const { document_type } = req.query; // Optional filter by document type

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

    // Build query for milestones
    let query = supabase
      .from('milestones')
      .select('*')
      .eq('project_id', id);

    // Filter by document type if provided
    if (document_type) {
      query = query.eq('document_type', document_type);
    }

    const { data: milestones, error } = await query.order('sort_order', { ascending: true });

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
    const { milestones, document_type, customer_price } = req.body;

    if (!milestones || !Array.isArray(milestones)) {
      return res.status(400).json({ error: 'milestones array is required' });
    }

    // Default to 'contract' if no document_type provided
    const docType = document_type || 'contract';

    // Validate document_type
    const validDocTypes = ['proposal', 'contract', 'change_order'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ error: 'Invalid document_type. Must be proposal, contract, or change_order' });
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

    // If customer_price is provided, update the project's customer_price
    if (customer_price !== undefined && customer_price !== null) {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          customer_price: parseFloat(customer_price) || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('company_id', companyID);

      if (updateError) {
        console.error('Error updating project customer_price:', updateError);
      }
    }

    // Delete existing milestones for this project AND document type only
    await supabase
      .from('milestones')
      .delete()
      .eq('project_id', id)
      .eq('company_id', companyID)
      .eq('document_type', docType);

    // Insert new milestones with document_type
    const milestonesToInsert = milestones.map((m, index) => ({
      company_id: companyID,
      project_id: id,
      name: m.name,
      description: m.description || null,
      milestone_type: m.milestone_type || 'custom',
      cost: parseFloat(m.cost) || 0,
      customer_price: parseFloat(m.customer_price) || 0,
      subcontractor_fee_id: m.subcontractor_fee_id || null,
      sort_order: index,
      document_type: docType,
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

// ==================== SCOPE OF WORK ENDPOINTS ====================

// Get scope of work items for a project (optionally filtered by document type)
app.get('/api/projects/:id/scope-of-work', async (req, res) => {
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
    const { document_type } = req.query; // Optional filter by document type

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

    // Build query for scope of work items
    let query = supabase
      .from('scope_of_work')
      .select('*')
      .eq('project_id', id);

    // Filter by document type if provided
    if (document_type) {
      query = query.eq('document_type', document_type);
    }

    const { data: scopeOfWork, error } = await query.order('sort_order', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ scopeOfWork: scopeOfWork || [] });
  } catch (error) {
    console.error('Get scope of work error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save/update scope of work items for a project (batch operation)
app.put('/api/projects/:id/scope-of-work', async (req, res) => {
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
    const { scopeOfWork, document_type } = req.body;

    if (!scopeOfWork || !Array.isArray(scopeOfWork)) {
      return res.status(400).json({ error: 'scopeOfWork array is required' });
    }

    // Default to 'contract' if no document_type provided
    const docType = document_type || 'contract';

    // Validate document_type
    const validDocTypes = ['proposal', 'contract', 'change_order'];
    if (!validDocTypes.includes(docType)) {
      return res.status(400).json({ error: 'Invalid document_type. Must be proposal, contract, or change_order' });
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

    // Delete existing scope of work items for this project AND document type only
    await supabase
      .from('scope_of_work')
      .delete()
      .eq('project_id', id)
      .eq('company_id', companyID)
      .eq('document_type', docType);

    // Insert new scope of work items with document_type
    const itemsToInsert = scopeOfWork
      .filter(item => item.title && item.title.trim()) // Only insert items with a title
      .map((item, index) => ({
        company_id: companyID,
        project_id: id,
        title: item.title,
        description: item.description || null,
        sort_order: index,
        document_type: docType,
      }));

    if (itemsToInsert.length === 0) {
      return res.json({ scopeOfWork: [] });
    }

    const { data: savedItems, error: insertError } = await supabase
      .from('scope_of_work')
      .insert(itemsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting scope of work:', insertError);
      return res.status(500).json({ error: insertError.message });
    }

    res.json({ scopeOfWork: savedItems });
  } catch (error) {
    console.error('Save scope of work error:', error);
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
      type,
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
          type: type || 'material',
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
      type,
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
        type: type || 'material',
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
        file_path: doc.file_path,
        path: doc.file_path,
        size: doc.file_size,
        mime_type: doc.mime_type,
        notes: doc.notes,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        esign_status: doc.esign_status,
        esign_contract_id: doc.esign_contract_id,
        esign_completed_at: doc.esign_completed_at,
      }));

      return res.json({ documents });
    }

    // For subcontractors, fetch from subcontractor_documents table
    if (entityType === 'subcontractors') {
      const { data: subcontractorDocs, error: docsError } = await supabase
        .from('subcontractor_documents')
        .select('*')
        .eq('subcontractor_id', entityId)
        .eq('company_id', companyID)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching subcontractor documents:', docsError);
        return res.status(500).json({ error: docsError.message });
      }

      const documents = (subcontractorDocs || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        document_type: doc.document_type,
        file_name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size,
        mime_type: doc.mime_type,
        notes: doc.notes,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      }));

      return res.json({ documents });
    }

    // For customers, fetch from customer_documents table
    if (entityType === 'customers') {
      const { data: customerDocs, error: docsError } = await supabase
        .from('customer_documents')
        .select('*')
        .eq('customer_id', entityId)
        .eq('company_id', companyID)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching customer documents:', docsError);
        return res.status(500).json({ error: docsError.message });
      }

      const documents = (customerDocs || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        document_type: doc.document_type,
        file_name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size,
        mime_type: doc.mime_type,
        notes: doc.notes,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      }));

      return res.json({ documents });
    }

    // For inventory, fetch from inventory_documents table
    if (entityType === 'inventory') {
      const { data: inventoryDocs, error: docsError } = await supabase
        .from('inventory_documents')
        .select('*')
        .eq('inventory_id', entityId)
        .eq('company_id', companyID)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.error('Error fetching inventory documents:', docsError);
        return res.status(500).json({ error: docsError.message });
      }

      const documents = (inventoryDocs || []).map(doc => ({
        id: doc.id,
        name: doc.name,
        document_type: doc.document_type,
        file_name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size,
        mime_type: doc.mime_type,
        notes: doc.notes,
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
    // For subcontractors, use "subcontractor" folder instead of "subcontractors"
    const folderName = entityType === 'subcontractors' ? 'subcontractor' : entityType;
    const storagePath = `${folderName}/${companyID}/${entityId}/${req.file.originalname}`;
    
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

      return res.json({ 
        success: true, 
        path: uploadData.path,
        document: docRecord || null,
        message: 'Document uploaded successfully'
      });
    }

    // For subcontractors, save document metadata to subcontractor_documents table
    if (entityType === 'subcontractors') {
      const validDocTypes = ['coi', 'license', 'insurance', 'contract', 'other'];
      const docType = validDocTypes.includes(document_type) ? document_type : 'other';
      
      const { data: docRecord, error: docError } = await supabase
        .from('subcontractor_documents')
        .insert([{
          company_id: companyID,
          subcontractor_id: entityId,
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
        console.error('Error saving subcontractor document metadata:', docError);
        // Don't fail the upload, just log the error
      }

      return res.json({ 
        success: true, 
        path: uploadData.path,
        document: docRecord || null,
        message: 'Document uploaded successfully'
      });
    }

    // For customers, save document metadata to customer_documents table
    if (entityType === 'customers') {
      const validDocTypes = ['contract', 'proposal', 'invoice', 'receipt', 'other'];
      const docType = validDocTypes.includes(document_type) ? document_type : 'other';
      
      const { data: docRecord, error: docError } = await supabase
        .from('customer_documents')
        .insert([{
          company_id: companyID,
          customer_id: entityId,
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
        console.error('Error saving customer document metadata:', docError);
        // Don't fail the upload, just log the error
      }

      return res.json({ 
        success: true, 
        path: uploadData.path,
        document: docRecord || null,
        message: 'Document uploaded successfully'
      });
    }

    // For inventory, save document metadata to inventory_documents table
    if (entityType === 'inventory') {
      const validDocTypes = ['warranty', 'manual', 'receipt', 'invoice', 'other'];
      const docType = validDocTypes.includes(document_type) ? document_type : 'other';
      
      const { data: docRecord, error: docError } = await supabase
        .from('inventory_documents')
        .insert([{
          company_id: companyID,
          inventory_id: entityId,
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
        console.error('Error saving inventory document metadata:', docError);
        // Don't fail the upload, just log the error
      }

      return res.json({ 
        success: true, 
        path: uploadData.path,
        document: docRecord || null,
        message: 'Document uploaded successfully'
      });
    }

    // For other entity types, just return success
    res.json({ 
      success: true, 
      path: uploadData.path,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update document notes
app.put('/api/documents/:entityType/:entityId/:documentId/notes', async (req, res) => {
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

    const { entityType, entityId, documentId } = req.params;
    const { notes } = req.body;

    if (entityType === 'projects') {
      // Verify project belongs to user's company
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, company_id')
        .eq('id', entityId)
        .eq('company_id', companyID)
        .single();

      if (projectError || !project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Update notes in project_documents
      const { data: updatedDoc, error: updateError } = await supabase
        .from('project_documents')
        .update({ notes: notes || null })
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('project_id', entityId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating document notes:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({ success: true, document: updatedDoc });
    } else if (entityType === 'subcontractors') {
      // Verify subcontractor belongs to user's company
      const { data: subcontractor, error: subcontractorError } = await supabase
        .from('subcontractors')
        .select('id, company_id')
        .eq('id', entityId)
        .eq('company_id', companyID)
        .single();

      if (subcontractorError || !subcontractor) {
        return res.status(404).json({ error: 'Subcontractor not found' });
      }

      // Update notes in subcontractor_documents
      const { data: updatedDoc, error: updateError } = await supabase
        .from('subcontractor_documents')
        .update({ notes: notes || null })
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('subcontractor_id', entityId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating document notes:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({ success: true, document: updatedDoc });
    } else if (entityType === 'customers') {
      // Verify customer belongs to user's company
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, company_id')
        .eq('id', entityId)
        .eq('company_id', companyID)
        .single();

      if (customerError || !customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      // Update notes in customer_documents
      const { data: updatedDoc, error: updateError } = await supabase
        .from('customer_documents')
        .update({ notes: notes || null })
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('customer_id', entityId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating document notes:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({ success: true, document: updatedDoc });
    } else if (entityType === 'inventory') {
      // Verify inventory item belongs to user's company
      const { data: inventoryItem, error: inventoryError } = await supabase
        .from('inventory')
        .select('id, company_id')
        .eq('id', entityId)
        .eq('company_id', companyID)
        .single();

      if (inventoryError || !inventoryItem) {
        return res.status(404).json({ error: 'Inventory item not found' });
      }

      // Update notes in inventory_documents
      const { data: updatedDoc, error: updateError } = await supabase
        .from('inventory_documents')
        .update({ notes: notes || null })
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('inventory_id', entityId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating document notes:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({ success: true, document: updatedDoc });
    } else {
      return res.status(400).json({ error: 'Notes can only be updated for projects, subcontractors, customers, and inventory' });
    }
  } catch (error) {
    console.error('Update document notes error:', error);
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
    // For subcontractors, use "subcontractor" folder instead of "subcontractors"
    const folderName = entityType === 'subcontractors' ? 'subcontractor' : entityType;
    const storagePath = `${folderName}/${companyID}/${entityId}/${fileName}`;
    
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([storagePath]);

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

    // If documentId provided and this is a subcontractor, also delete from subcontractor_documents table
    if (documentId && entityType === 'subcontractors') {
      const { error: dbDeleteError } = await supabase
        .from('subcontractor_documents')
        .delete()
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('subcontractor_id', entityId);

      if (dbDeleteError) {
        console.error('Error deleting from subcontractor_documents:', dbDeleteError);
      }
    }

    // If documentId provided and this is a customer, also delete from customer_documents table
    if (documentId && entityType === 'customers') {
      const { error: dbDeleteError } = await supabase
        .from('customer_documents')
        .delete()
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('customer_id', entityId);

      if (dbDeleteError) {
        console.error('Error deleting from customer_documents:', dbDeleteError);
      }
    }

    // If documentId provided and this is inventory, also delete from inventory_documents table
    if (documentId && entityType === 'inventory') {
      const { error: dbDeleteError } = await supabase
        .from('inventory_documents')
        .delete()
        .eq('id', documentId)
        .eq('company_id', companyID)
        .eq('inventory_id', entityId);

      if (dbDeleteError) {
        console.error('Error deleting from inventory_documents:', dbDeleteError);
      }
    }

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get document download URL by document ID (uses stored file_path)
app.get('/api/documents/by-id/:documentId/download', async (req, res) => {
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

    const { documentId } = req.params;

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('project_documents')
      .select('id, file_path, file_name, company_id')
      .eq('id', documentId)
      .eq('company_id', companyID)
      .single();

    if (docError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.file_path) {
      return res.status(400).json({ error: 'Document has no file path' });
    }

    // Get signed URL using the stored file_path
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 3600);

    if (urlError) {
      console.error('URL Error for document', documentId, ':', urlError);
      return res.status(500).json({ error: urlError.message });
    }

    res.json({ url: urlData.signedUrl });
  } catch (error) {
    console.error('Get download URL by ID error:', error);
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
    // For subcontractors, use "subcontractor" folder instead of "subcontractors"
    const folderName = entityType === 'subcontractors' ? 'subcontractor' : entityType;
    const storagePath = `${folderName}/${companyID}/${entityId}/${fileName}`;
    
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

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

      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const record of allProjects) {
        // Skip duplicates
        if (processedProjectIds.has(record.project_id)) continue;
        processedProjectIds.add(record.project_id);

        const estValue = parseFloat(record.projects?.est_value || 0);

        // Get revenue from milestones (customer_price) - same as dashboard
        const { data: milestones } = await supabase
          .from('milestones')
          .select('customer_price')
          .eq('project_id', record.project_id);

        // Calculate revenue from milestones
        let projectRevenue = 0;
        if (milestones) {
          milestones.forEach((milestone) => {
            projectRevenue += parseFloat(milestone.customer_price || 0);
          });
        }
        // If no milestones, fall back to est_value (same as dashboard)
        if (projectRevenue === 0) {
          projectRevenue = estValue;
        }
        totalRevenue += projectRevenue;

        // Get expenses for this project
        const { data: subcontractorFees } = await supabase
          .from('project_subcontractor_fees')
          .select('flat_fee')
          .eq('project_id', record.project_id);

        const { data: materials } = await supabase
          .from('project_materials')
          .select('actual_price')
          .eq('project_id', record.project_id);

        const { data: additionalExpenses } = await supabase
          .from('project_additional_expenses')
          .select('amount')
          .eq('project_id', record.project_id);

        const { data: equipment } = await supabase
          .from('project_equipment')
          .select('actual_price')
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
            materialsTotal += parseFloat(entry.actual_price || 0);
          });
        }

        // Calculate additional expenses
        let additionalTotal = 0;
        if (additionalExpenses) {
          additionalExpenses.forEach((entry) => {
            additionalTotal += parseFloat(entry.amount || 0);
          });
        }

        // Calculate equipment costs
        let equipmentTotal = 0;
        if (equipment) {
          equipment.forEach((entry) => {
            equipmentTotal += parseFloat(entry.actual_price || 0);
          });
        }

        totalExpenses += subcontractorTotal + materialsTotal + additionalTotal + equipmentTotal;
      }

      return totalRevenue - totalExpenses;
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

// ==================== ESIGNATURES ENDPOINTS ====================

// Send document via eSignatures.com for e-signature
app.post('/api/esign/send', async (req, res) => {
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

    const { documentUrl, documentName, recipientEmail, recipientName, subject, message, documentId } = req.body;

    if (!documentUrl || !documentName) {
      return res.status(400).json({ error: 'Document URL and name are required' });
    }

    if (!recipientEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (!subject) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    // Get company info for branding
    let companyName = null;
    let companyLogoUrl = null;
    try {
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('company_name, logo_url')
        .eq('company_id', companyID)
        .single();
      
      if (!companyError && company) {
        companyName = company.company_name || companyID;
        companyLogoUrl = company.logo_url || null;
      } else {
        companyName = companyID; // Fallback to company ID if name not found
      }
    } catch (error) {
      console.warn('Error fetching company info, using company ID:', error);
      companyName = companyID; // Fallback to company ID
    }

    // Get sender's name (current logged in user) for contractor signature
    const senderName = user.user_metadata?.full_name || 
                       user.user_metadata?.name || 
                       user.user_metadata?.display_name ||
                       user.email;

    // Send contract via BoldSign
    let contractResult;
    try {
      contractResult = await esignaturesService.sendContractForSignature({
        documentUrl,
        documentName,
        recipientEmail,
        recipientName: recipientName || recipientEmail,
        subject,
        message: message || '',
        companySignerEmail: user.email, // Add sender as company signer (second signer)
        companySignerName: senderName,
        companyName,
        companyLogoUrl,
      });
    } catch (esignError) {
      console.error('BoldSign error:', esignError);
      return res.status(500).json({ error: 'Failed to send for signature: ' + esignError.message });
    }

    // Update project_documents table with contract ID if documentId is provided
    if (documentId) {
      const { error: updateError } = await supabase
        .from('project_documents')
        .update({
          esign_contract_id: contractResult.contractId,
          esign_status: 'sent',
          status: 'sent',
          esign_sent_at: new Date().toISOString(),
          esign_sender_email: user.email,
          esign_sender_company_id: companyID,
        })
        .eq('id', documentId)
        .eq('company_id', companyID);

      if (updateError) {
        console.error('Error updating document with contract ID:', updateError);
        // Don't fail the request if update fails
      }
    }

    res.json({ 
      success: true, 
      message: 'Document sent for signature',
      contractId: contractResult.contractId,
    });
  } catch (error) {
    console.error('eSign send error:', error);
    res.status(500).json({ error: error.message || 'Failed to send document for signature' });
  }
});

// Manual sync endpoint - check document status and download signed version if completed
app.post('/api/esign/sync/:documentId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { documentId } = req.params;

    // Find document in database
    const { data: document, error: findError } = await supabase
      .from('project_documents')
      .select('id, name, project_id, company_id, file_name, document_type, esign_contract_id, esign_status')
      .eq('id', documentId)
      .single();

    if (findError || !document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.esign_contract_id) {
      return res.status(400).json({ error: 'Document has not been sent for signature' });
    }

    // Check status from BoldSign
    const statusResult = await esignaturesService.getContractStatus(document.esign_contract_id);

    // Update esign_status in database (don't change regular status - only signed doc gets 'signed' status)
    const updateData = { 
      esign_status: statusResult.status,
    };
    
    if (statusResult.status === 'completed') {
      updateData.esign_completed_at = new Date().toISOString();
    }

    await supabase
      .from('project_documents')
      .update(updateData)
      .eq('id', document.id);

    // If completed, download and upload signed document
    if (statusResult.status === 'completed') {
      try {
        const signedPdfBuffer = await esignaturesService.downloadSignedDocument(document.esign_contract_id);
        
        // Create filename for signed version
        const originalName = document.file_name || document.name || 'document';
        const baseName = originalName.replace(/\.pdf$/i, '');
        const signedFileName = `${baseName}_signed.pdf`;
        
        // Upload to Supabase storage
        const storagePath = `projects/${document.company_id}/${document.project_id}/${signedFileName}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, signedPdfBuffer, {
            contentType: 'application/pdf',
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('Error uploading signed document:', uploadError);
          return res.json({ 
            success: true, 
            status: statusResult.status,
            signedDocumentUploaded: false,
            error: 'Failed to upload signed document'
          });
        }
        
        // Check if signed document record already exists
        const { data: existingSignedDoc } = await supabase
          .from('project_documents')
          .select('id')
          .eq('esign_contract_id', document.esign_contract_id)
          .eq('esign_status', 'signed')
          .single();

        if (!existingSignedDoc) {
          // Create new document record for the signed version
          const { data: signedDocRecord, error: signedDocError } = await supabase
            .from('project_documents')
            .insert([{
              company_id: document.company_id,
              project_id: document.project_id,
              name: `${document.name} (Signed)`,
              document_type: document.document_type || 'contract',
              file_name: signedFileName,
              file_path: storagePath,
              file_size: signedPdfBuffer.length,
              mime_type: 'application/pdf',
              status: 'signed',
              esign_status: 'signed',
              esign_contract_id: document.esign_contract_id,
              esign_completed_at: new Date().toISOString(),
            }])
            .select()
            .single();

          if (signedDocError) {
            console.error('Error creating signed document record:', signedDocError);
          }
        }

        return res.json({ 
          success: true, 
          status: statusResult.status,
          signedDocumentUploaded: true,
          message: 'Signed document downloaded and uploaded successfully'
        });
      } catch (downloadError) {
        console.error('Error downloading signed document:', downloadError);
        return res.json({ 
          success: true, 
          status: statusResult.status,
          signedDocumentUploaded: false,
          error: 'Failed to download signed document: ' + downloadError.message
        });
      }
    }

    res.json({ 
      success: true, 
      status: statusResult.status,
      message: statusResult.status === 'completed' ? 'Document is completed' : 'Document is still pending signatures'
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: error.message || 'Failed to sync document status' });
  }
});

// eSignatures.com webhook endpoint for status updates
app.post('/api/esign/webhook', async (req, res) => {
  try {
    // BoldSign webhook format
    const webhookData = req.body;
    

    // Handle verification event (sent when webhook is first configured)
    const eventType = webhookData.event?.eventType || webhookData.eventType;
    if (eventType === 'Verification') {
      return res.status(200).json({ received: true, message: 'Verification successful' });
    }

    // Get document ID and event from webhook data
    // BoldSign format varies - try multiple paths
    const contractId = webhookData.document?.documentId || 
                       webhookData.documentId || 
                       webhookData.data?.documentId ||
                       webhookData.document?.DocumentId;
    const event = eventType || webhookData.event?.Type || webhookData.Event;


    if (!contractId) {
      console.error('Webhook missing documentId:', webhookData);
      // Return 200 to acknowledge receipt
      return res.status(200).json({ received: true, error: 'Missing documentId' });
    }

    // Map BoldSign event to our internal status
    const status = esignaturesService.mapWebhookEventToStatus(event, webhookData);

    if (!status) {
      // Unknown event type, just acknowledge
      return res.status(200).json({ received: true, event });
    }

    // Normalize status to our allowed values
    const validStatuses = ['sent', 'delivered', 'signed', 'completed', 'declined', 'voided'];
    const normalizedStatus = validStatuses.includes(status) ? status : 'sent';

    // Find document by contract ID
    const { data: documents, error: findError } = await supabase
      .from('project_documents')
      .select('id, name, esign_sender_email, esign_sender_company_id, esign_status')
      .eq('esign_contract_id', contractId)
      .limit(1);

    if (findError) {
      console.error('Error finding document:', findError);
      return res.status(200).json({ received: true, error: 'Database error' });
    }

    if (documents && documents.length > 0) {
      const document = documents[0];
      const updateData = {
        esign_status: normalizedStatus,
        // Don't update regular status - only the signed document gets 'signed' status
      };

      // Set completed_at if status is completed
      if (normalizedStatus === 'completed') {
        updateData.esign_completed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('project_documents')
        .update(updateData)
        .eq('id', document.id);

      if (updateError) {
        console.error('Error updating document status:', updateError);
        return res.status(200).json({ received: true, error: 'Update failed' });
      }


      // If document is completed (both parties signed), download and upload signed copy
      if (normalizedStatus === 'completed') {
        try {
          // Get original document details to find project_id and company_id
          const { data: fullDoc, error: fullDocError } = await supabase
            .from('project_documents')
            .select('id, name, project_id, company_id, file_name, document_type')
            .eq('id', document.id)
            .single();

          if (fullDocError || !fullDoc) {
            console.error('Error fetching full document details:', fullDocError);
          } else {
            // Download signed document from BoldSign
            const signedPdfBuffer = await esignaturesService.downloadSignedDocument(contractId);
            
            // Create filename for signed version
            const originalName = fullDoc.file_name || fullDoc.name || 'document';
            const baseName = originalName.replace(/\.pdf$/i, '');
            const signedFileName = `${baseName}_signed.pdf`;
            
            // Upload to Supabase storage
            const storagePath = `projects/${fullDoc.company_id}/${fullDoc.project_id}/${signedFileName}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('documents')
              .upload(storagePath, signedPdfBuffer, {
                contentType: 'application/pdf',
                cacheControl: '3600',
                upsert: true, // Overwrite if exists
              });

            if (uploadError) {
              console.error('Error uploading signed document:', uploadError);
            } else {
              
              // Create new document record for the signed version
              const { data: signedDocRecord, error: signedDocError } = await supabase
                .from('project_documents')
                .insert([{
                  company_id: fullDoc.company_id,
                  project_id: fullDoc.project_id,
                  name: `${fullDoc.name} (Signed)`,
                  document_type: fullDoc.document_type || 'contract',
                  file_name: signedFileName,
                  file_path: storagePath,
                  file_size: signedPdfBuffer.length,
                  mime_type: 'application/pdf',
                  status: 'signed',
                  esign_status: 'signed',
                  esign_contract_id: contractId,
                  esign_completed_at: new Date().toISOString(),
                }])
                .select()
                .single();

              if (signedDocError) {
                console.error('Error creating signed document record:', signedDocError);
              }
            }
          }
        } catch (downloadError) {
          console.error('Error downloading/uploading signed document:', downloadError);
          // Don't fail the webhook - the status update was successful
        }
      }
    } else {
      console.log(`No document found for contract ID: ${contractId}`);
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still return 200 to prevent retrying
    res.status(200).json({ received: true, error: error.message });
  }
});

// ==================== Google Calendar OAuth Endpoints ====================

// Initiate Google OAuth flow
app.get('/api/google/oauth/authorize', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const authUrl = googleCalendarService.getAuthUrl(user.id);
    res.json({ authUrl });
  } catch (error) {
    console.error('OAuth authorize error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate OAuth URL' });
  }
});

// Handle Google OAuth callback
app.get('/api/google/oauth/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?section=calendar&error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?section=calendar&error=${encodeURIComponent('Missing code or state')}`);
    }

    const result = await googleCalendarService.handleOAuthCallback(code, state);
    
    // Redirect to frontend dashboard with calendar section active
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?section=calendar&success=true&email=${encodeURIComponent(result.email || '')}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard?section=calendar&error=${encodeURIComponent(error.message || 'OAuth failed')}`;
    res.redirect(redirectUrl);
  }
});

// ==================== Google Calendar API Endpoints ====================

// Check Google Calendar connection status
app.get('/api/google/calendar/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const connected = await googleCalendarService.isConnected(user.id);
    const email = connected ? await googleCalendarService.getCalendarEmail(user.id) : null;

    res.json({ connected, email });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: error.message || 'Failed to check status' });
  }
});

// Get events from Google Calendar
app.get('/api/google/calendar/events', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { timeMin, timeMax } = req.query;
    const events = await googleCalendarService.getEvents(user.id, timeMin, timeMax);

    res.json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch events' });
  }
});

// Create event in Google Calendar
app.post('/api/google/calendar/events', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { name, summary, description, startDateTime, endDateTime, start, end, timeZone, location } = req.body;

    if (!name && !summary) {
      return res.status(400).json({ error: 'Event name/summary is required' });
    }

    if (!startDateTime && !start) {
      return res.status(400).json({ error: 'Start date/time is required' });
    }

    // Calculate end time if not provided (default to 1 hour after start)
    let endTime = endDateTime || end;
    if (!endTime) {
      const startTime = new Date(startDateTime || start);
      endTime = new Date(startTime.getTime() + 60 * 60 * 1000).toISOString();
    }

    const eventData = {
      name: name || summary,
      summary: summary || name,
      description,
      startDateTime: startDateTime || start,
      endDateTime: endTime,
      timeZone: timeZone || 'America/New_York',
      location,
    };

    const event = await googleCalendarService.createEvent(user.id, eventData);

    res.json({ event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: error.message || 'Failed to create event' });
  }
});

// Update event in Google Calendar
app.put('/api/google/calendar/events/:eventId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { eventId } = req.params;
    const { name, summary, description, startDateTime, endDateTime, start, end, timeZone, location } = req.body;

    const eventData = {
      ...(name && { name }),
      ...(summary && { summary }),
      ...(name && !summary && { summary: name }),
      ...(summary && !name && { name: summary }),
      ...(description !== undefined && { description }),
      ...(startDateTime && { startDateTime }),
      ...(start && !startDateTime && { startDateTime: start }),
      ...(endDateTime && { endDateTime }),
      ...(end && !endDateTime && { endDateTime: end }),
      ...(timeZone && { timeZone }),
      ...(location !== undefined && { location }),
    };

    const event = await googleCalendarService.updateEvent(user.id, eventId, eventData);

    res.json({ event });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
});

// Delete event from Google Calendar
app.delete('/api/google/calendar/events/:eventId', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { eventId } = req.params;
    await googleCalendarService.deleteEvent(user.id, eventId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete event' });
  }
});

// Disconnect Google Calendar
app.post('/api/google/calendar/disconnect', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    await googleCalendarService.disconnect(user.id);

    res.json({ success: true });
  } catch (error) {
    console.error('Disconnect error:', error);
    res.status(500).json({ error: error.message || 'Failed to disconnect' });
  }
});

// ============================================
// SMS Messages Endpoints (Twilio Integration)
// ============================================

// Get all conversations (messages grouped by customer/phone)
app.get('/api/messages', async (req, res) => {
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

    // Get all messages for the company, ordered by created_at descending
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select(`
        *,
        customer:customers(id, first_name, last_name, phone, email)
      `)
      .eq('company_id', companyID)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Group messages by customer_id or phone_number to create conversations
    const conversationsMap = new Map();
    
    for (const message of messages || []) {
      const key = message.customer_id || message.phone_number;
      
      if (!conversationsMap.has(key)) {
        conversationsMap.set(key, {
          id: key,
          customer_id: message.customer_id,
          customer: message.customer,
          phone_number: message.phone_number,
          last_message: message,
          unread_count: 0,
          messages: []
        });
      }
      
      const conversation = conversationsMap.get(key);
      conversation.messages.push(message);
      
      if (!message.is_read && message.direction === 'inbound') {
        conversation.unread_count++;
      }
    }

    // Convert to array and sort by last message time
    const conversations = Array.from(conversationsMap.values())
      .sort((a, b) => new Date(b.last_message.created_at) - new Date(a.last_message.created_at));

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unread message count
app.get('/api/messages/unread-count', async (req, res) => {
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

    const { count, error } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyID)
      .eq('is_read', false)
      .eq('direction', 'inbound');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ unread_count: count || 0 });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation with a specific customer
app.get('/api/messages/conversation/:customerId', async (req, res) => {
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

    const { customerId } = req.params;

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, first_name, last_name, phone, email')
      .eq('id', customerId)
      .eq('company_id', companyID)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Get messages for this customer
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('company_id', companyID)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      customer,
      messages: messages || []
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send a new SMS message
app.post('/api/messages', async (req, res) => {
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

    const { customer_id, phone_number, message_body } = req.body;

    if (!message_body) {
      return res.status(400).json({ error: 'Message body is required' });
    }

    if (!customer_id && !phone_number) {
      return res.status(400).json({ error: 'Either customer_id or phone_number is required' });
    }

    // If customer_id provided, get the customer's phone number
    let targetPhone = phone_number;
    let targetCustomerId = customer_id;

    if (customer_id) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id, phone, first_name, last_name')
        .eq('id', customer_id)
        .eq('company_id', companyID)
        .single();

      if (customerError || !customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }

      if (!customer.phone) {
        return res.status(400).json({ error: 'Customer does not have a phone number' });
      }

      targetPhone = customer.phone;
      targetCustomerId = customer.id;
    }

    // Check if Twilio is configured
    if (!smsService.isConfigured()) {
      return res.status(503).json({ error: 'SMS service is not configured. Please set up Twilio credentials.' });
    }

    // Send the SMS via Twilio
    const twilioResponse = await smsService.sendSMS(targetPhone, message_body);

    // Store the message in the database
    const { data: message, error } = await supabase
      .from('sms_messages')
      .insert({
        company_id: companyID,
        customer_id: targetCustomerId || null,
        phone_number: targetPhone,
        message_body: message_body,
        direction: 'outbound',
        twilio_sid: twilioResponse.sid,
        status: twilioResponse.status,
        is_read: true // Outbound messages are automatically "read"
      })
      .select()
      .single();

    if (error) {
      console.error('Error storing message:', error);
      // Message was sent but not stored - still return success
      return res.json({ 
        message: { twilio_sid: twilioResponse.sid },
        warning: 'Message sent but failed to store in database'
      });
    }

    res.json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: error.message || 'Failed to send message' });
  }
});

// Mark a single message as read
app.patch('/api/messages/:id/read', async (req, res) => {
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
      .from('sms_messages')
      .update({ is_read: true })
      .eq('id', id)
      .eq('company_id', companyID)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: data });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark all messages in a conversation as read
app.patch('/api/messages/mark-all-read', async (req, res) => {
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

    const { customer_id, phone_number } = req.body;

    if (!customer_id && !phone_number) {
      return res.status(400).json({ error: 'Either customer_id or phone_number is required' });
    }

    let query = supabase
      .from('sms_messages')
      .update({ is_read: true })
      .eq('company_id', companyID)
      .eq('is_read', false)
      .eq('direction', 'inbound');

    if (customer_id) {
      query = query.eq('customer_id', customer_id);
    } else {
      query = query.eq('phone_number', phone_number);
    }

    const { data, error } = await query.select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ updated_count: data?.length || 0 });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Infobip webhook for incoming SMS messages
// Note: This endpoint doesn't require auth token - it's called by Infobip
// Configure this URL in your Infobip portal under: Channels & Numbers > Numbers > Your Number > Forward to HTTP
app.post('/api/sms/webhook', async (req, res) => {
  try {
    // Validate that the request is from Infobip (optional - uses secret header)
    if (!smsService.validateWebhook(req)) {
      console.warn('Invalid Infobip webhook request');
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Parse the incoming message (Infobip sends JSON)
    const incomingMessage = smsService.parseIncomingMessage(req.body);
    
    if (!incomingMessage.from || !incomingMessage.body) {
      // Acknowledge receipt even without valid message data
      return res.status(200).json({ status: 'received' });
    }

    // Normalize the phone number
    const normalizedPhone = smsService.normalizePhoneNumber(incomingMessage.from);

    // Try to find a customer with this phone number
    // We need to search across all companies since we don't know which company this is for
    // The sender ID determines which company owns this message
    const { data: customers } = await supabase
      .from('customers')
      .select('id, company_id, first_name, last_name, phone')
      .or(`phone.eq.${normalizedPhone},phone.eq.${incomingMessage.from}`);

    // If multiple customers match, we'll use the first one
    // In a multi-tenant setup, you'd want to use separate sender IDs per company
    // or implement a lookup based on recent outbound messages to this number
    const matchedCustomer = customers?.[0];

    if (!matchedCustomer) {
      // No matching customer found - we can't store this message without a company_id
      // In production, you might want to store these in a separate "unknown messages" table
      console.warn('Received SMS from unknown number:', normalizedPhone);
      return res.status(200).json({ status: 'received', matched: false });
    }

    // Store the incoming message
    const { error } = await supabase
      .from('sms_messages')
      .insert({
        company_id: matchedCustomer.company_id,
        customer_id: matchedCustomer.id,
        phone_number: normalizedPhone || incomingMessage.from,
        message_body: incomingMessage.body,
        direction: 'inbound',
        twilio_sid: incomingMessage.messageSid, // Kept for backward compatibility, stores Infobip messageId
        status: 'received',
        is_read: false
      });

    if (error) {
      console.error('Error storing incoming message:', error);
    }

    // Respond with JSON acknowledgment
    res.status(200).json({ status: 'received', stored: !error });
  } catch (error) {
    console.error('SMS webhook error:', error);
    // Still respond with 200 to prevent Infobip retries
    res.status(200).json({ status: 'error', message: error.message });
  }
});

// Legacy Twilio webhook endpoint (redirects to new endpoint)
app.post('/api/twilio/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  // Redirect to new SMS webhook - kept for backward compatibility
  console.warn('Deprecated: /api/twilio/webhook called. Please update to /api/sms/webhook');
  res.status(410).json({ error: 'This endpoint has been deprecated. Use /api/sms/webhook instead.' });
});

// Check SMS service configuration status
app.get('/api/sms/status', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ 
      configured: smsService.isConfigured(),
      phone_number: smsService.getPhoneNumber(),
      provider: 'infobip'
    });
  } catch (error) {
    console.error('SMS status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Legacy Twilio status endpoint (redirects to new endpoint)
app.get('/api/twilio/status', async (req, res) => {
  // Redirect to new SMS status endpoint
  res.redirect(307, '/api/sms/status');
});

app.listen(PORT, '0.0.0.0', () => {
  // Server started
});