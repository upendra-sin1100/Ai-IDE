import { requestJson } from "./client";

export async function requestProposedEdit(prompt, filePath = null, currentCode = null, model = null, provider = "gemini") {
  return requestJson("/edit", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      file_path: filePath,
      current_code: currentCode,
      model,
      provider,
    }),
  });
}
