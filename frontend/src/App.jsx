import { useState } from "react";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [selectedNote, setSelectedNote] = useState(null);
  const [notes, setNotes] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');

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
      <main className={`flex-1 h-screen overflow-auto transition-all duration-300 ${isCollapsed ? 'ml-20' : 'ml-64'}`}>
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
          />
        ) : (
          <p className={`p-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>Select a note to begin editing.</p>
        )}
      </main>
    </div>
  );
}
