# AI IDE (Frontend + Backend)

Lightweight AI-assisted IDE with a React + Vite frontend and a FastAPI backend.

## Repository Structure

- `backend/` — FastAPI server and AI integration.
- `frontend/` — React + Vite UI.

## Requirements

- Python 3.10+
- Node.js 18+

## Backend - Quickstart

1. Create and activate a virtual environment:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
# or: source .venv/bin/activate  # macOS / Linux
```

2. Install Python dependencies and run the server:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

3. Environment variables

- Copy or create a `.env` in `backend/` and set keys as needed, for example:

```
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
WORKSPACE_DIR=..\   # optional, default is repo root
```

- The original single-file backend is preserved as `backend/main_old.py` during the migration.

## Frontend - Quickstart

```bash
cd frontend
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Notes

- The backend exposes several endpoints used by the frontend, including streaming chat and IDE file read/write APIs.
- For local development, ensure CORS origins in `backend/.env` include your frontend origin (default: `http://localhost:5173`).
- The frontend reads its API base URL from `VITE_API_URL` in `frontend/.env`.

If you'd like, I can also update the `README.md` to include architecture diagrams, API examples, or env var templates.
