import os
import json
from typing import Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
import httpx
from dotenv import load_dotenv

# Load API keys from the .env file
load_dotenv()

# Detect if a Groq API key is available and prepare a default model
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1")

# Set GOOGLE_API_KEY for litellm if GEMINI_API_KEY is present
if GEMINI_API_KEY:
    os.environ["GOOGLE_API_KEY"] = GEMINI_API_KEY

# Use Groq by default (more reliable), fall back to Gemini if configured
if GROQ_API_KEY:
    DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "llama-3.1-70b-versatile")
elif GEMINI_API_KEY:
    DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
else:
    DEFAULT_MODEL = "llama-3.1-70b-versatile"

# Startup logs for visibility
print(f"GROQ_API_KEY present: {bool(GROQ_API_KEY)}")
print(f"GEMINI_API_KEY present: {bool(GEMINI_API_KEY)}")
print(f"Default model set to: {DEFAULT_MODEL}")

app = FastAPI(title="AI IDE Copilot API")

app.add_middleware(
    CORSMiddleware,
    # IMPORTANT: For production, only allow specific origins.
    # For local development, add the origin where your frontend is running.
    # Example: if your frontend is on http://localhost:3000, add it here.
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Backend is running!"}

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    # Allow clients to optionally specify a model. If omitted, the server
    # will choose a default based on available API keys (Gemini or Groq).
    model: Optional[str] = None


class RunRequest(BaseModel):
    language: str
    code: str

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    messages_dict = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_generator():
        try:
            # Choose the model to use: request.model overrides server default
            model_to_use = request.model or DEFAULT_MODEL

            # Call Groq HTTP API for streaming chat completions.
            if not GROQ_API_KEY:
                raise RuntimeError("GROQ_API_KEY is not set in the environment")

            url = f"{GROQ_API_URL}/chat/completions"
            print(f"Groq streaming request -> host: {httpx.URL(url).host}, path: {httpx.URL(url).path}, model: {model_to_use}")
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            }

            payload = {"model": model_to_use, "messages": messages_dict, "stream": True}

            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        print(f"Groq streaming error {resp.status_code}: {body.decode(errors='ignore')}")
                        raise RuntimeError(f"Groq API error: {resp.status_code} {body.decode(errors='ignore')}")

                    # Iterate over server-sent-event lines
                    async for raw_line in resp.aiter_lines():
                        if not raw_line:
                            continue

                        line = raw_line.strip()

                        # Common SSE sentinel used by some providers
                        if line == "[DONE]":
                            break

                        # Lines may be prefixed with 'data:'
                        if line.startswith("data:"):
                            content = line[5:].strip()
                        else:
                            content = line

                        if not content:
                            continue

                        try:
                            data = json.loads(content)
                        except Exception:
                            # If the service sends plain text, forward it as a message
                            yield json.dumps({"type": "message", "delta": content})
                            continue

                        # Try to extract delta/choices similar to OpenAI-like shapes
                        if isinstance(data, dict) and data.get("choices"):
                            choice = data["choices"][0]
                            delta = choice.get("delta", {})
                            content_delta = ""
                            reasoning_content = ""
                            if isinstance(delta, dict):
                                content_delta = delta.get("content", "") or ""
                                reasoning_content = delta.get("reasoning_content", "") or ""

                            if reasoning_content:
                                yield json.dumps({"type": "thinking", "delta": reasoning_content})
                            elif content_delta:
                                # handle <think> markers if present
                                if "<think>" in content_delta:
                                    is_thinking = True
                                    content_delta = content_delta.replace("<think>", "")
                                if "</think>" in content_delta:
                                    is_thinking = False
                                    content_delta = content_delta.replace("</think>", "")
                                    yield json.dumps({"type": "thinking", "delta": "\n"})

                                # Default to sending message deltas
                                yield json.dumps({"type": "message", "delta": content_delta})
                        else:
                            # If server sends well-formed control messages (type/delta), forward them
                            if isinstance(data, dict) and data.get("type"):
                                yield json.dumps(data)
                            else:
                                # fallback: try common text fields
                                text = data.get("text") or data.get("content") or data.get("output")
                                if text:
                                    yield json.dumps({"type": "message", "delta": text})

        except Exception as e:
            print(f"Error: {str(e)}") # Log to backend terminal
            yield json.dumps({"type": "error", "delta": str(e)})
            
        yield json.dumps({"type": "done", "delta": ""})

    return EventSourceResponse(event_generator())

@app.post("/api/chat")
async def chat_standard(request: ChatRequest):
    """A simpler, non-streaming endpoint for standard chat requests."""
    messages_dict = [{"role": m.role, "content": m.content} for m in request.messages]
    
    try:
        model_to_use = request.model or DEFAULT_MODEL

        if not GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is not set in the environment")

        url = f"{GROQ_API_URL}/chat/completions"
        print(f"Groq non-stream request -> host: {httpx.URL(url).host}, path: {httpx.URL(url).path}, model: {model_to_use}")
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

        payload = {"model": model_to_use, "messages": messages_dict, "stream": False}

        async with httpx.AsyncClient() as client:
            resp = await client.post(url, headers=headers, json=payload, timeout=60)
            if resp.status_code >= 400:
                body = await resp.aread()
                print(f"Groq non-stream error {resp.status_code}: {body.decode(errors='ignore')}")
                return {"error": f"Groq API error: {resp.status_code} {body.decode(errors='ignore')}"}

            data = resp.json()

        # Try to extract best-effort assistant content from common shapes
        content = None
        if isinstance(data, dict) and data.get("choices"):
            choice = data["choices"][0]
            # OpenAI-like shape
            content = (choice.get("message", {}) or {}).get("content") or choice.get("text") or (choice.get("delta", {}) or {}).get("content")

        if not content:
            content = data.get("output") or data.get("text") or json.dumps(data)

        return {"role": "assistant", "content": content}
    except Exception as e:
        return {"error": str(e)}


@app.post("/api/run")
async def run_code(request: RunRequest):
    piston_languages = {
        "javascript": {"language": "javascript", "version": "18.15.0"},
        "typescript": {"language": "typescript", "version": "5.0.3"},
        "python": {"language": "python", "version": "3.10.0"},
    }

    lang = piston_languages.get(request.language)
    if not lang:
        return {"output": f"❌ {request.language} cannot be executed directly."}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://emkc.org/api/v2/piston/execute",
                json={
                    "language": lang["language"],
                    "version": lang["version"],
                    "files": [{"content": request.code}],
                },
                timeout=30,
            )
            resp.raise_for_status()
            result = resp.json()

        run = result.get("run", {})
        output = run.get("stdout") or run.get("stderr") or "No output."
        return {"output": output, "status": "OK" if not run.get("stderr") else "Error"}
    except Exception as e:
        return {"output": f"❌ {str(e)}", "status": "Error"}