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


def test_legacy_run_code_python(client):
    payload = {"language": "python", "code": "print('Hello from test_api_endpoints')"}
    response = client.post("/api/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert "Hello from test_api_endpoints" in data["output"]


def test_legacy_terminal_execute(client):
    payload = {"command": "echo hello_terminal"}
    response = client.post("/api/terminal/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OK"
    assert "hello_terminal" in data["output"]


def test_workspace_tree_endpoint(client):
    response = client.get("/api/workspace/tree")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
