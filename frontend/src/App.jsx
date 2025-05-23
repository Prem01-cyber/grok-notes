import { useState } from "react";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";
import { CollapseButton } from "./utils/toolbarUtils.jsx";
import { getBackup } from "./api";

export default function App() {
  const [selectedNote, setSelectedNote] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
  const [isAutocompleteEnabled, setIsAutocompleteEnabled] = useState(true);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return newTheme;
    });
  };


  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'dark bg-gray-900' : 'bg-gray-100'}`}>
      <Sidebar
        notes={notes}
        setNotes={setNotes}
        selectedId={selectedNote?.id}
        onSelect={(note) => setSelectedNote(note)}
        isCollapsed={isLeftCollapsed}
        setIsCollapsed={setIsLeftCollapsed}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className={`flex-1 h-screen overflow-auto transition-all duration-300 ${isLeftCollapsed ? 'ml-20' : 'ml-64'} mr-16`}>
        {selectedNote ? (
          <Editor
            currentNote={selectedNote}
            onSave={(updatedNote) => {
              setSelectedNote(updatedNote);
              setNotes((prev) =>
                prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
              );
            }}
            theme={theme}
            isAutocompleteEnabled={isAutocompleteEnabled}
          />
        ) : (
          <p className={`p-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Select a note to begin editing.</p>
        )}
      </main>
      <aside className={`h-screen border-l ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} fixed right-0 w-20 shadow-md`}>
        <div className="flex flex-col items-center p-4 h-full">
          <h3 className={`text-xs font-semibold uppercase tracking-wider mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Tools</h3>
          <button
            onClick={() => setIsAutocompleteEnabled(!isAutocompleteEnabled)}
            aria-pressed={isAutocompleteEnabled}
            aria-label="Toggle Autocomplete"
            title={isAutocompleteEnabled ? "Disable Autocomplete" : "Enable Autocomplete"}
            className={`
              inline-flex items-center justify-center p-2 rounded-md transition-all duration-200
              text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 mb-3
              ${theme === 'dark' 
                ? isAutocompleteEnabled
                  ? "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 focus:ring-gray-600"
                : isAutocompleteEnabled
                  ? "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-400"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300 focus:ring-gray-500"
              }
            `}
          >
            <span className="text-base">{isAutocompleteEnabled ? '🖋️' : '✖️'}</span>
          </button>
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className={`
              inline-flex items-center justify-center p-2 rounded-md transition-all duration-200
              text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 mb-3
              ${theme === 'dark'
                ? "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-400"
              }
            `}
          >
            <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button
            onClick={async () => {
              try {
                const response = await getBackup();
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'notes_backup.db';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                alert('Database backup downloaded successfully');
              } catch (error) {
                console.error('Backup download failed:', error);
                alert('Failed to download backup. Please try again.');
              }
            }}
            aria-label="Backup Database"
            title="Backup Database"
            className={`
              inline-flex items-center justify-center p-2 rounded-md transition-all duration-200
              text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 mb-3
              ${theme === 'dark'
                ? "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-400"
              }
            `}
          >
            <span className="text-base">📦</span>
          </button>
          <button
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.db';
              input.onchange = async (event) => {
                const file = event.target.files[0];
                if (!file) return;
                if (!window.confirm('Are you sure you want to restore the database from this backup? This will overwrite the current database.')) {
                  return;
                }
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  const response = await fetch('/api/notes-restore', {
                    method: 'POST',
                    body: formData,
                  });
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                  const result = await response.json();
                  alert(result.message);
                  // Refresh notes list after restoration
                  setNotes([]);
                  setSelectedNote(null);
                  const updatedNotes = await fetch('/api/notes').then(res => res.json());
                  setNotes(updatedNotes);
                } catch (error) {
                  console.error('Database restoration failed:', error);
                  alert('Failed to restore database. Please try again.');
                }
              };
              input.click();
            }}
            aria-label="Restore Database"
            title="Restore Database"
            className={`
              inline-flex items-center justify-center p-2 rounded-md transition-all duration-200
              text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 mb-3
              ${theme === 'dark'
                ? "bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500"
                : "bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-400"
              }
            `}
          >
            <span className="text-base">🔄</span>
          </button>
          {/* Add more tools or status indicators here as needed */}
        </div>
      </aside>
    </div>
  );
}
