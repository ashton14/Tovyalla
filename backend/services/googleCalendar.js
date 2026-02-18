import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root directory (two levels up from backend/services/)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/oauth/callback';

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Warning: Supabase credentials not found in .env file');
}

const supabase = createClient(supabaseUrl || '', supabaseServiceKey || '');

// OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Scopes required for Google Calendar
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

/**
 * Get OAuth authorization URL
 */
export function getAuthUrl(userId) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: state,
    prompt: 'consent', // Force consent screen to get refresh token
  });

  return authUrl;
}

/**
 * Handle OAuth callback and store tokens
 */
export async function handleOAuthCallback(code, state) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  try {
    // Decode state to get userId
    const decodedState = JSON.parse(Buffer.from(state, 'base64').toString());
    const userId = decodedState.userId;

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    
    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. User may need to revoke access and reconnect.');
    }

    // Store tokens in user metadata
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      throw new Error('User not found');
    }

    // Update user metadata with Google Calendar tokens
    const updatedMetadata = {
      ...user.user_metadata,
      google_calendar_refresh_token: tokens.refresh_token,
      google_calendar_access_token: tokens.access_token,
      google_calendar_token_expiry: tokens.expiry_date,
      google_calendar_connected: true,
    };

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: updatedMetadata,
    });

    if (updateError) {
      throw new Error(`Failed to store tokens: ${updateError.message}`);
    }

    // Get user's email from Google (optional - tokens are already stored, connection works without it)
    let email = null;
    try {
      const client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const { data: userInfo } = await oauth2.userinfo.get();
      if (userInfo?.email) {
        email = userInfo.email;
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...updatedMetadata,
            google_calendar_email: email,
          },
        });
      }
    } catch (userInfoError) {
      console.warn('Could not fetch Google user email (connection still works):', userInfoError?.message || userInfoError);
    }

    return {
      success: true,
      email,
    };
  } catch (error) {
    console.error('OAuth callback error:', error);
    throw error;
  }
}

/**
 * Get authenticated Google Calendar client for a user
 */
export async function getCalendarClient(userId) {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth credentials not configured');
  }

  // Get user and their stored tokens
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  
  if (userError || !user) {
    throw new Error('User not found');
  }

  const refreshToken = user.user_metadata?.google_calendar_refresh_token;
  const accessToken = user.user_metadata?.google_calendar_access_token;
  const tokenExpiry = user.user_metadata?.google_calendar_token_expiry;

  if (!refreshToken) {
    throw new Error('Google Calendar not connected. Please connect your Google account.');
  }

  // Set credentials
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
    expiry_date: tokenExpiry,
  });

  // Refresh token if needed
  if (!accessToken || (tokenExpiry && Date.now() >= tokenExpiry)) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored access token
      const updatedMetadata = {
        ...user.user_metadata,
        google_calendar_access_token: credentials.access_token,
        google_calendar_token_expiry: credentials.expiry_date,
      };

      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: updatedMetadata,
      });

      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw new Error('Failed to refresh access token. Please reconnect your Google account.');
    }
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Check if user has Google Calendar connected
 */
export async function isConnected(userId) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      return false;
    }

    // Check if explicitly disconnected
    if (user.user_metadata?.google_calendar_connected === false) {
      return false;
    }

    // Check if refresh token exists
    return !!user.user_metadata?.google_calendar_refresh_token;
  } catch (error) {
    console.error('Error checking connection status:', error);
    return false;
  }
}

/**
 * Get user's Google Calendar email
 */
export async function getCalendarEmail(userId) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      return null;
    }

    return user.user_metadata?.google_calendar_email || null;
  } catch (error) {
    console.error('Error getting calendar email:', error);
    return null;
  }
}

/**
 * Get events from Google Calendar
 */
export async function getEvents(userId, timeMin, timeMax) {
  const calendar = await getCalendarClient(userId);
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin || new Date().toISOString(),
    timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // Default: next 30 days
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

/**
 * Create event in Google Calendar
 */
export async function createEvent(userId, eventData) {
  const calendar = await getCalendarClient(userId);
  
  const event = {
    summary: eventData.summary || eventData.name,
    description: eventData.description || '',
    start: {
      dateTime: eventData.startDateTime || eventData.start,
      timeZone: eventData.timeZone || 'America/New_York',
    },
    end: {
      dateTime: eventData.endDateTime || eventData.end,
      timeZone: eventData.timeZone || 'America/New_York',
    },
    ...(eventData.location && { location: eventData.location }),
    ...(eventData.attendees && { attendees: eventData.attendees }),
    ...(eventData.recurrence?.length && { recurrence: eventData.recurrence }),
    ...(eventData.reminders && {
      reminders: eventData.reminders.useDefault
        ? { useDefault: true }
        : { useDefault: false, overrides: eventData.reminders.overrides || [] },
    }),
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });

  return response.data;
}

/**
 * Update event in Google Calendar
 */
export async function updateEvent(userId, eventId, eventData) {
  const calendar = await getCalendarClient(userId);
  
  // First get the existing event
  const existingEvent = await calendar.events.get({
    calendarId: 'primary',
    eventId: eventId,
  });

  const updatedEvent = {
    ...existingEvent.data,
    summary: eventData.summary || eventData.name || existingEvent.data.summary,
    description: eventData.description !== undefined ? eventData.description : existingEvent.data.description,
    start: {
      dateTime: eventData.startDateTime || eventData.start || existingEvent.data.start.dateTime,
      timeZone: eventData.timeZone || existingEvent.data.start.timeZone || 'America/New_York',
    },
    end: {
      dateTime: eventData.endDateTime || eventData.end || existingEvent.data.end.dateTime,
      timeZone: eventData.timeZone || existingEvent.data.end.timeZone || 'America/New_York',
    },
    ...(eventData.location !== undefined && { location: eventData.location }),
    ...(eventData.attendees && { attendees: eventData.attendees }),
    ...(eventData.reminders && {
      reminders: eventData.reminders.useDefault
        ? { useDefault: true }
        : { useDefault: false, overrides: eventData.reminders.overrides || [] },
    }),
  };

  const response = await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    resource: updatedEvent,
  });

  return response.data;
}

/**
 * Delete event from Google Calendar
 */
export async function deleteEvent(userId, eventId) {
  const calendar = await getCalendarClient(userId);
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });

  return { success: true };
}

/**
 * Disconnect Google Calendar
 */
export async function disconnect(userId) {
  try {
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      throw new Error('User not found');
    }

    // Remove Google Calendar tokens from metadata
    const updatedMetadata = { ...user.user_metadata };
    delete updatedMetadata.google_calendar_refresh_token;
    delete updatedMetadata.google_calendar_access_token;
    delete updatedMetadata.google_calendar_token_expiry;
    delete updatedMetadata.google_calendar_email;
    updatedMetadata.google_calendar_connected = false;

    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: updatedMetadata,
    });

    if (updateError) {
      throw new Error(`Failed to disconnect: ${updateError.message}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Disconnect error:', error);
    throw error;
  }
}

