const API_BASE_URL = 'http://localhost:3001/api/notion'

export const notionOAuth = {
  getAuthUrl: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth-url`)
      if (!response.ok) {
        throw new Error('Failed to get auth URL')
      }
      const data = await response.json()
      console.log('Received auth URL:', data.url)
      return data.url
    } catch (error) {
      console.error('Error getting auth URL:', error)
      throw error
    }
  },

  exchangeCodeForToken: async (code) => {
    try {
      const response = await fetch(`${API_BASE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to exchange code for token')
      }

      const data = await response.json()
      localStorage.setItem('notionAuth', JSON.stringify({
        accessToken: data.access_token,
        workspaceId: data.workspace_id,
        workspaceName: data.workspace_name,
        workspaceIcon: data.workspace_icon,
        botId: data.bot_id
      }))
      
      return data
    } catch (error) {
      console.error('Error exchanging code for token:', error)
      throw error
    }
  },

  getUserInfo: async (accessToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/user?access_token=${accessToken}`)
      if (!response.ok) {
        throw new Error('Failed to get user info')
      }
      return response.json()
    } catch (error) {
      console.error('Error getting user info:', error)
      throw error
    }
  },

  getDatabases: async (accessToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/databases?access_token=${accessToken}`)
      if (!response.ok) {
        throw new Error('Failed to get databases')
      }
      return response.json()
    } catch (error) {
      console.error('Error getting databases:', error)
      throw error
    }
  },

  syncNote: async (note, accessToken) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sync-note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note, access_token: accessToken })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.details || 'Failed to sync note with Notion')
      }

      const data = await response.json()
      return {
        ...data,
        synced: true,
        title: data.title || note.title,
        content: data.content || note.content,
        createdAt: data.createdAt || note.createdAt,
        updatedAt: data.updatedAt || note.updatedAt,
        tags: note.tags
      }
    } catch (error) {
      console.error('Sync error:', error)
      return {
        ...note,
        syncError: error.message,
        synced: false
      }
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