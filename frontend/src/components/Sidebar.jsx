import { useEffect, useState } from "react";
import { getAllNotes, saveNote, deleteNote } from "../api";
import { CollapseButton } from "../utils/toolbarUtils.jsx";

export default function Sidebar({ onSelect, selectedId, notes, setNotes, isCollapsed, setIsCollapsed, theme, toggleTheme }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchNotes() {
    const data = await getAllNotes();
    setNotes(data);
  }

  useEffect(() => {
    fetchNotes();
  }, []);

  const createNewNote = async () => {
    const defaultContent = {
      type: "doc",
      content: [],
    };

    const note = await saveNote({
      title: `Note ${notes.length + 1}`,
      content_json: JSON.stringify(defaultContent),
    });

    const updatedNotes = [...notes, note];
    setNotes(updatedNotes);
    onSelect(note);
  };

  const handleDeleteNote = async (noteId, e) => {
    e.stopPropagation(); // Prevent note selection when clicking delete
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      setIsDeleting(true);
      await deleteNote(noteId);
      const updatedNotes = notes.filter(note => note.id !== noteId);
      setNotes(updatedNotes);
      
      // If the deleted note was selected, select the first available note
      if (selectedId === noteId && updatedNotes.length > 0) {
        onSelect(updatedNotes[0]);
      }
    } catch (error) {
      console.error('Failed to delete note:', error);
      alert('Failed to delete note. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative">
      <div className={`fixed top-0 left-0 h-screen ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border-r'} transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="h-full flex flex-col">
          {/* Toggle Buttons */}
          <div className="relative">
            <CollapseButton 
              isCollapsed={isCollapsed} 
              onToggle={() => setIsCollapsed(prev => !prev)} 
              position="left" 
              theme={theme} 
            />
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              {!isCollapsed && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className={`text-lg font-semibold uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                      <span className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`}>📝</span>
                      Notes
                    </h2>
                    <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{notes.length}</span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-gray-50 text-gray-800 border-gray-200'}`}
                    />
                    <svg
                      className={`absolute right-3 top-2.5 w-4 h-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* New Note Button */}
                  <button
                    onClick={createNewNote}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-md mb-4 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Note
                  </button>
                </>
              )}

              {/* Notes List */}
              <div className="space-y-1">
                {filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    onClick={() => onSelect(note)}
                    className={`cursor-pointer px-3 py-2 rounded-md transition-colors group ${
                      selectedId === note.id
                        ? theme === 'dark' ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
                        : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {isCollapsed ? (
                      <div className="flex justify-center">
                        <span className="text-lg">📝</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-400'}`}>📝</span>
                          <span className={`truncate ${theme === 'dark' && selectedId !== note.id ? 'text-gray-200' : ''}`}>{note.title || `Note ${note.id}`}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded-md transition-all"
                          title="Delete note"
                        >
                          <svg
                            className="w-4 h-4 text-red-500 hover:text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
