import React, { useState } from 'react';

const GrokPrompt = ({ onSubmit, isGenerating, position, onClose }) => {
  const [promptInput, setPromptInput] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
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
        onClick={() => onSubmit({ preventDefault: () => {}, target: { value: promptInput } })}
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
  );
};

export default GrokPrompt; 