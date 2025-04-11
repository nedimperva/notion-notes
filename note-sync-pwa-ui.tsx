import { useState } from 'react';
import { Menu, PenLine, Tag, Image, Mic, Upload, MoreVertical, Wifi, WifiOff } from 'lucide-react';

export default function NoteSync() {
  const [connected, setConnected] = useState(true);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-2 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Menu className="h-6 w-6 text-gray-500" />
          <h1 className="font-semibold text-lg">NoteSync</h1>
        </div>
        <div className="flex items-center space-x-4">
          {connected ? 
            <div className="flex items-center text-green-500 text-sm">
              <Wifi className="h-4 w-4 mr-1" /> Synced with Notion
            </div> : 
            <div className="flex items-center text-amber-500 text-sm">
              <WifiOff className="h-4 w-4 mr-1" /> Offline Mode
            </div>
          }
          <button className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm">
            Sync Now
          </button>
        </div>
      </header>
      
      {/* Note Content */}
      <main className="flex-grow overflow-auto p-4">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow p-6">
          <input
            type="text"
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note Title"
            className="w-full text-xl font-medium mb-4 border-b border-gray-200 pb-2 focus:outline-none focus:border-blue-400"
          />
          
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs flex items-center">
              Project <span className="ml-1 cursor-pointer">×</span>
            </div>
            <div className="bg-purple-100 text-purple-800 px-2 py-1 rounded-md text-xs flex items-center">
              Ideas <span className="ml-1 cursor-pointer">×</span>
            </div>
            <button className="text-gray-500 text-xs border border-dashed border-gray-300 px-2 py-1 rounded-md">
              + Add Tag
            </button>
          </div>
          
          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Start typing your note..."
            className="w-full h-64 resize-none focus:outline-none"
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
            <span className="text-sm text-gray-600 mr-2">Template:</span>
            <select className="text-sm border rounded-md py-1 px-2 bg-gray-50">
              <option>Quick Note</option>
              <option>Meeting Notes</option>
              <option>Project Idea</option>
              <option>Task</option>
            </select>
          </div>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium">
            Save to Notion
          </button>
        </div>
      </footer>
    </div>
  );
}
