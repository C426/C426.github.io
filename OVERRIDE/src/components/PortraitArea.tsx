import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Language, LogEntry, RoundIntroMode, RoundIntroRequest } from '../types';
import { splitSentencesSafe } from '../utils/textUtils';
import { PortraitMotion, PortraitState, RuntimeSceneState } from '../services/sceneAssetTypes';
import { ScenePortrait } from './ScenePortrait';

interface PortraitAreaProps {
    lang: Language;
    scene: RuntimeSceneState;
    latestEnemyLog: LogEntry | undefined;
    resolvedWeakPointIds?: Set<string>;
    inspectedWeakPointIds?: Set<string>;
    forcedRoundIntro?: RoundIntroRequest | null;
    onForcedRoundIntroComplete?: () => void;
    selectedEvidence: string | null;
    onObjection: (stmt: string, weakPointId?: string) => void;
    onInspect?: (stmt: string, weakPointId?: string) => void;
    paused?: boolean;
}

type PopupKind = 'dialogue' | 'jammer';

interface PopupData {
    id: string;
    kind: PopupKind;
    text: string;
    weakPointIds: string[];
    x: number;
    y: number;
    timestamp: number;
    driftX: number;
    driftY: number;
    driftDurationX: number;
    driftDurationY: number;
    driftDelay: number;
}

interface DialogueCue {
    text: string;
    weakPointIds: string[];
    portraitState: PortraitState;
    portraitMotion: PortraitMotion;
}

const DEFAULT_JAMMER_LINES = [
    'SIGNAL JAMMED // NOISE LAYER ACTIVE',
    'ERR: VISUAL STACK OVERFLOW',
    'MASK THREAD INJECTED',
    'TARGET LOCK INTERRUPTED'
];

const DIALOGUE_PORTRAIT_STATE_CYCLE: PortraitState[] = [
    'neutral_idle',
    'serious_focus',
    'defensive_frown',
    'smug_tilt',
    'thinking_hand_to_chin',
    'surprise_small',
    'angry_attack'
];

const DIALOGUE_PORTRAIT_MOTION_CYCLE: PortraitMotion[] = [
    'none',
    'pop',
    'none',
    'shake_small',
    'none',
    'bounce',
    'none'
];

const ROUND_INTRO_DURATION_MS = 3180;
const OPENING_INTRO_DURATION_MS = 4080;
const DIALOGUE_POPUP_INTERVAL_MS = 2300;
const DIALOGUE_POPUP_LIFETIME_MS = 10000;

const formatRoundIntro = (lang: Language, roundIndex?: number) => {
    if (lang === 'ja') {
        return {
            kicker: roundIndex ? `ROUND ${roundIndex}` : 'NONSTOP DEBATE',
            title: roundIndex ? `第${roundIndex}ラウンド 開始` : '弁論開始'
        };
    }

    if (lang === 'en') {
        return {
            kicker: roundIndex ? `ROUND ${roundIndex}` : 'NONSTOP DEBATE',
            title: roundIndex ? `ROUND ${roundIndex} START` : 'DEBATE START'
        };
    }

    return {
        kicker: roundIndex ? `ROUND ${roundIndex}` : 'NONSTOP DEBATE',
        title: roundIndex ? `第 ${roundIndex} 轮 辩论开始` : '辩论开始'
    };
};

const formatRoundBadge = (lang: Language, roundIndex?: number) => {
    if (!roundIndex) {
        return lang === 'ja'
            ? 'DEBATE LOOP'
            : lang === 'en'
                ? 'DEBATE LOOP'
                : '辩论循环';
    }

    if (lang === 'ja') {
        return `第${roundIndex}ラウンド`;
    }

    if (lang === 'en') {
        return `ROUND ${roundIndex}`;
    }

    return `第 ${roundIndex} 轮`;
};

const formatRoundIntroDisplay = (lang: Language, roundIndex: number | undefined, mode: RoundIntroMode) => {
    const kicker = mode === 'opening'
        ? 'GAME START'
        : roundIndex
            ? `ROUND ${roundIndex}`
            : 'NONSTOP DEBATE';

    if (lang === 'ja') {
        return {
            kicker,
            title: roundIndex ? `ROUND ${roundIndex} START` : 'DEBATE START'
        };
    }

    if (lang === 'en') {
        return {
            kicker,
            title: roundIndex ? `ROUND ${roundIndex} START` : 'DEBATE START'
        };
    }

    return {
        kicker,
        title: roundIndex ? `第${roundIndex}轮 辩论开始` : '辩论开始'
    };
};

const createRoundToken = (roundIndex?: number) => roundIndex ? `round-${roundIndex}` : 'generic-debate';
const extractWeakPointIdsFromText = (text: string) =>
    Array.from(text.matchAll(/\[\[([A-Za-z0-9_-]+)::/g))
        .map(match => match[1]?.trim())
        .filter((value): value is string => Boolean(value));

const isResolvedDialogueCue = (cue: DialogueCue, resolvedWeakPointIds: Set<string>) =>
    cue.weakPointIds.length > 0 && cue.weakPointIds.every(id => resolvedWeakPointIds.has(id));

const isResolvedPopup = (popup: PopupData, resolvedWeakPointIds: Set<string>) =>
    popup.kind === 'dialogue'
    && popup.weakPointIds.length > 0
    && popup.weakPointIds.every(id => resolvedWeakPointIds.has(id));

const isInspectedDialogueCue = (cue: DialogueCue, inspectedWeakPointIds: Set<string>) =>
    cue.weakPointIds.length > 0 && cue.weakPointIds.every(id => inspectedWeakPointIds.has(id));

const isInspectedPopup = (popup: PopupData, inspectedWeakPointIds: Set<string>) =>
    popup.kind === 'dialogue'
    && popup.weakPointIds.length > 0
    && popup.weakPointIds.every(id => inspectedWeakPointIds.has(id));

const filterResolvedDialogueCues = (queue: DialogueCue[], resolvedWeakPointIds: Set<string>) =>
    queue.filter(cue => !isResolvedDialogueCue(cue, resolvedWeakPointIds));

const filterInactiveDialogueCues = (
    queue: DialogueCue[],
    resolvedWeakPointIds: Set<string>,
    inspectedWeakPointIds: Set<string>
) => queue.filter(cue =>
    !isResolvedDialogueCue(cue, resolvedWeakPointIds)
    && !isInspectedDialogueCue(cue, inspectedWeakPointIds)
);

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min);
const randomSigned = (min: number, max: number) => (Math.random() < 0.5 ? -1 : 1) * randomBetween(min, max);

const createPopupDrift = (kind: PopupKind) => {
    if (kind === 'jammer') {
        return {
            driftX: randomSigned(5, 10),
            driftY: randomSigned(4, 8),
            driftDurationX: randomBetween(2800, 4200),
            driftDurationY: randomBetween(2200, 3600),
            driftDelay: randomBetween(-900, -120)
        };
    }

    return {
        driftX: randomSigned(8, 16),
        driftY: randomSigned(6, 12),
        driftDurationX: randomBetween(6200, 9800),
        driftDurationY: randomBetween(5400, 8400),
        driftDelay: randomBetween(-1400, -160)
    };
};

export const PortraitArea: React.FC<PortraitAreaProps> = ({
    lang,
    scene,
    latestEnemyLog,
    resolvedWeakPointIds = new Set(),
    inspectedWeakPointIds = new Set(),
    forcedRoundIntro = null,
    onForcedRoundIntroComplete,
    selectedEvidence,
    onObjection,
    onInspect,
    paused = false
}) => {
    const initialForcedRoundIntroActive = Boolean(forcedRoundIntro && !paused);
    const [popups, setPopups] = useState<PopupData[]>([]);
    const [dialogueQueue, setDialogueQueue] = useState<DialogueCue[]>([]);
    const [pendingDialogueQueue, setPendingDialogueQueue] = useState<DialogueCue[] | null>(null);
    const [isObjectionMade, setIsObjectionMade] = useState(false);
    const [interferenceActive, setInterferenceActive] = useState(false);
    const [interferenceLines, setInterferenceLines] = useState<string[]>(DEFAULT_JAMMER_LINES);
    const [activePortraitState, setActivePortraitState] = useState<PortraitState>(scene.enemyPortraitState);
    const [activePortraitMotion, setActivePortraitMotion] = useState<PortraitMotion>(scene.enemyPortraitMotion);
    const [isMouthOpen, setIsMouthOpen] = useState(false);
    const [roundIntroVisible, setRoundIntroVisible] = useState(initialForcedRoundIntroActive);
    const [roundIntroKey, setRoundIntroKey] = useState(initialForcedRoundIntroActive ? 1 : 0);
    const [roundIntroMode, setRoundIntroMode] = useState<RoundIntroMode>(forcedRoundIntro?.mode ?? 'round');
    const [roundIntroDurationMs, setRoundIntroDurationMs] = useState(
        forcedRoundIntro?.mode === 'opening' ? OPENING_INTRO_DURATION_MS : ROUND_INTRO_DURATION_MS
    );
    const [currentRoundIndex, setCurrentRoundIndex] = useState<number | undefined>(
        forcedRoundIntro?.roundIndex ?? latestEnemyLog?.roundIndex
    );
    const [activeDialogueIndex, setActiveDialogueIndex] = useState(-1);

    const sentenceIndexRef = useRef(0);
    const jammerIndexRef = useRef(0);
    const jammerCooldownUntilRef = useRef(0);
    const lastAnnouncedRoundTokenRef = useRef<string | null>(null);
    const hasLoopedDialogueRef = useRef(false);
    const progressRootRef = useRef<HTMLDivElement | null>(null);
    const progressAnimationFrameRef = useRef<number | null>(null);
    const activeDialogueStartedAtRef = useRef<number | null>(null);
    const activeForcedRoundIntroTokenRef = useRef<string | null>(null);
    const seenForcedRoundIntroTokenRef = useRef<string | null>(null);

    const hasActiveJammer = useMemo(
        () => popups.some(popup => popup.kind === 'jammer'),
        [popups]
    );
    const hasDialoguePopup = useMemo(
        () => popups.some(popup => popup.kind === 'dialogue'),
        [popups]
    );
    const latestDialoguePopupId = useMemo(() => {
        const dialoguePopups = popups.filter(popup => popup.kind === 'dialogue');
        return dialoguePopups[dialoguePopups.length - 1]?.id || null;
    }, [popups]);
    const roundIntroCopy = useMemo(
        () => formatRoundIntroDisplay(lang, currentRoundIndex, roundIntroMode),
        [currentRoundIndex, lang, roundIntroMode]
    );
    const resolvedWeakPointIdSignature = useMemo(
        () => Array.from(resolvedWeakPointIds).sort().join('|'),
        [resolvedWeakPointIds]
    );
    const inspectedWeakPointIdSignature = useMemo(
        () => Array.from(inspectedWeakPointIds).sort().join('|'),
        [inspectedWeakPointIds]
    );
    const roundLocked = roundIntroVisible;

    const setProgressVisual = (ratio: number) => {
        if (!progressRootRef.current) {
            return;
        }

        const clamped = Math.max(0, Math.min(1, ratio));
        progressRootRef.current.style.setProperty('--round-progress-ratio', clamped.toFixed(4));
    };

    const stopProgressAnimation = () => {
        if (progressAnimationFrameRef.current !== null) {
            window.cancelAnimationFrame(progressAnimationFrameRef.current);
            progressAnimationFrameRef.current = null;
        }
    };

    useLayoutEffect(() => {
        if (!forcedRoundIntro || paused) {
            return;
        }

        if (seenForcedRoundIntroTokenRef.current === forcedRoundIntro.token) {
            return;
        }

        seenForcedRoundIntroTokenRef.current = forcedRoundIntro.token;
        activeForcedRoundIntroTokenRef.current = forcedRoundIntro.token;
        lastAnnouncedRoundTokenRef.current = createRoundToken(forcedRoundIntro.roundIndex);

        stopProgressAnimation();
        setDialogueQueue([]);
        setPendingDialogueQueue(null);
        setPopups([]);
        setIsObjectionMade(false);
        setInterferenceActive(false);
        setInterferenceLines(DEFAULT_JAMMER_LINES);
        setIsMouthOpen(false);
        setActiveDialogueIndex(-1);
        sentenceIndexRef.current = 0;
        jammerIndexRef.current = 0;
        jammerCooldownUntilRef.current = 0;
        hasLoopedDialogueRef.current = false;
        activeDialogueStartedAtRef.current = null;
        setActivePortraitState(scene.enemyPortraitState);
        setActivePortraitMotion(scene.enemyPortraitMotion);
        setCurrentRoundIndex(forcedRoundIntro.roundIndex);
        setRoundIntroMode(forcedRoundIntro.mode);
        setRoundIntroDurationMs(forcedRoundIntro.mode === 'opening' ? OPENING_INTRO_DURATION_MS : ROUND_INTRO_DURATION_MS);
        setRoundIntroKey(prev => prev + 1);
        setRoundIntroVisible(true);
        setProgressVisual(0);
    }, [forcedRoundIntro, paused, scene.enemyPortraitMotion, scene.enemyPortraitState]);

    useEffect(() => {
        if (paused) {
            stopProgressAnimation();
            setPopups([]);
            setDialogueQueue([]);
            setPendingDialogueQueue(null);
            setInterferenceActive(false);
            setInterferenceLines(DEFAULT_JAMMER_LINES);
            setActivePortraitState(scene.enemyPortraitState);
            setActivePortraitMotion(scene.enemyPortraitMotion);
            setIsMouthOpen(false);
            setRoundIntroVisible(false);
            setRoundIntroMode('round');
            setRoundIntroDurationMs(ROUND_INTRO_DURATION_MS);
            setCurrentRoundIndex(undefined);
            setActiveDialogueIndex(-1);
            activeDialogueStartedAtRef.current = null;
            activeForcedRoundIntroTokenRef.current = null;
            seenForcedRoundIntroTokenRef.current = null;
            hasLoopedDialogueRef.current = false;
            setProgressVisual(0);
            return;
        }

        if (!latestEnemyLog || !latestEnemyLog.text) return;

        const fromCycle = (index: number) => ({
            portraitState: DIALOGUE_PORTRAIT_STATE_CYCLE[index % DIALOGUE_PORTRAIT_STATE_CYCLE.length] || scene.enemyPortraitState,
            portraitMotion: DIALOGUE_PORTRAIT_MOTION_CYCLE[index % DIALOGUE_PORTRAIT_MOTION_CYCLE.length] || scene.enemyPortraitMotion || 'none'
        });
        const fromExplicitSequence = (latestEnemyLog.dialogueSequence || [])
            .filter(item => Boolean(item?.text?.trim()))
            .map((item, index): DialogueCue => {
                const cycle = fromCycle(index);
                return {
                    text: item.text,
                    weakPointIds: extractWeakPointIdsFromText(item.text),
                    portraitState: item.enemyPortraitState || cycle.portraitState,
                    portraitMotion: item.enemyPortraitMotion || cycle.portraitMotion
                };
            });
        const parsedQueue: DialogueCue[] = fromExplicitSequence.length > 0
            ? fromExplicitSequence
            : splitSentencesSafe(latestEnemyLog.text)
                .filter(sentence => sentence.trim().length > 0)
                .map((sentence, index): DialogueCue => {
                    const cycle = fromCycle(index);
                    return {
                        text: sentence,
                        weakPointIds: extractWeakPointIdsFromText(sentence),
                        portraitState: cycle.portraitState,
                        portraitMotion: cycle.portraitMotion
                    };
                });
        const filteredQueue = filterInactiveDialogueCues(parsedQueue, resolvedWeakPointIds, inspectedWeakPointIds);

        setDialogueQueue([]);
        setPendingDialogueQueue(null);
        setPopups([]);
        setIsObjectionMade(false);
        setIsMouthOpen(false);
        setActiveDialogueIndex(-1);
        sentenceIndexRef.current = 0;
        jammerIndexRef.current = 0;
        jammerCooldownUntilRef.current = 0;
        hasLoopedDialogueRef.current = false;
        activeDialogueStartedAtRef.current = null;
        setActivePortraitState(filteredQueue[0]?.portraitState || scene.enemyPortraitState);
        setActivePortraitMotion(filteredQueue[0]?.portraitMotion || scene.enemyPortraitMotion);
        setCurrentRoundIndex(latestEnemyLog.roundIndex);
        stopProgressAnimation();
        setProgressVisual(0);

        const nextRoundToken = createRoundToken(latestEnemyLog.roundIndex);
        const previousRoundToken = lastAnnouncedRoundTokenRef.current;
        const hasLockedForcedIntro = activeForcedRoundIntroTokenRef.current !== null;
        if (previousRoundToken !== nextRoundToken) {
            const isOpeningIntro = previousRoundToken === null;
            lastAnnouncedRoundTokenRef.current = nextRoundToken;
            setPendingDialogueQueue(filteredQueue);
            setRoundIntroMode(isOpeningIntro ? 'opening' : 'round');
            setRoundIntroDurationMs(isOpeningIntro ? OPENING_INTRO_DURATION_MS : ROUND_INTRO_DURATION_MS);
            setRoundIntroKey(prev => prev + 1);
            setRoundIntroVisible(true);
        } else if (hasLockedForcedIntro) {
            setPendingDialogueQueue(filteredQueue);
        } else {
            setDialogueQueue(filteredQueue);
            setRoundIntroVisible(false);
        }

        setInterferenceActive(Boolean(latestEnemyLog.popupInterference));
        if (latestEnemyLog.interferenceLines && latestEnemyLog.interferenceLines.length > 0) {
            setInterferenceLines(latestEnemyLog.interferenceLines);
        } else {
            setInterferenceLines(DEFAULT_JAMMER_LINES);
        }
    }, [
        inspectedWeakPointIdSignature,
        inspectedWeakPointIds,
        latestEnemyLog,
        paused,
        resolvedWeakPointIdSignature,
        resolvedWeakPointIds,
        scene.enemyPortraitMotion,
        scene.enemyPortraitState
    ]);

    useEffect(() => {
        if (resolvedWeakPointIds.size === 0 && inspectedWeakPointIds.size === 0) {
            return;
        }

        const nextDialogueQueue = filterInactiveDialogueCues(dialogueQueue, resolvedWeakPointIds, inspectedWeakPointIds);
        if (nextDialogueQueue.length !== dialogueQueue.length) {
            setDialogueQueue(nextDialogueQueue);
            if (nextDialogueQueue.length === 0) {
                setActiveDialogueIndex(-1);
                activeDialogueStartedAtRef.current = null;
                stopProgressAnimation();
                setProgressVisual(0);
            } else {
                sentenceIndexRef.current %= nextDialogueQueue.length;
                if (activeDialogueIndex >= nextDialogueQueue.length) {
                    setActiveDialogueIndex(nextDialogueQueue.length - 1);
                }
            }
        }

        if (pendingDialogueQueue) {
            const nextPendingDialogueQueue = filterInactiveDialogueCues(
                pendingDialogueQueue,
                resolvedWeakPointIds,
                inspectedWeakPointIds
            );
            if (nextPendingDialogueQueue.length !== pendingDialogueQueue.length) {
                setPendingDialogueQueue(nextPendingDialogueQueue);
            }
        }

        const nextPopups = popups.filter(popup =>
            !isResolvedPopup(popup, resolvedWeakPointIds)
            && !isInspectedPopup(popup, inspectedWeakPointIds)
        );
        if (nextPopups.length !== popups.length) {
            setPopups(nextPopups);
        }
    }, [
        activeDialogueIndex,
        dialogueQueue,
        inspectedWeakPointIdSignature,
        inspectedWeakPointIds,
        pendingDialogueQueue,
        popups,
        resolvedWeakPointIdSignature,
        resolvedWeakPointIds
    ]);

    useEffect(() => {
        if (!roundIntroVisible || paused) {
            return;
        }

        const forcedIntroToken = activeForcedRoundIntroTokenRef.current;
        const introTimeout = window.setTimeout(() => {
            setRoundIntroVisible(false);
            if (forcedIntroToken && activeForcedRoundIntroTokenRef.current === forcedIntroToken) {
                activeForcedRoundIntroTokenRef.current = null;
                onForcedRoundIntroComplete?.();
            }
        }, roundIntroDurationMs);

        return () => window.clearTimeout(introTimeout);
    }, [onForcedRoundIntroComplete, paused, roundIntroDurationMs, roundIntroKey, roundIntroVisible]);

    useEffect(() => {
        if (paused || roundLocked || pendingDialogueQueue === null) {
            return;
        }

        setDialogueQueue(pendingDialogueQueue);
        setPendingDialogueQueue(null);
    }, [paused, pendingDialogueQueue, roundLocked]);

    useEffect(() => {
        if (paused || roundLocked || dialogueQueue.length === 0 || isObjectionMade) return;

        const showNextDialoguePopup = () => {
            const currentIndex = sentenceIndexRef.current;
            const cue = dialogueQueue[sentenceIndexRef.current];
            if (!cue || !cue.text || !cue.text.trim()) {
                sentenceIndexRef.current = (sentenceIndexRef.current + 1) % dialogueQueue.length;
                return;
            }

            if (currentIndex === 0 && hasLoopedDialogueRef.current) {
                setProgressVisual(0);
            }

            activeDialogueStartedAtRef.current = performance.now();
            setProgressVisual(currentIndex / dialogueQueue.length);

            const popup: PopupData = {
                id: `dlg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                kind: 'dialogue',
                text: cue.text,
                weakPointIds: cue.weakPointIds,
                x: 5 + Math.random() * 50,
                y: 5 + Math.random() * 50,
                timestamp: Date.now(),
                ...createPopupDrift('dialogue')
            };

            setPopups(prev => {
                const dialogue = prev.filter(item => item.kind === 'dialogue');
                const jammer = prev.filter(item => item.kind === 'jammer');
                const nextDialogue = [...dialogue, popup].slice(-8);
                return [...nextDialogue, ...jammer];
            });

            setActivePortraitState(cue.portraitState || scene.enemyPortraitState);
            setActivePortraitMotion(cue.portraitMotion || scene.enemyPortraitMotion);
            setActiveDialogueIndex(currentIndex);
            hasLoopedDialogueRef.current = true;
            sentenceIndexRef.current = (sentenceIndexRef.current + 1) % dialogueQueue.length;
        };

        showNextDialoguePopup();
        const interval = setInterval(showNextDialoguePopup, DIALOGUE_POPUP_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [dialogueQueue, isObjectionMade, paused, roundLocked, scene.enemyPortraitMotion, scene.enemyPortraitState]);

    useEffect(() => {
        stopProgressAnimation();

        if (paused || roundLocked || dialogueQueue.length === 0 || isObjectionMade || activeDialogueIndex < 0) {
            if (dialogueQueue.length === 0 || activeDialogueIndex < 0 || paused || roundLocked || isObjectionMade) {
                setProgressVisual(0);
            }
            return;
        }

        const animate = () => {
            const startedAt = activeDialogueStartedAtRef.current ?? performance.now();
            const elapsed = Math.max(0, performance.now() - startedAt);
            const sentenceProgress = Math.min(1, elapsed / DIALOGUE_POPUP_INTERVAL_MS);
            setProgressVisual((activeDialogueIndex + sentenceProgress) / dialogueQueue.length);
            progressAnimationFrameRef.current = window.requestAnimationFrame(animate);
        };

        animate();
        return stopProgressAnimation;
    }, [activeDialogueIndex, dialogueQueue.length, isObjectionMade, paused, roundLocked]);

    useEffect(() => {
        if (paused || roundLocked || !interferenceActive || isObjectionMade) return;

        const showJammerPopup = () => {
            const now = Date.now();
            if (now < jammerCooldownUntilRef.current) return;

            const line = interferenceLines[jammerIndexRef.current % interferenceLines.length] || DEFAULT_JAMMER_LINES[0];
            jammerIndexRef.current += 1;

            const popup: PopupData = {
                id: `jam-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                kind: 'jammer',
                text: line,
                weakPointIds: [],
                x: 22 + Math.random() * 46,
                y: 18 + Math.random() * 42,
                timestamp: Date.now(),
                ...createPopupDrift('jammer')
            };

            setPopups(prev => {
                const dialogue = prev.filter(item => item.kind === 'dialogue');
                const existingJammer = prev.filter(item => item.kind === 'jammer');
                if (existingJammer.length >= 2) {
                    return prev;
                }
                const jammer = [...existingJammer, popup];
                return [...dialogue, ...jammer];
            });
        };

        showJammerPopup();
        const interval = setInterval(showJammerPopup, 2100);
        return () => clearInterval(interval);
    }, [paused, roundLocked, interferenceActive, interferenceLines, isObjectionMade]);

    useEffect(() => () => {
        stopProgressAnimation();
    }, []);

    useEffect(() => {
        if (paused || isObjectionMade || !hasDialoguePopup) {
            setIsMouthOpen(false);
            return;
        }

        setIsMouthOpen(true);
        const speakingInterval = setInterval(() => {
            setIsMouthOpen(prev => !prev);
        }, 140);

        return () => clearInterval(speakingInterval);
    }, [hasDialoguePopup, isObjectionMade, paused]);

    useEffect(() => {
        if (hasDialoguePopup) {
            return;
        }
        setActivePortraitState(scene.enemyPortraitState);
        setActivePortraitMotion(scene.enemyPortraitMotion);
    }, [hasDialoguePopup, scene.enemyPortraitMotion, scene.enemyPortraitState]);

    const handleClose = useCallback((id: string) => {
        setPopups(prev => {
            const target = prev.find(popup => popup.id === id);
            const next = prev.filter(popup => popup.id !== id);
            if (target?.kind === 'jammer') {
                const hasRemainingJammer = next.some(popup => popup.kind === 'jammer');
                if (!hasRemainingJammer) {
                    jammerCooldownUntilRef.current = Date.now() + 2600;
                }
            }
            return next;
        });
    }, []);

    const handleObjection = (statement: string, weakPointId?: string) => {
        if (hasActiveJammer) return;
        setIsObjectionMade(true);
        setPopups([]);
        setActiveDialogueIndex(-1);
        activeDialogueStartedAtRef.current = null;
        stopProgressAnimation();
        setProgressVisual(0);
        onObjection(statement, weakPointId);
    };

    return (
        <div className="portrait-area">
            {dialogueQueue.length > 0 && (
                <div
                    ref={progressRootRef}
                    className={[
                        'portrait-round-progress',
                        roundIntroVisible ? 'intro-visible' : ''
                    ].filter(Boolean).join(' ')}
                >
                    <div className="portrait-round-progress-track">
                        <div className="portrait-round-progress-fill" />
                    </div>
                    <div className="portrait-round-progress-meta">
                        <span className="portrait-round-progress-round">{formatRoundBadge(lang, currentRoundIndex)}</span>
                        <span className="portrait-round-progress-count">
                            {activeDialogueIndex >= 0 ? `${activeDialogueIndex + 1}/${dialogueQueue.length}` : `0/${dialogueQueue.length}`}
                        </span>
                    </div>
                </div>
            )}

            {roundIntroVisible && (
                <div
                    key={`round-intro-${roundIntroKey}`}
                    className={[
                        'portrait-round-intro',
                        roundIntroMode === 'opening' ? 'opening' : ''
                    ].filter(Boolean).join(' ')}
                    style={{ ['--round-intro-anim-duration' as '--round-intro-anim-duration']: `${roundIntroDurationMs}ms` }}
                >
                    <div className="portrait-round-intro-copy">
                        <div className="portrait-round-intro-kicker">{roundIntroCopy.kicker}</div>
                        <div className="portrait-round-intro-title">{roundIntroCopy.title}</div>
                    </div>
                </div>
            )}

            <div className="portrait-character-layer">
                <ScenePortrait
                    role="enemy"
                    packId={scene.enemyPortraitPackId}
                    state={activePortraitState}
                    motion={activePortraitMotion}
                    speaking={hasDialoguePopup && isMouthOpen}
                    className="portrait-area-character"
                />
            </div>
            {popups.map(popup => (
                <StatementPopup
                    key={popup.id}
                    data={popup}
                    isLatestDialogue={popup.id === latestDialoguePopupId}
                    resolvedWeakPointIds={resolvedWeakPointIds}
                    inspectedWeakPointIds={inspectedWeakPointIds}
                    selectedEvidence={selectedEvidence}
                    jammed={hasActiveJammer}
                    onClose={handleClose}
                    onInspect={onInspect}
                    onObjection={handleObjection}
                />
            ))}
        </div>
    );
};

const StatementPopup: React.FC<{
    data: PopupData;
    isLatestDialogue: boolean;
    resolvedWeakPointIds: Set<string>;
    inspectedWeakPointIds: Set<string>;
    selectedEvidence: string | null;
    jammed: boolean;
    onClose: (id: string) => void;
    onInspect?: (stmt: string, weakPointId?: string) => void;
    onObjection: (stmt: string, weakPointId?: string) => void;
}> = ({ data, isLatestDialogue, resolvedWeakPointIds, inspectedWeakPointIds, selectedEvidence, jammed, onClose, onInspect, onObjection }) => {
    const isJammer = data.kind === 'jammer';
    const displayText = isJammer
        ? data.text
        : data.text.replace(/\[\[(?:([A-Za-z0-9_-]+)::)?([\s\S]*?)\]\]/g, (_match, logicId, text) =>
            logicId && resolvedWeakPointIds.has(logicId)
                ? `<span class="logic-text logic-text-resolved" data-logic-id="${logicId}">${text}</span>`
                : logicId && inspectedWeakPointIds.has(logicId)
                    ? `<span class="logic-text logic-text-inspected" data-logic-id="${logicId}">${text}</span>`
                : `<span class="logic-text" data-logic="${text}" data-logic-id="${logicId || ''}">${text}</span>`
        );

    useEffect(() => {
        if (isJammer) {
            return;
        }

        const remainingLifetimeMs = Math.max(0, DIALOGUE_POPUP_LIFETIME_MS - (Date.now() - data.timestamp));
        const timeout = window.setTimeout(() => {
            onClose(data.id);
        }, remainingLifetimeMs);

        return () => window.clearTimeout(timeout);
    }, [data.id, data.timestamp, isJammer, onClose]);

    const resolveLogicTarget = (target: EventTarget | null, currentTarget: HTMLDivElement) => {
        if (!(target instanceof Node)) {
            return null;
        }

        const targetElement = target instanceof Element ? target : target.parentElement;
        if (!targetElement) {
            return null;
        }

        const logicTarget = targetElement.closest('.logic-text');
        if (!(logicTarget instanceof HTMLElement) || !currentTarget.contains(logicTarget)) {
            return null;
        }

        return logicTarget;
    };

    const handleContentPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (isJammer || jammed) return;
        if (event.button !== 0) {
            return;
        }

        const logicTarget = resolveLogicTarget(event.target, event.currentTarget);
        if (!logicTarget) {
            return;
        }
        if (
            logicTarget.classList.contains('logic-text-resolved')
            || logicTarget.classList.contains('logic-text-inspected')
        ) {
            return;
        }

        event.preventDefault();
        const statement = logicTarget.getAttribute('data-logic');
        const weakPointId = logicTarget.getAttribute('data-logic-id') || undefined;
        if (!statement) return;

        if (selectedEvidence) {
            onObjection(statement, weakPointId);
            return;
        }

        onInspect?.(statement, weakPointId);
    };

    const canInteract = !jammed && !isJammer && (Boolean(selectedEvidence) || Boolean(onInspect));
    const popupStyle = {
        left: `${data.x}%`,
        top: `${data.y}%`,
        ['--popup-drift-x' as const]: `${data.driftX}px`,
        ['--popup-drift-y' as const]: `${data.driftY}px`,
        ['--popup-drift-duration-x' as const]: `${data.driftDurationX}ms`,
        ['--popup-drift-duration-y' as const]: `${data.driftDurationY}ms`,
        ['--popup-drift-delay' as const]: `${data.driftDelay}ms`,
        ['--popup-lifetime-duration' as const]: `${DIALOGUE_POPUP_LIFETIME_MS}ms`
    } as React.CSSProperties;

    return (
        <div
            className={[
                'statement-popup',
                isJammer ? 'jammer' : 'dialogue',
                isLatestDialogue ? 'latest' : ''
            ].filter(Boolean).join(' ')}
            style={popupStyle}
        >
            <div className="statement-popup-drift-x">
                <div className="statement-popup-drift-y">
                    <div className="statement-popup-shell">
                        <div className="statement-popup-header">
                            <span>{isJammer ? 'SYS.NOISE' : 'SYS.DIALOG'}</span>
                            <span className="statement-popup-close" onClick={() => onClose(data.id)}>X</span>
                        </div>
                        <div
                            className={`statement-popup-content ${canInteract ? 'can-interact' : ''}`}
                            dangerouslySetInnerHTML={{ __html: displayText }}
                            onPointerDown={handleContentPointerDown}
                        />
                        {!isJammer && (
                            <div className="statement-popup-life">
                                <div className="statement-popup-life-fill" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
