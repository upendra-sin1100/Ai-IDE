import os
import json
import subprocess
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

# --- Multi-Model Configuration ---
# 120b parameter model for reasoning and thinking (e.g. goliath-120b, gpt-oss-120b)
THINKING_MODEL = os.getenv("THINKING_MODEL", "gpt-oss-120b") 
# Gemini model for coding and execution
CODING_MODEL = os.getenv("CODING_MODEL", "gemini-1.5-pro")

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


class TerminalRequest(BaseModel):
    command: str

# --- IDE Control Schemas ---
class FileWriteRequest(BaseModel):
    filepath: str
    content: str

class FileReadRequest(BaseModel):
    filepath: str

# --- IDE Control Endpoints (Giving AI Workspace Access) ---
WORKSPACE_DIR = os.getenv("WORKSPACE_DIR", os.getcwd())

@app.post("/api/ide/write")
async def write_file(request: FileWriteRequest):
    """Allows the AI/IDE to write directly to the filesystem."""
    target_path = os.path.abspath(os.path.join(WORKSPACE_DIR, request.filepath))
    if not target_path.startswith(os.path.abspath(WORKSPACE_DIR)):
        return {"error": "Unauthorized path access."}
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(request.content)
    return {"status": "success", "message": f"Wrote to {request.filepath}"}

@app.post("/api/ide/read")
async def read_file(request: FileReadRequest):
    """Allows the AI/IDE to read from the filesystem."""
    target_path = os.path.abspath(os.path.join(WORKSPACE_DIR, request.filepath))
    if not target_path.startswith(os.path.abspath(WORKSPACE_DIR)) or not os.path.exists(target_path):
        return {"error": "File not found or unauthorized."}
    with open(target_path, "r", encoding="utf-8") as f:
        return {"status": "success", "content": f.read()}

# --- Multi-Model Agentic Stream ---
@app.post("/api/agent/stream")
async def agent_stream(request: ChatRequest):
    """Multi-model endpoint: Thinks with GPT-OSS-120b, Executes with Gemini."""
    messages_dict = [{"role": m.role, "content": m.content} for m in request.messages]

    async def event_generator():
        thought_process = ""
        try:
            # STEP 1: THINKING PHASE (GPT-OSS-120B / Groq)
            if GROQ_API_KEY:
                yield json.dumps({"type": "message", "delta": "\n\n🧠 **Thinking Process (GPT-OSS-120b):**\n"})
                url = f"{GROQ_API_URL}/chat/completions"
                headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json", "Accept": "text/event-stream"}
                thinking_messages = [{"role": "system", "content": "You are an AI architect. Plan the solution step-by-step. Do not write the final code."}] + messages_dict
                payload = {"model": THINKING_MODEL, "messages": thinking_messages, "stream": True}
                
                async with httpx.AsyncClient(timeout=None) as client:
                    async with client.stream("POST", url, headers=headers, json=payload) as resp:
                        if resp.status_code < 400:
                            async for raw_line in resp.aiter_lines():
                                if raw_line.startswith("data:"):
                                    content = raw_line[5:].strip()
                                    if content and content != "[DONE]":
                                        try:
                                            data = json.loads(content)
                                            delta = data["choices"][0]["delta"].get("content", "")
                                            thought_process += delta
                                            yield json.dumps({"type": "thinking", "delta": delta})
                                        except Exception:
                                            pass
                yield json.dumps({"type": "message", "delta": "\n\n💻 **Executing (Gemini API):**\n"})
            
            # STEP 2: EXECUTION PHASE (Gemini)
            if not GEMINI_API_KEY:
                yield json.dumps({"type": "error", "delta": "GEMINI_API_KEY is not set for execution phase."})
                return

            gemini_messages = [{"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]} for m in messages_dict]
            if thought_process:
                gemini_messages[-1]["parts"][0]["text"] += f"\n\n[Follow this architectural plan strictly]:\n{thought_process}"

            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{CODING_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"
            gemini_payload = {
                "system_instruction": {"parts": [{"text": "You are an autonomous IDE agent. Output any file changes or commands explicitly based on the architectural plan."}]},
                "contents": gemini_messages
            }

            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", gemini_url, json=gemini_payload) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        yield json.dumps({"type": "error", "delta": f"Gemini Error: {body.decode(errors='ignore')}"})
                        return
                        
                    async for raw_line in resp.aiter_lines():
                        if raw_line.startswith("data:"):
                            content = raw_line[5:].strip()
                            if content:
                                try:
                                    data = json.loads(content)
                                    if "candidates" in data and data["candidates"] and "content" in data["candidates"][0]:
                                        text_delta = data["candidates"][0]["content"]["parts"][0].get("text", "")
                                        yield json.dumps({"type": "message", "delta": text_delta})
                                except Exception:
                                    pass

        except Exception as e:
            yield json.dumps({"type": "error", "delta": str(e)})
            
        yield json.dumps({"type": "done", "delta": ""})

    return EventSourceResponse(event_generator())

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
    import tempfile, os

    lang = request.language.lower()
    code = request.code

    try:
        if lang == "python":
            with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as f:
                f.write(code)
                tmp = f.name
            result = subprocess.run(["python", tmp], capture_output=True, text=True, timeout=15, cwd=tempfile.gettempdir())
            os.unlink(tmp)

        elif lang in ("javascript", "typescript"):
            with tempfile.NamedTemporaryFile(suffix=".js", mode="w", delete=False, encoding="utf-8") as f:
                # strip ES module syntax node can't run directly
                cleaned = code.replace("export default ", "// ").replace("export ", "// ")
                f.write(cleaned)
                tmp = f.name
            result = subprocess.run(["node", tmp], capture_output=True, text=True, timeout=15, cwd=tempfile.gettempdir())
            os.unlink(tmp)

        else:
            return {"output": f"❌ {lang} not supported.", "status": "Error"}

        output = (result.stdout or "") + (result.stderr or "") or "(no output)"
        status = "OK" if result.returncode == 0 else "Error"
        return {"output": output.strip(), "status": status}

    except subprocess.TimeoutExpired:
        return {"output": "❌ Timed out after 15 seconds.", "status": "Error"}
    except FileNotFoundError as e:
        return {"output": f"❌ Runtime not found: {e}", "status": "Error"}
    except Exception as e:
        return {"output": f"❌ {str(e)}", "status": "Error"}


@app.post("/api/terminal/execute")
async def execute_terminal_command(request: TerminalRequest):
    command = request.command.strip()
    if not command:
        return {"output": "", "status": "Error", "error": "Command is required."}

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=WORKSPACE_DIR,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = (result.stdout or "") + (result.stderr or "")
        if not output.strip():
            output = "(no output)"
        status = "OK" if result.returncode == 0 else "Error"
        return {"output": output, "status": status, "returncode": result.returncode}
    except subprocess.TimeoutExpired:
        return {"output": "❌ Command timed out after 30 seconds.", "status": "Error"}
    except Exception as e:
        return {"output": f"❌ {str(e)}", "status": "Error"}