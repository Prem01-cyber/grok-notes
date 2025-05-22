import React, { useState, useRef, useEffect } from 'react'

const PDFUpload = ({ editor, position, onClose, theme, ref }) => {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile)
      if (!title) {
        setTitle(selectedFile.name)
      }
    } else {
      alert('Please select a PDF file')
    }
  }

  const handleUpload = async () => {
    if (!file || !editor) return

    setUploading(true)
    try {
      // Simulate upload by creating a URL for the local file
      // In a real application, you would upload to a server or cloud storage
      const url = URL.createObjectURL(file)
      editor.chain().focus().setPDF({ src: url, title: title || file.name }).run()
      onClose()
    } catch (error) {
      console.error('PDF upload failed:', error)
      alert('Failed to upload PDF. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 50,
      }}
      className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} border-${theme === 'dark' ? 'gray-700' : 'gray-200'} border rounded-lg shadow-lg p-3 backdrop-blur-sm min-w-[300px]`}
    >
      <div className="mb-2 flex justify-between items-center">
        <h3 className={`text-base font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Upload PDF</h3>
        <button
          onClick={onClose}
          className={`p-1 rounded-full ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-500'} transition-colors`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mb-2">
        <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>PDF File</label>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className={`w-full text-sm border rounded p-2 ${theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
        />
        {file && <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Selected: {file.name}</p>}
      </div>
      <div className="mb-3">
        <label className={`block text-sm font-medium mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Title (optional)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="PDF Title"
          className={`w-full text-sm border rounded p-2 ${theme === 'dark' ? 'bg-gray-700 text-white border-gray-600' : 'bg-white border-gray-300'}`}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className={`px-3 py-1 text-sm rounded ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'} transition-colors`}
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className={`px-3 py-1 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors ${!file || uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

export default PDFUpload
