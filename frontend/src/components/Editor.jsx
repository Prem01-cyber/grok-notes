import React, { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { streamGrokText } from "../api";

export default function Editor() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type your notes here…",
      }),
    ],
    content: "",
  });

  const handleGrokSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || !editor) return;

    setIsGenerating(true);
    const stream = streamGrokText(promptInput);

    // Insert streamed content at current cursor
    for await (const chunk of stream) {
      editor.commands.insertContent(chunk);
    }

    setPromptInput("");
    setIsGenerating(false);
  };

  return (
    <div className="relative">
      <div className="border rounded-lg p-4 shadow bg-white min-h-[300px]">
        <EditorContent editor={editor} />
      </div>

      {/* 🧠 Grok Prompt Box */}
      <form
        onSubmit={handleGrokSubmit}
        className="fixed bottom-6 left-6 w-[300px] bg-white border border-gray-300 rounded-xl shadow-lg p-3 flex gap-2"
      >
        <input
          type="text"
          className="flex-1 text-sm p-2 border rounded focus:outline-none"
          placeholder="Ask Grok..."
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          disabled={isGenerating}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
          disabled={isGenerating}
        >
          {isGenerating ? "..." : "Go"}
        </button>
      </form>
    </div>
  );
}

