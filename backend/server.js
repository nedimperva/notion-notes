const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
  origin: 'http://localhost:5173', // Your Vite frontend URL
  credentials: true
}));
app.use(express.json());

// Verify environment variables
const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:5173/auth/callback';

if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET) {
  console.error('Missing required environment variables: NOTION_CLIENT_ID or NOTION_CLIENT_SECRET');
  process.exit(1);
}

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
    console.log('Using Client ID:', NOTION_CLIENT_ID);
    console.log('Using Redirect URI:', REDIRECT_URI);

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    const authHeader = `Basic ${Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64')}`;
    console.log('Auth header:', authHeader.substring(0, 20) + '...');

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
    console.error('Token exchange error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });

    // Handle specific error cases
    if (error.response?.data?.error === 'invalid_grant') {
      return res.status(400).json({ 
        error: 'Invalid authorization code',
        details: 'The authorization code has already been used or has expired. Please try authenticating again.',
        suggestion: 'Click the "Connect to Notion" button to start a new authentication flow.'
      });
    }

    // Return more detailed error information
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to exchange code for token',
      details: error.response?.data || error.message,
      suggestion: 'Please check your Notion integration settings and try again.'
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
    console.log('Database ID:', process.env.NOTION_DATABASE_ID);

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    if (!note || !note.title || !note.content) {
      return res.status(400).json({ error: 'Invalid note data' });
    }

    if (!process.env.NOTION_DATABASE_ID) {
      return res.status(500).json({ error: 'Database ID is not configured' });
    }

    // First, let's verify the database exists and get its properties
    try {
      const databaseResponse = await axios.get(`https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}`, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Notion-Version': '2022-06-28'
        }
      });

      console.log('Database properties:', JSON.stringify(databaseResponse.data.properties, null, 2));

      // Create a page in Notion
      const response = await axios.post('https://api.notion.com/v1/pages', {
        parent: {
          database_id: process.env.NOTION_DATABASE_ID
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
            multi_select: note.tags
              .filter(tag => {
                console.log('Processing tag:', tag.name);
                // Check if the tag exists in the Tags options
                const tagOption = databaseResponse.data.properties.Tags.multi_select.options.find(
                  option => option.name.toLowerCase() === tag.name.toLowerCase()
                );
                console.log('Matched tag option:', tagOption);
                return tagOption !== undefined;
              })
              .map(tag => {
                const tagOption = databaseResponse.data.properties.Tags.multi_select.options.find(
                  option => option.name.toLowerCase() === tag.name.toLowerCase()
                );
                return {
                  id: tagOption.id,
                  name: tag.name
                };
              })
          },
          Category: {
            select: note.tags
              .filter(tag => {
                // Check if the tag exists in the Category options
                const categoryOption = databaseResponse.data.properties.Category.select.options.find(
                  option => option.name.toLowerCase() === tag.name.toLowerCase()
                );
                return categoryOption !== undefined;
              })
              .map(tag => {
                const categoryOption = databaseResponse.data.properties.Category.select.options.find(
                  option => option.name.toLowerCase() === tag.name.toLowerCase()
                );
                return {
                  id: categoryOption.id,
                  name: tag.name
                };
              })[0] || { name: "Quick Note" } // Default to "Quick Note" if no matching category
          },
          Status: {
            status: {
              name: "Draft"
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
      }, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      });

      console.log('Note synced successfully:', response.data);
      res.json({
        id: note.id,
        notionId: response.data.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        synced: true
      });
    } catch (error) {
      console.error('Notion API error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });
      
      if (error.response?.status === 404) {
        return res.status(404).json({ 
          error: 'Database not found',
          details: 'The specified database ID does not exist or you do not have access to it'
        });
      }
      
      throw error; // Re-throw to be caught by outer try-catch
    }
  } catch (error) {
    console.error('Note sync error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      headers: error.response?.headers
    });
    
    res.status(500).json({ 
      error: 'Failed to sync note with Notion',
      details: error.response?.data || error.message,
      suggestion: 'Please check your database ID and permissions.'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log('Notion Client ID:', NOTION_CLIENT_ID);
  console.log('Redirect URI:', REDIRECT_URI);
}); 