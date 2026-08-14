import { requestInlineCompletion } from "../../api/completion";

let registeredDisposable = null;

export function registerInlineCompletionProvider(monaco, getModel, getProvider) {
  if (registeredDisposable) {
    registeredDisposable.dispose();
    registeredDisposable = null;
  }

  const provider = {
    provideInlineCompletions: async (model, position, context, token) => {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const lineCount = model.getLineCount();
      const textAfterPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: lineCount,
        endColumn: model.getLineMaxColumn(lineCount),
      });

      const languageId = model.getLanguageId();
      const selectedModel = getModel ? getModel() : null;
      const selectedProvider = getProvider ? getProvider() : "gemini";

      try {
        const res = await requestInlineCompletion(
          textUntilPosition,
          textAfterPosition,
          languageId,
          selectedModel,
          selectedProvider
        );

        if (!res || !res.text) return { items: [] };

        return {
          items: [
            {
              insertText: res.text,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            },
          ],
        };
      } catch (err) {
        return { items: [] };
      }
    },
    freeInlineCompletions: () => {},
  };

  registeredDisposable = monaco.languages.registerInlineCompletionsProvider(
    ["javascript", "typescript", "python", "json", "html", "css", "markdown"],
    provider
  );

  return registeredDisposable;
}
