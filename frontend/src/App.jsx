import { useState } from "react";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";
import { CollapseButton } from "./utils/toolbarUtils.jsx";

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
      <aside className={`h-screen border-l ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'} fixed right-0 w-16`}>
        <div className="flex flex-col items-center p-2 h-full">
          <button
            onClick={() => setIsAutocompleteEnabled(!isAutocompleteEnabled)}
            aria-pressed={isAutocompleteEnabled}
            aria-label="Toggle Autocomplete"
            title={isAutocompleteEnabled ? "Disable Autocomplete" : "Enable Autocomplete"}
            className={`
              inline-flex items-center justify-center p-1 rounded-full transition-colors duration-300
              text-xs font-medium focus:outline-none focus:ring-1 focus:ring-offset-1 mb-2
              ${isAutocompleteEnabled
                ? "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
                : "bg-gray-300 text-gray-800 hover:bg-gray-400 focus:ring-gray-500"
              }
            `}
          >
            <span className="text-sm">✍️</span>
          </button>
          {/* Add more status indicators here as needed */}
        </div>
      </aside>
    </div>
  );
}
