import React, { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Placeholder from "@tiptap/extension-placeholder";
import Bold from "@tiptap/extension-bold";
// If needed, import other extensions (like Link, Image, Underline) if their nodes/marks are used.
import { unified } from "unified";
import remarkParse from "remark-parse";
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

const Editor = ({ currentNote, onSave, ...props }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState("");
  const [title, setTitle] = useState(currentNote?.title || "");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState({ status: 'idle', error: null });
  const [streamStatus, setStreamStatus] = useState({ isStreaming: false, progress: 0 });
  const autosaveTimer = useRef(null);
  const promptRef = useRef(null);
  const editorRef = useRef(null);
  const streamBufferRef = useRef("");
  const saveTimeoutRef = useRef(null);

  // Debounced save function
  const debouncedSave = useCallback(async (content) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus({ status: 'saving', error: null });

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const updated = {
          ...currentNote,
          title: title,
          content_json: JSON.stringify(content),
        };
        await saveNote(updated);
        if (onSave) onSave(updated);
        setSaveStatus({ status: 'saved', error: null });
      } catch (error) {
        console.error('Failed to save note:', error);
        setSaveStatus({ status: 'error', error: error.message });
      }
    }, 1000); // 1 second debounce
  }, [currentNote, title, onSave]);

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
      }),
      Typography,
      Highlight,
      Placeholder.configure({ placeholder: "Press Space to prompt Grok..." }),
    ],
    content: currentNote?.content_json ? JSON.parse(currentNote.content_json) : "",
    onUpdate: ({ editor }) => {
      // Trigger callback on content change if provided
      if (onSave && currentNote) {
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
        if (event.key === ' ' && !showPrompt) {
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

  // Effect: on initial mount or when currentNote changes, load the content if provided
  useEffect(() => {
    if (editor && currentNote?.content_json) {
      try {
        const content = JSON.parse(currentNote.content_json);
        editor.commands.setContent(content);
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

  // Update prompt position on scroll
  useEffect(() => {
    if (!showPrompt || !editor || !editorRef.current) return;

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
  }, [showPrompt, editor]);

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

  // Flatten content recursively into a flat array of TipTap JSON nodes.
  const flattenContent = (content) => {
    // Defensive: if content is null or undefined, return an empty array.
    if (content == null) {
      return [];
    }
    // If content is an array, flatten each element recursively (handles nested arrays).
    if (Array.isArray(content)) {
      const flat = [];
      content.forEach((item) => {
        const flattenedItem = flattenContent(item);
        if (Array.isArray(flattenedItem)) {
          flat.push(...flattenedItem);
        } else if (flattenedItem != null) {
          flat.push(flattenedItem);
        }
      });
      return flat;
    }
    // If content is a string or number, create a text node preserving all characters (whitespace, etc.).
    if (typeof content === "string" || typeof content === "number") {
      return [createTextNode(String(content))];
    }
    // If content is already a TipTap node (has a type and text or content), flatten any nested content within it.
    if (
      content.type &&
      (content.text !== undefined || content.content !== undefined)
    ) {
      if (content.content) {
        content.content = flattenContent(content.content);
      }
      return [content];
    }
    // If content is an object that's not a TipTap node, attempt to convert it to TipTap JSON and then flatten.
    const converted = convertNodeToJSON(content);
    return flattenContent(converted);
  };

  // Create a TipTap text node from a string, preserving exact text (including tabs, newlines, spaces, quotes).
  const createTextNode = (text) => {
    // Note: We do not trim whitespace; preserving whitespace (including leading spaces and line breaks)
    // is important for scenarios like prompt triggers that rely on a leading space.
    const safeText = text != null ? String(text) : "";
    return { type: "text", text: safeText };
  };

  // Create a TipTap paragraph node with given content.
  const createParagraphNode = (content) => {
    const children = flattenContent(content);
    return {
      type: "paragraph",
      content: children && children.length > 0 ? children : [],
    };
  };

  // Create a TipTap list item node with given content, ensuring proper structure (paragraphs inside).
  const createListItemNode = (content) => {
    const children = flattenContent(content);
    const listItemContent = [];
    if (!children || children.length === 0) {
      // Empty list item: include an empty paragraph to preserve the list item structure
      listItemContent.push({ type: "paragraph", content: [] });
    } else if (children.length === 1 && children[0].type === "paragraph") {
      // Single paragraph child, use it directly
      listItemContent.push(children[0]);
    } else {
      // Multiple or mixed children: wrap inline nodes into paragraphs as needed
      let inlineBuffer = [];
      children.forEach((node) => {
        if (!node || !node.type) return;
        const isInlineNode = node.type === "text" || node.type === "hardBreak";
        if (isInlineNode) {
          // Buffer consecutive inline nodes
          inlineBuffer.push(node);
        } else {
          // If a block node appears, flush the current inline buffer into a paragraph
          if (inlineBuffer.length > 0) {
            listItemContent.push({
              type: "paragraph",
              content: [...inlineBuffer],
            });
            inlineBuffer = [];
          }
          // Directly append block-level nodes or nested lists
          if (node.type === "bulletList" || node.type === "orderedList") {
            listItemContent.push(node);
          } else if (node.type === "paragraph") {
            listItemContent.push(node);
          } else {
            // Append any other block node (codeBlock, heading, etc.) as-is
            listItemContent.push(node);
          }
        }
      });
      // Flush any remaining inline nodes as a final paragraph
      if (inlineBuffer.length > 0) {
        listItemContent.push({ type: "paragraph", content: [...inlineBuffer] });
        inlineBuffer = [];
      }
    }
    return { type: "listItem", content: listItemContent };
  };

  // Convert an HTML/Markdown node or structure into TipTap (ProseMirror) JSON format.
  const convertNodeToJSON = (node) => {
    try {
      if (!node) {
        return null;
      }
      // If node is an array of nodes, convert each element and flatten the results.
      if (Array.isArray(node)) {
        return flattenContent(node.map((n) => convertNodeToJSON(n)));
      }
      // If node is a string, determine if it's HTML or Markdown, then parse accordingly.
      if (typeof node === "string") {
        const str = node;
        const htmlRegex = /<([A-Za-z][A-Za-z0-9]*)\b[^>]*>/;
        if (htmlRegex.test(str)) {
          // Treat as HTML string
          const parser = new DOMParser();
          const doc = parser.parseFromString(str, "text/html");
          const bodyNodes = Array.from(doc.body.childNodes);
          return flattenContent(
            bodyNodes.map((child) => convertNodeToJSON(child))
          );
        } else {
          // Treat as Markdown string
          let ast;
          try {
            ast = unified().use(remarkParse).parse(str);
          } catch (err) {
            console.error("Markdown parse failed:", err);
            // Fallback: wrap raw text in a paragraph to avoid losing content
            return createParagraphNode(str);
          }
          return flattenContent(
            ast.children.map((child) => convertNodeToJSON(child))
          );
        }
      }
      // If this is already a TipTap JSON node (with 'type' and content or text), return it (after flattening its content).
      if (
        typeof node.type === "string" &&
        (node.text !== undefined || node.content !== undefined)
      ) {
        if (node.content) {
          node.content = flattenContent(node.content);
        }
        return node;
      }
      // Handle Markdown AST nodes by node.type
      if (node.type) {
        switch (node.type) {
          case "root": {
            // Root of markdown AST: process children array
            if (Array.isArray(node.children)) {
              return flattenContent(
                node.children.map((child) => convertNodeToJSON(child))
              );
            }
            return [];
          }
          case "paragraph": {
            const contentNodes = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            return createParagraphNode(contentNodes);
          }
          case "text": {
            // Markdown text node
            const textValue =
              node.value !== undefined
                ? node.value
                : node.text !== undefined
                ? node.text
                : "";
            return createTextNode(textValue);
          }
          case "heading": {
            const level = node.depth || node.level || 1;
            const contentNodes = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            return {
              type: "heading",
              attrs: { level: Math.max(1, Math.min(6, level)) },
              content: flattenContent(contentNodes),
            };
          }
          case "list": {
            // Ordered or bullet list
            const ordered = !!node.ordered;
            const start = typeof node.start === "number" ? node.start : null;
            const listType = ordered ? "orderedList" : "bulletList";
            const listContent = [];
            if (Array.isArray(node.children)) {
              node.children.forEach((item) => {
                const listItemNode = convertNodeToJSON(item);
                if (listItemNode) {
                  // Ensure it is a listItem node in final output
                  if (listItemNode.type !== "listItem") {
                    listContent.push(createListItemNode(listItemNode));
                  } else {
                    listContent.push(listItemNode);
                  }
                }
              });
            }
            const listNode = { type: listType, content: listContent };
            if (ordered && start && start !== 1) {
              // If ordered list starts at a specific number (not 1), include that attribute
              listNode.attrs = { start: start };
            }
            return listNode;
          }
          case "listItem": {
            // Markdown list item (can contain paragraphs and nested lists)
            const itemChildren = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            return createListItemNode(itemChildren);
          }
          case "blockquote": {
            const quoteContent = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            return {
              type: "blockquote",
              content: flattenContent(quoteContent),
            };
          }
          case "code": {
            // Fenced code block or indented code
            const codeText = node.value || "";
            const language = node.lang || "";
            return {
              type: "codeBlock",
              attrs: { language: language },
              content: [createTextNode(codeText)],
            };
          }
          case "inlineCode": {
            // Inline code
            const codeText = node.value || "";
            const textNode = createTextNode(codeText);
            textNode.marks = [{ type: "code" }];
            return textNode;
          }
          case "emphasis": {
            // Italic text
            const contentNodes = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            const flattened = flattenContent(contentNodes);
            flattened.forEach((child) => {
              if (child.type === "text") {
                child.marks = [...(child.marks || []), { type: "italic" }];
              }
            });
            return flattened;
          }
          case "strong": {
            // Bold text
            const contentNodes = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            const flattened = flattenContent(contentNodes);
            flattened.forEach((child) => {
              if (child.type === "text") {
                child.marks = [...(child.marks || []), { type: "bold" }];
              }
            });
            return flattened;
          }
          case "delete": {
            // Strikethrough text
            const contentNodes = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            const flattened = flattenContent(contentNodes);
            flattened.forEach((child) => {
              if (child.type === "text") {
                child.marks = [...(child.marks || []), { type: "strike" }];
              }
            });
            return flattened;
          }
          case "link": {
            // Hyperlink
            const contentNodes = node.children
              ? node.children.map((child) => convertNodeToJSON(child))
              : [];
            const flattened = flattenContent(contentNodes);
            const href = node.url || node.href || "";
            flattened.forEach((child) => {
              if (child.type === "text") {
                child.marks = [
                  ...(child.marks || []),
                  { type: "link", attrs: { href } },
                ];
              }
            });
            return flattened;
          }
          case "image": {
            // Image node
            const src = node.url || "";
            const alt = node.alt || "";
            const title = node.title || "";
            return { type: "image", attrs: { src, alt, title } };
          }
          case "thematicBreak": {
            // Horizontal rule
            return { type: "horizontalRule" };
          }
          case "break": {
            // Hard line break
            return { type: "hardBreak" };
          }
          default: {
            // Unknown/unhandled Markdown node
            if (node.value !== undefined) {
              // If it has a text value, return it as a text node
              return createTextNode(node.value);
            } else if (node.children) {
              // Otherwise, attempt to convert children
              return flattenContent(
                node.children.map((child) => convertNodeToJSON(child))
              );
            }
            return null;
          }
        }
      }
      // Handle DOM Nodes (for HTML content)
      if (node.nodeType) {
        switch (node.nodeType) {
          case Node.TEXT_NODE: {
            // Text node
            const textContent = node.nodeValue || "";
            return createTextNode(textContent);
          }
          case Node.ELEMENT_NODE: {
            const tag = node.tagName ? node.tagName.toLowerCase() : "";
            switch (tag) {
              case "p": {
                const childNodes = Array.from(node.childNodes || []);
                return createParagraphNode(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
              }
              case "br": {
                return { type: "hardBreak" };
              }
              case "blockquote": {
                const childNodes = Array.from(node.childNodes || []);
                return {
                  type: "blockquote",
                  content: flattenContent(
                    childNodes.map((child) => convertNodeToJSON(child))
                  ),
                };
              }
              case "ul": {
                const items = Array.from(node.children || [])
                  .map((child) => convertNodeToJSON(child))
                  .filter((n) => n);
                return { type: "bulletList", content: flattenContent(items) };
              }
              case "ol": {
                const items = Array.from(node.children || [])
                  .map((child) => convertNodeToJSON(child))
                  .filter((n) => n);
                const listNode = {
                  type: "orderedList",
                  content: flattenContent(items),
                };
                const startAttr = node.getAttribute
                  ? node.getAttribute("start")
                  : null;
                if (startAttr) {
                  const start = parseInt(startAttr, 10);
                  if (!isNaN(start) && start !== 1) {
                    listNode.attrs = { start };
                  }
                }
                return listNode;
              }
              case "li": {
                const childNodes = Array.from(node.childNodes || []);
                return createListItemNode(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
              }
              case "h1":
              case "h2":
              case "h3":
              case "h4":
              case "h5":
              case "h6": {
                const level = parseInt(tag.charAt(1), 10) || 1;
                const childNodes = Array.from(node.childNodes || []);
                return {
                  type: "heading",
                  attrs: { level },
                  content: flattenContent(
                    childNodes.map((child) => convertNodeToJSON(child))
                  ),
                };
              }
              case "pre": {
                // Preformatted text (usually for code blocks)
                let codeChild = null;
                for (let i = 0; i < node.childNodes.length; i++) {
                  const cn = node.childNodes[i];
                  if (
                    cn.nodeType === Node.ELEMENT_NODE &&
                    cn.tagName.toLowerCase() === "code"
                  ) {
                    codeChild = cn;
                    break;
                  }
                }
                if (codeChild) {
                  const codeText = codeChild.textContent || "";
                  // Attempt to get language from class (e.g., class="language-js")
                  let language = "";
                  if (codeChild.getAttribute) {
                    const classAttr = codeChild.getAttribute("class") || "";
                    const match = classAttr.match(/language-([^\s]+)/);
                    if (match) {
                      language = match[1];
                    }
                  }
                  return {
                    type: "codeBlock",
                    attrs: { language },
                    content: [createTextNode(codeText)],
                  };
                } else {
                  // No inner code tag, treat entire <pre> text as code
                  const preText = node.textContent || "";
                  return {
                    type: "codeBlock",
                    attrs: { language: "" },
                    content: [createTextNode(preText)],
                  };
                }
              }
              case "code": {
                // Inline code (outside of pre)
                const codeText = node.textContent || "";
                const textNode = createTextNode(codeText);
                textNode.marks = [{ type: "code" }];
                return textNode;
              }
              case "strong":
              case "b": {
                const childNodes = Array.from(node.childNodes || []);
                const flattened = flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
                flattened.forEach((child) => {
                  if (child.type === "text") {
                    child.marks = [...(child.marks || []), { type: "bold" }];
                  }
                });
                return flattened;
              }
              case "em":
              case "i": {
                const childNodes = Array.from(node.childNodes || []);
                const flattened = flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
                flattened.forEach((child) => {
                  if (child.type === "text") {
                    child.marks = [...(child.marks || []), { type: "italic" }];
                  }
                });
                return flattened;
              }
              case "u": {
                const childNodes = Array.from(node.childNodes || []);
                const flattened = flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
                flattened.forEach((child) => {
                  if (child.type === "text") {
                    child.marks = [
                      ...(child.marks || []),
                      { type: "underline" },
                    ];
                  }
                });
                return flattened;
              }
              case "s":
              case "del": {
                const childNodes = Array.from(node.childNodes || []);
                const flattened = flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
                flattened.forEach((child) => {
                  if (child.type === "text") {
                    child.marks = [...(child.marks || []), { type: "strike" }];
                  }
                });
                return flattened;
              }
              case "a": {
                const childNodes = Array.from(node.childNodes || []);
                const flattened = flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
                const href = node.getAttribute
                  ? node.getAttribute("href") || ""
                  : "";
                flattened.forEach((child) => {
                  if (child.type === "text") {
                    child.marks = [
                      ...(child.marks || []),
                      { type: "link", attrs: { href } },
                    ];
                  }
                });
                return flattened;
              }
              case "img": {
                const src = node.getAttribute
                  ? node.getAttribute("src") || ""
                  : "";
                const alt = node.getAttribute
                  ? node.getAttribute("alt") || ""
                  : "";
                const title = node.getAttribute
                  ? node.getAttribute("title") || ""
                  : "";
                return { type: "image", attrs: { src, alt, title } };
              }
              case "hr": {
                return { type: "horizontalRule" };
              }
              default: {
                // Unknown element: convert children and return them (dropping the wrapper element)
                const childNodes = Array.from(node.childNodes || []);
                return flattenContent(
                  childNodes.map((child) => convertNodeToJSON(child))
                );
              }
            }
          }
          case Node.DOCUMENT_FRAGMENT_NODE:
          case Node.DOCUMENT_NODE: {
            // If node is a Document or Fragment, process its children
            const childNodes = Array.from(node.childNodes || []);
            return flattenContent(
              childNodes.map((child) => convertNodeToJSON(child))
            );
          }
          default:
            return null;
        }
      }
      // If node is an object with a toString method (but not recognized above), use that as last resort.
      if (typeof node.toString === "function") {
        return createTextNode(node.toString());
      }
      return null;
    } catch (error) {
      console.error("Error converting node to JSON:", error, node);
      // Fallback: treat node content as plain text to avoid data loss
      try {
        const text =
          typeof node === "string"
            ? node
            : node && node.toString
            ? node.toString()
            : "";
        return createTextNode(text);
      } catch {
        return null;
      }
    }
  };

  // Stream markdown text into the editor as TipTap content, chunk by chunk.
  const streamMarkdownToEditor = (markdownChunk, isFinal = false) => {
    if (!editor || !markdownChunk) {
      return;
    }
    // Append this chunk to the cumulative buffer
    streamBufferRef.current += markdownChunk;
    const fullMarkdown = streamBufferRef.current;
    try {
      // Parse the accumulated markdown into an AST
      const ast = unified().use(remarkParse).parse(fullMarkdown);
      // Convert AST to TipTap JSON document
      const contentNodes = ast.children.map((child) =>
        convertNodeToJSON(child)
      );
      const docContent = flattenContent(contentNodes);
      const doc = { type: "doc", content: docContent };
      
      // Preserve current scroll position to prevent jump on content update
      const editorEl = document.querySelector(".editor-content");
      const prevScrollTop = editorEl ? editorEl.scrollTop : null;
      
      // Update the editor with new content (without focusing or resetting selection)
      editor.commands.setContent(doc, false);
      
      // Restore scroll position
      if (prevScrollTop !== null && editorEl) {
        editorEl.scrollTop = prevScrollTop;
      }
    } catch (error) {
      console.error("Error streaming markdown text:", error);
      // If parsing fails (e.g., mid-syntax), insert the raw chunk as plain text so the user sees something.
      // This content will be replaced on the next successful parse.
      editor.chain().focus().insertContent(markdownChunk).run();
    } finally {
      if (isFinal) {
        // Clear the buffer when the stream is complete (prevents carry-over to the next use)
        streamBufferRef.current = "";
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
      </div>
    </div>
  );
};

export default Editor;
