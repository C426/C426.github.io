export function splitSentencesSafe(text: string): string[] {
    const logicTags: string[] = [];
    const processedText = text.replace(/\[\[.*?\]\]/g, (match) => {
        logicTags.push(match);
        return `__LOGIC_${logicTags.length - 1}__`;
    });

    const punctuation = new Set(['。', '！', '？', '!', '?', ';', '；', '…', '\n']);
    const sentences: string[] = [];
    let buffer = '';

    for (const ch of processedText) {
        buffer += ch;
        if (punctuation.has(ch)) {
            const trimmed = buffer.trim();
            if (trimmed) {
                sentences.push(trimmed);
            }
            buffer = '';
        }
    }

    const tail = buffer.trim();
    if (tail) {
        sentences.push(tail);
    }

    if (sentences.length === 0 && processedText.trim()) {
        sentences.push(processedText.trim());
    }

    return sentences
        .map(sentence => {
            let restored = sentence;
            logicTags.forEach((tag, index) => {
                restored = restored.replace(`__LOGIC_${index}__`, tag);
            });
            return restored.trim();
        })
        .filter(Boolean);
}
