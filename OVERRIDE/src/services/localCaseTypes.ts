import { Language } from '../types';
import {
    BackgroundSlot,
    PortraitMotion,
    PortraitState,
    SceneTransition,
    ScreenFilter,
    ScreenImpulse
} from './sceneAssetTypes';

export type LocalizedText = Partial<Record<Language, string>>;
export type FailureReason = 'wrongEvidence' | 'wrongStatement' | 'bothWrong';
export type UnlockMode = 'none' | 'allTrueWeakPoints' | 'specificWeakPoints';

export interface LocalEvidence {
    id: string;
    name: LocalizedText;
    detail: LocalizedText;
    aliases: string[];
    startsInInventory?: boolean;
}

export interface AvgLine {
    speaker: 'hero' | 'enemy' | 'system';
    text: LocalizedText;
    portraitState?: PortraitState;
    portraitMotion?: PortraitMotion;
    backgroundSlot?: BackgroundSlot;
    screenFilter?: ScreenFilter;
    screenImpulse?: ScreenImpulse;
    transition?: SceneTransition;
}

export interface LocalWeakPoint {
    id: string;
    lineId: string;
    statement: LocalizedText;
    evidenceId: string;
    consumeEvidenceOnUse?: boolean;
}

export interface LocalFailureOverride {
    weakPointId: string;
    narrative: LocalizedText;
    avg: AvgLine[];
}

export interface LocalSuccessOverride {
    weakPointId: string;
    narrative: LocalizedText;
    avg: AvgLine[];
}

export interface LocalInspectOverride {
    weakPointId: string;
    narrative: LocalizedText;
    avg: AvgLine[];
    grantEvidenceIds?: string[];
    revealLineIds?: string[];
}

export interface LocalDialogueCard {
    id: string;
    text: LocalizedText;
    hidden?: boolean;
    unlockMode?: UnlockMode;
    unlockWeakPointIds?: string[];
    grantEvidenceIds?: string[];
    portraitState?: PortraitState;
    portraitMotion?: PortraitMotion;
}

export interface LocalTurn {
    weakPoints: LocalWeakPoint[];
    loopDialogues: LocalDialogueCard[];
    startingEvidenceIds?: string[];
    queryNarratives: LocalizedText[];
    queryAvg: AvgLine[];
    inspectOverrides: LocalInspectOverride[];
    sceneBackgroundSlot?: BackgroundSlot;
    enemyPortraitState?: PortraitState;
    enemyPortraitMotion?: PortraitMotion;
    screenFilter?: ScreenFilter;
    screenImpulse?: ScreenImpulse;
    transition?: SceneTransition;
    successNarrative: LocalizedText;
    successOverrides: LocalSuccessOverride[];
    useSeparateTurnClear?: boolean;
    turnClearNarrative: LocalizedText;
    turnClearAvg: AvgLine[];
    useSeparateFailureReasons?: boolean;
    failNarrative: Record<FailureReason, LocalizedText>;
    logicExplanation: LocalizedText;
    successAvg: AvgLine[];
    failAvg: Record<FailureReason, AvgLine[]>;
    failOverrides: Record<FailureReason, LocalFailureOverride[]>;
    interferenceLines?: LocalizedText[];
}

export interface LocalCaseData {
    caseId: string;
    caseTitle: LocalizedText;
    defaultLang: Language;
    suspectName: LocalizedText;
    suspectEmoji: string;
    heroEmoji: string;
    heroPortraitPackId?: string;
    enemyPortraitPackId?: string;
    backgroundPackId?: string;
    intro: {
        narrative: LocalizedText;
        systemMsg: LocalizedText;
        backgroundSlot?: BackgroundSlot;
        enemyPortraitState?: PortraitState;
        screenFilter?: ScreenFilter;
        transition?: SceneTransition;
    };
    evidences: LocalEvidence[];
    turns: LocalTurn[];
    victory: {
        narrative: LocalizedText;
        confession: LocalizedText;
        avg: AvgLine[];
        backgroundSlot?: BackgroundSlot;
        screenFilter?: ScreenFilter;
        transition?: SceneTransition;
    };
}
