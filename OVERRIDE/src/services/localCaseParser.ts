import { Language } from '../types';
import { buildMarkedText, encodeWeakPointMarker, parseWeakPointMarkers, stripWeakPointMarkers, WeakPointMarker } from './localCaseMarkers';
import {
    AvgLine,
    FailureReason,
    LocalCaseData,
    LocalDialogueCard,
    LocalEvidence,
    LocalFailureOverride,
    LocalInspectOverride,
    LocalSuccessOverride,
    LocalTurn,
    LocalWeakPoint,
    LocalizedText,
    UnlockMode
} from './localCaseTypes';

const LANGS: Language[] = ['zh', 'ja', 'en'];
const FAIL_REASONS: FailureReason[] = ['wrongEvidence', 'wrongStatement', 'bothWrong'];
const AVG_SPEAKERS = new Set<AvgLine['speaker']>(['hero', 'enemy', 'system']);
const UNLOCK_MODES = new Set<UnlockMode>(['none', 'allTrueWeakPoints', 'specificWeakPoints']);

type SectionMap = Map<string, Map<string, string>>;

const SECTION_RE = /^\[([^\]]+)\]\s*$/;
const ENTRY_RE = /^([A-Za-z0-9_.:-]+)\s*=\s*(.*)$/;
const DENSE_SECTION_NAME_RE = /^[A-Za-z0-9:_-]+$/;
const DENSE_KEY_RE_SOURCE = [
    'version',
    'caseId',
    'defaultLang',
    'caseTitle\\.(?:zh|ja|en)',
    'heroPortraitPackId',
    'enemyPortraitPackId',
    'backgroundPackId',
    'suspectEmoji',
    'heroEmoji',
    'suspectName\\.(?:zh|ja|en)',
    'narrative\\.(?:zh|ja|en)',
    'systemMsg\\.(?:zh|ja|en)',
    'backgroundSlot',
    'screenFilter',
    'transition',
    'startsInInventory',
    'aliases',
    'name\\.(?:zh|ja|en)',
    'detail\\.(?:zh|ja|en)',
    'evidenceId',
    'statement\\.(?:zh|ja|en)',
    'loop\\.\\d+\\.(?:zh|ja|en)',
    'line\\.\\d+\\.id',
    'line\\.\\d+\\.hidden',
    'line\\.\\d+\\.unlockMode',
    'line\\.\\d+\\.unlockWeakPoints',
    'line\\.\\d+\\.grantEvidence',
    'line\\.\\d+\\.portraitState',
    'line\\.\\d+\\.portraitMotion',
    'line\\.\\d+\\.(?:zh|ja|en)',
    'weakPoint\\.\\d+\\.id',
    'weakPoint\\.\\d+\\.lineId',
    'weakPoint\\.\\d+\\.evidenceId',
    'weakPoint\\.\\d+\\.consumeEvidenceOnUse',
    'weakPoint\\.\\d+\\.(?:zh|ja|en)',
    'query\\.\\d+\\.(?:zh|ja|en)',
    'queryAvg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'sceneBackgroundSlot',
    'enemyPortraitState',
    'enemyPortraitMotion',
    'screenFilter',
    'screenImpulse',
    'transition',
    'inspectOverride\\.\\d+\\.weakPointId',
    'inspectOverride\\.\\d+\\.grantEvidence',
    'inspectOverride\\.\\d+\\.revealLines',
    'inspectOverride\\.\\d+\\.narrative\\.(?:zh|ja|en)',
    'inspectOverride\\.\\d+\\.avg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'successNarrative\\.(?:zh|ja|en)',
    'successOverride\\.\\d+\\.weakPointId',
    'successOverride\\.\\d+\\.narrative\\.(?:zh|ja|en)',
    'successOverride\\.\\d+\\.avg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'useSeparateTurnClear',
    'turnClearNarrative\\.(?:zh|ja|en)',
    'turnClearAvg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'useSeparateFailureReasons',
    'failNarrative\\.(?:wrongEvidence|wrongStatement|bothWrong)\\.(?:zh|ja|en)',
    'logicExplanation\\.(?:zh|ja|en)',
    'successAvg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'failAvg\\.(?:wrongEvidence|wrongStatement|bothWrong)\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'failOverride\\.(?:wrongEvidence|wrongStatement|bothWrong)\\.\\d+\\.weakPointId',
    'failOverride\\.(?:wrongEvidence|wrongStatement|bothWrong)\\.\\d+\\.narrative\\.(?:zh|ja|en)',
    'failOverride\\.(?:wrongEvidence|wrongStatement|bothWrong)\\.\\d+\\.avg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)',
    'interference\\.\\d+\\.(?:zh|ja|en)',
    'confession\\.(?:zh|ja|en)',
    'avg\\.\\d+\\.(?:speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)'
].join('|');

const DENSE_KEY_RE = new RegExp(`(${DENSE_KEY_RE_SOURCE})\\s*=`, 'g');
const DENSE_KEY_AT_CURSOR_RE = new RegExp(`^(${DENSE_KEY_RE_SOURCE})\\s*=`);

const cleanBlockValue = (value: string) => value.replace(/\r/g, '').replace(/^\n+|\n+$/g, '').trimEnd();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const defaultLineId = (turnIndex: number, lineIndex: number) => `t${turnIndex}-line-${lineIndex}`;
const defaultWeakPointId = (turnIndex: number, weakIndex: number) => `t${turnIndex}-weak-${weakIndex}`;

const readTripleQuotedValue = (lines: string[], lineIndex: number, initial: string) => {
    let remainder = initial.slice(3);
    if (remainder.includes('"""')) {
        const end = remainder.indexOf('"""');
        return {
            value: cleanBlockValue(remainder.slice(0, end)),
            nextLineIndex: lineIndex
        };
    }

    const chunks: string[] = [];
    if (remainder.length > 0) {
        chunks.push(remainder);
    }

    let cursor = lineIndex + 1;
    while (cursor < lines.length) {
        const line = lines[cursor];
        if (line.includes('"""')) {
            const end = line.indexOf('"""');
            chunks.push(line.slice(0, end));
            return {
                value: cleanBlockValue(chunks.join('\n')),
                nextLineIndex: cursor
            };
        }
        chunks.push(line);
        cursor += 1;
    }

    throw new Error(`Unclosed triple-quoted block starting near line ${lineIndex + 1}.`);
};

const parseLineSections = (source: string): SectionMap => {
    const sections: SectionMap = new Map();
    const lines = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let currentSection: Map<string, string> | null = null;
    let currentSectionName = '';

    for (let index = 0; index < lines.length; index += 1) {
        const rawLine = lines[index];
        const trimmed = rawLine.trim();

        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const sectionMatch = trimmed.match(SECTION_RE);
        if (sectionMatch) {
            currentSectionName = sectionMatch[1].trim();
            currentSection = new Map();
            sections.set(currentSectionName, currentSection);
            continue;
        }

        if (!currentSection) {
            throw new Error(`Line ${index + 1} is outside any section.`);
        }

        const entryMatch = rawLine.match(ENTRY_RE);
        if (!entryMatch) {
            throw new Error(`Invalid entry at line ${index + 1} in section [${currentSectionName}].`);
        }

        const key = entryMatch[1].trim();
        let value = (entryMatch[2] ?? '').trim();

        if (value.startsWith('"""')) {
            const block = readTripleQuotedValue(lines, index, value);
            value = block.value;
            index = block.nextLineIndex;
        }

        currentSection.set(key, value);
    }

    return sections;
};

const findDenseSectionMarker = (source: string, fromIndex: number) => {
    let cursor = fromIndex;
    while (cursor < source.length) {
        const start = source.indexOf('[', cursor);
        if (start === -1) return null;

        const end = source.indexOf(']', start + 1);
        if (end === -1) return null;

        const name = source.slice(start + 1, end).trim();
        if (DENSE_SECTION_NAME_RE.test(name)) {
            return {
                index: start,
                endIndex: end + 1,
                name
            };
        }

        cursor = start + 1;
    }

    return null;
};

const findNextDenseKeyIndex = (source: string, fromIndex: number) => {
    DENSE_KEY_RE.lastIndex = fromIndex;
    const match = DENSE_KEY_RE.exec(source);
    return match ? match.index : -1;
};

const readDenseSimpleValue = (source: string, startIndex: number) => {
    const nextSection = findDenseSectionMarker(source, startIndex + 1);
    const nextKeyIndex = findNextDenseKeyIndex(source, startIndex + 1);

    let endIndex = source.length;
    if (nextSection) {
        endIndex = Math.min(endIndex, nextSection.index);
    }
    if (nextKeyIndex !== -1) {
        endIndex = Math.min(endIndex, nextKeyIndex);
    }

    return {
        value: source.slice(startIndex, endIndex).trim(),
        nextIndex: endIndex
    };
};

const parseDenseSections = (source: string): SectionMap => {
    const normalized = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const firstSection = findDenseSectionMarker(normalized, 0);

    if (!firstSection) {
        throw new Error('No section marker found in dense local case text.');
    }

    const sections: SectionMap = new Map();
    let cursor = firstSection.index;

    while (cursor < normalized.length) {
        const sectionMarker = findDenseSectionMarker(normalized, cursor);
        if (!sectionMarker || sectionMarker.index !== cursor) {
            break;
        }

        const section = new Map<string, string>();
        sections.set(sectionMarker.name, section);
        cursor = sectionMarker.endIndex;

        while (cursor < normalized.length) {
            while (cursor < normalized.length && /\s/.test(normalized[cursor])) {
                cursor += 1;
            }

            const nextSection = findDenseSectionMarker(normalized, cursor);
            if (nextSection && nextSection.index === cursor) {
                break;
            }

            const keyMatch = normalized.slice(cursor).match(DENSE_KEY_AT_CURSOR_RE);
            if (!keyMatch) {
                if (nextSection) {
                    cursor = nextSection.index;
                    break;
                }
                cursor = normalized.length;
                break;
            }

            const key = keyMatch[1];
            cursor += keyMatch[0].length;

            let value = '';
            if (normalized.slice(cursor, cursor + 3) === '"""') {
                cursor += 3;
                const endQuote = normalized.indexOf('"""', cursor);
                if (endQuote === -1) {
                    throw new Error(`Unclosed triple-quoted block after dense key "${key}".`);
                }
                value = cleanBlockValue(normalized.slice(cursor, endQuote));
                cursor = endQuote + 3;
            } else {
                const plainValue = readDenseSimpleValue(normalized, cursor);
                value = plainValue.value;
                cursor = plainValue.nextIndex;
            }

            section.set(key, value);
        }
    }

    return sections;
};

const parseSections = (source: string): SectionMap => {
    try {
        return parseLineSections(source);
    } catch (lineError) {
        try {
            return parseDenseSections(source);
        } catch (denseError) {
            const lineMessage = lineError instanceof Error ? lineError.message : String(lineError);
            const denseMessage = denseError instanceof Error ? denseError.message : String(denseError);
            throw new Error(`${lineMessage} | Dense fallback failed: ${denseMessage}`);
        }
    }
};

const requireSection = (sections: SectionMap, sectionName: string) => {
    const section = sections.get(sectionName);
    if (!section) {
        throw new Error(`Missing required section [${sectionName}].`);
    }
    return section;
};

const readValue = (section: Map<string, string>, key: string) => {
    const value = section.get(key);
    return value !== undefined ? value.trim() : undefined;
};

const requireValue = (section: Map<string, string>, sectionName: string, key: string) => {
    const value = readValue(section, key);
    if (!value) {
        throw new Error(`Missing "${key}" in section [${sectionName}].`);
    }
    return value;
};

const readLocalized = (section: Map<string, string>, sectionName: string, baseKey: string, required = true): LocalizedText => {
    const localized: LocalizedText = {};
    for (const lang of LANGS) {
        const value = readValue(section, `${baseKey}.${lang}`);
        if (value) {
            localized[lang] = value;
        }
    }

    if (required && Object.keys(localized).length === 0) {
        throw new Error(`Missing localized field "${baseKey}.[zh|ja|en]" in section [${sectionName}].`);
    }

    return localized;
};

const readAliases = (section: Map<string, string>) => {
    const aliases = readValue(section, 'aliases');
    if (!aliases) return [];
    return aliases.split('|').map(item => item.trim()).filter(Boolean);
};

const readBoolean = (section: Map<string, string>, key: string, fallback = false) => {
    const value = readValue(section, key);
    if (!value) return fallback;
    return value.toLowerCase() === 'true';
};

const readList = (section: Map<string, string>, key: string) => {
    const value = readValue(section, key);
    if (!value) return [];
    return value.split('|').map(item => item.trim()).filter(Boolean);
};

const localizedEquals = (left: LocalizedText, right: LocalizedText) =>
    LANGS.every(lang => (left[lang] || '') === (right[lang] || ''));

const avgLinesEqual = (left: AvgLine[], right: AvgLine[]) =>
    left.length === right.length
    && left.every((line, index) =>
        line.speaker === right[index]?.speaker
        && localizedEquals(line.text, right[index]?.text || {})
    );

const readLocalizedList = (section: Map<string, string>, prefix: string): LocalizedText[] => {
    const bucket = new Map<number, LocalizedText>();
    const matcher = new RegExp(`^${escapeRegex(prefix)}\.(\\d+)\.(zh|ja|en)$`);

    for (const [key, value] of section.entries()) {
        const match = key.match(matcher);
        if (!match) continue;

        const index = Number(match[1]);
        const lang = match[2] as Language;
        const entry = bucket.get(index) || {};
        entry[lang] = value;
        bucket.set(index, entry);
    }

    return Array.from(bucket.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([, localized]) => localized)
        .filter(localized => Object.keys(localized).length > 0);
};

const readAvgLines = (section: Map<string, string>, sectionName: string, prefix: string): AvgLine[] => {
    const bucket = new Map<number, {
        speaker?: AvgLine['speaker'];
        text: LocalizedText;
        portraitState?: AvgLine['portraitState'];
        portraitMotion?: AvgLine['portraitMotion'];
        backgroundSlot?: AvgLine['backgroundSlot'];
        screenFilter?: AvgLine['screenFilter'];
        screenImpulse?: AvgLine['screenImpulse'];
        transition?: AvgLine['transition'];
    }>();
    const matcher = new RegExp(`^${escapeRegex(prefix)}\.(\\d+)\.(speaker|portraitState|portraitMotion|backgroundSlot|screenFilter|screenImpulse|transition|zh|ja|en)$`);

    for (const [key, value] of section.entries()) {
        const match = key.match(matcher);
        if (!match) continue;

        const index = Number(match[1]);
        const field = match[2];
        const entry = bucket.get(index) || { text: {} };

        if (field === 'speaker') {
            if (!AVG_SPEAKERS.has(value as AvgLine['speaker'])) {
                throw new Error(`Invalid speaker "${value}" in section [${sectionName}] at "${prefix}.${index}.speaker".`);
            }
            entry.speaker = value as AvgLine['speaker'];
        } else if (field === 'portraitState') {
            entry.portraitState = value as AvgLine['portraitState'];
        } else if (field === 'portraitMotion') {
            entry.portraitMotion = value as AvgLine['portraitMotion'];
        } else if (field === 'backgroundSlot') {
            entry.backgroundSlot = value;
        } else if (field === 'screenFilter') {
            entry.screenFilter = value as AvgLine['screenFilter'];
        } else if (field === 'screenImpulse') {
            entry.screenImpulse = value as AvgLine['screenImpulse'];
        } else if (field === 'transition') {
            entry.transition = value as AvgLine['transition'];
        } else {
            entry.text[field as Language] = value;
        }

        bucket.set(index, entry);
    }

    return Array.from(bucket.entries())
        .sort((left, right) => left[0] - right[0])
        .map(([index, entry]) => {
            if (!entry.speaker) {
                throw new Error(`Missing "${prefix}.${index}.speaker" in section [${sectionName}].`);
            }
            if (Object.keys(entry.text).length === 0) {
                throw new Error(`Missing localized text for "${prefix}.${index}" in section [${sectionName}].`);
            }
            return {
                speaker: entry.speaker,
                text: entry.text,
                portraitState: entry.portraitState,
                portraitMotion: entry.portraitMotion,
                backgroundSlot: entry.backgroundSlot,
                screenFilter: entry.screenFilter,
                screenImpulse: entry.screenImpulse,
                transition: entry.transition
            };
        });
};

const readDialogueCards = (section: Map<string, string>, sectionName: string, turnIndex: number): LocalDialogueCard[] => {
    const indexes = new Set<number>();
    for (const key of section.keys()) {
        const match = key.match(/^line\.(\d+)\./);
        if (match) {
            indexes.add(Number(match[1]));
        }
    }

    return Array.from(indexes)
        .sort((left, right) => left - right)
        .map(index => {
            const base = `line.${index}`;
            const unlockMode = (readValue(section, `${base}.unlockMode`) || 'none') as UnlockMode;
            if (!UNLOCK_MODES.has(unlockMode)) {
                throw new Error(`Invalid unlock mode "${unlockMode}" in section [${sectionName}] at ${base}.unlockMode.`);
            }
            return {
                id: readValue(section, `${base}.id`) || defaultLineId(turnIndex, index),
                hidden: readBoolean(section, `${base}.hidden`, false),
                unlockMode,
                unlockWeakPointIds: readList(section, `${base}.unlockWeakPoints`),
                grantEvidenceIds: readList(section, `${base}.grantEvidence`),
                portraitState: readValue(section, `${base}.portraitState`) as LocalDialogueCard['portraitState'],
                portraitMotion: readValue(section, `${base}.portraitMotion`) as LocalDialogueCard['portraitMotion'],
                text: readLocalized(section, sectionName, base)
            };
        });
};

const readWeakPoints = (section: Map<string, string>, sectionName: string, turnIndex: number): LocalWeakPoint[] => {
    const indexes = new Set<number>();
    for (const key of section.keys()) {
        const match = key.match(/^weakPoint\.(\d+)\./);
        if (match) {
            indexes.add(Number(match[1]));
        }
    }

    return Array.from(indexes)
        .sort((left, right) => left - right)
        .map(index => {
            const base = `weakPoint.${index}`;
            return {
                id: readValue(section, `${base}.id`) || defaultWeakPointId(turnIndex, index),
                lineId: requireValue(section, sectionName, `${base}.lineId`),
                evidenceId: readValue(section, `${base}.evidenceId`) || '',
                consumeEvidenceOnUse: readBoolean(section, `${base}.consumeEvidenceOnUse`, true),
                statement: readLocalized(section, sectionName, base)
            };
        });
};

const readFailureOverrides = (section: Map<string, string>, sectionName: string): Record<FailureReason, LocalFailureOverride[]> => {
    const result = Object.fromEntries(FAIL_REASONS.map(reason => [reason, []])) as Record<FailureReason, LocalFailureOverride[]>;

    FAIL_REASONS.forEach(reason => {
        const indexes = new Set<number>();
        for (const key of section.keys()) {
            const match = key.match(new RegExp(`^failOverride\\.${reason}\\.(\\d+)\\.`));
            if (match) {
                indexes.add(Number(match[1]));
            }
        }

        result[reason] = Array.from(indexes)
            .sort((left, right) => left - right)
            .map(index => {
                const base = `failOverride.${reason}.${index}`;
                return {
                    weakPointId: requireValue(section, sectionName, `${base}.weakPointId`),
                    narrative: readLocalized(section, sectionName, `${base}.narrative`, false),
                    avg: readAvgLines(section, sectionName, `${base}.avg`)
                };
            });
    });

    return result;
};

const readSuccessOverrides = (section: Map<string, string>, sectionName: string): LocalSuccessOverride[] => {
    const indexes = new Set<number>();
    for (const key of section.keys()) {
        const match = key.match(/^successOverride\.(\d+)\./);
        if (match) {
            indexes.add(Number(match[1]));
        }
    }

    return Array.from(indexes)
        .sort((left, right) => left - right)
        .map(index => {
            const base = `successOverride.${index}`;
            return {
                weakPointId: requireValue(section, sectionName, `${base}.weakPointId`),
                narrative: readLocalized(section, sectionName, `${base}.narrative`, false),
                avg: readAvgLines(section, sectionName, `${base}.avg`)
            };
        });
};

const readInspectOverrides = (section: Map<string, string>, sectionName: string): LocalInspectOverride[] => {
    const indexes = new Set<number>();
    for (const key of section.keys()) {
        const match = key.match(/^inspectOverride\.(\d+)\./);
        if (match) {
            indexes.add(Number(match[1]));
        }
    }

    return Array.from(indexes)
        .sort((left, right) => left - right)
        .map(index => {
            const base = `inspectOverride.${index}`;
            return {
                weakPointId: requireValue(section, sectionName, `${base}.weakPointId`),
                grantEvidenceIds: readList(section, `${base}.grantEvidence`),
                revealLineIds: readList(section, `${base}.revealLines`),
                narrative: readLocalized(section, sectionName, `${base}.narrative`, false),
                avg: readAvgLines(section, sectionName, `${base}.avg`)
            };
        });
};

const collectLegacyMarkerOccurrences = (dialogues: LocalDialogueCard[], lang: Language) => {
    const occurrences: { lineId: string; lineIndex: number; text: string }[] = [];
    dialogues.forEach((dialogue, lineIndex) => {
        const value = dialogue.text[lang] || '';
        const parsed = parseWeakPointMarkers(value);
        parsed.markers.forEach(marker => {
            occurrences.push({
                lineId: dialogue.id,
                lineIndex,
                text: marker.text
            });
        });
    });
    return occurrences;
};

const convertLegacyTurn = (
    section: Map<string, string>,
    sectionName: string,
    turnIndex: number,
    defaultLang: Language
) => {
    const legacyDialogues = readLocalizedList(section, 'loop');
    const dialogueCards: LocalDialogueCard[] = legacyDialogues.map((text, index) => ({
        id: defaultLineId(turnIndex, index + 1),
        hidden: false,
        unlockMode: 'none',
        unlockWeakPointIds: [],
        grantEvidenceIds: [],
        text: { ...text }
    }));

    const occurrencesByLang = new Map<Language, { lineId: string; lineIndex: number; text: string }[]>();
    let maxOccurrence = 0;

    for (const lang of LANGS) {
        const occurrences = collectLegacyMarkerOccurrences(dialogueCards, lang);
        occurrencesByLang.set(lang, occurrences);
        maxOccurrence = Math.max(maxOccurrence, occurrences.length);
    }

    const weakPoints: LocalWeakPoint[] = [];

    if (maxOccurrence > 0) {
        for (let index = 0; index < maxOccurrence; index += 1) {
            const fromDefault = occurrencesByLang.get(defaultLang)?.[index];
            const fromAny = LANGS.map(lang => occurrencesByLang.get(lang)?.[index]).find(Boolean);
            const source = fromDefault || fromAny;
            const weakPoint: LocalWeakPoint = {
                id: defaultWeakPointId(turnIndex, index + 1),
                lineId: source?.lineId || dialogueCards[0]?.id || defaultLineId(turnIndex, 1),
                evidenceId: '',
                consumeEvidenceOnUse: true,
                statement: {}
            };
            for (const lang of LANGS) {
                const occurrence = occurrencesByLang.get(lang)?.[index];
                if (occurrence?.text) {
                    weakPoint.statement[lang] = occurrence.text;
                }
            }
            weakPoints.push(weakPoint);
        }

        for (const lang of LANGS) {
            let occurrenceIndex = 0;
            dialogueCards.forEach(dialogue => {
                const raw = dialogue.text[lang];
                if (!raw) return;
                const parsed = parseWeakPointMarkers(raw);
                if (parsed.markers.length === 0) return;
                const markers: WeakPointMarker[] = parsed.markers.map(marker => ({
                    ...marker,
                    id: weakPoints[occurrenceIndex++]?.id || marker.id
                }));
                dialogue.text[lang] = buildMarkedText(parsed.plain, markers);
            });
        }
    }

    const legacyStatement = readLocalized(section, sectionName, 'statement', false);
    const legacyEvidenceId = readValue(section, 'evidenceId') || '';

    if (weakPoints.length === 0 && Object.keys(legacyStatement).length > 0) {
        const weakPointId = defaultWeakPointId(turnIndex, 1);
        const weakPoint: LocalWeakPoint = {
            id: weakPointId,
            lineId: dialogueCards[0]?.id || defaultLineId(turnIndex, 1),
            evidenceId: legacyEvidenceId,
            consumeEvidenceOnUse: true,
            statement: legacyStatement
        };
        weakPoints.push(weakPoint);

        for (const lang of LANGS) {
            const statementText = legacyStatement[lang] || legacyStatement[defaultLang] || '';
            if (!statementText) continue;
            const targetCard = dialogueCards.find(dialogue => stripWeakPointMarkers(dialogue.text[lang] || '').includes(statementText)) || dialogueCards[0];
            if (!targetCard) continue;
            const plain = stripWeakPointMarkers(targetCard.text[lang] || '');
            const at = plain.indexOf(statementText);
            if (at >= 0) {
                targetCard.text[lang] = `${plain.slice(0, at)}${encodeWeakPointMarker(weakPointId, statementText)}${plain.slice(at + statementText.length)}`;
            } else {
                targetCard.text[lang] = `${plain}${plain ? ' ' : ''}${encodeWeakPointMarker(weakPointId, statementText)}`;
            }
        }
    } else if (legacyEvidenceId && weakPoints.length > 0) {
        const target = weakPoints.find(weakPoint => {
            const statementText = weakPoint.statement[defaultLang] || weakPoint.statement.zh || weakPoint.statement.en || weakPoint.statement.ja || '';
            const legacyText = legacyStatement[defaultLang] || legacyStatement.zh || legacyStatement.en || legacyStatement.ja || '';
            return statementText && legacyText && statementText === legacyText;
        }) || weakPoints[0];
        target.evidenceId = legacyEvidenceId;
    }

    return { dialogueCards, weakPoints };
};

const readTurn = (sections: SectionMap, sectionName: string, turnIndex: number, defaultLang: Language): LocalTurn => {
    const section = requireSection(sections, sectionName);

    const failNarrative = Object.fromEntries(
        FAIL_REASONS.map(reason => [reason, readLocalized(section, sectionName, `failNarrative.${reason}`)])
    ) as Record<FailureReason, LocalizedText>;

    const failAvg = Object.fromEntries(
        FAIL_REASONS.map(reason => [reason, readAvgLines(section, sectionName, `failAvg.${reason}`)])
    ) as Record<FailureReason, AvgLine[]>;
    const failOverrides = readFailureOverrides(section, sectionName);
    const inspectOverrides = readInspectOverrides(section, sectionName);
    const successOverrides = readSuccessOverrides(section, sectionName);

    const dialogueCards = readDialogueCards(section, sectionName, turnIndex);
    const weakPoints = readWeakPoints(section, sectionName, turnIndex);
    const legacy = dialogueCards.length === 0 ? convertLegacyTurn(section, sectionName, turnIndex, defaultLang) : null;
    const successNarrative = readLocalized(section, sectionName, 'successNarrative');
    const successAvg = readAvgLines(section, sectionName, 'successAvg');
    const turnClearNarrative = readLocalized(section, sectionName, 'turnClearNarrative', false);
    const turnClearAvg = readAvgLines(section, sectionName, 'turnClearAvg');
    const resolvedTurnClearNarrative = Object.keys(turnClearNarrative).length > 0 ? turnClearNarrative : successNarrative;
    const resolvedTurnClearAvg = turnClearAvg.length > 0 ? turnClearAvg : successAvg;
    const useSeparateTurnClear = readBoolean(
        section,
        'useSeparateTurnClear',
        !localizedEquals(resolvedTurnClearNarrative, successNarrative) || !avgLinesEqual(resolvedTurnClearAvg, successAvg)
    );
    const useSeparateFailureReasons = readBoolean(
        section,
        'useSeparateFailureReasons',
        FAIL_REASONS.some(reason =>
            !localizedEquals(failNarrative[reason], failNarrative.wrongEvidence)
            || !avgLinesEqual(failAvg[reason], failAvg.wrongEvidence)
        )
    );

    return {
        weakPoints: weakPoints.length > 0 ? weakPoints : (legacy?.weakPoints || []),
        loopDialogues: dialogueCards.length > 0 ? dialogueCards : (legacy?.dialogueCards || []),
        startingEvidenceIds: readList(section, 'startingEvidence'),
        queryNarratives: readLocalizedList(section, 'query'),
        queryAvg: readAvgLines(section, sectionName, 'queryAvg'),
        inspectOverrides,
        sceneBackgroundSlot: readValue(section, 'sceneBackgroundSlot') || 'cross_exam',
        enemyPortraitState: (readValue(section, 'enemyPortraitState') as LocalTurn['enemyPortraitState']) || 'neutral_idle',
        enemyPortraitMotion: (readValue(section, 'enemyPortraitMotion') as LocalTurn['enemyPortraitMotion']) || 'none',
        screenFilter: (readValue(section, 'screenFilter') as LocalTurn['screenFilter']) || 'none',
        screenImpulse: (readValue(section, 'screenImpulse') as LocalTurn['screenImpulse']) || 'none',
        transition: (readValue(section, 'transition') as LocalTurn['transition']) || 'cut',
        successNarrative,
        successOverrides,
        useSeparateTurnClear,
        turnClearNarrative: resolvedTurnClearNarrative,
        turnClearAvg: resolvedTurnClearAvg,
        useSeparateFailureReasons,
        failNarrative,
        logicExplanation: readLocalized(section, sectionName, 'logicExplanation'),
        successAvg,
        failAvg,
        failOverrides,
        interferenceLines: readLocalizedList(section, 'interference')
    };
};

const THIRD_PERSON_DIALOGUE_PREFIXES = [
    /^(?:被告|被告人|嫌犯|嫌疑人|她|他)(?:声称|表示|辩称|坚称|否认|承认)/u,
    /^(?:被告|被告人|嫌犯|嫌疑人|她|他)的(?:证词|说法|辩解)/u
];

const looksLikeNarratedSuspectDialogue = (rawText: string, suspectNames: string[]) => {
    const plain = stripWeakPointMarkers(rawText).trim();
    if (!plain) {
        return false;
    }

    if (THIRD_PERSON_DIALOGUE_PREFIXES.some(pattern => pattern.test(plain))) {
        return true;
    }

    return suspectNames.some(name => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            return false;
        }

        const suffix = plain.slice(trimmedName.length, trimmedName.length + 8);
        return plain.startsWith(trimmedName) && /(声称|表示|辩称|坚称|否认|承认)/u.test(suffix);
    });
};

const validateCase = (caseData: LocalCaseData) => {
    if (caseData.evidences.length === 0) {
        throw new Error('Local case must contain at least one evidence section.');
    }
    if (caseData.turns.length === 0) {
        throw new Error('Local case must contain at least one turn section.');
    }

    const evidenceIds = new Set(caseData.evidences.map(evidence => evidence.id));
    const suspectNames = Array.from(new Set(
        LANGS
            .map(lang => caseData.suspectName[lang]?.trim())
            .filter((value): value is string => Boolean(value))
    ));

    for (const [index, turn] of caseData.turns.entries()) {
        const lineIds = new Set(turn.loopDialogues.map(line => line.id));
        const weakPointIds = new Set(turn.weakPoints.map(weakPoint => weakPoint.id));
        const weakPointUnlockOwners = new Map<string, string>();
        const evidenceGrantOwners = new Map<string, string>();
        const inspectRevealOwners = new Map<string, string>();

        if (turn.loopDialogues.length === 0) {
            throw new Error(`Turn ${index + 1} must define at least one testimony line.`);
        }
        if (turn.queryNarratives.length === 0) {
            throw new Error(`Turn ${index + 1} must define at least one query narrative.`);
        }
        if (turn.successAvg.length === 0) {
            throw new Error(`Turn ${index + 1} must define at least one successAvg line.`);
        }
        for (const reason of FAIL_REASONS) {
            if (turn.failAvg[reason].length === 0) {
                throw new Error(`Turn ${index + 1} must define at least one failAvg line for "${reason}".`);
            }
            for (const override of turn.failOverrides[reason] || []) {
                if (!weakPointIds.has(override.weakPointId)) {
                    throw new Error(`Turn ${index + 1} fail override for "${reason}" references missing weak point "${override.weakPointId}".`);
                }
            }
        }
        if (turn.turnClearAvg.length === 0) {
            throw new Error(`Turn ${index + 1} must define at least one turnClearAvg line.`);
        }
        for (const override of turn.successOverrides || []) {
            if (!weakPointIds.has(override.weakPointId)) {
                throw new Error(`Turn ${index + 1} success override references missing weak point "${override.weakPointId}".`);
            }
        }
        for (const override of turn.inspectOverrides || []) {
            if (!weakPointIds.has(override.weakPointId)) {
                throw new Error(`Turn ${index + 1} inspect override references missing weak point "${override.weakPointId}".`);
            }
            for (const evidenceId of override.grantEvidenceIds || []) {
                if (!evidenceIds.has(evidenceId)) {
                    throw new Error(`Turn ${index + 1} inspect override for "${override.weakPointId}" grants unknown evidence "${evidenceId}".`);
                }
                const owner = evidenceGrantOwners.get(evidenceId);
                if (owner) {
                    throw new Error(`Turn ${index + 1} evidence "${evidenceId}" is granted more than once (${owner} and inspect:${override.weakPointId}).`);
                }
                evidenceGrantOwners.set(evidenceId, `inspect:${override.weakPointId}`);
            }
            for (const lineId of override.revealLineIds || []) {
                if (!lineIds.has(lineId)) {
                    throw new Error(`Turn ${index + 1} inspect override for "${override.weakPointId}" reveals unknown line "${lineId}".`);
                }
                const line = turn.loopDialogues.find(item => item.id === lineId);
                if (!line?.hidden) {
                    throw new Error(`Turn ${index + 1} inspect override for "${override.weakPointId}" can only reveal hidden lines, but "${lineId}" is not hidden.`);
                }
                const owner = inspectRevealOwners.get(lineId);
                if (owner) {
                    throw new Error(`Turn ${index + 1} hidden line "${lineId}" is revealed more than once (${owner} and inspect:${override.weakPointId}).`);
                }
                inspectRevealOwners.set(lineId, `inspect:${override.weakPointId}`);
            }
        }
        for (const weakPoint of turn.weakPoints) {
            if (!lineIds.has(weakPoint.lineId)) {
                throw new Error(`Turn ${index + 1} weak point "${weakPoint.id}" references missing lineId "${weakPoint.lineId}".`);
            }
            if (weakPoint.evidenceId && !evidenceIds.has(weakPoint.evidenceId)) {
                throw new Error(`Turn ${index + 1} weak point "${weakPoint.id}" references unknown evidenceId "${weakPoint.evidenceId}".`);
            }
        }
        for (const evidenceId of turn.startingEvidenceIds || []) {
            if (!evidenceIds.has(evidenceId)) {
                throw new Error(`Turn ${index + 1} starting evidence "${evidenceId}" does not exist in the case evidence list.`);
            }
        }
        for (const line of turn.loopDialogues) {
            for (const lang of LANGS) {
                const localizedText = line.text[lang];
                if (!localizedText) {
                    continue;
                }
                if (looksLikeNarratedSuspectDialogue(localizedText, suspectNames)) {
                    throw new Error(
                        `Turn ${index + 1} line "${line.id}" uses third-person testimony phrasing in "${lang}". ` +
                        'loopDialogues must contain the suspect\'s own first-person speech, not narrative summaries.'
                    );
                }
            }
            if ((line.unlockMode || 'none') !== 'specificWeakPoints' && (line.unlockWeakPointIds || []).length > 0) {
                throw new Error(`Turn ${index + 1} line "${line.id}" keeps specific weak-point unlock refs while unlockMode is "${line.unlockMode || 'none'}".`);
            }
            for (const weakPointId of line.unlockWeakPointIds || []) {
                if (!weakPointIds.has(weakPointId)) {
                    throw new Error(`Turn ${index + 1} line "${line.id}" references missing weak point "${weakPointId}".`);
                }
                const owner = weakPointUnlockOwners.get(weakPointId);
                if (owner) {
                    throw new Error(`Turn ${index + 1} weak point "${weakPointId}" is used to unlock more than one hidden line (${owner} and line:${line.id}).`);
                }
                weakPointUnlockOwners.set(weakPointId, `line:${line.id}`);
            }
            for (const evidenceId of line.grantEvidenceIds || []) {
                if (!evidenceIds.has(evidenceId)) {
                    throw new Error(`Turn ${index + 1} line "${line.id}" grants unknown evidence "${evidenceId}".`);
                }
                const owner = evidenceGrantOwners.get(evidenceId);
                if (owner) {
                    throw new Error(`Turn ${index + 1} evidence "${evidenceId}" is granted more than once (${owner} and line:${line.id}).`);
                }
                evidenceGrantOwners.set(evidenceId, `line:${line.id}`);
            }
        }
    }
};

export const textFor = (text: LocalizedText, lang: Language, defaultLang: Language): string => (
    text[lang]
    || text[defaultLang]
    || text.en
    || text.zh
    || text.ja
    || Object.values(text).find(Boolean)
    || ''
);

export const parseLocalCaseText = (source: string): LocalCaseData => {
    const sections = parseSections(source);
    const meta = requireSection(sections, 'meta');
    const intro = requireSection(sections, 'intro');
    const victory = requireSection(sections, 'victory');

    const version = requireValue(meta, 'meta', 'version');
    if (version !== 'LOCAL_CASE_TXT_V1') {
        throw new Error(`Unsupported local case version "${version}". Expected LOCAL_CASE_TXT_V1.`);
    }

    const defaultLang = (readValue(meta, 'defaultLang') || 'zh') as Language;
    if (!LANGS.includes(defaultLang)) {
        throw new Error(`Invalid defaultLang "${defaultLang}".`);
    }

    const evidences: LocalEvidence[] = Array.from(sections.keys())
        .filter(name => name.startsWith('evidence:'))
        .map(sectionName => {
            const section = requireSection(sections, sectionName);
            const id = sectionName.slice('evidence:'.length).trim();
            if (!id) {
                throw new Error(`Invalid evidence section name [${sectionName}].`);
            }
            return {
                id,
                name: readLocalized(section, sectionName, 'name'),
                detail: readLocalized(section, sectionName, 'detail'),
                aliases: readAliases(section),
                startsInInventory: readBoolean(section, 'startsInInventory', true)
            };
        });

    const turns = Array.from(sections.keys())
        .filter(name => name.startsWith('turn:'))
        .sort((left, right) => Number(left.slice('turn:'.length)) - Number(right.slice('turn:'.length)))
        .map((sectionName, index) => readTurn(sections, sectionName, index + 1, defaultLang));

    const caseData: LocalCaseData = {
        caseId: requireValue(meta, 'meta', 'caseId'),
        caseTitle: readLocalized(meta, 'meta', 'caseTitle', false),
        defaultLang,
        suspectName: readLocalized(meta, 'meta', 'suspectName'),
        suspectEmoji: readValue(meta, 'suspectEmoji') || '',
        heroEmoji: readValue(meta, 'heroEmoji') || '',
        heroPortraitPackId: readValue(meta, 'heroPortraitPackId') || undefined,
        enemyPortraitPackId: readValue(meta, 'enemyPortraitPackId') || undefined,
        backgroundPackId: readValue(meta, 'backgroundPackId') || undefined,
        intro: {
            narrative: readLocalized(intro, 'intro', 'narrative'),
            systemMsg: readLocalized(intro, 'intro', 'systemMsg'),
            backgroundSlot: readValue(intro, 'backgroundSlot') || 'briefing',
            enemyPortraitState: (readValue(intro, 'enemyPortraitState') as LocalCaseData['intro']['enemyPortraitState']) || 'neutral_idle',
            screenFilter: (readValue(intro, 'screenFilter') as LocalCaseData['intro']['screenFilter']) || 'none',
            transition: (readValue(intro, 'transition') as LocalCaseData['intro']['transition']) || 'fade'
        },
        evidences,
        turns,
        victory: {
            narrative: readLocalized(victory, 'victory', 'narrative'),
            confession: readLocalized(victory, 'victory', 'confession'),
            avg: readAvgLines(victory, 'victory', 'avg'),
            backgroundSlot: readValue(victory, 'backgroundSlot') || 'confession',
            screenFilter: (readValue(victory, 'screenFilter') as LocalCaseData['victory']['screenFilter']) || 'dim',
            transition: (readValue(victory, 'transition') as LocalCaseData['victory']['transition']) || 'fade'
        }
    };

    validateCase(caseData);
    return caseData;
};
