import React, { useState, useEffect, useRef } from 'react'
import { Menu, PenLine, Tag, Image, Mic, Upload, MoreVertical, Wifi, WifiOff, ChevronDown, X, Loader2, LogOut, RefreshCw, FileText, BookOpen, PlusCircle, Edit, Settings, Eye, Code, MoreHorizontal, Home, Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { notionOAuth } from './services/notion-oauth'

// Cache versioning
const STORAGE_VERSION = '1.0.0';
const STORAGE_KEYS = {
  NOTES: 'thoughtbase_notes',
  TEMPLATES: 'thoughtbase_templates',
  PREFERENCES: 'thoughtbase_preferences'
};

// Enhanced localStorage wrapper with versioning
const storage = {
  get: (key) => {
    try {
      const data = localStorage.getItem(`${key}_v${STORAGE_VERSION}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error(`Error reading ${key} from storage:`, e);
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(`${key}_v${STORAGE_VERSION}`, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error writing ${key} to storage:`, e);
      // Try to recover space by clearing old versions
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(key) && !k.endsWith(STORAGE_VERSION)) {
          localStorage.removeItem(k);
        }
      });
      // Retry the save
      try {
        localStorage.setItem(`${key}_v${STORAGE_VERSION}`, JSON.stringify(value));
        return true;
      } catch (e) {
        console.error('Failed to save even after cleanup:', e);
        return false;
      }
    }
  }
};

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
  const [isFullWidth, setIsFullWidth] = useState(() => localStorage.getItem('isFullWidth') === 'true'); // Add this line
  // Debounce timer ref for autosave
  const autosaveTimerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const [centeredEditor, setCenteredEditor] = useState(false);
  // Add new state for setup instructions modal
  const [showSetupInstructions, setShowSetupInstructions] = useState(false);
  // PWA installation states
  const [pwaInstallPrompt, setPwaInstallPrompt] = useState(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  // New native app UX states
  const [isNavVisible, setIsNavVisible] = useState(true); // For hiding nav when scrolling
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [hasSafeArea, setHasSafeArea] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const mainContainerRef = useRef(null);
  
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

  // Load saved notes from versioned localStorage
  useEffect(() => {
    console.log('[Storage Load] Attempting to load notes...');
    
    // First try the versioned storage approach
    const savedNotes = storage.get(STORAGE_KEYS.NOTES);
    
    if (savedNotes && Array.isArray(savedNotes) && savedNotes.length > 0) {
      console.log('[Storage Load] Loaded notes using versioned storage:', savedNotes.length);
      setNotes(savedNotes);
    } else {
      // Fallback to checking legacy storage format as backup
      try {
        const legacyNotes = localStorage.getItem('thoughtbase_notes');
        if (legacyNotes) {
          const parsedLegacyNotes = JSON.parse(legacyNotes);
          if (Array.isArray(parsedLegacyNotes) && parsedLegacyNotes.length > 0) {
            console.log('[Storage Load] Loaded notes from legacy storage:', parsedLegacyNotes.length);
            setNotes(parsedLegacyNotes);
            // Also save in the new versioned format for next time
            storage.set(STORAGE_KEYS.NOTES, parsedLegacyNotes);
          } else {
            console.log('[Storage Load] No valid notes found in legacy storage.');
          }
        } else {
          console.log('[Storage Load] No saved notes found in any storage format.');
        }
      } catch (error) {
        console.error('[Storage Load] Error attempting to load notes:', error);
      }
    }
  }, []);

  // Save notes to versioned localStorage whenever they change
  useEffect(() => {
    // Removed the condition: if (notes.length > 0 || storage.get(STORAGE_KEYS.NOTES) !== null)
    // Now it saves whenever the 'notes' state changes after the initial load.
    storage.set(STORAGE_KEYS.NOTES, notes);
    console.log('[Storage] Saved notes to storage:', notes.length);
  }, [notes]);

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

  // Save full width preference to localStorage
  useEffect(() => {
    localStorage.setItem('isFullWidth', isFullWidth);
  }, [isFullWidth]);

  // Check for safe area insets on devices with notches
  useEffect(() => {
    const checkSafeArea = () => {
      // Check if safe areas are supported and needed
      const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0', 10);
      const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0', 10);
      setHasSafeArea(safeAreaTop > 0 || safeAreaBottom > 0);
    };
    
    // Add CSS variables for safe area insets
    document.documentElement.style.setProperty('--sat', 'env(safe-area-inset-top, 0px)');
    document.documentElement.style.setProperty('--sab', 'env(safe-area-inset-bottom, 0px)');
    
    checkSafeArea();
    window.addEventListener('resize', checkSafeArea);
    
    return () => {
      window.removeEventListener('resize', checkSafeArea);
    };
  }, []);

  // Add app loaded animation
  useEffect(() => {
    // Wait for initial rendering to complete
    const timer = setTimeout(() => {
      setIsAppLoaded(true);
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // Hide navigation on scroll for a more native experience on mobile
  useEffect(() => {
    if (!isMobile) return;
    
    const handleScroll = () => {
      if (mainContainerRef.current) {
        const scrollY = mainContainerRef.current.scrollTop;
        const isScrollingDown = scrollY > lastScrollY && scrollY > 40;
        const isScrollingUp = scrollY < lastScrollY;
        
        // Only change state when direction changes to avoid frequent rerenders
        if (isScrollingDown && isNavVisible) {
          setIsNavVisible(false);
        } else if (isScrollingUp && !isNavVisible) {
          setIsNavVisible(true);
        }
        
        setLastScrollY(scrollY);
      }
    };
    
    const container = mainContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [isMobile, lastScrollY, isNavVisible]);

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

  const handleAddTag = (tag, e) => {
    if (e) e.stopPropagation();
    if (!selectedTags.some(t => t.name === tag.name)) {
      setSelectedTags([...selectedTags, tag]);
    }
    // Menu will close only when clicked outside due to the click outside handler
  };

  const handleRemoveTag = (tag, e) => {
    if (e) e.stopPropagation();
    setSelectedTags(selectedTags.filter(t => t.name !== tag.name));
  };

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

  // Filter out synced notes when displaying - Only showing unsynced notes
  const notesToDisplay = notes
    .filter(note => !note.synced)
    .sort((a, b) => new Date(b.lastModified || b.updatedAt || b.createdAt) - new Date(a.lastModified || a.updatedAt || a.createdAt));

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
        storage.set(STORAGE_KEYS.NOTES, updatedNotes); // Update localStorage as well
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

  // Toggle sidebar visibility with animation
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
    // Prevent body scroll when sidebar is open
    document.body.style.overflow = !showSidebar ? 'hidden' : '';
  };

  // Close sidebar (useful on mobile when clicking outside or on an item)
  const closeSidebar = () => {
    setShowSidebar(false);
    document.body.style.overflow = '';
  };

  // Track touch start position for swipe gestures
  const handleTouchStart = (e) => {
    setTouchStartY(e.touches[0].clientY);
  };
  
  // Handle swipe gestures for native mobile app feel
  const handleTouchMove = (e) => {
    if (!isMobile) return;
    
    const touchY = e.touches[0].clientY;
    const touchDiff = touchY - touchStartY;
    
    // If swiping down from the top edge when scrolled to top, show a pull-to-refresh effect
    if (mainContainerRef.current?.scrollTop === 0 && touchDiff > 70) {
      // Could trigger refresh action here
    }
  };

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
  const handleApplyTemplate = (template, e) => {
    if (e) e.stopPropagation();
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

  const handleOpenEditTemplateModal = (index, e) => {
    if (e) e.stopPropagation();
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
  const handleDeleteTemplate = (index, e) => {
    if (e) e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this template?')) {
      setCustomTemplates(prev => prev.filter((_, i) => i !== index));
      setShowTemplateDropdown(false);
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

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // After notion authentication
  useEffect(() => {
    const handleFirstTimeSetup = async () => {
      const hasShownSetup = localStorage.getItem('hasShownNotionSetup');
      if (isAuthenticated && !hasShownSetup) {
        setShowSetupInstructions(true);
        localStorage.setItem('hasShownNotionSetup', 'true');
      }
    };

    handleFirstTimeSetup();
  }, [isAuthenticated]);

  // PWA installation prompt handler
  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setPwaInstallPrompt(e);
      setCanInstallPwa(true);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = () => {
    if (pwaInstallPrompt) {
      pwaInstallPrompt.prompt();
      pwaInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('PWA installation accepted');
        } else {
          console.log('PWA installation dismissed');
        }
        setPwaInstallPrompt(null);
        setCanInstallPwa(false);
        setShowInstallBanner(false);
      });
    }
  };

  console.log('[App Render] Notes state:', notes); // Log notes state on every render

  return (
    <ErrorBoundary>
      <div 
        className={`flex h-screen bg-background text-main ${fontFamily === 'mono' ? 'font-mono' : 'font-sans'} ${!isAppLoaded ? 'opacity-0' : 'app-animate-fade'} overflow-hidden`}
      > 
        {/* Sidebar with improved animation */}
        <div 
          className={`fixed inset-y-0 left-0 app-sidebar ${showSidebar ? 'app-sidebar-show' : 'app-sidebar-hide'} w-64 bg-surface border-r border-main z-30 flex flex-col ${isMobile ? 'top-0 bottom-0' : ''} ${hasSafeArea ? 'app-inset-top' : ''}`}
        > 
          <div className="p-4 flex justify-between items-center border-b border-main">
            <h2 className="text-lg font-semibold">Notes</h2>
            <button onClick={closeSidebar} className="app-icon-btn hover:bg-accent1">
              <X size={20} />
            </button>
          </div>
          <div className="flex-grow overflow-y-auto p-4 space-y-2">
            <button 
              onClick={handleNewNoteAndCloseSidebar} 
              className="app-btn w-full flex items-center justify-center px-3 py-2 mb-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primaryHover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primaryHover"
            >
              <PlusCircle size={16} className="mr-1" /> New Note
            </button>
            {notesToDisplay
              .map((note) => (
              <div
                key={note.id}
                onClick={() => handleSelectNoteAndCloseSidebar(note)}
                className={`app-card p-2 rounded cursor-pointer ${currentNoteId === note.id ? 'bg-primaryLight' : 'hover:bg-accent1'}`}
              >
                <h3 className="font-medium truncate">{note.title || "Untitled Note"}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{note.content ? note.content.substring(0, 50) + '...' : 'Empty note'}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(note.lastModified).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
          {/* Sidebar Footer with user info if authenticated */}
          {isAuthenticated && userInfo && (
            <div className="p-4 border-t border-main flex items-center justify-between">
              <div className="flex items-center">
                {userInfo.bot?.workspace_icon ? (
                  <img 
                    src={userInfo.bot.workspace_icon} 
                    alt="Workspace" 
                    className="w-6 h-6 rounded-full mr-2"
                  />
                ) : (
                  <div className="w-6 h-6 bg-primary rounded-full mr-2 flex items-center justify-center text-white text-xs">
                    {(userInfo.bot?.workspace_name || userInfo.name || 'N')[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm truncate">{userInfo.bot?.workspace_name || userInfo.name || 'Notion'}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Semi-transparent overlay when sidebar is shown on mobile */}
        {isMobile && showSidebar && (
          <div 
            onClick={closeSidebar}
            className="fixed inset-0 bg-black bg-opacity-30 z-20 app-animate-fade" 
          />
        )}
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col transition-all duration-300 ease-in-out overflow-hidden">
          {/* Header (moved to bottom on mobile) */}
          {!isMobile && (
            <header className="app-header flex items-center justify-between p-2 border-b border-main flex-shrink-0 bg-surface/80 w-full">
              {/* Left side: Menu toggle and Title */}
              <div className="flex items-center flex-grow min-w-0">
                <button onClick={toggleSidebar} className="app-btn app-icon-btn mr-2 flex-shrink-0 hover:bg-accent1">
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
                        className={`app-btn px-2 py-1 text-xs rounded-l-md ${editorViewMode === 'editor' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}
                        title="Edit Mode"
                    >
                         <Code size={14} />
                    </button>
                     <button
                        onClick={() => setEditorViewMode('preview')}
                        className={`app-btn px-2 py-1 text-xs rounded-r-md ${editorViewMode === 'preview' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}
                        title="Preview Mode"
                    >
                         <Eye size={14} />
                    </button>
                 </div>

                 {/* Tag Selection - now always visible */}
                 <div className="relative tag-dropdown-container">
                   <button onClick={() => setShowTagDropdown(!showTagDropdown)} className="app-btn px-2 py-1 text-xs rounded bg-primary text-[var(--color-text-on-primary)] hover:bg-primaryHover flex items-center">
                     <Tag size={14} className="mr-1" /> Tags
                     {selectedTags.length > 0 && (
                       <span className="ml-1 text-xs font-semibold text-[var(--color-text-on-primary)]">({selectedTags.length})</span>
                     )}
                     <ChevronDown size={14} className={`ml-1 transition-transform ${showTagDropdown ? 'rotate-180' : ''}`} />
                   </button>
                   {showTagDropdown && (
                     <div className="absolute right-0 mt-1 w-56 bg-surface rounded-md shadow-lg py-2 z-30 border border-main app-animate-slide">
                       {/* Dropdown content remains the same */}
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
                       <div className="border-t border-main pt-2 px-3">
                         <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Add Tag</div>
                         {TAGS.filter(at => !selectedTags.some(st => st.name === at.name)).map(tag => (
                           <button
                             key={tag.name}
                             onClick={() => handleAddTag(tag)}
                             className="app-btn w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-accent1 flex items-center"
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

                 {/* Template Selection */}
                 <div className="relative template-dropdown-container">
                   <button onClick={() => setShowTemplateDropdown(!showTemplateDropdown)} className="app-btn px-2 py-1 text-xs rounded bg-primary text-[var(--color-text-on-primary)] hover:bg-primaryHover flex items-center">
                     <FileText size={14} className="mr-1" /> Templates
                     <ChevronDown size={14} className={`ml-1 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
                   </button>
                   {showTemplateDropdown && (
                     <div className="absolute right-0 mt-1 w-56 bg-surface rounded-md shadow-lg py-1 z-30 border border-main app-animate-slide">
                       {/* Template dropdown content remains the same */}
                     </div>
                   )}
                 </div>

                 {/* Explicit Sync Button */} 
                 <button 
                    onClick={handleSyncCurrentNote}
                    disabled={!isOnline || !isAuthenticated || !currentNoteId || isSyncing || notes.find(n => n.id === currentNoteId)?.synced}
                    className="app-btn app-icon-btn text-gray-600 dark:text-gray-400 hover:bg-accent1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <button onClick={() => setShowMoreOptionsDropdown(!showMoreOptionsDropdown)} className="app-btn app-icon-btn hover:bg-accent1">
                         <MoreVertical size={20} />
                    </button>
                 </div>
              </div>
          </header>
          )}
          
          <main 
            ref={mainContainerRef}
            className={`flex-1 overflow-y-auto p-0 bg-background ${fontSize === 'sm' ? 'text-sm' : fontSize === 'lg' ? 'text-lg' : 'text-base'}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            {/* Mobile Title Input with safe area padding */}
            {isMobile && (
              <div className={`sticky top-0 z-10 bg-surface/90 backdrop-blur-md border-b border-main px-4 py-2 ${hasSafeArea ? 'app-inset-top' : ''}`}>
                <div className="flex items-center">
                  <button onClick={toggleSidebar} className="app-btn app-icon-btn mr-2 hover:bg-accent1">
                    <Menu size={20} />
                  </button>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Note Title"
                    className="w-full text-base font-medium bg-transparent focus:outline-none focus:ring-0 border-none p-1 dark:placeholder-gray-600 placeholder-gray-400"
                  />
                </div>
              </div>
            )}
            
            <div className={`h-full mx-auto transition-all duration-300 ease-in-out ${isFullWidth ? 'max-w-full' : 'max-w-4xl'}`}>
              {editorViewMode === 'editor' ? (
                <div className="h-full bg-surface/80 dark:bg-surface/40 shadow-inner shadow-gray-300/50 dark:shadow-gray-900/30">
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Start writing..."
                    className={`w-full h-full resize-none focus:outline-none bg-transparent dark:placeholder-gray-600 placeholder-gray-500 p-4 ${fontFamily === 'mono' ? 'font-mono' : 'font-sans'} ${fontSize === 'sm' ? 'leading-relaxed' : fontSize === 'lg' ? 'leading-loose' : 'leading-relaxed'}`}
                  />
                </div>
              ) : (
                <div className={`prose dark:prose-invert max-w-none h-full overflow-y-auto p-4 bg-surface/80 dark:bg-surface/40 shadow-inner shadow-gray-300/50 dark:shadow-gray-900/30 ${fontFamily === 'mono' ? 'prose-mono' : ''} ${fontSize === 'sm' ? 'prose-sm leading-relaxed' : fontSize === 'lg' ? 'prose-lg leading-loose' : 'prose-base leading-relaxed'}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteContent}</ReactMarkdown>
                </div>
              )}
            </div>
          </main>
          
          {/* Word count footer - don't show on mobile */}
          {!isMobile && (
            <footer className="p-2 text-xs text-gray-400 dark:text-gray-500 h-8 flex items-center justify-end flex-shrink-0 bg-surface border-t border-main w-full">
              <span>{noteContent.split(/\s+/).filter(Boolean).length} words, {noteContent.length} characters</span>
            </footer>
          )}
          
          {/* Mobile bottom navbar with animation and safe area padding */}
          {isMobile && (
            <nav className={`app-bottom-nav fixed left-0 right-0 flex items-center justify-between bg-surface/90 backdrop-blur-md border-t border-main px-2 ${hasSafeArea ? 'app-inset-bottom' : ''} ${isNavVisible ? '' : 'app-bottom-nav-hidden'}`}>
              <button 
                onClick={() => handleNewNote()}
                className="app-btn app-icon-btn flex flex-col items-center justify-center flex-1 py-1 text-primary"
              >
                <PlusCircle size={22} />
                <span className="text-xs mt-1">New</span>
              </button>
              
              <button
                onClick={() => {
                  setShowTagDropdown((v) => !v);
                  setShowTemplateDropdown(false);
                  setShowMoreOptionsDropdown(false);
                }}
                className={`app-btn app-icon-btn flex flex-col items-center justify-center flex-1 py-1 ${showTagDropdown ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <Tag size={22} />
                <span className="text-xs mt-1">Tags</span>
              </button>
              
              <button
                onClick={() => {
                  setShowTemplateDropdown((v) => !v);
                  setShowTagDropdown(false);
                  setShowMoreOptionsDropdown(false);
                }}
                className={`app-btn app-icon-btn flex flex-col items-center justify-center flex-1 py-1 ${showTemplateDropdown ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}
              >
                <FileText size={22} />
                <span className="text-xs mt-1">Templates</span>
              </button>
              
              <button
                onClick={() => setEditorViewMode(editorViewMode === 'editor' ? 'preview' : 'editor')}
                className={`app-btn app-icon-btn flex flex-col items-center justify-center flex-1 py-1 ${editorViewMode === 'preview' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}
              >
                {editorViewMode === 'editor' ? (
                  <>
                    <Eye size={22} />
                    <span className="text-xs mt-1">Preview</span>
                  </>
                ) : (
                  <>
                    <Code size={22} />
                    <span className="text-xs mt-1">Edit</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleSyncCurrentNote}
                disabled={!isOnline || !isAuthenticated || !currentNoteId || isSyncing || notes.find(n => n.id === currentNoteId)?.synced}
                className={`app-btn app-icon-btn flex flex-col items-center justify-center flex-1 py-1 ${!isOnline || !isAuthenticated || !currentNoteId || notes.find(n => n.id === currentNoteId)?.synced ? 'text-gray-400 dark:text-gray-600' : 'text-primary'}`}
              >
                {isSyncing ? (
                  <>
                    <Loader2 size={22} className="animate-spin" />
                    <span className="text-xs mt-1">Syncing</span>
                  </>
                ) : (
                  <>
                    <Save size={22} />
                    <span className="text-xs mt-1">Save</span>
                  </>
                )}
              </button>
            </nav>
          )}

          {/* Single More Options Dropdown for both mobile and desktop */}
          {showMoreOptionsDropdown && (
            <div className={`fixed ${isMobile ? 'bottom-16 left-2 right-2' : 'top-14 right-2'} z-50 w-full max-w-xs mx-auto bg-surface rounded-md shadow-lg py-1 border border-main max-h-[80vh] overflow-y-auto more-options-dropdown-container app-animate-slide`}>
              {/* Dropdown content remains the same */}
              <div className="px-4 py-2 border-b border-main">
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Theme</h4>
                <div className="flex items-center justify-between space-x-1">
                  <button onClick={() => handleThemeChange('light')} className={`flex-1 text-xs py-1 px-2 rounded ${theme === 'light' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Light</button>
                  <button onClick={() => handleThemeChange('dark')} className={`flex-1 text-xs py-1 px-2 rounded ${theme === 'dark' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Night</button>
                  <button onClick={() => handleThemeChange('sepia')} className={`flex-1 text-xs py-1 px-2 rounded ${theme === 'sepia' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Sepia</button>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-main">
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Font Family</h4>
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md w-full">
                  <button onClick={() => handleFontChange('sans')} className={`flex-1 px-2 py-1 text-xs rounded-l-md ${fontFamily === 'sans' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Sans</button>
                  <button onClick={() => handleFontChange('mono')} className={`flex-1 px-2 py-1 text-xs rounded-r-md ${fontFamily === 'mono' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Mono</button>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-main">
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Font Size</h4>
                <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md w-full">
                  <button onClick={() => handleFontSizeChange('sm')} className={`flex-1 px-2 py-1 text-xs rounded-l-md ${fontSize === 'sm' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Small</button>
                  <button onClick={() => handleFontSizeChange('base')} className={`flex-1 px-2 py-1 text-xs border-l border-r border-gray-300 dark:border-gray-600 ${fontSize === 'base' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Medium</button>
                  <button onClick={() => handleFontSizeChange('lg')} className={`flex-1 px-2 py-1 text-xs rounded-r-md ${fontSize === 'lg' ? 'bg-primaryLight' : 'hover:bg-accent1'}`}>Large</button>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-main">
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Layout</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Full Width</span>
                  <button 
                    onClick={() => {
                      setIsFullWidth(!isFullWidth);
                      setShowMoreOptionsDropdown(false);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isFullWidth ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFullWidth ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-main">
                <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">Notion</h4>
                {isAuthenticated && userInfo ? (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm truncate flex items-center">
                      <img src="/icons/icon.svg" alt="Notion Icon" className="w-5 h-5 rounded-full mr-2" />
                      {userInfo.bot?.workspace_name || userInfo.person?.name || userInfo.name || 'Notion'}
                    </span>
                    <button onClick={() => { handleDisconnect(); setShowMoreOptionsDropdown(false); }} className="text-xs text-danger hover:text-dangerHover">
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { handleConnect(); setShowMoreOptionsDropdown(false); }} disabled={isConnecting} className="w-full flex items-center justify-center px-2 py-1 text-sm font-medium text-white bg-accent2 rounded hover:bg-accent3 disabled:opacity-50">
                    {isConnecting ? <Loader2 className="animate-spin mr-1" size={14} /> : null}
                    Connect to Notion
                  </button>
                )}
                {connectionError && <p className="text-xs text-danger mt-1">{connectionError}</p>}
                {isAuthenticated && databases.length > 0 && (
                  <select
                    value={selectedDatabase || ''}
                    onChange={(e) => setSelectedDatabase(e.target.value)}
                    className="w-full text-xs p-1 mt-2 border border-gray-300 rounded bg-white dark:bg-gray-700 dark:border-gray-600 focus:ring-primary focus:border-primary"
                  >
                    <option value="" disabled>Select Notion DB</option>
                    {databases.map(db => (
                      <option key={db.id} value={db.id}>{Array.isArray(db.title) ? (db.title[0]?.plain_text || 'Untitled') : (db.title || 'Untitled')}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Install App Section */}
              {canInstallPwa && (
                <div className="px-4 py-2 border-b border-main">
                  <h4 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">App</h4>
                  <button 
                    onClick={() => { 
                      handleInstallPwa(); 
                      setShowMoreOptionsDropdown(false);
                    }} 
                    className="w-full flex items-center justify-center px-2 py-2 text-sm font-medium text-white bg-primary rounded hover:bg-primaryHover"
                  >
                    Install ThoughtBase App
                  </button>
                </div>
              )}

              <div className="px-4 py-2">
                <button onClick={() => { setShowFormattingHelpModal(true); setShowMoreOptionsDropdown(false); }} className="w-full text-left px-2 py-1 text-sm text-gray-700 dark:text-gray-300 hover:bg-accent1 rounded flex items-center">
                  <BookOpen size={14} className="mr-2" /> Formatting Help
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* Template Modal */}
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 app-animate-fade">
            <div className="template-modal-content bg-surface rounded-lg shadow-lg w-full max-w-lg mx-4 app-animate-slide">
              {/* Modal content remains the same */}
              <div className="p-4 border-b border-main">
                <h3 className="text-lg font-semibold">
                  {isEditingTemplate ? 'Edit Template' : 'Add New Template'}
                </h3>
              </div>
              <form onSubmit={handleSaveOrUpdateTemplate} className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Template Name</label>
                  <input
                    type="text"
                    value={templateFormName}
                    onChange={(e) => setTemplateFormName(e.target.value)}
                    className="w-full p-2 border border-main rounded bg-background"
                    placeholder="e.g., Meeting Notes"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title Format</label>
                  <input
                    type="text"
                    value={templateFormTitle}
                    onChange={(e) => setTemplateFormTitle(e.target.value)}
                    className="w-full p-2 border border-main rounded bg-background"
                    placeholder="e.g., Meeting Notes: [Topic]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Template Content</label>
                  <textarea
                    value={templateFormContent}
                    onChange={(e) => setTemplateFormContent(e.target.value)}
                    className="w-full h-48 p-2 border border-main rounded bg-background font-mono text-sm resize-none"
                    placeholder="Enter your template content using Markdown..."
                    required
                  />
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelTemplateModal}
                    className="px-4 py-2 text-sm border border-main rounded hover:bg-accent1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primaryHover"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 app-animate-fade">
            <div className="bg-surface rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto app-animate-slide">
              {/* Modal content remains the same */}
              <div className="p-4 border-b border-main flex justify-between items-center">
                <h3 className="text-lg font-semibold">Formatting & Setup Guide</h3>
                <button onClick={() => setShowFormattingHelpModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-6">
                <div>
                  <h4 className="text-base font-semibold mb-2">Notion Database Setup</h4>
                  <div className="space-y-2 text-sm">
                    <p>To sync notes with Notion, you need to set up your database with these <strong>mandatory</strong> properties or duplicate template provided while connecting your Notion account:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong>Title</strong> (Title type) - Required: For note titles</li>
                      <li><strong>Tags</strong> (Multi-select type) - Required: For note categorization</li>
                      <li><strong>Category</strong> (Select type) - Required: For primary categorization</li>
                    </ul>
                    <p className="mt-2 text-gray-500">Additional recommended properties:</p>
                    <ul className="list-disc pl-5 space-y-1 text-gray-500">
                      <li><strong>Created</strong> (Date type) - For creation date </li>
                      <li><strong>Last Edited</strong> (Date type) - For tracking changes</li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-semibold mb-2">Markdown Formatting</h4>
                  <div className="space-y-2 text-sm">
                    <p>Basic Syntax:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><code># Heading 1</code> - Large heading</li>
                      <li><code>## Heading 2</code> - Medium heading</li>
                      <li><code>### Heading 3</code> - Small heading</li>
                      <li><code>**bold**</code> - <strong>Bold text</strong></li>
                      <li><code>*italic*</code> - <em>Italic text</em></li>
                      <li><code>[link](url)</code> - Hyperlink</li>
                      <li><code>- item</code> - Bullet list</li>
                      <li><code>1. item</code> - Numbered list</li>
                      <li><code>- [ ] task</code> - Unchecked task</li>
                      <li><code>- [x] task</code> - Checked task</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Setup Instructions Modal */}
        {showSetupInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 app-animate-fade">
            <div className="bg-surface rounded-lg shadow-lg w-full max-w-2xl mx-4 app-animate-slide">
              {/* Modal content remains the same */}
              <div className="p-4 border-b border-main flex justify-between items-center">
                <h3 className="text-lg font-semibold">Welcome to ThoughtBase!</h3>
                <button onClick={() => setShowSetupInstructions(false)} className="text-gray-500 hover:text-gray-700">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <p>To get started with Notion sync, you'll need to set up a database with specific properties:</p>
                <div className="bg-background p-4 rounded-md">
                  <h4 className="font-semibold mb-2">Required Database Properties</h4>
                  <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Title</strong> (Title type)</li>
                    <li><strong>Tags</strong> (Multi-select type)</li>
                    <li><strong>Category</strong> (Select type)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold">Steps to set up:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>Create a new page in Notion</li>
                    <li>Add a new database (full page)</li>
                    <li>Add all the required properties listed above</li>
                    <li>Make sure the database is shared with the integration</li>
                    <li>Select your database in the app settings</li>
                  </ol>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowFormattingHelpModal(true)}
                    className="px-4 py-2 text-sm text-primary hover:text-primaryHover"
                  >
                    View Full Guide
                  </button>
                  <button
                    onClick={() => setShowSetupInstructions(false)}
                    className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primaryHover"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {isMobile && (
        <>
          {/* Tag Dropdown - Mobile - with improved position and animation */}
          {showTagDropdown && (
            <div 
              className="fixed left-2 right-2 bottom-20 z-50 w-full max-w-xs mx-auto bg-surface rounded-xl shadow-lg py-2 border border-main app-animate-slide"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dropdown content remains the same */}
              <div className="px-3 pb-2">
                {selectedTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.map(tag => (
                      <span key={tag.name} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tag.color}`}>
                        {tag.name}
                        <button 
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRemoveTag(tag, e);
                          }}
                          className={`ml-1 flex-shrink-0 ${tag.color.split(' ')[1]} hover:text-${tag.color.split(' ')[1].replace('800', '700')} focus:outline-none`}
                        >
                          <X size={10} strokeWidth={3}/>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">No tags selected</span>
                )}
              </div>
              <div className="border-t border-main pt-2 px-3">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Add Tag</div>
                {TAGS.filter(at => !selectedTags.some(st => st.name === at.name)).map(tag => (
                  <button
                    key={tag.name}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddTag(tag, e);
                    }}
                    className="app-btn w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-accent1 flex items-center"
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

          {/* Template Dropdown - Mobile - with improved position and animation */}
          {showTemplateDropdown && (
            <div 
              className="fixed left-2 right-2 bottom-20 z-50 w-full max-w-xs mx-auto bg-surface rounded-xl shadow-lg py-1 border border-main app-animate-slide"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Dropdown content remains the same */}
              <button 
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOpenAddTemplateModal();
                }}
                className="app-btn w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-accent1 flex items-center"
              >
                <PlusCircle size={14} className="mr-2 flex-shrink-0" /> Add New Template
              </button>
              {(Array.isArray(customTemplates) ? customTemplates : []).map((template, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-accent1 group"
                >
                  <span 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleApplyTemplate(template, e);
                    }}
                    className="flex-grow cursor-pointer truncate"
                  >
                    {template.name}
                  </span>
                  <button 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenEditTemplateModal(index, e);
                    }}
                    className="ml-2 opacity-100 text-gray-500 hover:text-primary" 
                    title="Edit Template"
                  >
                    <Edit size={12} className="flex-shrink-0" />
                  </button>
                  <button 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteTemplate(index, e);
                    }}
                    className="ml-2 opacity-100 text-danger hover:text-dangerHover" 
                    title="Delete Template"
                  >
                    <X size={12} className="flex-shrink-0" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      
      {/* PWA Install Banner - improved design */}
      {showInstallBanner && canInstallPwa && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-main p-4 flex items-center justify-between app-animate-slide app-inset-bottom">
          <div className="flex items-center">
            <div className="bg-primary rounded-full p-2 mr-3">
              <img src="/icons/icon.svg" alt="App icon" className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-semibold">Install App</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Add to home screen for best experience</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowInstallBanner(false)} className="text-sm text-gray-500 hover:text-gray-700 app-btn px-3 py-1">
              Later
            </button>
            <button onClick={handleInstallPwa} className="app-btn px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primaryHover">
              Install
            </button>
          </div>
        </div>
      )}
      
      {/* Native-like splash screen that fades out */}
      {!isAppLoaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <img src="/icons/icon.svg" alt="ThoughtBase" className="w-20 h-20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold">ThoughtBase</h2>
          </div>
        </div>
      )}
    </ErrorBoundary>
  )
}
