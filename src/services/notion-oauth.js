// Get the API base URL based on the environment
const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    // Simpler: Always use localhost for dev, regardless of user agent
    // If you need mobile testing later, you might need a different setup (e.g., exposing via local IP)
    /* 
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Use the local IP address of the computer running the backend
      // Make sure this IP is correct for your network!
      return 'http://192.168.1.12:3001/api/notion'; 
    }
    */
    // For desktop/all dev, use localhost
    return 'http://localhost:3001/api/notion';
  }
  // In production, use the environment variable
  return import.meta.env.VITE_API_URL + '/api/notion';
};

const API_BASE_URL = getApiBaseUrl();

export const notionOAuth = {
  getAuthUrl: async () => {
    try {
      console.log('Fetching auth URL from:', `${API_BASE_URL}/auth-url`);
      const response = await fetch(`${API_BASE_URL}/auth-url`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Auth URL error response:', error);
        throw new Error(error.message || 'Failed to get auth URL');
      }
      
      const data = await response.json();
      console.log('Received auth URL:', data.url);
      return data.url;
    } catch (error) {
      console.error('Error getting auth URL:', error);
      throw error;
    }
  },

  exchangeCodeForToken: async (code) => {
    try {
      console.log('Exchanging code for token at:', `${API_BASE_URL}/token`);
      const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Token exchange error response:', error);
        throw new Error(error.message || 'Failed to exchange code for token');
      }

      const data = await response.json();
      localStorage.setItem('notionAuth', JSON.stringify({
        accessToken: data.access_token,
        workspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
        workspaceIcon: data.workspace_icon,
        botId: data.bot_id
      }));
      
      return data;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  },

  getUserInfo: async (accessToken) => {
    try {
      console.log('Getting user info from:', `${API_BASE_URL}/user`);
      const response = await fetch(`${API_BASE_URL}/user?access_token=${accessToken}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('User info error response:', error);
        throw new Error(error.message || 'Failed to get user info');
      }
      return response.json();
    } catch (error) {
      console.error('Error getting user info:', error);
      throw error;
    }
  },

  getDatabases: async (accessToken) => {
    try {
      console.log('Getting databases from:', `${API_BASE_URL}/databases`);
      const response = await fetch(`${API_BASE_URL}/databases?access_token=${accessToken}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('Databases error response:', error);
        throw new Error(error.message || 'Failed to get databases');
      }
      return response.json();
    } catch (error) {
      console.error('Error getting databases:', error);
      throw error;
    }
  },

  syncNote: async (note, accessToken) => {
    try {
      console.log('Syncing note to:', `${API_BASE_URL}/sync-note`);
      const response = await fetch(`${API_BASE_URL}/sync-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ note, access_token: accessToken })
      });
      if (!response.ok) {
        const error = await response.json();
        console.error('Sync note error response:', error);
        throw new Error(error.message || 'Failed to sync note');
      }
      return response.json();
    } catch (error) {
      console.error('Error syncing note:', error);
      throw error;
    }
  },

  getNotionAuth: () => {
    const authData = localStorage.getItem('notionAuth')
    if (!authData) return null
    
    try {
      const parsed = JSON.parse(authData)
      // Check if token is expired
      if (parsed.expires_at && new Date(parsed.expires_at) < new Date()) {
        localStorage.removeItem('notionAuth')
        return null
      }
      return parsed
    } catch (error) {
      console.error('Error parsing stored auth data:', error)
      localStorage.removeItem('notionAuth')
      return null
    }
  },

  setNotionAuth: (authData) => {
    localStorage.setItem('notionAuth', JSON.stringify(authData))
  },

  clearNotionAuth: () => {
    localStorage.removeItem('notionAuth')
  }
} 