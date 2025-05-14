import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import { marked } from "marked";
import { streamGrokText } from "../api";

export default function Editor() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Typography,
      Placeholder.configure({
        placeholder: "Start typing your notes here...",
      }),
    ],
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none text-base min-h-[300px] px-4 py-3",
      },
    },
    content: "",
  });

  const handleGrokSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || !editor) return;

    console.log("Submitting prompt to Grok:", promptInput);
    setIsGenerating(true);

    try {
      const stream = streamGrokText(promptInput);
      let received = false;
      let fullMarkdown = "";

      for await (const chunk of stream) {
        if (!received) {
          console.log("Streaming started...");
          received = true;
        }

        console.log("Received chunk:", JSON.stringify(chunk));
        fullMarkdown += chunk;
      }

      if (!received) {
        console.warn("No chunks received from Grok.");
      } else {
        console.log("Streaming completed.");
        fullMarkdown = fullMarkdown.replace(/\\n/g, "\n");

        const html = marked(fullMarkdown);
        editor.commands.focus();
        editor.commands.insertContent(html);
      }
    } catch (err) {
      console.error("Error during streaming:", err);
    }

    setPromptInput("");
    setIsGenerating(false);
  };

  return (
    <div className="relative">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow border p-4 mt-4">
        <EditorContent editor={editor} />
      </div>

      {/* Grok Prompt Box */}
      <form
        onSubmit={handleGrokSubmit}
        className="fixed bottom-6 left-6 w-[320px] bg-white border border-gray-300 rounded-xl shadow-xl p-3 flex gap-2 z-50 backdrop-blur-sm"
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
