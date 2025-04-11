import React from 'react'
import { useState, useEffect } from 'react'
import { Menu, PenLine, Tag, Image, Mic, Upload, MoreVertical, Wifi, WifiOff, ChevronDown, X, Loader2, LogOut, RefreshCw } from 'lucide-react'
import { notionOAuth } from './services/notion-oauth'
import { register, checkForUpdates } from './registerServiceWorker'

// Tags from the template structure
const AVAILABLE_TAGS = [
  { name: "Work", color: "blue" },
  { name: "Personal", color: "green" },
  { name: "Ideas", color: "yellow" },
  { name: "Important", color: "red" },
  { name: "Project", color: "purple" },
  { name: "Reference", color: "orange" }
]

const defaultTags = [
  { id: '1', name: 'Work', color: 'bg-blue-500' },
  { id: '2', name: 'Personal', color: 'bg-green-500' },
  { id: '3', name: 'Ideas', color: 'bg-yellow-500' },
  { id: '4', name: 'Tasks', color: 'bg-red-500' }
]

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children; 
  }
}

export default function App() {
  const [connected, setConnected] = useState(true)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteContent, setNoteContent] = useState("")
  const [selectedTags, setSelectedTags] = useState([])
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const [notes, setNotes] = useState([])
  const [currentNoteId, setCurrentNoteId] = useState(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [databases, setDatabases] = useState([])
  const [selectedDatabase, setSelectedDatabase] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [tags, setTags] = useState(defaultTags)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [notionAuth, setNotionAuth] = useState(null)
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Check authentication status on mount
  useEffect(() => {
    const authData = localStorage.getItem('notionAuth')
    if (authData) {
      const { user, databases } = JSON.parse(authData)
      setUserInfo(user)
      setDatabases(databases)
      setIsAuthenticated(true)
      setNotionAuth(JSON.parse(authData))
    }
  }, [])

  // Check online status
  useEffect(() => {
    const handleOnline = () => setConnected(true)
    const handleOffline = () => setConnected(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Initial check
    setConnected(navigator.onLine)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load saved notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem('notes')
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes))
    }
  }, [])

  // Save notes to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('notes', JSON.stringify(notes))
  }, [notes])

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Sync notes with Notion when online
  useEffect(() => {
    if (isOnline && notionAuth) {
      syncUnsyncedNotes()
    }
  }, [isOnline, notionAuth])

  // Register service worker on mount
  useEffect(() => {
    register();
  }, []);

  const handleAddTag = (tag) => {
    if (!selectedTags.some(t => t.name === tag.name)) {
      setSelectedTags([...selectedTags, tag])
    }
    setShowTagDropdown(false)
  }

  const handleRemoveTag = (tagToRemove) => {
    setSelectedTags(selectedTags.filter(tag => tag.name !== tagToRemove.name))
  }

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setConnectionError(null);
      
      const authUrl = await notionOAuth.getAuthUrl();
      console.log('Redirecting to:', authUrl);
      window.location.href = authUrl;
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('notionAuth')
    setIsAuthenticated(false)
    setUserInfo(null)
    setDatabases([])
    setSelectedDatabase(null)
    setNotionAuth(null)
  }

  const syncUnsyncedNotes = async () => {
    const unsyncedNotes = notes.filter(note => !note.synced && (note.title || note.content))
    if (unsyncedNotes.length === 0) return

    setIsSyncing(true)
    try {
      const updatedNotes = [...notes]
      for (const note of unsyncedNotes) {
        const syncedNote = await notionOAuth.syncNote(note, notionAuth.accessToken)
        if (syncedNote && syncedNote.id) {
          // Remove the synced note from the local state
          const index = updatedNotes.findIndex(n => n.id === note.id)
          if (index !== -1) {
            updatedNotes.splice(index, 1)
          }
        }
      }
      
      setNotes(updatedNotes)
      localStorage.setItem('notes', JSON.stringify(updatedNotes))
    } catch (error) {
      console.error('Sync error:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Filter out synced notes when displaying
  const unsyncedNotes = notes.filter(note => !note.synced)

  const handleSaveNote = async () => {
    if (!notionAuth) {
      setConnectionError('Please connect to Notion first');
      return;
    }

    try {
      setIsSyncing(true);
      const newNote = {
        id: currentNoteId || Date.now().toString(),
        title: noteTitle,
        content: noteContent,
        tags: selectedTags,
        category: selectedCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Always save to local storage first
      setNotes(prevNotes => {
        const existingNoteIndex = prevNotes.findIndex(n => n.id === newNote.id);
        if (existingNoteIndex >= 0) {
          const updatedNotes = [...prevNotes];
          updatedNotes[existingNoteIndex] = { ...newNote, synced: false };
          localStorage.setItem('notes', JSON.stringify(updatedNotes));
          return updatedNotes;
        }
        const updatedNotes = [...prevNotes, { ...newNote, synced: false }];
        localStorage.setItem('notes', JSON.stringify(updatedNotes));
        return updatedNotes;
      });

      // Try to sync with Notion if online
      if (connected) {
        const syncedNote = await notionOAuth.syncNote(newNote, notionAuth.accessToken);
        
        if (syncedNote.synced) {
          // Update the note in local storage with synced status
          setNotes(prevNotes => {
            const updatedNotes = prevNotes.map(note => 
              note.id === newNote.id ? { ...note, synced: true } : note
            );
            localStorage.setItem('notes', JSON.stringify(updatedNotes));
            return updatedNotes;
          });
        } else {
          setConnectionError(syncedNote.syncError || 'Failed to sync note with Notion');
        }
      }

      // Reset form fields regardless of sync status
      setNoteTitle('');
      setNoteContent('');
      setSelectedTags([]);
      setSelectedCategory('');
      setCurrentNoteId(null);
    
    } catch (error) {
      console.error('Error saving note:', error);
      setConnectionError(error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectNote = (note) => {
    setCurrentNoteId(note.id)
    setNoteTitle(note.title)
    setNoteContent(note.content)
    setSelectedTags(note.tags)
  }

  const handleNewNote = () => {
    setCurrentNoteId(null)
    setNoteTitle("")
    setNoteContent("")
    setSelectedTags([])
  }

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    )
  }

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const handleTagChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setSelectedTags(selectedOptions);
  };

  const handleCheckForUpdates = () => {
    checkForUpdates();
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'} w-80 bg-white shadow-lg transition-transform duration-200 ease-in-out z-20`}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold">My Notes</h2>
            <button 
              onClick={() => setShowSidebar(false)}
              className="p-1 hover:bg-gray-100 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-4">
            <button 
              onClick={handleNewNote}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md mb-4 hover:bg-blue-600"
            >
              New Note
            </button>
            <div className="space-y-2">
              {unsyncedNotes.map(note => {
                // Skip empty notes
                if (!note.title && !note.content) return null;
                
                return (
                  <div 
                    key={note.id || `note-${Date.now()}-${Math.random()}`}
                    onClick={() => handleSelectNote(note)}
                    className={`p-3 rounded-md cursor-pointer hover:bg-gray-50 border ${
                      currentNoteId === note.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <h3 className="font-medium">{note.title || 'Untitled Note'}</h3>
                      {!note.synced && (
                        <WifiOff size={16} className="text-amber-500" />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.tags && note.tags.map(tag => (
                        <span 
                          key={`${note.id || 'untitled'}-${tag.name}`}
                          className={`text-xs px-2 py-1 rounded-md bg-${tag.color}-100 text-${tag.color}-800`}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="p-4 border-t">
            <button
              onClick={handleCheckForUpdates}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <RefreshCw className="h-5 w-5" />
              <span>Check for Updates</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-1 ${showSidebar ? 'ml-80' : ''} transition-all duration-200`}>
          <div className="flex flex-col h-screen">
            {/* Header */}
            <header className="bg-white shadow-sm px-4 py-2 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <Menu className="h-6 w-6 text-gray-500" />
                </button>
                <h1 className="font-semibold text-lg">NoteSync</h1>
              </div>
              <div className="flex items-center space-x-4">
                {!isAuthenticated ? (
                  <div className="flex flex-col items-end">
                    <button 
                      className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm hover:bg-blue-700 flex items-center disabled:opacity-50"
                      onClick={handleConnect}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <img 
                            src="https://www.notion.so/front-static/favicon.ico" 
                            alt="Notion" 
                            className="w-4 h-4 mr-2"
                          />
                          Connect with Notion
                        </>
                      )}
                    </button>
                    {connectionError && (
                      <span className="text-red-500 text-xs mt-1">{connectionError}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center space-x-2">
                      {userInfo?.avatar_url && (
                        <img 
                          src={userInfo.avatar_url} 
                          alt={userInfo.name} 
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="text-sm text-gray-600">{userInfo?.name}</span>
                    </div>
                    {connected ? 
                      <div className="flex items-center text-green-500 text-sm">
                        <Wifi className="h-4 w-4 mr-1" /> Synced with Notion
                      </div> : 
                      <div className="flex items-center text-amber-500 text-sm">
                        <WifiOff className="h-4 w-4 mr-1" /> Offline Mode
                      </div>
                    }
                    <button 
                      className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm flex items-center hover:bg-blue-700"
                      onClick={syncUnsyncedNotes}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        'Sync Now'
                      )}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                      title="Disconnect from Notion"
                    >
                      <LogOut size={16} />
                    </button>
                  </>
                )}
              </div>
            </header>
            
            {/* Note Content */}
            <main className="flex-grow overflow-auto p-4 min-h-0">
              <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6 flex flex-col h-full">
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note Title"
                  className="w-full text-xl font-medium mb-4 border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-400"
                />
                
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {selectedTags.map((tag) => (
                    <div 
                      key={tag.name} 
                      className={`bg-${tag.color}-100 text-${tag.color}-800 px-2 py-1 rounded-md text-xs flex items-center`}
                    >
                      {tag.name}
                      <span 
                        className="ml-1 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveTag(tag)
                        }}
                      >
                        ×
                      </span>
                    </div>
                  ))}
                  <div className="relative">
                    <button 
                      className="text-gray-500 text-xs border border-dashed border-gray-300 px-2 py-1 rounded-md flex items-center gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowTagDropdown(!showTagDropdown)
                      }}
                    >
                      + Add Tag
                      <ChevronDown size={12} />
                    </button>
                    
                    {showTagDropdown && (
                      <div className="absolute z-10 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200">
                        {AVAILABLE_TAGS
                          .filter(tag => !selectedTags.some(t => t.name === tag.name))
                          .map(tag => (
                            <button
                              key={tag.name}
                              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddTag(tag)
                              }}
                            >
                              <div className={`w-2 h-2 rounded-full bg-${tag.color}-500`}></div>
                              {tag.name}
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
                
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Start typing your note..."
                  className="w-full flex-grow resize-none focus:outline-none min-h-40"
                />
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-3">
                      <button className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
                        <PenLine size={20} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
                        <Tag size={20} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
                        <Image size={20} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
                        <Mic size={20} />
                      </button>
                      <button className="text-gray-500 hover:text-gray-800 p-2 rounded-full hover:bg-gray-100">
                        <Upload size={20} />
                      </button>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-500">
                      <span className="mr-2">Maps to: Meeting Notes</span>
                      <MoreVertical size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </main>
            
            {/* Template Selector */}
            <footer className="bg-white border-t border-gray-200 p-3">
              <div className="max-w-3xl mx-auto flex justify-between items-center">
                <div className="flex items-center">
                  <span className="text-sm text-gray-600 mr-2">Category:</span>
                  <select 
                    className="text-sm border rounded-md py-1 px-2 bg-gray-50"
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                  >
                    <option>Quick Note</option>
                    <option>Meeting Notes</option>
                    <option>Project Idea</option>
                    <option>Task</option>
                  </select>
                </div>
                <button 
                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                  onClick={handleSaveNote}
                >
                  Save to Notion
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
