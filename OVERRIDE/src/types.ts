import {
    BackgroundSlot,
    PortraitMotion,
    PortraitState,
    RuntimeSceneState,
    SceneCastSelection,
    SceneTransition,
    ScreenFilter,
    ScreenImpulse
} from './services/sceneAssetTypes';

export type ScreenType = 'start' | 'config' | 'game';

export type Language = 'zh' | 'ja' | 'en';

export type GamePhase = 'idle' | 'intro_narrative' | 'battle_intro' | 'playing' | 'game_over';
export type RoundIntroMode = 'opening' | 'round';

export interface RoundIntroRequest {
    token: string;
    roundIndex?: number;
    mode: RoundIntroMode;
}

export interface GameState {
    heroHp: number;
    enemyHp: number;
    isOver: boolean;
    suspectName: string | null;
    fixedHeroEmoji: string | null;
    fixedEnemyEmoji: string | null;
    fatalTurnCount: number;
    phase: GamePhase;
    scene: RuntimeSceneState;
    castSelection: SceneCastSelection;
}

export interface ResolvedStatement {
    logic: string;
    evName: string;
    evDetail: string;
}

export interface DialogueCueLine {
    text: string;
    speaker?: DialogueSpeaker;
    enemyPortraitState?: PortraitState;
    enemyPortraitMotion?: PortraitMotion;
}

export interface LogEntry {
    id: string;
    type: 'system' | 'narrative' | 'chat';
    text?: string;
    role?: 'hero' | 'enemy';
    hiddenInCaseLog?: boolean;
    transcriptGroupKey?: string;
    avatarEmoji?: string;
    isFinal?: boolean;
    isTyping?: boolean;
    popupInterference?: boolean;
    interferenceLines?: string[];
    backgroundSlot?: BackgroundSlot;
    enemyPortraitState?: PortraitState;
    enemyPortraitMotion?: PortraitMotion;
    screenFilter?: ScreenFilter;
    screenImpulse?: ScreenImpulse;
    transition?: SceneTransition;
    dialogueSequence?: DialogueCueLine[];
    roundIndex?: number;
}

export interface TooltipState {
    visible: boolean;
    x: number;
    y: number;
    content: string;
    isLogicBreak: boolean;
}

export type DialogueSpeaker = 'hero' | 'enemy' | 'system';

export interface AvgDialogueLine {
    speaker: DialogueSpeaker;
    text: string;
    portraitState?: PortraitState;
    portraitMotion?: PortraitMotion;
    backgroundSlot?: BackgroundSlot;
    screenFilter?: ScreenFilter;
    screenImpulse?: ScreenImpulse;
    transition?: SceneTransition;
}

export interface EvidenceEntry {
    name: string;
    detail: string;
}

export interface ConnectionRequest {
    provider: string;
    apiKey: string;
    modelName?: string;
    localCaseId?: string;
    castSelection: SceneCastSelection;
}
