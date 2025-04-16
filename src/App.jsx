import React, { useState, useEffect, useRef } from 'react'
import { Menu, PenLine, Tag, Image, Mic, Upload, MoreVertical, Wifi, WifiOff, ChevronDown, X, Loader2, LogOut, RefreshCw, FileText, BookOpen, PlusCircle, Edit, Settings, Eye, Code } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { notionOAuth } from './services/notion-oauth'
import { register, checkForUpdates } from './registerServiceWorker'

// Tags with Notion-like Tailwind background/text colors
const TAGS = [
  { name: 'Work', color: 'bg-blue-100 text-blue-800' },
  { name: 'Personal', color: 'bg-purple-100 text-purple-800' },
  { name: 'Ideas', color: 'bg-green-100 text-green-800' },
  { name: 'Important', color: 'bg-red-100 text-red-800' },
  { name: 'Project', color: 'bg-orange-100 text-orange-800' },
  { name: 'Reference', color: 'bg-gray-100 text-gray-800' },
];

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
  const [tags, setTags] = useState(TAGS)
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
  const [showMoreOptionsDropdown, setShowMoreOptionsDropdown] = useState(false);
  // Theme and Font State
  const [theme, setTheme] = useState(() => localStorage.getItem('appTheme') || 'light'); // 'light', 'dark', 'sepia'
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('appFontFamily') || 'sans'); // 'sans', 'mono'
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('appFontSize') || 'base'); // 'sm', 'base', 'lg'
  // Debounce timer ref for autosave
  const autosaveTimerRef = useRef(null);
  
  // Check authentication status on mount
  useEffect(() => {
    const migrateNotionAuth = async (parsedData) => {
      let needsMigration = false;
      if (!parsedData.user || !parsedData.databases) {
        needsMigration = true;
      }
      if (!parsedData.accessToken && parsedData.access_token) {
        // Support both camelCase and snake_case
        parsedData.accessToken = parsedData.access_token;
        needsMigration = true;
      }
      if (needsMigration && parsedData.accessToken) {
        try {
          // Fetch user info and databases
          const [userInfo, databasesData] = await Promise.all([
            notionOAuth.getUserInfo(parsedData.accessToken),
            notionOAuth.getDatabases(parsedData.accessToken)
          ]);
          const upgraded = {
            ...parsedData,
            user: userInfo,
            databases: databasesData.results || []
          };
          localStorage.setItem('notionAuth', JSON.stringify(upgraded));
          setUserInfo(userInfo);
          setDatabases(databasesData.results || []);
          setIsAuthenticated(true);
          setNotionAuth(upgraded);
          console.log('[Migration] Upgraded notionAuth in localStorage:', upgraded);
          return;
        } catch (err) {
          console.error('[Migration] Failed to upgrade notionAuth:', err);
          // Optionally clear invalid auth
          localStorage.removeItem('notionAuth');
          setIsAuthenticated(false);
          setUserInfo(null);
          setDatabases([]);
          setNotionAuth(null);
          return;
        }
      }
      // If no migration needed, just set state as before
      setUserInfo(parsedData.user || null);
      setDatabases(parsedData.databases || []);
      setIsAuthenticated(true);
      setNotionAuth(parsedData);
      console.log('Auth data loaded from localStorage:', parsedData);
    };

    const authData = localStorage.getItem('notionAuth');
    if (authData) {
      try {
        const parsedData = JSON.parse(authData);
        migrateNotionAuth(parsedData);
      } catch (e) {
        console.error('Failed to parse notionAuth from localStorage:', e);
        // Clear corrupted data and reset state
        localStorage.removeItem('notionAuth');
        setIsAuthenticated(false);
        setUserInfo(null);
        setDatabases([]);
        setNotionAuth(null);
      }
    }
  }, []);

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
        // Only use if it's a non-empty array
        if (Array.isArray(parsedTemplates) && parsedTemplates.length > 0) {
          setCustomTemplates(parsedTemplates);
          console.log('Loaded custom templates from localStorage:', parsedTemplates);
        } else {
          setCustomTemplates([...NOTE_TEMPLATES]);
          console.log('Initialized with default templates (empty or invalid stored data).');
          localStorage.removeItem('customNoteTemplates');
        }
      } catch (error) {
        setCustomTemplates([...NOTE_TEMPLATES]);
        console.log('Initialized with default templates (parse error).');
        localStorage.removeItem('customNoteTemplates');
      }
    } else {
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
      // Close 'More Options' dropdown
      if (showMoreOptionsDropdown && !event.target.closest('.more-options-dropdown-container')) {
         setShowMoreOptionsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagDropdown, showTemplateDropdown, showTemplateModal, showMoreOptionsDropdown]);

  // Apply theme class to HTML element and save to localStorage
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'sepia'); // Remove previous theme classes
    root.classList.add(theme); // Add current theme class
    localStorage.setItem('appTheme', theme);

    // Special handling for Tailwind's dark mode
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark'); // Ensure dark class is removed for light/sepia
    }
    // Add specific sepia styles if needed - for now just adds the class
    if (theme === 'sepia') {
        // Example: Define CSS variables or add specific classes here if not using Tailwind JIT directly
        // root.style.setProperty('--sepia-bg', '#f1e7d0');
        // root.style.setProperty('--sepia-text', '#433422');
    } else {
        // root.style.removeProperty('--sepia-bg');
        // root.style.removeProperty('--sepia-text');
    }

  }, [theme]);

  // Save font family to localStorage
  useEffect(() => {
    localStorage.setItem('appFontFamily', fontFamily);
  }, [fontFamily]);

  // Save font size to localStorage
  useEffect(() => {
    localStorage.setItem('appFontSize', fontSize);
  }, [fontSize]);

  // --- Autosave Logic ---
  const autosaveNote = (noteId, title, content, tags) => {
    console.log('[Autosave] Triggered for noteId:', noteId);
    setNotes(prevNotes => {
      let updatedNotes;
      let noteToUpdateId = noteId;

      if (noteToUpdateId) {
        // Update existing note
        const existingNoteIndex = prevNotes.findIndex(n => n.id === noteToUpdateId);
        if (existingNoteIndex === -1) {
          console.error('[Autosave] Error: Cannot find existing note with ID:', noteToUpdateId);
          return prevNotes; // Return previous state if note not found
        }
        updatedNotes = [...prevNotes];
        updatedNotes[existingNoteIndex] = {
          ...updatedNotes[existingNoteIndex],
          title: title,
          content: content,
          tags: tags, // Make sure to include tags
          lastModified: new Date().toISOString(),
          synced: false // Mark as unsynced whenever local changes occur
        };
        console.log('[Autosave] Updated existing note:', updatedNotes[existingNoteIndex]);
      } else {
        // Create new note if title or content exists
        if (!title && !content) {
          console.log('[Autosave] Skipping creation: No title or content.');
          return prevNotes; // Don't create empty notes automatically
        }
        const newNote = {
          id: Date.now().toString(), // Generate new ID
          title: title,
          content: content,
          tags: tags,
          lastModified: new Date().toISOString(),
          createdAt: new Date().toISOString(), // Add createdAt for new notes
          synced: false
        };
        updatedNotes = [...prevNotes, newNote];
        noteToUpdateId = newNote.id; // Get the ID of the newly created note
        setCurrentNoteId(newNote.id); // Update currentNoteId state
        console.log('[Autosave] Created new note:', newNote);
      }

      // Save updated notes array to localStorage
      localStorage.setItem('notes', JSON.stringify(updatedNotes));
      return updatedNotes;
    });
  };

  // Debounced autosave effect for title and content
  useEffect(() => {
    // Clear existing timer on change
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set a new timer
    autosaveTimerRef.current = setTimeout(() => {
      // Only autosave if there's content or a title, or if it's an existing note being modified
      if (currentNoteId || noteTitle || noteContent) {
          autosaveNote(currentNoteId, noteTitle, noteContent, selectedTags);
      }
    }, 1500); // Autosave after 1.5 seconds of inactivity

    // Cleanup timer on component unmount or before next run
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  // Depend on the fields that trigger the save
  }, [noteTitle, noteContent, currentNoteId, selectedTags]); 

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

  // New function to explicitly sync the current note
  const handleSyncCurrentNote = async () => {
    if (!isOnline || !isAuthenticated || !currentNoteId || isSyncing) {
      console.log('[Sync] Conditions not met:', { isOnline, isAuthenticated, currentNoteId, isSyncing });
      return; // Exit if offline, not auth, no note selected, or already syncing
    }

    const noteToSync = notes.find(n => n.id === currentNoteId);

    if (!noteToSync) {
      console.error('[Sync] Cannot find current note with ID:', currentNoteId);
      setConnectionError('Could not find the note to sync.');
      return;
    }

    // Optional: Check if already synced (though autosave should mark it unsynced on change)
    // if (noteToSync.synced) {
    //   console.log('[Sync] Note already synced:', currentNoteId);
    //   return;
    // }

    setIsSyncing(true);
    setConnectionError(null);
    console.log(`[Sync] Attempting to sync note ID: ${currentNoteId}`);

    try {
      // Use the existing syncNote function
      await notionOAuth.syncNote(noteToSync, notionAuth.accessToken);
      
      // Update local state to synced: true
      setNotes(prevNotes => {
        const updatedNotes = prevNotes.map(note => 
          note.id === currentNoteId ? { ...note, synced: true } : note
        );
        localStorage.setItem('notes', JSON.stringify(updatedNotes)); // Update localStorage as well
        console.log(`[Sync] Successfully synced note ID: ${currentNoteId}. Updated local state.`);
        return updatedNotes;
      });
      
      // --- Clear editor for new note after successful sync ---
      console.log('[Sync] Clearing editor for new note.');
      setCurrentNoteId(null);
      setNoteTitle('');
      setNoteContent('');
      setSelectedTags([]);
      // --- End clear editor ---
      
    } catch (error) {
      const errorMessage = error.message || 'Failed to sync note with Notion.';
      console.error('[Sync] Error syncing note:', errorMessage);
      setConnectionError(errorMessage);
      // Note remains marked as synced: false locally
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSelectNote = (note) => {
    // Clear any pending autosave from the previous note
    if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
    }
    // Set ID first
    setCurrentNoteId(note.id)
    setNoteTitle(note.title || "") // Handle potentially undefined title
    setNoteContent(note.content || "") // Handle potentially undefined content
    setSelectedTags(note.tags || []) // Handle potentially undefined tags
  }

  const handleNewNote = () => {
     // Clear any pending autosave from the previous note
    if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
    }
    setCurrentNoteId(null) // Explicitly set to null for new note
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
    setShowTemplateDropdown(false); // Close template sub-dropdown
  };

  // Template Modal Handlers
  const handleOpenAddTemplateModal = () => {
    setIsEditingTemplate(false);
    setEditingTemplateIndex(null);
    setTemplateFormName('');
    setTemplateFormTitle('');
    setTemplateFormContent('');
    setShowTemplateModal(true); 
    setShowTemplateDropdown(false); // Close template sub-dropdown
  };

  const handleOpenEditTemplateModal = (index) => {
    const templateToEdit = customTemplates[index];
    if (!templateToEdit) return; 

    setIsEditingTemplate(true);
    setEditingTemplateIndex(index);
    setTemplateFormName(templateToEdit.name);
    setTemplateFormTitle(templateToEdit.title);
    setTemplateFormContent(templateToEdit.content);
    setShowTemplateModal(true); 
    setShowTemplateDropdown(false); // Close template sub-dropdown
  };

  const handleCancelTemplateModal = () => {
    setShowTemplateModal(false);
    // Reset editing state just in case
    setIsEditingTemplate(false);
    setEditingTemplateIndex(null);
  };

  const handleSaveOrUpdateTemplate = (e) => {
    e.preventDefault();
    console.log('[handleSaveOrUpdateTemplate] Start');
    console.log('[handleSaveOrUpdateTemplate] Current customTemplates state:', customTemplates);
    console.log('[handleSaveOrUpdateTemplate] Editing:', isEditingTemplate, 'Index:', editingTemplateIndex);

    const newTemplate = {
      name: templateFormName,
      title: templateFormTitle,
      content: templateFormContent,
    };
    console.log('[handleSaveOrUpdateTemplate] New/Updated Template:', newTemplate);

    let updatedTemplates;
    if (isEditingTemplate && editingTemplateIndex !== null) {
      // Update existing template
      updatedTemplates = customTemplates.map((template, index) =>
        index === editingTemplateIndex ? newTemplate : template
      );
      console.log('[handleSaveOrUpdateTemplate] Updated templates array (edit):', updatedTemplates);
    } else {
      // Add new template
      // Ensure customTemplates is an array before spreading
      const currentTemplatesArray = Array.isArray(customTemplates) ? customTemplates : [];
      updatedTemplates = [...currentTemplatesArray, newTemplate];
      console.log('[handleSaveOrUpdateTemplate] Updated templates array (add):', updatedTemplates);
    }

    // Update state immediately
    setCustomTemplates(updatedTemplates);
    // Log state right after setting it
    console.log('[handleSaveOrUpdateTemplate] State after setCustomTemplates:', updatedTemplates);

    setShowTemplateModal(false); // Close modal
    // Reset form fields
    setTemplateFormName('');
    setTemplateFormTitle('');
    setTemplateFormContent('');
    setIsEditingTemplate(false);
    setEditingTemplateIndex(null);
    console.log('[handleSaveOrUpdateTemplate] End');
  };

  // Template delete handler
  const handleDeleteTemplate = (index) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      setCustomTemplates(prev => prev.filter((_, i) => i !== index));
    }
  };

  // --- Theme and Font Handlers ---
  const handleThemeChange = (newTheme) => {
      setTheme(newTheme);
      // Close dropdown after selection
       setShowMoreOptionsDropdown(false);
  };

  const handleFontChange = (newFont) => {
      setFontFamily(newFont);
      // Close dropdown after selection
       setShowMoreOptionsDropdown(false);
  };

  // New handler for font size change
  const handleFontSizeChange = (newSize) => {
    setFontSize(newSize);
    setShowMoreOptionsDropdown(false); // Close dropdown after selection
  }

  return (
    <ErrorBoundary>
      {/* Main container with flex layout - Added dark mode classes */}
      <div className={`flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${fontFamily === 'mono' ? 'font-mono' : 'font-sans'}`}>

        {/* Sidebar (No major changes here, styling is mostly self-contained) */}
        <div className={`fixed inset-y-0 left-0 transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'} w-64 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-transform duration-300 ease-in-out z-30 flex flex-col`}>
          <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Notes</h2>
            <button onClick={closeSidebar} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700">
              <X size={20} />
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-2">
            <button onClick={handleNewNoteAndCloseSidebar} className="w-full flex items-center justify-center px-3 py-2 mb-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              <PlusCircle size={16} className="mr-1" /> New Note
            </button>
            {/* Filter notes to show only unsynced ones before sorting and mapping */}
            {notes
              .filter(note => !note.synced)
              .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
              .map((note) => (
              <div
                key={note.id}
                onClick={() => handleSelectNoteAndCloseSidebar(note)}
                className={`p-2 rounded cursor-pointer ${currentNoteId === note.id ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              >
                <h3 className="font-medium truncate">{note.title || "Untitled Note"}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{note.content ? note.content.substring(0, 50) + '...' : 'Empty note'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(note.lastModified).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
           {/* Sidebar Footer - Notion Connection */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {isAuthenticated && userInfo ? (
              <div className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50">
                <span className="text-sm truncate">
                {userInfo.bot?.workspace_name}
                </span>
              </div>
            ) : (
              <button onClick={handleConnect} disabled={isConnecting} className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800 disabled:opacity-50">
                {isConnecting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                Connect to Notion
              </button>
            )}
            {connectionError && <p className="text-xs text-red-500 mt-1">{connectionError}</p>}
             {/* Database Selector - simplified */}
             {isAuthenticated && databases.length > 0 && (
                <div className="mt-2">
                  <select
                    value={selectedDatabase || ''}
                    onChange={(e) => setSelectedDatabase(e.target.value)}
                    className="w-full text-xs p-1 border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="" disabled>Select Notion DB</option>
                    {databases.map(db => (
                      <option key={db.id} value={db.id}>{Array.isArray(db.title) ? (db.title[0]?.plain_text || 'Untitled') : (db.title || 'Untitled')}</option>
                    ))}
                  </select>
                </div>
              )}
          </div>
        </div>

         {/* Main content area */}
        <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out overflow-hidden"> {/* Added overflow-hidden */}
           {/* Header - Adjusted padding and height */}
           <header className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700 h-12 flex-shrink-0">
              {/* Left side: Menu toggle and Title */}
              <div className="flex items-center flex-grow min-w-0"> 
                <button onClick={toggleSidebar} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 mr-2 flex-shrink-0">
                  <Menu size={20} />
                </button>
                 <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note Title"
                    className="text-base font-medium bg-transparent focus:outline-none focus:ring-0 border-none p-1 flex-grow min-w-0 truncate dark:placeholder-gray-600 placeholder-gray-400 hover:placeholder-gray-500 focus:placeholder-gray-500 dark:hover:placeholder-gray-500 dark:focus:placeholder-gray-400"
                 />
              </div>

               {/* Right side: Actions and Status */}
               <div className="flex items-center space-x-2">
                 {/* Editor Mode Toggle */}
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md">
                     <button
                        onClick={() => setEditorViewMode('editor')}
                        className={`px-2 py-1 text-xs rounded-l-md ${editorViewMode === 'editor' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title="Edit Mode"
                    >
                         <Code size={14} />
                    </button>
                     <button
                        onClick={() => setEditorViewMode('preview')}
                        className={`px-2 py-1 text-xs rounded-r-md ${editorViewMode === 'preview' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        title="Preview Mode"
                    >
                         <Eye size={14} />
                    </button>
                 </div>

                 {/* Tag Selection - now always visible */}
                 <div className="relative tag-dropdown-container">
                   <button onClick={() => setShowTagDropdown(!showTagDropdown)} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center">
                     <Tag size={14} className="mr-1" /> Tags
                     {selectedTags.length > 0 && (
                       <span className="ml-1 text-xs font-semibold text-indigo-600">({selectedTags.length})</span>
                     )}
                     <ChevronDown size={14} className={`ml-1 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                   </button>
                   {showTagDropdown && (
                     <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-2 z-30 border border-gray-200 dark:border-gray-700">
                       <div className="px-3 pb-2">
                         {selectedTags.length > 0 ? (
                           <div className="flex flex-wrap gap-1">
                             {selectedTags.map(tag => (
                               <span key={tag.name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tag.color}`}>
                                 {tag.name}
                                 <button onClick={() => handleRemoveTag(tag)} className={`ml-1 flex-shrink-0 ${tag.color.split(' ')[1]} hover:text-${tag.color.split(' ')[1].replace('800', '700')} focus:outline-none`}>
                                   <X size={10} strokeWidth={3}/>
                                 </button>
                               </span>
                             ))}
                           </div>
                         ) : (
                           <span className="text-xs text-gray-400">No tags selected</span>
                         )}
                       </div>
                       <div className="border-t border-gray-200 dark:border-gray-700 pt-2 px-3">
                         <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Add Tag</div>
                         {TAGS.filter(at => !selectedTags.some(st => st.name === at.name)).map(tag => (
                           <button
                             key={tag.name}
                             onClick={() => handleAddTag(tag)}
                             className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
                           >
                             <span className={`w-2.5 h-2.5 rounded-full mr-2 ${tag.color.split(' ')[0]}`}></span>
                             {tag.name}
                           </button>
                         ))}
                         {TAGS.filter(at => !selectedTags.some(st => st.name === at.name)).length === 0 && (
                           <p className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400">No more tags</p>
                         )}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Template Selection - now always visible */}
                 <div className="relative template-dropdown-container">
                   <button onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center">
                     <FileText size={14} className="mr-1" /> Templates
                     <ChevronDown size={14} className={`ml-1 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                   </button>
                   {showTemplateDropdown && (
                     <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-30 border border-gray-200 dark:border-gray-700">
                       <button onClick={handleOpenAddTemplateModal} className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center">
                         <PlusCircle size={14} className="mr-2 flex-shrink-0" /> Add New Template
                       </button>
                       {(Array.isArray(customTemplates) ? customTemplates : []).map((template, index) => (
                         <div key={index} className="flex items-center justify-between px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 group">
                           <span onClick={() => handleApplyTemplate(template)} className="flex-grow cursor-pointer truncate">{template.name}</span>
                           <button onClick={() => handleOpenEditTemplateModal(index)} className="ml-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-indigo-600" title="Edit Template">
                             <Edit size={12} className="flex-shrink-0" />
                           </button>
                           <button onClick={() => handleDeleteTemplate(index)} className="ml-2 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700" title="Delete Template">
                             <X size={12} className="flex-shrink-0" />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>

                 {/* Explicit Sync Button */} 
                 <button 
                    onClick={handleSyncCurrentNote}
                    disabled={!isOnline || !isAuthenticated || !currentNoteId || isSyncing || notes.find(n => n.id === currentNoteId)?.synced}
                    className="p-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!isAuthenticated ? "Connect to Notion first" : !isOnline ? "Cannot sync while offline" : !currentNoteId ? "Select a note to sync" : notes.find(n => n.id === currentNoteId)?.synced ? "Note is synced" : "Sync note to Notion"}
                 >
                    {isSyncing ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                 </button>

                  {/* Online/Offline Status Icon */}
                 <div className="flex items-center space-x-1">
                     {isOnline ? <Wifi size={16} className="text-green-500" title="Online"/> : <WifiOff size={16} className="text-red-500" title="Offline"/>}
                 </div>

                 {/* More Options Dropdown */}
                 <div className="relative more-options-dropdown-container">
                    <button onClick={() => setShowMoreOptionsDropdown(!showMoreOptionsDropdown)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                         <MoreVertical size={20} />
                     </button>
                     {showMoreOptionsDropdown && (
                          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-20 border border-gray-200 dark:border-gray-700 max-h-[80vh] overflow-y-auto">
                               {/* Theme, Font, Font Size, Notion, etc. (remove Tag/Template sections from here) */}
                               <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                   <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Theme</h4>
                                   <div className="flex items-center justify-between space-x-1">
                                       <button onClick={() => handleThemeChange('light')} className={`flex-1 text-xs py-1 px-2 rounded ${theme === 'light' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Light</button>
                                       <button onClick={() => handleThemeChange('dark')} className={`flex-1 text-xs py-1 px-2 rounded ${theme === 'dark' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Night</button>
                                       <button onClick={() => handleThemeChange('sepia')} className={`flex-1 text-xs py-1 px-2 rounded ${theme === 'sepia' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}>Sepia</button>
                                   </div>
                               </div>

                               <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                   <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Font Family</h4>
                                   <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md w-full">
                                       <button
                                           onClick={() => handleFontChange('sans')}
                                           className={`flex-1 px-2 py-1 text-xs rounded-l-md ${fontFamily === 'sans' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center space-x-1`}
                                           title="Sans Serif Font"
                                       >
                                          <span>Sans</span>
                                       </button>
                                       <button
                                           onClick={() => handleFontChange('mono')}
                                           className={`flex-1 px-2 py-1 text-xs rounded-r-md ${fontFamily === 'mono' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center space-x-1`}
                                           title="Monospace Font"
                                       >
                                           <span>Mono</span>
                                       </button>
                                   </div>
                               </div>

                               <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                   <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Font Size</h4>
                                   <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md w-full">
                                       <button
                                           onClick={() => handleFontSizeChange('sm')}
                                           className={`flex-1 px-2 py-1 text-xs rounded-l-md ${fontSize === 'sm' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center`}
                                           title="Small Font Size"
                                       >
                                          Small
                                       </button>
                                       <button
                                           onClick={() => handleFontSizeChange('base')}
                                           className={`flex-1 px-2 py-1 text-xs border-l border-r border-gray-300 dark:border-gray-600 ${fontSize === 'base' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center`}
                                           title="Medium Font Size"
                                       >
                                          Medium
                                       </button>
                                       <button
                                           onClick={() => handleFontSizeChange('lg')}
                                           className={`flex-1 px-2 py-1 text-xs rounded-r-md ${fontSize === 'lg' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center`}
                                           title="Large Font Size"
                                       >
                                          Large
                                       </button>
                                   </div>
                               </div>

                               <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">View Mode</h4>
                                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md w-full">
                                      <button
                                          onClick={() => { setEditorViewMode('editor'); setShowMoreOptionsDropdown(false); }}
                                          className={`flex-1 px-2 py-1 text-xs rounded-l-md ${editorViewMode === 'editor' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center space-x-1`}
                                          title="Edit Mode"
                                      >
                                          <Code size={14} /> <span>Editor</span>
                                      </button>
                                      <button
                                          onClick={() => { setEditorViewMode('preview'); setShowMoreOptionsDropdown(false); }}
                                          className={`flex-1 px-2 py-1 text-xs rounded-r-md ${editorViewMode === 'preview' ? 'bg-indigo-100 dark:bg-indigo-800' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} flex items-center justify-center space-x-1`}
                                          title="Preview Mode"
                                      >
                                          <Eye size={14} /> <span>Preview</span>
                                      </button>
                                  </div>
                              </div>

                               <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                   <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Notion</h4>
                                   {isAuthenticated && userInfo ? (
                                       <div className="flex items-center justify-between mb-1">
                                           <span className="text-sm truncate flex items-center">
                                               <img src="/icons/icon.svg" alt="Notion Icon" className="w-5 h-5 rounded-full mr-2" />
                                               {userInfo.bot?.workspace_name || userInfo.person?.name || userInfo.name || 'Notion'}
                                           </span>
                                           <button onClick={() => { handleDisconnect(); setShowMoreOptionsDropdown(false); }} className="text-xs text-red-600 hover:text-red-800" title="Disconnect Notion">
                                               Disconnect
                                           </button>
                                       </div>
                                   ) : (
                                       <button onClick={() => { handleConnect(); setShowMoreOptionsDropdown(false); }} disabled={isConnecting} className="w-full flex items-center justify-center px-2 py-1 text-sm font-medium text-white bg-gray-700 rounded hover:bg-gray-800 disabled:opacity-50">
                                           {isConnecting ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                                           Connect to Notion
                                       </button>
                                   )}
                                   {connectionError && <p className="text-xs text-red-500 mt-1">{connectionError}</p>}
                                   {isAuthenticated && databases.length > 0 && (
                                       <select
                                           value={selectedDatabase || ''}
                                           onChange={(e) => setSelectedDatabase(e.target.value)}
                                           className="w-full text-xs p-1 mt-2 border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                                       >
                                           <option value="" disabled>Select Notion DB</option>
                                           {databases.map(db => (
                                               <option key={db.id} value={db.id}>{Array.isArray(db.title) ? (db.title[0]?.plain_text || 'Untitled') : (db.title || 'Untitled')}</option>
                                           ))}
                                       </select>
                                   )}
                               </div>

                               <div className="px-4 py-2">
                                   <button onClick={() => { setShowFormattingHelpModal(true); setShowMoreOptionsDropdown(false); }} className="w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center">
                                       <BookOpen size={14} className="mr-2" /> Formatting Help
                                   </button>
                                    <button className="w-full text-left px-2 py-1 text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center cursor-not-allowed" title="Settings (coming soon)">
                                       <Settings size={14} className="mr-2" /> Settings
                                   </button>
                               </div>
                           </div>
                       )}
                    </div>
                  </div>
              </header>

             <main className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-white dark:bg-gray-900 
                             ${fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'}`}>
                  {editorViewMode === 'editor' ? (
                      <textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Start writing..."
                          className={`w-full h-full resize-none focus:outline-none bg-transparent dark:placeholder-gray-600 placeholder-gray-500 p-1 ${fontFamily === 'mono' ? 'font-mono' : 'font-sans'} 
                                     ${fontSize === 'sm' ? 'leading-relaxed' : fontSize === 'lg' ? 'leading-loose' : 'leading-relaxed'}`} 
                      />
                  ) : (
                      <div className={`prose dark:prose-invert max-w-none h-full overflow-y-auto p-1 ${fontFamily === 'mono' ? 'prose-mono' : ''} 
                                      ${fontSize === 'sm' ? 'prose-sm leading-relaxed' : fontSize === 'lg' ? 'prose-lg leading-loose' : 'prose-base leading-relaxed'}`}> 
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                      </div>
                  )}
             </main>

              <footer className="p-2 text-xs text-gray-400 dark:text-gray-500 h-8 flex items-center justify-end flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                   <span>{noteContent.split(/\s+/).filter(Boolean).length} words, {noteContent.length} characters</span>
              </footer>

         </div>

         {showTemplateModal && (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md template-modal-content">
                     <h3 className="text-lg font-medium mb-4">{isEditingTemplate ? 'Edit Template' : 'Add New Template'}</h3>
                     <form onSubmit={handleSaveOrUpdateTemplate}>
                         <div className="mb-4">
                             <label htmlFor="templateName" className="block text-sm font-medium mb-1">Template Name</label>
                             <input
                                 type="text"
                                 id="templateName"
                                 value={templateFormName}
                                 onChange={(e) => setTemplateFormName(e.target.value)}
                                 required
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                             />
                         </div>
                          <div className="mb-4">
                             <label htmlFor="templateTitle" className="block text-sm font-medium mb-1">Default Title</label>
                              <input
                                 type="text"
                                 id="templateTitle"
                                 value={templateFormTitle}
                                 onChange={(e) => setTemplateFormTitle(e.target.value)}
                                 placeholder="e.g., Meeting Notes: [Topic]"
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                             />
                         </div>
                         <div className="mb-4">
                             <label htmlFor="templateContent" className="block text-sm font-medium mb-1">Content</label>
                              <textarea
                                 id="templateContent"
                                 value={templateFormContent}
                                 onChange={(e) => setTemplateFormContent(e.target.value)}
                                 rows="6"
                                 required
                                 className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                 placeholder="Enter Markdown template content..."
                             />
                         </div>
                         <div className="flex justify-end space-x-2">
                             <button type="button" onClick={handleCancelTemplateModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                                 Cancel
                             </button>
                             <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                                 {isEditingTemplate ? 'Update Template' : 'Save Template'}
                             </button>
                         </div>
                     </form>
                 </div>
             </div>
         )}

         {showFormattingHelpModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                 <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg relative">
                     <button onClick={() => setShowFormattingHelpModal(false)} className="absolute top-2 right-2 p-1 rounded hover:bg-gray-200">
                         <X size={20} />
                     </button>
                      <h3 className="text-lg font-medium mb-4">Markdown Formatting Help</h3>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm space-y-2">
                         <p><code># Heading 1</code></p>
                         <p><code>## Heading 2</code></p>
                         <p><code>**Bold text**</code> or <code>__Bold text__</code></p>
                         <p><code>*Italic text*</code> or <code>_Italic text_</code></p>
                         <p><code>`Inline code`</code></p>
                         <p><code>[Link text](https://example.com)</code></p>
                         <p><code>![Alt text](image_url.jpg)</code></p>
                         <p><code>- Unordered list item</code></p>
                         <p><code>1. Ordered list item</code></p>
                         <p><code>&gt; Blockquote</code></p>
                         <p><code>---</code> or <code>***</code> for horizontal rule</p>
                          <p><code>```python</code><br/><code># Code block</code><br/><code>print(\"Hello\")</code><br/><code>```</code></p>
                          <p><code>- [ ] Task list item</code></p>
                          <p><code>- [x] Completed task</code></p>
                      </div>
                  </div>
            </div>
          )}

       </div>
     </ErrorBoundary>
   )
}
