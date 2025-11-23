# Tovyalla CRM

A full-stack Customer Relationship Management system for pool construction companies, built with Node.js, React, and Supabase.

## Project Structure

```
Tovyalla-CRM/
├── backend/           # Express.js server
│   ├── server.js     # Main server file
│   └── package.json  # Backend dependencies
├── frontend/         # React application (Vite)
│   ├── src/
│   │   ├── pages/    # Page components
│   │   ├── context/  # React context (Auth)
│   │   └── App.jsx   # Main app component
│   └── package.json  # Frontend dependencies
└── package.json      # Root package.json with dev scripts
```

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- A Supabase project (get one at [supabase.com](https://supabase.com))

## Setup Instructions

### 1. Install Dependencies

From the root directory, run:

```bash
npm run install-all
```

This will install dependencies for the root, backend, and frontend.

### 2. Configure Supabase

Create a single `.env` file in the root directory with all your environment variables:

1. Create `.env` in the root directory (same level as `package.json`)

2. Add the following variables:
   ```
   # Backend Configuration
   PORT=5000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   
   # Frontend Configuration (must be prefixed with VITE_)
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   You can find these values in your Supabase project settings:
   - Go to your Supabase project dashboard
   - Navigate to Settings → API
   - Copy the Project URL and the anon/public key
   - Copy the service_role key (keep this secret!)

**Note:** 
- The backend reads all variables from the root `.env` file
- The frontend only reads variables prefixed with `VITE_` (this is a Vite requirement)
- Both backend and frontend are configured to read from the root `.env` file automatically

### 3. Database Schema Setup

In your Supabase project, you'll need to set up the authentication to store `companyID` in user metadata and create the email whitelist table.

#### Required: Email Whitelist Table

The system uses an email whitelist to control which users can register with each Company ID. You must create this table:

1. Go to your Supabase project SQL Editor
2. Run the SQL from `database_setup.sql` file, or copy the following:

```sql
-- Create company_whitelist table
CREATE TABLE IF NOT EXISTS public.company_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  added_by UUID REFERENCES auth.users(id),
  registered BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, email)
);

-- Enable Row Level Security
ALTER TABLE public.company_whitelist ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_whitelist_company_id ON public.company_whitelist(company_id);
CREATE INDEX IF NOT EXISTS idx_company_whitelist_email ON public.company_whitelist(email);

-- Create policy to allow users to view whitelist for their company
CREATE POLICY "Users can view whitelist for their company" ON public.company_whitelist
  FOR SELECT USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to add emails to their company whitelist
CREATE POLICY "Users can add to their company whitelist" ON public.company_whitelist
  FOR INSERT WITH CHECK (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );

-- Create policy to allow users to delete from their company whitelist
CREATE POLICY "Users can delete from their company whitelist" ON public.company_whitelist
  FOR DELETE USING (
    company_id = (
      SELECT raw_user_meta_data->>'companyID' 
      FROM auth.users 
      WHERE id = auth.uid()
    )
  );
```

#### Optional: Custom Users Table (Recommended for Production)

For better data management, you can also create a custom users table:

```sql
-- Create a users table that extends auth.users
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow users to read their own data
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Create a function to automatically create a user record when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, company_id, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'companyID', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 4. Create a Test User

You can create a test user through the Supabase dashboard:

1. Go to Authentication → Users in your Supabase dashboard
2. Click "Add user" → "Create new user"
3. Enter an email and password
4. In the "User Metadata" section, add:
   ```json
   {
     "companyID": "TEST001"
   }
   ```

Alternatively, you can use the registration endpoint (if you implement it in the frontend) or create users programmatically.

## Running the Application

### Development Mode

From the root directory, run:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:5000`
- Frontend development server on `http://localhost:3000`

The frontend is configured to proxy API requests to the backend.

### Individual Services

You can also run the services separately:

**Backend only:**
```bash
npm run server
```

**Frontend only:**
```bash
npm run client
```

## Features

- **Authentication**: Login with Company ID, Username (email), and Password
- **Protected Routes**: Dashboard is protected and requires authentication
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **Error Handling**: User-friendly error messages for login failures

## Tech Stack

- **Backend**:**
  - Node.js with Express.js
  - Supabase JS client for server-side operations

- **Frontend**:**
  - React 18 with Vite
  - React Router for navigation
  - Tailwind CSS for styling
  - Supabase JS client for client-side auth

## Next Steps

- Add more dashboard features (customer management, project tracking, etc.)
- Implement user registration
- Add password reset functionality
- Create additional protected routes
- Add more API endpoints for CRM functionality

## Troubleshooting

### Port Already in Use

If port 5000 or 3000 is already in use, you can change them:
- Backend: Update `PORT` in `backend/.env`
- Frontend: Update `server.port` in `frontend/vite.config.js`

### Supabase Connection Issues

- Verify your Supabase URL and keys are correct
- Check that your Supabase project is active
- Ensure your Supabase project allows connections from your IP (if using IP restrictions)

### Module Not Found Errors

Make sure you've run `npm run install-all` to install all dependencies in all directories.

## License

ISC

