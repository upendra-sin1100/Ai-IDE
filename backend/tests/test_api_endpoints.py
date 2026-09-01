import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.api.routes.chat import format_open_files_context, parse_and_validate_create_file_actions
from app.schemas.chat import OpenFile
from app.services.workspace_service import WorkspaceService
from app.core.config import Settings


@pytest.fixture
def client():
    app = create_app()
    return TestClient(app)


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["docs"] == "/docs"


def test_auth_login_and_protected_access(client):
    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["token"]
    assert token

    protected = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert protected.status_code == 200
    assert protected.json()["user"]["id"] == "local-user"

    denied = client.get("/api/auth/me")
    assert denied.status_code == 401


def test_supabase_requires_valid_bearer_token(client):
    missing = client.get("/api/auth/me")
    assert missing.status_code == 401

    invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-valid-token"})
    assert invalid.status_code == 401


def test_list_models_endpoint(client):
    response = client.get("/api/models", headers={"Authorization": "Bearer dev-local-token"})
    assert response.status_code == 200
    data = response.json()
    assert "default_provider" in data
    assert "default_model" in data
    assert "models" in data
    assert data["default_model"] == "gemini-3.6-flash"
    model_ids = [m["id"] for m in data["models"]]
    assert "gemini-3.6-flash" in model_ids


def test_run_code_auto_detection_py(client):
    payload = {"fileName": "factorial.py", "code": "print('Hello Auto Python')"}
    response = client.post("/api/run", json=payload)
    assert response.status_code == 200
    assert "Hello Auto Python" in response.json()["output"]


def test_run_code_unsupported_extension(client):
    payload = {"fileName": "test.unknown", "code": "something"}
    response = client.post("/api/run", json=payload)
    assert response.status_code == 400
    assert "Unsupported file extension" in response.json()["detail"]


def test_terminal_run_ws_auto_detection_py(client):
    with client.websocket_connect("/api/terminal/run_ws") as websocket:
        websocket.send_json({"code": "print('WS Auto Python')", "fileName": "factorial.py"})
        initial = websocket.receive_text()
        assert "Executing factorial.py (Python)" in initial
        output = websocket.receive_text()
        assert "WS Auto Python" in output


def test_terminal_run_ws_auto_detection_js(client):
    with client.websocket_connect("/api/terminal/run_ws") as websocket:
        websocket.send_json({"code": "console.log('WS Auto JS')", "fileName": "test.js"})
        initial = websocket.receive_text()
        assert "Executing test.js (Node.js)" in initial
        output = websocket.receive_text()
        assert "WS Auto JS" in output


def test_terminal_run_ws_auto_detection_ts(client):
    with client.websocket_connect("/api/terminal/run_ws") as websocket:
        websocket.send_json({"code": "console.log('WS Auto TS')", "fileName": "test.ts"})
        initial = websocket.receive_text()
        assert "Executing test.ts (TypeScript)" in initial


def test_terminal_run_ws_unsupported_ext(client):
    with client.websocket_connect("/api/terminal/run_ws") as websocket:
        websocket.send_json({"code": "some code", "fileName": "test.invalid_ext"})
        output = websocket.receive_text()
        assert "Error: Unsupported file extension" in output


def test_format_open_files_context_budget_truncation():
    active_file = OpenFile(path="src/App.jsx", content="const app = 1;")
    large_file = OpenFile(path="src/Huge.jsx", content="X" * 20000)
    small_file = OpenFile(path="src/Small.jsx", content="const small = 2;")

    open_files = [active_file, large_file, small_file]
    ctx = format_open_files_context(open_files, active_file_path="src/App.jsx", max_budget_chars=500)

    # Active file must be preserved
    assert "--- FILE: src/App.jsx ---" in ctx
    assert "const app = 1;" in ctx
    # Small file should fit in budget and be kept
    assert "--- FILE: src/Small.jsx ---" in ctx
    # Large file should be dropped due to budget constraint
    assert "--- FILE: src/Huge.jsx ---" not in ctx


def test_create_file_path_traversal_rejection(tmp_path):
    ws_service = WorkspaceService(Settings(workspace_dir=str(tmp_path)))

    text = """
    I will create files for you.
    <CREATE_FILE>
    {
      "path": "../../outside.txt",
      "content": "malicious content"
    }
    </CREATE_FILE>
    <CREATE_FILE>
    {
      "path": "src/valid.js",
      "content": "valid content"
    }
    </CREATE_FILE>
    """

    actions = parse_and_validate_create_file_actions(text, ws_service)
    assert len(actions) == 1
    assert actions[0]["file_path"] == "src/valid.js"
