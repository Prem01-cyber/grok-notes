import React from 'react';

export default function DeleteConfirmationModal({ isOpen, onClose, onConfirm, theme }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300 ease-in-out opacity-0"
         style={{ opacity: isOpen ? 1 : 0 }}>
      <div className={`p-6 rounded-lg shadow-lg max-w-sm w-full transform transition-transform duration-300 ease-in-out scale-95 ${theme === 'dark' ? 'bg-gray-700 text-white' : 'bg-white text-gray-800'}`}
           style={{ transform: isOpen ? 'scale(1)' : 'scale(0.95)' }}>
        <h3 className="text-lg font-semibold mb-4">Delete Note</h3>
        <p className={`mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-600'}`}>Are you sure you want to delete this note? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
