export function filterEmoji(str: string | null | undefined): string {
    if (!str) return '';
    return str.replace(/[a-zA-Z0-9\u4e00-\u9fa5]/g, '').trim() || str.substring(0, 2);
}

export function normalizeText(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/[.,;!?，。；！？\s]/g, '');
}
