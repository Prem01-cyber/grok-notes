import React, { useState } from "react";

const ImageEmbed = ({ editor, position, onClose, theme }) => {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUrlChange = (event) => {
    setUrl(event.target.value);
    setPreview(null);
    setError("");
  };

  const validateAndPreview = () => {
    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }

    try {
      new URL(url); // Validate URL format
      setLoading(true);
      setError("");

      // Attempt to load the image for preview
      const img = new Image();
      img.onload = () => {
        setPreview(url);
        setLoading(false);
      };
      img.onerror = () => {
        setError("Failed to load image from URL. Please check the link.");
        setLoading(false);
      };
      img.src = url;
    } catch (e) {
      setError("Invalid URL format.");
    }
  };

  const handleInsert = () => {
    if (preview) {
      editor.commands.insertContent({
        type: 'image',
        attrs: {
          src: preview,
          alt: "Embedded image"
        }
      });
      onClose();
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 50,
      }}
      className={`bg-white/95 border border-gray-200 rounded-xl shadow-lg p-3 backdrop-blur-sm min-w-[300px] max-w-[400px] ${
        theme === "dark" ? "bg-gray-800 border-gray-700 text-white" : "bg-white text-gray-800"
      }`}
    >
      <div className="mb-2">
        <h3 className="text-lg font-medium">Embed Image</h3>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="mb-2">
        <input
          type="text"
          value={url}
          onChange={handleUrlChange}
          placeholder="Paste image URL (e.g., https://example.com/image.jpg)"
          className={`w-full text-sm p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
            theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-200 text-gray-800"
          }`}
          autoFocus
        />
      </div>

      <button
        onClick={validateAndPreview}
        disabled={loading || !url.trim()}
        className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors mb-2 ${
          loading || !url.trim()
            ? "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {loading ? "Loading Preview..." : "Show Preview"}
      </button>

      {error && (
        <div className="text-red-500 dark:text-red-400 text-sm mb-2">{error}</div>
      )}

      {preview && (
        <div className="mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Preview:</div>
          <img
            src={preview}
            alt="Preview"
            style={{
              maxWidth: "100%",
              maxHeight: "200px",
              borderRadius: "4px",
              objectFit: "contain",
            }}
          />
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleInsert}
          disabled={!preview}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            preview
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
          }`}
        >
          Insert Image
        </button>
      </div>
    </div>
  );
};

export default ImageEmbed;
