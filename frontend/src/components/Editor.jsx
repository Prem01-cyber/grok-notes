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
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [currentNodePos, setCurrentNodePos] = useState(null);
  const autosaveTimer = useRef(null);
  const promptRef = useRef(null);
  const editorRef = useRef(null);

  const updatePromptPosition = (pos) => {
    if (!editor || !editorRef.current) return;
    
    const coords = editor.view.coordsAtPos(pos);
    const editorElement = editorRef.current;
    const editorRect = editorElement.getBoundingClientRect();
    
    // Calculate position relative to the editor container
    const x = coords.left - editorRect.left;
    const y = coords.top - editorRect.top;
    
    setPromptPosition({ x, y });
    setCurrentNodePos(pos);
  };

  const moveToNextNode = () => {
    if (!editor || !currentNodePos) return;

    const { state } = editor;
    const { doc } = state;
    let nextPos = currentNodePos;

    // Find the end of current node
    const currentNode = doc.resolve(currentNodePos).parent;
    const endOfNode = currentNodePos + currentNode.nodeSize;

    // Find the start of next node
    if (endOfNode < doc.content.size) {
      nextPos = endOfNode;
      updatePromptPosition(nextPos);
    } else {
      // If we're at the end of the document, create a new paragraph
      editor.commands.createParagraphNear();
      const newPos = editor.state.selection.from;
      updatePromptPosition(newPos);
    }
  };

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
      Placeholder.configure({ placeholder: "Press Space to prompt Grok..." }),
    ],
    content: currentNote?.content_json || "",
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
      handleKeyDown: (view, event) => {
        // Check if space is pressed at the start of a node
        if (event.key === ' ' && !showPrompt) {
          const { state } = view;
          const { selection } = state;
          const { $from } = selection;
          
          // Check if we're at the start of a node
          if ($from.parentOffset === 0) {
            updatePromptPosition(selection.from);
            setShowPrompt(true);
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
  });

  // Close prompt when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (promptRef.current && !promptRef.current.contains(event.target)) {
        setShowPrompt(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Update prompt position on scroll
  useEffect(() => {
    if (!showPrompt || !editor || !editorRef.current || !currentNodePos) return;

    const updatePosition = () => {
      updatePromptPosition(currentNodePos);
    };

    window.addEventListener('scroll', updatePosition, true);
    return () => window.removeEventListener('scroll', updatePosition, true);
  }, [showPrompt, editor, currentNodePos]);

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

    // Function to scroll to position
    const scrollToPosition = (position) => {
      const coords = editor.view.coordsAtPos(position);
      const editorElement = editorRef.current;
      if (!editorElement) return;

      const container = editorElement.closest('.ProseMirror');
      if (!container) return;

      // Calculate the scroll position to center the content
      const containerRect = container.getBoundingClientRect();
      const elementRect = editorElement.getBoundingClientRect();
      const relativeTop = coords.top - elementRect.top;
      const targetScroll = container.scrollTop + relativeTop - (containerRect.height / 2);

      // Smooth scroll to the target position
      container.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    };

    // Function to convert HTML nodes to TipTap JSON
    const convertNodeToJSON = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        // Only skip if completely empty, preserve whitespace
        if (text === '') {
          return null;
        }
        return { type: 'text', text: node.textContent };
      }

      const children = Array.from(node.childNodes)
        .map(convertNodeToJSON)
        .filter(child => child !== null);
      
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
            content: children.length > 0 ? children : [{ type: 'text', text: ' ' }]
          };
        case 'p':
          return {
            type: 'paragraph',
            content: children.length > 0 ? children : [{ type: 'text', text: ' ' }]
          };
        case 'strong':
        case 'b':
          return {
            type: 'text',
            marks: [{ type: 'bold' }],
            text: node.textContent || ' '
          };
        case 'em':
        case 'i':
          return {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: node.textContent || ' '
          };
        case 'code':
          return {
            type: 'text',
            marks: [{ type: 'code' }],
            text: node.textContent || ' '
          };
        case 'pre':
          return {
            type: 'codeBlock',
            content: [{ type: 'text', text: node.textContent || ' ' }]
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
          return {
            type: 'listItem',
            content: [{
              type: 'paragraph',
              content: children.length > 0 ? children : [{ type: 'text', text: ' ' }]
            }]
          };
        default:
          return {
            type: 'paragraph',
            content: children.length > 0 ? children : [{ type: 'text', text: ' ' }]
          };
      }
    };

    try {
      // First, collect all the content
      for await (const rawChunk of stream) {
        const chunk = decodeChunk(rawChunk);
        fullMarkdown += chunk;
      }

      // Then process and insert the content
      const htmlContent = marked.parse(fullMarkdown);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      // Process the content and ensure proper structure
      const processContent = (nodes) => {
        return nodes
          .map(node => {
            if (!node) return null;

            // Handle text nodes
            if (node.type === 'text') {
              return node.text ? node : null;
            }
            
            // Handle paragraphs
            if (node.type === 'paragraph') {
              return {
                type: 'paragraph',
                content: node.content?.filter(c => c.type === 'text' && c.text) || [{ type: 'text', text: ' ' }]
              };
            }
            
            // Handle lists
            if (node.type === 'bulletList' || node.type === 'orderedList') {
              const validItems = node.content
                .map(item => ({
                  type: 'listItem',
                  content: [{
                    type: 'paragraph',
                    content: item.content?.[0]?.content?.filter(c => c.type === 'text' && c.text) || [{ type: 'text', text: ' ' }]
                  }]
                }))
                .filter(item => item.content[0].content.some(c => c.text.trim()));

              return validItems.length > 0 ? {
                type: node.type,
                content: validItems
              } : null;
            }
            
            return node;
          })
          .filter(node => node !== null);
      };

      const content = processContent(Array.from(tempDiv.childNodes).map(convertNodeToJSON));
      
      // Insert each node separately to ensure proper structure
      for (const node of content) {
        if (node && (node.type === 'paragraph' || node.type === 'heading' || 
            node.type === 'bulletList' || node.type === 'orderedList' || 
            node.type === 'codeBlock')) {
          editor.commands.insertContent(node);
          // Update position and scroll after each node insertion
          pos = editor.state.selection.from;
          scrollToPosition(pos);
          // Add a small delay to ensure smooth scrolling
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // Move to next node after content is inserted
      moveToNextNode();
      
      // Final scroll to ensure we're at the right position
      scrollToPosition(editor.state.selection.from);
    } catch (error) {
      console.error('Error generating text:', error);
    } finally {
      setIsGenerating(false);
      setPromptInput("");
      setShowPrompt(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGrokSubmit(e);
    }
  };

  // Add smooth scrolling to the editor container
  useEffect(() => {
    if (!editorRef.current) return;

    const container = editorRef.current.closest('.ProseMirror');
    if (container) {
      container.style.scrollBehavior = 'smooth';
    }
  }, [editorRef.current]);

  return (
    <div className="relative min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow border p-4 mt-4 relative">
        <input
          type="text"
          className="text-xl font-bold mb-4 w-full border-b focus:outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <EditorContent editor={editor} ref={editorRef} />
        
        {showPrompt && (
          <div
            ref={promptRef}
            style={{
              position: 'absolute',
              left: `${promptPosition.x}px`,
              top: `${promptPosition.y}px`,
              zIndex: 50,
            }}
            className="bg-white/95 border border-gray-200 rounded-xl shadow-lg p-3 flex gap-2 backdrop-blur-sm min-w-[280px]"
          >
            <input
              type="text"
              className="flex-1 text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Ask Grok... (Press Enter to submit)"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              autoFocus
            />
            <button
              type="button"
              onClick={handleGrokSubmit}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isGenerating}
            >
              {isGenerating ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                "Ask"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
