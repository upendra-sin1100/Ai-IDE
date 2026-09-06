# AI IDE

Lightweight, secure, AI-assisted IDE with a React + Vite frontend and a FastAPI backend. Designed for local development and simple deployment to cloud/VM hosting. Includes code execution in sandboxed containers and Supabase-based authentication.

Badges
- CI / build: TODO
- License: MIT (example)

Table of contents
- [Features](#features)
- [Repository structure](#repository-structure)
- [Requirements](#requirements)
- [Local development](#local-development)
  - [Backend quickstart](#backend-quickstart)
  - [Frontend quickstart](#frontend-quickstart)
- [Environment variables](#environment-variables)
  - [Backend (.env)](#backend-env)
  - [Frontend (.env)](#frontend-env)
- [Authentication](#authentication)
- [Deployment](#deployment)
- [Security notes](#security-notes)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [License & contact](#license--contact)

## Features
- Web-based IDE UI (React + Vite)
- FastAPI backend with streaming chat and file APIs
- Supabase authentication (Email/Password + Google OAuth)
- Safe code execution inside sandboxed Docker containers with strict resource limits
- Intended for local dev and simple VM hosting (example EC2 setup documented)

## Repository structure
- `backend/` — FastAPI server, API routes, AI integration
- `frontend/` — React + Vite application
- `backend/main_old.py` — preserved original single-file backend from migration

## Requirements
- Python 3.10+
- Node.js 18+
- Docker (for running language sandboxes during execution/testing)

## Local development

### Backend quickstart
1. Create and activate a virtual environment
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

2. Install dependencies and run the server
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

3. Open the API docs: http://127.0.0.1:8000/docs

### Frontend quickstart
```bash
cd frontend
npm install
npm run dev
```
Open the UI at the server URL (default Vite: http://localhost:5173).

Build for production:
```bash
npm run build
npm run preview
```

## Environment variables

Create `.env` files in `backend/` and `frontend/` (do not commit them).

Backend (.env) — examples
```
SUPABASE_URL=https://your-supabase-url
SUPABASE_ANON_KEY=your_publishable_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # server-only
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
WORKSPACE_DIR=..                                  # optional, default repo root
CORS_ORIGINS=http://localhost:5173
```

Frontend (`frontend/.env`) — examples
```
VITE_API_URL=http://localhost:8000/api
VITE_SUPABASE_URL=https://your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_anon_key
```

Notes:
- Never commit secret keys to the repository.
- Only place publishable/anon keys in frontend env; service role keys must remain backend-only.

## Authentication

This project uses Supabase Authentication:

Setup steps
1. Create a Supabase project and note the project URL + anon/publishable key.
2. Enable providers you need:
   - Email/Password
   - Google OAuth: add Google Client ID and configure redirect URLs (local + production)
   - Example redirect URLs: `http://localhost:5173`, `http://localhost:3000`, `https://your-production-url`
3. Configure frontend and backend `.env` variables (see above).

Authentication flow
- Users sign up or log in through the frontend (Supabase client).
- Frontend sends a bearer token to the backend for protected endpoints.
- Backend verifies tokens (JWKS / ES256 as configured).

## Deployment

Architecture (one example)
- Frontend: React + Vite, deployed to Vercel (example: https://ai-ide-upendra.vercel.app)
- Backend: FastAPI hosted on an Ubuntu VM (example: AWS EC2 t3.micro)
- Domain: example `ai-ide.duckdns.org` with Let's Encrypt TLS via Certbot and Nginx reverse proxy
- Auth: Supabase (verify tokens server-side)
- Execution: Docker sandboxes (no network, read-only root, dropped capabilities)

Example backend systemd service management
```bash
# SSH into host
ssh -i "ai-ide-key.pem" ubuntu@<EC2_PUBLIC_IP>

# Service management
sudo systemctl status ai-ide
sudo systemctl restart ai-ide
sudo journalctl -u ai-ide -f   # follow logs
```
Service file path: `/etc/systemd/system/ai-ide.service`

Deploying backend changes (example)
```bash
# Locally
git add .
git commit -m "your message"
git push

# On the VM
cd ~/Ai-IDE
git pull
sudo systemctl restart ai-ide
```

TLS / domain notes
- Use Certbot to obtain LetsEncrypt certs and configure cron/systemd timers for renewals.
- Confirm certificates periodically:
```bash
sudo certbot certificates
```

## Security notes
- Do not commit `.env` or private keys.
- Frontend may hold only publishable/anon keys.
- Keep service role keys and any admin API keys server-side only.
- Sandboxed execution containers:
  - run with --cap-drop ALL
  - --network none
  - --read-only root filesystem
  - CPU/memory/PID limits applied
- Validate and sanitize user inputs wherever possible; never run untrusted code without sandbox limits.

## Known limitations
- Example VM (t3.micro, 1GB RAM) may struggle under concurrent executions, especially for JVM or large container workloads.
- No CI/CD configured — currently manual deploys (`git pull` + service restart).
- If you plan higher concurrency, consider larger instance types or managed container services.

## Troubleshooting
- Backend 500s: check `journalctl -u ai-ide -f` on the host or the uvicorn logs locally.
- Supabase auth failures: verify redirect URLs and keys match the environment.
- Container execution issues: ensure Docker is running, and image-building completes without errors.

## Contributing
- Open issues describing bugs or feature requests.
- For code changes, fork, create a branch, and open a PR with a clear description of the change.
- Add tests for critical backend logic when possible.

## License & contact
- License: MIT (replace with your chosen license)
- Contact / support: upendra-sin1100 (GitHub)
