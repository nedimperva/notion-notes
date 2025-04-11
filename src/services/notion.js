import { Client } from '@notionhq/client'

class NotionService {
  constructor() {
    this.client = null
    this.databaseId = null
  }

  initialize(apiKey, databaseId) {
    this.client = new Client({ auth: apiKey })
    this.databaseId = databaseId
  }

  async syncNote(note) {
    if (!this.client || !this.databaseId) {
      throw new Error('Notion client not initialized')
    }

    try {
      // Check if note already exists in Notion
      const existingPage = await this.findExistingPage(note.id)
      
      if (existingPage) {
        // Update existing page
        await this.updatePage(existingPage.id, note)
        return { ...note, notionId: existingPage.id, synced: true }
      } else {
        // Create new page
        const newPage = await this.createPage(note)
        return { ...note, notionId: newPage.id, synced: true }
      }
    } catch (error) {
      console.error('Error syncing note to Notion:', error)
      return { ...note, synced: false, syncError: error.message }
    }
  }

  async findExistingPage(noteId) {
    const response = await this.client.databases.query({
      database_id: this.databaseId,
      filter: {
        property: 'Note ID',
        rich_text: {
          equals: noteId.toString()
        }
      }
    })
    return response.results[0]
  }

  async createPage(note) {
    return await this.client.pages.create({
      parent: { database_id: this.databaseId },
      properties: {
        'Title': {
          title: [
            {
              text: {
                content: note.title || 'Untitled Note'
              }
            }
          ]
        },
        'Content': {
          rich_text: [
            {
              text: {
                content: note.content || ''
              }
            }
          ]
        },
        'Note ID': {
          rich_text: [
            {
              text: {
                content: note.id.toString()
              }
            }
          ]
        },
        'Tags': {
          multi_select: note.tags.map(tag => ({ name: tag.name }))
        },
        'Created At': {
          date: {
            start: note.createdAt
          }
        },
        'Last Modified': {
          date: {
            start: note.lastModified
          }
        }
      }
    })
  }

  async updatePage(pageId, note) {
    return await this.client.pages.update({
      page_id: pageId,
      properties: {
        'Title': {
          title: [
            {
              text: {
                content: note.title || 'Untitled Note'
              }
            }
          ]
        },
        'Content': {
          rich_text: [
            {
              text: {
                content: note.content || ''
              }
            }
          ]
        },
        'Tags': {
          multi_select: note.tags.map(tag => ({ name: tag.name }))
        },
        'Last Modified': {
          date: {
            start: note.lastModified
          }
        }
      }
    })
  }
}

export const notionService = new NotionService() 