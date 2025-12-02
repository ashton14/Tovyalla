import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
          pipeline_status: pipeline_status || 'lead',
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
        pipeline_status: pipeline_status || 'lead',
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

    // Build query for projects
    let projectsQuery = supabase
      .from('projects')
      .select('id, est_value, created_at')
      .eq('company_id', companyID);

    if (startDate) {
      projectsQuery = projectsQuery.gte('created_at', startDate.toISOString());
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      return res.status(500).json({ error: projectsError.message });
    }

    if (!projects || projects.length === 0) {
      return res.json({
        totalEstValue: 0,
        totalProfit: 0,
        totalExpenses: 0,
        projectCount: 0,
        period: period,
      });
    }

    // Get all project IDs
    const projectIds = projects.map((p) => p.id);

    // Calculate expenses for all projects
    let totalEstValue = 0;
    let totalExpenses = 0;

    for (const project of projects) {
      const estValue = parseFloat(project.est_value || 0);
      totalEstValue += estValue;

      // Get expenses for this project
      const { data: subcontractorHours } = await supabase
        .from('project_subcontractor_hours')
        .select(`
          hours,
          rate,
          subcontractors (
            rate
          )
        `)
        .eq('project_id', project.id);

      const { data: materials } = await supabase
        .from('project_materials')
        .select('quantity, unit_cost')
        .eq('project_id', project.id);

      const { data: additionalExpenses } = await supabase
        .from('project_additional_expenses')
        .select('amount')
        .eq('project_id', project.id);

      // Calculate subcontractor costs
      let subcontractorTotal = 0;
      if (subcontractorHours) {
        subcontractorHours.forEach((entry) => {
          const rate = entry.rate || entry.subcontractors?.rate || 0;
          subcontractorTotal += parseFloat(entry.hours || 0) * parseFloat(rate);
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
      projectCount: projects.length,
      period: period,
    });
  } catch (error) {
    console.error('Get project statistics error:', error);
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
          status: status || 'proposal_request',
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

    const { data, error } = await supabase
      .from('projects')
      .update({
        customer_id: customer_id || null,
        address: address || null,
        project_type,
        pool_or_spa,
        sq_feet: sq_feet ? parseFloat(sq_feet) : null,
        status: status || 'proposal_request',
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

    // Get subcontractor hours with subcontractor details
    const { data: subcontractorHours, error: hoursError } = await supabase
      .from('project_subcontractor_hours')
      .select(`
        *,
        subcontractors (
          id,
          name,
          rate
        )
      `)
      .eq('project_id', id)
      .order('date_worked', { ascending: false });

    if (hoursError) {
      return res.status(500).json({ error: hoursError.message });
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

    // Calculate totals
    let subcontractorTotal = 0;
    if (subcontractorHours) {
      subcontractorHours.forEach((entry) => {
        // Use stored rate if available, otherwise fall back to subcontractor's default rate
        const rate = entry.rate || entry.subcontractors?.rate || 0;
        subcontractorTotal += parseFloat(entry.hours || 0) * parseFloat(rate);
      });
    }

    let materialsTotal = 0;
    if (materials) {
      materials.forEach((entry) => {
        materialsTotal += parseFloat(entry.quantity || 0) * parseFloat(entry.unit_cost || 0);
      });
    }

    let additionalTotal = 0;
    if (additionalExpenses) {
      additionalExpenses.forEach((entry) => {
        additionalTotal += parseFloat(entry.amount || 0);
      });
    }

    const totalExpenses = subcontractorTotal + materialsTotal + additionalTotal;
    const estValue = parseFloat(project.est_value || 0);
    const profit = estValue - totalExpenses;

    res.json({
      subcontractorHours: subcontractorHours || [],
      materials: materials || [],
      additionalExpenses: additionalExpenses || [],
      totals: {
        subcontractors: subcontractorTotal,
        materials: materialsTotal,
        additional: additionalTotal,
        total: totalExpenses,
      },
      project: {
        estValue: estValue,
        profit: profit,
      },
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add subcontractor hours
app.post('/api/projects/:id/expenses/subcontractor-hours', async (req, res) => {
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
    const { subcontractor_id, hours, rate, date_worked, notes } = req.body;

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

    if (!subcontractor_id || !hours || !date_worked) {
      return res.status(400).json({ error: 'subcontractor_id, hours, and date_worked are required' });
    }

    // Get subcontractor's default rate if rate not provided
    let finalRate = rate;
    if (finalRate === undefined || finalRate === null || finalRate === '') {
      const { data: subcontractor } = await supabase
        .from('subcontractors')
        .select('rate')
        .eq('id', subcontractor_id)
        .single();
      finalRate = subcontractor?.rate || 0;
    }

    const { data, error } = await supabase
      .from('project_subcontractor_hours')
      .insert([{
        project_id: id,
        subcontractor_id,
        hours: parseFloat(hours),
        rate: parseFloat(finalRate),
        date_worked,
        notes: notes || null,
      }])
      .select(`
        *,
        subcontractors (
          id,
          name,
          rate
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ subcontractorHour: data });
  } catch (error) {
    console.error('Add subcontractor hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update subcontractor hours
app.put('/api/projects/:id/expenses/subcontractor-hours/:hourId', async (req, res) => {
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

    const { id, hourId } = req.params;
    const { hours, rate, date_worked, notes } = req.body;

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

    if (hours !== undefined) updateData.hours = parseFloat(hours);
    if (rate !== undefined && rate !== null && rate !== '') updateData.rate = parseFloat(rate);
    if (date_worked !== undefined) updateData.date_worked = date_worked;
    if (notes !== undefined) updateData.notes = notes || null;

    const { data, error } = await supabase
      .from('project_subcontractor_hours')
      .update(updateData)
      .eq('id', hourId)
      .eq('project_id', id)
      .select(`
        *,
        subcontractors (
          id,
          name,
          rate
        )
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ subcontractorHour: data });
  } catch (error) {
    console.error('Update subcontractor hours error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete subcontractor hours
app.delete('/api/projects/:id/expenses/subcontractor-hours/:hourId', async (req, res) => {
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

    const { id, hourId } = req.params;

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
      .from('project_subcontractor_hours')
      .delete()
      .eq('id', hourId)
      .eq('project_id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete subcontractor hours error:', error);
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
    const { inventory_id, quantity, unit_cost, date_used, notes } = req.body;

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

    if (!inventory_id || !quantity || unit_cost === undefined || !date_used) {
      return res.status(400).json({ error: 'inventory_id, quantity, unit_cost, and date_used are required' });
    }

    const { data, error } = await supabase
      .from('project_materials')
      .insert([{
        project_id: id,
        inventory_id,
        quantity: parseFloat(quantity),
        unit_cost: parseFloat(unit_cost),
        date_used,
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
    const { quantity, unit_cost, date_used, notes } = req.body;

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

    if (quantity !== undefined) updateData.quantity = parseFloat(quantity);
    if (unit_cost !== undefined) updateData.unit_cost = parseFloat(unit_cost);
    if (date_used !== undefined) updateData.date_used = date_used;
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
    const { description, amount, expense_date, category, notes } = req.body;

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

    if (!description || amount === undefined || !expense_date) {
      return res.status(400).json({ error: 'description, amount, and expense_date are required' });
    }

    const { data, error } = await supabase
      .from('project_additional_expenses')
      .insert([{
        project_id: id,
        description,
        amount: parseFloat(amount),
        expense_date,
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
    const { description, amount, expense_date, category, notes } = req.body;

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
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (expense_date !== undefined) updateData.expense_date = expense_date;
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

    // List files from Supabase Storage
    // IMPORTANT: Do NOT include "documents" in the path - .from('documents') already specifies the bucket
    const storagePath = `${entityType}/${companyID}/${entityId}`;
    console.log('📋 List Documents Debug:');
    console.log('  - Company ID:', companyID);
    console.log('  - Entity Type:', entityType);
    console.log('  - Entity ID:', entityId);
    console.log('  - Storage Path:', storagePath);
    console.log('  - Path parts:', storagePath.split('/'));
    console.log('  - Expected companyID at index [1]:', storagePath.split('/')[1]);
    
    const { data: files, error: storageError } = await supabase.storage
      .from('documents')
      .list(storagePath);

    console.log('  - List Response:', { files: files?.length || 0, error: storageError });

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

    // Delete file from Supabase Storage
    // IMPORTANT: Do NOT include "documents" in the path - .from('documents') already specifies the bucket
    const storagePath = `${entityType}/${companyID}/${entityId}/${fileName}`;
    console.log('🗑️ Delete Document Debug:');
    console.log('  - Storage Path:', storagePath);
    console.log('  - Path parts:', storagePath.split('/'));
    console.log('  - Expected companyID at index [1]:', storagePath.split('/')[1]);
    
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
      return res.status(500).json({ error: deleteError.message });
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
      // Get projects
      let projectsQuery = supabase
        .from('projects')
        .select('id, est_value, created_at')
        .eq('company_id', companyID);

      if (startDate) {
        projectsQuery = projectsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError || !projects) return 0;

      let totalEstValue = 0;
      let totalExpenses = 0;

      for (const project of projects) {
        const estValue = parseFloat(project.est_value || 0);
        totalEstValue += estValue;

        // Get expenses for this project
        const { data: subcontractorHours } = await supabase
          .from('project_subcontractor_hours')
          .select(`
            hours,
            rate,
            subcontractors (
              rate
            )
          `)
          .eq('project_id', project.id);

        const { data: materials } = await supabase
          .from('project_materials')
          .select('quantity, unit_cost')
          .eq('project_id', project.id);

        const { data: additionalExpenses } = await supabase
          .from('project_additional_expenses')
          .select('amount')
          .eq('project_id', project.id);

        // Calculate subcontractor costs
        let subcontractorTotal = 0;
        if (subcontractorHours) {
          subcontractorHours.forEach((entry) => {
            const rate = entry.rate || entry.subcontractors?.rate || 0;
            subcontractorTotal += parseFloat(entry.hours || 0) * parseFloat(rate);
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
      let projectsQuery = supabase
        .from('projects')
        .select('est_value, created_at')
        .eq('company_id', companyID);

      if (startDate) {
        projectsQuery = projectsQuery.gte('created_at', startDate.toISOString());
      }

      const { data: projects, error: projectsError } = await projectsQuery;
      if (projectsError || !projects) return 0;

      return projects.reduce((sum, p) => sum + (parseFloat(p.est_value) || 0), 0);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

