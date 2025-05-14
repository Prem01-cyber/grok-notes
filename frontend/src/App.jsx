import { useState } from "react";
import Editor from "./components/Editor";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [selectedNote, setSelectedNote] = useState(null);
  const [notes, setNotes] = useState([]);

  return (
    <div className="min-h-screen flex bg-gray-100">
      <Sidebar
        notes={notes}
        setNotes={setNotes}
        selectedId={selectedNote?.id}
        onSelect={(note) => setSelectedNote(note)}
      />
      <main className="flex-1 p-4">
        <h1 className="text-3xl font-bold mb-4">Notes Taker</h1>
        {selectedNote ? (
          <Editor
            currentNote={selectedNote}
            onSave={(updatedNote) => {
              setSelectedNote(updatedNote);
              setNotes((prev) =>
                prev.map((n) => (n.id === updatedNote.id ? updatedNote : n))
              );
            }}
          />
        ) : (
          <p className="text-gray-600">Select a note to begin editing.</p>
        )}
      </main>
    </div>
  );
}
