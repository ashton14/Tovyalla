# Troubleshooting Guide

## ERR_CONNECTION_REFUSED Error

### What it means:
This error occurs when the frontend tries to connect to the backend API server, but the connection is refused. This typically means:
- The backend server is not running
- The backend server is running on a different port
- There's a firewall blocking the connection

### How to fix:

1. **Make sure both servers are running:**
   ```bash
   npm run dev
   ```
   This should start both:
   - Backend server on `http://localhost:5000`
   - Frontend server on `http://localhost:3000`

2. **Check if backend is running:**
   - Open `http://localhost:5000/api/health` in your browser
   - You should see: `{"status":"ok","message":"Tovyalla CRM API is running"}`
   - If you get an error, the backend is not running

3. **Check backend terminal output:**
   - You should see: `Server running on http://localhost:5000`
   - If you see errors, check:
     - Is port 5000 already in use?
     - Are your `.env` files configured correctly?
     - Are all dependencies installed?

4. **Verify frontend is using proxy:**
   - The frontend should use relative URLs like `/api/whitelist` (not `http://localhost:5000/api/whitelist`)
   - Vite's proxy configuration in `vite.config.js` handles routing `/api/*` to the backend

### Common Issues:

#### Backend won't start:
- Check if port 5000 is already in use:
  ```bash
  # Windows PowerShell
  netstat -ano | findstr :5000
  
  # Or change the port in backend/.env
  PORT=5001
  ```

#### Frontend can't connect:
- Make sure you're accessing the app through `http://localhost:3000` (not directly opening the HTML file)
- Check browser console for specific error messages
- Verify the Vite dev server is running

#### CORS errors:
- The backend has CORS enabled, but if you see CORS errors, check:
  - Backend `.env` file has correct Supabase credentials
  - Backend server is actually running

### Quick Test:

1. Start the dev servers:
   ```bash
   npm run dev
   ```

2. In a new terminal, test the backend:
   ```bash
   curl http://localhost:5000/api/health
   ```
   Should return: `{"status":"ok","message":"Tovyalla CRM API is running"}`

3. Open browser to `http://localhost:3000`
   - Should see the login page
   - No connection errors in console

### Still having issues?

- Check that all dependencies are installed:
  ```bash
  npm run install-all
  ```

- Verify environment variables are set:
  - `backend/.env` should have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  - `frontend/.env` should have `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

- Check terminal output for specific error messages
- Review browser console (F12) for detailed error information

