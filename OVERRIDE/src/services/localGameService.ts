import { Language } from '../types';
import { buildMarkedText, parseWeakPointMarkers } from './localCaseMarkers';
import { textFor } from './localCaseParser';
import { AvgLine, FailureReason, LocalCaseData, LocalDialogueCard, LocalEvidence, LocalTurn, LocalWeakPoint } from './localCaseTypes';

interface EvidenceCommand {
    evidenceName: string;
    statement: string;
    weakPointId?: string;
}

interface InspectCommand {
    statement: string;
    weakPointId?: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const normalize = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').trim();

const parseEvidenceCommand = (input: string): EvidenceCommand | null => {
    const modern = input.match(/\[USE_EVIDENCE:\s*(.*?)\]\s*\[TARGET_STATEMENT:\s*"((?:\\"|[^"])*)"\s*\](?:\s*\[TARGET_WEAK_POINT_ID:\s*"((?:\\"|[^"])*)"\s*\])?/i);
    if (modern) {
        return {
            evidenceName: modern[1].trim(),
            statement: modern[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim(),
            weakPointId: modern[3]?.trim() || undefined
        };
    }

    const legacy = input.match(/\[[^\]]*:\s*(.*?)\]\s*[^"]*"(.*?)"/);
    if (legacy) {
        return {
            evidenceName: legacy[1].trim(),
            statement: legacy[2].trim()
        };
    }

    return null;
};

const parseInspectCommand = (input: string): InspectCommand | null => {
    const modern = input.match(/\[INSPECT_STATEMENT:\s*"((?:\\"|[^"])*)"\s*\](?:\s*\[TARGET_WEAK_POINT_ID:\s*"((?:\\"|[^"])*)"\s*\])?/i);
    if (!modern) {
        return null;
    }

    return {
        statement: modern[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim(),
        weakPointId: modern[2]?.trim() || undefined
    };
};

const evidenceMatches = (evidence: LocalEvidence, usedName: string): boolean => {
    const target = normalize(usedName);
    if (!target) return false;

    const forms = [evidence.id, ...evidence.aliases, ...Object.values(evidence.name)]
        .filter(Boolean)
        .map(normalize);

    return forms.some(value => value === target || value.includes(target) || target.includes(value));
};

const statementMatches = (input: string, expected: string): boolean => {
    const source = normalize(input);
    const target = normalize(expected);
    return Boolean(source && target && (source.includes(target) || target.includes(source)));
};

const buildAvgSequence = (lines: AvgLine[], lang: Language, defaultLang: Language) =>
    lines.map(line => ({
        speaker: line.speaker,
        text: textFor(line.text, lang, defaultLang),
        portrait_state: line.portraitState,
        portrait_motion: line.portraitMotion,
        background_slot: line.backgroundSlot,
        screen_filter: line.screenFilter,
        screen_impulse: line.screenImpulse,
        transition: line.transition
    }));

const buildInterference = (turn: LocalTurn, lang: Language, defaultLang: Language) =>
    (turn.interferenceLines || [])
        .map(line => textFor(line, lang, defaultLang))
        .filter(Boolean);

const trueWeakPoints = (turn: LocalTurn) => turn.weakPoints.filter(weakPoint => Boolean(weakPoint.evidenceId));
const hasLocalizedContent = (value: Record<string, string | undefined>) => Object.values(value).some(item => Boolean(item && item.trim()));
const buildTurnScene = (turn: LocalTurn, fallbackSlot = 'cross_exam') => ({
    background_slot: turn.sceneBackgroundSlot || fallbackSlot,
    enemy_portrait_state: turn.enemyPortraitState || 'neutral_idle',
    enemy_portrait_motion: turn.enemyPortraitMotion || 'none',
    screen_filter: turn.screenFilter || 'none',
    screen_impulse: turn.screenImpulse || 'none',
    transition: turn.transition || 'cut'
});

export interface LocalResponse {
    attack_type: 'strict' | 'fuzzy' | 'query' | 'miss';
    enemy_dmg_taken: number;
    hero_dmg_taken: number;
    enemy_dialogue: string;
    turn_index?: number;
    dialogue_sequence?: {
        text: string;
        portrait_state?: string;
        portrait_motion?: string;
    }[];
    narrative: string;
    used_evidence?: string;
    removed_evidence?: string;
    suspect_name?: string;
    identity_enemy_emoji?: string;
    identity_hero_emoji?: string;
    enemy_surrendered?: boolean;
    logic_explanation?: string;
    resolved_statement?: string;
    resolved_weak_point_id?: string;
    evidences?: { name: string; detail: string }[];
    granted_evidences?: { name: string; detail: string }[];
    system_msg?: string;
    enemy_emoji?: string;
    avg_sequence?: {
        speaker: 'hero' | 'enemy' | 'system';
        text: string;
        portrait_state?: string;
        portrait_motion?: string;
        background_slot?: string;
        screen_filter?: string;
        screen_impulse?: string;
        transition?: string;
    }[];
    popup_interference?: boolean;
    interference_lines?: string[];
    background_slot?: string;
    enemy_portrait_state?: string;
    enemy_portrait_motion?: string;
    screen_filter?: string;
    screen_impulse?: string;
    transition?: string;
}

export class LocalGameService {
    private readonly lang: Language;
    private readonly caseDataPromise: Promise<LocalCaseData>;
    private caseData: LocalCaseData | null = null;
    private currentTurnIndex = 0;
    private loopCursorByTurn: number[] = [];
    private queryCursorByTurn: number[] = [];
    private solvedWeakPointsByTurn: Array<Set<string>> = [];
    private inspectedWeakPointsByTurn: Array<Set<string>> = [];
    private visibleLineIdsByTurn: Array<Set<string>> = [];
    private grantedEvidenceIds = new Set<string>();

    constructor(lang: Language, caseData: LocalCaseData) {
        this.lang = lang;
        this.caseDataPromise = Promise.resolve(caseData).then(data => {
            this.caseData = data;
            this.reset(data);
            return data;
        });
    }

    private async ensureCaseData() {
        if (this.caseData) return this.caseData;
        this.caseData = await this.caseDataPromise;
        return this.caseData;
    }

    private reset(caseData: LocalCaseData) {
        this.currentTurnIndex = 0;
        this.loopCursorByTurn = caseData.turns.map(() => 0);
        this.queryCursorByTurn = caseData.turns.map(() => 0);
        this.solvedWeakPointsByTurn = caseData.turns.map(() => new Set<string>());
        this.inspectedWeakPointsByTurn = caseData.turns.map(() => new Set<string>());
        this.visibleLineIdsByTurn = caseData.turns.map(turn => new Set(turn.loopDialogues.filter(line => !line.hidden).map(line => line.id)));
        this.grantedEvidenceIds = new Set(caseData.evidences.filter(evidence => evidence.startsInInventory !== false).map(evidence => evidence.id));
        for (const evidenceId of caseData.turns[0]?.startingEvidenceIds || []) {
            this.grantedEvidenceIds.add(evidenceId);
        }
    }

    private identity(caseData: LocalCaseData) {
        return {
            suspect_name: textFor(caseData.suspectName, this.lang, caseData.defaultLang),
            identity_enemy_emoji: caseData.suspectEmoji,
            identity_hero_emoji: caseData.heroEmoji,
            enemy_emoji: caseData.suspectEmoji
        };
    }

    private currentTurn(caseData: LocalCaseData) {
        const max = caseData.turns.length - 1;
        return caseData.turns[Math.min(this.currentTurnIndex, max)];
    }

    private turnStartingEvidenceIds(caseData: LocalCaseData, turnIndex: number) {
        return this.grantEvidenceIds(caseData.turns[turnIndex]?.startingEvidenceIds);
    }

    private solvedSet(turnIndex: number) {
        return this.solvedWeakPointsByTurn[Math.max(0, Math.min(turnIndex, this.solvedWeakPointsByTurn.length - 1))] || new Set<string>();
    }

    private inspectedSet(turnIndex: number) {
        return this.inspectedWeakPointsByTurn[Math.max(0, Math.min(turnIndex, this.inspectedWeakPointsByTurn.length - 1))] || new Set<string>();
    }

    private lineVisible(turn: LocalTurn, line: LocalDialogueCard, solvedSet: Set<string>) {
        if (!line.hidden) return true;
        if (this.visibleLineIdsByTurn[this.currentTurnIndex]?.has(line.id)) return true;

        switch (line.unlockMode || 'none') {
            case 'allTrueWeakPoints': {
                const required = trueWeakPoints(turn)
                    .filter(weakPoint => weakPoint.lineId !== line.id)
                    .map(weakPoint => weakPoint.id);
                return required.length > 0 && required.every(id => solvedSet.has(id));
            }
            case 'specificWeakPoints': {
                const required = line.unlockWeakPointIds || [];
                return required.length > 0 && required.every(id => solvedSet.has(id));
            }
            default:
                return false;
        }
    }

    private lineRetired(turn: LocalTurn, line: LocalDialogueCard, solvedSet: Set<string>) {
        const weakPointsOnLine = trueWeakPoints(turn).filter(weakPoint => weakPoint.lineId === line.id);
        if (weakPointsOnLine.length === 0) {
            return false;
        }
        return weakPointsOnLine.every(weakPoint => solvedSet.has(weakPoint.id));
    }

    private renderDialogueText(line: LocalDialogueCard, solvedSet: Set<string>, lang: Language, defaultLang: Language) {
        const raw = textFor(line.text, lang, defaultLang);
        const parsed = parseWeakPointMarkers(raw);
        const visibleMarkers = parsed.markers.filter(marker => !marker.id || !solvedSet.has(marker.id));
        return buildMarkedText(parsed.plain, visibleMarkers.map(marker => ({ ...marker, id: undefined })));
    }

    private visibleDialogues(caseData: LocalCaseData, turnIndex: number) {
        const turn = caseData.turns[turnIndex];
        const solvedSet = this.solvedSet(turnIndex);
        const visibleIds = this.visibleLineIdsByTurn[turnIndex] || new Set<string>();
        const lines = turn.loopDialogues.filter(line => {
            if (this.lineRetired(turn, line, solvedSet)) {
                return false;
            }
            return !line.hidden || visibleIds.has(line.id) || this.lineVisible(turn, line, solvedSet);
        });
        if (lines.length > 0) {
            return lines;
        }

        const nonHidden = turn.loopDialogues.filter(line => !line.hidden && !this.lineRetired(turn, line, solvedSet));
        if (nonHidden.length > 0) {
            return nonHidden;
        }

        return turn.loopDialogues.slice(0, 1);
    }

    private nextDialogue(caseData: LocalCaseData, turnIndex: number) {
        return this.nextDialogueSequence(caseData, turnIndex)
            .map(item => item.text)
            .filter(Boolean)
            .join('\n');
    }

    private nextDialogueSequence(caseData: LocalCaseData, turnIndex: number) {
        const index = Math.max(0, Math.min(turnIndex, caseData.turns.length - 1));
        const turn = caseData.turns[index];
        const solved = this.solvedSet(index);
        const visible = this.visibleDialogues(caseData, index);
        const toDialogue = (line: LocalDialogueCard) => ({
            text: this.renderDialogueText(line, solved, this.lang, caseData.defaultLang),
            portrait_state: line.portraitState,
            portrait_motion: line.portraitMotion
        });

        const sequence = visible
            .map(toDialogue)
            .filter(item => Boolean(item.text && item.text.trim()));
        if (sequence.length > 0) {
            return sequence;
        }

        const firstLine = turn.loopDialogues[0];
        if (!firstLine) {
            return [];
        }
        const fallback = toDialogue(firstLine);
        return fallback.text ? [fallback] : [];
    }

    private nextQuery(caseData: LocalCaseData, turnIndex: number) {
        const index = Math.max(0, Math.min(turnIndex, caseData.turns.length - 1));
        const turn = caseData.turns[index];
        const cursor = this.queryCursorByTurn[index] ?? 0;
        const line = turn.queryNarratives[cursor % turn.queryNarratives.length];
        this.queryCursorByTurn[index] = (cursor + 1) % turn.queryNarratives.length;
        return textFor(line, this.lang, caseData.defaultLang);
    }

    private queryAvg(turn: LocalTurn, caseData: LocalCaseData) {
        if (!turn.queryAvg || turn.queryAvg.length === 0) {
            return undefined;
        }

        return buildAvgSequence(turn.queryAvg, this.lang, caseData.defaultLang);
    }

    private failureReason(targetWeakPoint: LocalWeakPoint | null, correctEvidence: boolean): FailureReason {
        if (!targetWeakPoint) return 'wrongStatement';
        if (!targetWeakPoint.evidenceId) return 'wrongStatement';
        if (!correctEvidence) return 'wrongEvidence';
        return 'bothWrong';
    }

    private toEvidencePayload(caseData: LocalCaseData, evidenceIds: Iterable<string>) {
        return Array.from(evidenceIds)
            .map(evidenceId => caseData.evidences.find(evidence => evidence.id === evidenceId))
            .filter((evidence): evidence is LocalEvidence => Boolean(evidence))
            .map(evidence => ({
                name: textFor(evidence.name, this.lang, caseData.defaultLang),
                detail: textFor(evidence.detail, this.lang, caseData.defaultLang)
            }));
    }

    private grantEvidenceIds(evidenceIds?: string[]) {
        const granted: string[] = [];
        for (const evidenceId of evidenceIds || []) {
            if (!this.grantedEvidenceIds.has(evidenceId)) {
                this.grantedEvidenceIds.add(evidenceId);
                granted.push(evidenceId);
            }
        }
        return granted;
    }

    private grantEvidenceForLine(caseData: LocalCaseData, turnIndex: number, lineId?: string) {
        if (!lineId) return [];
        const line = caseData.turns[turnIndex]?.loopDialogues.find(item => item.id === lineId);
        return this.grantEvidenceIds(line?.grantEvidenceIds);
    }

    private revealUnlockedLines(caseData: LocalCaseData, turnIndex: number) {
        const turn = caseData.turns[turnIndex];
        const solvedSet = this.solvedSet(turnIndex);
        const visibleSet = this.visibleLineIdsByTurn[turnIndex] || new Set<string>();
        const granted: string[] = [];

        for (const line of turn.loopDialogues) {
            if (!line.hidden || visibleSet.has(line.id)) {
                continue;
            }
            if (!this.lineVisible(turn, line, solvedSet)) {
                continue;
            }

            visibleSet.add(line.id);
            granted.push(...this.grantEvidenceIds(line.grantEvidenceIds));
        }

        this.visibleLineIdsByTurn[turnIndex] = visibleSet;
        return granted;
    }

    private revealSpecificLines(caseData: LocalCaseData, turnIndex: number, lineIds?: string[]) {
        const turn = caseData.turns[turnIndex];
        const visibleSet = this.visibleLineIdsByTurn[turnIndex] || new Set<string>();
        const granted: string[] = [];

        for (const lineId of lineIds || []) {
            const line = turn.loopDialogues.find(item => item.id === lineId);
            if (!line || visibleSet.has(line.id)) {
                continue;
            }

            visibleSet.add(line.id);
            granted.push(...this.grantEvidenceIds(line.grantEvidenceIds));
        }

        this.visibleLineIdsByTurn[turnIndex] = visibleSet;
        return granted;
    }

    private findTargetWeakPoint(turn: LocalTurn, command: EvidenceCommand, defaultLang: Language) {
        const solvedIds = this.solvedSet(this.currentTurnIndex);
        const candidates = turn.weakPoints.filter(weakPoint => !solvedIds.has(weakPoint.id));

        if (command.weakPointId) {
            return candidates.find(weakPoint => weakPoint.id === command.weakPointId) || null;
        }

        return candidates.find(weakPoint => statementMatches(command.statement, textFor(weakPoint.statement, this.lang, defaultLang)))
            || null;
    }

    private failureOverride(turn: LocalTurn, reason: FailureReason, weakPointId?: string) {
        if (!weakPointId) {
            return null;
        }

        const sourceReason = turn.useSeparateFailureReasons ? reason : 'wrongEvidence';
        return (turn.failOverrides[sourceReason] || []).find(override => override.weakPointId === weakPointId) || null;
    }

    private successOverride(turn: LocalTurn, weakPointId?: string) {
        if (!weakPointId) {
            return null;
        }

        return (turn.successOverrides || []).find(override => override.weakPointId === weakPointId) || null;
    }

    private inspectOverride(turn: LocalTurn, weakPointId?: string) {
        if (!weakPointId) {
            return null;
        }

        return (turn.inspectOverrides || []).find(override => override.weakPointId === weakPointId) || null;
    }

    public async handleAction(input: string, _gameState?: { enemyHp?: number }): Promise<LocalResponse> {
        const caseData = await this.ensureCaseData();
        await wait(220);

        if (input === '[SYSTEM: GENERATE_PROLOGUE]') {
            this.reset(caseData);
            const turn = this.currentTurn(caseData);
            const initialEvidenceIds = Array.from(new Set([
                ...caseData.evidences
                    .filter(evidence => evidence.startsInInventory !== false)
                    .map(evidence => evidence.id),
                ...this.turnStartingEvidenceIds(caseData, 0)
            ]));
            return {
                attack_type: 'query',
                enemy_dmg_taken: 0,
                hero_dmg_taken: 0,
                enemy_dialogue: this.nextDialogue(caseData, 0),
                turn_index: 1,
                dialogue_sequence: this.nextDialogueSequence(caseData, 0),
                narrative: textFor(caseData.intro.narrative, this.lang, caseData.defaultLang),
                system_msg: textFor(caseData.intro.systemMsg, this.lang, caseData.defaultLang),
                evidences: this.toEvidencePayload(caseData, initialEvidenceIds),
                popup_interference: buildInterference(turn, this.lang, caseData.defaultLang).length > 0,
                interference_lines: buildInterference(turn, this.lang, caseData.defaultLang),
                background_slot: caseData.intro.backgroundSlot || 'briefing',
                enemy_portrait_state: turn.enemyPortraitState || 'neutral_idle',
                enemy_portrait_motion: turn.enemyPortraitMotion || 'none',
                screen_filter: caseData.intro.screenFilter || 'none',
                screen_impulse: 'none',
                transition: caseData.intro.transition || 'fade',
                ...this.identity(caseData)
            };
        }

        const turn = this.currentTurn(caseData);
        const inspectCommand = parseInspectCommand(input);
        if (inspectCommand) {
            const targetWeakPoint = this.findTargetWeakPoint(turn, {
                evidenceName: '',
                statement: inspectCommand.statement,
                weakPointId: inspectCommand.weakPointId
            }, caseData.defaultLang);
            const inspectOverride = this.inspectOverride(turn, targetWeakPoint?.id);

            if (targetWeakPoint) {
                this.inspectedSet(this.currentTurnIndex).add(targetWeakPoint.id);
            }

            const grantedEvidenceIds = targetWeakPoint
                ? Array.from(new Set([
                    ...this.grantEvidenceIds(inspectOverride?.grantEvidenceIds),
                    ...this.revealSpecificLines(caseData, this.currentTurnIndex, inspectOverride?.revealLineIds)
                ]))
                : [];

            const grantedEvidences = this.toEvidencePayload(caseData, grantedEvidenceIds);
            const inspectNarrative = inspectOverride && hasLocalizedContent(inspectOverride.narrative)
                ? textFor(inspectOverride.narrative, this.lang, caseData.defaultLang)
                : this.nextQuery(caseData, this.currentTurnIndex);
            const inspectAvg = inspectOverride && inspectOverride.avg.length > 0
                ? buildAvgSequence(inspectOverride.avg, this.lang, caseData.defaultLang)
                : this.queryAvg(turn, caseData);

            return {
                attack_type: 'query',
                enemy_dmg_taken: 0,
                hero_dmg_taken: 0,
                enemy_dialogue: this.nextDialogue(caseData, this.currentTurnIndex),
                turn_index: this.currentTurnIndex + 1,
                dialogue_sequence: this.nextDialogueSequence(caseData, this.currentTurnIndex),
                narrative: inspectNarrative,
                granted_evidences: grantedEvidences,
                avg_sequence: inspectAvg,
                popup_interference: buildInterference(turn, this.lang, caseData.defaultLang).length > 0,
                interference_lines: buildInterference(turn, this.lang, caseData.defaultLang),
                ...buildTurnScene(turn),
                ...this.identity(caseData)
            };
        }

        const command = parseEvidenceCommand(input);

        if (!command) {
            return {
                attack_type: 'query',
                enemy_dmg_taken: 0,
                hero_dmg_taken: 5,
                enemy_dialogue: this.nextDialogue(caseData, this.currentTurnIndex),
                turn_index: this.currentTurnIndex + 1,
                dialogue_sequence: this.nextDialogueSequence(caseData, this.currentTurnIndex),
                narrative: this.nextQuery(caseData, this.currentTurnIndex),
                popup_interference: buildInterference(turn, this.lang, caseData.defaultLang).length > 0,
                interference_lines: buildInterference(turn, this.lang, caseData.defaultLang),
                ...buildTurnScene(turn),
                ...this.identity(caseData)
            };
        }

        const targetWeakPoint = this.findTargetWeakPoint(turn, command, caseData.defaultLang);
        const targetEvidence = targetWeakPoint?.evidenceId
            ? caseData.evidences.find(item => item.id === targetWeakPoint.evidenceId)
            : null;
        const correctEvidence = targetEvidence ? evidenceMatches(targetEvidence, command.evidenceName) : false;
        const correctStatement = Boolean(
            targetWeakPoint && statementMatches(command.statement, textFor(targetWeakPoint.statement, this.lang, caseData.defaultLang))
        );

        if (!targetWeakPoint || !correctStatement || !correctEvidence) {
            const reason = this.failureReason(targetWeakPoint, correctEvidence);
            const override = this.failureOverride(turn, reason, targetWeakPoint?.id);
            const failReason = turn.useSeparateFailureReasons ? reason : 'wrongEvidence';
            const overrideNarrative = override && hasLocalizedContent(override.narrative)
                ? textFor(override.narrative, this.lang, caseData.defaultLang)
                : '';
            const overrideAvg = override && override.avg.length > 0
                ? buildAvgSequence(override.avg, this.lang, caseData.defaultLang)
                : [];
            return {
                attack_type: 'miss',
                enemy_dmg_taken: 0,
                hero_dmg_taken: 10,
                enemy_dialogue: this.nextDialogue(caseData, this.currentTurnIndex),
                turn_index: this.currentTurnIndex + 1,
                dialogue_sequence: this.nextDialogueSequence(caseData, this.currentTurnIndex),
                narrative: overrideNarrative || textFor(turn.failNarrative[failReason], this.lang, caseData.defaultLang),
                avg_sequence: overrideAvg.length > 0 ? overrideAvg : buildAvgSequence(turn.failAvg[failReason], this.lang, caseData.defaultLang),
                popup_interference: buildInterference(turn, this.lang, caseData.defaultLang).length > 0,
                interference_lines: buildInterference(turn, this.lang, caseData.defaultLang),
                ...buildTurnScene(turn),
                ...this.identity(caseData)
            };
        }

        this.solvedSet(this.currentTurnIndex).add(targetWeakPoint.id);
        const usedEvidence = targetEvidence
            ? textFor(targetEvidence.name, this.lang, caseData.defaultLang)
            : command.evidenceName;
        const removedEvidence = targetWeakPoint.consumeEvidenceOnUse === false ? undefined : usedEvidence;
        const resolvedStatement = textFor(targetWeakPoint.statement, this.lang, caseData.defaultLang);
        const logicExplanation = textFor(turn.logicExplanation, this.lang, caseData.defaultLang);
        const grantedEvidenceIds = Array.from(new Set([
            ...this.grantEvidenceForLine(caseData, this.currentTurnIndex, targetWeakPoint.lineId),
            ...this.revealUnlockedLines(caseData, this.currentTurnIndex)
        ]));
        const grantedEvidences = this.toEvidencePayload(caseData, grantedEvidenceIds);
        const allSolved = trueWeakPoints(turn).every(weakPoint => this.solvedSet(this.currentTurnIndex).has(weakPoint.id));
        const successOverride = this.successOverride(turn, targetWeakPoint.id);
        const successNarrative = successOverride && hasLocalizedContent(successOverride.narrative)
            ? textFor(successOverride.narrative, this.lang, caseData.defaultLang)
            : textFor(turn.successNarrative, this.lang, caseData.defaultLang);
        const successAvg = successOverride && successOverride.avg.length > 0
            ? buildAvgSequence(successOverride.avg, this.lang, caseData.defaultLang)
            : buildAvgSequence(turn.successAvg, this.lang, caseData.defaultLang);
        const turnClearNarrative = turn.useSeparateTurnClear
            ? textFor(turn.turnClearNarrative, this.lang, caseData.defaultLang)
            : successNarrative;
        const turnClearAvg = turn.useSeparateTurnClear
            ? buildAvgSequence(turn.turnClearAvg, this.lang, caseData.defaultLang)
            : successAvg;

        if (!allSolved) {
            return {
                attack_type: 'strict',
                enemy_dmg_taken: 15,
                hero_dmg_taken: -5,
                enemy_dialogue: this.nextDialogue(caseData, this.currentTurnIndex),
                turn_index: this.currentTurnIndex + 1,
                dialogue_sequence: this.nextDialogueSequence(caseData, this.currentTurnIndex),
                narrative: successNarrative,
                used_evidence: usedEvidence,
                removed_evidence: removedEvidence,
                resolved_statement: resolvedStatement,
                resolved_weak_point_id: targetWeakPoint.id,
                logic_explanation: logicExplanation,
                granted_evidences: grantedEvidences,
                avg_sequence: successAvg,
                popup_interference: buildInterference(turn, this.lang, caseData.defaultLang).length > 0,
                interference_lines: buildInterference(turn, this.lang, caseData.defaultLang),
                ...buildTurnScene(turn),
                ...this.identity(caseData)
            };
        }

        const isFinalTurn = this.currentTurnIndex >= caseData.turns.length - 1;
        if (isFinalTurn) {
            return {
                attack_type: 'strict',
                enemy_dmg_taken: 10,
                hero_dmg_taken: -10,
                enemy_dialogue: textFor(caseData.victory.confession, this.lang, caseData.defaultLang),
                turn_index: this.currentTurnIndex + 1,
                dialogue_sequence: [{
                    text: textFor(caseData.victory.confession, this.lang, caseData.defaultLang),
                    portrait_state: 'sad_confession',
                    portrait_motion: 'none'
                }],
                narrative: textFor(caseData.victory.narrative, this.lang, caseData.defaultLang),
                used_evidence: usedEvidence,
                removed_evidence: removedEvidence,
                resolved_statement: resolvedStatement,
                resolved_weak_point_id: targetWeakPoint.id,
                logic_explanation: logicExplanation,
                granted_evidences: grantedEvidences,
                enemy_surrendered: true,
                avg_sequence: buildAvgSequence(caseData.victory.avg, this.lang, caseData.defaultLang),
                popup_interference: false,
                background_slot: caseData.victory.backgroundSlot || 'confession',
                enemy_portrait_state: 'sad_confession',
                enemy_portrait_motion: 'none',
                screen_filter: caseData.victory.screenFilter || 'dim',
                screen_impulse: 'none',
                transition: caseData.victory.transition || 'fade',
                ...this.identity(caseData)
            };
        }

        this.currentTurnIndex += 1;
        const nextTurn = this.currentTurn(caseData);
        const nextTurnStartingEvidenceIds = this.turnStartingEvidenceIds(caseData, this.currentTurnIndex);
        return {
            attack_type: 'strict',
            enemy_dmg_taken: 30,
            hero_dmg_taken: -10,
            enemy_dialogue: this.nextDialogue(caseData, this.currentTurnIndex),
            turn_index: this.currentTurnIndex + 1,
            dialogue_sequence: this.nextDialogueSequence(caseData, this.currentTurnIndex),
            narrative: turnClearNarrative,
            used_evidence: usedEvidence,
            removed_evidence: removedEvidence,
            resolved_statement: resolvedStatement,
            resolved_weak_point_id: targetWeakPoint.id,
            logic_explanation: logicExplanation,
            granted_evidences: this.toEvidencePayload(caseData, Array.from(new Set([
                ...grantedEvidenceIds,
                ...nextTurnStartingEvidenceIds
            ]))),
            avg_sequence: turnClearAvg,
            popup_interference: buildInterference(nextTurn, this.lang, caseData.defaultLang).length > 0,
            interference_lines: buildInterference(nextTurn, this.lang, caseData.defaultLang),
            ...buildTurnScene(nextTurn),
            ...this.identity(caseData)
        };
    }
}
