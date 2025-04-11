import React from 'react'
import { useState, useEffect } from 'react'
import { Menu, PenLine, Tag, Image, Mic, Upload, MoreVertical, Wifi, WifiOff, ChevronDown, X, Loader2, LogOut, RefreshCw, FileText, BookOpen, PlusCircle, Edit } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { notionOAuth } from './services/notion-oauth'
import { register, checkForUpdates } from './registerServiceWorker'

// Tags from the template structure
const AVAILABLE_TAGS = [
  { name: "Work", color: "blue" },
  { name: "Personal", color: "green" },
  { name: "Ideas", color: "yellow" },
  { name: "Important", color: "red" },
  { name: "Project", color: "purple" },
  { name: "Reference", color: "orange" },
  { name: 'Urgent', color: 'red' },
  { name: 'Idea', color: 'purple' },
  { name: 'Follow Up', color: 'yellow' },
];

const defaultTags = [
  { id: '1', name: 'Work', color: 'bg-blue-500' },
  { id: '2', name: 'Personal', color: 'bg-green-500' },
  { id: '3', name: 'Ideas', color: 'bg-yellow-500' },
  { id: '4', name: 'Tasks', color: 'bg-red-500' }
]

// Add Template Definitions
const NOTE_TEMPLATES = [
  {
    name: 'Meeting Notes',
    title: 'Meeting Notes: [Topic]',
    content: '### Attendees\n- \n\n### Agenda\n1. \n\n### Discussion\n- \n\n### Action Items\n- [ ] Task (Assignee)\n'
  },
  {
    name: 'Project Idea',
    title: 'Project Idea: [Name]',
    content: '### Problem\n\n\n### Proposed Solution\n\n\n### Target Audience\n\n\n### Potential Features\n- \n'
  },
  {
    name: 'Daily Journal',
    title: 'Daily Journal - {new Date().toLocaleDateString()}',
    content: '### Today\'s Focus\n\n\n### Wins\n- \n\n### Challenges\n- \n\n### Gratitude\n- \n'
  }
];

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="flex items-center justify-center h-screen bg-red-100">
            <div className="text-center p-6 bg-white rounded shadow-md">
                <h1 className="text-xl font-semibold text-red-700 mb-2">Something went wrong.</h1>
                <p className="text-red-600 mb-4">Please try refreshing the page.</p>
                {this.state.error && <pre className="text-xs text-left bg-gray-100 p-2 rounded overflow-auto">{this.state.error.toString()}</pre>}
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
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
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [customTemplates, setCustomTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateFormName, setTemplateFormName] = useState('');
  const [templateFormTitle, setTemplateFormTitle] = useState('');
  const [templateFormContent, setTemplateFormContent] = useState('');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);
  const [showFormattingHelpModal, setShowFormattingHelpModal] = useState(false);
  const [editorViewMode, setEditorViewMode] = useState('editor');
  
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

  // Load custom templates from localStorage on mount OR initialize with defaults
  useEffect(() => {
    const savedCustomTemplates = localStorage.getItem('customNoteTemplates');
    if (savedCustomTemplates) {
      try {
        const parsedTemplates = JSON.parse(savedCustomTemplates);
        // Ensure it's an array before setting state
        if (Array.isArray(parsedTemplates)) {
          setCustomTemplates(parsedTemplates);
          console.log('Loaded custom templates from localStorage:', parsedTemplates);
        } else {
          console.error("Parsed templates from localStorage is not an array:", parsedTemplates);
          // Initialize with defaults if stored data is invalid
          setCustomTemplates([...NOTE_TEMPLATES]); 
          console.log('Initialized with default templates (invalid stored data).');
          localStorage.removeItem('customNoteTemplates'); // Clear invalid data
        }
      } catch (error) {
        console.error("Error parsing custom templates from localStorage:", error);
        // Initialize with defaults if parsing fails
        setCustomTemplates([...NOTE_TEMPLATES]); 
        console.log('Initialized with default templates (parse error).');
        localStorage.removeItem('customNoteTemplates'); // Clear invalid data
      }
    } else {
      // If nothing in localStorage, initialize with default templates
      setCustomTemplates([...NOTE_TEMPLATES]); 
      console.log('Initialized with default templates (no stored data).');
    }
  }, []);

  // Save custom templates to localStorage whenever they change
  useEffect(() => {
    // Log the state *before* saving to localStorage
    console.log('[useEffect saveTemplates] State before saving:', customTemplates);
    if (customTemplates.length > 0 || localStorage.getItem('customNoteTemplates') !== null) {
        console.log('[useEffect saveTemplates] Saving to localStorage:', JSON.stringify(customTemplates));
        localStorage.setItem('customNoteTemplates', JSON.stringify(customTemplates));
    }
  }, [customTemplates]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close tag dropdown
      if (showTagDropdown && !event.target.closest('.tag-dropdown-container')) {
        setShowTagDropdown(false);
      }
      // Close template dropdown
      if (showTemplateDropdown && !event.target.closest('.template-dropdown-container')) {
         setShowTemplateDropdown(false);
      }
      // Close template modal
      if (showTemplateModal && !event.target.closest('.template-modal-content')) {
          handleCancelTemplateModal();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagDropdown, showTemplateDropdown, showTemplateModal]);

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
    notionOAuth.disconnect();
    setIsSyncing(false);
    setNotes([]);
    setCurrentNoteId(null);
    setNoteTitle('');
    setNoteContent('');
    setSelectedTags([]);
    setSelectedCategory('');
    setConnectionError(null);
    console.log('Disconnected from Notion');
  }

  const syncUnsyncedNotes = async () => {
    // Ensure we are authenticated, not already syncing, and online
    if (!isOnline || !notionAuth?.accessToken || isSyncing) return;

    const notesToSync = notes.filter(note => !note.synced);

    if (notesToSync.length === 0) {
      console.log("No local notes need syncing.");
      return; // Nothing to do
    }

    setIsSyncing(true);
    console.log(`Attempting to sync ${notesToSync.length} unsynced notes...`);

    let successfullySyncedIds = [];
    let syncErrors = [];

    // Process each unsynced note individually
    for (const note of notesToSync) {
      try {
        console.log(`Syncing note ID: ${note.id}`);
        // --- Use the actual sync function from notionOAuth ---
        // Call the sync function. If it throws, the catch block handles it.
        await notionOAuth.syncNote(note, notionAuth.accessToken);

        // If the above line didn't throw, the sync was successful.
        successfullySyncedIds.push(note.id);
        console.log(`Successfully synced note ID: ${note.id}`);

      } catch (error) {
        // Handle network errors or exceptions during the API call
        console.error(`Error syncing note ID: ${note.id}:`, error);
        syncErrors.push({ id: note.id, error: error.message || 'Network or API error' });
        // Decide if you want to stop syncing on the first error or continue
        // break; // Uncomment to stop on first error
      }
    }

    // Update local state only for notes that were successfully synced
    if (successfullySyncedIds.length > 0) {
      setNotes(prevNotes =>
        prevNotes.map(note =>
          successfullySyncedIds.includes(note.id) ? { ...note, synced: true } : note
        )
      );
      console.log(`Updated local state for ${successfullySyncedIds.length} synced notes.`);
    }

    if (syncErrors.length > 0) {
      console.warn("Some notes failed to sync:", syncErrors);
      // Optionally, provide feedback to the user about the errors
      // setConnectionError(`Failed to sync ${syncErrors.length} note(s). Check console.`);
    }

    setIsSyncing(false);
    console.log("Sync process finished.");
  };

  // Filter out synced notes when displaying
  const unsyncedNotes = notes.filter(note => !note.synced).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

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
      if (isOnline) { 
        try {
          // Attempt the sync. If it fails, the catch block below will handle it.
          await notionOAuth.syncNote(newNote, notionAuth.accessToken);
          
          // If sync didn't throw, update local state to synced: true
          console.log(`Successfully synced note ${newNote.id} after saving.`);
          setNotes(prevNotes => {
            const updatedNotes = prevNotes.map(note => 
              note.id === newNote.id ? { ...note, synced: true } : note
            );
            localStorage.setItem('notes', JSON.stringify(updatedNotes));
            return updatedNotes;
          });
          setConnectionError(null); // Clear previous errors on successful sync

        } catch (syncError) {
          // Catch errors specifically from notionOAuth.syncNote
          const errorMessage = syncError.message || 'Failed to sync note with Notion after saving.';
          console.error('Sync failed after save:', errorMessage);
          setConnectionError(errorMessage); 
          // Note remains marked as synced: false locally (already done before the try block)
        }
      } else {
         // If offline, ensure the note is marked as unsynced (already done above)
         console.log("Offline during save, note marked for later sync.");
         // Optionally inform user they are offline
         // setConnectionError("You are offline. Note saved locally."); 
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
    console.log("Checking for updates...");
    checkForUpdates((updateAvailable) => {
      if (updateAvailable) {
        if (window.confirm("A new version is available. Reload to update?")) {
          window.location.reload();
        }
      } else {
        alert("You have the latest version.");
      }
    });
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

  // New handler to apply template
  const handleApplyTemplate = (template) => {
    // Dynamically replace date placeholder if present
    let finalTitle = template.title;
    if (template.title.includes('{new Date().toLocaleDateString()}')) {
        finalTitle = template.title.replace('{new Date().toLocaleDateString()}', new Date().toLocaleDateString());
    }
    
    setNoteTitle(finalTitle);
    setNoteContent(template.content);
    setShowTemplateDropdown(false); // Close dropdown
    // Optional: Automatically close sidebar on mobile after applying template
    if (window.innerWidth < 768) { // md breakpoint
        closeSidebar();
    }
  };

  // Template Modal Handlers
  const handleOpenAddTemplateModal = () => {
    setIsEditingTemplate(false);
    setEditingTemplateIndex(null);
    // Reset form fields
    setTemplateFormName('');
    setTemplateFormTitle('');
    setTemplateFormContent('');
    setShowTemplateModal(true); // Show the modal
    setShowTemplateDropdown(false); // Close the dropdown
  };

  const handleOpenEditTemplateModal = (index) => {
    const templateToEdit = customTemplates[index];
    if (!templateToEdit) return; // Safety check

    setIsEditingTemplate(true);
    setEditingTemplateIndex(index);
    // Populate form fields with existing data
    setTemplateFormName(templateToEdit.name);
    setTemplateFormTitle(templateToEdit.title);
    setTemplateFormContent(templateToEdit.content);
    setShowTemplateModal(true); // Show the modal
    setShowTemplateDropdown(false); // Close the dropdown
  };

  const handleCancelTemplateModal = () => {
    setShowTemplateModal(false);
    // Reset editing state just in case
    setIsEditingTemplate(false);
    setEditingTemplateIndex(null);
    // Optionally clear form fields on cancel too?
    // setTemplateFormName('');
    // setTemplateFormTitle('');
    // setTemplateFormContent('');
  };

  const handleSaveOrUpdateTemplate = (e) => {
    e.preventDefault();
    if (!templateFormName.trim()) {
      console.error("Template name cannot be empty.");
      return;
    }
    const templateData = {
      name: templateFormName.trim(),
      title: templateFormTitle,
      content: templateFormContent
    };

    console.log('[handleSaveOrUpdateTemplate] State *before* update:', customTemplates);
    console.log('[handleSaveOrUpdateTemplate] Template data to add/update:', templateData);

    if (isEditingTemplate && editingTemplateIndex !== null) {
      const updatedTemplates = [...customTemplates];
      updatedTemplates[editingTemplateIndex] = templateData;
      console.log('[handleSaveOrUpdateTemplate] Setting updated state (edit):', updatedTemplates);
      setCustomTemplates(updatedTemplates); 
    } else {
      console.log('[handleSaveOrUpdateTemplate] Setting updated state (add):', prev => [...prev, templateData]);
      setCustomTemplates(prev => [...prev, templateData]); 
    }
    
    // Note: Logging *after* setCustomTemplates here won't show the immediate update due to async nature

    handleCancelTemplateModal();
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
                    {isOnline ? 
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
                      disabled={isSyncing || !isOnline}
                      title={!isOnline ? "Cannot sync while offline" : "Sync notes with Notion"}
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

          {/* New Note Button & Quick Actions */}
          <div className="p-4 space-y-2">
            <button 
              onClick={handleNewNoteAndCloseSidebar} // Close sidebar on new note
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 text-sm font-medium flex items-center justify-center space-x-2"
            >
              <PenLine size={16} />
              <span>New Note</span>
            </button>

            {/* Quick Actions Row */}
            <div className="flex space-x-2"> 
              {/* Template Button Dropdown */}
              <div className="relative flex-1 template-dropdown-container">
                <button
                  className="w-full bg-gray-100 text-gray-700 py-1.5 px-3 rounded-md hover:bg-gray-200 text-xs font-medium flex items-center justify-center space-x-1.5"
                  title="Use a template"
                  onClick={(e) => { e.stopPropagation(); setShowTemplateDropdown(!showTemplateDropdown); }}
                  aria-haspopup="true"
                  aria-expanded={showTemplateDropdown}
                >
                  <FileText size={14} />
                  <span>Templates</span>
                   <ChevronDown size={12} className={`ml-auto transition-transform duration-200 ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showTemplateDropdown && (
                  <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto bg-white rounded-md shadow-lg border border-gray-200 py-1 left-0 right-0">
                    {/* This loop now renders ALL templates (built-in and custom) */}
                    {customTemplates.map((template, index) => (
                      <div key={`custom-${index}-${template.name}`} className="flex items-center justify-between px-3 py-0 hover:bg-gray-100">
                        <button
                          className={`flex-grow text-left py-2 text-sm flex items-center gap-2`}
                          onClick={(e) => { e.stopPropagation(); handleApplyTemplate(template); }}
                        >
                          {template.name}
                        </button>
                        {/* Edit button applies to all templates now */}
                        <button
                          className="p-1 text-gray-400 hover:text-blue-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          onClick={(e) => { e.stopPropagation(); handleOpenEditTemplateModal(index); }}
                          title={`Edit "${template.name}" template`}
                        >
                          <Edit size={14} stroke="currentColor" /> 
                        </button>
                      </div>
                    ))}

                    {/* Separator before Add button (only needs customTemplates check now) */}
                    {customTemplates.length > 0 && (
                       <hr className="my-1 border-gray-200" />
                    )}

                    {/* Add Custom Template Button */}
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                      onClick={(e) => { e.stopPropagation(); handleOpenAddTemplateModal(); }}
                    >
                      <PlusCircle size={14} />
                      Add Custom Template
                    </button>
                  </div>
                )}
              </div>

              {/* Formatting Help Button (Now functional) */}
              <button 
                className="flex-1 bg-gray-100 text-gray-700 py-1.5 px-3 rounded-md hover:bg-gray-200 text-xs font-medium flex items-center justify-center space-x-1.5"
                title="View Markdown formatting help"
                onClick={() => setShowFormattingHelpModal(true)}
              >
                <BookOpen size={14} />
                <span>Formatting</span>
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto p-4 pt-0 space-y-2"> 
            {unsyncedNotes.length === 0 && (
              <div className="text-center py-10 px-4">
                <FileText size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No Notes Yet</h3>
                <p className="text-sm text-gray-500 mb-4">Click the "New Note" button above to get started.</p>
              </div>
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
             <h1 className="font-bold text-xl">Thought Base</h1>
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
                        {isOnline ? 
                          <div className="flex items-center text-green-600 text-sm">
                            <Wifi className="h-4 w-4 mr-1" /> Synced
                          </div> : 
                          <div className="flex items-center text-amber-600 text-sm">
                            <WifiOff className="h-4 w-4 mr-1" /> Offline
                          </div>
                        }
                        <button 
                          // Conditionally add animate-pulse when syncing
                          className={`bg-blue-600 text-white px-3 py-1 rounded-md text-sm flex items-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${
                            isSyncing ? 'animate-pulse' : ''
                          }`}
                          onClick={syncUnsyncedNotes}
                          disabled={isSyncing || !isOnline}
                          title={!isOnline ? "Cannot sync while offline" : "Sync notes with Notion"}
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
            
          {/* Note Content - Updated layout for Editor + Preview */}
          <main className="flex-grow overflow-y-auto p-4 md:p-6 lg:p-8">
            {/* Main card container */}
            <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-4 md:p-6 flex flex-col h-full">
              {/* Note Title Input */}
              <input
                type="text"
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="Note Title"
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
                <div className="relative tag-dropdown-container">
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
                    <div className="absolute z-10 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 right-0">
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
              
              {/* Editor/Preview Toggle Buttons */}
              <div className="mb-2 border-b border-gray-200">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                  <button
                    onClick={() => setEditorViewMode('editor')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                      editorViewMode === 'editor'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setEditorViewMode('preview')}
                    className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                      editorViewMode === 'preview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Preview
                  </button>
                </nav>
              </div>

              {/* Editor & Preview Area - Conditionally Rendered */}
              {/* Remove grid layout, make container flex-grow */}
              <div className="flex-grow min-h-[300px]">
                {/* Editor Column - Render only if mode is 'editor' */}
                {editorViewMode === 'editor' && (
                  <div className="flex flex-col h-full">
                    {/* <label htmlFor="note-editor" className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Editor (Markdown)</label> */}
                    <textarea
                      id="note-editor"
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Start typing your note..."
                      className="w-full flex-grow resize-none focus:outline-none text-base leading-relaxed bg-gray-50 border border-gray-200 rounded-md p-3 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 font-mono h-full"
                    />
                  </div>
                )}
                
                {/* Preview Column - Render only if mode is 'preview' */}
                {editorViewMode === 'preview' && (
                  <div className="h-full overflow-y-auto border border-gray-200 rounded-md p-3 bg-white">
                    {/* <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">Preview</label> */}
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} // Enable GitHub Flavored Markdown
                      >
                        {noteContent || "*Preview will appear here...*"}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Editor Toolbar (Optional) - Placed below editor/preview grid */}
              <div className="border-t border-gray-200 pt-3 mt-4"> 
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

      {/* Template Modal (for Add/Edit) */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4 template-modal-content">
            <form onSubmit={handleSaveOrUpdateTemplate}>
              <h3 className="text-lg font-medium mb-4 text-gray-800">
                {isEditingTemplate ? 'Edit Custom Template' : 'Add Custom Template'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">Template Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    id="templateName"
                    value={templateFormName}
                    onChange={(e) => setTemplateFormName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="e.g., Weekly Review"
                  />
                </div>
                <div>
                  <label htmlFor="templateTitle" className="block text-sm font-medium text-gray-700 mb-1">Default Title Format</label>
                  <input
                    type="text"
                    id="templateTitle"
                    value={templateFormTitle}
                    onChange={(e) => setTemplateFormTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="e.g., Weekly Review - {date}"
                  />
                   <p className="text-xs text-gray-500 mt-1">You can use {'{new Date().toLocaleDateString()}'} for the current date.</p>
                </div>
                <div>
                  <label htmlFor="templateContent" className="block text-sm font-medium text-gray-700 mb-1">Template Content (Markdown)</label>
                  <textarea
                    id="templateContent"
                    rows="6"
                    value={templateFormContent}
                    onChange={(e) => setTemplateFormContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
                    placeholder="### Section 1&#10;- Point A&#10;- Point B"
                  ></textarea>
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCancelTemplateModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  {isEditingTemplate ? 'Update Template' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Formatting Help Modal */}
      {showFormattingHelpModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md m-4">
            <h3 className="text-lg font-medium mb-4 text-gray-800">Markdown Formatting Help</h3>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-2">
              <p>Use Markdown to format your notes:</p>
              <ul>
                <li><code># Heading 1</code></li>
                <li><code>## Heading 2</code></li>
                <li><code>**Bold Text**</code> or <code>__Bold Text__</code></li>
                <li><code>*Italic Text*</code> or <code>_Italic Text_</code></li>
                <li><code>- Unordered List Item</code></li>
                <li><code>1. Ordered List Item</code></li>
                <li><code>[Link Text](https://example.com)</code></li>
                <li><code>`Inline Code`</code></li>
                <li><pre><code>```\\nCode Block\\n```</code></pre></li>
                <li><code>---</code> for a horizontal rule</li>
              </ul>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowFormattingHelpModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </ErrorBoundary>
  )
}
