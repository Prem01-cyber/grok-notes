import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import Bold from "@tiptap/extension-bold";

export function useEditorSetup(content, onSave) {
  return useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        heading: {
          levels: [1, 2, 3, 4, 5, 6]
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-md bg-gray-800 p-5 font-mono text-sm text-gray-100',
          },
        },
      }),
      Typography,
      Highlight,
      Placeholder.configure({ placeholder: "Press Space to prompt Grok..." }),
    ],
    content: content ? JSON.parse(content) : "",
    onUpdate: ({ editor }) => {
      if (onSave) {
        try {
          const json = editor.getJSON();
          onSave({
            content_json: JSON.stringify(json)
          });
        } catch (e) {
          console.error("Failed to get editor content", e);
        }
      }
    },
    editorProps: {
      attributes: { 
        class: "tiptap prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none",
        'data-placeholder': 'Start writing...'
      },
    },
  });
} 