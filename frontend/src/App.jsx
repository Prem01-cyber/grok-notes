// src/App.jsx
import React, { useState } from "react";
import Editor from "./components/Editor";
import { summarizeNote } from "./api";

export default function App() {
  const [noteText, setNoteText] = useState("");
  const [summary, setSummary] = useState("");

  const handleSummarize = async () => {
    const result = await summarizeNote(noteText);
    setSummary(result);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-4">Grok Notes</h1>

      <Editor onTextChange={setNoteText} />

      <div className="mt-4 flex gap-4">
        <button
          onClick={handleSummarize}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Summarize with Grok
        </button>
      </div>

      {summary && (
        <div className="mt-6 p-4 bg-yellow-100 border border-yellow-300 rounded">
          <h2 className="text-lg font-semibold">🔍 Summary</h2>
          <p className="mt-2 whitespace-pre-wrap">{summary}</p>
        </div>
      )}
    </div>
  );
}
