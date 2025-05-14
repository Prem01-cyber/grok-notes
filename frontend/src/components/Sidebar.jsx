import { useEffect } from "react";
import { getAllNotes, saveNote } from "../api";

export default function Sidebar({ onSelect, selectedId, notes, setNotes }) {
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

  return (
    <div className="w-64 bg-white border-r p-4 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">📝 Notes</h2>
      <button
        onClick={createNewNote}
        className="mb-4 w-full bg-blue-600 text-white py-1 px-3 rounded"
      >
        + New Note
      </button>
      {notes.map((note) => (
        <div
          key={note.id}
          onClick={() => onSelect(note)}
          className={`cursor-pointer px-2 py-1 rounded mb-1 hover:bg-gray-100 ${
            selectedId === note.id ? "bg-gray-200" : ""
          }`}
        >
          {note.title || `Note ${note.id}`}
        </div>
      ))}
    </div>
  );
}
