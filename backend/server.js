import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

