import React, { useRef, useState } from "react";

const VideoUpload = ({ editor, position, onClose, theme }) => {
  const fileInputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const acceptedTypes = ["video/mp4", "video/webm", "video/ogg"];
    if (!acceptedTypes.includes(file.type)) {
      setError("Please upload a video file (MP4, WebM, OGG).");
      return;
    }

    // Validate file size (limit to 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setError("Video size must be less than 10MB.");
      return;
    }

    // Read file as data URL for preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
      setError("");
    };
    reader.onerror = () => {
      setError("Error reading the file.");
    };
    reader.readAsDataURL(file);
  };

  const handleInsert = () => {
    if (preview) {
      // Insert both the video and a following paragraph in a single operation
      editor.chain().focus().insertContent([
        {
          type: 'video',
          attrs: {
            src: preview,
            alt: "Uploaded video"
          }
        },
        {
          type: 'paragraph'
        }
      ]).run();
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
        <h3 className="text-lg font-medium">Upload Video</h3>
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current.click()}
        className="w-full text-left px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mb-2"
      >
        <span className="font-medium text-blue-600 dark:text-blue-400">Choose a video</span>
        <span className="text-gray-500 dark:text-gray-400 block">Supports MP4, WebM, OGG (max 10MB)</span>
      </button>

      {error && (
        <div className="text-red-500 dark:text-red-400 text-sm mb-2">{error}</div>
      )}

      {preview && (
        <div className="mb-3">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Preview:</div>
          <video
            src={preview}
            controls
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
          Insert Video
        </button>
      </div>
    </div>
  );
};

export default VideoUpload;
