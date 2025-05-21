import React, { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import Bold from "@tiptap/extension-bold";
import { Table } from "../extensions/Table";
// If needed, import other extensions (like Link, Image, Underline) if their nodes/marks are used.
import { unified } from "unified";
import remarkParse from "remark-parse";
import { streamGrokText, saveNote } from "../api";
import { marked } from "marked";
import { convertNodeToJSON, flattenContent } from "../utils/editorUtils";

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

const Editor = ({ currentNote, onSave, ...props }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [title, setTitle] = useState(currentNote?.title || "");
  const [showPrompt, setShowPrompt] = useState(false);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [showTableControls, setShowTableControls] = useState(false);
  const [showTableContextMenu, setShowTableContextMenu] = useState(false);
  const [tableControlPosition, setTableControlPosition] = useState({ x: 0, y: 0, type: '', xRow: 0, yRow: 0, typeRow: '' });
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', error: null });
  const [streamStatus, setStreamStatus] = useState({ isStreaming: false, progress: 0 });
  const autosaveTimer = useRef(null);
  const promptRef = useRef(null);
  const commandMenuRef = useRef(null);
  const tableControlsRef = useRef(null);
  const tableContextMenuRef = useRef(null);
  const editorRef = useRef(null);
  const streamBufferRef = useRef("");
  const saveTimeoutRef = useRef(null);
  const selectionRef = useRef(null);
  const editorInstanceRef = useRef(null);

  // Initialize TipTap editor with desired extensions and content
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        heading: {
          levels: [1, 2, 3]
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'rounded-md bg-gray-800 p-5 font-mono text-sm text-gray-100',
          },
        },
        table: false,
      }),
      Typography,
      Highlight,
      Placeholder.configure({ placeholder: "Press Space to prompt Grok..." }),
      Table,
    ],
    content: currentNote?.content_json ? JSON.parse(currentNote.content_json) : "",
    onUpdate: ({ editor, transaction }) => {
      // Only trigger save if the content actually changed
      if (transaction.docChanged && onSave && currentNote) {
        try {
          const json = editor.getJSON();
          debouncedSave(json);
        } catch (e) {
          console.error("Failed to get editor content", e);
          setSaveStatus({ status: 'error', error: 'Failed to process content' });
        }
      }
    },
    editorProps: {
      attributes: { 
        class: "tiptap prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none",
        'data-placeholder': 'Start writing...'
      },
      handleKeyDown: (view, event) => {
        // Check if space is pressed at the start of a node
        if (event.key === ' ' && !showPrompt && !showCommandMenu) {
          const { state } = view;
          const { selection } = state;
          const { $from } = selection;
          
          // Check if we're at the start of a node
          if ($from.parentOffset === 0) {
            const coords = view.coordsAtPos(selection.from);
            const editorElement = editorRef.current;
            const editorRect = editorElement.getBoundingClientRect();
            
            // Calculate position relative to the editor container
            const x = coords.left - editorRect.left;
            const y = coords.top - editorRect.top;
            
            setPromptPosition({ x, y });
            setShowPrompt(true);
            event.preventDefault();
            return true;
          }
        }
        // Check if '/' is pressed at the start of a node
        if (event.key === '/' && !showPrompt && !showCommandMenu) {
          const { state } = view;
          const { selection } = state;
          const { $from } = selection;
          
          // Check if we're at the start of a node
          if ($from.parentOffset === 0) {
            const coords = view.coordsAtPos(selection.from);
            const editorElement = editorRef.current;
            const editorRect = editorElement.getBoundingClientRect();
            
            // Calculate position relative to the editor container
            const x = coords.left - editorRect.left;
            const y = coords.top - editorRect.top;
            
            setPromptPosition({ x, y });
            setShowCommandMenu(true);
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
  });

  // Store editor instance in ref and add hover event listeners for tables
  useEffect(() => {
    editorInstanceRef.current = editor;
    if (!editor || !editorRef.current) return;

    const editorElement = editorRef.current;
    let timeoutId = null;
    const handleMouseOver = (event) => {
      const target = event.target;
      if (target.tagName === 'TD' || target.tagName === 'TH') {
        const rect = target.getBoundingClientRect();
        const editorRect = editorElement.getBoundingClientRect();
        const x = rect.right - editorRect.left + 5;
        const y = rect.top - editorRect.top + rect.height / 2;
        setTableControlPosition({ x, y, type: 'column', xRow: rect.left - editorRect.left - 15, yRow: rect.top - editorRect.top + rect.height / 2, typeRow: 'row' });
        setShowTableControls(true);
        if (timeoutId) clearTimeout(timeoutId);
      }
    };

    const handleMouseOut = (event) => {
      const target = event.target;
      if (target.tagName === 'TD' || target.tagName === 'TH') {
        timeoutId = setTimeout(() => {
          setShowTableControls(false);
        }, 500);
      }
    };

    const handleContextMenu = (event) => {
      const target = event.target;
      if (target.tagName === 'TD' || target.tagName === 'TH') {
        event.preventDefault();
        const editorRect = editorElement.getBoundingClientRect();
        const x = event.clientX - editorRect.left;
        const y = event.clientY - editorRect.top;
        setContextMenuPosition({ x, y });
        setShowTableContextMenu(true);
      }
    };

    editorElement.addEventListener('mouseover', handleMouseOver);
    editorElement.addEventListener('mouseout', handleMouseOut);
    editorElement.addEventListener('contextmenu', handleContextMenu);
    return () => {
      editorElement.removeEventListener('mouseover', handleMouseOver);
      editorElement.removeEventListener('mouseout', handleMouseOut);
      editorElement.removeEventListener('contextmenu', handleContextMenu);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [editor]);

  // Debounced save function
  const debouncedSave = useCallback(async (content) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus({ status: 'saving', error: null });

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const editor = editorInstanceRef.current;
        if (!editor) return;

        // Get current selection before save
        const { from, to } = editor.state.selection;

        const updated = {
          ...currentNote,
          title: title,
          content_json: JSON.stringify(content),
        };
        await saveNote(updated);
        if (onSave) onSave(updated);
        setSaveStatus({ status: 'saved', error: null });

        // Restore selection after save
        requestAnimationFrame(() => {
          if (editor && editor.isActive) {
            editor.commands.setTextSelection({ from, to });
          }
        });
      } catch (error) {
        console.error('Failed to save note:', error);
        setSaveStatus({ status: 'error', error: error.message });
      }
    }, 1000); // 1 second debounce
  }, [currentNote, title, onSave]);

  // Close prompt, command menu, table controls, and context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (promptRef.current && !promptRef.current.contains(event.target)) {
        setShowPrompt(false);
      }
      if (commandMenuRef.current && !commandMenuRef.current.contains(event.target)) {
        setShowCommandMenu(false);
      }
      if (tableControlsRef.current && !tableControlsRef.current.contains(event.target)) {
        setShowTableControls(false);
      }
      if (tableContextMenuRef.current && !tableContextMenuRef.current.contains(event.target)) {
        setShowTableContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effect: on initial mount or when currentNote changes, load the content if provided
  useEffect(() => {
    if (editor && currentNote?.content_json) {
      try {
        const content = JSON.parse(currentNote.content_json);
        const { from, to } = editor.state.selection;
        editor.commands.setContent(content);
        // Restore cursor position after content update
        requestAnimationFrame(() => {
          if (editor && editor.isActive) {
            editor.commands.setTextSelection({ from, to });
          }
        });
      } catch (e) {
        console.error("Failed to set initial content:", e);
      }
      setTitle(currentNote.title);
    }
  }, [editor, currentNote]);

  // Autosave effect
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

  // Update prompt, command menu, table controls, and context menu position on scroll
  useEffect(() => {
    if ((!showPrompt && !showCommandMenu && !showTableControls && !showTableContextMenu) || !editor || !editorRef.current) return;

    const updatePosition = () => {
      const { state } = editor;
      const { selection } = state;
      const coords = editor.view.coordsAtPos(selection.from);
      const editorElement = editorRef.current;
      const editorRect = editorElement.getBoundingClientRect();
      
      // Calculate position relative to the editor container
      const x = coords.left - editorRect.left;
      const y = coords.top - editorRect.top;
      
      setPromptPosition({ x, y });
    };

    window.addEventListener('scroll', updatePosition, true);
    return () => window.removeEventListener('scroll', updatePosition, true);
  }, [showPrompt, showCommandMenu, showTableControls, showTableContextMenu, editor]);

  // Cleanup save timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleGrokSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || !editor) return;

    setIsGenerating(true);
    setStreamStatus({ isStreaming: true, progress: 0 });

    // Store the current selection or cursor position for inserting generated content
    selectionRef.current = editor.state.selection;
    const noteJSON = editor.getJSON();
    try {
      console.log('📝 Sending request to streamGrokText with payload:', {
        text: promptInput,
        note_title: title,
        note_context: extractStructuredContext(noteJSON),
      });

      const response = await streamGrokText({
        text: promptInput,
        note_title: title,
        note_context: extractStructuredContext(noteJSON),
      });

      console.log('📥 Response received in Editor:', response);

      if (!response) {
        throw new Error('No response received from streamGrokText');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error text');
        console.error('❌ StreamGrokText error response:', errorText);
        throw new Error(`Invalid response from streamGrokText: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        console.error('❌ Response has no body:', response);
        throw new Error('Response has no readable stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let totalBytes = 0;
      let receivedBytes = 0;

      // Get total content length if available
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        totalBytes = parseInt(contentLength, 10);
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Mark stream as complete and flush buffer
          streamMarkdownToEditor("", true);
          break;
        }

        const chunk = decoder.decode(value);
        const decodedChunk = decodeChunk(chunk);
        
        // Update progress
        receivedBytes += value.length;
        if (totalBytes > 0) {
          setStreamStatus(prev => ({
            ...prev,
            progress: Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
          }));
        }
        
        // Stream the chunk using our markdown-aware streaming function
        streamMarkdownToEditor(decodedChunk);
        
        // Small delay to prevent overwhelming the UI
        await new Promise((r) => setTimeout(r, 10));
      }
    } catch (error) {
      console.error('Error generating text:', error);
      // Show error to user
      editor.commands.insertContent({
        type: 'paragraph',
        content: [{
          type: 'text',
          text: 'Error generating text. Please try again.',
          marks: [{ type: 'bold' }]
        }]
      });
    } finally {
      setIsGenerating(false);
      setStreamStatus({ isStreaming: false, progress: 0 });
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

  const renderTableControls = () => {
    return (
      <>
        <div
          ref={tableControlsRef}
          style={{
            position: 'absolute',
            left: `${tableControlPosition.x}px`,
            top: `${tableControlPosition.y}px`,
            zIndex: 50,
          }}
          className="bg-white border border-gray-200 rounded-full shadow-lg p-1 backdrop-blur-sm"
        >
          <button
            onClick={() => {
              editor.chain().focus().addColumnAfter().run();
              setShowTableControls(false);
            }}
            className="text-blue-600 hover:text-blue-800"
            title="Add Column After"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        <div
          ref={tableControlsRef}
          style={{
            position: 'absolute',
            left: `${tableControlPosition.xRow}px`,
            top: `${tableControlPosition.yRow}px`,
            zIndex: 50,
          }}
          className="bg-white border border-gray-200 rounded-full shadow-lg p-1 backdrop-blur-sm"
        >
          <button
            onClick={() => {
              editor.chain().focus().addRowAfter().run();
              setShowTableControls(false);
            }}
            className="text-blue-600 hover:text-blue-800"
            title="Add Row After"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </>
    );
  };

  const renderTableContextMenu = () => {
    return (
      <div
        ref={tableContextMenuRef}
        style={{
          position: 'absolute',
          left: `${contextMenuPosition.x}px`,
          top: `${contextMenuPosition.y}px`,
          zIndex: 60,
        }}
        className="bg-white border border-gray-200 rounded-lg shadow-lg p-2 backdrop-blur-sm min-w-[150px]"
      >
        <div className="text-sm text-gray-700 mb-1">Table Options</div>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => {
                editor.chain().focus().addColumnBefore().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().addColumnBefore()}
            >
              Add Column Before
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().addColumnAfter().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().addColumnAfter()}
            >
              Add Column After
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().addRowBefore().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().addRowBefore()}
            >
              Add Row Before
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().addRowAfter().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().addRowAfter()}
            >
              Add Row After
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().deleteColumn().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().deleteColumn()}
            >
              Delete Column
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().deleteRow().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().deleteRow()}
            >
              Delete Row
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().deleteTable().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().deleteTable()}
            >
              Delete Table
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeaderRow().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().toggleHeaderRow()}
            >
              Toggle Header Row
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().toggleHeaderColumn().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().toggleHeaderColumn()}
            >
              Toggle Header Column
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().mergeCells().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().mergeCells()}
            >
              Merge Cells
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                editor.chain().focus().splitCell().run();
                setShowTableContextMenu(false);
              }}
              className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
              disabled={!editor.can().splitCell()}
            >
              Split Cell
            </button>
          </li>
        </ul>
      </div>
    );
  };

  // Stream markdown text into the editor as TipTap content, chunk by chunk.
  const streamMarkdownToEditor = (markdownChunk, isFinal = false) => {
    if (!editor) {
      return;
    }
    // Append this chunk to the cumulative buffer
    streamBufferRef.current += markdownChunk;
    const fullMarkdown = streamBufferRef.current;
    try {
      // Insert each chunk as plain text for streaming effect
      if (markdownChunk) {
        if (!selectionRef.current.streamStart) {
          // Record the starting position for streaming content
          selectionRef.current.streamStart = editor.state.selection.from;
        }
        editor.commands.insertContent(markdownChunk);
      }
      
      if (isFinal && fullMarkdown) {
        // Parse the accumulated markdown into an AST
        const ast = unified().use(remarkParse).parse(fullMarkdown);
        // Convert AST to TipTap JSON document
        const contentNodes = ast.children.map((child) =>
          convertNodeToJSON(child)
        );
        const docContent = flattenContent(contentNodes);
        
        // Replace the streamed content with parsed markdown
        if (selectionRef.current && selectionRef.current.streamStart !== undefined) {
          const startPos = selectionRef.current.streamStart;
          const endPos = editor.state.selection.to;
          editor.commands.setTextSelection({ from: startPos, to: endPos });
          editor.commands.deleteSelection();
          editor.commands.setTextSelection(startPos);
          editor.commands.insertContent(docContent);
        } else {
          editor.commands.insertContent(docContent);
        }
      }
    } catch (error) {
      console.error("Error streaming markdown text:", error);
      // If parsing fails, show error message only when stream is complete
      if (isFinal) {
        editor.chain().focus().insertContent("Error parsing response.").run();
      }
    } finally {
      if (isFinal) {
        // Clear the buffer and stream start position when the stream is complete
        streamBufferRef.current = "";
        if (selectionRef.current) {
          selectionRef.current.streamStart = undefined;
        }
      }
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow border p-4 mt-4 relative">
        <div className="flex justify-between items-center mb-4">
          <input
            type="text"
            className="text-xl font-bold w-full border-b focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="ml-4 text-sm">
            {saveStatus.status === 'saving' && (
              <span className="text-gray-500 flex items-center">
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </span>
            )}
            {saveStatus.status === 'saved' && (
              <span className="text-green-500">Saved</span>
            )}
            {saveStatus.status === 'error' && (
              <span className="text-red-500" title={saveStatus.error}>
                Save failed
              </span>
            )}
          </div>
        </div>
        <EditorContent editor={editor} ref={editorRef} />
        
        {/* Add streaming progress indicator */}
        {streamStatus.isStreaming && (
          <div className="absolute bottom-4 right-4 bg-white/95 border border-gray-200 rounded-lg shadow-lg p-3 flex items-center gap-2">
            <div className="w-4 h-4">
              <svg className="animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <span className="text-sm text-gray-600">Generating response...</span>
            {streamStatus.progress > 0 && (
              <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${streamStatus.progress}%` }}
                />
              </div>
            )}
          </div>
        )}
        
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
        {showCommandMenu && (
          <div
            ref={commandMenuRef}
            style={{
              position: 'absolute',
              left: `${promptPosition.x}px`,
              top: `${promptPosition.y}px`,
              zIndex: 50,
            }}
            className="bg-white/95 border border-gray-200 rounded-xl shadow-lg p-3 backdrop-blur-sm min-w-[200px]"
          >
            <div className="text-sm text-gray-700 mb-2">Commands</div>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => {
                    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                    setShowCommandMenu(false);
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-800 transition-colors"
                >
                  Insert Table
                </button>
              </li>
              {/* Add more command options here */}
            </ul>
          </div>
        )}
        {showTableControls && renderTableControls()}
        {showTableContextMenu && renderTableContextMenu()}
      </div>
    </div>
  );
};

export default Editor;
