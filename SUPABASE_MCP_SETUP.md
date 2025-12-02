# Connecting Supabase via MCP (Model Context Protocol)

This guide explains how to connect Supabase to Cursor using MCP, which allows AI assistants to interact with your Supabase projects.

## Prerequisites

- A Supabase account and project
- Cursor IDE installed

## Option 1: Using Supabase Hosted MCP Server (Recommended)

Supabase provides a hosted MCP server that you can connect to directly.

### Steps:

1. **Get your Supabase credentials:**
   - Go to your Supabase project dashboard
   - Navigate to **Settings → API**
   - Copy your **Project URL** and **Service Role Key** (or anon key)

2. **Configure MCP in Cursor:**
   - Open Cursor Settings (File → Preferences → Settings, or `Ctrl+,`)
   - Search for "MCP" or "Model Context Protocol"
   - Add a new MCP server configuration

3. **MCP Server Configuration:**
   
   Add the following configuration to your Cursor MCP settings:

   ```json
   {
     "mcpServers": {
       "supabase": {
         "url": "https://mcp.supabase.com/mcp",
         "apiKey": "your_supabase_service_role_key_or_access_token"
       }
     }
   }
   ```

   **Note:** The exact location of MCP settings in Cursor may vary. You might need to:
   - Check Cursor's documentation for MCP configuration
   - Look for a `.cursor` folder in your user directory
   - Or configure it through Cursor's settings UI

## Option 2: Using Local Supabase CLI MCP Server

If you're running Supabase locally via CLI:

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Start Supabase locally:**
   ```bash
   supabase start
   ```

3. **Configure MCP in Cursor:**
   ```json
   {
     "mcpServers": {
       "supabase": {
         "url": "http://localhost:54321/mcp"
       }
     }
   }
   ```

## Authentication

Supabase MCP supports OAuth 2.1 authentication. You may need to:
- Authenticate through Supabase's OAuth flow
- Use your Supabase access token or service role key

## Security Notes

⚠️ **Important Security Considerations:**
- **Do NOT connect MCP to production data**
- Use MCP primarily for development and testing
- The service role key has full access to your database - keep it secure
- Consider using a separate Supabase project for MCP testing

## What You Can Do with Supabase MCP

Once connected, you can:
- Query and manage database tables
- Execute SQL queries
- Manage database schemas
- Handle configurations
- Interact with your Supabase project through AI assistants

## Troubleshooting

1. **MCP server not found:**
   - Verify your Supabase project URL is correct
   - Check that your API key is valid
   - Ensure you have the necessary permissions

2. **Connection issues:**
   - Check your internet connection (for hosted server)
   - Verify Supabase CLI is running (for local server)
   - Check Cursor's MCP logs for error messages

3. **Authentication errors:**
   - Verify your API key is correct
   - Check that your Supabase project is active
   - Ensure you're using the correct authentication method

## Additional Resources

- [Supabase MCP Documentation](https://supabase.com/docs/guides/getting-started/mcp)
- [Supabase MCP Server GitHub Discussion](https://github.com/orgs/supabase/discussions/39434)
- [Supabase MCP Authentication Guide](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)

## Current Project Setup

Your project already uses Supabase via the standard JavaScript client:
- Backend: Uses `@supabase/supabase-js` with service role key
- Frontend: Uses `@supabase/supabase-js` with anon key

MCP integration is separate and allows AI assistants to interact with Supabase directly, complementing your existing setup.

