import { useState } from "react";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [selectedNote, setSelectedNote] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
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
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        theme={theme}
        toggleTheme={toggleTheme}
      />
      <main className={`flex-1 h-screen overflow-auto transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'} mr-64`}>
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
      <aside className={`w-64 h-screen overflow-auto border-l ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} fixed right-0`}>
        <div className="p-4">
          <h2 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`}>Tools</h2>
          <div className="mb-4">
            <button
              onClick={() => setIsAutocompleteEnabled(!isAutocompleteEnabled)}
              aria-pressed={isAutocompleteEnabled}
              aria-label="Toggle Autocomplete"
              title={isAutocompleteEnabled ? "Disable Autocomplete" : "Enable Autocomplete"}
              className={`
                relative inline-flex items-center px-4 py-1.5 rounded-full transition-colors duration-300
                text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 w-full
                ${isAutocompleteEnabled
                  ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                  : "bg-gray-300 text-gray-800 hover:bg-gray-400 focus:ring-gray-500"
                }
              `}
            >
              {isAutocompleteEnabled ? "AC ON" : "AC OFF"}
            </button>
          </div>
          {/* Add more toolbar items here as needed */}
        </div>
      </aside>
    </div>
  );
}
