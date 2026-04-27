export interface WeakPointMarker {
    id?: string;
    text: string;
    start: number;
    end: number;
}

const MARKER_RE = /\[\[(?:([A-Za-z0-9_-]+)::)?([\s\S]*?)\]\]/g;

export const encodeWeakPointMarker = (id: string, text: string) => `[[${id}::${text}]]`;

export const parseWeakPointMarkers = (value: string) => {
    const markers: WeakPointMarker[] = [];
    let plain = '';
    let cursor = 0;

    for (const match of value.matchAll(MARKER_RE)) {
        const raw = match[0];
        const index = match.index ?? 0;
        const text = match[2] || '';

        plain += value.slice(cursor, index);
        const start = plain.length;
        plain += text;
        const end = plain.length;

        markers.push({
            id: match[1],
            text,
            start,
            end
        });

        cursor = index + raw.length;
    }

    plain += value.slice(cursor);
    return {
        plain,
        markers
    };
};

export const stripWeakPointMarkers = (value: string) => parseWeakPointMarkers(value).plain;

export const buildMarkedText = (plain: string, markers: WeakPointMarker[]) => {
    const sorted = [...markers]
        .filter(marker => marker.end > marker.start)
        .sort((left, right) => left.start - right.start);

    let result = '';
    let cursor = 0;

    for (const marker of sorted) {
        result += plain.slice(cursor, marker.start);
        result += marker.id
            ? encodeWeakPointMarker(marker.id, plain.slice(marker.start, marker.end))
            : `[[${plain.slice(marker.start, marker.end)}]]`;
        cursor = marker.end;
    }

    result += plain.slice(cursor);
    return result;
};
