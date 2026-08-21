import pytest
from fastapi.testclient import TestClient

from app.main import create_app


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


def test_list_models_endpoint(client):
    response = client.get("/api/models")
    assert response.status_code == 200
    data = response.json()
    assert "default_provider" in data
    assert "default_model" in data
    assert "models" in data
    assert data["default_model"] == "gemini-3.6-flash"
    model_ids = [m["id"] for m in data["models"]]
    assert "gemini-3.6-flash" in model_ids
    assert "gemini-3.7-flash" in model_ids


def test_run_code_python(client):
    payload = {"language": "python", "code": "print('Hello Python')"}
    response = client.post("/api/run", json=payload)
    assert response.status_code == 200
    assert "Hello Python" in response.json()["output"]


def test_run_code_javascript(client):
    payload = {"language": "javascript", "code": "console.log('Hello JS')"}
    response = client.post("/api/run", json=payload)
    assert response.status_code == 200
    assert "Hello JS" in response.json()["output"]


def test_run_code_java(client):
    payload = {
        "language": "java",
        "code": "public class Main { public static void main(String[] args) { System.out.println(\"Hello Java\"); } }"
    }
    response = client.post("/api/run", json=payload)
    assert response.status_code == 200
    out = response.json()["output"]
    assert "Hello Java" in out or "Missing compiler/runtime" in out or "Execution Error" in out



def test_workspace_tree_endpoint(client):
    response = client.get("/api/workspace/tree")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_terminal_run_ws_python(client):
    with client.websocket_connect("/api/terminal/run_ws") as websocket:
        websocket.send_json({"language": "python", "code": "print('WS Execution Output')", "fileName": "test.py"})
        initial = websocket.receive_text()
        assert "Executing" in initial
        output = websocket.receive_text()
        assert "WS Execution Output" in output


