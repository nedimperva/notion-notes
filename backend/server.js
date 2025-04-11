const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://192.168.1.100:5173',
    'https://thought-base.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Verify environment variables
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Missing required environment variables: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, or REDIRECT_URI');
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Get the OAuth URL
app.get('/api/notion/auth-url', (req, res) => {
  try {
    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      response_type: 'code',
      owner: 'user',
      redirect_uri: REDIRECT_URI
    });

    const authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
    console.log('Generated auth URL:', authUrl);
    
    res.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

// Exchange code for token
app.post('/api/notion/token', async (req, res) => {
  try {
    const { code } = req.body;
    console.log('Received code:', code);

    if (!code) {
      return res.status(400).json({ 
        error: 'Authorization code is required',
        details: 'No authorization code was provided in the request'
      });
    }

    const authHeader = `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64')}`;

    try {
      const response = await axios.post('https://api.notion.com/v1/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI
      }, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      console.log('Token exchange successful');
      res.json(response.data);
    } catch (error) {
      console.error('Notion API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response?.data?.error === 'invalid_grant') {
        return res.status(400).json({ 
          error: 'Invalid authorization code',
          details: 'The authorization code has already been used or has expired. Please try authenticating again.',
          suggestion: 'Click the "Connect to Notion" button to start a new authentication flow.'
        });
      }

      if (error.response?.status === 400) {
        return res.status(400).json({ 
          error: 'Invalid request',
          details: error.response?.data?.message || 'The request to Notion was invalid',
          suggestion: 'Please check your integration settings and try again.'
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ 
      error: 'Failed to exchange code for token',
      details: error.message,
      suggestion: 'Please try again later or contact support if the problem persists.'
    });
  }
});

// Get user info
app.get('/api/notion/user', async (req, res) => {
  try {
    const { access_token } = req.query;
    console.log('Getting user info for token:', access_token?.substring(0, 10) + '...');

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const response = await axios.get('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Notion-Version': '2022-06-28'
      }
    });

    console.log('User info retrieved successfully');
    res.json(response.data);
  } catch (error) {
    console.error('User info error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch user info',
      details: error.response?.data || error.message
    });
  }
});

// Get databases
app.get('/api/notion/databases', async (req, res) => {
  try {
    const { access_token } = req.query;
    console.log('Getting databases for token:', access_token?.substring(0, 10) + '...');

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const response = await axios.post('https://api.notion.com/v1/search', {
      filter: {
        property: 'object',
        value: 'database'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });

    console.log('Databases retrieved successfully');
    res.json(response.data);
  } catch (error) {
    console.error('Databases error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch databases',
      details: error.response?.data || error.message
    });
  }
});

// Sync note with Notion
app.post('/api/notion/sync-note', async (req, res) => {
  try {
    const { note, access_token } = req.body;
    console.log('Syncing note:', note.id);
    console.log('Note data:', JSON.stringify(note, null, 2));

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    if (!note || !note.title || !note.content) {
      return res.status(400).json({ error: 'Invalid note data' });
    }

    // Initialize Notion client
    const notion = new Client({ auth: access_token });

    // Get or create database
    let databaseId;
    try {
      // Search for existing database with our template title
      const searchResponse = await notion.search({
        query: 'Notes Database',
        filter: {
          property: 'object',
          value: 'database'
        }
      });

      if (searchResponse.results.length > 0) {
        databaseId = searchResponse.results[0].id;
      } else {
        // Create new database from template
        const databaseResponse = await notion.databases.create({
          parent: {
            type: 'workspace'
          },
          title: [
            {
              type: 'text',
              text: {
                content: 'Notes Database'
              }
            }
          ],
          description: [
            {
              type: 'text',
              text: {
                content: 'Central repository for all synced notes'
              }
            }
          ],
          properties: {
            Title: {
              type: 'title',
              name: 'Title'
            },
            Content: {
              type: 'rich_text',
              name: 'Content'
            },
            Tags: {
              type: 'multi_select',
              name: 'Tags',
              options: [
                {"name": "Work", "color": "blue"},
                {"name": "Personal", "color": "green"},
                {"name": "Ideas", "color": "purple"},
                {"name": "Important", "color": "red"}
              ]
            },
            Created: {
              type: 'created_time',
              name: 'Created'
            },
            "Last Edited": {
              type: 'last_edited_time',
              name: 'Last Edited'
            },
            Status: {
              type: 'status',
              name: 'Status',
              options: [
                {"name": "Draft", "color": "gray"},
                {"name": "In Progress", "color": "yellow"},
                {"name": "Completed", "color": "green"},
                {"name": "Archived", "color": "blue"}
              ]
            },
            Category: {
              type: 'select',
              name: 'Category',
              options: [
                {"name": "Meeting Notes", "color": "orange"},
                {"name": "Project Idea", "color": "purple"},
                {"name": "Quick Note", "color": "blue"},
                {"name": "Task", "color": "green"}
              ]
            }
          }
        });
        databaseId = databaseResponse.id;
      }

      // Create a page in Notion
      const response = await notion.pages.create({
        parent: {
          database_id: databaseId
        },
        properties: {
          Title: {
            title: [
              {
                text: {
                  content: note.title
                }
              }
            ]
          },
          Content: {
            rich_text: [
              {
                text: {
                  content: note.content
                }
              }
            ]
          },
          Tags: {
            multi_select: note.tags.map(tag => ({ name: tag.name }))
          },
          Status: {
            status: {
              name: "Draft"
            }
          },
          Category: {
            select: {
              name: note.category || "Quick Note"
            }
          },
          Created: {
            date: {
              start: note.createdAt
            }
          },
          "Last Edited": {
            date: {
              start: note.updatedAt
            }
          }
        }
      });

      console.log('Note synced successfully:', response);
      res.json({
        id: note.id,
        notionId: response.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        category: note.category,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        synced: true
      });
    } catch (error) {
      console.error('Notion API error:', error);
      res.status(500).json({ 
        error: 'Failed to sync note with Notion',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Note sync error:', error);
    res.status(500).json({ 
      error: 'Failed to sync note with Notion',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Get the local IP address
const getLocalIP = () => {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const localIP = getLocalIP();

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
  console.log('Local network URL:', `http://${localIP}:${port}`);
  console.log('Notion Client ID:', NOTION_CLIENT_ID);
  console.log('Redirect URI:', REDIRECT_URI);
}); 