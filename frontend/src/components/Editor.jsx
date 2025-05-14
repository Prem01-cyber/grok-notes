// src/components/Editor.jsx
import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

export default function Editor({ onTextChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type your notes here…",
      }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      onTextChange(editor.getText());
    },
  });

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white min-h-[300px]">
      <EditorContent editor={editor} />
    </div>
  );
}
