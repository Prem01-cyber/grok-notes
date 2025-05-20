# Grok-Notes v1.0

A full-stack note-taking application enhanced with AI capabilities for content generation and summarization. This project allows users to create, edit, and manage notes with the assistance of AI-powered features.

## Table of Contents
- [Grok-Notes v1.0](#grok-notes-v10)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Project Structure](#project-structure)
  - [Technologies Used](#technologies-used)
  - [Setup Instructions](#setup-instructions)
    - [Frontend Setup](#frontend-setup)
    - [Backend Setup](#backend-setup)
  - [Usage](#usage)
  - [Features](#features)
    - [Version 1.0 Features](#version-10-features)
  - [Contributing](#contributing)
  - [License](#license)

## Overview
Grok-Notes integrates a rich text editor with AI functionalities to enhance productivity. Users can write notes, request AI-generated content based on prompts, and summarize existing text. The application is built with a React frontend for the user interface and a Python backend for handling API requests and AI integrations.

## Project Structure
```
grok-notes/
├── backend/              # Python backend for API and AI services
│   ├── database.py       # Database setup and session management
│   ├── grok_utils.py     # Utilities for AI text generation and summarization
│   ├── models.py         # Data models for notes using SQLModel
│   ├── main.py           # Main entry point for the backend server
│   └── routes/           # API route definitions
├── frontend/             # React frontend for the user interface
│   ├── src/
│   │   ├── components/   # React components like Editor and Sidebar
│   │   ├── extensions/   # Custom extensions for the editor
│   │   ├── utils/        # Utility functions for editor content processing
│   │   ├── api.js        # API communication with the backend
│   │   └── App.jsx       # Main React application component
└── README.md             # Project documentation
```

## Technologies Used
- **Frontend**: 
  - React.js with Vite
  - TipTap (rich text editor)
  - Tailwind CSS for styling
  - Axios for API communication
  - Unified.js for markdown processing
- **Backend**: 
  - Python with FastAPI
  - SQLModel for ORM
  - Grok AI integration
- **Database**: SQLite
- **Development Tools**: 
  - ESLint for code quality
  - Prettier for code formatting
  - TypeScript for type safety

## Setup Instructions

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```
   cd frontend
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
   The frontend will run on `http://localhost:5173` (or a similar port as configured by Vite).

### Backend Setup
1. Navigate to the `backend` directory:
   ```
   cd backend
   ```
2. Install dependencies (assuming a virtual environment):
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```
3. Ensure the `.env` file is configured with necessary environment variables (e.g., database connection, AI API keys).
4. Start the backend server:
   ```
   uvicorn main:app --reload
   ```
   The backend will run on `http://localhost:8000`.

**Note**: Ensure both frontend and backend are running simultaneously to use the application fully.

## Usage
1. Open the frontend application in your browser (typically `http://localhost:5173`).
2. Use the editor interface to create or edit notes.
3. Press `Space` at the start of a line to prompt Grok for AI-generated content based on your input.
4. Save notes manually or rely on autosave functionality to persist changes.
5. View summaries or AI-enhanced content directly within the editor.

## Features
### Version 1.0 Features
- **Rich Text Editor**:
  - Full markdown support
  - Real-time content streaming
  - Syntax highlighting for code blocks
  - Typography and formatting options
  - Placeholder text support

- **AI Integration**:
  - Context-aware content generation
  - Streaming response support
  - Progress indicators for generation
  - Error handling and recovery

- **User Experience**:
  - Real-time autosave with status indicators
  - Responsive design for all screen sizes
  - Keyboard shortcuts for common actions
  - Smooth animations and transitions

- **Data Management**:
  - Automatic content persistence
  - JSON-based content storage
  - Efficient state management
  - Cursor position preservation

## Contributing
Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Make your changes and commit them with descriptive messages.
4. Push your changes to your fork.
5. Submit a pull request to the main repository.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
