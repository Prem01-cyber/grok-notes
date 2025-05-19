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
      Placeholder.configure({ placeholder: "Start typing your notes here..." }),
    ],
    content: currentNote?.content_json || "",
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
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

      // Function to convert HTML nodes to TipTap JSON
      const convertNodeToJSON = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return { type: 'text', text: node.textContent };
        }

        const children = Array.from(node.childNodes).map(convertNodeToJSON);
        
        switch (node.nodeName.toLowerCase()) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return {
              type: 'heading',
              attrs: { level: parseInt(node.nodeName[1]) },
              content: children
            };
          case 'p':
            // Ensure paragraph has proper text content
            const paragraphContent = children.length > 0 ? children : [{ type: 'text', text: node.textContent }];
            return {
              type: 'paragraph',
              content: paragraphContent
            };
          case 'strong':
          case 'b':
            return {
              type: 'text',
              marks: [{ type: 'bold' }],
              text: node.textContent
            };
          case 'em':
          case 'i':
            return {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: node.textContent
            };
          case 'code':
            return {
              type: 'text',
              marks: [{ type: 'code' }],
              text: node.textContent
            };
          case 'pre':
            return {
              type: 'codeBlock',
              content: [{ type: 'text', text: node.textContent }]
            };
          case 'ul':
            return {
              type: 'bulletList',
              content: children.filter(child => child.type === 'listItem')
            };
          case 'ol':
            return {
              type: 'orderedList',
              content: children.filter(child => child.type === 'listItem')
            };
          case 'li':
            // Ensure list items have proper paragraph content
            const listItemContent = children.length > 0 ? children : [{
              type: 'paragraph',
              content: [{ type: 'text', text: node.textContent }]
            }];
            return {
              type: 'listItem',
              content: listItemContent
            };
          default:
            return {
              type: 'paragraph',
              content: [{ type: 'text', text: node.textContent }]
            };
        }
      };

      // Convert markdown to HTML and then to TipTap JSON
      const htmlContent = marked.parse(fullMarkdown);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Process the content and ensure proper structure
      const processContent = (nodes) => {
        return nodes.map(node => {
          // Handle text nodes with marks
          if (node.type === 'text' && node.marks) {
            return node;
          }
          
          // Ensure paragraphs have proper content
          if (node.type === 'paragraph') {
            const content = node.content || [];
            // If content is empty or contains invalid nodes, create a text node
            if (content.length === 0 || !content.every(c => c.type === 'text')) {
              return {
                type: 'paragraph',
                content: [{ type: 'text', text: node.text || '' }]
              };
            }
            return node;
          }
          
          // Ensure lists have proper structure
          if (node.type === 'bulletList' || node.type === 'orderedList') {
            return {
              type: node.type,
              content: node.content.map(item => ({
                type: 'listItem',
                content: [{
                  type: 'paragraph',
                  content: item.content?.[0]?.content || [{ type: 'text', text: '' }]
                }]
              }))
            };
          }
          
          return node;
        });
      };

      const content = processContent(Array.from(tempDiv.childNodes).map(convertNodeToJSON));
      
      // Insert each node separately to ensure proper structure
      content.forEach(node => {
        if (node.type === 'paragraph' || node.type === 'heading' || 
            node.type === 'bulletList' || node.type === 'orderedList' || 
            node.type === 'codeBlock') {
          editor.commands.insertContent(node);
        }
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
