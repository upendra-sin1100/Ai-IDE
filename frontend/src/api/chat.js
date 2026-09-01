import { getAuthHeaders, getBaseUrl } from "./client";

export async function streamChat(
  messages,
  model = null,
  provider = "gemini",
  openFiles = [],
  activeFile = null,
  onChunk,
  onError,
  onDone
) {
  const url = `${getBaseUrl()}/chat/stream`;

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages,
        model,
        provider,
        open_files: openFiles,
        active_file: activeFile,
      }),
    });

    if (!response.ok) {
      throw new Error(`Chat HTTP Error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const dataLine = line.split("\n").find((l) => l.startsWith("data:"));
        if (!dataLine) continue;

        const dataStr = dataLine.slice(5).trim();
        if (!dataStr) continue;

        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === "error") {
            if (onError) onError(parsed.delta);
          } else if (parsed.type === "done") {
            if (onDone) onDone();
          } else {
            if (onChunk) onChunk(parsed);
          }
        } catch {
          // ignore malformed SSE chunks
        }
      }
    }

    if (onDone) onDone();
  } catch (err) {
    if (onError) onError(err.message || String(err));
  }
}
