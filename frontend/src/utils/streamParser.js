/**
 * Stream Parser Utility
 * Parses streaming responses and extracts <think> tags
 */

/**
 * Extracts thinking content from <think> tags
 * @param {string} content - The content to parse
 * @returns {object} Object with thinking content and main content separated
 */
export function parseThinkingBlocks(content) {
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    const matches = Array.from(content.matchAll(thinkRegex));

    let thinkingContent = '';
    let mainContent = content;

    // Extract and remove think tags from main content
    matches.forEach((match) => {
        thinkingContent += match[1].trim();
        mainContent = mainContent.replace(match[0], '');
    });

    return {
        thinking: thinkingContent.trim(),
        content: mainContent.trim(),
    };
}

/**
 * Streams a response and processes chunks
 * @param {ReadableStream} stream - The stream to process
 * @param {Function} onChunk - Callback for each chunk
 * @param {Function} onComplete - Callback when stream completes
 */
export async function processStream(stream, onChunk, onComplete) {
    try {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Process complete messages (delimited by newlines or specific markers)
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    const parsed = parseThinkingBlocks(line);
                    onChunk(parsed);
                }
            }
        }

        // Process remaining buffer
        if (buffer.trim()) {
            const parsed = parseThinkingBlocks(buffer);
            onChunk(parsed);
        }

        onComplete();
    } catch (error) {
        console.error('Stream processing error:', error);
        throw error;
    }
}

export default {
    parseThinkingBlocks,
    processStream,
};
