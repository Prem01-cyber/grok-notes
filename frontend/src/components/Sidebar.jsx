import { useEffect, useState } from "react";
import { getAllNotes, saveNote } from "../api";

export default function Sidebar({ onSelect, selectedId, notes, setNotes }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative h-screen bg-white border-r transition-all duration-300 ease-in-out ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 bg-white border rounded-full p-1 shadow-md hover:bg-gray-50 transition-colors"
      >
        <svg
          className={`w-4 h-4 transform transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="p-4">
        {!isCollapsed && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span className="text-blue-600">📝</span>
                Notes
              </h2>
              <span className="text-sm text-gray-500">{notes.length}</span>
            </div>

            {/* Search Bar */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg
                className="absolute right-3 top-2.5 w-4 h-4 text-gray-400"
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg mb-4 flex items-center justify-center gap-2 transition-colors"
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
              className={`cursor-pointer px-3 py-2 rounded-lg transition-colors ${
                selectedId === note.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              {isCollapsed ? (
                <div className="flex justify-center">
                  <span className="text-lg">📝</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">📝</span>
                  <span className="truncate">{note.title || `Note ${note.id}`}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
