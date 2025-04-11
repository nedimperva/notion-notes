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

  // Toggle sidebar visibility
  const toggleSidebar = () => setShowSidebar(!showSidebar);

  // Close sidebar (useful on mobile when clicking outside or on an item)
  const closeSidebar = () => setShowSidebar(false);

  // Handlers adjusted slightly for sidebar closing
  const handleSelectNoteAndCloseSidebar = (note) => {
    handleSelectNote(note);
    closeSidebar();
  };

  const handleNewNoteAndCloseSidebar = () => {
    handleNewNote();
    closeSidebar();
  };

  return (
    <ErrorBoundary>
      {/* Main container - Use flex-col on mobile, flex-row on md and up */}
      <div className="flex flex-col md:flex-row h-screen bg-gray-50">
        
        {/* Mobile Header (Only visible on screens smaller than md) */}
        <header className="md:hidden bg-white shadow-sm px-4 py-3 flex justify-between items-center border-b">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
            aria-label="Toggle menu"
          >
            <Menu size={24} className="text-gray-600" />
          </button>
          <h1 className="font-semibold text-lg">Thought Base</h1>
          {/* Placeholder for potential right-side icon/button if needed */}
          <div className="w-8 h-8"></div> 
        </header>

        {/* Sidebar */}
        {/* Base styles: fixed inset-0, transform for sliding, z-index */}
        {/* Responsive styles: 
            - Mobile: full width, translate-x controlled by state
            - Desktop (md+): static position, fixed width, always visible (translate-x-0) 
        */}
        <div className={`fixed inset-0 md:static z-30 bg-white shadow-lg md:shadow-none border-r border-gray-200 
                       transform transition-transform duration-300 ease-in-out 
                       ${showSidebar ? 'translate-x-0' : '-translate-x-full'} 
                       md:translate-x-0 md:w-64 lg:w-80 flex flex-col`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold hidden md:block">My Notes</h2>
            {/* Close button - visible only below md */}
            <button 
              onClick={closeSidebar}
              className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 md:hidden"
              aria-label="Close menu"
            >
              <X size={24} className="text-gray-600" />
            </button>
          </div>

          {/* Authentication Section */}
          <div className="p-4 border-b">
            {!isAuthenticated ? (
              <div className="flex flex-col items-center">
                <button 
                  className="w-full bg-teal-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-teal-600 flex items-center justify-center space-x-2 disabled:opacity-50"
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
                  <span className="text-red-500 text-xs mt-2 text-center">{connectionError}</span>
                )}
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  {userInfo?.avatar_url && (
                    <img 
                      src={userInfo.avatar_url} 
                      alt={userInfo.name} 
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700 font-medium truncate">{userInfo?.name}</span>
                </div>
                 <div className="flex items-center justify-between text-xs">
                    {connected ? 
                      <div className="flex items-center text-green-600">
                        <Wifi size={14} className="mr-1" /> Online
                      </div> : 
                      <div className="flex items-center text-amber-600">
                        <WifiOff size={14} className="mr-1" /> Offline
                      </div>
                    }
                     <button 
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={syncUnsyncedNotes}
                      disabled={isSyncing || !connected}
                      title={!connected ? "Cannot sync while offline" : "Sync notes with Notion"}
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 size={14} className="mr-1 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        'Sync Now'
                      )}
                    </button>
                 </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full text-left text-sm text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-md flex items-center space-x-2"
                  title="Disconnect from Notion"
                >
                  <LogOut size={16} />
                  <span>Disconnect</span>
                </button>
              </div>
            )}
          </div>

          {/* New Note Button */}
          <div className="p-4">
            <button 
              onClick={handleNewNoteAndCloseSidebar} // Close sidebar on new note
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg mb-4 hover:bg-blue-600 text-sm font-medium flex items-center justify-center space-x-2"
            >
              <PenLine size={16} />
              <span>New Note</span>
            </button>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-2"> 
            {unsyncedNotes.length === 0 && (
              <p className="text-sm text-gray-500 text-center mt-4">No local notes found.</p>
            )}
            {unsyncedNotes.map(note => {
              // Skip empty notes
              if (!note.title && !note.content) return null;
              
              return (
                <div 
                  key={note.id || `note-${Date.now()}-${Math.random()}`}
                  onClick={() => handleSelectNoteAndCloseSidebar(note)} // Close sidebar on select
                  className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 border ${
                    currentNoteId === note.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-medium text-sm truncate pr-2">{note.title || 'Untitled Note'}</h3>
                    {!note.synced && (
                      <WifiOff size={14} className="text-amber-500 flex-shrink-0" title="Not Synced"/>
                    )}
                  </div>
                  {/* Optional: Show snippet of content */}
                  {/* <p className="text-xs text-gray-600 truncate mb-2">{note.content || 'No content'}</p> */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {note.tags && note.tags.map(tag => (
                      <span 
                        key={`${note.id || 'untitled'}-${tag.name}`}
                        className={`text-xs px-2 py-0.5 rounded-md bg-${tag.color}-100 text-${tag.color}-800`}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(note.updatedAt || note.createdAt || Date.now()).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200 mt-auto">
            <button
              onClick={handleCheckForUpdates}
              className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 w-full justify-center p-2 rounded-lg hover:bg-gray-100"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Check for Updates</span>
            </button>
          </div>
        </div>

        {/* Backdrop (for mobile sidebar) */}
        {showSidebar && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          ></div>
        )}

        {/* Main Content Area */}
        {/* Use flex-1 to take remaining space. Adjust padding for mobile/desktop */}
        <div className="flex-1 flex flex-col overflow-hidden"> 
          {/* Desktop Header (Hidden on mobile) */}
          <header className="hidden md:flex bg-white shadow-sm px-6 py-3 justify-between items-center border-b">
            {/* Left side - perhaps breadcrumbs or title */}
             <h1 className="font-semibold text-lg">Thought Base</h1>
            {/* Right side - Auth status, sync, etc. */}
            <div className="flex items-center space-x-4">
               {/* Keep the existing desktop header buttons/info here */}
                {!isAuthenticated ? (
                  <div className="flex flex-col items-end"> {/* Still show connect button here */}
                     <button 
                      className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm hover:bg-blue-700 flex items-center disabled:opacity-50"
                      onClick={handleConnect}
                      disabled={isConnecting}
                    >
                       {/* ... connect button content ... */}
                       <>
                          <img 
                            src="https://www.notion.so/front-static/favicon.ico" 
                            alt="Notion" 
                            className="w-4 h-4 mr-2"
                          />
                          Connect with Notion
                        </>
                    </button>
                    {connectionError && (
                      <span className="text-red-500 text-xs mt-1">{connectionError}</span>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Desktop Auth Info */}
                    <div className="flex items-center space-x-2">
                      {userInfo?.avatar_url && (
                        <img 
                          src={userInfo.avatar_url} 
                          alt={userInfo.name} 
                          className="w-7 h-7 rounded-full"
                        />
                      )}
                      <span className="text-sm text-gray-600">{userInfo?.name}</span>
                    </div>
                     {/* Desktop Connection Status & Sync */}
                     <div className="flex items-center space-x-4">
                        {connected ? 
                          <div className="flex items-center text-green-600 text-sm">
                            <Wifi className="h-4 w-4 mr-1" /> Synced
                          </div> : 
                          <div className="flex items-center text-amber-600 text-sm">
                            <WifiOff className="h-4 w-4 mr-1" /> Offline
                          </div>
                        }
                        <button 
                          className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={syncUnsyncedNotes}
                          disabled={isSyncing || !connected}
                           title={!connected ? "Cannot sync while offline" : "Sync notes with Notion"}
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
                      </div>
                    <button
                      onClick={handleDisconnect}
                      className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                      title="Disconnect from Notion"
                    >
                      <LogOut size={18} />
                    </button>
                  </>
                )}
            </div>
          </header>
            
          {/* Note Content */}
          {/* flex-grow allows this to take available space, overflow-auto for scrolling */}
          {/* Adjust padding: p-4 on mobile, p-6 or p-8 on desktop */}
          <main className="flex-grow overflow-y-auto p-4 md:p-6 lg:p-8">
            {/* Card container for the note */}
            {/* Use min-h-0 on parent flex containers if height issues arise */}
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-4 md:p-6 flex flex-col h-full">
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note Title"
                // Increased font size for better readability, especially on mobile
                className="w-full text-lg md:text-xl font-medium mb-4 border-b border-gray-300 pb-2 focus:outline-none focus:border-blue-500 bg-transparent"
              />
              
              {/* Tags Section */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {selectedTags.map((tag) => (
                  <div 
                    key={tag.name} 
                    // Slightly larger padding and font for tags
                    className={`bg-${tag.color}-100 text-${tag.color}-900 px-2.5 py-1 rounded-full text-xs font-medium flex items-center shadow-sm`}
                  >
                    {tag.name}
                    <button // Make remove button slightly larger/easier to tap
                      className="ml-1.5 -mr-0.5 p-0.5 rounded-full text-${tag.color}-600 hover:bg-${tag.color}-200 focus:outline-none focus:ring-1 focus:ring-${tag.color}-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveTag(tag)
                      }}
                      aria-label={`Remove ${tag.name} tag`}
                    >
                      <X size={12} strokeWidth={3}/>
                    </button>
                  </div>
                ))}
                {/* Add Tag Button Dropdown */}
                <div className="relative">
                  <button 
                    className="text-gray-500 hover:text-gray-700 text-xs border border-dashed border-gray-300 px-3 py-1.5 rounded-full flex items-center gap-1 hover:border-gray-400 hover:bg-gray-50"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowTagDropdown(!showTagDropdown)
                    }}
                    aria-haspopup="true"
                    aria-expanded={showTagDropdown}
                  >
                    <Tag size={12}/>
                    <span>Add Tag</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showTagDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showTagDropdown && (
                    <div className="absolute z-10 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1">
                      {AVAILABLE_TAGS
                        .filter(tag => !selectedTags.some(t => t.name === tag.name))
                        .map(tag => (
                          <button
                            key={tag.name}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center gap-2.5`}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddTag(tag)
                            }}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full bg-${tag.color}-500 flex-shrink-0`}></span>
                            {tag.name}
                          </button>
                        ))
                      }
                      {AVAILABLE_TAGS.filter(tag => !selectedTags.some(t => t.name === tag.name)).length === 0 && (
                        <span className="px-3 py-2 text-sm text-gray-500 block">No more tags</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Textarea - Use flex-grow to fill space */}
              {/* Ensure min-h for usability, adjust font size */}
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Start typing your note..."
                className="w-full flex-grow resize-none focus:outline-none text-base leading-relaxed min-h-[200px] md:min-h-[300px] mb-4" // Added min-height and leading
              />
              
              {/* Editor Toolbar (Optional) - adjust spacing/layout */}
              <div className="border-t border-gray-200 pt-3 mt-auto"> 
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex space-x-1"> 
                    {/* Make buttons slightly larger for touch */}
                    <button className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                      <PenLine size={18} />
                    </button>
                    {/* Add other buttons similarly */}
                    <button className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                      <Image size={18} />
                    </button>
                    <button className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                      <Mic size={18} />
                    </button>
                    <button className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                      <Upload size={18} />
                    </button>
                  </div>
                  
                  {/* Removed "Maps to:" section for brevity, can be added back if needed */}
                   <button className="text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200">
                      <MoreVertical size={18} />
                   </button>
                </div>
              </div>
            </div>
          </main>
            
          {/* Footer / Save Area */}
          {/* Use flex-col on mobile, flex-row on desktop. Adjust padding/spacing */}
          <footer className="bg-white border-t border-gray-200 p-3 md:p-4">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
              <div className="flex items-center w-full sm:w-auto">
                <label htmlFor="category-select" className="text-sm text-gray-600 mr-2 whitespace-nowrap">Category:</label>
                <select 
                  id="category-select"
                  className="w-full sm:w-auto text-sm border border-gray-300 rounded-md py-1.5 px-2 bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500" // Added focus styles
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                >
                  <option value="">Quick Note</option> {/* Use empty value for default */}
                  <option>Meeting Notes</option>
                  <option>Project Idea</option>
                  <option>Task</option>
                </select>
              </div>
              <button 
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium shadow-sm disabled:opacity-60 flex items-center justify-center space-x-2"
                onClick={handleSaveNote}
                disabled={isSyncing || !isAuthenticated || (!noteTitle && !noteContent)} // Disable if not auth, syncing, or note is empty
                title={!isAuthenticated ? "Connect to Notion to save" : (!noteTitle && !noteContent) ? "Add title or content to save" : "Save note"}
              >
                 {isSyncing ? <Loader2 size={16} className="animate-spin" /> : null}
                 <span>Save Note</span> 
              </button>
            </div>
          </footer>
        </div>
      </div>
    </ErrorBoundary>
  )
}
