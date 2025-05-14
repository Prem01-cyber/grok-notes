import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import { streamGrokText } from "../api";
import { marked } from "marked";

// Decode escaped characters (like \n, \t) from LLM
function decodeChunk(chunk) {
  return chunk
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\");
}

export default function Editor() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
      }),
      Typography,
      Highlight,
      Placeholder.configure({
        placeholder: "Start typing your notes here...",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap prose max-w-none focus:outline-none text-base px-4 py-3",
        spellCheck: "false",
      },
    },
    content: "",
  });

  const handleGrokSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || !editor) return;

    setIsGenerating(true);
    const stream = streamGrokText(promptInput);
    let fullMarkdown = "";

    const startPos = editor.state.selection.from;
    let pos = startPos;

    try {
      for await (const rawChunk of stream) {
        const chunk = decodeChunk(rawChunk);
        fullMarkdown += chunk;

        editor.commands.command(({ tr, dispatch }) => {
          tr.insertText(chunk, pos);
          pos += chunk.length;
          if (dispatch) dispatch(tr);
          return true;
        });

        await new Promise((r) => setTimeout(r, 10));
      }

      editor.commands.command(({ tr, dispatch }) => {
        tr.delete(startPos, pos);
        if (dispatch) dispatch(tr);
        return true;
      });

      const html = marked(fullMarkdown);
      editor.commands.focus();
      editor.commands.insertContent(html);
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
