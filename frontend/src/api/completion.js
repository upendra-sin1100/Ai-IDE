import { requestJson } from "./client";

export async function requestInlineCompletion(prefix, suffix = "", language = "javascript", model = null, provider = "gemini") {
  return requestJson("/complete", {
    method: "POST",
    body: JSON.stringify({
      prefix,
      suffix,
      language,
      model,
      provider,
    }),
  });
}
