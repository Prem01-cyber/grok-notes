import React, { useEffect, useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { streamGrokText } from "../api";

export default function Editor() {
  const [isGenerating, setIsGenerating] = useState(false);
  const editorRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type your notes here…",
      }),
    ],
    content: "",
  });

  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = async (event) => {
      if (event.key !== "Enter" || isGenerating) return;

      const pos = editor.state.selection.$from.pos;
      const lineStart = editor.state.doc.lineAt(pos).from;
      const lineText = editor.state.doc.textBetween(lineStart, pos, "\n").trim();

      if (lineText === "/grok") {
        event.preventDefault();
        setIsGenerating(true);

        editor.commands.deleteRange({ from: lineStart, to: pos });

        let aiText = "";
        const stream = streamGrokText("Continue writing helpful content…");

        for await (const chunk of stream) {
          aiText += chunk;
          editor.commands.insertContent(chunk);
        }

        setIsGenerating(false);
      }
    };

    // Attach key listener to editor’s DOM node
    const editorEl = editorRef.current?.querySelector('[contenteditable="true"]');
    if (editorEl) {
      editorEl.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      if (editorEl) {
        editorEl.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [editor, isGenerating]);

  return (
    <div
      ref={editorRef}
      className="border rounded-lg p-4 shadow bg-white min-h-[300px]"
    >
      {isGenerating && (
        <p className="text-sm text-gray-500 mb-2">✨ Grok is generating...</p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

