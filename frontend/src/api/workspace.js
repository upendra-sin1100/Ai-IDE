import { requestJson } from "./client";

export async function getTree(path = "") {
  return requestJson(`/workspace/tree?path=${encodeURIComponent(path)}`);
}

export async function readFile(path) {
  return requestJson(`/workspace/file?path=${encodeURIComponent(path)}`);
}

export async function writeFile(path, content) {
  return requestJson("/workspace/file", {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });
}

export async function createFile(path, isDir = false) {
  return requestJson("/workspace/file", {
    method: "POST",
    body: JSON.stringify({ path, is_dir: isDir }),
  });
}

export async function deleteFile(path) {
  return requestJson(`/workspace/file?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });
}

export async function renameFile(oldPath, newPath) {
  return requestJson("/workspace/rename", {
    method: "POST",
    body: JSON.stringify({ old_path: oldPath, new_path: newPath }),
  });
}
