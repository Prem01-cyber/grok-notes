import React from "react";
import Editor from "./components/Editor";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-4">📝 Grok Notes</h1>
      <Editor />
    </div>
  );
}

