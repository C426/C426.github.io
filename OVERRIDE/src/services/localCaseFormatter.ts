import { Language } from '../types';
import { encodeWeakPointMarker } from './localCaseMarkers';
import { parseLocalCaseText } from './localCaseParser';
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
const DEFAULT_UNLOCK_MODE: UnlockMode = 'none';

const normalizeBlockValue = (value: string) => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();

const block = (value: string) => {
    const normalized = normalizeBlockValue(value || '');
    return `"""\n${normalized}\n"""`;
};

const hasAnyText = (value: LocalizedText | undefined) =>
    Boolean(value && LANGS.some(lang => (value[lang] || '').trim().length > 0));

const pushLocalized = (lines: string[], baseKey: string, value: LocalizedText, force = false) => {
    const shouldForce = force || hasAnyText(value);
    if (!shouldForce) return;

    for (const lang of LANGS) {
        if (!force && !(value[lang] || '').trim()) continue;
        lines.push(`${baseKey}.${lang} = ${block(value[lang] || '')}`);
    }
};

const pushLocalizedList = (lines: string[], prefix: string, values: LocalizedText[]) => {
    values.forEach((entry, index) => {
        for (const lang of LANGS) {
            if (!(entry[lang] || '').trim()) continue;
            lines.push(`${prefix}.${index + 1}.${lang} = ${block(entry[lang] || '')}`);
        }
    });
};

const pushAvgLines = (lines: string[], prefix: string, values: AvgLine[]) => {
    values.forEach((line, index) => {
        lines.push(`${prefix}.${index + 1}.speaker = ${line.speaker}`);
        if (line.portraitState) lines.push(`${prefix}.${index + 1}.portraitState = ${line.portraitState}`);
        if (line.portraitMotion) lines.push(`${prefix}.${index + 1}.portraitMotion = ${line.portraitMotion}`);
        if (line.backgroundSlot) lines.push(`${prefix}.${index + 1}.backgroundSlot = ${line.backgroundSlot}`);
        if (line.screenFilter) lines.push(`${prefix}.${index + 1}.screenFilter = ${line.screenFilter}`);
        if (line.screenImpulse) lines.push(`${prefix}.${index + 1}.screenImpulse = ${line.screenImpulse}`);
        if (line.transition) lines.push(`${prefix}.${index + 1}.transition = ${line.transition}`);
        for (const lang of LANGS) {
            if (!(line.text[lang] || '').trim()) continue;
            lines.push(`${prefix}.${index + 1}.${lang} = ${block(line.text[lang] || '')}`);
        }
    });
};

const pushFailureOverrides = (lines: string[], prefix: string, values: LocalFailureOverride[]) => {
    values.forEach((override, index) => {
        const base = `${prefix}.${index + 1}`;
        lines.push(`${base}.weakPointId = ${override.weakPointId}`);
        pushLocalized(lines, `${base}.narrative`, override.narrative, false);
        pushAvgLines(lines, `${base}.avg`, override.avg);
    });
};

const pushSuccessOverrides = (lines: string[], prefix: string, values: LocalSuccessOverride[]) => {
    values.forEach((override, index) => {
        const base = `${prefix}.${index + 1}`;
        lines.push(`${base}.weakPointId = ${override.weakPointId}`);
        pushLocalized(lines, `${base}.narrative`, override.narrative, false);
        pushAvgLines(lines, `${base}.avg`, override.avg);
    });
};

const pushInspectOverrides = (lines: string[], prefix: string, values: LocalInspectOverride[]) => {
    values.forEach((override, index) => {
        const base = `${prefix}.${index + 1}`;
        lines.push(`${base}.weakPointId = ${override.weakPointId}`);
        lines.push(`${base}.grantEvidence = ${(override.grantEvidenceIds || []).join('|')}`);
        lines.push(`${base}.revealLines = ${(override.revealLineIds || []).join('|')}`);
        pushLocalized(lines, `${base}.narrative`, override.narrative, false);
        pushAvgLines(lines, `${base}.avg`, override.avg);
    });
};

const localized = (value: string): LocalizedText => ({ zh: value, ja: value, en: value });

const defaultLineId = (index: number) => `line-${index}`;
const defaultWeakPointId = (turnIndex: number, weakIndex: number) => `t${turnIndex}-weak-${weakIndex}`;

const createBlankEvidence = (index: number): LocalEvidence => ({
    id: `evidence-${index}`,
    aliases: [],
    startsInInventory: true,
    name: localized(`Evidence ${index}`),
    detail: localized(`Describe evidence ${index}.`)
});

const createBlankAvgLine = (
    speaker: AvgLine['speaker'],
    text: LocalizedText = localized('Write this AVG line.')
): AvgLine => ({
    speaker,
    text,
    portraitState: speaker === 'hero' ? 'serious_focus' : speaker === 'enemy' ? 'neutral_idle' : undefined,
    portraitMotion: 'none'
});

const createBlankWeakPoint = (turnIndex: number, lineId: string, evidenceId: string): LocalWeakPoint => ({
    id: defaultWeakPointId(turnIndex, 1),
    lineId,
    evidenceId,
    consumeEvidenceOnUse: true,
    statement: localized('weak point')
});

const createBlankDialogueCard = (turnIndex: number, weakPointId: string): LocalDialogueCard => ({
    id: defaultLineId(turnIndex),
    hidden: false,
    unlockMode: DEFAULT_UNLOCK_MODE,
    unlockWeakPointIds: [],
    grantEvidenceIds: [],
    portraitState: undefined,
    portraitMotion: undefined,
    text: localized(`The suspect says ${encodeWeakPointMarker(weakPointId, 'weak point')} in this line.`)
});

const createBlankTurn = (index: number, evidenceId: string): LocalTurn => {
    const lineId = defaultLineId(index);
    const weakPoint = createBlankWeakPoint(index, lineId, evidenceId);
    const sharedSuccessNarrative = localized('Write the success narrative.');
    const sharedSuccessAvg = [
        createBlankAvgLine('hero'),
        createBlankAvgLine('enemy')
    ];
    const sharedFailureNarrative = localized('Write the failure narrative.');
    const sharedFailureAvg = [createBlankAvgLine('enemy')];
    return {
        weakPoints: [weakPoint],
        loopDialogues: [{
            ...createBlankDialogueCard(index, weakPoint.id),
            id: lineId
        }],
        startingEvidenceIds: [],
        queryNarratives: [localized('Write the query feedback.')],
        queryAvg: [],
        inspectOverrides: [],
        sceneBackgroundSlot: 'cross_exam',
        enemyPortraitState: 'neutral_idle',
        enemyPortraitMotion: 'none',
        screenFilter: 'none',
        screenImpulse: 'none',
        transition: 'cut',
        successNarrative: sharedSuccessNarrative,
        successOverrides: [],
        useSeparateTurnClear: false,
        turnClearNarrative: { ...sharedSuccessNarrative },
        turnClearAvg: sharedSuccessAvg.map(line => ({ ...line, text: { ...line.text } })),
        useSeparateFailureReasons: false,
        failNarrative: {
            wrongEvidence: { ...sharedFailureNarrative },
            wrongStatement: { ...sharedFailureNarrative },
            bothWrong: { ...sharedFailureNarrative }
        },
        logicExplanation: localized('Write the logic explanation for this turn.'),
        successAvg: sharedSuccessAvg,
        failAvg: {
            wrongEvidence: sharedFailureAvg.map(line => ({ ...line, text: { ...line.text } })),
            wrongStatement: sharedFailureAvg.map(line => ({ ...line, text: { ...line.text } })),
            bothWrong: sharedFailureAvg.map(line => ({ ...line, text: { ...line.text } }))
        },
        failOverrides: {
            wrongEvidence: [],
            wrongStatement: [],
            bothWrong: []
        },
        interferenceLines: []
    };
};

export const cloneLocalCaseData = (caseData: LocalCaseData): LocalCaseData =>
    JSON.parse(JSON.stringify(caseData)) as LocalCaseData;

export const createBlankLocalCaseData = (): LocalCaseData => {
    const firstEvidence = createBlankEvidence(1);

    return {
        caseId: 'new-case',
        caseTitle: localized('New Case'),
        defaultLang: 'zh',
        suspectName: localized('Suspect'),
        suspectEmoji: '',
        heroEmoji: '',
        intro: {
            narrative: localized('Write the opening case narrative.'),
            systemMsg: localized('Write the system hint.'),
            backgroundSlot: 'briefing',
            enemyPortraitState: 'neutral_idle',
            screenFilter: 'none',
            transition: 'fade'
        },
        evidences: [firstEvidence],
        turns: [createBlankTurn(1, firstEvidence.id)],
        victory: {
            narrative: localized('Write the ending summary.'),
            confession: localized('Write the confession.'),
            avg: [
                createBlankAvgLine('hero'),
                createBlankAvgLine('enemy'),
                createBlankAvgLine('system')
            ],
            backgroundSlot: 'confession',
            screenFilter: 'dim',
            transition: 'fade'
        }
    };
};

export const ensureCaseFilename = (filename: string, caseId?: string) => {
    const base = (filename || caseId || 'new-case')
        .trim()
        .replace(/\.case\.txt$/i, '')
        .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'new-case';

    return `${base}.case.txt`;
};

export const serializeLocalCaseText = (caseData: LocalCaseData) => {
    const lines: string[] = [];

    lines.push('[meta]');
    lines.push('version = LOCAL_CASE_TXT_V1');
    lines.push(`caseId = ${caseData.caseId}`);
    lines.push(`defaultLang = ${caseData.defaultLang}`);
    pushLocalized(lines, 'caseTitle', caseData.caseTitle, true);
    lines.push(`suspectEmoji = ${caseData.suspectEmoji || ''}`);
    lines.push(`heroEmoji = ${caseData.heroEmoji || ''}`);
    lines.push(`heroPortraitPackId = ${caseData.heroPortraitPackId || ''}`);
    lines.push(`enemyPortraitPackId = ${caseData.enemyPortraitPackId || ''}`);
    lines.push(`backgroundPackId = ${caseData.backgroundPackId || ''}`);
    pushLocalized(lines, 'suspectName', caseData.suspectName, true);
    lines.push('');

    lines.push('[intro]');
    pushLocalized(lines, 'narrative', caseData.intro.narrative, true);
    pushLocalized(lines, 'systemMsg', caseData.intro.systemMsg, true);
    lines.push(`backgroundSlot = ${caseData.intro.backgroundSlot || 'briefing'}`);
    lines.push(`enemyPortraitState = ${caseData.intro.enemyPortraitState || 'neutral_idle'}`);
    lines.push(`screenFilter = ${caseData.intro.screenFilter || 'none'}`);
    lines.push(`transition = ${caseData.intro.transition || 'fade'}`);
    lines.push('');

    caseData.evidences.forEach((evidence) => {
        lines.push(`[evidence:${evidence.id}]`);
        lines.push(`startsInInventory = ${evidence.startsInInventory === false ? 'false' : 'true'}`);
        lines.push(`aliases = ${(evidence.aliases || []).join('|')}`);
        pushLocalized(lines, 'name', evidence.name, true);
        pushLocalized(lines, 'detail', evidence.detail, true);
        lines.push('');
    });

    caseData.turns.forEach((turn, index) => {
        lines.push(`[turn:${index + 1}]`);

        turn.loopDialogues.forEach((dialogue, dialogueIndex) => {
            const base = `line.${dialogueIndex + 1}`;
            lines.push(`${base}.id = ${dialogue.id}`);
            lines.push(`${base}.hidden = ${dialogue.hidden ? 'true' : 'false'}`);
            lines.push(`${base}.unlockMode = ${dialogue.unlockMode || DEFAULT_UNLOCK_MODE}`);
            lines.push(`${base}.unlockWeakPoints = ${(dialogue.unlockWeakPointIds || []).join('|')}`);
            lines.push(`${base}.grantEvidence = ${(dialogue.grantEvidenceIds || []).join('|')}`);
            if (dialogue.portraitState) lines.push(`${base}.portraitState = ${dialogue.portraitState}`);
            if (dialogue.portraitMotion) lines.push(`${base}.portraitMotion = ${dialogue.portraitMotion}`);
            pushLocalized(lines, base, dialogue.text, true);
        });

        lines.push(`startingEvidence = ${(turn.startingEvidenceIds || []).join('|')}`);

        turn.weakPoints.forEach((weakPoint, weakIndex) => {
            const base = `weakPoint.${weakIndex + 1}`;
            lines.push(`${base}.id = ${weakPoint.id}`);
            lines.push(`${base}.lineId = ${weakPoint.lineId}`);
            lines.push(`${base}.evidenceId = ${weakPoint.evidenceId || ''}`);
            lines.push(`${base}.consumeEvidenceOnUse = ${weakPoint.consumeEvidenceOnUse === false ? 'false' : 'true'}`);
            pushLocalized(lines, base, weakPoint.statement, true);
        });

        pushLocalizedList(lines, 'query', turn.queryNarratives);
        pushAvgLines(lines, 'queryAvg', turn.queryAvg);
        pushInspectOverrides(lines, 'inspectOverride', turn.inspectOverrides || []);
        lines.push(`sceneBackgroundSlot = ${turn.sceneBackgroundSlot || 'cross_exam'}`);
        lines.push(`enemyPortraitState = ${turn.enemyPortraitState || 'neutral_idle'}`);
        lines.push(`enemyPortraitMotion = ${turn.enemyPortraitMotion || 'none'}`);
        lines.push(`screenFilter = ${turn.screenFilter || 'none'}`);
        lines.push(`screenImpulse = ${turn.screenImpulse || 'none'}`);
        lines.push(`transition = ${turn.transition || 'cut'}`);
        pushLocalized(lines, 'successNarrative', turn.successNarrative, true);
        pushSuccessOverrides(lines, 'successOverride', turn.successOverrides || []);
        lines.push(`useSeparateTurnClear = ${turn.useSeparateTurnClear ? 'true' : 'false'}`);
        pushLocalized(lines, 'turnClearNarrative', turn.turnClearNarrative, true);
        pushAvgLines(lines, 'turnClearAvg', turn.turnClearAvg);
        lines.push(`useSeparateFailureReasons = ${turn.useSeparateFailureReasons ? 'true' : 'false'}`);

        FAIL_REASONS.forEach(reason => {
            pushLocalized(lines, `failNarrative.${reason}`, turn.failNarrative[reason], true);
        });

        pushLocalized(lines, 'logicExplanation', turn.logicExplanation, true);
        pushAvgLines(lines, 'successAvg', turn.successAvg);

        FAIL_REASONS.forEach(reason => {
            pushAvgLines(lines, `failAvg.${reason}`, turn.failAvg[reason]);
            pushFailureOverrides(lines, `failOverride.${reason}`, turn.failOverrides[reason] || []);
        });

        pushLocalizedList(lines, 'interference', turn.interferenceLines || []);
        lines.push('');
    });

    lines.push('[victory]');
    pushLocalized(lines, 'narrative', caseData.victory.narrative, true);
    pushLocalized(lines, 'confession', caseData.victory.confession, true);
    lines.push(`backgroundSlot = ${caseData.victory.backgroundSlot || 'confession'}`);
    lines.push(`screenFilter = ${caseData.victory.screenFilter || 'dim'}`);
    lines.push(`transition = ${caseData.victory.transition || 'fade'}`);
    pushAvgLines(lines, 'avg', caseData.victory.avg);

    return `${lines.join('\n').trim()}\n`;
};

export const normalizeLocalCaseText = (source: string) => {
    const caseData = parseLocalCaseText(source);
    return {
        caseData,
        normalizedText: serializeLocalCaseText(caseData)
    };
};

export const createBlankLocalEvidence = createBlankEvidence;
export const createBlankLocalTurn = createBlankTurn;
export const createBlankLocalizedText = () => localized('Write the text.');
export const createBlankAvgDialogueLine = createBlankAvgLine;
