// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { google } = require('googleapis');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
const fetch = require('node-fetch'); 
const cors = require('cors');
const { OpenAI } = require('openai');              // HTTP client for HF API
const notesStore = new Map();

const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,      // your Azure key
  azure: {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,  // e.g. "https://…azure.com"
    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT
  }
});

const app = express();
app.use(express.json());

// 1️⃣ Middleware
app.use(cors({                     // allow extension to call us
  origin: true,
  credentials: true
}));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // cookie settings for cross-site calls:
    cookie: { sameSite: 'none', secure: false }
  })
);

// 2️⃣ Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.OAUTH_REDIRECT_URI
);

// 3️⃣ Route: generate Google login URL
app.get('/api/auth/url', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly'
    ]
  });
  res.json({ url });
});

// 4️⃣ Route: OAuth callback our redirect URI
app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const { tokens } = await oauth2Client.getToken(code);
    // store tokens in session
    req.session.tokens = tokens;
    res.send('✅ Authentication successful! Close this tab and go back to Meet.');
  } catch (err) {
    console.error(err);
    res.status(500).send('Authentication failed');
  }
});

// 5️⃣ Route: fetch upcoming Calendar events
app.get('/api/meetings/upcoming', async (req, res) => {
  // need tokens from session
  if (!req.session.tokens) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // set credentials & call Calendar API
  oauth2Client.setCredentials(req.session.tokens);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const resp = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 5,
    singleEvents: true,
    orderBy: 'startTime'
  });

  res.json(resp.data.items);
});

// GET notes for a meeting
app.get('/api/meeting/:id/notes', (req, res) => {
  const notes = notesStore.get(req.params.id) || '';
  res.json({ notes });
});

// POST (save) notes for a meeting
app.post('/api/meeting/:id/notes', (req, res) => {
  const { notes } = req.body;               // requires express.json()
  notesStore.set(req.params.id, notes);
  res.json({ success: true });
});

// POST: Suggest agenda items via Hugging Face Inference API
// POST: Suggest agenda items via Hugging Face Inference API
// POST: Suggest agenda items via HF Inference API
// POST: Suggest agenda items via Hugging Face Mistral-7B-Instruct
// server.js

app.post('/api/meeting/:id/agenda', async (req, res) => {
  const meetingId = req.params.id;
  const notes = notesStore.get(meetingId) || '';

  // Build the prompt
  const prompt = `
Here are the previous meeting notes:
${notes}

Generate EXACTLY five concise agenda items for the next meeting.
Each item MUST start with "- " (dash + space), with no headings or extra text.

For example:
- Discuss budget, timeline, and staffing
- Review project milestones and deadlines
- Identify resource requirements and blockers
- Plan next steps and assign clear owners
- Schedule the follow-up session
`;

  try {
    // Construct the REST URL for Azure OpenAI chat completions
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;             // e.g. "https://my-resource.openai.azure.com"
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;         // e.g. "gpt-35-turbo"
    const apiVersion = "2023-05-15";                                // or whatever your Azure API version is

    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    // Call Azure OpenAI via fetch
    const apiResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.5
      })
    });

    if (!apiResp.ok) {
      const text = await apiResp.text();
      throw new Error(`Azure OpenAI error ${apiResp.status}: ${text}`);
    }

    const json = await apiResp.json();
    const raw = json.choices[0].message.content;

    // Extract the "- " bullets
    let items = (raw.match(/^- .+/gm) || []).map(l => l.slice(2).trim());

    // Fallback: first 5 non-empty lines
    if (items.length === 0) {
      items = raw
        .split(/\r?\n/)
        .map(l => l.replace(/^- /, '').trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    return res.json({ items });
  } catch (err) {
    console.error('Agenda error (Azure REST):', err);
    return res.status(500).json({ error: err.message });
  }
});

// POST: Generate a 2–3 sentence context brief via Azure OpenAI
app.post('/api/meeting/:id/brief', async (req, res) => {
  const meetingId = req.params.id;
  const notes = notesStore.get(meetingId) || '';

  // Build the briefing prompt
  const prompt = `
You are an assistant that summarizes meeting context for the host.
Here are the previous meeting notes:
${notes}

Write a 2–3 sentence briefing highlighting the key points and outstanding items the host should know before this meeting.
`;

  try {
    // Construct Azure REST URL
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;  
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;  
    const apiVersion = '2023-05-15';  
    const url = 
      `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

    const apiResp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 150,
        temperature: 0.5
      })
    });

    if (!apiResp.ok) {
      const err = await apiResp.text();
      throw new Error(`Azure OpenAI error ${apiResp.status}: ${err}`);
    }

    const json = await apiResp.json();
    const brief = json.choices[0].message.content.trim();

    res.json({ brief });
  } catch (err) {
    console.error('Brief error:', err);
    res.status(500).json({ error: err.message });
  }
});


// 6️⃣ Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 Backend listening on http://localhost:${port}`);
});
