// src/components/Editor.jsx
import { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import { streamGrokText, saveNote } from "../api";
import { marked } from "marked";

function decodeChunk(chunk) {
  return chunk
    .replace(/\n/g, "\n")
    .replace(/\t/g, "\t")
    .replace(/\r/g, "\r")
    .replace(/\"/g, '"')
    .replace(/\'/g, "'")
    .replace(/\\/g, "\\");
}

function extractStructuredContext(json) {
  if (!json || !json.content) return "";

  return json.content
    .map((node) => {
      if (node.type?.startsWith("heading")) {
        const level = node.attrs?.level || 1;
        const text = node.content?.map((n) => n.text).join(" ") || "";
        return `Heading ${level}: ${text}`;
      } else if (node.type === "paragraph") {
        const text = node.content?.map((n) => n.text).join(" ") || "";
        return `- ${text}`;
      }
      return "";
    })
    .join("\n");
}

export default function Editor({ currentNote, onSave }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [title, setTitle] = useState(currentNote.title);
  const autosaveTimer = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ bulletList: { keepMarks: true } }),
      Typography,
      Highlight,
      Placeholder.configure({ placeholder: "Start typing your notes here..." }),
    ],
    content: currentNote?.content_json || "",
  });

  useEffect(() => {
    if (editor && currentNote?.content_json) {
      try {
        const content = JSON.parse(currentNote.content_json);
        editor.commands.setContent(content);
      } catch (e) {
        editor.commands.setContent({ type: "doc", content: [] });
      }
      setTitle(currentNote.title);
    }
  }, [editor, currentNote]);

  useEffect(() => {
    if (!editor || !currentNote) return;

    const handler = () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

      autosaveTimer.current = setTimeout(async () => {
        const updated = {
          ...currentNote,
          title: title,
          content_json: JSON.stringify(editor.getJSON()),
        };
        await saveNote(updated);
        if (onSave) onSave(updated);
      }, 1500);
    };

    editor.on("update", handler);
    return () => editor.off("update", handler);
  }, [editor, currentNote, title]);

  const handleGrokSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || !editor) return;

    setIsGenerating(true);

    const noteJSON = editor.getJSON();
    const stream = streamGrokText({
      text: promptInput,
      note_title: title,
      note_context: extractStructuredContext(noteJSON),
    });

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

      editor.commands.insertContent({
        type: "paragraph",
        content: [{ type: "text", text: fullMarkdown }],
      });
    } catch (err) {
      console.error("Error during streaming:", err);
    }

    setPromptInput("");
    setIsGenerating(false);
  };

  return (
    <div className="relative">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow border p-4 mt-4">
        <input
          type="text"
          className="text-xl font-bold mb-4 w-full border-b focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <EditorContent editor={editor} />
      </div>

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
