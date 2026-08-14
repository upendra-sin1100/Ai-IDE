# AI IDE Frontend - Complete Guide

A modern, AI-powered integrated development environment built with React + Vite and Tailwind CSS.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:5173` and connect to the backend API at `http://localhost:8000/api`.

### Build for Production

```bash
npm run build
npm run preview
```

## ✨ Features

### 📝 Code Editor
- **Monaco Editor Integration** - Full-featured code editor with syntax highlighting
- **Multi-tab Support** - Open multiple files, switch between them easily
- **Inline Completion** - AI-powered code suggestions (with backend support)
- **Auto-save** - Automatic file saving with unsaved indicator
- **Keyboard Shortcuts** - Ctrl+S to save, Ctrl+A to select all, etc.

### 💬 AI Assistant
- **Smart Chat Interface** - Context-aware AI responses
- **Code Suggestions** - Ask AI to refactor, explain, test, or document code
- **Proposed Edits** - AI suggests changes with Accept/Reject controls
- **Quick Actions** - Pre-filled prompts for common tasks
  - ✨ Explain code
  - 🔧 Refactor for performance
  - 🧪 Generate unit tests
  - 📝 Add documentation

### 📁 File Management
- **File Explorer Tree** - Browse project files
- **Open Multiple Files** - Work with multiple files in tabs
- **File Status Indicator** - Visual indicator for unsaved changes
- **Quick Navigation** - Click to open, close tabs

### 💻 Terminal Integration
- **Integrated Terminal** - Run commands without leaving the IDE
- **Xterm.js** - Full terminal emulation
- **Toggle View** - Show/hide terminal as needed

### ⚙️ Settings & Preferences
- **API Key Management**
  - Gemini API key storage
  - Groq API key storage
- **Editor Preferences**
  - Word wrap toggle
  - Minimap toggle
- **Persistent Settings** - Settings saved to localStorage

### 🎨 User Interface
- **Dark Theme** - Easy on the eyes for long coding sessions
- **Responsive Layout** - Adapts to different screen sizes
- **Customizable Layout** - Toggle sidebar, terminal, and chat panels
- **Persistent UI State** - Your layout preferences are saved

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` or `Cmd+B` | Toggle Sidebar |
| `Ctrl+J` | Toggle Terminal |
| `Ctrl+Shift+I` | Toggle AI Chat |
| `Ctrl+,` | Open Settings |
| `Ctrl+S` | Save Current File |
| `Ctrl+Enter` | Send Chat Message |
| `Shift+Enter` | New Line in Chat |

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000/api
```

### API Configuration

The frontend connects to the backend at `/api`. Make sure the backend is running:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 🎯 Usage Guide

### Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Open in Browser**
   - Navigate to `http://localhost:5173`

### Setting Up API Keys

1. Click the **Settings** icon (⚙️) in the top-right
2. Enter your API keys:
   - **Gemini**: Get from [Google AI Studio](https://ai.google.dev)
   - **Groq**: Get from [Groq Console](https://console.groq.com)
3. Click **Save Settings**

### Using the AI Assistant

1. Open a file in the editor (it will appear in a tab)
2. Click the **AI Chat** icon (💬) or press `Ctrl+Shift+I`
3. Ask questions or request modifications:
   - "Explain this function"
   - "Refactor this code for performance"
   - "Write unit tests for this file"
4. Review proposed changes and click Accept/Reject

### File Management

- **Open Files**: Click files in the left sidebar
- **Switch Files**: Click tabs in the editor
- **Save**: Press `Ctrl+S` or click the Save button
- **Close**: Click the X on the tab

### Terminal Usage

- **Toggle**: Click the terminal icon or press `Ctrl+J`
- **Run Commands**: Type as you would in any terminal
- **Clear**: Type `clear` or `cls`

## 🚀 Development

### Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Technologies

- **React 19** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Monaco Editor** - Code editor
- **Xterm.js** - Terminal emulation
- **Lucide React** - Icons
- **React Markdown** - Markdown rendering

## 🤝 Integration with Backend

The frontend communicates with the FastAPI backend using REST APIs:

### Chat Endpoints
- `POST /api/chat` - Standard chat
- `POST /api/chat/stream` - Streaming chat responses

### Edit Endpoints
- `POST /api/edit` - Proposed code edits

### Completion Endpoints
- `POST /api/complete` - Inline code completion

### Workspace Endpoints
- `GET /api/workspace/files` - List files
- `GET /api/workspace/files/{path}` - Read file
- `POST /api/workspace/files/{path}` - Write file
- `DELETE /api/workspace/files/{path}` - Delete file

### Terminal Endpoints
- `POST /api/terminal/execute` - Execute command
- `GET /api/terminal/output` - Get terminal output

### Models Endpoints
- `GET /api/models` - List available models

## 📦 Dependencies

### Main Dependencies
- **react** (^19.2.6) - UI framework
- **react-dom** (^19.2.6) - React DOM rendering
- **@monaco-editor/react** (^4.7.0) - Code editor
- **@xterm/xterm** (^5.5.0) - Terminal emulation
- **lucide-react** (^1.16.0) - Icon library
- **react-markdown** (^10.1.0) - Markdown parsing
- **tailwindcss** (^4.3.3) - CSS framework

### Dev Dependencies
- **vite** (^8.0.12) - Build tool
- **eslint** (^10.3.0) - Code linter
- **@vitejs/plugin-react** (^6.0.1) - Vite React plugin

## 🐛 Troubleshooting

### Backend Connection Failed
- Ensure backend is running: `uvicorn app.main:app --reload`
- Check `VITE_API_URL` environment variable
- Verify backend CORS settings allow frontend origin

### API Key Errors
- Settings can be accessed via the ⚙️ icon
- Keys are stored in browser localStorage
- Clear browser data to reset (Settings > Storage > Clear)

### Component Not Rendering
- Check browser console for errors
- Verify all imports are correct
- Ensure all components are exported properly

### Styling Issues
- Clear browser cache (Ctrl+Shift+Del)
- Rebuild with `npm run build`
- Check Tailwind CSS is properly configured

## 📝 Recent Improvements

### Layout & Navigation ✅
- New Navbar with better organization
- Tabbed sidebar (Files/Settings)
- Improved branding and spacing

### Settings & Configuration ✅
- New Settings panel for API keys
- Editor preferences (word wrap, minimap)
- Persistent settings via localStorage

### Chat Experience ✅
- Enhanced ChatPanel with quick actions
- Empty state with guidance
- Dynamic textarea expansion
- Better visual hierarchy

### State Management ✅
- UI state persistence
- Chat history preservation
- Settings saved across sessions

### Styling & UX ✅
- Consistent dark theme
- Improved spacing and hierarchy
- Better feedback and transitions
- Better error messages

See [IMPROVEMENTS.md](./IMPROVEMENTS.md) for detailed information.

## 📝 License

Part of the AI IDE project.

## 🔗 Related

- [Backend Documentation](../backend/README.md)
- [API Documentation](../backend/README.md#api)
- [Project README](../README.md)
