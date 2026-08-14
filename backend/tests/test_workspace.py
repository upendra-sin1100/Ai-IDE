import pytest
from fastapi import HTTPException
from app.core.config import Settings
from app.services.workspace_service import WorkspaceService


def test_workspace_path_traversal_protection(tmp_path):
    settings = Settings(workspace_dir=str(tmp_path))
    service = WorkspaceService(settings)

    # Valid file creation inside root
    file_node = service.create_file_or_dir("test.txt", is_dir=False)
    assert file_node.name == "test.txt"

    # Attempt path traversal
    with pytest.raises(HTTPException) as exc_info:
        service.read_file("../../outside.txt")
    assert exc_info.value.status_code == 403
    assert "escapes workspace root" in exc_info.value.detail


def test_workspace_file_operations(tmp_path):
    settings = Settings(workspace_dir=str(tmp_path))
    service = WorkspaceService(settings)

    # Write file
    written = service.write_file("src/hello.py", "print('hello')")
    assert written.path == "src/hello.py"

    # Read file
    content = service.read_file("src/hello.py")
    assert content.content == "print('hello')"

    # Tree
    tree = service.get_tree()
    assert len(tree) == 1
    assert tree[0].name == "src"
    assert tree[0].is_dir is True

    # Rename
    service.rename_file_or_dir("src/hello.py", "src/world.py")
    assert service.read_file("src/world.py").content == "print('hello')"

    # Delete
    service.delete_file_or_dir("src/world.py")
    with pytest.raises(HTTPException):
        service.read_file("src/world.py")
