import { useEffect, useState } from "react";
import { getAllNotes, saveNote, deleteNote } from "../api";
import { CollapseButton } from "../utils/toolbarUtils.jsx";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

export default function Sidebar({ onSelect, selectedId, notes, setNotes, isCollapsed, setIsCollapsed, theme, toggleTheme }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState(null);

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
    setNoteToDelete(noteId);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (noteToDelete) {
      try {
        setIsDeleting(true);
        await deleteNote(noteToDelete);
        const updatedNotes = notes.filter(note => note.id !== noteToDelete);
        setNotes(updatedNotes);
        
        // If the deleted note was selected, select the first available note
        if (selectedId === noteToDelete && updatedNotes.length > 0) {
          onSelect(updatedNotes[0]);
        }
      } catch (error) {
        console.error('Failed to delete note:', error);
        alert('Failed to delete note. Please try again.');
      } finally {
        setIsDeleting(false);
        setShowDeleteModal(false);
        setNoteToDelete(null);
      }
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative">
    <div className={`fixed top-0 left-0 h-screen ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border-r'} shadow-sm transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'} z-10`}>
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
                  <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-base font-semibold uppercase tracking-wide flex items-center gap-2 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>
                      <span className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>📝</span>
                      Notes
                    </h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>{notes.length}</span>
                  </div>

                  {/* Search Bar */}
                  <div className="relative mb-3">
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent transition-all ${theme === 'dark' ? 'bg-gray-700 text-white border-gray-600 placeholder-gray-400' : 'bg-gray-50 text-gray-800 border-gray-200 placeholder-gray-500'}`}
                    />
                    <svg
                      className={`absolute right-3 top-2.5 w-5 h-5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
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
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-md mb-3 flex items-center justify-center gap-1.5 transition-colors duration-200 text-sm font-medium"
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
                    className={`cursor-pointer px-2 py-1.5 rounded-md transition-colors duration-200 group ${
                      selectedId === note.id
                        ? theme === 'dark' ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-700'
                        : theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                    }`}
                  >
                    {isCollapsed ? (
                      <div className="flex justify-center">
                        <span className="text-base">📝</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-400'} text-sm`}>📝</span>
                          <span className={`truncate text-sm ${theme === 'dark' && selectedId !== note.id ? 'text-gray-200' : ''}`}>{note.title || `Note ${note.id}`}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteNote(note.id, e)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-full transition-all duration-200"
                          title="Delete note"
                        >
                          <svg
                            className="w-5 h-5 text-red-500 hover:text-red-600"
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
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        theme={theme}
      />
    </div>
  );
}
