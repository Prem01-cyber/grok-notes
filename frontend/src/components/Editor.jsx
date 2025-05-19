import React, { useEffect, useRef, useState } from "react";
import { EditorContent } from "@tiptap/react";
import { streamGrokText, saveNote } from "../api";
import { marked } from "marked";
import { useEditorSetup } from "../hooks/useEditor";
import { decodeChunk, extractStructuredContext } from "../utils/editorUtils";
import GrokPrompt from "./GrokPrompt";

const Editor = ({ currentNote, onSave, ...props }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [title, setTitle] = useState(currentNote?.title || "");
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptPosition, setPromptPosition] = useState({ x: 0, y: 0 });
  const autosaveTimer = useRef(null);
  const editorRef = useRef(null);
  const streamBufferRef = useRef("");

  const editor = useEditorSetup(currentNote?.content_json, onSave);

  // Close prompt when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editorRef.current && !editorRef.current.contains(event.target)) {
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
      
      const x = coords.left - editorRect.left;
      const y = coords.top - editorRect.top;
      
      setPromptPosition({ x, y });
    };

    window.addEventListener('scroll', updatePosition, true);
    return () => window.removeEventListener('scroll', updatePosition, true);
  }, [showPrompt, editor]);

  const handleGrokSubmit = async (e) => {
    e.preventDefault();
    if (!e.target.value.trim() || !editor) return;

    setIsGenerating(true);

    const noteJSON = editor.getJSON();
    try {
      const response = await streamGrokText({
        text: e.target.value,
        note_title: title,
        note_context: extractStructuredContext(noteJSON),
      });

      if (!response) {
        throw new Error('No response received from streamGrokText');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Could not read error text');
        throw new Error(`Invalid response from streamGrokText: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Response has no readable stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullMarkdown = "";
      const startPos = editor.state.selection.from;
      let pos = startPos;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const decodedChunk = decodeChunk(chunk);
        fullMarkdown += decodedChunk;

        editor.commands.command(({ tr, dispatch }) => {
          tr.insertText(decodedChunk, pos);
          pos += decodedChunk.length;
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

      const htmlContent = marked.parse(fullMarkdown);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;

      const content = Array.from(tempDiv.childNodes).map(convertNodeToJSON);
      
      content.forEach(node => {
        if (node && (node.type === 'paragraph' || node.type === 'heading' || 
            node.type === 'bulletList' || node.type === 'orderedList' || 
            node.type === 'codeBlock')) {
          editor.commands.insertContent(node);
        }
      });
    } catch (error) {
      console.error('Error generating text:', error);
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
      setShowPrompt(false);
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
        </div>
        <EditorContent editor={editor} ref={editorRef} />
        
        {showPrompt && (
          <GrokPrompt
            onSubmit={handleGrokSubmit}
            isGenerating={isGenerating}
            position={promptPosition}
            onClose={() => setShowPrompt(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Editor;
