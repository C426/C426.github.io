import React, { useState, useRef, useEffect, useMemo } from 'react';
import { StartScreen } from './components/StartScreen';
import { ConfigScreen } from './components/ConfigScreen';
import { GameScreen } from './components/GameScreen';
import { Tooltip } from './components/Tooltip';
import { DevConsole } from './components/DevConsole';
import { TopButtons } from './components/TopButtons';
import { GeminiAdapter, OpenAIAdapter } from './aiAdapter';
import { LocalGameService } from './services/localGameService';
import { i18n } from './i18n';
import { filterEmoji, normalizeText } from './utils';
import { ScreenType, Language, GameState, LogEntry, ResolvedStatement, TooltipState, GamePhase, AvgDialogueLine, EvidenceEntry, ConnectionRequest, DialogueCueLine, RoundIntroRequest, DialogueSpeaker } from './types';
import { Token, parseTokens } from './components/TypingBlock';
import { IntroScreen } from './components/IntroScreen';
import { RetroBootScreen } from './components/RetroBootScreen';
import { EndScreen } from './components/EndScreen';
import { EvidenceRewardScreen } from './components/EvidenceRewardScreen';
import type { SystemLoadRow } from './components/SystemLoadPanel';
import { primeSfxAudio } from './utils/sfx';
import { getLocalCaseById, getLocalCaseOptions, LocalCaseOption } from './services/localCaseLibrary';
import { getLocalCaseWorkspaceInfo, linkLocalCaseWorkspace, LocalCaseWorkspaceInfo, saveCaseFileAs } from './services/localCaseWorkspace';
import {
    getBackgroundPackOptions,
    getPortraitPackOptions,
    resolveSceneCastSelection
} from './services/sceneAssetLibrary';
import {
    DEFAULT_RUNTIME_SCENE_STATE,
    DEFAULT_SCENE_CAST_SELECTION,
    BackgroundPackOption,
    PortraitPackOption,
    BACKGROUND_SLOTS,
    PORTRAIT_MOTIONS,
    PORTRAIT_STATES,
    SCREEN_FILTERS,
    SCREEN_IMPULSES,
    SCENE_TRANSITIONS
} from './services/sceneAssetTypes';
import { enemyPortraitStateFromAttackType } from './services/sceneRuntime';
import { encodeWeakPointMarker } from './services/localCaseMarkers';
import { ensureCaseFilename, serializeLocalCaseText } from './services/localCaseFormatter';
import { parseLocalCaseText } from './services/localCaseParser';
import {
    AvgLine as LocalAvgLine,
    FailureReason,
    LocalCaseData,
    LocalDialogueCard,
    LocalEvidence,
    LocalFailureOverride,
    LocalInspectOverride,
    LocalSuccessOverride,
    LocalTurn,
    LocalWeakPoint,
    LocalizedText
} from './services/localCaseTypes';

const createInitialGameState = (
    castSelection = DEFAULT_SCENE_CAST_SELECTION
): GameState => ({
    heroHp: 100,
    enemyHp: 100,
    isOver: false,
    suspectName: null,
    fixedHeroEmoji: null,
    fixedEnemyEmoji: null,
    fatalTurnCount: 0,
    phase: 'idle',
    scene: {
        ...DEFAULT_RUNTIME_SCENE_STATE,
        backgroundPackId: castSelection.backgroundPackId,
        heroPortraitPackId: castSelection.heroPortraitPackId,
        enemyPortraitPackId: castSelection.enemyPortraitPackId
    },
    castSelection
});

const AI_TOTAL_TURNS = 3;
const AI_MIN_TRUE_WEAK_POINTS = 3;
const AI_ROUND_DAMAGE_BUDGET: Record<number, number> = {
    1: 30,
    2: 30,
    3: 40
};

const restartUiText = {
    zh: {
        menuTitle: '重新开始选项',
        menuSubtitle: '选择要如何处理当前这局已生成的剧本。',
        retryTurn: '从当前轮重开',
        retryTurnDesc: '回到这一轮刚开始的状态，保留当前这局剧本和后续缓存。',
        restartCase: '从本局第一轮重开',
        restartCaseDesc: '使用当前这份已生成剧本，从第一轮重新游玩。',
        newGame: '开始新游戏',
        newGameDesc: '清空当前缓存，让 AI 重新生成一份全新的剧本。',
        home: '退出到主界面',
        homeDesc: '离开当前游戏并清空这局缓存。',
        cancel: '取消',
        cancelDesc: '保持当前状态，不做改动。'
    },
    ja: {
        menuTitle: '再開オプション',
        menuSubtitle: '現在の生成済みシナリオをどう扱うか選んでください。',
        retryTurn: '現在のラウンドから再開',
        retryTurnDesc: 'このラウンド開始時点に戻り、生成済みシナリオと後続キャッシュを保持します。',
        restartCase: 'このシナリオの最初から再開',
        restartCaseDesc: '現在の生成済みシナリオを使ったまま、第1ラウンドからやり直します。',
        newGame: '新しいゲームを開始',
        newGameDesc: '現在のキャッシュを破棄し、AI に新しいシナリオを生成させます。',
        home: 'ホームに戻る',
        homeDesc: '現在のゲームを終了し、この局のキャッシュを破棄します。',
        cancel: 'キャンセル',
        cancelDesc: '何も変更せず現在の状態を維持します。'
    },
    en: {
        menuTitle: 'Restart Options',
        menuSubtitle: 'Choose how to handle the current generated case.',
        retryTurn: 'Retry Current Round',
        retryTurnDesc: 'Return to the start of this round and keep the current case plus future caches.',
        restartCase: 'Restart This Case',
        restartCaseDesc: 'Replay the current generated case from round one.',
        newGame: 'Start New Game',
        newGameDesc: 'Discard this cache and ask AI to generate a brand new case.',
        home: 'Exit to Home',
        homeDesc: 'Leave the current game and clear this case cache.',
        cancel: 'Cancel',
        cancelDesc: 'Keep the current state unchanged.'
    }
} satisfies Record<Language, {
    menuTitle: string;
    menuSubtitle: string;
    retryTurn: string;
    retryTurnDesc: string;
    restartCase: string;
    restartCaseDesc: string;
    newGame: string;
    newGameDesc: string;
    home: string;
    homeDesc: string;
    cancel: string;
    cancelDesc: string;
}>;

const getAiPlotStage = (turnIndex: number): AiPlotStage => {
    if (turnIndex >= AI_TOTAL_TURNS) {
        return 'final_confession';
    }
    if (turnIndex === 2) {
        return 'partial_admission';
    }
    return 'denial';
};

const getAiNextRoundFocus = (turnIndex: number) => {
    if (turnIndex === 1) {
        return 'means_timeline_and_concealment';
    }
    if (turnIndex === 2) {
        return 'motive_and_intent';
    }
    return 'final_confession_and_verdict';
};

interface ParsedEvidenceAction {
    evidenceName: string;
    statement: string;
    weakPointId?: string;
}

interface GameResultState {
    victory: boolean;
    summary: string;
}

type RestartActionType = 'retry_turn' | 'restart_case' | 'new_game' | 'home' | 'cancel';

interface RestartActionOption {
    key: RestartActionType;
    label: string;
    description: string;
    disabled?: boolean;
}

type RestartPromptContext = 'menu' | null;

interface RuntimeCheckpointState {
    turnIndex: number;
    gameState: GameState;
    introData: IntroDataState | null;
    runtimeRoundIntro: RoundIntroRequest | null;
    evidenceMap: Map<string, string>;
    usedEvidenceSet: Set<string>;
    resolvedStatementsMap: Map<string, ResolvedStatement>;
    inspectedWeakPointIdsByTurn: Map<number, Set<string>>;
    resolvedWeakPointIdsByTurn: Map<number, Set<string>>;
    logs: LogEntry[];
    activeEnemyLog: LogEntry | null;
    remoteRoundBlueprint: AiRoundBlueprint | null;
    remoteRoundPackage: AiRoundPackage | null;
}

interface EvidenceRewardState {
    evidences: EvidenceEntry[];
    queuedEnemyLog: LogEntry | null;
    queuedRoundIntro: RoundIntroRequest | null;
    endResult: GameResultState | null;
}

interface FocusDialogueState {
    lines: AvgDialogueLine[];
    index: number;
    queuedEnemyLog: LogEntry | null;
    queuedRoundIntro: RoundIntroRequest | null;
    endResult: GameResultState | null;
    queuedEvidenceReward: EvidenceRewardState | null;
    transcriptLogs: LogEntry[];
}

interface IntroDataState {
    narrative: string;
    suspectMsg: string;
    suspectDialogueSequence?: DialogueCueLine[];
    roundIndex?: number;
    systemMsg: string;
    evidences: any[];
    backgroundSlot?: string;
    screenFilter?: string;
    transition?: string;
    enemyPortraitState?: string;
}

type AiWeakPointKind = 'real' | 'inspect' | 'fake' | 'hidden';
type AiPlotStage = 'denial' | 'partial_admission' | 'motive_probe' | 'final_confession';

interface AiWeakPointBlueprint {
    id: string;
    kind: AiWeakPointKind;
    statement: string;
    expectedEvidenceName?: string;
    consumeEvidenceOnUse?: boolean;
    grantsEvidences: EvidenceEntry[];
    revealsWeakPointIds: string[];
}

interface AiRoundBlueprint {
    turnIndex: number;
    isFinalRound: boolean;
    systemMsg: string;
    enemyDialogue: string;
    dialogueSequence: DialogueCueLine[];
    weakPoints: AiWeakPointBlueprint[];
    backgroundSlot?: string;
    screenFilter?: string;
    screenImpulse?: string;
    transition?: string;
    enemyPortraitState?: string;
    enemyPortraitMotion?: string;
}

interface AiRoundSeedSegment {
    turnIndex: number;
    isFinalRound: boolean;
    suspectName?: string;
    narrative?: string;
    systemMsg: string;
    startingEvidences: EvidenceEntry[];
}

interface AiRoundExitContext {
    sourceTurnIndex: number;
    nextTurnIndex: number;
    sourceStage: AiPlotStage;
    nextStage: AiPlotStage;
    nextRoundFocus: string;
    carryOverInventory: EvidenceEntry[];
}

interface AiRoundOutcomeSegment {
    weakPointId?: string;
    narrative: string;
    enemyDialogue?: string;
    avgSequence: AvgDialogueLine[];
    logicExplanation?: string;
    heroDmgTaken: number;
    enemyDmgTaken: number;
    attackType: 'strict' | 'miss' | 'query';
    backgroundSlot?: string;
    screenFilter?: string;
    screenImpulse?: string;
    transition?: string;
    enemyPortraitState?: string;
    enemyPortraitMotion?: string;
}

interface AiRoundOutcomeBundle {
    inspectOutcomes: Record<string, AiRoundOutcomeSegment>;
    correctEvidenceOutcomes: Record<string, AiRoundOutcomeSegment>;
    wrongEvidenceOutcome: AiRoundOutcomeSegment;
    wrongInspectOutcome: AiRoundOutcomeSegment;
    roundClearOutcome?: AiRoundOutcomeSegment;
    victoryOutcome?: AiRoundOutcomeSegment;
}

interface AiRoundPackage {
    seed: AiRoundSeedSegment;
    blueprint: AiRoundBlueprint;
    outcomes: AiRoundOutcomeBundle;
}

type RemoteRoundDraftStage = 'seed' | 'core' | 'outcomes';

interface RemoteRoundDraft {
    key: string;
    options: {
        opening: boolean;
        scope: 'boot' | 'runtime';
        silent?: boolean;
        turnIndex: number;
        inventory: EvidenceEntry[];
        exitContext?: AiRoundExitContext;
        suspectName?: string;
    };
    failedStage: RemoteRoundDraftStage;
    lastFailure?: string;
    seed?: AiRoundSeedSegment;
    blueprint?: AiRoundBlueprint;
}

interface RemoteRoundPrefetchState {
    key: string;
    sourceTurnIndex: number;
    targetTurnIndex: number;
    inventory: EvidenceEntry[];
    exitContext: AiRoundExitContext;
    promise?: Promise<AiRoundPackage>;
    package?: AiRoundPackage;
    error?: string;
}

type AiGenerationStage = 'seed' | 'core' | 'outcomes';
type AiGenerationPhase = 'request' | 'validate' | 'accepted';
type AiGenerationStatus = 'idle' | 'working' | 'ready' | 'consumed' | 'discarded' | 'failed';

interface DebugAiGenerationProgress {
    sourceTurnIndex: number | null;
    targetTurnIndex: number | null;
    status: AiGenerationStatus;
    stage: AiGenerationStage | null;
    phase: AiGenerationPhase | null;
    stageLabel: string | null;
    attempt: number | null;
    maxAttempts: number | null;
    inventoryNames: string[];
    error: string | null;
    updatedAt: number | null;
}

interface SessionDisplayState {
    mode: 'remote' | 'local';
    providerLabel: string;
    modelLabel: string;
    caseLabel?: string;
    caseFilename?: string;
    caseSource?: 'builtin' | 'workspace';
    castSelection: GameState['castSelection'];
}

interface LoadDiagnosticsState {
    scope: 'boot' | 'runtime';
    title: string;
    stage: string;
    status: 'working' | 'error';
    attempt?: number;
    maxAttempts?: number;
    error?: string | null;
}

interface PendingLoadAction {
    hiddenCommand?: string;
    textInput?: string;
    scope: 'boot' | 'runtime';
}

interface DebugRoundSpoilerEntry {
    id: string;
    statement: string;
    kind: AiWeakPointKind;
    expectedEvidenceName?: string;
    expectedEvidenceState?: 'held' | 'consumed' | 'discoverable' | 'missing';
    canInspect: boolean;
    inspected: boolean;
    revealed: boolean;
    resolved: boolean;
    grantedEvidences: Array<{
        name: string;
        obtained: boolean;
        currentlyHeld: boolean;
    }>;
}

interface DebugRoundSpoilerData {
    available: boolean;
    roundIndex?: number;
    isFinalRound?: boolean;
    inventoryNames: string[];
    usedEvidenceNames: string[];
    entries: DebugRoundSpoilerEntry[];
    remainingRealWeakPointIds: string[];
    grantedEvidencePool: Array<{
        name: string;
        sourceWeakPointId: string;
        sourceKind: AiWeakPointKind;
        obtained: boolean;
        currentlyHeld: boolean;
    }>;
}

interface CompiledAiCaseDraft {
    caseId: string;
    filename: string;
    caseData: LocalCaseData;
    serializedText: string;
    generatedTurnCount: number;
}

interface RoundResolutionPlan {
    finalInventory: EvidenceEntry[];
    inspectedWeakPointIds: Set<string>;
    resolvedWeakPointIds: Set<string>;
}

const updateTurnWeakPointSet = (
    previous: Map<number, Set<string>>,
    turnIndex: number,
    weakPointId: string
) => {
    const next = new Map(previous);
    const current = new Set(next.get(turnIndex) ?? []);
    current.add(weakPointId);
    next.set(turnIndex, current);
    return next;
};

const clonePlain = <T,>(value: T): T => {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
};

const cloneTurnWeakPointMap = (value: Map<number, Set<string>>) =>
    new Map(Array.from(value.entries()).map(([turnIndex, ids]) => [turnIndex, new Set(ids)]));

const cloneResolvedStatementMap = (value: Map<string, ResolvedStatement>) =>
    new Map(Array.from(value.entries()).map(([key, entry]) => [key, clonePlain(entry)]));

const cloneEvidenceMap = (value: Map<string, string>) => new Map(value);

const ENEMY_ONLY_SPEAKERS = new Set<DialogueSpeaker | 'enemy_testimony' | 'suspect' | 'target'>([
    'enemy',
    'enemy_testimony',
    'suspect',
    'target'
]);
const NON_ENEMY_DIALOGUE_PATTERNS = [
    /审判开始/i,
    /辩论开始/i,
    /游戏开始/i,
    /证据确凿/i,
    /我将揭露/i,
    /真相大白/i,
    /evidence acquired/i,
    /objection/i,
    /case briefing/i,
    /court record/i,
    /begin debate/i
];

const normalizeEvidenceName = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

const normalizeSuspectNameKey = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_\-]+/g, '')
        .replace(/[.,!?。！？、，"'`]/g, '');

const INVALID_SUSPECT_NAME_KEYS = new Set([
    '',
    'unknown',
    'unknownsuspect',
    'suspect',
    'target',
    'enemy',
    'ai',
    'aisuspect',
    '未知嫌犯',
    '未知容疑者',
    '未知犯人',
    '未知嫌疑人',
    '嫌疑人',
    '嫌犯',
    '容疑者',
    '犯人',
    '目标',
    '未知目標',
    '不明',
    '不明嫌犯',
    '不明容疑者'
]);

const sanitizeSuspectName = (value?: string | null) => {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    return INVALID_SUSPECT_NAME_KEYS.has(normalizeSuspectNameKey(trimmed))
        ? null
        : trimmed;
};

const buildTranscriptForSuspectExtraction = (text: string) =>
    text.replace(/\[\[[^:\]]+::(.*?)\]\]/g, '$1');

const SUSPECT_INTRO_EXTRACTION_WINDOW = 96;

const extractDeclaredSuspectNameFromText = (text: string) => {
    const transcript = buildTranscriptForSuspectExtraction(text)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, SUSPECT_INTRO_EXTRACTION_WINDOW);
    const patterns = [
        /(?:^|[。！？!?]\s*)我[，,]\s*([\u3400-\u9fff]{2,4})[，,]/,
        /(?:^|[。！？!?]\s*)我叫([\u3400-\u9fff]{2,4})(?=[，,。！？!? ]|$)/,
        /(?:^|[。！？!?]\s*)我的名字是([\u3400-\u9fff]{2,4})(?=[，,。！？!? ]|$)/,
        /(?:^|[。！？!?]\s*)我是([\u3400-\u9fff]{2,4})(?=[，,。！？!? ]|$)/,
        /(?:^|[。！？!?]\s*)私[、,]\s*([\u3040-\u30ff\u3400-\u9fff]{2,8})[、,]/,
        /(?:^|[。！？!?]\s*)私の名前は([\u3040-\u30ff\u3400-\u9fff]{2,8})(?=[、，,。！？!? ]|$)/,
        /(?:^|[。！？!?]\s*)私は([\u3040-\u30ff\u3400-\u9fff]{2,8})(?=[、，,。！？!? ]|$)/,
        /\bmy name is ([A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,2})/i,
        /\bi am ([A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,2})(?=[,.\s!?]|$)/i,
        /\bi,\s*([A-Za-z][A-Za-z'.-]*(?:\s+[A-Za-z][A-Za-z'.-]*){0,2}),/i
    ];

    for (const pattern of patterns) {
        const match = transcript.match(pattern);
        const candidate = sanitizeSuspectName(match?.[1]);
        if (candidate) {
            return candidate;
        }
    }

    return null;
};

const inferSuspectNameFromTranscript = (
    enemyDialogue?: string,
    dialogueSequence?: DialogueCueLine[]
) => {
    const combined = [
        enemyDialogue,
        ...(dialogueSequence || []).map(line => line.text)
    ]
        .filter(Boolean)
        .join('\n');

    return combined ? extractDeclaredSuspectNameFromText(combined) : null;
};

const resolveRuntimeSuspectName = (options: {
    explicit?: string | null;
    inferred?: string | null;
    fallback?: string | null;
}) =>
    sanitizeSuspectName(options.explicit)
    || sanitizeSuspectName(options.inferred)
    || sanitizeSuspectName(options.fallback)
    || null;

const buildEvidenceInventoryState = (entries: EvidenceEntry[]) => {
    const next = new Map<string, EvidenceEntry>();
    entries.forEach(entry => {
        const normalized = normalizeEvidenceName(entry.name);
        if (!normalized || next.has(normalized)) {
            return;
        }
        next.set(normalized, {
            name: entry.name,
            detail: entry.detail
        });
    });
    return next;
};

const cloneEvidenceInventoryState = (inventory: Map<string, EvidenceEntry>) =>
    new Map(Array.from(inventory.entries()).map(([key, value]) => [key, { ...value }]));

const serializeEvidenceInventoryState = (inventory: Map<string, EvidenceEntry>) =>
    Array.from(inventory.keys()).sort().join('|');

const evidenceInventoryStateToEntries = (inventory: Map<string, EvidenceEntry>) =>
    Array.from(inventory.values()).sort((left, right) => normalizeEvidenceName(left.name).localeCompare(normalizeEvidenceName(right.name)));

const isResolvableWeakPointKind = (kind: AiWeakPointKind) => kind === 'real' || kind === 'hidden';

const buildUnlockedWeakPointIds = (
    weakPoints: AiWeakPointBlueprint[],
    inspectedWeakPointIds: Set<string>,
    resolvedWeakPointIds: Set<string>
) => {
    const unlocked = new Set(
        weakPoints
            .filter(item => item.kind !== 'hidden')
            .map(item => item.id)
    );

    inspectedWeakPointIds.forEach(id => {
        const inspectWeakPoint = weakPoints.find(item => item.id === id && item.kind === 'inspect');
        inspectWeakPoint?.revealsWeakPointIds.forEach(revealedId => unlocked.add(revealedId));
    });

    resolvedWeakPointIds.forEach(id => unlocked.add(id));
    return unlocked;
};

const findRoundResolutionPlan = (
    weakPoints: AiWeakPointBlueprint[],
    inventoryEntries: EvidenceEntry[],
    options?: {
        inspectedWeakPointIds?: Iterable<string>;
        resolvedWeakPointIds?: Iterable<string>;
    }
): RoundResolutionPlan | null => {
    const weakPointById = new Map(weakPoints.map(item => [item.id, item] as const));
    const targetWeakPointIds = weakPoints
        .filter(item => isResolvableWeakPointKind(item.kind))
        .map(item => item.id);
    const initialInspectedIds = new Set(
        Array.from(options?.inspectedWeakPointIds || []).filter(id => weakPointById.get(id)?.kind === 'inspect')
    );
    const initialResolvedIds = new Set(
        Array.from(options?.resolvedWeakPointIds || []).filter(id => isResolvableWeakPointKind(weakPointById.get(id)?.kind || 'fake'))
    );

    const searchCache = new Set<string>();
    const buildStateKey = (
        inventory: Map<string, EvidenceEntry>,
        inspectedWeakPointIds: Set<string>,
        resolvedWeakPointIds: Set<string>
    ) => [
        serializeEvidenceInventoryState(inventory),
        Array.from(inspectedWeakPointIds).sort().join('|'),
        Array.from(resolvedWeakPointIds).sort().join('|')
    ].join('::');

    const search = (
        inventory: Map<string, EvidenceEntry>,
        inspectedWeakPointIds: Set<string>,
        resolvedWeakPointIds: Set<string>
    ): RoundResolutionPlan | null => {
        if (targetWeakPointIds.every(id => resolvedWeakPointIds.has(id))) {
            return {
                finalInventory: evidenceInventoryStateToEntries(inventory),
                inspectedWeakPointIds: new Set(inspectedWeakPointIds),
                resolvedWeakPointIds: new Set(resolvedWeakPointIds)
            };
        }

        const stateKey = buildStateKey(inventory, inspectedWeakPointIds, resolvedWeakPointIds);
        if (searchCache.has(stateKey)) {
            return null;
        }
        searchCache.add(stateKey);

        const unlockedWeakPointIds = buildUnlockedWeakPointIds(weakPoints, inspectedWeakPointIds, resolvedWeakPointIds);
        const unresolvedTargets = weakPoints.filter(item =>
            isResolvableWeakPointKind(item.kind) && !resolvedWeakPointIds.has(item.id)
        );
        const requiredEvidenceNames = new Set(
            unresolvedTargets
                .map(item => item.expectedEvidenceName)
                .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
                .map(name => normalizeEvidenceName(name))
        );

        const resolveCandidates = unresolvedTargets
            .filter(item => {
                if (item.kind === 'hidden' && !unlockedWeakPointIds.has(item.id)) {
                    return false;
                }
                if (!item.expectedEvidenceName) {
                    return false;
                }
                return inventory.has(normalizeEvidenceName(item.expectedEvidenceName));
            })
            .sort((left, right) => left.id.localeCompare(right.id));

        for (const weakPoint of resolveCandidates) {
            const nextInventory = cloneEvidenceInventoryState(inventory);
            if (weakPoint.expectedEvidenceName && weakPoint.consumeEvidenceOnUse !== false) {
                nextInventory.delete(normalizeEvidenceName(weakPoint.expectedEvidenceName));
            }
            const nextResolvedIds = new Set(resolvedWeakPointIds);
            nextResolvedIds.add(weakPoint.id);
            const resolvedPlan = search(nextInventory, inspectedWeakPointIds, nextResolvedIds);
            if (resolvedPlan) {
                return resolvedPlan;
            }
        }

        const inspectCandidates = weakPoints
            .filter(item => item.kind === 'inspect' && !inspectedWeakPointIds.has(item.id) && unlockedWeakPointIds.has(item.id))
            .filter(item => {
                const revealsNeededWeakPoint = item.revealsWeakPointIds.some(revealedId =>
                    unresolvedTargets.some(target => target.id === revealedId) && !unlockedWeakPointIds.has(revealedId)
                );
                if (revealsNeededWeakPoint) {
                    return true;
                }

                return item.grantsEvidences.some(evidence => {
                    const normalized = normalizeEvidenceName(evidence.name);
                    return requiredEvidenceNames.has(normalized) && !inventory.has(normalized);
                });
            })
            .sort((left, right) => left.id.localeCompare(right.id));

        for (const weakPoint of inspectCandidates) {
            const nextInventory = cloneEvidenceInventoryState(inventory);
            weakPoint.grantsEvidences.forEach(evidence => {
                const normalized = normalizeEvidenceName(evidence.name);
                if (!nextInventory.has(normalized)) {
                    nextInventory.set(normalized, {
                        name: evidence.name,
                        detail: evidence.detail
                    });
                }
            });
            const nextInspectedIds = new Set(inspectedWeakPointIds);
            nextInspectedIds.add(weakPoint.id);
            const inspectedPlan = search(nextInventory, nextInspectedIds, resolvedWeakPointIds);
            if (inspectedPlan) {
                return inspectedPlan;
            }
        }

        return null;
    };

    return search(buildEvidenceInventoryState(inventoryEntries), initialInspectedIds, initialResolvedIds);
};

const normalizeEvidenceEntries = (value: any): EvidenceEntry[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(item => item && typeof item.name === 'string' && typeof (item.detail ?? item.description) === 'string')
        .map(item => ({
            name: item.name.trim(),
            detail: String(item.detail ?? item.description).trim()
        }))
        .filter(item => item.name.length > 0 && item.detail.length > 0);
};

const isForbiddenEnemyDialogue = (text: string) =>
    NON_ENEMY_DIALOGUE_PATTERNS.some(pattern => pattern.test(text));

const extractStructuredLineText = (value: any) => {
    if (!value || typeof value !== 'object') {
        return '';
    }

    if (typeof value.text === 'string') {
        return value.text.trim();
    }

    if (typeof value.dialogue === 'string') {
        return value.dialogue.trim();
    }

    if (typeof value.line === 'string') {
        return value.line.trim();
    }

    return '';
};

const normalizeNarrativeText = (value: any): string | undefined => {
    if (typeof value === 'string') {
        const text = value.trim();
        return text.length > 0 ? text : undefined;
    }

    if (Array.isArray(value)) {
        const text = value
            .map(entry => typeof entry === 'string' ? entry.trim() : extractStructuredLineText(entry))
            .filter(Boolean)
            .join('\n');
        return text.length > 0 ? text : undefined;
    }

    if (value && typeof value === 'object') {
        const text = extractStructuredLineText(value);
        return text.length > 0 ? text : undefined;
    }

    return undefined;
};

const parseDialogueSequence = (value: any): DialogueCueLine[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(item => ({
            item,
            text: extractStructuredLineText(item)
        }))
        .filter(entry => entry.text.length > 0)
        .map(item => {
            const rawSpeaker = typeof item.item.speaker === 'string' ? item.item.speaker.trim().toLowerCase() : '';
            const speaker = ENEMY_ONLY_SPEAKERS.has(rawSpeaker as DialogueSpeaker | 'enemy_testimony')
                ? 'enemy'
                : rawSpeaker === ''
                    ? undefined
                    : 'system';

            return {
                text: item.text,
                speaker,
                enemyPortraitState: item.item.portrait_state || item.item.enemy_portrait_state || item.item.portraitState || item.item.portrait,
                enemyPortraitMotion: item.item.portrait_motion || item.item.enemy_portrait_motion || item.item.portraitMotion || item.item.motion
            } satisfies DialogueCueLine;
        })
        .filter(item =>
            item.text.length > 0
            && item.speaker !== 'system'
            && !isForbiddenEnemyDialogue(item.text)
        );
};

const buildAlreadyInspectedNarrative = (lang: Language) => {
    if (lang === 'ja') {
        return 'ここはもう調べ終わっている。新しい手掛かりはない。';
    }

    if (lang === 'en') {
        return 'This lead has already been checked. There is nothing new to recover here.';
    }

    return '这里已经调查过了，没有新的发现。';
};

const parseAvgSequence = (value: any): AvgDialogueLine[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .map(item => ({
            item,
            text: extractStructuredLineText(item)
        }))
        .filter(entry => entry.text.length > 0)
        .map(({ item, text }) => ({
            speaker: (item.speaker === 'hero' || item.speaker === 'enemy' || item.speaker === 'system')
                ? item.speaker
                : 'system',
            text,
            portraitState: item.portrait_state || item.portraitState || item.portrait,
            portraitMotion: item.portrait_motion || item.portraitMotion || item.motion,
            backgroundSlot: item.background_slot || item.backgroundSlot,
            screenFilter: item.screen_filter || item.screenFilter,
            screenImpulse: item.screen_impulse || item.screenImpulse,
            transition: item.transition
        }));
};

const parseAiRoundSeedSegment = (value: any): AiRoundSeedSegment | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const turnIndex = Number.isFinite(Number(value.turn_index || value.round_index)) && Number(value.turn_index || value.round_index) > 0
        ? Math.floor(Number(value.turn_index || value.round_index))
        : 0;
    const systemMsg = typeof value.system_msg === 'string'
        ? value.system_msg.trim()
        : typeof value.system === 'string'
            ? value.system.trim()
            : '';

    if (turnIndex <= 0 || !systemMsg) {
        return null;
    }

    return {
        turnIndex,
        isFinalRound: Boolean(value.is_final_round),
        suspectName: typeof value.suspect_name === 'string' ? value.suspect_name.trim() : undefined,
        narrative: normalizeNarrativeText(value.narrative),
        systemMsg,
        startingEvidences: normalizeEvidenceEntries(value.evidences || value.starting_evidences)
    };
};

const parseAiWeakPointBlueprint = (value: any): AiWeakPointBlueprint[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(item => item && typeof item.id === 'string' && typeof item.statement === 'string')
        .map(item => {
            const solution = item.solution && typeof item.solution === 'object' ? item.solution : undefined;
            const rawKind = typeof item.kind === 'string'
                ? item.kind.trim().toLowerCase()
                : typeof item.type === 'string'
                    ? item.type.trim().toLowerCase()
                    : '';

            let normalizedKind: AiWeakPointKind = 'fake';
            if (rawKind === 'real' || rawKind === 'hidden' || rawKind === 'inspect' || rawKind === 'fake') {
                normalizedKind = rawKind as AiWeakPointKind;
            } else if (rawKind === 'inspect_weak_point') {
                normalizedKind = 'inspect';
            } else if (rawKind === 'expose_contradiction') {
                normalizedKind = item.is_hidden ? 'hidden' : 'real';
            } else if (rawKind === 'decoy' || rawKind === 'fake_weak_point') {
                normalizedKind = 'fake';
            }

            const expectedEvidenceName = [
                item.expected_evidence_name,
                item.expectedEvidenceName,
                item.evidence_name,
                item.evidence_id,
                solution?.expected_evidence_name,
                solution?.evidence_name,
                solution?.evidence_id
            ].find(entry => typeof entry === 'string' && entry.trim()) as string | undefined;

            const revealsWeakPointIdsSource = [
                item.reveals_weak_point_ids,
                item.revealsWeakPointIds,
                solution?.reveals_weak_point_ids,
                solution?.revealsWeakPointIds
            ].find(Array.isArray);

            const grantsEvidenceSource = [
                item.grants_evidences,
                item.granted_evidences,
                item.grantsEvidence,
                solution?.grants_evidences,
                solution?.granted_evidences,
                solution?.grantsEvidence
            ].find(entry => Array.isArray(entry));

            return {
                id: item.id.trim(),
                kind: normalizedKind,
                statement: item.statement.trim(),
                expectedEvidenceName: typeof expectedEvidenceName === 'string' ? expectedEvidenceName.trim() : undefined,
                consumeEvidenceOnUse: (item.consume_evidence_on_use ?? item.consumeEvidenceOnUse ?? solution?.consume_evidence_on_use) !== false,
                grantsEvidences: normalizeEvidenceEntries(grantsEvidenceSource),
                revealsWeakPointIds: Array.isArray(revealsWeakPointIdsSource)
                    ? revealsWeakPointIdsSource.filter((entry: any) => typeof entry === 'string').map((entry: string) => entry.trim()).filter(Boolean)
                    : []
            };
        })
        .filter(item => item.id.length > 0 && item.statement.length > 0);
};

const parseAiOutcomeSegment = (value: any): AiRoundOutcomeSegment | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const narrative = typeof value.narrative === 'string' ? value.narrative.trim() : '';
    const enemyDialogue = typeof value.enemy_dialogue === 'string' ? value.enemy_dialogue.trim() : '';
    const avgSequence = parseAvgSequence(value.avg_sequence);
    const attackType = value.attack_type === 'strict' || value.attack_type === 'miss' || value.attack_type === 'query'
        ? value.attack_type
        : 'query';

    if (!narrative && avgSequence.length === 0 && !enemyDialogue) {
        return null;
    }

    return {
        weakPointId: typeof value.weak_point_id === 'string' ? value.weak_point_id.trim() : undefined,
        narrative,
        enemyDialogue,
        avgSequence,
        logicExplanation: typeof value.logic_explanation === 'string' ? value.logic_explanation.trim() : undefined,
        heroDmgTaken: Math.max(0, Number(value.hero_dmg_taken) || 0),
        enemyDmgTaken: Math.max(0, Number(value.enemy_dmg_taken) || 0),
        attackType,
        backgroundSlot: typeof value.background_slot === 'string' ? value.background_slot : undefined,
        screenFilter: typeof value.screen_filter === 'string' ? value.screen_filter : undefined,
        screenImpulse: typeof value.screen_impulse === 'string' ? value.screen_impulse : undefined,
        transition: typeof value.transition === 'string' ? value.transition : undefined,
        enemyPortraitState: typeof value.enemy_portrait_state === 'string'
            ? value.enemy_portrait_state
            : typeof value.portrait_state === 'string'
                ? value.portrait_state
                : typeof value.portrait === 'string'
                    ? value.portrait
                    : undefined,
        enemyPortraitMotion: typeof value.enemy_portrait_motion === 'string'
            ? value.enemy_portrait_motion
            : typeof value.portrait_motion === 'string'
                ? value.portrait_motion
                : typeof value.motion === 'string'
                    ? value.motion
                    : undefined
    };
};

const parseOutcomeMap = (value: any) => {
    if (Array.isArray(value)) {
        return Object.fromEntries(
            value
                .map(raw => {
                    const segment = parseAiOutcomeSegment(raw);
                    const weakPointId = typeof raw?.weak_point_id === 'string'
                        ? raw.weak_point_id.trim()
                        : typeof raw?.weakPointId === 'string'
                            ? raw.weakPointId.trim()
                            : typeof raw?.id === 'string'
                                ? raw.id.trim()
                                : '';

                    if (!segment || !weakPointId) {
                        return null;
                    }

                    return [weakPointId, segment] as const;
                })
                .filter((entry): entry is readonly [string, AiRoundOutcomeSegment] => Boolean(entry))
        );
    }

    if (!value || typeof value !== 'object') {
        return {} as Record<string, AiRoundOutcomeSegment>;
    }

    return Object.fromEntries(
        Object.entries(value)
            .map(([key, raw]) => [key, parseAiOutcomeSegment(raw)] as const)
            .filter((entry): entry is [string, AiRoundOutcomeSegment] => Boolean(entry[1]))
    );
};

const parseAiRoundOutcomeBundle = (value: any): AiRoundOutcomeBundle | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const inspectOutcomes = parseOutcomeMap(value.inspect_outcomes);
    const correctEvidenceOutcomes = parseOutcomeMap(value.correct_evidence_outcomes);
    const wrongEvidenceOutcome = parseAiOutcomeSegment(value.wrong_evidence_outcome);
    const wrongInspectOutcome = parseAiOutcomeSegment(value.wrong_inspect_outcome);

    if (!wrongEvidenceOutcome || !wrongInspectOutcome) {
        return null;
    }

    return {
        inspectOutcomes,
        correctEvidenceOutcomes,
        wrongEvidenceOutcome,
        wrongInspectOutcome,
        roundClearOutcome: parseAiOutcomeSegment(value.round_clear_outcome) || undefined,
        victoryOutcome: parseAiOutcomeSegment(value.victory_outcome) || undefined
    };
};

const stripWeakPointMarkup = (text: string) =>
    text.replace(/\[\[(?:([A-Za-z0-9_-]+)::)?([\s\S]*?)\]\]/g, (_match, _logicId, plainText) => plainText);

const collectPayloadTexts = (data: any): string[] => {
    const texts: string[] = [];
    const pushText = (value: any) => {
        if (typeof value === 'string' && value.trim()) {
            texts.push(stripWeakPointMarkup(value.trim()));
        }
    };

    pushText(data?.narrative);
    pushText(data?.system_msg);
    pushText(data?.enemy_dialogue);
    pushText(data?.case_truth);

    if (Array.isArray(data?.dialogue_sequence)) {
        data.dialogue_sequence.forEach((line: any) => pushText(extractStructuredLineText(line)));
    }

    if (Array.isArray(data?.avg_sequence)) {
        data.avg_sequence.forEach((line: any) => pushText(extractStructuredLineText(line)));
    }

    normalizeEvidenceEntries(data?.evidences).forEach(entry => {
        pushText(entry.name);
        pushText(entry.detail);
    });

    parseAiWeakPointBlueprint(data?.weak_point_blueprint || data?.weak_points).forEach(entry => {
        pushText(entry.statement);
        pushText(entry.expectedEvidenceName);
        entry.grantsEvidences.forEach(evidence => {
            pushText(evidence.name);
            pushText(evidence.detail);
        });
    });

    return texts;
};

const validatePayloadLanguage = (data: any, lang: Language) => {
    const sample = collectPayloadTexts(data).join('\n');
    if (!sample.trim()) {
        return { ok: true as const };
    }

    const chineseCount = (sample.match(/[\u4E00-\u9FFF]/g) || []).length;
    const kanaCount = (sample.match(/[\u3040-\u30FF\u31F0-\u31FF]/g) || []).length;
    const latinCount = (sample.match(/[A-Za-z]/g) || []).length;

    if (lang === 'zh') {
        if (kanaCount >= 6 && kanaCount > chineseCount * 0.2 + 2) {
            return { ok: false as const, reason: 'Generated text drifted away from the selected Chinese locale.' };
        }
        if (chineseCount < 8 && latinCount >= 20) {
            return { ok: false as const, reason: 'Generated text does not match the selected Chinese locale.' };
        }
    }

    if (lang === 'ja') {
        if (kanaCount + chineseCount < 8 && latinCount >= 20) {
            return { ok: false as const, reason: 'Generated text does not match the selected Japanese locale.' };
        }
    }

    if (lang === 'en') {
        if (chineseCount + kanaCount >= 8 && chineseCount + kanaCount > latinCount) {
            return { ok: false as const, reason: 'Generated text does not match the selected English locale.' };
        }
    }

    return { ok: true as const };
};

const buildEnemyDialogueFromSequence = (sequence: DialogueCueLine[], fallback = '') => {
    if (sequence.length === 0) {
        return stripWeakPointMarkup(fallback).trim();
    }

    return sequence
        .map(line => stripWeakPointMarkup(line.text))
        .filter(Boolean)
        .join('\n')
        .trim();
};

const resolveReachableRoundState = (startingEvidences: EvidenceEntry[], weakPoints: AiWeakPointBlueprint[]) => {
    const evidenceNames = new Set(startingEvidences.map(entry => normalizeEvidenceName(entry.name)));
    const unlockedWeakPointIds = new Set(
        weakPoints
            .filter(item => item.kind !== 'hidden')
            .map(item => item.id)
    );

    let changed = true;
    while (changed) {
        changed = false;

        weakPoints.forEach(item => {
            if (!unlockedWeakPointIds.has(item.id)) {
                return;
            }

            if (item.kind === 'inspect') {
                item.grantsEvidences.forEach(evidence => {
                    const normalized = normalizeEvidenceName(evidence.name);
                    if (!evidenceNames.has(normalized)) {
                        evidenceNames.add(normalized);
                        changed = true;
                    }
                });

                item.revealsWeakPointIds.forEach(weakPointId => {
                    if (!unlockedWeakPointIds.has(weakPointId)) {
                        unlockedWeakPointIds.add(weakPointId);
                        changed = true;
                    }
                });
            }
        });
    }

    return { evidenceNames, unlockedWeakPointIds };
};

const validateAiRoundBlueprint = (
    weakPoints: AiWeakPointBlueprint[],
    startingEvidences: EvidenceEntry[]
) => {
    const realWeakPoints = weakPoints.filter(item => item.kind === 'real' || item.kind === 'hidden');
    if (realWeakPoints.length === 0) {
        return { ok: false, reason: 'Missing real weak points.' };
    }

    if (realWeakPoints.length < AI_MIN_TRUE_WEAK_POINTS) {
        return {
            ok: false,
            reason: `Each AI round must include at least ${AI_MIN_TRUE_WEAK_POINTS} real or hidden weak points.`
        };
    }

    const { evidenceNames, unlockedWeakPointIds } = resolveReachableRoundState(startingEvidences, weakPoints);
    for (const weakPoint of realWeakPoints) {
        if (!weakPoint.expectedEvidenceName) {
            return { ok: false, reason: `Weak point "${weakPoint.id}" is missing expected_evidence_name.` };
        }

        if (weakPoint.kind === 'hidden' && !unlockedWeakPointIds.has(weakPoint.id)) {
            return { ok: false, reason: `Hidden weak point "${weakPoint.id}" is never revealed by an inspect chain.` };
        }

        if (!evidenceNames.has(normalizeEvidenceName(weakPoint.expectedEvidenceName))) {
            return { ok: false, reason: `Weak point "${weakPoint.id}" is not solvable with current round evidence or inspect rewards.` };
        }
    }

    const resolutionPlan = findRoundResolutionPlan(weakPoints, startingEvidences);
    if (!resolutionPlan) {
        return {
            ok: false,
            reason: 'Round is not solvable under current evidence consumption and inspect-chain rules.'
        };
    }

    for (let leftIndex = 0; leftIndex < realWeakPoints.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < realWeakPoints.length; rightIndex += 1) {
            const left = realWeakPoints[leftIndex];
            const right = realWeakPoints[rightIndex];
            const similarity = computeWeakPointSimilarity(left.statement, right.statement);
            const sameEvidence = left.expectedEvidenceName
                && right.expectedEvidenceName
                && normalizeEvidenceName(left.expectedEvidenceName) === normalizeEvidenceName(right.expectedEvidenceName);

            if (similarity >= 0.82 || (sameEvidence && similarity >= 0.58)) {
                return {
                    ok: false,
                    reason: `Weak points "${left.id}" and "${right.id}" are too similar. Split them into distinct factual axes.`
                };
            }
        }
    }

    return { ok: true as const };
};

const deriveRoundCarryOverInventory = (
    roundPackage: AiRoundPackage,
    inventory: EvidenceEntry[],
    options?: {
        inspectedWeakPointIds?: Iterable<string>;
        resolvedWeakPointIds?: Iterable<string>;
    }
) => {
    const resolutionPlan = findRoundResolutionPlan(roundPackage.blueprint.weakPoints, inventory, options);
    return resolutionPlan?.finalInventory || inventory;
};

const buildAiRoundExitContext = (
    roundPackage: AiRoundPackage,
    carryOverInventory: EvidenceEntry[]
): AiRoundExitContext => ({
    sourceTurnIndex: roundPackage.blueprint.turnIndex,
    nextTurnIndex: roundPackage.blueprint.turnIndex + 1,
    sourceStage: getAiPlotStage(roundPackage.blueprint.turnIndex),
    nextStage: getAiPlotStage(roundPackage.blueprint.turnIndex + 1),
    nextRoundFocus: getAiNextRoundFocus(roundPackage.blueprint.turnIndex),
    carryOverInventory
});

const computeAiStrictHitDamage = (
    roundPackage: AiRoundPackage,
    resolvedTrueWeakPointCountAfterHit: number
) => {
    const budget = AI_ROUND_DAMAGE_BUDGET[roundPackage.blueprint.turnIndex] || 30;
    const trueWeakPointCount = roundPackage.blueprint.weakPoints.filter(item =>
        item.kind === 'real' || item.kind === 'hidden'
    ).length;

    if (trueWeakPointCount <= 0) {
        return 0;
    }

    const normalizedResolvedCount = Math.max(1, Math.min(trueWeakPointCount, resolvedTrueWeakPointCountAfterHit));
    const baseDamage = Math.floor(budget / trueWeakPointCount);
    const isLastHit = normalizedResolvedCount >= trueWeakPointCount;
    return isLastHit
        ? budget - baseDamage * (trueWeakPointCount - 1)
        : baseDamage;
};

const parseAiRoundBlueprint = (value: any): AiRoundBlueprint | null => {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const dialogueSequence = parseDialogueSequence(value.dialogue_sequence || value.testimony_sequence);
    const weakPoints = parseAiWeakPointBlueprint(value.weak_point_blueprint || value.weak_points);
    const turnIndex = Number.isFinite(Number(value.turn_index || value.round_index)) && Number(value.turn_index || value.round_index) > 0
        ? Math.floor(Number(value.turn_index || value.round_index))
        : 0;

    if (turnIndex <= 0 || dialogueSequence.length === 0 || weakPoints.length === 0) {
        return null;
    }

    return {
        turnIndex,
        isFinalRound: Boolean(value.is_final_round),
        systemMsg: typeof value.system_msg === 'string' ? value.system_msg.trim() : '',
        enemyDialogue: buildEnemyDialogueFromSequence(dialogueSequence, typeof value.enemy_dialogue === 'string' ? value.enemy_dialogue : ''),
        dialogueSequence,
        weakPoints,
        backgroundSlot: typeof value.background_slot === 'string' ? value.background_slot : undefined,
        screenFilter: typeof value.screen_filter === 'string' ? value.screen_filter : undefined,
        screenImpulse: typeof value.screen_impulse === 'string' ? value.screen_impulse : undefined,
        transition: typeof value.transition === 'string' ? value.transition : undefined,
        enemyPortraitState: typeof value.enemy_portrait_state === 'string' ? value.enemy_portrait_state : undefined,
        enemyPortraitMotion: typeof value.enemy_portrait_motion === 'string' ? value.enemy_portrait_motion : undefined
    };
};

const validateAiRoundSeedSegment = (
    seed: AiRoundSeedSegment | null,
    lang: Language,
    options?: { requireNarrative?: boolean; requireStartingEvidences?: boolean }
) => {
    if (!seed) {
        return { ok: false as const, reason: 'Missing round seed segment.' };
    }

    if (options?.requireNarrative && !seed.narrative) {
        return { ok: false as const, reason: 'Opening seed is missing narrative.' };
    }

    if (options?.requireStartingEvidences && seed.startingEvidences.length === 0) {
        return { ok: false as const, reason: 'Opening seed has no starting evidences.' };
    }

    if (seed.turnIndex < 1 || seed.turnIndex > AI_TOTAL_TURNS) {
        return { ok: false as const, reason: `AI mode only supports ${AI_TOTAL_TURNS} rounds.` };
    }

    if (seed.isFinalRound !== (seed.turnIndex === AI_TOTAL_TURNS)) {
        return { ok: false as const, reason: 'Round seed has an inconsistent is_final_round flag.' };
    }

    if (!sanitizeSuspectName(seed.suspectName)) {
        return { ok: false as const, reason: 'Round seed must include a concrete suspect_name instead of a generic placeholder.' };
    }

    const languageVerdict = validatePayloadLanguage({
        narrative: seed.narrative,
        system_msg: seed.systemMsg,
        suspect_name: seed.suspectName,
        evidences: seed.startingEvidences
    }, lang);

    if (!languageVerdict.ok) {
        return languageVerdict;
    }

    return { ok: true as const };
};

const validateAiRoundOutcomeBundle = (
    bundle: AiRoundOutcomeBundle | null,
    blueprint: AiRoundBlueprint,
    lang: Language
) => {
    if (!bundle) {
        return { ok: false as const, reason: 'Missing round outcome bundle.' };
    }

    const inspectIds = blueprint.weakPoints.filter(item => item.kind === 'inspect').map(item => item.id);
    const realIds = blueprint.weakPoints.filter(item => item.kind === 'real' || item.kind === 'hidden').map(item => item.id);

    for (const id of inspectIds) {
        if (!bundle.inspectOutcomes[id]) {
            return { ok: false as const, reason: `inspect_outcomes is missing "${id}".` };
        }
        if (bundle.inspectOutcomes[id].attackType !== 'query') {
            return { ok: false as const, reason: `inspect_outcomes["${id}"] must use attack_type = "query".` };
        }
        if (bundle.inspectOutcomes[id].heroDmgTaken !== 0 || bundle.inspectOutcomes[id].enemyDmgTaken !== 0) {
            return { ok: false as const, reason: `inspect_outcomes["${id}"] must keep both damage values at 0.` };
        }
        if (!bundle.inspectOutcomes[id].narrative.trim()) {
            return { ok: false as const, reason: `inspect_outcomes["${id}"] is missing narrative.` };
        }
    }

    for (const id of realIds) {
        if (!bundle.correctEvidenceOutcomes[id]) {
            return { ok: false as const, reason: `correct_evidence_outcomes is missing "${id}".` };
        }
        if (bundle.correctEvidenceOutcomes[id].attackType !== 'strict') {
            return { ok: false as const, reason: `correct_evidence_outcomes["${id}"] must use attack_type = "strict".` };
        }
        if (bundle.correctEvidenceOutcomes[id].enemyDmgTaken <= 0) {
            return { ok: false as const, reason: `correct_evidence_outcomes["${id}"] must deal positive enemy damage.` };
        }
        if (!bundle.correctEvidenceOutcomes[id].narrative.trim()) {
            return { ok: false as const, reason: `correct_evidence_outcomes["${id}"] is missing narrative.` };
        }
    }

    if (bundle.wrongEvidenceOutcome.attackType !== 'miss') {
        return { ok: false as const, reason: 'wrong_evidence_outcome must use attack_type = "miss".' };
    }

    if (bundle.wrongInspectOutcome.attackType !== 'query') {
        return { ok: false as const, reason: 'wrong_inspect_outcome must use attack_type = "query".' };
    }

    if (!bundle.wrongEvidenceOutcome.narrative.trim()) {
        return { ok: false as const, reason: 'wrong_evidence_outcome is missing narrative.' };
    }

    if (!bundle.wrongInspectOutcome.narrative.trim()) {
        return { ok: false as const, reason: 'wrong_inspect_outcome is missing narrative.' };
    }

    const languageVerdict = validatePayloadLanguage({
        avg_sequence: [
            ...Object.values(bundle.inspectOutcomes).flatMap(entry => entry.avgSequence.map(line => ({ text: line.text }))),
            ...Object.values(bundle.correctEvidenceOutcomes).flatMap(entry => entry.avgSequence.map(line => ({ text: line.text }))),
            ...bundle.wrongEvidenceOutcome.avgSequence.map(line => ({ text: line.text })),
            ...bundle.wrongInspectOutcome.avgSequence.map(line => ({ text: line.text })),
            ...(bundle.roundClearOutcome?.avgSequence || []).map(line => ({ text: line.text })),
            ...(bundle.victoryOutcome?.avgSequence || []).map(line => ({ text: line.text }))
        ],
        narrative: [
            ...Object.values(bundle.inspectOutcomes).map(entry => entry.narrative),
            ...Object.values(bundle.correctEvidenceOutcomes).map(entry => entry.narrative),
            bundle.wrongEvidenceOutcome.narrative,
            bundle.wrongInspectOutcome.narrative,
            bundle.roundClearOutcome?.narrative,
            bundle.victoryOutcome?.narrative
        ].filter(Boolean).join('\n')
    }, lang);

    if (!languageVerdict.ok) {
        return languageVerdict;
    }

    if (!blueprint.isFinalRound) {
        const roundClearTranscript = collectOutcomeTranscriptText(bundle.roundClearOutcome);
        if (containsPrematureConfession(roundClearTranscript)) {
            return {
                ok: false as const,
                reason: `round_clear_outcome for round ${blueprint.turnIndex} escalated into a full confession too early.`
            };
        }

        if (bundle.roundClearOutcome?.enemyPortraitState === 'sad_confession') {
            return {
                ok: false as const,
                reason: `round_clear_outcome for round ${blueprint.turnIndex} used sad_confession too early.`
            };
        }

        if (bundle.roundClearOutcome?.backgroundSlot === 'confession' || bundle.roundClearOutcome?.backgroundSlot === 'ending') {
            return {
                ok: false as const,
                reason: `round_clear_outcome for round ${blueprint.turnIndex} used an endgame background too early.`
            };
        }

        if (bundle.victoryOutcome) {
            return {
                ok: false as const,
                reason: `Non-final round ${blueprint.turnIndex} must not include victory_outcome.`
            };
        }
    }

    return { ok: true as const };
};

const assembleAiRoundPackage = (
    seed: AiRoundSeedSegment,
    blueprint: AiRoundBlueprint,
    outcomes: AiRoundOutcomeBundle
): AiRoundPackage => ({
    seed,
    blueprint: {
        ...blueprint,
        turnIndex: seed.turnIndex,
        isFinalRound: seed.isFinalRound,
        systemMsg: blueprint.systemMsg || seed.systemMsg
    },
    outcomes
});

const buildRoundBlueprintPayload = (roundPackage: AiRoundPackage) => ({
    turn_index: roundPackage.blueprint.turnIndex,
    is_final_round: roundPackage.blueprint.isFinalRound,
    system_msg: roundPackage.blueprint.systemMsg,
    enemy_dialogue: roundPackage.blueprint.enemyDialogue,
    dialogue_sequence: roundPackage.blueprint.dialogueSequence.map(line => ({
        speaker: line.speaker || 'enemy',
        text: line.text,
        portrait_state: line.enemyPortraitState,
        portrait_motion: line.enemyPortraitMotion
    })),
    weak_point_blueprint: roundPackage.blueprint.weakPoints.map(item => ({
        id: item.id,
        kind: item.kind,
        statement: item.statement,
        expected_evidence_name: item.expectedEvidenceName,
        consume_evidence_on_use: item.consumeEvidenceOnUse,
        grants_evidences: item.grantsEvidences,
        reveals_weak_point_ids: item.revealsWeakPointIds
    })),
    background_slot: roundPackage.blueprint.backgroundSlot,
    screen_filter: roundPackage.blueprint.screenFilter,
    screen_impulse: roundPackage.blueprint.screenImpulse,
    transition: roundPackage.blueprint.transition,
    enemy_portrait_state: roundPackage.blueprint.enemyPortraitState,
    enemy_portrait_motion: roundPackage.blueprint.enemyPortraitMotion
});

const buildRoundPackagePayload = (roundPackage: AiRoundPackage) => ({
    ...buildRoundBlueprintPayload(roundPackage),
    suspect_name: roundPackage.seed.suspectName,
    narrative: roundPackage.seed.narrative,
    evidences: roundPackage.seed.startingEvidences
});

const resolveTextForLang = (
    value: string | LocalizedText | undefined,
    lang: Language
) => {
    if (typeof value === 'string') {
        return value.trim();
    }

    if (!value || typeof value !== 'object') {
        return '';
    }

    const direct = value[lang];
    if (typeof direct === 'string' && direct.trim().length > 0) {
        return direct.trim();
    }

    return Object.values(value).find(entry => typeof entry === 'string' && entry.trim().length > 0)?.trim() || '';
};

const localizeTextForLang = (
    text: string | LocalizedText | undefined,
    lang: Language,
    fallback: string | LocalizedText = ''
): LocalizedText => {
    const resolved = resolveTextForLang(text, lang) || resolveTextForLang(fallback, lang);
    return resolved ? ({ [lang]: resolved } as LocalizedText) : {};
};

const firstLocalizedValue = (value: LocalizedText | undefined) => {
    if (!value) {
        return '';
    }
    return Object.values(value).find(entry => typeof entry === 'string' && entry.trim().length > 0)?.trim() || '';
};

const isAutoGeneratedSupportDetail = (value: string | undefined | null) =>
    typeof value === 'string' && /^Auto-generated support detail for .+\.$/.test(value.trim());

const resolveLocalizedText = (
    value: LocalizedText | undefined,
    lang: Language,
    fallback = ''
) => {
    if (!value) {
        return fallback;
    }

    const direct = value[lang];
    if (typeof direct === 'string' && direct.trim().length > 0) {
        return direct.trim();
    }

    return firstLocalizedValue(value) || fallback;
};

const buildStableCaseToken = (value: string | undefined, fallback: string) => {
    const normalized = normalizeText(value || '')
        .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/gi, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
};

const toLocalAvgLines = (lines: AvgDialogueLine[], lang: Language): LocalAvgLine[] =>
    lines.map(line => ({
        speaker: line.speaker,
        text: localizeTextForLang(line.text, lang),
        portraitState: line.portraitState,
        portraitMotion: line.portraitMotion,
        backgroundSlot: line.backgroundSlot,
        screenFilter: line.screenFilter,
        screenImpulse: line.screenImpulse,
        transition: line.transition
    }));

const extractWeakPointMarkerIds = (text: string) =>
    Array.from(text.matchAll(/\[\[([^:\]]+)::/g))
        .map(match => match[1]?.trim())
        .filter(Boolean) as string[];

const ensureCompiledEvidenceCatalog = (
    existing: LocalEvidence[],
    entries: EvidenceEntry[],
    lang: Language,
    startsInInventory: boolean
) => {
    const evidences = existing.map(evidence => ({
        ...evidence,
        name: { ...evidence.name },
        detail: { ...evidence.detail },
        aliases: [...(evidence.aliases || [])]
    }));
    const idByName = new Map<string, string>();
    const usedIds = new Set(evidences.map(evidence => evidence.id));

    evidences.forEach(evidence => {
        const localizedName = firstLocalizedValue(evidence.name);
        if (localizedName) {
            idByName.set(normalizeEvidenceName(localizedName), evidence.id);
        }
        (evidence.aliases || []).forEach(alias => {
            const normalized = normalizeEvidenceName(alias);
            if (normalized) {
                idByName.set(normalized, evidence.id);
            }
        });
    });

    entries.forEach((entry, index) => {
        const normalizedName = normalizeEvidenceName(entry.name);
        if (!normalizedName) {
            return;
        }

        const existingId = idByName.get(normalizedName);
        if (existingId) {
            const current = evidences.find(evidence => evidence.id === existingId);
            if (current) {
                current.name[lang] = entry.name;
                const currentDetail = firstLocalizedValue(current.detail);
                const shouldPreserveCurrentDetail =
                    isAutoGeneratedSupportDetail(entry.detail) &&
                    currentDetail.length > 0 &&
                    !isAutoGeneratedSupportDetail(currentDetail);
                if (!shouldPreserveCurrentDetail) {
                    current.detail[lang] = entry.detail;
                }
                current.startsInInventory = Boolean(current.startsInInventory || startsInInventory);
            }
            return;
        }

        let nextId = `evidence-${buildStableCaseToken(entry.name, `ai-${index + 1}`)}`;
        let suffix = 2;
        while (usedIds.has(nextId)) {
            nextId = `evidence-${buildStableCaseToken(entry.name, `ai-${index + 1}`)}-${suffix}`;
            suffix += 1;
        }
        usedIds.add(nextId);

        evidences.push({
            id: nextId,
            aliases: [],
            startsInInventory,
            name: localizeTextForLang(entry.name, lang),
            detail: localizeTextForLang(entry.detail, lang)
        });
        idByName.set(normalizedName, nextId);
    });

    return { evidences, idByName };
};

const buildFallbackAvgLine = (speaker: LocalAvgLine['speaker'], text: string, lang: Language): LocalAvgLine => ({
    speaker,
    text: localizeTextForLang(text, lang),
    portraitState: speaker === 'enemy' ? 'neutral_idle' : speaker === 'hero' ? 'serious_focus' : undefined,
    portraitMotion: 'none'
});

const compileAiRoundToLocalTurn = (
    roundPackage: AiRoundPackage,
    lang: Language,
    evidenceIdByName: Map<string, string>
): LocalTurn => {
    const weakPointById = new Map(roundPackage.blueprint.weakPoints.map(item => [item.id, item]));
    const lineIdByWeakPointId = new Map<string, string>();
    const dialogueCards: LocalDialogueCard[] = [];
    let lineCounter = 1;

    roundPackage.blueprint.dialogueSequence.forEach(line => {
        const lineId = `t${roundPackage.blueprint.turnIndex}-line-${lineCounter++}`;
        const markerIds = extractWeakPointMarkerIds(line.text);
        markerIds.forEach(markerId => {
            if (!lineIdByWeakPointId.has(markerId)) {
                lineIdByWeakPointId.set(markerId, lineId);
            }
        });
        const hidden = markerIds.some(markerId => weakPointById.get(markerId)?.kind === 'hidden');
        dialogueCards.push({
            id: lineId,
            text: localizeTextForLang(line.text, lang),
            hidden,
            unlockMode: 'none',
            unlockWeakPointIds: [],
            grantEvidenceIds: [],
            portraitState: line.enemyPortraitState,
            portraitMotion: line.enemyPortraitMotion
        });
    });

    roundPackage.blueprint.weakPoints.forEach(weakPoint => {
        if (lineIdByWeakPointId.has(weakPoint.id)) {
            return;
        }
        const lineId = `t${roundPackage.blueprint.turnIndex}-line-${lineCounter++}`;
        lineIdByWeakPointId.set(weakPoint.id, lineId);
        dialogueCards.push({
            id: lineId,
            text: localizeTextForLang(encodeWeakPointMarker(weakPoint.id, weakPoint.statement), lang),
            hidden: weakPoint.kind === 'hidden',
            unlockMode: 'none',
            unlockWeakPointIds: [],
            grantEvidenceIds: [],
            portraitState: weakPoint.kind === 'hidden' ? 'serious_focus' : undefined,
            portraitMotion: 'none'
        });
    });

    const weakPoints: LocalWeakPoint[] = roundPackage.blueprint.weakPoints.map(weakPoint => {
        const normalizedEvidenceName = weakPoint.expectedEvidenceName
            ? normalizeEvidenceName(weakPoint.expectedEvidenceName)
            : '';
        return {
            id: weakPoint.id,
            lineId: lineIdByWeakPointId.get(weakPoint.id) || `t${roundPackage.blueprint.turnIndex}-line-1`,
            evidenceId: normalizedEvidenceName ? (evidenceIdByName.get(normalizedEvidenceName) || '') : '',
            consumeEvidenceOnUse: weakPoint.consumeEvidenceOnUse !== false,
            statement: localizeTextForLang(weakPoint.statement, lang)
        };
    });

    const inspectOverrides: LocalInspectOverride[] = roundPackage.blueprint.weakPoints
        .filter(weakPoint => weakPoint.kind === 'inspect')
        .map(weakPoint => {
            const outcome = roundPackage.outcomes.inspectOutcomes[weakPoint.id];
            return {
                weakPointId: weakPoint.id,
                narrative: localizeTextForLang(outcome?.narrative, lang),
                avg: toLocalAvgLines(outcome?.avgSequence || [], lang),
                grantEvidenceIds: weakPoint.grantsEvidences
                    .map(entry => evidenceIdByName.get(normalizeEvidenceName(entry.name)))
                    .filter(Boolean) as string[],
                revealLineIds: weakPoint.revealsWeakPointIds
                    .map(id => lineIdByWeakPointId.get(id))
                    .filter(Boolean) as string[]
            };
        });

    const successOverrides: LocalSuccessOverride[] = roundPackage.blueprint.weakPoints
        .filter(weakPoint => weakPoint.kind === 'real' || weakPoint.kind === 'hidden')
        .map(weakPoint => {
            const outcome = roundPackage.outcomes.correctEvidenceOutcomes[weakPoint.id];
            return {
                weakPointId: weakPoint.id,
                narrative: localizeTextForLang(outcome?.narrative, lang),
                avg: toLocalAvgLines(outcome?.avgSequence || [], lang)
            };
        });

    const primarySuccessOutcome = successOverrides[0];
    const wrongEvidenceNarrative = roundPackage.outcomes.wrongEvidenceOutcome.narrative;
    const wrongInspectNarrative = roundPackage.outcomes.wrongInspectOutcome.narrative;
    const roundClearOutcome = roundPackage.outcomes.roundClearOutcome;

    const failNarrative: Record<FailureReason, LocalizedText> = {
        wrongEvidence: localizeTextForLang(wrongEvidenceNarrative, lang),
        wrongStatement: localizeTextForLang(wrongInspectNarrative || wrongEvidenceNarrative, lang),
        bothWrong: localizeTextForLang(wrongEvidenceNarrative, lang)
    };

    const failAvg: Record<FailureReason, LocalAvgLine[]> = {
        wrongEvidence: toLocalAvgLines(roundPackage.outcomes.wrongEvidenceOutcome.avgSequence, lang),
        wrongStatement: toLocalAvgLines(roundPackage.outcomes.wrongInspectOutcome.avgSequence, lang),
        bothWrong: toLocalAvgLines(roundPackage.outcomes.wrongEvidenceOutcome.avgSequence, lang)
    };

    const fallbackSuccessAvg = primarySuccessOutcome?.avg?.length
        ? primarySuccessOutcome.avg
        : [buildFallbackAvgLine('hero', '继续推进论证。', lang)];
    const fallbackTurnClearAvg = roundClearOutcome?.avgSequence?.length
        ? toLocalAvgLines(roundClearOutcome.avgSequence, lang)
        : fallbackSuccessAvg;

    return {
        weakPoints,
        loopDialogues: dialogueCards,
        startingEvidenceIds: roundPackage.seed.startingEvidences
            .map(entry => evidenceIdByName.get(normalizeEvidenceName(entry.name)))
            .filter(Boolean) as string[],
        queryNarratives: [localizeTextForLang(roundPackage.outcomes.wrongInspectOutcome.narrative, lang)],
        queryAvg: toLocalAvgLines(roundPackage.outcomes.wrongInspectOutcome.avgSequence, lang),
        inspectOverrides,
        sceneBackgroundSlot: roundPackage.blueprint.backgroundSlot as LocalTurn['sceneBackgroundSlot'] || 'cross_exam',
        enemyPortraitState: roundPackage.blueprint.enemyPortraitState as LocalTurn['enemyPortraitState'] || 'neutral_idle',
        enemyPortraitMotion: roundPackage.blueprint.enemyPortraitMotion as LocalTurn['enemyPortraitMotion'] || 'none',
        screenFilter: roundPackage.blueprint.screenFilter as LocalTurn['screenFilter'] || 'none',
        screenImpulse: roundPackage.blueprint.screenImpulse as LocalTurn['screenImpulse'] || 'none',
        transition: roundPackage.blueprint.transition as LocalTurn['transition'] || 'cut',
        successNarrative: primarySuccessOutcome?.narrative || localizeTextForLang('击破成功。', lang),
        successOverrides,
        useSeparateTurnClear: Boolean(roundClearOutcome),
        turnClearNarrative: localizeTextForLang(roundClearOutcome?.narrative, lang, firstLocalizedValue(primarySuccessOutcome?.narrative)),
        turnClearAvg: fallbackTurnClearAvg,
        useSeparateFailureReasons: true,
        failNarrative,
        logicExplanation: localizeTextForLang(
            Object.values(roundPackage.outcomes.correctEvidenceOutcomes).find(outcome => outcome.logicExplanation?.trim())?.logicExplanation,
            lang,
            '继续根据证据链推进推理。'
        ),
        successAvg: fallbackSuccessAvg,
        failAvg,
        failOverrides: {
            wrongEvidence: [],
            wrongStatement: [],
            bothWrong: []
        },
        interferenceLines: []
    };
};

const buildCompiledAiCaseDraft = (
    roundPackages: AiRoundPackage[],
    options: {
        caseId: string;
        filename: string;
        lang: Language;
        castSelection: GameState['castSelection'];
        heroEmoji?: string | null;
        enemyEmoji?: string | null;
    }
): CompiledAiCaseDraft | null => {
    if (roundPackages.length === 0) {
        return null;
    }

    const sortedPackages = [...roundPackages].sort((left, right) => left.blueprint.turnIndex - right.blueprint.turnIndex);
    const openingPackage = sortedPackages[0];
    let evidences: LocalEvidence[] = [];

    sortedPackages.forEach(roundPackage => {
        const evidenceSource = [
            ...roundPackage.seed.startingEvidences,
            ...roundPackage.blueprint.weakPoints.flatMap(weakPoint => weakPoint.grantsEvidences),
            ...roundPackage.blueprint.weakPoints
                .filter(weakPoint => Boolean(weakPoint.expectedEvidenceName))
                .map(weakPoint => ({
                    name: weakPoint.expectedEvidenceName || '',
                    detail: weakPoint.expectedEvidenceName ? `Auto-generated support detail for ${weakPoint.expectedEvidenceName}.` : ''
                }))
        ];
        evidences = ensureCompiledEvidenceCatalog(
            evidences,
            evidenceSource.filter(entry => entry.name.trim().length > 0 && entry.detail.trim().length > 0),
            options.lang,
            roundPackage.blueprint.turnIndex === 1
        ).evidences;
    });

    const { evidences: normalizedEvidences, idByName } = ensureCompiledEvidenceCatalog(evidences, [], options.lang, false);
    const turns: LocalTurn[] = sortedPackages.map(roundPackage =>
        compileAiRoundToLocalTurn(roundPackage, options.lang, idByName)
    );
    const finalPackage = [...sortedPackages].reverse().find(roundPackage => roundPackage.blueprint.isFinalRound) || sortedPackages[sortedPackages.length - 1];
    const victorySource = finalPackage.outcomes.victoryOutcome || finalPackage.outcomes.roundClearOutcome;
    const suspectName = resolveRuntimeSuspectName({
        explicit: openingPackage.seed.suspectName,
        inferred: inferSuspectNameFromTranscript(
            openingPackage.blueprint.enemyDialogue,
            openingPackage.blueprint.dialogueSequence
        ),
        fallback: 'AI Suspect'
    }) || 'AI Suspect';

    const caseData: LocalCaseData = {
        caseId: options.caseId,
        caseTitle: localizeTextForLang(`AI案件：${suspectName}`, options.lang),
        defaultLang: options.lang,
        suspectName: localizeTextForLang(suspectName, options.lang),
        suspectEmoji: filterEmoji(options.enemyEmoji || ''),
        heroEmoji: filterEmoji(options.heroEmoji || ''),
        heroPortraitPackId: options.castSelection.heroPortraitPackId,
        enemyPortraitPackId: options.castSelection.enemyPortraitPackId,
        backgroundPackId: options.castSelection.backgroundPackId,
        intro: {
            narrative: localizeTextForLang(openingPackage.seed.narrative, options.lang),
            systemMsg: localizeTextForLang(openingPackage.seed.systemMsg, options.lang),
            backgroundSlot: openingPackage.blueprint.backgroundSlot as LocalCaseData['intro']['backgroundSlot'] || 'briefing',
            enemyPortraitState: openingPackage.blueprint.enemyPortraitState as LocalCaseData['intro']['enemyPortraitState'] || 'neutral_idle',
            screenFilter: openingPackage.blueprint.screenFilter as LocalCaseData['intro']['screenFilter'] || 'none',
            transition: openingPackage.blueprint.transition as LocalCaseData['intro']['transition'] || 'fade'
        },
        evidences: normalizedEvidences,
        turns,
        victory: {
            narrative: localizeTextForLang(victorySource?.narrative, options.lang, '案件结束。'),
            confession: localizeTextForLang(
                victorySource?.enemyDialogue || finalPackage.blueprint.enemyDialogue,
                options.lang,
                '……我承认。'
            ),
            avg: victorySource?.avgSequence?.length
                ? toLocalAvgLines(victorySource.avgSequence, options.lang)
                : [buildFallbackAvgLine('system', '终局演出尚未生成完成。', options.lang)],
            backgroundSlot: victorySource?.backgroundSlot as LocalCaseData['victory']['backgroundSlot'] || 'confession',
            screenFilter: victorySource?.screenFilter as LocalCaseData['victory']['screenFilter'] || 'dim',
            transition: victorySource?.transition as LocalCaseData['victory']['transition'] || 'fade'
        }
    };

    const serializedText = serializeLocalCaseText(caseData);
    const normalizedCaseData = parseLocalCaseText(serializedText);

    return {
        caseId: options.caseId,
        filename: options.filename,
        caseData: normalizedCaseData,
        serializedText,
        generatedTurnCount: sortedPackages.length
    };
};

const buildAvgTranscriptLogs = (
    lines: AvgDialogueLine[],
    token: string
) => {
    const transcriptGroupKey = [
        'avg',
        lines
            .map(line => `${line.speaker}:${normalizeText(line.text)}`)
            .join('||')
    ].join('::');

    return lines.map((line, index) => ({
        id: `${token}-${index}`,
        type: line.speaker === 'system' ? 'system' : 'chat',
        role: line.speaker === 'hero' || line.speaker === 'enemy' ? line.speaker : undefined,
        text: line.text,
        transcriptGroupKey
    }));
};

const buildWeakPointSimilarityFingerprint = (statement: string) =>
    normalizeText(statement)
        .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]/gi, '');

const buildCharacterBigrams = (statement: string) => {
    const normalized = buildWeakPointSimilarityFingerprint(statement);
    if (normalized.length <= 2) {
        return new Set(normalized ? [normalized] : []);
    }

    const grams = new Set<string>();
    for (let index = 0; index < normalized.length - 1; index += 1) {
        grams.add(normalized.slice(index, index + 2));
    }
    return grams;
};

const computeWeakPointSimilarity = (left: string, right: string) => {
    const leftGrams = buildCharacterBigrams(left);
    const rightGrams = buildCharacterBigrams(right);
    if (leftGrams.size === 0 || rightGrams.size === 0) {
        return 0;
    }

    let overlap = 0;
    leftGrams.forEach(gram => {
        if (rightGrams.has(gram)) {
            overlap += 1;
        }
    });

    return overlap / (leftGrams.size + rightGrams.size - overlap);
};

const PREMATURE_CONFESSION_PATTERNS = [
    /(是我|确实是我|人是我)(?:杀了|杀的)/,
    /我(?:杀了|害死了).{0,8}(?:他|她|叔叔|阿姨|受害者)/,
    /凶手就是我/,
    /我承认.{0,6}(?:杀了|杀死|害死)/,
    /私が.*殺した/,
    /犯人は私/,
    /私がやった/,
    /\bi killed (him|her|them|the victim)\b/i,
    /\bi am the killer\b/i,
    /\bit was me\b.*\bkill/i
];

const containsPrematureConfession = (text: string) =>
    PREMATURE_CONFESSION_PATTERNS.some(pattern => pattern.test(text));

const collectOutcomeTranscriptText = (outcome?: AiRoundOutcomeSegment | null) => {
    if (!outcome) {
        return '';
    }

    return [
        outcome.narrative,
        outcome.enemyDialogue,
        ...outcome.avgSequence.map(line => line.text)
    ]
        .filter(Boolean)
        .join('\n');
};

const validateAiRoundProgression = (
    seed: AiRoundSeedSegment,
    blueprint: AiRoundBlueprint,
    exitContext?: AiRoundExitContext
) => {
    if (seed.turnIndex < 1 || seed.turnIndex > AI_TOTAL_TURNS) {
        return { ok: false as const, reason: `AI mode only supports ${AI_TOTAL_TURNS} rounds.` };
    }

    if (seed.isFinalRound !== (seed.turnIndex === AI_TOTAL_TURNS)) {
        return {
            ok: false as const,
            reason: `Round ${seed.turnIndex} has inconsistent is_final_round flag.`
        };
    }

    const transcript = [
        blueprint.enemyDialogue,
        ...blueprint.dialogueSequence.map(line => line.text)
    ].join('\n');
    const declaredSuspectName = extractDeclaredSuspectNameFromText(transcript);

    if (
        declaredSuspectName
        && sanitizeSuspectName(seed.suspectName)
        && normalizeSuspectNameKey(declaredSuspectName) !== normalizeSuspectNameKey(seed.suspectName || '')
    ) {
        return {
            ok: false as const,
            reason: `Round ${seed.turnIndex} suspect_name does not match the suspect's spoken self-introduction.`
        };
    }

    if (!seed.isFinalRound) {

        if (containsPrematureConfession(transcript)) {
            return {
                ok: false as const,
                reason: `Round ${seed.turnIndex} escalated into a full confession before the final round.`
            };
        }

        if (blueprint.enemyPortraitState === 'sad_confession') {
            return {
                ok: false as const,
                reason: `Round ${seed.turnIndex} used a final-confession portrait state too early.`
            };
        }

        if (blueprint.backgroundSlot === 'confession' || blueprint.backgroundSlot === 'ending') {
            return {
                ok: false as const,
                reason: `Round ${seed.turnIndex} used an endgame background slot too early.`
            };
        }
    }

    if (exitContext && seed.turnIndex !== exitContext.nextTurnIndex) {
        return {
            ok: false as const,
            reason: `Generated round ${seed.turnIndex} does not match expected next turn ${exitContext.nextTurnIndex}.`
        };
    }

    return { ok: true as const };
};

const buildEnemyLogFromRoundBlueprint = (blueprint: AiRoundBlueprint, avatarEmoji: string): LogEntry => ({
    id: `ai-round-${blueprint.turnIndex}-${Date.now()}`,
    type: 'chat',
    role: 'enemy',
    hiddenInCaseLog: true,
    text: blueprint.enemyDialogue,
    avatarEmoji,
    backgroundSlot: blueprint.backgroundSlot,
    enemyPortraitState: blueprint.enemyPortraitState,
    enemyPortraitMotion: blueprint.enemyPortraitMotion,
    screenFilter: blueprint.screenFilter,
    screenImpulse: blueprint.screenImpulse,
    transition: blueprint.transition,
    dialogueSequence: blueprint.dialogueSequence,
    roundIndex: blueprint.turnIndex
});

const buildRemoteRoundDraftKey = (
    lang: Language,
    castSelection: GameState['castSelection'],
    options: {
        opening: boolean;
        scope: 'boot' | 'runtime';
        turnIndex: number;
        inventory: EvidenceEntry[];
        exitContext?: AiRoundExitContext;
        suspectName?: string;
    }
) => JSON.stringify({
    lang,
    castSelection,
    opening: options.opening,
    scope: options.scope,
    turnIndex: options.turnIndex,
    inventory: options.inventory,
    exitContext: options.exitContext || null,
    suspectName: options.suspectName || ''
});

const buildAiCapabilityBlock = (castSelection: GameState['castSelection']) => `\
[VISUAL PACKS]
hero_portrait_pack_id = ${castSelection.heroPortraitPackId}
enemy_portrait_pack_id = ${castSelection.enemyPortraitPackId}
background_pack_id = ${castSelection.backgroundPackId}

[ALLOWED VISUAL ENUMS]
portrait_states = ${PORTRAIT_STATES.join(', ')}
portrait_motions = ${PORTRAIT_MOTIONS.join(', ')}
background_slots = ${BACKGROUND_SLOTS.join(', ')}
screen_filters = ${SCREEN_FILTERS.join(', ')}
screen_impulses = ${SCREEN_IMPULSES.join(', ')}
transitions = ${SCENE_TRANSITIONS.join(', ')}`;

const buildRemoteRoundSeedPrompt = (
    lang: Language,
    castSelection: GameState['castSelection'],
    basePrompt: string,
    options: {
        opening: boolean;
        currentTurnIndex: number;
        currentInventory: EvidenceEntry[];
        exitContext?: AiRoundExitContext;
        suspectName?: string | null;
    }
) => {
    const currentSuspectName = sanitizeSuspectName(options.suspectName);
    const suspectNameExample = lang === 'ja'
        ? '莉々'
        : lang === 'en'
            ? 'Lily Mercer'
            : '莉莉';

    return `\
${basePrompt}

[SYSTEM: GENERATE_ROUND_SEED_V1]
Language = ${lang}
${buildAiCapabilityBlock(castSelection)}

Return JSON only.
All user-visible text must match Language exactly.

Context:
- mode = ${options.opening ? 'opening' : 'continuation'}
- target_turn_index = ${options.currentTurnIndex}
- suspect_name = ${currentSuspectName || '(generate a concrete suspect name now)'}
- current_inventory = ${JSON.stringify(options.currentInventory, null, 2)}
- fixed_total_turns = ${AI_TOTAL_TURNS}
- exit_context = ${JSON.stringify(options.exitContext || null, null, 2)}

Rules:
1. Generate only seed metadata for the round. Do not generate testimony, avg_sequence, weak points, or branch outcomes yet.
2. If mode = opening, narrative is required and starting evidences must contain 2-4 entries.
3. If mode = continuation, narrative is optional and starting evidences may be empty.
4. suspect_name must stay consistent with the current suspect. If no valid suspect name is supplied yet, invent one specific concrete human name now.
5. narrative must be a single plain string summary in Language. Do not return narrative as an array, object, screenplay, or speaker-tagged scene list.
6. Every evidence item must use this exact schema: { "name": "...", "detail": "..." }. Do not use "description".
7. Do not include speaker, portrait, background, transition, or filter objects in this stage.
8. This AI mode always has exactly ${AI_TOTAL_TURNS} turns. turn_index must equal target_turn_index.
9. is_final_round must be true only when turn_index = ${AI_TOTAL_TURNS}.
10. If exit_context exists, follow its next_stage and next_round_focus guidance instead of reusing prior round language.
11. suspect_name must never be a generic placeholder such as Unknown, Suspect, Target, Enemy, 嫌疑人, 嫌犯, 容疑者, or 未知嫌犯.

Required keys:
- turn_index
- is_final_round
- suspect_name
- system_msg
- evidences

Optional keys:
- narrative

Seed schema example:
{
  "turn_index": ${options.currentTurnIndex},
  "is_final_round": false,
  "suspect_name": ${JSON.stringify(currentSuspectName || suspectNameExample)},
  "system_msg": "single system line",
  "narrative": "single opening summary paragraph",
  "evidences": [
    { "name": "证据A", "detail": "证据A详情" },
    { "name": "证据B", "detail": "证据B详情" }
  ]
}
`;
};

const buildRemoteRoundCorePrompt = (
    lang: Language,
    basePrompt: string,
    seed: AiRoundSeedSegment,
    castSelection: GameState['castSelection'],
    currentInventory: EvidenceEntry[],
    exitContext?: AiRoundExitContext
) => `\
${basePrompt}

[SYSTEM: GENERATE_ROUND_CORE_V1]
Language = ${lang}
${buildAiCapabilityBlock(castSelection)}

Return JSON only.
All user-visible text must match Language exactly.

Seed:
${JSON.stringify({
    turn_index: seed.turnIndex,
    is_final_round: seed.isFinalRound,
    suspect_name: seed.suspectName,
    system_msg: seed.systemMsg,
    evidences: seed.startingEvidences
}, null, 2)}

Current inventory:
${JSON.stringify(currentInventory, null, 2)}

Round exit context:
${JSON.stringify(exitContext || null, null, 2)}

Rules:
1. Generate suspect testimony only in enemy_dialogue and dialogue_sequence.
2. dialogue_sequence speaker must be "enemy" on every line.
3. Every real or hidden weak point must be solvable using:
   - current inventory, or
   - seed evidences, or
   - evidence granted by an inspect weak point in this same round.
4. Hidden weak points must be revealed by reveals_weak_point_ids from inspect weak points.
5. dialogue_sequence must contain clickable markers [[weakPointId::statement]] matching weak_point_blueprint exactly.
6. Use only the canonical schema below. Do not use legacy keys such as "type", "solution", "portrait", "motion", or "is_hidden".
7. Each real or hidden weak point must attack a distinct factual axis. Do not generate near-duplicate weak points that merely paraphrase the same contradiction.
8. This AI mode always has exactly ${AI_TOTAL_TURNS} turns. turn_index = 1 must be denial-stage, turn_index = 2 must probe means/timeline/concealment, turn_index = 3 is the only final-confession round.
9. If exit_context exists, you must follow exit_context.next_stage and exit_context.next_round_focus.
10. Before the final round, do not write testimony that already fully settles the case with an explicit murder confession.
11. Before the final round, do not use a confession-ending tone, and do not stage the suspect as fully broken or surrendered.
12. Every round must include at least ${AI_MIN_TRUE_WEAK_POINTS} breakable real/hidden weak points. One-breakpoint rounds are forbidden.

Required keys:
- enemy_dialogue
- dialogue_sequence
- weak_point_blueprint

Optional keys:
- background_slot
- screen_filter
- screen_impulse
- transition
- enemy_portrait_state
- enemy_portrait_motion

Canonical schema example:
{
  "enemy_dialogue": "single combined suspect testimony block",
  "dialogue_sequence": [
    {
      "speaker": "enemy",
      "text": "[[wp_real_a::Suspect testimony sentence A]]",
      "portrait_state": "neutral_idle",
      "portrait_motion": "none"
    },
    {
      "speaker": "enemy",
      "text": "[[wp_inspect_a::Suspicious sentence that should be inspected]]",
      "portrait_state": "serious_focus",
      "portrait_motion": "talk"
    }
  ],
  "weak_point_blueprint": [
    {
      "id": "wp_real_a",
      "kind": "real",
      "statement": "Suspect testimony sentence A",
      "expected_evidence_name": "Evidence A",
      "consume_evidence_on_use": true,
      "grants_evidences": [],
      "reveals_weak_point_ids": []
    },
    {
      "id": "wp_inspect_a",
      "kind": "inspect",
      "statement": "Suspicious sentence that should be inspected",
      "consume_evidence_on_use": false,
      "grants_evidences": [
        { "name": "Evidence B", "detail": "Detail for Evidence B" }
      ],
      "reveals_weak_point_ids": ["wp_hidden_a"]
    },
    {
      "id": "wp_hidden_a",
      "kind": "hidden",
      "statement": "Hidden contradiction statement",
      "expected_evidence_name": "Evidence B",
      "consume_evidence_on_use": true,
      "grants_evidences": [],
      "reveals_weak_point_ids": []
    }
  ]
}
`;

const buildRemoteRoundOutcomePrompt = (
    lang: Language,
    basePrompt: string,
    roundPackageSeed: AiRoundSeedSegment,
    roundBlueprint: AiRoundBlueprint,
    currentInventory: EvidenceEntry[],
    exitContext?: AiRoundExitContext
) => `\
${basePrompt}

[SYSTEM: GENERATE_ROUND_OUTCOMES_V1]
Language = ${lang}

Return JSON only.
All user-visible text must match Language exactly.

Seed:
${JSON.stringify({
    turn_index: roundPackageSeed.turnIndex,
    is_final_round: roundPackageSeed.isFinalRound,
    suspect_name: roundPackageSeed.suspectName,
    system_msg: roundPackageSeed.systemMsg
}, null, 2)}

Round core:
${JSON.stringify(buildRoundBlueprintPayload(assembleAiRoundPackage(roundPackageSeed, roundBlueprint, {
    inspectOutcomes: {},
    correctEvidenceOutcomes: {},
    wrongEvidenceOutcome: {
        narrative: '',
        avgSequence: [],
        heroDmgTaken: 0,
        enemyDmgTaken: 0,
        attackType: 'miss'
    },
    wrongInspectOutcome: {
        narrative: '',
        avgSequence: [],
        heroDmgTaken: 0,
        enemyDmgTaken: 0,
        attackType: 'query'
    }
})), null, 2)}

Current inventory:
${JSON.stringify(currentInventory, null, 2)}

Round exit context:
${JSON.stringify(exitContext || null, null, 2)}

Rules:
1. Do not change testimony, weak point ids, or evidence mapping.
2. Generate local playable outcomes for the whole round.
3. inspect_outcomes must cover every inspect weak point id.
4. correct_evidence_outcomes must cover every real and hidden weak point id.
5. wrong_evidence_outcome and wrong_inspect_outcome are required.
6. Use avg_sequence for all AVG lines that should play after inspect / hit / miss / clear.
7. enemy_dialogue inside an outcome must remain suspect speech only.
8. If round_clear_outcome exists, it should represent the transition after all real/hidden weak points are solved.
9. If is_final_round is true, also provide victory_outcome.
10. Every outcome item must include attack_type, hero_dmg_taken, enemy_dmg_taken, narrative, and avg_sequence.
11. inspect_outcomes must always use attack_type = "query", hero_dmg_taken = 0, enemy_dmg_taken = 0.
12. correct_evidence_outcomes must always use attack_type = "strict", hero_dmg_taken = 0, enemy_dmg_taken > 0. The runtime will normalize the exact strict-hit damage based on the fixed round budget.
13. wrong_evidence_outcome must use attack_type = "miss".
14. wrong_inspect_outcome must use attack_type = "query".
15. Do not omit combat fields just because an avg_sequence already exists.
16. inspect_outcomes and correct_evidence_outcomes must be object maps keyed by weak point id. Do not return arrays.
17. Before the final round, round_clear_outcome may show pressure, panic, partial admission, or a shift in topic, but it must not contain a full murder confession that makes the next round's investigation pointless.
18. Before the final round, do not use sad_confession, ending, or final confession staging in round_clear_outcome.
19. If exit_context exists, advance according to exit_context.next_stage and exit_context.next_round_focus instead of repeating the previous contradiction family.

Required keys:
- inspect_outcomes
- correct_evidence_outcomes
- wrong_evidence_outcome
- wrong_inspect_outcome

Optional keys:
- round_clear_outcome
- victory_outcome

Outcome item schema example:
{
  "weak_point_id": "wp_real_a",
  "attack_type": "strict",
  "hero_dmg_taken": 0,
  "enemy_dmg_taken": 12,
  "narrative": "Short narration describing the impact of the successful rebuttal.",
  "enemy_dialogue": "Suspect reaction only.",
  "avg_sequence": [
    {
      "speaker": "hero",
      "text": "Hero follow-up line.",
      "portrait_state": "serious_focus",
      "portrait_motion": "pop"
    }
  ],
  "enemy_portrait_state": "defensive_frown",
  "enemy_portrait_motion": "shake_small",
  "background_slot": "cross_exam",
  "screen_filter": "none",
  "screen_impulse": "zoom_punch",
  "transition": "cut"
}

Container shape example:
{
  "inspect_outcomes": {
    "wp_inspect_a": {
      "weak_point_id": "wp_inspect_a",
      "attack_type": "query",
      "hero_dmg_taken": 0,
      "enemy_dmg_taken": 0,
      "narrative": "Inspect narration",
      "enemy_dialogue": "Suspect reaction only",
      "avg_sequence": []
    }
  },
  "correct_evidence_outcomes": {
    "wp_real_a": {
      "weak_point_id": "wp_real_a",
      "attack_type": "strict",
      "hero_dmg_taken": 0,
      "enemy_dmg_taken": 12,
      "narrative": "Correct-hit narration",
      "enemy_dialogue": "Suspect reaction only",
      "avg_sequence": []
    }
  }
}
`;

const buildRemoteOpeningPrompt = (
    lang: Language,
    castSelection: GameState['castSelection'],
    basePrompt: string
) => `\
${basePrompt}

[SYSTEM: GENERATE_OPENING_PACKAGE_V2]
Language = ${lang}
${buildAiCapabilityBlock(castSelection)}

Return JSON only.
All user-visible text must match Language exactly.

Role rules:
1. enemy_dialogue and dialogue_sequence are suspect testimony only.
2. dialogue_sequence speaker must be "enemy" on every line.
3. Never put hero lines, system announcements, "审判开始", "证据确凿", "OBJECTION", or narrator lines into enemy_dialogue or dialogue_sequence.
4. Hero/system/narrator lines may only appear in narrative or avg_sequence.

Solvability rules:
1. Provide 2-4 starting evidences in evidences.
2. Provide enough weak_point_blueprint entries for round 1 to support at least ${AI_MIN_TRUE_WEAK_POINTS} real/hidden breakable weak points.
3. Every real or hidden weak point must be solvable using either:
   - a starting evidence from evidences, or
   - evidence granted by an inspect weak point in this same round.
4. Hidden weak points must be revealed by reveals_weak_point_ids from an inspect weak point.
5. dialogue_sequence must contain clickable markers in the form [[weakPointId::statement]] matching weak_point_blueprint ids/statements exactly.
6. This AI mode always has exactly ${AI_TOTAL_TURNS} turns. Opening must always set turn_index = 1 and is_final_round = false.
7. Round 1 is the denial stage. It may establish suspicion and crack the alibi, but it must not contain a full murder confession.
8. Round 1 must still include at least ${AI_MIN_TRUE_WEAK_POINTS} breakable real/hidden weak points. Do not compress the round into a single contradiction.

Required keys:
- suspect_name
- narrative
- system_msg
- evidences
- enemy_dialogue
- dialogue_sequence
- weak_point_blueprint
- turn_index
- is_final_round

Optional keys:
- avg_sequence
- background_slot
- screen_filter
- screen_impulse
- transition
- enemy_portrait_state
- enemy_portrait_motion

weak_point_blueprint item schema:
{
  "id": "t1-wp-a",
  "kind": "real | inspect | fake | hidden",
  "statement": "clickable statement text",
  "expected_evidence_name": "required for real/hidden",
  "consume_evidence_on_use": true,
  "grants_evidences": [{ "name": "证据A", "detail": "..." }],
  "reveals_weak_point_ids": ["t1-hidden-b"]
}

dialogue_sequence item schema:
{
  "speaker": "enemy",
  "text": "[[t1-wp-a::clickable testimony text]]",
  "portrait_state": "neutral_idle",
  "portrait_motion": "none"
}

avg_sequence item schema:
{
  "speaker": "hero | enemy | system",
  "text": "avg dialogue text",
  "portrait_state": "serious_focus",
  "portrait_motion": "none"
}
`;

const buildRemoteActionPrompt = (
    lang: Language,
    basePrompt: string,
    state: GameState,
    currentRound: AiRoundBlueprint | null,
    evidenceMap: Map<string, string>,
    usedEvidenceSet: Set<string>,
    actionText: string
) => {
    const inventory = Array.from(evidenceMap.entries()).map(([name, detail]) => ({ name, detail }));
    const used = Array.from(usedEvidenceSet.values());
    const roundPayload = currentRound
        ? JSON.stringify({
            turn_index: currentRound.turnIndex,
            is_final_round: currentRound.isFinalRound,
            enemy_dialogue: currentRound.enemyDialogue,
            dialogue_sequence: currentRound.dialogueSequence,
            weak_point_blueprint: currentRound.weakPoints,
            system_msg: currentRound.systemMsg
        }, null, 2)
        : '{}';

    return `\
${basePrompt}

[SYSTEM: RESOLVE_ROUND_ACTION_V2]
Language = ${lang}
${buildAiCapabilityBlock(state.castSelection)}

Return JSON only.
All user-visible text must match Language exactly.

Current state:
- hero_hp = ${state.heroHp}
- enemy_hp = ${state.enemyHp}
- suspect_name = ${state.suspectName || 'Unknown'}
- current_round_plan = ${roundPayload}
- current_inventory = ${JSON.stringify(inventory, null, 2)}
- used_evidence = ${JSON.stringify(used)}
- player_action = ${JSON.stringify(actionText)}

Resolution rules:
1. Resolve the action only against current_round_plan. Do not invent a different weak point map.
2. enemy_dialogue and dialogue_sequence must remain suspect testimony only.
3. Hero/system/narrator lines must go to narrative or avg_sequence, never to enemy_dialogue/dialogue_sequence.
4. If the player inspects a valid inspect weak point, return the planned grants_evidences and any newly revealed hidden weak points in weak_point_blueprint/dialogue_sequence.
5. If the player uses the correct evidence for a real or hidden weak point, set attack_type = "strict" and include resolved_weak_point_id.
6. If the player uses the wrong evidence, never pretend it is correct.
7. Damage rules:
   - valid inspect: hero_dmg_taken = 0, enemy_dmg_taken = 0
   - query / wrong inspect: hero_dmg_taken = 5, enemy_dmg_taken = 0
   - miss / wrong evidence: hero_dmg_taken = 10, enemy_dmg_taken = 0
   - strict hit: hero_dmg_taken = 0, enemy_dmg_taken = 10-20
8. Respect HP lock: if enemy_hp > 10, strict damage must not skip directly below 10.
9. When the round is fully resolved, set round_status = "cleared".
10. If the round is cleared and this is not the final round, you may include next_round_package using the same schema as the opening round package.
11. If this is the final round and the final weak point is solved, set enemy_surrendered = true and include confession-style avg_sequence.

Required keys:
- attack_type
- hero_dmg_taken
- enemy_dmg_taken
- narrative
- enemy_dialogue
- dialogue_sequence
- weak_point_blueprint
- turn_index
- round_status

Optional keys:
- resolved_weak_point_id
- granted_evidences
- avg_sequence
- next_round_package
- enemy_surrendered
- case_truth
- background_slot
- screen_filter
- screen_impulse
- transition
- enemy_portrait_state
- enemy_portrait_motion

dialogue_sequence item schema:
{
  "speaker": "enemy",
  "text": "[[weakPointId::suspect testimony text]]",
  "portrait_state": "defensive_frown",
  "portrait_motion": "shake_small"
}

avg_sequence item schema:
{
  "speaker": "hero | enemy | system",
  "text": "avg dialogue text",
  "portrait_state": "serious_focus",
  "portrait_motion": "none"
}
`;
};

const EVIDENCE_ACTION_REGEX = /\[USE_EVIDENCE:\s*(.*?)\]\s*\[TARGET_STATEMENT:\s*"((?:\\"|[^"])*)"\s*\](?:\s*\[TARGET_WEAK_POINT_ID:\s*"((?:\\"|[^"])*)"\s*\])?/i;
const LEGACY_EVIDENCE_ACTION_REGEX = /\[[^\]]*:\s*(.*?)\]\s*[^\"]*"(.*?)"/;
const parseInputFromTurnInfo = (input: string): string => {
    const jsonLine = input.match(/\[Input_JSON\]\s*(.+)/);
    if (jsonLine) {
        try {
            const parsed = JSON.parse(jsonLine[1].trim());
            if (typeof parsed === 'string') return parsed;
        } catch {
            // Fall through to legacy parsing.
        }
    }

    const quotedLine = input.match(/\[Input\]\s*"((?:\\"|[^"])*)"/);
    if (quotedLine) {
        return quotedLine[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }

    if (input.includes('[SYSTEM: GENERATE_PROLOGUE]')) {
        return '[SYSTEM: GENERATE_PROLOGUE]';
    }

    return input;
};

const parseEvidenceAction = (text: string): ParsedEvidenceAction | null => {
    const modernMatch = text.match(EVIDENCE_ACTION_REGEX);
    if (modernMatch) {
        return {
            evidenceName: modernMatch[1].trim(),
            statement: modernMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
            weakPointId: modernMatch[3]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim() || undefined
        };
    }

    const legacyMatch = text.match(LEGACY_EVIDENCE_ACTION_REGEX);
    if (legacyMatch) {
        return {
            evidenceName: legacyMatch[1].trim(),
            statement: legacyMatch[2].trim()
        };
    }

    return null;
};

const buildEvidenceAction = (name: string, statement: string, weakPointId?: string): string => {
    const escapedStatement = statement.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const weakPointPart = weakPointId ? ` [TARGET_WEAK_POINT_ID: "${weakPointId}"]` : '';
    return `[USE_EVIDENCE: ${name}] [TARGET_STATEMENT: "${escapedStatement}"]${weakPointPart}`;
};

const buildInspectAction = (statement: string, weakPointId?: string): string => {
    const escapedStatement = statement.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const weakPointPart = weakPointId ? ` [TARGET_WEAK_POINT_ID: "${weakPointId}"]` : '';
    return `[INSPECT_STATEMENT: "${escapedStatement}"]${weakPointPart}`;
};

export default function App() {
    const [screen, setScreen] = useState<ScreenType>('start');
    const [lang, setLang] = useState<Language>('zh');
    const [isLocalMode, setIsLocalMode] = useState(false);
    const [gameState, setGameState] = useState<GameState>(() => createInitialGameState());
    const [evidenceMap, setEvidenceMap] = useState<Map<string, string>>(new Map());
    const [usedEvidenceSet, setUsedEvidenceSet] = useState<Set<string>>(new Set());
    const [resolvedStatementsMap, setResolvedStatementsMap] = useState<Map<string, ResolvedStatement>>(new Map());
    const [inspectedWeakPointIdsByTurn, setInspectedWeakPointIdsByTurn] = useState<Map<number, Set<string>>>(new Map());
    const [resolvedWeakPointIdsByTurn, setResolvedWeakPointIdsByTurn] = useState<Map<number, Set<string>>>(new Map());
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [activeEnemyLog, setActiveEnemyLog] = useState<LogEntry | null>(null);
    const [focusDialogue, setFocusDialogue] = useState<FocusDialogueState | null>(null);
    const [evidenceReward, setEvidenceReward] = useState<EvidenceRewardState | null>(null);
    const [gameResult, setGameResult] = useState<GameResultState | null>(null);
    const [pendingLogs, setPendingLogs] = useState<LogEntry[]>([]);
    const [isCurrentlyTyping, setIsCurrentlyTyping] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [localCases, setLocalCases] = useState<LocalCaseOption[]>([]);
    const [portraitPacks, setPortraitPacks] = useState<PortraitPackOption[]>([]);
    const [backgroundPacks, setBackgroundPacks] = useState<BackgroundPackOption[]>([]);
    const [localWorkspaceInfo, setLocalWorkspaceInfo] = useState<LocalCaseWorkspaceInfo>({
        supported: false,
        linked: false,
        directoryName: null,
        permission: 'unsupported'
    });
    
    const [introData, setIntroData] = useState<IntroDataState | null>(null);
    const [runtimeRoundIntro, setRuntimeRoundIntro] = useState<RoundIntroRequest | null>(null);
    const [remoteRoundBlueprint, setRemoteRoundBlueprint] = useState<AiRoundBlueprint | null>(null);
    const [remoteRoundPackage, setRemoteRoundPackage] = useState<AiRoundPackage | null>(null);
    const [sessionDisplay, setSessionDisplay] = useState<SessionDisplayState | null>(null);
    const [loadDiagnostics, setLoadDiagnostics] = useState<LoadDiagnosticsState | null>(null);
    const [compiledAiCaseDraft, setCompiledAiCaseDraft] = useState<CompiledAiCaseDraft | null>(null);
    const [compiledAiCaseSaveState, setCompiledAiCaseSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [compiledAiCaseSaveMessage, setCompiledAiCaseSaveMessage] = useState<string | null>(null);
    const [debugAiGenerationProgress, setDebugAiGenerationProgress] = useState<DebugAiGenerationProgress>({
        sourceTurnIndex: null,
        targetTurnIndex: null,
        status: 'idle',
        stage: null,
        phase: null,
        stageLabel: null,
        attempt: null,
        maxAttempts: null,
        inventoryNames: [],
        error: null,
        updatedAt: null
    });
    
    const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, content: '', isLogicBreak: false });
    const [devLogs, setDevLogs] = useState<string[]>([]);
    const [isDevConsoleOpen, setIsDevConsoleOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [restartPromptContext, setRestartPromptContext] = useState<RestartPromptContext>(null);

    const gameStateRef = useRef<GameState>(createInitialGameState());
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    const aiAdapterRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const prologueRequestedRef = useRef(false);
    const remoteRoundBlueprintRef = useRef<AiRoundBlueprint | null>(null);
    const remoteRoundPackageRef = useRef<AiRoundPackage | null>(null);
    const remoteRoundDraftRef = useRef<RemoteRoundDraft | null>(null);
    const remoteRoundPrefetchRef = useRef<RemoteRoundPrefetchState | null>(null);
    const compiledAiRoundPackagesRef = useRef<Map<number, AiRoundPackage>>(new Map());
    const compiledAiCaseIdRef = useRef<string | null>(null);
    const compiledAiCaseFilenameRef = useRef<string | null>(null);
    const pendingLoadActionRef = useRef<PendingLoadAction | null>(null);
    const currentTurnCheckpointRef = useRef<RuntimeCheckpointState | null>(null);
    const caseStartCheckpointRef = useRef<RuntimeCheckpointState | null>(null);

    useEffect(() => {
        if (pendingLogs.length > 0) {
            const nextLog = pendingLogs[0];
            setPendingLogs(prev => prev.slice(1));
            setLogs(prev => [...prev, { ...nextLog, isTyping: false }]);
            if (isCurrentlyTyping) {
                setIsCurrentlyTyping(false);
            }
        }
    }, [pendingLogs, isCurrentlyTyping]);

    useEffect(() => {
        remoteRoundBlueprintRef.current = remoteRoundBlueprint;
    }, [remoteRoundBlueprint]);

    useEffect(() => {
        remoteRoundPackageRef.current = remoteRoundPackage;
    }, [remoteRoundPackage]);

    const updateAiGenerationProgress = (patch: Partial<DebugAiGenerationProgress>) => {
        setDebugAiGenerationProgress(prev => ({
            ...prev,
            ...patch,
            updatedAt: Date.now()
        }));
    };

    const clearCompiledAiCaseDraft = () => {
        compiledAiRoundPackagesRef.current = new Map();
        compiledAiCaseIdRef.current = null;
        compiledAiCaseFilenameRef.current = null;
        setCompiledAiCaseDraft(null);
        setCompiledAiCaseSaveState('idle');
        setCompiledAiCaseSaveMessage(null);
    };

    const buildRuntimeCheckpoint = (turnIndex: number): RuntimeCheckpointState => ({
        turnIndex,
        gameState: clonePlain(gameStateRef.current),
        introData: introData ? clonePlain(introData) : null,
        runtimeRoundIntro: runtimeRoundIntro ? clonePlain(runtimeRoundIntro) : null,
        evidenceMap: cloneEvidenceMap(evidenceMap),
        usedEvidenceSet: new Set(usedEvidenceSet),
        resolvedStatementsMap: cloneResolvedStatementMap(resolvedStatementsMap),
        inspectedWeakPointIdsByTurn: cloneTurnWeakPointMap(inspectedWeakPointIdsByTurn),
        resolvedWeakPointIdsByTurn: cloneTurnWeakPointMap(resolvedWeakPointIdsByTurn),
        logs: clonePlain(logs),
        activeEnemyLog: activeEnemyLog ? clonePlain(activeEnemyLog) : null,
        remoteRoundBlueprint: remoteRoundBlueprint ? clonePlain(remoteRoundBlueprint) : null,
        remoteRoundPackage: remoteRoundPackage ? clonePlain(remoteRoundPackage) : null
    });

    const restoreRuntimeCheckpoint = (checkpoint: RuntimeCheckpointState) => {
        setScreen('game');
        setRestartPromptContext(null);
        setLoadDiagnostics(null);
        setTooltip(prev => ({ ...prev, visible: false }));
        setPendingLogs([]);
        setIsCurrentlyTyping(false);
        setFocusDialogue(null);
        setEvidenceReward(null);
        setGameResult(null);
        setIntroData(checkpoint.introData ? clonePlain(checkpoint.introData) : null);
        setRuntimeRoundIntro(checkpoint.runtimeRoundIntro ? clonePlain(checkpoint.runtimeRoundIntro) : null);
        setLogs(clonePlain(checkpoint.logs));
        setActiveEnemyLog(checkpoint.activeEnemyLog ? clonePlain(checkpoint.activeEnemyLog) : null);
        setEvidenceMap(cloneEvidenceMap(checkpoint.evidenceMap));
        setUsedEvidenceSet(new Set(checkpoint.usedEvidenceSet));
        setResolvedStatementsMap(cloneResolvedStatementMap(checkpoint.resolvedStatementsMap));
        setInspectedWeakPointIdsByTurn(cloneTurnWeakPointMap(checkpoint.inspectedWeakPointIdsByTurn));
        setResolvedWeakPointIdsByTurn(cloneTurnWeakPointMap(checkpoint.resolvedWeakPointIdsByTurn));
        setRemoteRoundBlueprint(checkpoint.remoteRoundBlueprint ? clonePlain(checkpoint.remoteRoundBlueprint) : null);
        setRemoteRoundPackage(checkpoint.remoteRoundPackage ? clonePlain(checkpoint.remoteRoundPackage) : null);
        setGameState({
            ...clonePlain(checkpoint.gameState),
            isOver: false,
            phase: checkpoint.gameState.phase === 'game_over'
                ? 'playing'
                : checkpoint.gameState.phase
        });
    };

    const rebuildCompiledAiCaseDraft = () => {
        const packages = Array.from(compiledAiRoundPackagesRef.current.values());
        if (packages.length === 0) {
            setCompiledAiCaseDraft(null);
            return;
        }

        const openingPackage = [...packages].sort((left, right) => left.blueprint.turnIndex - right.blueprint.turnIndex)[0];
        if (!compiledAiCaseIdRef.current) {
            const seedToken = buildStableCaseToken(openingPackage.seed.suspectName || 'ai-case', `ai-${Date.now()}`);
            compiledAiCaseIdRef.current = `ai-${seedToken}`;
            compiledAiCaseFilenameRef.current = ensureCaseFilename(`${compiledAiCaseIdRef.current}`, compiledAiCaseIdRef.current);
        }

        try {
            const nextDraft = buildCompiledAiCaseDraft(packages, {
                caseId: compiledAiCaseIdRef.current!,
                filename: compiledAiCaseFilenameRef.current || ensureCaseFilename(compiledAiCaseIdRef.current!, compiledAiCaseIdRef.current!),
                lang,
                castSelection: gameStateRef.current.castSelection,
                heroEmoji: gameStateRef.current.fixedHeroEmoji,
                enemyEmoji: gameStateRef.current.fixedEnemyEmoji
            });
            setCompiledAiCaseDraft(nextDraft);
            if (nextDraft) {
                logDev('AI-CASE-DRAFT', {
                    caseId: nextDraft.caseId,
                    filename: nextDraft.filename,
                    generatedTurnCount: nextDraft.generatedTurnCount
                });
            }
        } catch (error: any) {
            setCompiledAiCaseDraft(null);
            logDev('AI-CASE-DRAFT', {
                error: error?.message || 'Failed to compile AI case draft.'
            });
        }
    };

    const checkpointTurnIndex =
        activeEnemyLog?.roundIndex
        || ((gameState.phase === 'battle_intro' || gameState.phase === 'playing')
            ? (remoteRoundPackage?.blueprint.turnIndex || remoteRoundBlueprint?.turnIndex || introData?.roundIndex)
            : introData?.roundIndex);

    useEffect(() => {
        if (screen !== 'game' || !introData) return;
        if (!['intro_narrative', 'battle_intro', 'playing'].includes(gameState.phase)) return;
        if (caseStartCheckpointRef.current) return;
        const turnIndex = introData.roundIndex || remoteRoundPackage?.blueprint.turnIndex || remoteRoundBlueprint?.turnIndex || 1;
        caseStartCheckpointRef.current = buildRuntimeCheckpoint(turnIndex);
        logDev('CHECKPOINT', {
            scope: 'case',
            turnIndex,
            action: 'capture'
        });
    }, [
        screen,
        introData,
        gameState.phase,
        remoteRoundBlueprint,
        remoteRoundPackage,
        evidenceMap,
        usedEvidenceSet,
        resolvedStatementsMap,
        inspectedWeakPointIdsByTurn,
        resolvedWeakPointIdsByTurn,
        logs,
        activeEnemyLog
    ]);

    useEffect(() => {
        if (screen !== 'game') return;
        if (gameState.phase !== 'playing' || gameState.isOver) return;
        if (!checkpointTurnIndex || !activeEnemyLog) return;
        if (focusDialogue || evidenceReward) return;
        if (currentTurnCheckpointRef.current?.turnIndex === checkpointTurnIndex) return;
        currentTurnCheckpointRef.current = buildRuntimeCheckpoint(checkpointTurnIndex);
        logDev('CHECKPOINT', {
            scope: 'turn',
            turnIndex: checkpointTurnIndex,
            action: 'capture'
        });
    }, [
        screen,
        gameState.phase,
        gameState.isOver,
        checkpointTurnIndex,
        activeEnemyLog,
        focusDialogue,
        evidenceReward,
        evidenceMap,
        usedEvidenceSet,
        resolvedStatementsMap,
        inspectedWeakPointIdsByTurn,
        resolvedWeakPointIdsByTurn,
        logs,
        remoteRoundBlueprint,
        remoteRoundPackage
    ]);

    const syncCompiledAiRoundPackage = (roundPackage: AiRoundPackage) => {
        compiledAiRoundPackagesRef.current.set(roundPackage.blueprint.turnIndex, roundPackage);
        setCompiledAiCaseSaveState('idle');
        setCompiledAiCaseSaveMessage(null);
        rebuildCompiledAiCaseDraft();
    };

    const getCompiledAiTurn = (turnIndex?: number | null) => {
        if (!compiledAiCaseDraft || !turnIndex || turnIndex <= 0) {
            return null;
        }
        return compiledAiCaseDraft.caseData.turns[turnIndex - 1] || null;
    };

    const getCompiledAiTurnStartingEvidences = (turnIndex?: number | null): EvidenceEntry[] => {
        const turn = getCompiledAiTurn(turnIndex);
        if (!compiledAiCaseDraft || !turn || !turn.startingEvidenceIds || turn.startingEvidenceIds.length === 0) {
            return [];
        }

        const evidenceById = new Map(
            compiledAiCaseDraft.caseData.evidences.map(evidence => [evidence.id, evidence])
        );

        return turn.startingEvidenceIds.flatMap(evidenceId => {
            const evidence = evidenceById.get(evidenceId);
            if (!evidence) {
                return [];
            }

            const name = resolveTextForLang(evidence.name, lang);
            const detail = resolveTextForLang(evidence.detail, lang);
            if (!name.trim() || !detail.trim()) {
                return [];
            }

            return [{ name, detail }];
        });
    };

    const buildEnemyLogFromCompiledTurn = (
        turnIndex: number | undefined | null,
        avatarEmoji: string,
        runtimeBlueprint?: AiRoundBlueprint | null
    ): LogEntry | null => {
        const turn = getCompiledAiTurn(turnIndex);
        if (!turn || !turnIndex) {
            return null;
        }

        const visibleDialogueSequence: DialogueCueLine[] = (
            runtimeBlueprint?.turnIndex === turnIndex
                ? runtimeBlueprint.dialogueSequence
                : turn.loopDialogues
                    .filter(card => !card.hidden)
                    .map(card => ({
                        text: resolveLocalizedText(card.text, lang),
                        speaker: 'enemy',
                        enemyPortraitState: card.portraitState,
                        enemyPortraitMotion: card.portraitMotion
                    }))
        )
            .filter(line => line.text.trim().length > 0);

        const fallbackText = visibleDialogueSequence
            .map(line => line.text)
            .join('\n')
            .trim();
        const interferenceLines = (turn.interferenceLines || [])
            .map(line => resolveLocalizedText(line, lang))
            .filter(Boolean);

        return {
            id: `compiled-ai-round-${turnIndex}-${Date.now()}`,
            type: 'chat',
            role: 'enemy',
            hiddenInCaseLog: true,
            text: buildEnemyDialogueFromSequence(visibleDialogueSequence, fallbackText),
            avatarEmoji,
            backgroundSlot: runtimeBlueprint?.backgroundSlot || turn.sceneBackgroundSlot,
            enemyPortraitState: runtimeBlueprint?.enemyPortraitState || turn.enemyPortraitState,
            enemyPortraitMotion: runtimeBlueprint?.enemyPortraitMotion || turn.enemyPortraitMotion,
            screenFilter: runtimeBlueprint?.screenFilter || turn.screenFilter,
            screenImpulse: runtimeBlueprint?.screenImpulse || turn.screenImpulse,
            transition: runtimeBlueprint?.transition || turn.transition,
            dialogueSequence: visibleDialogueSequence,
            roundIndex: turnIndex,
            interferenceLines: interferenceLines.length > 0 ? interferenceLines : undefined
        };
    };

    const resolvePortraitPackLabel = (packId: string) => {
        if (!packId || packId === '__random__') {
            return 'RANDOM';
        }
        return portraitPacks.find(pack => pack.id === packId)?.label || packId;
    };

    const resolveBackgroundPackLabel = (packId: string) => {
        if (!packId) {
            return 'AUTO';
        }
        return backgroundPacks.find(pack => pack.id === packId)?.label || packId;
    };

    const buildLoadRows = (): SystemLoadRow[] => {
        if (!sessionDisplay) {
            return [];
        }

        const baseRows: SystemLoadRow[] = [
            { label: 'MODE', value: sessionDisplay.mode === 'local' ? 'LOCAL' : 'REMOTE AI' },
            { label: 'LANG', value: lang.toUpperCase() },
            { label: 'HERO PACK', value: resolvePortraitPackLabel(sessionDisplay.castSelection.heroPortraitPackId) },
            { label: 'ENEMY PACK', value: resolvePortraitPackLabel(sessionDisplay.castSelection.enemyPortraitPackId) },
            { label: 'BACKGROUND', value: resolveBackgroundPackLabel(sessionDisplay.castSelection.backgroundPackId) }
        ];

        if (sessionDisplay.mode === 'local') {
            return [
                { label: 'SCRIPT', value: sessionDisplay.caseFilename || sessionDisplay.caseLabel || 'UNKNOWN' },
                { label: 'SOURCE', value: (sessionDisplay.caseSource || 'builtin').toUpperCase() },
                ...baseRows
            ];
        }

        return [
            { label: 'PROVIDER', value: sessionDisplay.providerLabel },
            { label: 'MODEL', value: sessionDisplay.modelLabel },
            ...baseRows
        ];
    };

    const buildBootLines = () => {
        if (!sessionDisplay) {
            return undefined;
        }

        if (sessionDisplay.mode === 'local') {
            return [
                'LOCAL CASE CHANNEL // BOOT',
                `SCRIPT LOAD // ${sessionDisplay.caseFilename || sessionDisplay.caseLabel || 'UNKNOWN'}`,
                `SCRIPT SOURCE // ${(sessionDisplay.caseSource || 'builtin').toUpperCase()}`,
                `CAST HERO // ${resolvePortraitPackLabel(sessionDisplay.castSelection.heroPortraitPackId)}`,
                `CAST ENEMY // ${resolvePortraitPackLabel(sessionDisplay.castSelection.enemyPortraitPackId)}`,
                `SCENE PACK // ${resolveBackgroundPackLabel(sessionDisplay.castSelection.backgroundPackId)}`
            ];
        }

        return [
            'AI CHANNEL // BOOT',
            `MODEL LINK // ${sessionDisplay.modelLabel}`,
            `PROVIDER ROUTE // ${sessionDisplay.providerLabel}`,
            `CAST HERO // ${resolvePortraitPackLabel(sessionDisplay.castSelection.heroPortraitPackId)}`,
            `CAST ENEMY // ${resolvePortraitPackLabel(sessionDisplay.castSelection.enemyPortraitPackId)}`,
            `SCENE PACK // ${resolveBackgroundPackLabel(sessionDisplay.castSelection.backgroundPackId)}`
        ];
    };

    const getLoadTitle = (scope: 'boot' | 'runtime', localMode: boolean) =>
        localMode
            ? scope === 'boot'
                ? 'LOCAL CASE BOOT'
                : 'LOCAL CASE RESOLUTION'
            : scope === 'boot'
                ? 'AI CASE SYNTHESIS'
                : 'AI ROUND SYNTHESIS';

    const formatPrefetchFailureMessage = (error: string | null | undefined) => {
        if (!error) {
            return lang === 'zh'
                ? '下一轮后台生成失败。'
                : lang === 'ja'
                    ? '次ラウンドのバックグラウンド生成に失敗しました。'
                    : 'Background generation for the next round failed.';
        }

        if (error.includes('Round is not solvable')) {
            return lang === 'zh'
                ? '生成的下一轮剧本未通过本地可解性校验。'
                : lang === 'ja'
                    ? '生成された次ラウンド脚本がローカル可解性チェックを通過しませんでした。'
                    : 'The generated next-round script failed local solvability validation.';
        }

        return error;
    };

    const handleLogTypingComplete = (id: string) => {
        setLogs(prev => prev.map(log => log.id === id ? { ...log, isTyping: false } : log));
        setIsCurrentlyTyping(false);
    };

    const commitActiveEnemyLog = (nextEnemyLog: LogEntry | null) => {
        if (!nextEnemyLog?.text?.trim()) return;
        // Popup enemy testimony belongs to the live battle layer only.
        // CASE_LOG is reserved for narrative/system/history records such as AVG transcripts.
        setActiveEnemyLog({ ...nextEnemyLog, isTyping: false });
    };

    const buildIntroEnemyLog = (data: IntroDataState): LogEntry | null => {
        if (!data.suspectMsg.trim()) {
            return null;
        }

        return {
            id: 'sus-active-' + Date.now(),
            type: 'chat',
            text: data.suspectMsg,
            role: 'enemy',
            hiddenInCaseLog: true,
            isTyping: false,
            backgroundSlot: data.backgroundSlot,
            screenFilter: data.screenFilter as any,
            transition: data.transition as any,
            enemyPortraitState: data.enemyPortraitState as any,
            dialogueSequence: data.suspectDialogueSequence,
            roundIndex: data.roundIndex
        };
    };

    const createRuntimeRoundIntroRequest = (roundIndex: number | null | undefined): RoundIntroRequest | null => {
        if (!roundIndex || roundIndex <= 1) {
            return null;
        }

        return {
            token: `runtime-round-${roundIndex}-${Date.now()}`,
            roundIndex,
            mode: 'round'
        };
    };

    const openGameOver = (result: GameResultState) => {
        setRestartPromptContext(null);
        setGameResult(result);
        setFocusDialogue(null);
        setEvidenceReward(null);
        setRuntimeRoundIntro(null);
        setGameState(prev => ({
            ...prev,
            isOver: true,
            phase: 'game_over'
        }));
    };

    const flushFocusDialogueTranscript = (dialogue: FocusDialogueState) => {
        if (dialogue.transcriptLogs.length === 0) {
            return;
        }

        setLogs(prev => {
            const existingTranscriptGroups = new Set(
                prev
                    .map(entry => entry.transcriptGroupKey)
                    .filter((value): value is string => typeof value === 'string' && value.length > 0)
            );
            const nextTranscriptLogs = dialogue.transcriptLogs.filter(entry => {
                if (!entry.transcriptGroupKey) {
                    return true;
                }
                return !existingTranscriptGroups.has(entry.transcriptGroupKey);
            });

            return nextTranscriptLogs.length > 0
                ? [...prev, ...nextTranscriptLogs]
                : prev;
        });
    };

    const handleAdvanceFocusDialogue = () => {
        if (!focusDialogue) return;
        if (focusDialogue.index < focusDialogue.lines.length - 1) {
            setFocusDialogue(prev => prev ? ({ ...prev, index: prev.index + 1 }) : prev);
            return;
        }
        flushFocusDialogueTranscript(focusDialogue);
        if (focusDialogue.queuedEvidenceReward) {
            setEvidenceReward(focusDialogue.queuedEvidenceReward);
            setFocusDialogue(null);
            return;
        }
        if (focusDialogue.queuedRoundIntro) {
            setRuntimeRoundIntro(focusDialogue.queuedRoundIntro);
        }
        if (focusDialogue.queuedEnemyLog) {
            commitActiveEnemyLog(focusDialogue.queuedEnemyLog);
        }
        if (focusDialogue.endResult) {
            openGameOver(focusDialogue.endResult);
            return;
        }
        setFocusDialogue(null);
    };

    const handleContinueEvidenceReward = () => {
        if (!evidenceReward) return;
        const { queuedEnemyLog, queuedRoundIntro, endResult } = evidenceReward;
        setEvidenceReward(null);
        if (queuedRoundIntro) {
            setRuntimeRoundIntro(queuedRoundIntro);
        }
        if (queuedEnemyLog) {
            commitActiveEnemyLog(queuedEnemyLog);
        }
        if (endResult) {
            openGameOver(endResult);
        }
    };

    useEffect(() => {
        // The platform's injected GEMINI_API_KEY is a Vertex AI key, which returns 404 
        // when calling the public generativelanguage REST API. 
        // Therefore, we provide a comprehensive static list of current models on startup.
        setAvailableModels([
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-flash-latest',
            'gemini-pro-latest'
        ]);
    }, []);

    const refreshLocalCases = async (_preferredCaseId?: string) => {
        const [cases, workspaceInfo] = await Promise.all([
            getLocalCaseOptions(lang),
            getLocalCaseWorkspaceInfo()
        ]);
        setLocalCases(cases);
        setLocalWorkspaceInfo(workspaceInfo);
        setPortraitPacks(getPortraitPackOptions(lang));
        setBackgroundPacks(getBackgroundPackOptions(lang));
    };

    useEffect(() => {
        void refreshLocalCases();
    }, [lang]);

    useEffect(() => {
        const unlockSfx = () => primeSfxAudio();
        window.addEventListener('pointerdown', unlockSfx, { once: true });
        window.addEventListener('keydown', unlockSfx, { once: true });
        return () => {
            window.removeEventListener('pointerdown', unlockSfx);
            window.removeEventListener('keydown', unlockSfx);
        };
    }, []);

    const logDev = (type: string, content: any) => {
        const logString = `[${type}] ${new Date().toLocaleTimeString()} - ${typeof content === 'object' ? JSON.stringify(content, null, 2) : content}`;
        setDevLogs(prev => [logString, ...prev]);
    };

    const logRuntimeState = (type: string, extra: Record<string, unknown> = {}) => {
        logDev(type, {
            phase: gameStateRef.current.phase,
            heroHp: gameStateRef.current.heroHp,
            enemyHp: gameStateRef.current.enemyHp,
            suspectName: gameStateRef.current.suspectName,
            activeRound: remoteRoundPackageRef.current?.blueprint.turnIndex
                || remoteRoundBlueprintRef.current?.turnIndex
                || null,
            inventoryNames: Array.from(evidenceMap.keys()),
            usedEvidenceNames: Array.from(usedEvidenceSet.values()),
            resolvedStatements: Array.from(resolvedStatementsMap.keys()),
            ...extra
        });
    };

    const requestAiJsonWithRetries = async (
        buildPrompt: (attempt: number, previousFailure?: string) => string,
        validate?: (data: any) => { ok: true } | { ok: false; reason: string },
        maxAttempts = 3,
        diagnostics?: {
            scope: 'boot' | 'runtime';
            title: string;
            requestStage: string;
            validationStage: string;
            hidden?: boolean;
            stageKey?: AiGenerationStage;
            onStatus?: (status: {
                phase: AiGenerationPhase;
                stageKey: AiGenerationStage | null;
                stage: string;
                attempt: number;
                maxAttempts: number;
                error?: string | null;
            }) => void;
        },
        initialFailure?: string
    ) => {
        let lastFailure = initialFailure || '';

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            if (diagnostics) {
                if (!diagnostics.hidden) {
                    setLoadDiagnostics({
                        scope: diagnostics.scope,
                        title: diagnostics.title,
                        stage: diagnostics.requestStage,
                        status: 'working',
                        attempt,
                        maxAttempts,
                        error: null
                    });
                }
                diagnostics.onStatus?.({
                    phase: 'request',
                    stageKey: diagnostics.stageKey || null,
                    stage: diagnostics.requestStage,
                    attempt,
                    maxAttempts,
                    error: null
                });
                logDev('AI-STAGE', {
                    scope: diagnostics.scope,
                    title: diagnostics.title,
                    phase: 'request',
                    stage: diagnostics.requestStage,
                    attempt,
                    maxAttempts,
                    previousFailure: lastFailure || null
                });
            }

            const prompt = buildPrompt(attempt, lastFailure || undefined);
            logDev('REQUEST', prompt);
            const data = await aiAdapterRef.current.sendMessage(prompt);
            logDev('RESPONSE', data);

            if (!validate) {
                return data;
            }

            if (diagnostics) {
                if (!diagnostics.hidden) {
                    setLoadDiagnostics({
                        scope: diagnostics.scope,
                        title: diagnostics.title,
                        stage: diagnostics.validationStage,
                        status: 'working',
                        attempt,
                        maxAttempts,
                        error: null
                    });
                }
                diagnostics.onStatus?.({
                    phase: 'validate',
                    stageKey: diagnostics.stageKey || null,
                    stage: diagnostics.validationStage,
                    attempt,
                    maxAttempts,
                    error: null
                });
                logDev('AI-STAGE', {
                    scope: diagnostics.scope,
                    title: diagnostics.title,
                    phase: 'validate',
                    stage: diagnostics.validationStage,
                    attempt,
                    maxAttempts
                });
            }

            const verdict = validate(data);
            if (verdict.ok) {
                if (diagnostics) {
                    diagnostics.onStatus?.({
                        phase: 'accepted',
                        stageKey: diagnostics.stageKey || null,
                        stage: diagnostics.validationStage,
                        attempt,
                        maxAttempts,
                        error: null
                    });
                    logDev('AI-STAGE', {
                        scope: diagnostics.scope,
                        title: diagnostics.title,
                        phase: 'accepted',
                        stage: diagnostics.validationStage,
                        attempt
                    });
                }
                return data;
            }

            lastFailure = verdict.reason;
            if (diagnostics) {
                diagnostics.onStatus?.({
                    phase: 'validate',
                    stageKey: diagnostics.stageKey || null,
                    stage: diagnostics.validationStage,
                    attempt,
                    maxAttempts,
                    error: verdict.reason
                });
            }
            logDev('AI-VALIDATION', `Attempt ${attempt} rejected: ${verdict.reason}`);
        }

        throw new Error(lastFailure || 'AI response validation failed.');
    };

    const validateOpeningPayload = (data: any) => {
        const evidences = normalizeEvidenceEntries(data.evidences);
        if (evidences.length === 0) {
            return { ok: false as const, reason: 'Opening payload has no starting evidences.' };
        }

        const openingSeed = parseAiRoundSeedSegment(data);
        if (!openingSeed) {
            return { ok: false as const, reason: 'Opening payload is missing a valid round seed.' };
        }

        const roundBlueprint = parseAiRoundBlueprint(data);
        if (!roundBlueprint) {
            return { ok: false as const, reason: 'Opening payload is missing a valid round blueprint.' };
        }

        const progressionVerdict = validateAiRoundProgression(openingSeed, roundBlueprint);
        if (!progressionVerdict.ok) {
            return progressionVerdict;
        }

        const roundValidation = validateAiRoundBlueprint(roundBlueprint.weakPoints, evidences);
        if (!roundValidation.ok) {
            return { ok: false as const, reason: roundValidation.reason };
        }

        const languageVerdict = validatePayloadLanguage(data, lang);
        if (!languageVerdict.ok) {
            return languageVerdict;
        }

        if (!data.narrative || typeof data.narrative !== 'string' || !data.narrative.trim()) {
            return { ok: false as const, reason: 'Opening payload is missing narrative.' };
        }

        return { ok: true as const };
    };

    const generateRemoteRoundPackage = async (options: {
        opening: boolean;
        scope: 'boot' | 'runtime';
        silent?: boolean;
        turnIndex: number;
        inventory: EvidenceEntry[];
        exitContext?: AiRoundExitContext;
        suspectName?: string;
        onProgress?: (status: {
            phase: AiGenerationPhase;
            stageKey: AiGenerationStage | null;
            stage: string;
            attempt: number;
            maxAttempts: number;
            error?: string | null;
        }) => void;
    }): Promise<AiRoundPackage> => {
        const castSelection = gameStateRef.current.castSelection;
        const title = getLoadTitle(options.scope, false);
        const draftKey = buildRemoteRoundDraftKey(lang, castSelection, options);
        const existingDraft = remoteRoundDraftRef.current?.key === draftKey ? remoteRoundDraftRef.current : null;

        logDev('ROUND-DRAFT', {
            action: existingDraft ? 'resume' : 'start',
            scope: options.scope,
            turnIndex: options.turnIndex,
            failedStage: existingDraft?.failedStage || null,
            hasSeed: Boolean(existingDraft?.seed),
            hasBlueprint: Boolean(existingDraft?.blueprint)
        });

        const updateDraft = (patch: Partial<RemoteRoundDraft>) => {
            remoteRoundDraftRef.current = {
                key: draftKey,
                options: {
                    ...options,
                    inventory: options.inventory.map(entry => ({ ...entry }))
                },
                failedStage: patch.failedStage || existingDraft?.failedStage || 'seed',
                lastFailure: patch.lastFailure,
                seed: patch.seed,
                blueprint: patch.blueprint
            };
        };

        let seed = existingDraft?.seed;
        let blueprint = existingDraft?.blueprint;

        if (!seed) {
            updateDraft({
                failedStage: 'seed',
                lastFailure: existingDraft?.failedStage === 'seed' ? existingDraft.lastFailure : undefined,
                seed: undefined,
                blueprint: undefined
            });

            let seedResponse: any;
            try {
                seedResponse = await requestAiJsonWithRetries(
                    (attempt, previousFailure) => `${buildRemoteRoundSeedPrompt(
                        lang,
                        castSelection,
                        i18n[lang].systemPrompt,
                        {
                            opening: options.opening,
                            currentTurnIndex: options.turnIndex,
                            currentInventory: options.inventory,
                            exitContext: options.exitContext,
                            suspectName: options.suspectName
                        }
                    )}

[ATTEMPT] ${attempt}
${previousFailure ? `[PREVIOUS_FAILURE] ${previousFailure}` : ''}`,
                    data => validateAiRoundSeedSegment(
                        parseAiRoundSeedSegment(data),
                        lang,
                        {
                            requireNarrative: options.opening,
                            requireStartingEvidences: options.opening
                        }
                    ),
                    3,
                    {
                        scope: options.scope,
                        title,
                        requestStage: `Stage 1/3 // Generating round seed for turn ${options.turnIndex}...`,
                        validationStage: 'Stage 1/3 // Validating round seed...',
                        hidden: options.silent,
                        stageKey: 'seed',
                        onStatus: options.onProgress
                    },
                    existingDraft?.failedStage === 'seed' ? existingDraft.lastFailure : undefined
                );
            } catch (error: any) {
                updateDraft({
                    failedStage: 'seed',
                    lastFailure: error?.message || 'Round seed generation failed.',
                    seed: undefined,
                    blueprint: undefined
                });
                throw new Error(`Stage 1/3 round seed failed: ${error?.message || 'Unknown seed error.'}`);
            }

            seed = parseAiRoundSeedSegment(seedResponse);
            if (!seed) {
                updateDraft({
                    failedStage: 'seed',
                    lastFailure: 'Round seed segment was not parseable.',
                    seed: undefined,
                    blueprint: undefined
                });
                throw new Error('Stage 1/3 round seed failed: Round seed segment was not parseable.');
            }

            updateDraft({
                failedStage: 'core',
                lastFailure: undefined,
                seed,
                blueprint: undefined
            });
        }

        if (!blueprint) {
            updateDraft({
                failedStage: 'core',
                lastFailure: existingDraft?.failedStage === 'core' ? existingDraft.lastFailure : undefined,
                seed,
                blueprint: undefined
            });

            let testimonyResponse: any;
            try {
                testimonyResponse = await requestAiJsonWithRetries(
                    (attempt, previousFailure) => `${buildRemoteRoundCorePrompt(
                        lang,
                        i18n[lang].systemPrompt,
                        seed!,
                        castSelection,
                        [...options.inventory, ...seed!.startingEvidences],
                        options.exitContext
                    )}

[ATTEMPT] ${attempt}
${previousFailure ? `[PREVIOUS_FAILURE] ${previousFailure}` : ''}`,
                    data => {
                        const nextBlueprint = parseAiRoundBlueprint({
                            ...data,
                            turn_index: seed!.turnIndex,
                            is_final_round: seed!.isFinalRound,
                            system_msg: data.system_msg || seed!.systemMsg
                        });
                        if (!nextBlueprint) {
                            return { ok: false as const, reason: 'Round core is missing a valid testimony blueprint.' };
                        }

                        const progressionVerdict = validateAiRoundProgression(seed!, nextBlueprint, options.exitContext);
                        if (!progressionVerdict.ok) {
                            return progressionVerdict;
                        }

                        const verdict = validateAiRoundBlueprint(nextBlueprint.weakPoints, [...options.inventory, ...seed!.startingEvidences]);
                        if (!verdict.ok) {
                            return { ok: false as const, reason: verdict.reason };
                        }

                        return validatePayloadLanguage({
                            ...data,
                            turn_index: seed!.turnIndex,
                            system_msg: seed!.systemMsg
                        }, lang);
                    },
                    3,
                    {
                        scope: options.scope,
                        title,
                        requestStage: `Stage 2/3 // Generating testimony core for turn ${seed.turnIndex}...`,
                        validationStage: 'Stage 2/3 // Validating testimony core and weak-point map...',
                        hidden: options.silent,
                        stageKey: 'core',
                        onStatus: options.onProgress
                    },
                    existingDraft?.failedStage === 'core' ? existingDraft.lastFailure : undefined
                );
            } catch (error: any) {
                updateDraft({
                    failedStage: 'core',
                    lastFailure: error?.message || 'Round core generation failed.',
                    seed,
                    blueprint: undefined
                });
                throw new Error(`Stage 2/3 testimony core failed: ${error?.message || 'Unknown round-core error.'}`);
            }

            blueprint = parseAiRoundBlueprint({
                ...testimonyResponse,
                turn_index: seed.turnIndex,
                is_final_round: seed.isFinalRound,
                system_msg: (testimonyResponse as any).system_msg || seed.systemMsg
            });
            if (!blueprint) {
                updateDraft({
                    failedStage: 'core',
                    lastFailure: 'Round core could not be assembled into a blueprint.',
                    seed,
                    blueprint: undefined
                });
                throw new Error('Stage 2/3 testimony core failed: Round core could not be assembled into a blueprint.');
            }

            updateDraft({
                failedStage: 'outcomes',
                lastFailure: undefined,
                seed,
                blueprint
            });
        }

        let outcomeResponse: any;
        try {
            outcomeResponse = await requestAiJsonWithRetries(
                (attempt, previousFailure) => `${buildRemoteRoundOutcomePrompt(
                    lang,
                    i18n[lang].systemPrompt,
                    seed,
                    blueprint,
                    [...options.inventory, ...seed.startingEvidences],
                    options.exitContext
                )}

[ATTEMPT] ${attempt}
${previousFailure ? `[PREVIOUS_FAILURE] ${previousFailure}` : ''}`,
                data => validateAiRoundOutcomeBundle(parseAiRoundOutcomeBundle(data), blueprint!, lang),
                3,
                {
                    scope: options.scope,
                    title,
                    requestStage: `Stage 3/3 // Generating branch outcomes for turn ${seed.turnIndex}...`,
                    validationStage: 'Stage 3/3 // Validating branch outcomes and AVG blocks...',
                    hidden: options.silent,
                    stageKey: 'outcomes',
                    onStatus: options.onProgress
                },
                existingDraft?.failedStage === 'outcomes' ? existingDraft.lastFailure : undefined
            );
        } catch (error: any) {
            updateDraft({
                failedStage: 'outcomes',
                lastFailure: error?.message || 'Round outcome generation failed.',
                seed,
                blueprint
            });
            throw new Error(`Stage 3/3 branch outcomes failed: ${error?.message || 'Unknown outcome error.'}`);
        }

        const outcomes = parseAiRoundOutcomeBundle(outcomeResponse);
        if (!outcomes) {
            updateDraft({
                failedStage: 'outcomes',
                lastFailure: 'Round outcome segment could not be parsed.',
                seed,
                blueprint
            });
            throw new Error('Stage 3/3 branch outcomes failed: Round outcome segment could not be parsed.');
        }

        remoteRoundDraftRef.current = null;
        return assembleAiRoundPackage(seed, blueprint, outcomes);
    };

    const requestRemoteOpeningPayload = async () => {
        const roundPackage = await generateRemoteRoundPackage({
            opening: true,
            scope: 'boot',
            turnIndex: 1,
            inventory: [],
            exitContext: undefined,
            suspectName: gameStateRef.current.suspectName || undefined
        });

        setRemoteRoundPackage(roundPackage);
        setRemoteRoundBlueprint(roundPackage.blueprint);
        syncCompiledAiRoundPackage(roundPackage);

        return buildRoundPackagePayload(roundPackage);
    };

    const prefetchRemoteRoundPackage = (
        roundPackage: AiRoundPackage,
        inventory: EvidenceEntry[],
        options?: {
            force?: boolean;
        }
    ) => {
        if (isLocalMode || !aiAdapterRef.current || roundPackage.blueprint.isFinalRound) {
            return;
        }

        const nextOptions = buildNextRoundGenerationOptions(roundPackage, inventory, {
            scope: 'runtime',
            silent: true
        });
        const prefetchKey = buildRemoteRoundDraftKey(lang, gameStateRef.current.castSelection, nextOptions);
        const existingPrefetch = remoteRoundPrefetchRef.current;

        if (
            existingPrefetch
            && existingPrefetch.sourceTurnIndex === roundPackage.blueprint.turnIndex
            && existingPrefetch.targetTurnIndex === nextOptions.turnIndex
            && !options?.force
        ) {
            return;
        }

        logDev('ROUND-PREFETCH', {
            action: options?.force ? 'retry' : 'start',
            sourceTurnIndex: roundPackage.blueprint.turnIndex,
            targetTurnIndex: nextOptions.turnIndex,
            inventoryNames: inventory.map(entry => entry.name)
        });

        updateAiGenerationProgress({
            sourceTurnIndex: roundPackage.blueprint.turnIndex,
            targetTurnIndex: nextOptions.turnIndex,
            status: 'working',
            stage: 'seed',
            phase: 'request',
            stageLabel: `1/3 Seed`,
            attempt: 1,
            maxAttempts: 3,
            inventoryNames: inventory.map(entry => entry.name),
            error: null
        });

        const prefetchPromise = generateRemoteRoundPackage({
            ...nextOptions,
            onProgress: status => {
                updateAiGenerationProgress({
                    sourceTurnIndex: roundPackage.blueprint.turnIndex,
                    targetTurnIndex: nextOptions.turnIndex,
                    status: 'working',
                    stage: status.stageKey,
                    phase: status.phase,
                    stageLabel: status.stage,
                    attempt: status.attempt,
                    maxAttempts: status.maxAttempts,
                    inventoryNames: inventory.map(entry => entry.name),
                    error: status.error || null
                });
            }
        })
            .then(nextPackage => {
                syncCompiledAiRoundPackage(nextPackage);
                if (remoteRoundPrefetchRef.current?.key === prefetchKey) {
                    remoteRoundPrefetchRef.current = {
                        key: prefetchKey,
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: nextOptions.turnIndex,
                        inventory,
                        exitContext: nextOptions.exitContext!,
                        package: nextPackage
                    };
                    logDev('ROUND-PREFETCH', {
                        action: 'ready',
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: nextPackage.blueprint.turnIndex
                    });
                    updateAiGenerationProgress({
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: nextPackage.blueprint.turnIndex,
                        status: 'ready',
                        stage: 'outcomes',
                        phase: 'accepted',
                        stageLabel: 'Ready',
                        attempt: 3,
                        maxAttempts: 3,
                        inventoryNames: inventory.map(entry => entry.name),
                        error: null
                    });
                }
                return nextPackage;
            })
            .catch((error: any) => {
                if (remoteRoundPrefetchRef.current?.key === prefetchKey) {
                    remoteRoundPrefetchRef.current = {
                        key: prefetchKey,
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: nextOptions.turnIndex,
                        inventory,
                        exitContext: nextOptions.exitContext!,
                        error: error?.message || 'Prefetch failed.'
                    };
                    logDev('ROUND-PREFETCH', {
                        action: 'failed',
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: nextOptions.turnIndex,
                        error: error?.message || 'Prefetch failed.'
                    });
                    updateAiGenerationProgress({
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: nextOptions.turnIndex,
                        status: 'failed',
                        stage: null,
                        phase: null,
                        stageLabel: 'Failed',
                        attempt: null,
                        maxAttempts: 3,
                        inventoryNames: inventory.map(entry => entry.name),
                        error: error?.message || 'Prefetch failed.'
                    });
                }
                return Promise.reject(error);
            });

        remoteRoundPrefetchRef.current = {
            key: prefetchKey,
            sourceTurnIndex: roundPackage.blueprint.turnIndex,
            targetTurnIndex: nextOptions.turnIndex,
            inventory,
            exitContext: nextOptions.exitContext!,
            promise: prefetchPromise
        };
    };

    const resolveNextRoundPackage = async (
        roundPackage: AiRoundPackage,
        inventory: EvidenceEntry[]
    ) => {
        const expectedTurnIndex = roundPackage.blueprint.turnIndex + 1;
        const prefetched = remoteRoundPrefetchRef.current;
        if (prefetched && prefetched.targetTurnIndex === expectedTurnIndex) {
            try {
                if (prefetched.package) {
                    logDev('ROUND-PREFETCH', {
                        action: 'consume',
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: prefetched.package.blueprint.turnIndex,
                        mode: 'cached-fast'
                    });
                    updateAiGenerationProgress({
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: prefetched.package.blueprint.turnIndex,
                        status: 'consumed',
                        stage: 'outcomes',
                        phase: 'accepted',
                        stageLabel: 'Consumed',
                        inventoryNames: inventory.map(entry => entry.name),
                        error: null
                    });
                    remoteRoundPrefetchRef.current = null;
                    return prefetched.package;
                }

                const candidate = prefetched.promise ? await prefetched.promise : null;
                if (candidate) {
                    const verdict = validateAiRoundBlueprint(
                        candidate.blueprint.weakPoints,
                        [...inventory, ...candidate.seed.startingEvidences]
                    );
                    if (verdict.ok) {
                        logDev('ROUND-PREFETCH', {
                            action: 'consume',
                            sourceTurnIndex: roundPackage.blueprint.turnIndex,
                            targetTurnIndex: candidate.blueprint.turnIndex,
                            mode: prefetched.package ? 'cached' : 'awaited'
                        });
                        updateAiGenerationProgress({
                            sourceTurnIndex: roundPackage.blueprint.turnIndex,
                            targetTurnIndex: candidate.blueprint.turnIndex,
                            status: 'consumed',
                            stage: 'outcomes',
                            phase: 'accepted',
                            stageLabel: 'Consumed',
                            inventoryNames: inventory.map(entry => entry.name),
                            error: null
                        });
                        remoteRoundPrefetchRef.current = null;
                        return candidate;
                    }

                    logDev('ROUND-PREFETCH', {
                        action: 'discard',
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: candidate.blueprint.turnIndex,
                        reason: verdict.reason
                    });
                    updateAiGenerationProgress({
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: candidate.blueprint.turnIndex,
                        status: 'discarded',
                        stage: null,
                        phase: null,
                        stageLabel: 'Discarded',
                        inventoryNames: inventory.map(entry => entry.name),
                        error: verdict.reason
                    });
                }
            } catch (error: any) {
                logDev('ROUND-PREFETCH', {
                    action: 'fallback',
                    sourceTurnIndex: roundPackage.blueprint.turnIndex,
                    targetTurnIndex: expectedTurnIndex,
                    error: error?.message || 'Prefetch failed.'
                });
                updateAiGenerationProgress({
                    sourceTurnIndex: roundPackage.blueprint.turnIndex,
                    targetTurnIndex: expectedTurnIndex,
                    status: 'failed',
                    stage: null,
                    phase: null,
                    stageLabel: 'Fallback',
                    inventoryNames: inventory.map(entry => entry.name),
                    error: error?.message || 'Prefetch failed.'
                });
            }
        }

        return generateRemoteRoundPackage(
            {
                ...buildNextRoundGenerationOptions(roundPackage, inventory, {
                scope: 'runtime'
                }),
                onProgress: status => {
                    updateAiGenerationProgress({
                        sourceTurnIndex: roundPackage.blueprint.turnIndex,
                        targetTurnIndex: expectedTurnIndex,
                        status: 'working',
                        stage: status.stageKey,
                        phase: status.phase,
                        stageLabel: status.stage,
                        attempt: status.attempt,
                        maxAttempts: status.maxAttempts,
                        inventoryNames: inventory.map(entry => entry.name),
                        error: status.error || null
                    });
                }
            }
        ).then(nextPackage => {
            syncCompiledAiRoundPackage(nextPackage);
            updateAiGenerationProgress({
                sourceTurnIndex: roundPackage.blueprint.turnIndex,
                targetTurnIndex: nextPackage.blueprint.turnIndex,
                status: 'ready',
                stage: 'outcomes',
                phase: 'accepted',
                stageLabel: 'Ready',
                inventoryNames: inventory.map(entry => entry.name),
                error: null
            });
            return nextPackage;
        });
    };

    const appendRevealedWeakPoints = (blueprint: AiRoundBlueprint, revealedIds: string[], cue?: AiRoundOutcomeSegment) => {
        if (revealedIds.length === 0) {
            return blueprint;
        }

        const nextSequence = [...blueprint.dialogueSequence];
        const existingIds = new Set(
            nextSequence.flatMap(line => {
                const match = line.text.match(/\[\[([A-Za-z0-9_-]+)::/g);
                return match ? match.map(item => item.replace('[[', '').replace('::', '')) : [];
            })
        );

        revealedIds.forEach(id => {
            if (existingIds.has(id)) {
                return;
            }
            const weakPoint = blueprint.weakPoints.find(entry => entry.id === id);
            if (!weakPoint) {
                return;
            }
            nextSequence.push({
                speaker: 'enemy',
                text: `[[${weakPoint.id}::${weakPoint.statement}]]`,
                enemyPortraitState: cue?.enemyPortraitState || blueprint.enemyPortraitState,
                enemyPortraitMotion: cue?.enemyPortraitMotion || blueprint.enemyPortraitMotion
            });
        });

        return {
            ...blueprint,
            dialogueSequence: nextSequence,
            enemyDialogue: buildEnemyDialogueFromSequence(nextSequence, blueprint.enemyDialogue)
        };
    };

    const resolveWeakPointFromPackage = (
        roundPackage: AiRoundPackage,
        statement: string,
        weakPointId?: string
    ) => {
        if (weakPointId) {
            const byId = roundPackage.blueprint.weakPoints.find(item => item.id === weakPointId);
            if (byId) {
                return byId;
            }
        }

        const normalizedStatement = normalizeText(statement);
        return roundPackage.blueprint.weakPoints.find(item => normalizeText(item.statement) === normalizedStatement);
    };

    const buildInventoryAfterAction = (
        currentInventory: Map<string, string>,
        usedEvidenceName: string | undefined,
        consumeEvidence: boolean,
        grantedEvidences: EvidenceEntry[]
    ) => {
        const nextInventory = new Map(currentInventory);
        if (usedEvidenceName && consumeEvidence) {
            for (const key of Array.from(nextInventory.keys())) {
                if (key.includes(usedEvidenceName) || usedEvidenceName.includes(key)) {
                    nextInventory.delete(key);
                }
            }
        }

        grantedEvidences.forEach(entry => {
            if (!nextInventory.has(entry.name)) {
                nextInventory.set(entry.name, entry.detail);
            }
        });

        return Array.from(nextInventory.entries()).map(([name, detail]) => ({ name, detail }));
    };

    const mergeEvidenceEntriesIntoMap = (
        currentMap: Map<string, string>,
        entries: EvidenceEntry[]
    ) => {
        const nextMap = new Map(currentMap);
        entries.forEach(entry => {
            if (!nextMap.has(entry.name)) {
                nextMap.set(entry.name, entry.detail);
            }
        });
        return nextMap;
    };

    const findMatchingEvidenceEntry = (
        currentMap: Map<string, string>,
        evidenceName: string
    ) => {
        for (const [name, detail] of Array.from(currentMap.entries())) {
            if (name.includes(evidenceName) || evidenceName.includes(name)) {
                return { name, detail };
            }
        }

        return null;
    };

    const mapEvidenceMapToEntries = (currentMap: Map<string, string>): EvidenceEntry[] =>
        Array.from(currentMap.entries()).map(([name, detail]) => ({ name, detail }));

    const buildNextRoundGenerationOptions = (
        roundPackage: AiRoundPackage,
        inventory: EvidenceEntry[],
        options?: {
            scope?: 'boot' | 'runtime';
            silent?: boolean;
        }
    ) => ({
        opening: false,
        scope: options?.scope || 'runtime',
        silent: options?.silent,
        turnIndex: roundPackage.blueprint.turnIndex + 1,
        inventory,
        exitContext: buildAiRoundExitContext(roundPackage, inventory),
        suspectName: resolveRuntimeSuspectName({
            explicit: gameStateRef.current.suspectName,
            fallback: roundPackage.seed.suspectName
        }) || undefined
    });

    const buildDataFromRoundOutcome = (
        roundPackage: AiRoundPackage,
        blueprint: AiRoundBlueprint,
        outcome: AiRoundOutcomeSegment,
        options: {
            weakPoint?: AiWeakPointBlueprint;
            usedEvidenceName?: string;
            grantedEvidences?: EvidenceEntry[];
            cleared?: boolean;
            clearOutcome?: AiRoundOutcomeSegment;
            nextRoundPackage?: AiRoundPackage | null;
            strictEnemyDamage?: number;
        }
    ) => {
        const clearOutcome = options.clearOutcome;
        const isResolvedHit = Boolean(
            options.weakPoint && (options.weakPoint.kind === 'real' || options.weakPoint.kind === 'hidden')
        );
        const isInspectResolution = options.weakPoint?.kind === 'inspect';
        const effectiveAttackType = isResolvedHit
            ? 'strict'
            : isInspectResolution
                ? 'query'
                : outcome.attackType;
        const effectiveHeroDmgTaken = isResolvedHit || isInspectResolution
            ? 0
            : outcome.heroDmgTaken;
        const effectiveEnemyDmgTaken = isResolvedHit
            ? Math.max(1, options.strictEnemyDamage ?? outcome.enemyDmgTaken ?? 0)
            : isInspectResolution
                ? 0
                : outcome.enemyDmgTaken;
        const mergedAvgSequence = [
            ...outcome.avgSequence,
            ...(clearOutcome?.avgSequence || [])
        ];

        if (
            isResolvedHit
            && (outcome.attackType !== 'strict' || outcome.enemyDmgTaken <= 0 || outcome.heroDmgTaken !== 0)
        ) {
            logDev('OUTCOME-NORMALIZE', {
                weakPointId: options.weakPoint?.id,
                originalAttackType: outcome.attackType,
                originalHeroDamage: outcome.heroDmgTaken,
                originalEnemyDamage: outcome.enemyDmgTaken,
                effectiveAttackType,
                effectiveHeroDamage: effectiveHeroDmgTaken,
                effectiveEnemyDamage: effectiveEnemyDmgTaken
            });
        }

        return {
            turn_index: blueprint.turnIndex,
            is_final_round: blueprint.isFinalRound,
            system_msg: blueprint.systemMsg,
            enemy_dialogue: clearOutcome?.enemyDialogue || outcome.enemyDialogue || blueprint.enemyDialogue,
            dialogue_sequence: blueprint.dialogueSequence.map(line => ({
                speaker: line.speaker || 'enemy',
                text: line.text,
                portrait_state: line.enemyPortraitState,
                portrait_motion: line.enemyPortraitMotion
            })),
            weak_point_blueprint: blueprint.weakPoints.map(item => ({
                id: item.id,
                kind: item.kind,
                statement: item.statement,
                expected_evidence_name: item.expectedEvidenceName,
                consume_evidence_on_use: item.consumeEvidenceOnUse,
                grants_evidences: item.grantsEvidences,
                reveals_weak_point_ids: item.revealsWeakPointIds
            })),
            attack_type: effectiveAttackType,
            hero_dmg_taken: effectiveHeroDmgTaken,
            enemy_dmg_taken: effectiveEnemyDmgTaken,
            narrative: [outcome.narrative, clearOutcome?.narrative].filter(Boolean).join('\n\n'),
            avg_sequence: mergedAvgSequence.map(line => ({
                speaker: line.speaker,
                text: line.text,
                portrait_state: line.portraitState,
                portrait_motion: line.portraitMotion,
                background_slot: line.backgroundSlot,
                screen_filter: line.screenFilter,
                screen_impulse: line.screenImpulse,
                transition: line.transition
            })),
            granted_evidences: options.grantedEvidences || [],
            resolved_weak_point_id: options.weakPoint?.id,
            resolved_statement: options.weakPoint?.statement,
            logic_explanation: outcome.logicExplanation,
            used_evidence: options.usedEvidenceName,
            removed_evidence: options.usedEvidenceName && options.weakPoint?.consumeEvidenceOnUse !== false
                ? options.usedEvidenceName
                : undefined,
            round_status: options.cleared ? 'cleared' : 'ongoing',
            round_cleared: Boolean(options.cleared),
            enemy_surrendered: Boolean(options.cleared && blueprint.isFinalRound),
            case_truth: options.cleared && blueprint.isFinalRound ? (clearOutcome?.narrative || outcome.narrative) : undefined,
            runtime_damage_mode: isResolvedHit ? 'budgeted' : 'legacy',
            background_slot: clearOutcome?.backgroundSlot || outcome.backgroundSlot || blueprint.backgroundSlot,
            screen_filter: clearOutcome?.screenFilter || outcome.screenFilter || blueprint.screenFilter,
            screen_impulse: clearOutcome?.screenImpulse || outcome.screenImpulse || blueprint.screenImpulse,
            transition: clearOutcome?.transition || outcome.transition || blueprint.transition,
            enemy_portrait_state: clearOutcome?.enemyPortraitState || outcome.enemyPortraitState || blueprint.enemyPortraitState,
            enemy_portrait_motion: clearOutcome?.enemyPortraitMotion || outcome.enemyPortraitMotion || blueprint.enemyPortraitMotion,
            next_round_package: options.nextRoundPackage ? buildRoundPackagePayload(options.nextRoundPackage) : undefined
        };
    };

    const resolveRemoteRoundAction = async (
        roundPackage: AiRoundPackage,
        text: string
    ) => {
        const inspectMatch = text.match(/\[INSPECT_STATEMENT:\s*"((?:\\"|[^"])*)"\s*\](?:\s*\[TARGET_WEAK_POINT_ID:\s*"((?:\\"|[^"])*)"\s*\])?/i);
        if (inspectMatch) {
            const statement = inspectMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const weakPointId = inspectMatch[2]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\').trim() || undefined;
            const weakPoint = resolveWeakPointFromPackage(roundPackage, statement, weakPointId);
            const turnIndex = roundPackage.blueprint.turnIndex;
            const inspectedIdsForTurn = new Set(inspectedWeakPointIdsByTurn.get(turnIndex) ?? []);

            logRuntimeState('ACTION-RESOLVE', {
                actionType: 'inspect',
                statement,
                requestedWeakPointId: weakPointId || null,
                matchedWeakPointId: weakPoint?.id || null,
                matchedWeakPointKind: weakPoint?.kind || null
            });

            if (weakPoint && weakPoint.kind === 'inspect') {
                const outcome = roundPackage.outcomes.inspectOutcomes[weakPoint.id];
                if (!outcome) {
                    throw new Error(`Missing cached inspect outcome for "${weakPoint.id}".`);
                }

                if (inspectedIdsForTurn.has(weakPoint.id)) {
                    const alreadyInspectedOutcome: AiRoundOutcomeSegment = {
                        weakPointId: weakPoint.id,
                        narrative: buildAlreadyInspectedNarrative(lang),
                        enemyDialogue: roundPackage.blueprint.enemyDialogue,
                        avgSequence: [],
                        heroDmgTaken: 0,
                        enemyDmgTaken: 0,
                        attackType: 'query',
                        backgroundSlot: roundPackage.blueprint.backgroundSlot,
                        screenFilter: roundPackage.blueprint.screenFilter,
                        screenImpulse: roundPackage.blueprint.screenImpulse,
                        transition: roundPackage.blueprint.transition,
                        enemyPortraitState: roundPackage.blueprint.enemyPortraitState,
                        enemyPortraitMotion: roundPackage.blueprint.enemyPortraitMotion
                    };

                    return buildDataFromRoundOutcome(roundPackage, roundPackage.blueprint, alreadyInspectedOutcome, {
                        weakPoint,
                        grantedEvidences: []
                    });
                }

                setInspectedWeakPointIdsByTurn(prev =>
                    updateTurnWeakPointSet(prev, roundPackage.blueprint.turnIndex, weakPoint.id)
                );
                const nextBlueprint = appendRevealedWeakPoints(roundPackage.blueprint, weakPoint.revealsWeakPointIds, outcome);
                const nextPackage: AiRoundPackage = {
                    ...roundPackage,
                    blueprint: nextBlueprint
                };
                setRemoteRoundPackage(nextPackage);
                setRemoteRoundBlueprint(nextBlueprint);

                return buildDataFromRoundOutcome(roundPackage, nextBlueprint, outcome, {
                    weakPoint,
                    grantedEvidences: weakPoint.grantsEvidences
                });
            }

            return buildDataFromRoundOutcome(roundPackage, roundPackage.blueprint, roundPackage.outcomes.wrongInspectOutcome, {});
        }

        const evidenceAction = parseEvidenceAction(text);
        if (!evidenceAction) {
            throw new Error('Unable to resolve remote action from current round package.');
        }

        const weakPoint = resolveWeakPointFromPackage(roundPackage, evidenceAction.statement, evidenceAction.weakPointId);
        const normalizedEvidence = normalizeEvidenceName(evidenceAction.evidenceName);
        const isCorrectHit = Boolean(
            weakPoint
            && (weakPoint.kind === 'real' || weakPoint.kind === 'hidden')
            && weakPoint.expectedEvidenceName
            && normalizeEvidenceName(weakPoint.expectedEvidenceName) === normalizedEvidence
        );

        logRuntimeState('ACTION-RESOLVE', {
            actionType: 'use_evidence',
            evidenceName: evidenceAction.evidenceName,
            statement: evidenceAction.statement,
            requestedWeakPointId: evidenceAction.weakPointId || null,
            matchedWeakPointId: weakPoint?.id || null,
            matchedWeakPointKind: weakPoint?.kind || null,
            expectedEvidenceName: weakPoint?.expectedEvidenceName || null,
            isCorrectHit
        });

        if (!isCorrectHit || !weakPoint) {
            return buildDataFromRoundOutcome(roundPackage, roundPackage.blueprint, roundPackage.outcomes.wrongEvidenceOutcome, {
                usedEvidenceName: evidenceAction.evidenceName
            });
        }

        const outcome = roundPackage.outcomes.correctEvidenceOutcomes[weakPoint.id];
        if (!outcome) {
            throw new Error(`Missing cached correct-evidence outcome for "${weakPoint.id}".`);
        }

        const turnIndex = roundPackage.blueprint.turnIndex;
        const inspectedIdsForTurn = new Set(inspectedWeakPointIdsByTurn.get(turnIndex) ?? []);
        const resolvedIdsBeforeHit = new Set(resolvedWeakPointIdsByTurn.get(turnIndex) ?? []);
        roundPackage.blueprint.weakPoints.forEach(item => {
            if (resolvedStatementsMap.has(normalizeText(item.statement))) {
                resolvedIdsBeforeHit.add(item.id);
            }
        });
        const resolvedTrueWeakPointCountBeforeHit = roundPackage.blueprint.weakPoints.filter(item =>
            (item.kind === 'real' || item.kind === 'hidden') && resolvedIdsBeforeHit.has(item.id)
        ).length;
        const strictEnemyDamage = computeAiStrictHitDamage(
            roundPackage,
            resolvedTrueWeakPointCountBeforeHit + 1
        );
        const resolvedIds = new Set(resolvedIdsBeforeHit);
        resolvedIds.add(weakPoint.id);

        const remainingRealWeakPoints = roundPackage.blueprint.weakPoints.filter(item =>
            (item.kind === 'real' || item.kind === 'hidden') && !resolvedIds.has(item.id)
        );
        const cleared = remainingRealWeakPoints.length === 0;

        let clearOutcome: AiRoundOutcomeSegment | undefined;
        let nextRoundPackage: AiRoundPackage | null = null;
        if (cleared) {
            clearOutcome = roundPackage.blueprint.isFinalRound
                ? roundPackage.outcomes.victoryOutcome || roundPackage.outcomes.roundClearOutcome
                : roundPackage.outcomes.roundClearOutcome;

            if (!roundPackage.blueprint.isFinalRound) {
                const currentInventoryAfterHit = buildInventoryAfterAction(
                    evidenceMap,
                    evidenceAction.evidenceName,
                    weakPoint.consumeEvidenceOnUse !== false,
                    []
                );
                const nextInventory = deriveRoundCarryOverInventory(roundPackage, currentInventoryAfterHit, {
                    inspectedWeakPointIds: inspectedIdsForTurn,
                    resolvedWeakPointIds: resolvedIds
                });
                nextRoundPackage = await resolveNextRoundPackage(roundPackage, nextInventory);
                setRemoteRoundPackage(nextRoundPackage);
                setRemoteRoundBlueprint(nextRoundPackage.blueprint);
            } else {
                setRemoteRoundPackage(roundPackage);
                setRemoteRoundBlueprint(roundPackage.blueprint);
            }
        } else {
            setRemoteRoundPackage(roundPackage);
            setRemoteRoundBlueprint(roundPackage.blueprint);
        }

        logRuntimeState('ROUND-PROGRESS', {
            resolvedWeakPointId: weakPoint.id,
            cleared,
            remainingRealWeakPoints: remainingRealWeakPoints.map(item => item.id),
            hasClearOutcome: Boolean(clearOutcome),
            queuedNextRoundTurn: nextRoundPackage?.blueprint.turnIndex || null
        });

        return buildDataFromRoundOutcome(roundPackage, roundPackage.blueprint, outcome, {
            weakPoint,
            usedEvidenceName: evidenceAction.evidenceName,
            cleared,
            clearOutcome,
            nextRoundPackage,
            strictEnemyDamage
        });
    };

    const handleSelectLanguage = (l: Language) => {
        setLang(l);
        setScreen('config');
    };

    const handleConnect = async ({
        provider,
        apiKey,
        modelName,
        localCaseId,
        castSelection
    }: ConnectionRequest) => {
        const sysPrompt = i18n[lang].systemPrompt;
        const nextIsLocalMode = provider === 'local';
        setIsLocalMode(nextIsLocalMode);
        const resolvedCastSelection = resolveSceneCastSelection(
            castSelection,
            localCaseId || modelName || provider
        );
        let nextSessionDisplay: SessionDisplayState;
        if (provider === 'gemini') {
            aiAdapterRef.current = new GeminiAdapter(apiKey, modelName || "gemini-2.5-flash", sysPrompt);
            nextSessionDisplay = {
                mode: 'remote',
                providerLabel: 'GOOGLE GEMINI',
                modelLabel: modelName || 'gemini-2.5-flash',
                castSelection: resolvedCastSelection
            };
        } else if (provider === 'siliconflow-qwen') {
            aiAdapterRef.current = new OpenAIAdapter(apiKey, "https://api.siliconflow.cn/v1/chat/completions", modelName || "Qwen/Qwen2.5-72B-Instruct", sysPrompt);
            nextSessionDisplay = {
                mode: 'remote',
                providerLabel: 'SILICONFLOW',
                modelLabel: modelName || 'Qwen/Qwen2.5-72B-Instruct',
                castSelection: resolvedCastSelection
            };
        } else if (provider === 'siliconflow-deepseek') {
            aiAdapterRef.current = new OpenAIAdapter(apiKey, "https://api.siliconflow.cn/v1/chat/completions", modelName || "deepseek-ai/DeepSeek-V3", sysPrompt);
            nextSessionDisplay = {
                mode: 'remote',
                providerLabel: 'SILICONFLOW',
                modelLabel: modelName || 'deepseek-ai/DeepSeek-V3',
                castSelection: resolvedCastSelection
            };
        } else if (provider === 'local') {
            const selectedCaseOption = localCaseId ? localCases.find(caseOption => caseOption.id === localCaseId) : undefined;
            const selectedCase = localCaseId ? await getLocalCaseById(localCaseId) : null;
            if (!selectedCase) {
                throw new Error('Local case not found.');
            }
            const caseSelection = resolveSceneCastSelection({
                heroPortraitPackId: selectedCase.heroPortraitPackId || castSelection.heroPortraitPackId,
                enemyPortraitPackId: selectedCase.enemyPortraitPackId || castSelection.enemyPortraitPackId,
                backgroundPackId: selectedCase.backgroundPackId || castSelection.backgroundPackId
            }, selectedCase.caseId || localCaseId || provider);
            const localService = new LocalGameService(lang, selectedCase);
            aiAdapterRef.current = {
                sendMessage: async (input: string) => {
                    const actualInput = parseInputFromTurnInfo(input);
                    return await localService.handleAction(actualInput, gameStateRef.current);
                }
            };
            nextSessionDisplay = {
                mode: 'local',
                providerLabel: 'LOCAL SCRIPT',
                modelLabel: 'LOCAL CASE ENGINE',
                caseLabel: selectedCaseOption?.label || selectedCase.caseId,
                caseFilename: selectedCaseOption?.filename || `${selectedCase.caseId}.case.txt`,
                caseSource: selectedCaseOption?.source || 'builtin',
                castSelection: caseSelection
            };

            setGameState(prev => ({
                ...prev,
                castSelection: caseSelection,
                scene: {
                    ...prev.scene,
                    ...caseSelection,
                    backgroundPackId: caseSelection.backgroundPackId,
                    heroPortraitPackId: caseSelection.heroPortraitPackId,
                    enemyPortraitPackId: caseSelection.enemyPortraitPackId
                }
            }));
        } else {
            nextSessionDisplay = {
                mode: 'remote',
                providerLabel: provider.toUpperCase(),
                modelLabel: modelName || provider,
                castSelection: resolvedCastSelection
            };
            setGameState(prev => ({
                ...prev,
                castSelection: resolvedCastSelection,
                scene: {
                    ...prev.scene,
                    ...resolvedCastSelection,
                    backgroundPackId: resolvedCastSelection.backgroundPackId,
                    heroPortraitPackId: resolvedCastSelection.heroPortraitPackId,
                    enemyPortraitPackId: resolvedCastSelection.enemyPortraitPackId
                }
            }));
        }

        setSessionDisplay(nextSessionDisplay);
        setTimeout(() => {
            startPrologue(nextSessionDisplay);
        }, 800);
    };

    const startPrologue = (nextSessionDisplay = sessionDisplay) => {
        setScreen('game');
        setRestartPromptContext(null);
        setGameState(prev => createInitialGameState(nextSessionDisplay?.castSelection || prev.castSelection));
        setIntroData(null);
        setRuntimeRoundIntro(null);
        setRemoteRoundBlueprint(null);
        setRemoteRoundPackage(null);
        clearCompiledAiCaseDraft();
        setLoadDiagnostics({
            scope: 'boot',
            title: getLoadTitle('boot', nextSessionDisplay?.mode === 'local'),
            stage: nextSessionDisplay?.mode === 'local'
                ? 'Preparing local script context...'
                : 'Preparing remote generation channel...',
            status: 'working',
            error: null
        });
        setPendingLogs([]);
        setIsCurrentlyTyping(false);
        setLogs([]);
        setActiveEnemyLog(null);
        setFocusDialogue(null);
        setEvidenceReward(null);
        setGameResult(null);
        setEvidenceMap(new Map());
        setUsedEvidenceSet(new Set());
        setResolvedStatementsMap(new Map());
        setInspectedWeakPointIdsByTurn(new Map());
        setResolvedWeakPointIdsByTurn(new Map());
        setDebugAiGenerationProgress({
            sourceTurnIndex: null,
            targetTurnIndex: null,
            status: 'idle',
            stage: null,
            phase: null,
            stageLabel: null,
            attempt: null,
            maxAttempts: null,
            inventoryNames: [],
            error: null,
            updatedAt: null
        });
        prologueRequestedRef.current = false;
        currentTurnCheckpointRef.current = null;
        caseStartCheckpointRef.current = null;
        remoteRoundDraftRef.current = null;
        remoteRoundPrefetchRef.current = null;
        pendingLoadActionRef.current = null;
        
        if (audioRef.current) {
            audioRef.current.volume = 0.6;
            audioRef.current.play().then(() => setIsMuted(false)).catch(e => logDev('BGM', 'autoplay failed'));
        }
    };

    const handleBootComplete = () => {
        if (prologueRequestedRef.current) return;
        prologueRequestedRef.current = true;
        handlePlayerAction("[SYSTEM: GENERATE_PROLOGUE]");
    };

    const handleOpenRestartPrompt = () => {
        setRestartPromptContext('menu');
    };

    const handleCloseRestartPrompt = () => {
        setRestartPromptContext(null);
    };

    const handleRetryCurrentTurn = () => {
        if (!currentTurnCheckpointRef.current) return;
        logDev('ACTION', {
            type: 'retry_current_turn',
            turnIndex: currentTurnCheckpointRef.current.turnIndex
        });
        restoreRuntimeCheckpoint(currentTurnCheckpointRef.current);
    };

    const handleRestartCurrentCase = () => {
        if (!caseStartCheckpointRef.current) return;
        logDev('ACTION', {
            type: 'restart_current_case',
            turnIndex: caseStartCheckpointRef.current.turnIndex
        });
        currentTurnCheckpointRef.current = null;
        restoreRuntimeCheckpoint(caseStartCheckpointRef.current);
    };

    const handleStartFreshGame = () => {
        logDev('ACTION', 'Fresh Game Restart Initiated');

        setGameState(prev => createInitialGameState(prev.castSelection));
        setIntroData(null);
        setRuntimeRoundIntro(null);
        setRemoteRoundBlueprint(null);
        setRemoteRoundPackage(null);
        clearCompiledAiCaseDraft();
        setEvidenceMap(new Map());
        setUsedEvidenceSet(new Set());
        setResolvedStatementsMap(new Map());
        setInspectedWeakPointIdsByTurn(new Map());
        setResolvedWeakPointIdsByTurn(new Map());
        setLogs([]);
        setActiveEnemyLog(null);
        setFocusDialogue(null);
        setEvidenceReward(null);
        setGameResult(null);
        setPendingLogs([]);
        setIsCurrentlyTyping(false);
        setRestartPromptContext(null);
        prologueRequestedRef.current = false;
        currentTurnCheckpointRef.current = null;
        caseStartCheckpointRef.current = null;
        remoteRoundDraftRef.current = null;
        remoteRoundPrefetchRef.current = null;
        setDebugAiGenerationProgress({
            sourceTurnIndex: null,
            targetTurnIndex: null,
            status: 'idle',
            stage: null,
            phase: null,
            stageLabel: null,
            attempt: null,
            maxAttempts: null,
            inventoryNames: [],
            error: null,
            updatedAt: null
        });

        startPrologue(sessionDisplay || undefined);
    };

    const handleHome = () => {
        logDev("ACTION", "Return to Home");

        setGameState(createInitialGameState());
        setIntroData(null);
        setRuntimeRoundIntro(null);
        setRemoteRoundBlueprint(null);
        setRemoteRoundPackage(null);
        clearCompiledAiCaseDraft();
        setEvidenceMap(new Map());
        setUsedEvidenceSet(new Set());
        setResolvedStatementsMap(new Map());
        setInspectedWeakPointIdsByTurn(new Map());
        setResolvedWeakPointIdsByTurn(new Map());
        setLogs([]);
        setActiveEnemyLog(null);
        setFocusDialogue(null);
        setEvidenceReward(null);
        setGameResult(null);
        setPendingLogs([]);
        setIsCurrentlyTyping(false);
        setRestartPromptContext(null);
        setLoadDiagnostics(null);
        setSessionDisplay(null);
        setIsLocalMode(false);
        setDebugAiGenerationProgress({
            sourceTurnIndex: null,
            targetTurnIndex: null,
            status: 'idle',
            stage: null,
            phase: null,
            stageLabel: null,
            attempt: null,
            maxAttempts: null,
            inventoryNames: [],
            error: null,
            updatedAt: null
        });
        setScreen('start');
        currentTurnCheckpointRef.current = null;
        caseStartCheckpointRef.current = null;
        remoteRoundDraftRef.current = null;
        remoteRoundPrefetchRef.current = null;
        pendingLoadActionRef.current = null;
        
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsMuted(true);
        }
    };

    const handlePlayerAction = async (hiddenCommand?: string, textInput?: string, suppressHeroLog = false) => {
        if (gameState.isOver) return;

        let text = hiddenCommand || textInput?.trim();
        if (!text) return;

        if (!hiddenCommand && !suppressHeroLog) {
            const parsedAction = parseEvidenceAction(text);
            const heroText = parsedAction
                ? `OBJECTION! ${parsedAction.evidenceName} -> "${parsedAction.statement}"`
                : text;
            setLogs(prev => [...prev, { id: Date.now().toString(), type: 'chat', role: 'hero', text: heroText }]);
        }

        const requestScope: 'boot' | 'runtime' = gameStateRef.current.phase === 'idle' ? 'boot' : 'runtime';
        const requestTitle = getLoadTitle(requestScope, isLocalMode);
        const requestStage = isLocalMode
            ? requestScope === 'boot'
                ? 'Loading local opening package...'
                : 'Resolving action against local script...'
            : requestScope === 'boot'
                ? 'Requesting opening package from AI model...'
                : 'Requesting round resolution from AI model...';
        const validationStage = isLocalMode
            ? requestScope === 'boot'
                ? 'Parsing local opening package...'
                : 'Applying local script result...'
            : requestScope === 'boot'
                ? 'Validating opening package structure and solvability...'
                : 'Validating round package, language, and solvability...';

        pendingLoadActionRef.current = {
            hiddenCommand,
            textInput,
            scope: requestScope
        };
        setLoadDiagnostics({
            scope: requestScope,
            title: requestTitle,
            stage: requestStage,
            status: 'working',
            error: null
        });
        setIsLoading(true);

        try {
            let data: any;

            if (!isLocalMode && text === '[SYSTEM: GENERATE_PROLOGUE]') {
                data = await requestRemoteOpeningPayload();
            } else if (!isLocalMode && remoteRoundPackageRef.current) {
                data = await resolveRemoteRoundAction(remoteRoundPackageRef.current, text);
            } else if (!isLocalMode) {
                throw new Error('Remote round package is unavailable for AI runtime resolution.');
            } else {
                setLoadDiagnostics({
                    scope: requestScope,
                    title: requestTitle,
                    stage: validationStage,
                    status: 'working',
                    error: null
                });
                let inventoryDesc = "";
                evidenceMap.forEach((detail, name) => {
                    inventoryDesc += `[${name}: ${detail}], `;
                });
                let usedDesc = Array.from(usedEvidenceSet).join(", ");

                const isFatalPhase = gameState.enemyHp <= 10;
                const inventoryCount = evidenceMap.size;
                
                let currentFatalTurnCount = gameState.fatalTurnCount;
                if (isFatalPhase) {
                    currentFatalTurnCount++;
                    setGameState(prev => ({ ...prev, fatalTurnCount: currentFatalTurnCount }));
                }

                const serializedInput = JSON.stringify(text);
                const turnInfo = `
[Turn ID: ${Date.now()}]
[Status] HeroHP:${gameState.heroHp}, EnemyHP:${gameState.enemyHp}.
[Suspect] ${gameState.suspectName || "Unknown"}
[Player Inventory] ${inventoryDesc || "Empty"}
[Inventory Count] ${inventoryCount}
[Used Evidence] ${usedDesc || "None"}
[Fatal Phase Turn Count] ${currentFatalTurnCount}
[Phase] ${isFatalPhase ? "FATAL PHASE (HP=10%) - Generate Fatal Weak Point!" : "NORMAL PHASE"}
[Input] ${serializedInput}
[Input_JSON] ${serializedInput}

[SYSTEM INSTRUCTION]: 
1. Determine Attack Type: STRICT, FUZZY, QUERY, or MISS.
2. Calculate Damage:
   - QUERY: Player -5% HP. Boss 0 dmg.
   - MISS: Player -10% HP. Boss 0 dmg.
   - STRICT: Player +10% HP. Boss Dmg 10-20% (Watch for HP Lock).
3. **HP Lock Rule**: If current HP > 10%, damage CANNOT drop HP below 10%.
4. **Fatal Phase**: If HP=10% and STRICT hit, reduce HP to 0 (Confession).
5. **Solvability**: Ensure at least one active [[Statement]] contradicts an item in [Player Inventory].
6. **Refill**: If Inventory count < 2, generate new {{Evidence}}.
7. **End Game**: If HP reaches 0, output full case report in 'narrative' or 'case_truth'.
8. **IMPORTANT**: Output must use keys 'enemy_dialogue' and 'narrative'. DO NOT use 'hero_dialogue'.
`;
                logDev("REQUEST", turnInfo);
                data = await aiAdapterRef.current.sendMessage(turnInfo);
                logDev("RESPONSE", data);
            }

            processTurnResult(data);
            setLoadDiagnostics(null);
            pendingLoadActionRef.current = null;
        } catch (error: any) {
            console.error(error);
            logDev("ERROR", error.message);
            setLogs(prev => [...prev, { id: Date.now().toString(), type: 'system', text: `SIGNAL LOST: ${error.message}` }]);
            setLoadDiagnostics({
                scope: requestScope,
                title: requestTitle,
                stage: requestScope === 'boot'
                    ? 'Opening package generation halted.'
                    : 'Round generation halted.',
                status: 'error',
                attempt: !isLocalMode ? (text === '[SYSTEM: GENERATE_PROLOGUE]' ? 3 : 2) : undefined,
                maxAttempts: !isLocalMode ? (text === '[SYSTEM: GENERATE_PROLOGUE]' ? 3 : 2) : undefined,
                error: error.message || 'Unknown load error.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const processTurnResult = (data: any) => {
        if (isLocalMode && !data.enemy_dialogue && data.hero_dialogue) {
            data.enemy_dialogue = data.hero_dialogue;
            logDev("AUTO-FIX", "Mapped hero_dialogue to enemy_dialogue");
        }
        
        if (!data.narrative && !data.case_truth) {
            data.narrative = "(System: data stream rebuilding... keep reasoning.)";
        }

        let nextHeroHp = Math.min(100, Math.max(0, gameState.heroHp - (Number(data.hero_dmg_taken) || 0)));
        let enemyDmg = Number(data.enemy_dmg_taken);
        if (isNaN(enemyDmg)) {
            if (data.attack_type === 'strict') enemyDmg = 20;
            else if (data.attack_type === 'fuzzy') enemyDmg = 1;
            else enemyDmg = 0;
        }
        
        const usesBudgetedDamage = data.runtime_damage_mode === 'budgeted';
        const roundCleared = Boolean(data.round_cleared);
        const isFinalRound = Boolean(data.is_final_round);

        let nextEnemyHp = gameState.enemyHp - enemyDmg;
        let hpLockedMsg = false;

        if (usesBudgetedDamage) {
            if (!roundCleared && nextEnemyHp <= 0) {
                nextEnemyHp = 1;
            }
            nextEnemyHp = Math.max(0, nextEnemyHp);
        } else {
            if (gameState.enemyHp > 10 && nextEnemyHp < 10) {
                nextEnemyHp = 10; 
                hpLockedMsg = true;
            } else if (gameState.enemyHp <= 10 && nextEnemyHp < 0) {
                if (data.attack_type === 'strict') nextEnemyHp = 0;
                else nextEnemyHp = Math.max(1, nextEnemyHp); 
            }
            nextEnemyHp = Math.max(0, nextEnemyHp);
        }

        const isEnding = usesBudgetedDamage
            ? Boolean(data.enemy_surrendered) || Boolean(isFinalRound && roundCleared && nextEnemyHp <= 0)
            : nextEnemyHp <= 0 || data.enemy_surrendered;
        const isHeroDown = nextHeroHp <= 0;
        const shouldFinish = isEnding || isHeroDown;
        const grantedEvidenceEntries: EvidenceEntry[] = Array.isArray(data.granted_evidences)
            ? data.granted_evidences
                .filter((evidence: any) => evidence && typeof evidence.name === 'string' && typeof evidence.detail === 'string')
                .map((evidence: any) => ({
                    name: evidence.name,
                    detail: evidence.detail
                }))
            : [];
        const inferredEnemyPortraitState = data.enemy_portrait_state
            || enemyPortraitStateFromAttackType(data.attack_type, {
                victory: isEnding,
                heroDown: isHeroDown,
                grantedEvidence: grantedEvidenceEntries.length > 0
            });
        const inferredEnemyPortraitMotion = data.enemy_portrait_motion
            || (data.attack_type === 'strict' ? 'shake_small' : 'none');
        const inferredBackgroundSlot = data.background_slot
            || (gameState.phase === 'idle'
                ? 'briefing'
                : isEnding
                    ? 'confession'
                    : isHeroDown
                        ? 'analysis'
                        : 'cross_exam');
        const inferredScreenFilter = data.screen_filter
            || (Boolean(data.popup_interference) ? 'glitch' : 'none');
        const inferredScreenImpulse = data.screen_impulse
            || (data.attack_type === 'strict' ? 'zoom_punch' : 'none');
        const inferredTransition = data.transition
            || (data.attack_type === 'strict' ? 'white_flash' : 'cut');
        const parsedDialogueSequence = parseDialogueSequence(data.dialogue_sequence);
        const parsedCurrentRoundBlueprint = parseAiRoundBlueprint({
            ...data,
            dialogue_sequence: parsedDialogueSequence
        });
        const parsedNextRoundSeed = parseAiRoundSeedSegment(data.next_round_package);
        const parsedNextRoundBlueprint = parseAiRoundBlueprint(data.next_round_package);
        const parsedRoundIndex = Number.isFinite(Number(data.turn_index)) && Number(data.turn_index) > 0
            ? Math.floor(Number(data.turn_index))
            : undefined;

        if (gameState.phase === 'idle') {
            const compiledCurrentRoundLog = buildEnemyLogFromCompiledTurn(
                parsedCurrentRoundBlueprint?.turnIndex || parsedRoundIndex,
                filterEmoji(data.identity_enemy_emoji),
                parsedCurrentRoundBlueprint
            );
            const narrativeText = data.narrative || '';
            const suspectMsg = compiledCurrentRoundLog?.text || parsedCurrentRoundBlueprint?.enemyDialogue || data.enemy_dialogue || '';
            const systemMsg = data.system_msg || data.system || '';
            const runtimeSuspectName = resolveRuntimeSuspectName({
                explicit: data.suspect_name,
                inferred: inferSuspectNameFromTranscript(
                    compiledCurrentRoundLog?.text || parsedCurrentRoundBlueprint?.enemyDialogue || data.enemy_dialogue || '',
                    compiledCurrentRoundLog?.dialogueSequence
                        || (parsedDialogueSequence.length > 0 ? parsedDialogueSequence : undefined)
                ),
                fallback: gameStateRef.current.suspectName
            });
            const narrativeTokens = parseTokens(narrativeText);
            const fallbackEvidenceTokens = narrativeTokens.filter(
                (token): token is Extract<Token, { type: 'evidence' }> => token.type === 'evidence'
            );
            const providedEvidenceTokens: Token[] = Array.isArray(data.evidences)
                ? data.evidences
                    .filter((ev: any) => ev && typeof ev.name === 'string' && typeof ev.detail === 'string')
                    .map((ev: any) => ({
                        type: 'evidence' as const,
                        name: ev.name,
                        detail: ev.detail,
                        raw: `{{${ev.name}|${ev.detail}}}`
                    }))
                : [];
            const evidences = providedEvidenceTokens.length > 0 ? providedEvidenceTokens : fallbackEvidenceTokens;
            
            setIntroData({
                narrative: narrativeText,
                suspectMsg: suspectMsg,
                suspectDialogueSequence: compiledCurrentRoundLog?.dialogueSequence
                    || (parsedDialogueSequence.length > 0 ? parsedDialogueSequence : undefined),
                roundIndex: parsedCurrentRoundBlueprint?.turnIndex || parsedRoundIndex,
                systemMsg: systemMsg,
                evidences: evidences,
                backgroundSlot: compiledCurrentRoundLog?.backgroundSlot || inferredBackgroundSlot,
                screenFilter: compiledCurrentRoundLog?.screenFilter || inferredScreenFilter,
                transition: compiledCurrentRoundLog?.transition || inferredTransition,
                enemyPortraitState: compiledCurrentRoundLog?.enemyPortraitState || inferredEnemyPortraitState
            });
            if (!isLocalMode && parsedCurrentRoundBlueprint) {
                setRemoteRoundBlueprint(parsedCurrentRoundBlueprint);
            }
            
            setGameState(prev => ({
                ...prev,
                heroHp: nextHeroHp,
                enemyHp: nextEnemyHp,
                fixedEnemyEmoji: prev.fixedEnemyEmoji || filterEmoji(data.identity_enemy_emoji),
                fixedHeroEmoji: prev.fixedHeroEmoji || filterEmoji(data.identity_hero_emoji),
                suspectName: runtimeSuspectName || prev.suspectName,
                isOver: shouldFinish,
                phase: 'intro_narrative',
                scene: {
                    ...prev.scene,
                    backgroundSlot: inferredBackgroundSlot,
                    enemyPortraitState: inferredEnemyPortraitState,
                    enemyPortraitMotion: inferredEnemyPortraitMotion,
                    screenFilter: inferredScreenFilter,
                    screenImpulse: inferredScreenImpulse,
                    transition: inferredTransition
                }
            }));
            return;
        }

        const runtimeSuspectName = resolveRuntimeSuspectName({
            explicit: data.suspect_name,
            inferred: inferSuspectNameFromTranscript(
                parsedCurrentRoundBlueprint?.enemyDialogue || data.enemy_dialogue || '',
                parsedCurrentRoundBlueprint?.dialogueSequence || parsedDialogueSequence
            ),
            fallback: gameStateRef.current.suspectName
        });

        setGameState(prev => ({
            ...prev,
            heroHp: nextHeroHp,
            enemyHp: nextEnemyHp,
            fixedEnemyEmoji: prev.fixedEnemyEmoji || filterEmoji(data.identity_enemy_emoji),
                fixedHeroEmoji: prev.fixedHeroEmoji || filterEmoji(data.identity_hero_emoji),
                suspectName: runtimeSuspectName || prev.suspectName,
                isOver: shouldFinish,
                scene: {
                    ...prev.scene,
                    backgroundSlot: inferredBackgroundSlot,
                    enemyPortraitState: inferredEnemyPortraitState,
                    enemyPortraitMotion: inferredEnemyPortraitMotion,
                    screenFilter: inferredScreenFilter,
                    screenImpulse: inferredScreenImpulse,
                    transition: inferredTransition
                }
            }));

        if (!isLocalMode && parsedCurrentRoundBlueprint) {
            setRemoteRoundBlueprint(parsedCurrentRoundBlueprint);
        }

        let usedEvDetail = "Details not available.";
        let usedEvName = data.used_evidence || data.removed_evidence || "Unknown Evidence";
        const consumedEvidenceMatch = (
            data.attack_type === 'strict'
            && (data.used_evidence || data.removed_evidence)
        )
            ? findMatchingEvidenceEntry(
                evidenceMap,
                (data.used_evidence || data.removed_evidence) as string
            )
            : null;

        if (consumedEvidenceMatch) {
            usedEvDetail = consumedEvidenceMatch.detail;
            usedEvName = consumedEvidenceMatch.name;
        }

        if (data.attack_type === 'strict' && data.resolved_statement) {
            setResolvedStatementsMap(prev => {
                const newMap = new Map(prev);
                newMap.set(normalizeText(data.resolved_statement), {
                    logic: data.logic_explanation,
                    evName: usedEvName,
                    evDetail: usedEvDetail
                });
                return newMap;
            });
        }

        if (
            data.attack_type === 'strict'
            && typeof data.resolved_weak_point_id === 'string'
            && data.resolved_weak_point_id.trim().length > 0
        ) {
            const resolvedTurnIndex = parsedCurrentRoundBlueprint?.turnIndex
                || parsedRoundIndex
                || remoteRoundPackageRef.current?.blueprint.turnIndex;
            if (resolvedTurnIndex) {
                setResolvedWeakPointIdsByTurn(prev =>
                    updateTurnWeakPointSet(prev, resolvedTurnIndex, data.resolved_weak_point_id.trim())
                );
            }
        }

        if (grantedEvidenceEntries.length > 0) {
            setEvidenceMap(prevMap => {
                return mergeEvidenceEntriesIntoMap(prevMap, grantedEvidenceEntries);
            });
        }

        const newLogs: LogEntry[] = [];
        let nextEnemyLog: LogEntry | null = null;
        let nextRoundIntro: RoundIntroRequest | null = null;
        
        if (hpLockedMsg) {
            newLogs.push({ id: Date.now() + '1', type: 'system', text: "MENTAL SHIELD CRITICAL - LOCKED AT 10%" });
        }

        if (grantedEvidenceEntries.length > 0) {
            grantedEvidenceEntries.forEach((evidence, index) => {
                newLogs.push({
                    id: `${Date.now()}-grant-${index}`,
                    type: 'system',
                    text: `[EVIDENCE ACQUIRED] ${evidence.name}`
                });
            });
        }

        if (data.case_truth && data.case_truth.trim()) {
            newLogs.push({ id: Date.now() + '2', type: 'narrative', text: data.case_truth, isFinal: true });
        } else if (data.narrative && data.narrative.trim()) {
            newLogs.push({ id: Date.now() + '3', type: 'narrative', text: data.narrative, isFinal: isEnding });
        }

        if (data.enemy_dialogue && data.enemy_dialogue.trim()) {
            nextEnemyLog = {
                id: Date.now() + '4',
                type: 'chat',
                role: 'enemy',
                hiddenInCaseLog: true,
                text: data.enemy_dialogue,
                avatarEmoji: filterEmoji(data.enemy_emoji || data.identity_enemy_emoji || "??"),
                popupInterference: Boolean(data.popup_interference),
                backgroundSlot: inferredBackgroundSlot,
                enemyPortraitState: inferredEnemyPortraitState,
                enemyPortraitMotion: inferredEnemyPortraitMotion,
                screenFilter: inferredScreenFilter,
                screenImpulse: inferredScreenImpulse,
                transition: inferredTransition,
                dialogueSequence: parsedDialogueSequence.length > 0 ? parsedDialogueSequence : undefined,
                roundIndex: parsedRoundIndex,
                interferenceLines: Array.isArray(data.interference_lines)
                    ? data.interference_lines.filter((line: any) => typeof line === 'string')
                    : undefined
            };
            if (!isLocalMode && parsedCurrentRoundBlueprint) {
                const compiledCurrentRoundLog = buildEnemyLogFromCompiledTurn(
                    parsedCurrentRoundBlueprint.turnIndex,
                    filterEmoji(data.enemy_emoji || data.identity_enemy_emoji || "??"),
                    parsedCurrentRoundBlueprint
                );
                if (compiledCurrentRoundLog) {
                    nextEnemyLog = compiledCurrentRoundLog;
                } else {
                    nextEnemyLog.text = parsedCurrentRoundBlueprint.enemyDialogue;
                    nextEnemyLog.dialogueSequence = parsedCurrentRoundBlueprint.dialogueSequence;
                    nextEnemyLog.roundIndex = parsedCurrentRoundBlueprint.turnIndex;
                }
            }
        } else if (!isEnding && !isLocalMode && parsedCurrentRoundBlueprint) {
            nextEnemyLog = buildEnemyLogFromCompiledTurn(
                parsedCurrentRoundBlueprint.turnIndex,
                filterEmoji(data.enemy_emoji || data.identity_enemy_emoji || "??"),
                parsedCurrentRoundBlueprint
            ) || buildEnemyLogFromRoundBlueprint(
                parsedCurrentRoundBlueprint,
                filterEmoji(data.enemy_emoji || data.identity_enemy_emoji || "??")
            );
        } else if (!isEnding) {
            newLogs.push({ id: Date.now() + '5', type: 'system', text: "Data parse warning: empty enemy dialogue (JSON)." });
        }

        const nextRoundTurnIndex = parsedNextRoundBlueprint?.turnIndex || parsedNextRoundSeed?.turnIndex;
        const compiledNextRoundStartingEvidences = getCompiledAiTurnStartingEvidences(nextRoundTurnIndex);
        const nextRoundStartingEvidences = compiledNextRoundStartingEvidences.length > 0
            ? compiledNextRoundStartingEvidences
            : parsedNextRoundSeed?.startingEvidences || [];
        const nextRoundRuntimeEvidenceMap = (() => {
            const nextMap = new Map(evidenceMap);

            if (consumedEvidenceMatch?.name && data.removed_evidence) {
                nextMap.delete(consumedEvidenceMatch.name);
            }

            const grantedInventoryMap = grantedEvidenceEntries.length > 0
                ? mergeEvidenceEntriesIntoMap(nextMap, grantedEvidenceEntries)
                : nextMap;

            return (
                !isLocalMode
                && data.round_status === 'cleared'
                && nextRoundStartingEvidences.length > 0
            )
                ? mergeEvidenceEntriesIntoMap(grantedInventoryMap, nextRoundStartingEvidences)
                : grantedInventoryMap;
        })();

        if (consumedEvidenceMatch?.name && data.removed_evidence) {
            setUsedEvidenceSet(prevSet => new Set(prevSet).add(consumedEvidenceMatch.name));
        }

        if (
            consumedEvidenceMatch?.name
            || grantedEvidenceEntries.length > 0
            || (
                !isLocalMode
                && data.round_status === 'cleared'
                && nextRoundStartingEvidences.length > 0
            )
        ) {
            setEvidenceMap(() => nextRoundRuntimeEvidenceMap);
        }

        if (
            !isLocalMode
            && data.round_status === 'cleared'
            && nextRoundStartingEvidences.length > 0
        ) {
            logDev('ROUND-TRANSITION', {
                turnIndex: parsedNextRoundBlueprint?.turnIndex || parsedNextRoundSeed?.turnIndex || null,
                action: 'inject-starting-evidence',
                inventoryNames: Array.from(nextRoundRuntimeEvidenceMap.keys()),
                startingEvidenceNames: nextRoundStartingEvidences.map(entry => entry.name)
            });
        }

        if (!isLocalMode && data.round_status === 'cleared' && parsedNextRoundBlueprint) {
            const nextRoundVerdict = validateAiRoundBlueprint(
                parsedNextRoundBlueprint.weakPoints,
                mapEvidenceMapToEntries(nextRoundRuntimeEvidenceMap)
            );
            if (!nextRoundVerdict.ok) {
                const issue = `Next round start inventory is invalid: ${nextRoundVerdict.reason}`;
                logDev('ROUND-TRANSITION', {
                    turnIndex: parsedNextRoundBlueprint.turnIndex,
                    issue,
                    inventoryNames: Array.from(nextRoundRuntimeEvidenceMap.keys()),
                    startingEvidenceNames: nextRoundStartingEvidences.map(entry => entry.name)
                });
                newLogs.push({
                    id: `${Date.now()}-next-round-invalid`,
                    type: 'system',
                    text: `NEXT ROUND SYNC WARNING // ${issue}`
                });
            }
        }

        if (!isLocalMode && data.round_status === 'cleared' && parsedNextRoundBlueprint) {
            setRemoteRoundBlueprint(parsedNextRoundBlueprint);
            nextEnemyLog = buildEnemyLogFromCompiledTurn(
                parsedNextRoundBlueprint.turnIndex,
                filterEmoji(data.enemy_emoji || data.identity_enemy_emoji || "??"),
                parsedNextRoundBlueprint
            ) || buildEnemyLogFromRoundBlueprint(
                parsedNextRoundBlueprint,
                filterEmoji(data.enemy_emoji || data.identity_enemy_emoji || "??")
            );
            nextRoundIntro = createRuntimeRoundIntroRequest(parsedNextRoundBlueprint.turnIndex);
        }

        if (
            isLocalMode
            && !isEnding
            && nextEnemyLog
            && parsedRoundIndex
            && parsedRoundIndex > 1
            && parsedRoundIndex > (activeEnemyLog?.roundIndex || 0)
        ) {
            nextRoundIntro = createRuntimeRoundIntroRequest(parsedRoundIndex);
        }

        if (gameState.enemyHp <= 10 && nextEnemyHp <= 10 && gameState.enemyHp > 0) {
            newLogs.push({ id: Date.now() + '6', type: 'system', text: "FATAL PHASE ACTIVE: FIND THE FINAL WEAK POINT!" });
        }

        if (isEnding) {
            newLogs.push({ id: Date.now() + '7', type: 'system', text: "GUILTY - CONFESSION SECURED" });
            setGameState(prev => ({ ...prev, fixedEnemyEmoji: "??" }));
        } else if (isHeroDown) {
            newLogs.push({ id: Date.now() + '8', type: 'system', text: "MENTAL BREAKDOWN - CASE COLD" });
            setGameState(prev => ({ ...prev, fixedHeroEmoji: "??" }));
        }

        const avgSequence = parseAvgSequence(data.avg_sequence);

        logRuntimeState('TURN-RESULT', {
            attackType: data.attack_type || null,
            heroDamageTaken: Number(data.hero_dmg_taken) || 0,
            enemyDamageTaken: Number(data.enemy_dmg_taken) || 0,
            nextHeroHp,
            nextEnemyHp,
            roundStatus: data.round_status || null,
            resolvedWeakPointId: data.resolved_weak_point_id || null,
            grantedEvidenceNames: grantedEvidenceEntries.map(entry => entry.name),
            avgLineCount: avgSequence.length,
            isEnding,
            isHeroDown
        });

        const finalSummary = (data.case_truth && data.case_truth.trim())
            || (data.narrative && data.narrative.trim())
            || (isEnding ? 'Case closed.' : 'Case unresolved.');
        const endResult: GameResultState | null = shouldFinish
            ? { victory: isEnding, summary: finalSummary }
            : null;
        const queuedEvidenceReward: EvidenceRewardState | null = grantedEvidenceEntries.length > 0
            ? {
                evidences: grantedEvidenceEntries,
                queuedEnemyLog: shouldFinish ? null : nextEnemyLog,
                queuedRoundIntro: shouldFinish ? null : nextRoundIntro,
                endResult
            }
            : null;

        if (avgSequence.length > 0) {
            const transcriptLogs = buildAvgTranscriptLogs(
                avgSequence,
                `avg-${Date.now()}-${parsedCurrentRoundBlueprint?.turnIndex || remoteRoundPackageRef.current?.blueprint.turnIndex || 'runtime'}`
            );
            setFocusDialogue({
                lines: avgSequence,
                index: 0,
                queuedEnemyLog: queuedEvidenceReward ? null : shouldFinish ? null : nextEnemyLog,
                queuedRoundIntro: queuedEvidenceReward ? null : shouldFinish ? null : nextRoundIntro,
                endResult: queuedEvidenceReward ? null : endResult,
                queuedEvidenceReward,
                transcriptLogs
            });
        } else if (queuedEvidenceReward) {
            setEvidenceReward(queuedEvidenceReward);
        } else if (nextEnemyLog && !shouldFinish) {
            if (nextRoundIntro) {
                setRuntimeRoundIntro(nextRoundIntro);
            }
            commitActiveEnemyLog(nextEnemyLog);
        }

        setPendingLogs(prev => [...prev, ...newLogs]);

        if (endResult && avgSequence.length === 0 && !queuedEvidenceReward) {
            openGameOver(endResult);
        }
    };

    const handleIntroContinue = (nextPhase: GamePhase) => {
        if (nextPhase !== 'playing') {
            setGameState(prev => ({ ...prev, phase: nextPhase }));
            return;
        }

        if (!introData) {
            setGameState(prev => ({ ...prev, phase: 'playing' }));
            return;
        }

        const newLogs: LogEntry[] = [];
        if (introData.narrative) {
            newLogs.push({
                id: 'intro-narrative-' + Date.now(),
                type: 'narrative',
                text: introData.narrative,
                isTyping: false
            });
        }
        setLogs(prev => [...prev, ...newLogs]);
        setActiveEnemyLog(null);

        if (introData.suspectMsg.trim()) {
            setGameState(prev => ({ ...prev, phase: 'battle_intro' }));
            return;
        }

        setGameState(prev => ({ ...prev, phase: 'playing' }));
    };

    const handleBattleIntroComplete = () => {
        if (gameStateRef.current.phase !== 'battle_intro') {
            return;
        }

        setGameState(prev => ({ ...prev, phase: 'playing' }));
        if (!introData) {
            return;
        }

        commitActiveEnemyLog(buildIntroEnemyLog(introData));
    };

    const handleRoundIntroComplete = () => {
        if (gameStateRef.current.phase === 'battle_intro') {
            handleBattleIntroComplete();
            return;
        }

        setRuntimeRoundIntro(null);
    };

    useEffect(() => {
        if (gameState.phase === 'intro_evidence' && introData) {
            const allCollected = introData.evidences.length > 0 && introData.evidences.every(ev => evidenceMap.has(ev.name));
            if (allCollected || introData.evidences.length === 0) {
                setTimeout(() => {
                    handleIntroContinue('playing');
                }, 1000);
            }
        }
    }, [evidenceMap, gameState.phase, introData]);

    useEffect(() => {
        if (isLocalMode) {
            return;
        }

        if (gameState.phase !== 'battle_intro' && gameState.phase !== 'playing') {
            return;
        }

        const activePackage = remoteRoundPackageRef.current;
        if (!activePackage || activePackage.blueprint.isFinalRound) {
            return;
        }

        const inventorySnapshot = Array.from(evidenceMap.entries()).map(([name, detail]) => ({ name, detail }));
        const activeTurnIndex = activePackage.blueprint.turnIndex;
        const inspectedIds = inspectedWeakPointIdsByTurn.get(activeTurnIndex) ?? new Set<string>();
        const resolvedIds = resolvedWeakPointIdsByTurn.get(activeTurnIndex) ?? new Set<string>();
        const carryOverInventory = deriveRoundCarryOverInventory(activePackage, inventorySnapshot, {
            inspectedWeakPointIds: inspectedIds,
            resolvedWeakPointIds: resolvedIds
        });
        prefetchRemoteRoundPackage(activePackage, carryOverInventory);
    }, [
        gameState.phase,
        isLocalMode,
        remoteRoundPackage?.blueprint.turnIndex
    ]);

    const handleCollectEvidence = (name: string, detail: string) => {
        if (evidenceMap.has(name) || usedEvidenceSet.has(name)) return;
        
        setEvidenceMap(prev => {
            const newMap = new Map(prev);
            if (newMap.size >= 7) {
                const firstKey = newMap.keys().next().value;
                if (firstKey) newMap.delete(firstKey);
            }
            newMap.set(name, detail);
            return newMap;
        });
    };

    const handleUseEvidence = (name: string, statement: string, weakPointId?: string) => {
        const text = buildEvidenceAction(name, statement, weakPointId);
        handlePlayerAction(undefined, text);
    };

    const handleInspectWeakPoint = (statement: string, weakPointId?: string) => {
        if (!isLocalMode && !remoteRoundPackageRef.current) {
            return;
        }
        const text = buildInspectAction(statement, weakPointId);
        handlePlayerAction(text);
    };

    const toggleMute = () => {
        if (audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play().catch(e => console.error(e));
                setIsMuted(false);
            } else {
                audioRef.current.pause();
                setIsMuted(true);
            }
        }
    };

    const handleDevPrompt = () => {
        const code = window.prompt("ENTER ACCESS CODE:", "");
        if (code === "dev") {
            setIsDevConsoleOpen(true);
            logDev("INFO", "Developer Mode Toggled ON");
        }
    };

    const handleDownloadDevLog = () => {
        if (devLogs.length === 0) {
            alert("No logs to download.");
            return;
        }
        const blob = new Blob([devLogs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dev-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLinkLocalWorkspace = async () => {
        await linkLocalCaseWorkspace();
        await refreshLocalCases();
    };

    const handleSaveCompiledAiCase = async () => {
        if (!compiledAiCaseDraft) {
            return;
        }

        try {
            setCompiledAiCaseSaveState('saving');
            setCompiledAiCaseSaveMessage(null);
            const savedFilename = await saveCaseFileAs(
                compiledAiCaseDraft.filename,
                compiledAiCaseDraft.serializedText
            );
            await refreshLocalCases();
            setCompiledAiCaseSaveState('saved');
            setCompiledAiCaseSaveMessage(
                lang === 'zh'
                    ? `\u5df2\u4fdd\u5b58\u5230 ${savedFilename}`
                    : lang === 'ja'
                        ? `${savedFilename} \u3068\u3057\u3066\u4fdd\u5b58\u3057\u307e\u3057\u305f`
                        : `Saved as ${savedFilename}`
            );
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                setCompiledAiCaseSaveState('idle');
                setCompiledAiCaseSaveMessage(null);
                return;
            }
            setCompiledAiCaseSaveState('error');
            setCompiledAiCaseSaveMessage(
                error?.message
                || (lang === 'zh'
                    ? '\u4fdd\u5b58 AI \u5267\u672c\u5931\u8d25\u3002'
                    : lang === 'ja'
                        ? 'AI\u811a\u672c\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002'
                        : 'Failed to save the AI script.')
            );
        }
    };

    const handleRetryGeneration = () => {
        const pendingAction = pendingLoadActionRef.current;
        if (!pendingAction) {
            return;
        }

        void handlePlayerAction(pendingAction.hiddenCommand, pendingAction.textInput, true);
    };

    const handleRetryNextRoundPrefetch = () => {
        if (isLocalMode) {
            return;
        }

        const activePackage = remoteRoundPackageRef.current;
        if (!activePackage || activePackage.blueprint.isFinalRound) {
            return;
        }

        const inventorySnapshot = Array.from(evidenceMap.entries()).map(([name, detail]) => ({ name, detail }));
        const activeTurnIndex = activePackage.blueprint.turnIndex;
        const inspectedIds = inspectedWeakPointIdsByTurn.get(activeTurnIndex) ?? new Set<string>();
        const resolvedIds = resolvedWeakPointIdsByTurn.get(activeTurnIndex) ?? new Set<string>();
        const carryOverInventory = deriveRoundCarryOverInventory(activePackage, inventorySnapshot, {
            inspectedWeakPointIds: inspectedIds,
            resolvedWeakPointIds: resolvedIds
        });

        prefetchRemoteRoundPackage(activePackage, carryOverInventory, { force: true });
    };

    const handleCancelGeneration = () => {
        const cancelSummary = lang === 'zh'
            ? '已取消当前生成流程，审判中止。'
            : lang === 'ja'
                ? '現在の生成処理を中断し、審判を終了しました。'
                : 'Generation was cancelled and the trial was terminated.';

        setLoadDiagnostics(null);
        setIsLoading(false);
        pendingLoadActionRef.current = null;

        if (gameStateRef.current.phase === 'idle') {
            handleHome();
            return;
        }

        openGameOver({
            victory: false,
            summary: cancelSummary
        });
    };

    const openingRoundIntro: RoundIntroRequest | null = gameState.phase === 'battle_intro' && introData
        ? {
            token: introData.roundIndex ? `opening-round-${introData.roundIndex}` : 'opening-debate',
            roundIndex: introData.roundIndex,
            mode: 'opening'
        }
        : null;
    const activeRoundIntro = openingRoundIntro ?? runtimeRoundIntro;

    const sharedLoadRows = useMemo(
        () => buildLoadRows(),
        [sessionDisplay, lang, portraitPacks, backgroundPacks]
    );
    const bootLines = useMemo(
        () => buildBootLines(),
        [sessionDisplay, lang, portraitPacks, backgroundPacks]
    );
    const bootPanelStatus = loadDiagnostics?.scope === 'boot'
        ? {
            title: loadDiagnostics.title,
            stage: loadDiagnostics.stage,
            status: loadDiagnostics.status,
            rows: sharedLoadRows,
            attempt: loadDiagnostics.attempt,
            maxAttempts: loadDiagnostics.maxAttempts,
            error: loadDiagnostics.error
        }
        : sessionDisplay
            ? {
                title: getLoadTitle('boot', sessionDisplay.mode === 'local'),
                stage: 'Preparing session context...',
                status: 'working' as const,
                rows: sharedLoadRows
            }
            : null;
    const runtimeLoadPanelStatus = loadDiagnostics?.scope === 'runtime'
        ? {
            title: loadDiagnostics.title,
            stage: loadDiagnostics.stage,
            status: loadDiagnostics.status,
            rows: sharedLoadRows,
            attempt: loadDiagnostics.attempt,
            maxAttempts: loadDiagnostics.maxAttempts,
            error: loadDiagnostics.error
        }
        : null;
    const runtimePrefetchNotice = !isLocalMode
        && (gameState.phase === 'battle_intro' || gameState.phase === 'playing')
        && debugAiGenerationProgress.status === 'failed'
        && remoteRoundPackage
        && debugAiGenerationProgress.sourceTurnIndex === remoteRoundPackage.blueprint.turnIndex
        && debugAiGenerationProgress.targetTurnIndex === remoteRoundPackage.blueprint.turnIndex + 1
        ? {
            title: lang === 'zh'
                ? `下一轮预生成失败`
                : lang === 'ja'
                    ? '次ラウンド事前生成失敗'
                    : 'NEXT ROUND PREFETCH FAILED',
            message: formatPrefetchFailureMessage(debugAiGenerationProgress.error),
            buttonLabel: lang === 'zh'
                ? '立即重试'
                : lang === 'ja'
                    ? '今すぐ再試行'
                    : 'RETRY NOW'
        }
        : null;
    const debugRoundSpoiler = useMemo<DebugRoundSpoilerData>(() => {
        const activeBlueprint = remoteRoundPackage?.blueprint || remoteRoundBlueprint;
        const inventoryNames = Array.from(evidenceMap.keys());
        const usedEvidenceNames = Array.from(usedEvidenceSet.values());

        if (!activeBlueprint) {
            return {
                available: false,
                inventoryNames,
                usedEvidenceNames,
                entries: [],
                remainingRealWeakPointIds: [],
                grantedEvidencePool: []
            };
        }

        const visibleWeakPointIds = new Set<string>();
        activeBlueprint.dialogueSequence.forEach(line => {
            const matches = line.text.matchAll(/\[\[([A-Za-z0-9_-]+)::/g);
            for (const match of matches) {
                if (match[1]) {
                    visibleWeakPointIds.add(match[1]);
                }
            }
        });

        const inspectedIds = inspectedWeakPointIdsByTurn.get(activeBlueprint.turnIndex) ?? new Set<string>();
        const resolvedIds = resolvedWeakPointIdsByTurn.get(activeBlueprint.turnIndex) ?? new Set<string>();
        const currentlyHeldNames = new Set(inventoryNames.map(normalizeEvidenceName));
        const obtainedNames = new Set([...inventoryNames, ...usedEvidenceNames].map(normalizeEvidenceName));
        const discoverableNames = new Set(
            activeBlueprint.weakPoints.flatMap(item =>
                item.grantsEvidences.map(evidence => normalizeEvidenceName(evidence.name))
            )
        );

        const entries = activeBlueprint.weakPoints.map<DebugRoundSpoilerEntry>(item => {
            const resolved = resolvedIds.has(item.id) || resolvedStatementsMap.has(normalizeText(item.statement));
            const revealed = item.kind !== 'hidden' || visibleWeakPointIds.has(item.id) || resolved;
            const normalizedExpectedEvidenceName = item.expectedEvidenceName
                ? normalizeEvidenceName(item.expectedEvidenceName)
                : null;
            const expectedEvidenceState = normalizedExpectedEvidenceName
                ? currentlyHeldNames.has(normalizedExpectedEvidenceName)
                    ? 'held'
                    : obtainedNames.has(normalizedExpectedEvidenceName)
                        ? 'consumed'
                        : discoverableNames.has(normalizedExpectedEvidenceName)
                            ? 'discoverable'
                            : 'missing'
                : undefined;
            return {
                id: item.id,
                statement: item.statement,
                kind: item.kind,
                expectedEvidenceName: item.expectedEvidenceName,
                expectedEvidenceState,
                canInspect: item.kind === 'inspect',
                inspected: inspectedIds.has(item.id),
                revealed,
                resolved,
                grantedEvidences: item.grantsEvidences.map(evidence => {
                    const normalizedName = normalizeEvidenceName(evidence.name);
                    return {
                        name: evidence.name,
                        obtained: obtainedNames.has(normalizedName),
                        currentlyHeld: currentlyHeldNames.has(normalizedName)
                    };
                })
            };
        });

        const grantedEvidencePool = activeBlueprint.weakPoints.flatMap(item =>
            item.grantsEvidences.map(evidence => {
                const normalizedName = normalizeEvidenceName(evidence.name);
                return {
                    name: evidence.name,
                    sourceWeakPointId: item.id,
                    sourceKind: item.kind,
                    obtained: obtainedNames.has(normalizedName),
                    currentlyHeld: currentlyHeldNames.has(normalizedName)
                };
            })
        ).filter((entry, index, array) =>
            array.findIndex(candidate =>
                candidate.name === entry.name && candidate.sourceWeakPointId === entry.sourceWeakPointId
            ) === index
        );

        return {
            available: true,
            roundIndex: activeBlueprint.turnIndex,
            isFinalRound: activeBlueprint.isFinalRound,
            inventoryNames,
            usedEvidenceNames,
            entries,
            remainingRealWeakPointIds: entries
                .filter(entry => (entry.kind === 'real' || entry.kind === 'hidden') && !entry.resolved)
                .map(entry => entry.id),
            grantedEvidencePool
        };
    }, [
        evidenceMap,
        inspectedWeakPointIdsByTurn,
        remoteRoundBlueprint,
        remoteRoundPackage,
        resolvedStatementsMap,
        resolvedWeakPointIdsByTurn,
        usedEvidenceSet
    ]);
    const activeCombatTurnIndex = useMemo(() => {
        if (activeEnemyLog?.roundIndex) {
            return activeEnemyLog.roundIndex;
        }
        if (gameState.phase === 'battle_intro' || gameState.phase === 'playing') {
            return remoteRoundPackage?.blueprint.turnIndex || remoteRoundBlueprint?.turnIndex;
        }
        return undefined;
    }, [
        activeEnemyLog?.roundIndex,
        gameState.phase,
        remoteRoundBlueprint?.turnIndex,
        remoteRoundPackage?.blueprint.turnIndex
    ]);
    const activeResolvedWeakPointIds = useMemo(
        () => activeCombatTurnIndex
            ? new Set(resolvedWeakPointIdsByTurn.get(activeCombatTurnIndex) ?? [])
            : new Set<string>(),
        [activeCombatTurnIndex, resolvedWeakPointIdsByTurn]
    );
    const activeInspectedWeakPointIds = useMemo(
        () => activeCombatTurnIndex
            ? new Set(inspectedWeakPointIdsByTurn.get(activeCombatTurnIndex) ?? [])
            : new Set<string>(),
        [activeCombatTurnIndex, inspectedWeakPointIdsByTurn]
    );
    const debugRecoveryStatus = {
        hasTurnCheckpoint: Boolean(currentTurnCheckpointRef.current),
        turnCheckpointTurnIndex: currentTurnCheckpointRef.current?.turnIndex ?? null,
        hasCaseCheckpoint: Boolean(caseStartCheckpointRef.current),
        caseCheckpointTurnIndex: caseStartCheckpointRef.current?.turnIndex ?? null,
        compiledTurnCount: compiledAiCaseDraft?.generatedTurnCount ?? 0,
        totalTurnCount: !isLocalMode && sessionDisplay ? AI_TOTAL_TURNS : null,
        prefetchStatus: remoteRoundPrefetchRef.current
            ? (remoteRoundPrefetchRef.current.package ? 'ready' : remoteRoundPrefetchRef.current.promise ? 'working' : 'idle')
            : 'idle',
        prefetchTargetTurnIndex: remoteRoundPrefetchRef.current?.targetTurnIndex ?? null,
        cacheRetentionMode: !isLocalMode && sessionDisplay ? 'preserved' as const : 'fresh_only' as const
    };
    const restartText = restartUiText[lang];
    const canRetryCurrentTurn = Boolean(currentTurnCheckpointRef.current);
    const canRestartCurrentCase = Boolean(caseStartCheckpointRef.current);
    const showNewGameAction = !isLocalMode && Boolean(sessionDisplay);
    const menuRestartOptions: RestartActionOption[] = [
        {
            key: 'retry_turn',
            label: restartText.retryTurn,
            description: restartText.retryTurnDesc,
            disabled: !canRetryCurrentTurn
        },
        {
            key: 'restart_case',
            label: restartText.restartCase,
            description: restartText.restartCaseDesc,
            disabled: !canRestartCurrentCase
        },
        ...(
            showNewGameAction
                ? [{
                    key: 'new_game' as RestartActionType,
                    label: restartText.newGame,
                    description: restartText.newGameDesc
                }]
                : []
        ),
        {
            key: 'cancel',
            label: restartText.cancel,
            description: restartText.cancelDesc
        }
    ];
    const endScreenActions: Array<{
        key: string;
        label: string;
        description: string;
        onClick: () => void;
        disabled?: boolean;
    }> = gameResult?.victory
        ? [
            {
                key: 'restart_case',
                label: restartText.restartCase,
                description: restartText.restartCaseDesc,
                onClick: handleRestartCurrentCase,
                disabled: !canRestartCurrentCase
            },
            ...(
                showNewGameAction
                    ? [{
                        key: 'new_game',
                        label: restartText.newGame,
                        description: restartText.newGameDesc,
                        onClick: handleStartFreshGame
                    }]
                    : []
            ),
            {
                key: 'home',
                label: restartText.home,
                description: restartText.homeDesc,
                onClick: handleHome
            }
        ]
        : [
            {
                key: 'retry_turn',
                label: restartText.retryTurn,
                description: restartText.retryTurnDesc,
                onClick: handleRetryCurrentTurn,
                disabled: !canRetryCurrentTurn
            },
            {
                key: 'restart_case',
                label: restartText.restartCase,
                description: restartText.restartCaseDesc,
                onClick: handleRestartCurrentCase,
                disabled: !canRestartCurrentCase
            },
            ...(
                showNewGameAction
                    ? [{
                        key: 'new_game',
                        label: restartText.newGame,
                        description: restartText.newGameDesc,
                        onClick: handleStartFreshGame
                    }]
                    : []
            ),
            {
                key: 'home',
                label: restartText.home,
                description: restartText.homeDesc,
                onClick: handleHome
            }
        ];

    return (
        <>
            <audio ref={audioRef} src="audio/bgm.mp3" loop preload="auto" />
            
            <TopButtons 
                screen={screen}
                gamePhase={gameState.phase}
                onHome={handleHome}
                onRestart={handleOpenRestartPrompt} 
                isMuted={isMuted} 
                onToggleMute={toggleMute} 
            />

            <Tooltip tooltip={tooltip} />

            {!isDevConsoleOpen && (
                <div id="dev-trigger" onClick={handleDevPrompt}>!</div>
            )}

            <DevConsole 
                isOpen={isDevConsoleOpen} 
                lang={lang} 
                logs={devLogs}
                roundSpoiler={debugRoundSpoiler}
                aiProgress={debugAiGenerationProgress}
                recovery={debugRecoveryStatus}
                onClose={() => setIsDevConsoleOpen(false)} 
                onClear={() => setDevLogs([])} 
                onDownload={handleDownloadDevLog} 
            />

            {restartPromptContext === 'menu' && (
                <div className="restart-prompt-overlay" onClick={handleCloseRestartPrompt}>
                    <div className="restart-prompt-card" onClick={event => event.stopPropagation()}>
                        <div className="restart-prompt-title">{restartText.menuTitle}</div>
                        <div className="restart-prompt-subtitle">{restartText.menuSubtitle}</div>
                        <div className="restart-prompt-actions">
                            {menuRestartOptions.map(option => {
                                const onClick =
                                    option.key === 'retry_turn'
                                        ? handleRetryCurrentTurn
                                        : option.key === 'restart_case'
                                            ? handleRestartCurrentCase
                                            : option.key === 'new_game'
                                                ? handleStartFreshGame
                                                : handleCloseRestartPrompt;
                                return (
                                    <button
                                        key={option.key}
                                        className="restart-prompt-action"
                                        onClick={onClick}
                                        disabled={option.disabled}
                                    >
                                        <span className="restart-prompt-action-label">{option.label}</span>
                                        <span className="restart-prompt-action-description">{option.description}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {screen === 'start' && <StartScreen onSelectLanguage={handleSelectLanguage} />}
            {screen === 'config' && (
                <ConfigScreen
                    lang={lang}
                    availableModels={availableModels}
                    localCases={localCases}
                    portraitPacks={portraitPacks}
                    backgroundPacks={backgroundPacks}
                    localWorkspaceInfo={localWorkspaceInfo}
                    onConnect={handleConnect}
                    onLinkLocalWorkspace={handleLinkLocalWorkspace}
                    onRefreshLocalCases={refreshLocalCases}
                />
            )}
            {screen === 'game' && (
                <>
                    {gameState.phase === 'idle' && (
                        <RetroBootScreen
                            onComplete={handleBootComplete}
                            bootLines={bootLines}
                            panelTitle={bootPanelStatus?.title}
                            panelStage={bootPanelStatus?.stage}
                            panelStatus={bootPanelStatus?.status}
                            panelAttempt={bootPanelStatus?.attempt}
                            panelMaxAttempts={bootPanelStatus?.maxAttempts}
                            panelError={bootPanelStatus?.error}
                            onRetry={bootPanelStatus?.status === 'error' ? handleRetryGeneration : undefined}
                            onCancel={bootPanelStatus?.status === 'error' ? handleCancelGeneration : undefined}
                            showFlightToy={sessionDisplay?.mode === 'remote'}
                        />
                    )}
                    {(gameState.phase === 'intro_narrative') && introData && (
                        <IntroScreen
                            phase={gameState.phase}
                            narrative={introData.narrative}
                            evidences={introData.evidences}
                            collectedEvidences={new Set(evidenceMap.keys())}
                            onContinue={handleIntroContinue}
                            onCollect={handleCollectEvidence}
                            showTooltip={(e, content) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content, isLogicBreak: false })}
                            hideTooltip={() => setTooltip(prev => ({ ...prev, visible: false }))}
                            lang={lang}
                        />
                    )}
                    {(gameState.phase === 'battle_intro' || gameState.phase === 'playing') && (
                        <>
                        <GameScreen
                            gameState={gameState}
                            lang={lang}
                            logs={logs}
                            activeEnemyLog={activeEnemyLog}
                            openingRoundIntro={activeRoundIntro}
                            focusDialogue={focusDialogue ? { lines: focusDialogue.lines, index: focusDialogue.index } : null}
                            scene={gameState.scene}
                            castSelection={gameState.castSelection}
                            evidenceMap={evidenceMap}
                            usedEvidenceSet={usedEvidenceSet}
                            resolvedStatementsMap={resolvedStatementsMap}
                            activeResolvedWeakPointIds={activeResolvedWeakPointIds}
                            activeInspectedWeakPointIds={activeInspectedWeakPointIds}
                            isLoading={isLoading}
                            loadPanelStatus={runtimeLoadPanelStatus}
                            prefetchNotice={runtimePrefetchNotice}
                            onRetryPrefetch={handleRetryNextRoundPrefetch}
                            onRetryLoad={handleRetryGeneration}
                            onCancelLoad={handleCancelGeneration}
                            onAdvanceFocusDialogue={handleAdvanceFocusDialogue}
                            onSend={(text) => handlePlayerAction(undefined, text)}
                            onCollectEvidence={handleCollectEvidence}
                            onUseEvidence={handleUseEvidence}
                            onInspectWeakPoint={handleInspectWeakPoint}
                            onOpeningRoundIntroComplete={handleRoundIntroComplete}
                    canInspectWeakPoints={isLocalMode || Boolean(remoteRoundPackage)}
                            showTooltip={(e, content, isLogicBreak = false) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content, isLogicBreak })}
                    hideTooltip={() => setTooltip(prev => ({ ...prev, visible: false }))}
                />
                            {gameState.phase === 'playing' && evidenceReward && (
                                <EvidenceRewardScreen
                                    lang={lang}
                                    evidences={evidenceReward.evidences}
                                    onContinue={handleContinueEvidenceReward}
                                    showTooltip={(e, content) => setTooltip({ visible: true, x: e.clientX, y: e.clientY, content, isLogicBreak: false })}
                                    hideTooltip={() => setTooltip(prev => ({ ...prev, visible: false }))}
                                />
                            )}
                        </>
                    )}
                    {gameState.phase === 'game_over' && (
                        <EndScreen
                            lang={lang}
                            victory={gameResult?.victory ?? false}
                            summary={gameResult?.summary || (lang === 'zh' ? '\u5ba1\u5224\u5df2\u7ed3\u675f\u3002' : lang === 'ja' ? '\u5be9\u5224\u306f\u7d42\u4e86\u3057\u307e\u3057\u305f\u3002' : 'The trial has ended.')}
                            actions={endScreenActions}
                            canSaveAiCase={
                                !isLocalMode
                                && Boolean(compiledAiCaseDraft)
                                && compiledAiCaseDraft.generatedTurnCount >= AI_TOTAL_TURNS
                            }
                            onSaveAiCase={handleSaveCompiledAiCase}
                            saveAiCaseState={compiledAiCaseSaveState}
                            saveAiCaseMessage={compiledAiCaseSaveMessage}
                        />
                    )}
                </>
            )}
        </>
    );
}


