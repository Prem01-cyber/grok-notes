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
  const [commandSearch, setCommandSearch] = useState("");
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [showTableControls, setShowTableControls] = useState(false);
  const [showTableContextMenu, setShowTableContextMenu] = useState(false);
  const [tableControlPosition, setTableControlPosition] = useState({ x: 0, y: 0, type: '', xRow: 0, yRow: 0, typeRow: '' });
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', error: null });
  const [streamStatus, setStreamStatus] = useState({ isStreaming: false, progress: 0 });
  const [hoveredButton, setHoveredButton] = useState(null);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0, width: 0, height: 0 });
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
  const currentCellRef = useRef(null);

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
            setCommandSearch("");
            setSelectedCommandIndex(0);
            event.preventDefault();
            return true;
          }
        }
        // Handle command menu navigation and input
        if (showCommandMenu) {
          if (event.key === 'Enter') {
            const filteredCommands = getFilteredCommands();
            if (filteredCommands.length > 0 && selectedCommandIndex < filteredCommands.length) {
              filteredCommands[selectedCommandIndex].action();
              setShowCommandMenu(false);
              event.preventDefault();
              return true;
            }
          } else if (event.key === 'ArrowDown') {
            const filteredCommands = getFilteredCommands();
            if (filteredCommands.length > 0) {
              setSelectedCommandIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
              event.preventDefault();
              return true;
            }
          } else if (event.key === 'ArrowUp') {
            setSelectedCommandIndex((prev) => Math.max(prev - 1, 0));
            event.preventDefault();
            return true;
          } else if (event.key === 'Escape') {
            setShowCommandMenu(false);
            event.preventDefault();
            return true;
          } else if (event.key === 'Backspace' && commandSearch === "") {
            setShowCommandMenu(false);
            return false; // Allow normal backspace behavior
          } else if (event.key.length === 1 || event.key === 'Backspace') {
            // Update search query on typing or backspace
            if (event.key === 'Backspace') {
              setCommandSearch((prev) => prev.slice(0, -1));
            } else {
              setCommandSearch((prev) => prev + event.key);
            }
            setSelectedCommandIndex(0);
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
        currentCellRef.current = target;
        const rect = target.getBoundingClientRect();
        const editorRect = editorElement.getBoundingClientRect();
        const mouseX = event.clientX;
        const mouseY = event.clientY;
        const borderThreshold = 5; // Pixels near border to trigger hover
        
        // Calculate positions relative to editor
        const cellLeft = rect.left - editorRect.left;
        const cellRight = rect.right - editorRect.left;
        const cellTop = rect.top - editorRect.top;
        const cellBottom = rect.bottom - editorRect.top;
        const mouseRelX = mouseX - editorRect.left;
        const mouseRelY = mouseY - editorRect.top;

        // Determine if mouse is near a border
        let borderType = '';
        let x = 0, y = 0;
        if (mouseX >= rect.right - borderThreshold) {
          borderType = 'right';
          x = cellRight + 5;
          y = cellTop + rect.height / 2;
        } else if (mouseX <= rect.left + borderThreshold) {
          borderType = 'left';
          x = cellLeft - 15;
          y = cellTop + rect.height / 2;
        } else if (mouseY >= rect.bottom - borderThreshold) {
          borderType = 'bottom';
          x = cellLeft + rect.width / 2;
          y = cellBottom + 5;
        } else if (mouseY <= rect.top + borderThreshold) {
          borderType = 'top';
          x = cellLeft + rect.width / 2;
          y = cellTop - 15;
        }

        if (borderType) {
          setTableControlPosition({ x, y, type: borderType });
          setPreviewPosition({
            x: cellLeft,
            y: cellTop,
            width: rect.width,
            height: rect.height,
            border: borderType
          });
          setShowTableControls(true);
          if (timeoutId) clearTimeout(timeoutId);
        }
      }
    };

    const handleMouseOut = (event) => {
      const target = event.target;
      if (target.tagName === 'TD' || target.tagName === 'TH') {
        timeoutId = setTimeout(() => {
          setShowTableControls(false);
          setHoveredButton(null);
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
  
  // Define available commands with categories and actions (Notion-inspired)
  const commands = [
    { name: "Heading 1", category: "Formatting", action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h7.586A2 2 0 0113.172 5.586l1.242 1.242A2 2 0 0115 8.414V15a1 1 0 11-2 0V9h-2v10a1 1 0 11-2 0V9H7v6a1 1 0 11-2 0V5z" clipRule="evenodd" /></svg> },
    { name: "Heading 2", category: "Formatting", action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h7.586A2 2 0 0113.172 5.586l1.242 1.242A2 2 0 0115 8.414V15a1 1 0 11-2 0V9h-2v10a1 1 0 11-2 0V9H7v6a1 1 0 11-2 0V5z" clipRule="evenodd" /></svg> },
    { name: "Heading 3", category: "Formatting", action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h7.586A2 2 0 0113.172 5.586l1.242 1.242A2 2 0 0115 8.414V15a1 1 0 11-2 0V9h-2v10a1 1 0 11-2 0V9H7v6a1 1 0 11-2 0V5z" clipRule="evenodd" /></svg> },
    { name: "Bold", category: "Formatting", action: () => editor.chain().focus().toggleBold().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4a1 1 0 011-1h5a4 4 0 012.536 7.096A4 4 0 0111 16v1H6a1 1 0 01-1-1V4zm4 10.5a2 2 0 004-1.372A2 2 0 0011 9V7a2 2 0 00-4 0v2a2 2 0 002 2v1.128a2 2 0 000 1.372z" clipRule="evenodd" /></svg> },
    { name: "Italic", category: "Formatting", action: () => editor.chain().focus().toggleItalic().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4a1 1 0 011-1h3a1 1 0 010 2H8.251l-.234 1.17a1 1 0 01-1.984-.396l.234-1.169A1 1 0 016.017 5H6a1 1 0 010-2h8a1 1 0 011 1 1 1 0 012 0 3 3 0 01-3 3h-.749l.234 1.169a1 1 0 01-1.984.396l-.234-1.17H11a1 1 0 010-2h1.983a1 1 0 01.986 1.17l-.234 1.169a3 3 0 005.965 1.104l.234-1.169A3 3 0 0018.017 5H18a1 1 0 010-2h-2a1 1 0 00-1 1 1 1 0 00-2 0 3 3 0 00-3-3H6a3 3 0 00-3 3v12a3 3 0 003 3h4a3 3 0 003-3 1 1 0 10-2 0 1 1 0 00-1 1H6a1 1 0 00-1-1V5z" clipRule="evenodd" /></svg> },
    { name: "Bullet List", category: "Lists", action: () => editor.chain().focus().toggleBulletList().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 6a1 1 0 100-2 1 1 0 000 2zM3 9a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 3a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg> },
    { name: "Numbered List", category: "Lists", action: () => editor.chain().focus().toggleOrderedList().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h1.616a1 1 0 01.986 1.164l-.24 1.208a1 1 0 01-1.974.394l.24-1.208A1 1 0 015.616 5H7v2H4a1 1 0 010-2zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm1 2a1 1 0 010 2h1.616a1 1 0 01.986-1.164l-.24-1.208a1 1 0 011.974-.394l.24 1.208A1 1 0 017.616 15H9v2H4a1 1 0 010-2h3v-2H4z" clipRule="evenodd" /></svg> },
    { name: "To-Do List", category: "Lists", action: () => editor.chain().focus().toggleTaskList().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm11.293-1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L16.586 15H13v-2h3.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg> },
    { name: "Insert Table", category: "Insert", action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg> },
    { name: "Code Block", category: "Insert", action: () => editor.chain().focus().toggleCodeBlock().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1zm10.293-5.293a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414L14.586 15H13v-2h1.586l-1.293-1.293a1 1 0 010-1.414zM6.293 10.293a1 1 0 011.414 0L9 11.586V13h-2v-1.586l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg> },
    { name: "Block Quote", category: "Insert", action: () => editor.chain().focus().toggleBlockquote().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4a1 1 0 011-1h8a1 1 0 011 1v3a1 1 0 01-2 0V5H7v2a1 1 0 01-2 0V4zm-1 5a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zm6 3a1 1 0 011-1h3a1 1 0 110 2h-3a1 1 0 01-1-1zm-1.293 2.293a1 1 0 011.414 0L12 15.586V17H8v-1.414l1.707-1.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg> },
    { name: "Divider", category: "Structure", action: () => editor.chain().focus().setHorizontalRule().run(), icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" /></svg> }
  ];
  
  // Function to get filtered commands based on search input
  const getFilteredCommands = () => {
    if (!commandSearch) {
      return commands; // Return all commands if no search query
    }
    const searchLower = commandSearch.toLowerCase();
    return commands.filter(cmd => cmd.name.toLowerCase().includes(searchLower));
  };

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
    const isColumn = tableControlPosition.type === 'right' || tableControlPosition.type === 'left';
    const actionText = isColumn ? (tableControlPosition.type === 'right' ? 'Add Column After' : 'Add Column Before') : (tableControlPosition.type === 'bottom' ? 'Add Row After' : 'Add Row Before');
    const actionFn = isColumn ? (tableControlPosition.type === 'right' ? () => editor.chain().focus().addColumnAfter().run() : () => editor.chain().focus().addColumnBefore().run()) : (tableControlPosition.type === 'bottom' ? () => editor.chain().focus().addRowAfter().run() : () => editor.chain().focus().addRowBefore().run());

    return (
      <>
        <div
          ref={tableControlsRef}
          style={{
            position: 'absolute',
            left: `${tableControlPosition.x}px`,
            top: `${tableControlPosition.y}px`,
            zIndex: 50,
            transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
            opacity: showTableControls ? 1 : 0,
            transform: showTableControls ? 'scale(1)' : 'scale(0.9)',
          }}
          className="bg-white border border-gray-200 rounded shadow-lg p-2 backdrop-blur-sm flex flex-col"
        >
          <button
            onMouseEnter={() => setHoveredButton(tableControlPosition.type)}
            onMouseLeave={() => setHoveredButton(null)}
            onClick={() => {
              actionFn();
              setShowTableControls(false);
            }}
            className="text-blue-600 hover:text-white bg-blue-50 hover:bg-blue-600 rounded px-3 py-1 text-sm font-medium transition-all duration-200"
          >
            {isColumn ? 'Add Column' : 'Add Row'}
          </button>
        </div>
        {hoveredButton && (
          <div
            style={{
              position: 'absolute',
              left: hoveredButton === 'right' ? `${previewPosition.x + previewPosition.width}px` : hoveredButton === 'left' ? `${previewPosition.x}px` : `${previewPosition.x}px`,
              top: hoveredButton === 'bottom' ? `${previewPosition.y + previewPosition.height}px` : hoveredButton === 'top' ? `${previewPosition.y}px` : `${previewPosition.y}px`,
              width: hoveredButton === 'right' || hoveredButton === 'left' ? '2px' : `${previewPosition.width}px`,
              height: hoveredButton === 'bottom' || hoveredButton === 'top' ? '2px' : `${previewPosition.height}px`,
              backgroundColor: 'rgba(59, 130, 246, 0.5)', // Blue with transparency
              zIndex: 40,
              transition: 'opacity 0.2s ease-in-out',
              opacity: showTableControls ? 1 : 0,
            }}
          />
        )}
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
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow border p-4 mt-4 relative overflow-x-auto">
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
        <div className="w-full overflow-x-auto">
          <EditorContent editor={editor} ref={editorRef} className="w-full" />
        </div>
        
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
            className="bg-white/98 border border-gray-200 rounded-xl shadow-xl p-4 backdrop-blur-md min-w-[300px] max-h-[400px] overflow-y-auto"
          >
            <div className="mb-3 border-b border-gray-200 pb-1">
              <input
                type="text"
                className="w-full text-sm p-2 border-none focus:outline-none text-gray-800 font-medium"
                value={`/${commandSearch}`}
                onChange={(e) => {
                  const value = e.target.value.startsWith('/') ? e.target.value.slice(1) : e.target.value;
                  setCommandSearch(value);
                  setSelectedCommandIndex(0);
                }}
                placeholder="/Type to search commands..."
                autoFocus
              />
            </div>
            <div className="text-xs font-medium text-gray-500 mb-2">Commands</div>
            {getFilteredCommands().length > 0 ? (
              <ul className="space-y-1">
                {getFilteredCommands().map((cmd, index) => (
                  <li key={cmd.name}>
                    <button
                      onClick={() => {
                        cmd.action();
                        setShowCommandMenu(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded text-sm text-gray-800 font-normal transition-colors flex items-center gap-2 ${index === selectedCommandIndex ? 'bg-blue-50' : 'hover:bg-blue-50'}`}
                    >
                      {cmd.icon}
                      {cmd.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500 italic px-3 py-2">No matching commands found.</div>
            )}
          </div>
        )}
        {showTableControls && renderTableControls()}
        {showTableContextMenu && renderTableContextMenu()}
      </div>
    </div>
  );
};

export default Editor;
