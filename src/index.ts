import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const REDIRECT_URI = process.env.REDIRECT_URI!;
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

// Initialize OAuth2 client
const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Generate the Google OAuth2 URL
app.get('/auth/google', async (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.send({ authUrl });
});

// Handle Google OAuth2 callback
app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send('Authorization code is missing');
  }

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Send tokens back to the client or store them
    res.json({
      success: true,
      tokens,
    });
  } catch (error) {
    console.error('Error during sign-in:', error);
    res.status(500).send('Failed to sign in with Google');
  }
});

// Endpoint to get available calendar events
app.get('/events', async (req, res) => {
  const { accessToken } = req.query;

  if (!accessToken) {
    return res.status(400).send('Access token is required');
  }

  oAuth2Client.setCredentials({ access_token: accessToken as string });

  try {
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfYear.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    res.json(events);
  } catch (error) {
    console.error('Error loading calendar events:', error);
    res.status(500).send('Failed to load calendar events');
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
