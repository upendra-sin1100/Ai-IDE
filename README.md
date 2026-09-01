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

## Authentication

This project uses **Supabase** for authentication with support for Email/Password and Google OAuth.

### Setup Instructions

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Note your Supabase URL and Anon/Publishable Key

2. **Configure Supabase Auth Providers**
   - In your Supabase project dashboard, enable "Email/Password" provider
   - For Google OAuth:
     - Enable Google provider in Supabase dashboard
     - Add your Google OAuth credentials (Client ID)
     - Configure redirect URLs: `http://localhost:5173`, `http://localhost:3000`, and your production URL

3. **Set Environment Variables**

   **Frontend** (`frontend/.env`):
   ```
   VITE_API_URL=http://localhost:8000/api
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   ```

   **Backend** (`backend/.env`):
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_publishable_key
   ```

4. **Run the Application**
   - Start the backend: `cd backend && uvicorn app.main:app --reload`
   - Start the frontend: `cd frontend && npm run dev`
   - Navigate to `http://localhost:5173` and sign up or log in

### Authentication Flow

- Users sign up/log in via the Auth screen
- Frontend authenticates with Supabase and obtains a session token
- Backend validates bearer tokens on protected routes
- The IDE is accessible only to authenticated users

### Security Notes

- Never commit `.env` files to version control
- Only the **Publishable/Anon Key** should be exposed to the frontend
- The **Service Role Key** must remain server-side only
- All API requests from the frontend include a bearer token in the Authorization header

## Notes

- The backend exposes several endpoints used by the frontend, including streaming chat and IDE file read/write APIs.
- For local development, ensure CORS origins in `backend/.env` include your frontend origin (default: `http://localhost:5173`).
- Protected API routes validate the Supabase bearer token before processing requests.
