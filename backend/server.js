const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { Client } = require('@notionhq/client');
const { marked } = require('marked');
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
const REDIRECT_URI = process.env.REDIRECT_URI; // Production URI
const DEV_REDIRECT_URI = process.env.DEV_REDIRECT_URI; // Development URI
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!NOTION_CLIENT_ID || !NOTION_CLIENT_SECRET || !REDIRECT_URI || !DEV_REDIRECT_URI) {
  console.warn('Missing required environment variables: NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, REDIRECT_URI, or DEV_REDIRECT_URI');
  // Decide if you want to exit(1) in dev if DEV_REDIRECT_URI is missing
  // process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Get the OAuth URL
app.get('/api/notion/auth-url', (req, res) => {
  try {
    // Select redirect URI based on environment
    const redirectUriToUse = IS_PRODUCTION ? REDIRECT_URI : DEV_REDIRECT_URI;
    console.log(`Using redirect URI for ${IS_PRODUCTION ? 'Production' : 'Development'}: ${redirectUriToUse}`);

    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      response_type: 'code',
      owner: 'user',
      redirect_uri: redirectUriToUse // Use the selected URI
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
      // Select redirect URI based on environment (must match the one used for auth URL)
      const redirectUriToUse = IS_PRODUCTION ? REDIRECT_URI : DEV_REDIRECT_URI;
      console.log(`Using redirect URI for token exchange (${IS_PRODUCTION ? 'Production' : 'Development'}): ${redirectUriToUse}`);
      
      const response = await axios.post('https://api.notion.com/v1/oauth/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUriToUse // Use the selected URI
      }, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      });

      console.log('Token exchange successful:', response.data);
      if (response.data.access_token) {
        res.json({ accessToken: response.data.access_token });
      } else {
        res.status(400).json({ error: 'No access token received', details: response.data });
      }
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

// Helper function to convert Markdown to Notion blocks
const markdownToNotionBlocks = (markdown) => {
  const tokens = marked.lexer(markdown);
  const notionBlocks = [];

  const listStack = []; // To handle nested lists

  const processTokens = (tokenList) => {
    tokenList.forEach(token => {
      switch (token.type) {
        case 'heading':
          notionBlocks.push({
            object: 'block',
            type: `heading_${token.depth}`,
            [`heading_${token.depth}`]: {
              rich_text: [{ type: 'text', text: { content: token.text } }]
            }
          });
          break;
        case 'paragraph':
          notionBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: convertInlineMarkdown(token.tokens || [{ type: 'text', raw: token.text }])
            }
          });
          break;
        case 'list':
          // Notion API requires individual list items
          // marked groups them, so we process each item
          token.items.forEach(item => {
            const blockType = token.ordered ? 'numbered_list_item' : 'bulleted_list_item';
            notionBlocks.push({
              object: 'block',
              type: blockType,
              [blockType]: {
                rich_text: convertInlineMarkdown(item.tokens[0]?.tokens || [{ type: 'text', raw: item.text }])
                // Recursively handle nested lists if present in item.tokens
                // This simple version assumes one level of text per item
              }
            });
            // Handle potential nested lists within the item (requires deeper parsing)
            if (item.tokens.length > 1 && item.tokens[1].type === 'list') {
               processTokens([item.tokens[1]]); // Recursive call for nested list
            }
          });
          break;
        case 'code':
          notionBlocks.push({
            object: 'block',
            type: 'code',
            code: {
              rich_text: [{ type: 'text', text: { content: token.text } }],
              language: token.lang || 'plain text'
            }
          });
          break;
        case 'blockquote':
          notionBlocks.push({
            object: 'block',
            type: 'quote',
            quote: {
              // Process inner tokens for potential formatting within the quote
               rich_text: convertInlineMarkdown(token.tokens || [{ type: 'text', raw: token.text }])
            }
          });
          break;
        case 'hr':
          notionBlocks.push({
            object: 'block',
            type: 'divider',
            divider: {}
          });
          break;
        case 'space':
          // Can represent multiple blank lines, add a single paragraph for spacing
          // Or potentially ignore, depending on desired behavior
          notionBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: []
            }
          });
          break;
        // Add cases for other block types like 'html', 'table' if needed
        default:
          console.warn('Unsupported Markdown block type:', token.type);
      }
    });
  }

  processTokens(tokens);
  return notionBlocks;
};

// Helper function to convert inline Markdown (bold, italic, code) to Notion rich_text annotations
const convertInlineMarkdown = (tokens) => {
    const richTextArray = [];
    tokens.forEach(token => {
        let textContent = token.raw || token.text || '';
        const annotations = {};

        switch (token.type) {
            case 'strong':
            case 'em':
            case 'codespan':
            case 'link':
            case 'del': // Strikethrough
                // Recursively process nested tokens (e.g., bold *and* italic)
                const nestedRichText = convertInlineMarkdown(token.tokens || []);
                richTextArray.push(...nestedRichText);
                break;
            case 'text':
                // Need to check parent context if available, or use regex for simple cases
                // This basic version doesn't check context from parent tokens
                // A more robust parser would handle this better
                if (token.raw.includes('**') || token.raw.includes('__')) annotations.bold = true;
                if (token.raw.includes('*') || token.raw.includes('_')) annotations.italic = true;
                if (token.raw.includes('`')) annotations.code = true;
                if (token.raw.includes('~')) annotations.strikethrough = true; // Basic strikethrough

                // Basic cleanup (a better parser is needed for accuracy)
                textContent = textContent
                    .replace(/\*\*/g, '')
                    .replace(/\*/g, '')
                    .replace(/__/g, '')
                    .replace(/_/g, '')
                    .replace(/`/g, '')
                    .replace(/~/g, '');

                 richTextArray.push({
                    type: 'text',
                    text: { content: textContent },
                    annotations: annotations,
                 });
                 break;
            default:
                 // Handle other inline types if needed
                 if(textContent) {
                     richTextArray.push({
                        type: 'text',
                        text: { content: textContent }
                     });
                 }
        }
    });
    return richTextArray;
};

// Sync note with Notion
app.post('/api/notion/sync-note', async (req, res) => {
  try {
    const { note, access_token } = req.body;
    console.log('Syncing note:', note.id);
    // console.log('Note data:', JSON.stringify(note, null, 2)); // Less verbose logging

    if (!access_token) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    if (!note || !note.title ) { // Content check removed as it might be empty intentionally
      return res.status(400).json({ error: 'Invalid note data (missing title)' });
    }

    // Initialize Notion client
    const notion = new Client({ auth: access_token });

    // Get or create database
    let databaseId;
    try {
      // Search for existing database with our template title
      const searchResponse = await notion.search({
        query: 'Notes Database', // Consider making this configurable?
        filter: {
          property: 'object',
          value: 'database'
        }
      });

      if (searchResponse.results.length > 0) {
        databaseId = searchResponse.results[0].id;
      } else {
        // Create new database (keep existing logic)
        console.log('Creating new Notes Database in Notion...');
        const databaseResponse = await notion.databases.create({ /* ... database creation properties ... */ }); // Keep the existing DB creation logic
        databaseId = databaseResponse.id;
        console.log('New database created:', databaseId);
      }

      // Create a page in Notion without content initially
      const pageCreateResponse = await notion.pages.create({
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
          // Content property removed from page properties
          Tags: {
            multi_select: (note.tags || []).map(tag => ({ name: tag.name || tag })) // Handle potential string tags
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
              start: note.createdAt || new Date().toISOString()
            }
          },
          "Last Edited": {
            date: {
              start: note.updatedAt || new Date().toISOString()
            }
          }
        }
      });

      const pageId = pageCreateResponse.id;
      console.log('Created Notion page:', pageId);

      // Parse markdown content and convert to Notion blocks
      const notionBlocks = note.content ? markdownToNotionBlocks(note.content) : [];

      // Append the blocks to the page body if any exist
      if (notionBlocks.length > 0) {
         console.log(`Appending ${notionBlocks.length} blocks to page ${pageId}`);
         // Notion API limits block appends to 100 at a time
         for (let i = 0; i < notionBlocks.length; i += 100) {
            const batch = notionBlocks.slice(i, i + 100);
            await notion.blocks.children.append({
              block_id: pageId,
              children: batch,
            });
         }
         console.log('Successfully appended blocks to page:', pageId);
      } else {
        console.log('No content blocks to append for page:', pageId);
      }

      console.log('Note synced successfully, page created/updated:', pageId);
      res.json({
        id: note.id,
        notionId: pageId,
        title: note.title,
        content: note.content, // Keep original content for reference if needed
        tags: note.tags,
        category: note.category,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        synced: true
      });
    } catch (error) {
      console.error('Notion API error during sync:', error.code ? `${error.code}: ${error.message}` : error);
      // Log request body for debugging if available
      if (error.body) {
        console.error('Error Body:', error.body);
      }
      res.status(500).json({
        error: 'Failed to sync note with Notion',
        details: error.code ? `${error.code}: ${error.message}` : error.message
      });
    }
  } catch (error) {
    console.error('Note sync endpoint error:', error);
    res.status(500).json({
      error: 'Failed to sync note with Notion (Server Error)',
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