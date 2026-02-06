# Tovyalla CRM

A comprehensive full-stack Customer Relationship Management system designed specifically for pool construction companies. Built with Node.js, React, and Supabase, featuring project management, customer tracking, document management, calendar integration, and electronic signature capabilities.

## 🚀 Features

### Core CRM Features
- **Customer Management**: Track customer information, pipeline status, and communication history
- **Project Management**: Manage projects from proposal to completion with status tracking
- **Employee Management**: Organize team members with roles and assignments
- **Inventory Management**: Track materials and equipment
- **Subcontractor Management**: Manage subcontractor relationships and COI documents
- **Goals & Analytics**: Set and track business goals with real-time statistics
- **Dashboard**: Comprehensive overview with charts and metrics

### Advanced Features
- **Google Calendar Integration**: Sync events with Google Calendar via OAuth 2.0
- **eSignatures Integration**: Send contracts, proposals, and change orders for electronic signatures via eSignatures.com
- **Document Management**: Upload, organize, and manage documents for customers, projects, and other entities
- **PDF Generation**: Generate contracts, proposals, and change orders as PDFs
- **CSV Import/Export**: Bulk import customers, projects, inventory, and subcontractors
- **Real-time Data Caching**: Optimized data fetching with React Query

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Supabase Account** ([supabase.com](https://supabase.com))
- **Google Cloud Project** (for Google Calendar integration - optional)
- **eSignatures.com Account** (for e-signature features - optional)

## 🏗️ Project Structure

```
Tovyalla/
├── backend/                    # Express.js server
│   ├── server.js              # Main server file
│   ├── services/              # Service modules
│   │   ├── esignatures.js     # eSignatures.com integration
│   │   └── googleCalendar.js  # Google Calendar integration
│   └── package.json
├── frontend/                   # React application (Vite)
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/             # Page components
│   │   ├── context/            # React context (Auth)
│   │   ├── hooks/              # Custom hooks (API, etc.)
│   │   └── utils/              # Utility functions
│   ├── vercel.json            # Vercel deployment config
│   └── package.json
├── .env                       # Environment variables (create this)
└── package.json               # Root package.json with dev scripts
```

## ⚙️ Setup Instructions

### 1. Install Dependencies

From the root directory:

```bash
npm run install-all
```

This installs dependencies for the root, backend, and frontend.

### 2. Configure Environment Variables

Create a `.env` file in the **root directory** (same level as `package.json`):

```env
# Backend Configuration
PORT=5000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Frontend Configuration (must be prefixed with VITE_)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google Calendar OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/google/oauth/callback
FRONTEND_URL=http://localhost:5173

# eSignatures.com Integration (Optional)
ESIGNATURES_API_TOKEN=your-secret-api-token
ESIGNATURES_WEBHOOK_URL=http://localhost:5000/api/esign/webhook
```

**Important Notes:**
- Backend reads all variables from the root `.env` file
- Frontend only reads variables prefixed with `VITE_` (Vite requirement)
- For production, update `GOOGLE_REDIRECT_URI` and `FRONTEND_URL` to your production URLs
- See `ENV_VARIABLES_EXAMPLE.md` for detailed configuration instructions

### 3. Configure Supabase Authentication

**Important**: Configure the Site URL in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Set **Site URL** to your production frontend URL (e.g., `https://your-app.vercel.app`)
4. Add your production URL to **Redirect URLs** (e.g., `https://your-app.vercel.app/**`)
5. For development, you can also add `http://localhost:5173/**`

This ensures email confirmation links point to your production site instead of localhost.

### 4. Database Schema Setup

The application requires a Supabase database with the following tables:
- `companies`
- `customers`
- `projects`
- `employees`
- `inventory`
- `subcontractors`
- `project_documents`
- `customer_documents`
- `company_whitelist`
- `goals`
- And more...

**Required: Email Whitelist Table**

Create the email whitelist table in your Supabase SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS public.company_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id TEXT NOT NULL,
  email TEXT NOT NULL,
  registered BOOLEAN DEFAULT FALSE,
  registered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, email)
);

ALTER TABLE public.company_whitelist ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_company_whitelist_company_id ON public.company_whitelist(company_id);
CREATE INDEX IF NOT EXISTS idx_company_whitelist_email ON public.company_whitelist(email);
```

### 4. Google Calendar Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**
4. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Choose "Web application"
6. Add authorized redirect URI: `http://localhost:5000/api/google/oauth/callback` (or your production URL)
7. Copy the Client ID and Client Secret to your `.env` file

### 5. eSignatures.com Setup (Optional)

1. Create an account at [eSignatures.com](https://esignatures.com/)
2. Go to your account settings → API page
3. Copy your **Secret Token** and add it as `ESIGNATURES_API_TOKEN` in your `.env` file
4. Configure the webhook URL in your eSignatures.com dashboard (optional if using custom webhook URL)

## 🏃 Running the Application

### Development Mode

From the root directory:

```bash
npm run dev
```

This starts:
- **Backend server** on `http://localhost:5000`
- **Frontend dev server** on `http://localhost:3000` (Vite default port)

The frontend is configured to proxy API requests to the backend.

### Individual Services

**Backend only:**
```bash
npm run server
# or
cd backend && npm run dev
```

**Frontend only:**
```bash
npm run client
# or
cd frontend && npm run dev
```

### Production Build

**Frontend:**
```bash
cd frontend
npm run build
```

**Backend:**
```bash
cd backend
npm start
```

## 🚢 Deployment

### Frontend (Vercel)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set build command: `cd frontend && npm install && npm run build`
4. Set output directory: `frontend/dist`
5. Add environment variables in Vercel dashboard (all `VITE_*` variables)
6. The `vercel.json` file handles API proxying and SPA routing

### Backend (Railway)

1. Push your code to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repository
4. Set root directory to `backend`
5. Set start command: `npm start`
6. Add all environment variables in Railway dashboard
7. **Important**: Remove the `PORT` variable if you set it manually - Railway sets this automatically
8. Ensure the server listens on `0.0.0.0` (already configured)

### Environment Variables for Production

Update these for production:
- `GOOGLE_REDIRECT_URI`: `https://your-backend-url.railway.app/api/google/oauth/callback`
- `FRONTEND_URL`: `https://your-frontend-url.vercel.app`
- `ESIGNATURES_WEBHOOK_URL`: `https://your-backend-url.railway.app/api/esign/webhook`

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **Supabase** for database and authentication
- **Google APIs** (googleapis) for Calendar integration
- **eSignatures.com API** for electronic signatures
- **Multer** for file uploads

### Frontend
- **React 18** with Vite
- **React Router** for navigation
- **TanStack Query (React Query)** for data fetching and caching
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **React Big Calendar** for calendar views
- **PDFMake** for PDF generation
- **Axios** for API requests

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/update-last-logon` - Update last login timestamp

### Customers
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/statistics` - Get project statistics
- `GET /api/projects/monthly-statistics` - Get monthly statistics

### Google Calendar
- `GET /api/google/oauth/authorize` - Initiate OAuth flow
- `GET /api/google/oauth/callback` - OAuth callback handler
- `GET /api/google/calendar/status` - Check connection status
- `GET /api/google/calendar/events` - Fetch calendar events
- `POST /api/google/calendar/events` - Create event
- `PUT /api/google/calendar/events/:eventId` - Update event
- `DELETE /api/google/calendar/events/:eventId` - Delete event
- `POST /api/google/calendar/disconnect` - Disconnect Google Calendar

### eSignatures
- `POST /api/esign/send` - Send document for signature
- `POST /api/esign/webhook` - Webhook endpoint for status updates

### Documents
- `GET /api/documents/:entityType/:entityId` - List documents
- `POST /api/documents/:entityType/:entityId/upload` - Upload document
- `DELETE /api/documents/:entityId` - Delete document
- `GET /api/documents/:entityId/download` - Download document

And many more...

## 🔧 Troubleshooting

### Port Already in Use

If port 5000 or 3000 is already in use:
- **Backend**: Update `PORT` in `.env` file
- **Frontend**: Update `server.port` in `frontend/vite.config.js`

### Supabase Connection Issues

- Verify your Supabase URL and keys are correct
- Check that your Supabase project is active
- Ensure your Supabase project allows connections from your IP (if using IP restrictions)

### Module Not Found Errors

Make sure you've run `npm run install-all` to install all dependencies in all directories.

### Google Calendar OAuth Errors

- Verify `GOOGLE_REDIRECT_URI` matches exactly in Google Cloud Console
- Ensure Google Calendar API is enabled
- Check that OAuth consent screen is configured
- For testing, add your email as a test user in OAuth consent screen

### eSignatures Integration Issues

- Verify your `ESIGNATURES_API_TOKEN` is correct (from your eSignatures.com account)
- Ensure webhook URL is publicly accessible (not localhost) for production
- Check eSignatures.com dashboard for webhook logs and error messages
- See `ENV_VARIABLES_EXAMPLE.md` for detailed configuration instructions

### Data Caching

The application uses React Query for data caching:
- Default `staleTime`: 5 minutes
- Data is refetched automatically after mutations
- To force refresh, use the `refetch()` function from queries

### Email Confirmation Links Go to Localhost

If email confirmation links are pointing to localhost instead of your production URL:

1. **Update Supabase Site URL**:
   - Go to Supabase Dashboard → Authentication → URL Configuration
   - Set **Site URL** to your production frontend URL (e.g., `https://your-app.vercel.app`)
   - Add your production URL to **Redirect URLs**

2. **Update Environment Variable**:
   - Ensure `FRONTEND_URL` in your `.env` file (or Railway environment variables) is set to your production URL
   - Example: `FRONTEND_URL=https://your-app.vercel.app`

3. **Redeploy Backend**:
   - After updating `FRONTEND_URL`, redeploy your backend so the new value is used in email confirmation links

## 📝 License

ISC

## 🤝 Contributing

This is a private project. For questions or issues, please contact the project maintainer.
