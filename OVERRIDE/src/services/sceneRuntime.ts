import { AvgDialogueLine, LogEntry } from '../types';
import {
    BackgroundSlot,
    DEFAULT_RUNTIME_SCENE_STATE,
    PortraitState,
    RuntimeSceneState,
    SceneCastSelection,
    SceneCue
} from './sceneAssetTypes';

const pickBackgroundForSpeaker = (speaker: AvgDialogueLine['speaker']): BackgroundSlot => {
    switch (speaker) {
        case 'hero':
            return 'analysis';
        case 'enemy':
            return 'cross_exam';
        default:
            return 'briefing';
    }
};

export const defaultPortraitStateForSpeaker = (
    speaker: AvgDialogueLine['speaker']
): PortraitState => {
    switch (speaker) {
        case 'hero':
            return 'serious_focus';
        case 'enemy':
            return 'neutral_idle';
        default:
            return 'neutral_idle';
    }
};

export const enemyPortraitStateFromAttackType = (
    attackType: string | undefined,
    options?: { victory?: boolean; heroDown?: boolean; grantedEvidence?: boolean }
): PortraitState => {
    if (options?.victory) {
        return 'breakdown_unstable';
    }
    if (options?.heroDown) {
        return 'smug_tilt';
    }
    if (options?.grantedEvidence) {
        return 'surprise_small';
    }

    switch (attackType) {
        case 'strict':
            return 'shock_big';
        case 'fuzzy':
            return 'defensive_frown';
        case 'miss':
            return 'smug_tilt';
        case 'query':
            return 'serious_focus';
        default:
            return 'neutral_idle';
    }
};

export const applySceneCue = (
    base: RuntimeSceneState,
    cue: SceneCue,
    speaker?: AvgDialogueLine['speaker']
) => ({
    ...base,
    backgroundSlot: cue.backgroundSlot || base.backgroundSlot || (speaker ? pickBackgroundForSpeaker(speaker) : 'cross_exam'),
    screenFilter: cue.screenFilter || base.screenFilter,
    screenImpulse: cue.screenImpulse || base.screenImpulse,
    transition: cue.transition || base.transition,
    heroPortraitState: speaker === 'hero'
        ? cue.portraitState || base.heroPortraitState
        : base.heroPortraitState,
    enemyPortraitState: speaker === 'enemy'
        ? cue.portraitState || base.enemyPortraitState
        : base.enemyPortraitState,
    heroPortraitMotion: speaker === 'hero'
        ? cue.portraitMotion || base.heroPortraitMotion
        : base.heroPortraitMotion,
    enemyPortraitMotion: speaker === 'enemy'
        ? cue.portraitMotion || base.enemyPortraitMotion
        : base.enemyPortraitMotion
});

export const buildSceneStateFromLog = (
    castSelection: SceneCastSelection,
    log: LogEntry | null
): RuntimeSceneState => ({
    ...DEFAULT_RUNTIME_SCENE_STATE,
    ...castSelection,
    backgroundPackId: castSelection.backgroundPackId,
    heroPortraitPackId: castSelection.heroPortraitPackId,
    enemyPortraitPackId: castSelection.enemyPortraitPackId,
    backgroundSlot: log?.backgroundSlot || 'cross_exam',
    enemyPortraitState: log?.enemyPortraitState || 'neutral_idle',
    enemyPortraitMotion: log?.enemyPortraitMotion || 'none',
    screenFilter: log?.screenFilter || 'none',
    screenImpulse: log?.screenImpulse || 'none',
    transition: log?.transition || 'cut'
});

export const buildSceneStateFromAvgLine = (
    castSelection: SceneCastSelection,
    line: AvgDialogueLine
): RuntimeSceneState => {
    const base = {
        ...DEFAULT_RUNTIME_SCENE_STATE,
        ...castSelection,
        backgroundPackId: castSelection.backgroundPackId,
        heroPortraitPackId: castSelection.heroPortraitPackId,
        enemyPortraitPackId: castSelection.enemyPortraitPackId,
        backgroundSlot: line.backgroundSlot || pickBackgroundForSpeaker(line.speaker)
    };

    return applySceneCue(base, {
        backgroundSlot: line.backgroundSlot,
        portraitState: line.portraitState || defaultPortraitStateForSpeaker(line.speaker),
        portraitMotion: line.portraitMotion,
        screenFilter: line.screenFilter,
        screenImpulse: line.screenImpulse,
        transition: line.transition
    }, line.speaker);
};
