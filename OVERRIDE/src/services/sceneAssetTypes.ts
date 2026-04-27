export const PORTRAIT_STATES = [
    'neutral_idle',
    'polite_smile',
    'smug_tilt',
    'innocent_hand',
    'serious_focus',
    'thinking_hand_to_chin',
    'surprise_small',
    'shock_big',
    'defensive_frown',
    'angry_attack',
    'breakdown_unstable',
    'sad_confession'
] as const;

export const BACKGROUND_SLOTS = [
    'boot',
    'briefing',
    'hearing',
    'cross_exam',
    'analysis',
    'reveal',
    'confession',
    'ending'
] as const;

export const PORTRAIT_MOTIONS = [
    'none',
    'pop',
    'shake_small',
    'shake_big',
    'bounce',
    'slide_in',
    'slide_out'
] as const;

export const SCREEN_FILTERS = [
    'none',
    'dim',
    'scanline',
    'noise',
    'glitch',
    'alert_red',
    'monochrome'
] as const;

export const SCREEN_IMPULSES = [
    'none',
    'camera_shake',
    'zoom_punch',
    'flash'
] as const;

export const SCENE_TRANSITIONS = [
    'cut',
    'fade',
    'glitch',
    'white_flash',
    'wipe'
] as const;

export type PortraitState = typeof PORTRAIT_STATES[number];
export type BackgroundSlot = typeof BACKGROUND_SLOTS[number] | string;
export type PortraitMotion = typeof PORTRAIT_MOTIONS[number];
export type ScreenFilter = typeof SCREEN_FILTERS[number];
export type ScreenImpulse = typeof SCREEN_IMPULSES[number];
export type SceneTransition = typeof SCENE_TRANSITIONS[number];
export type PortraitRoleHint = 'hero' | 'enemy' | 'generic';
export type SceneAssetSource = 'builtin' | 'custom';

export interface LocalizedLabel {
    zh?: string;
    ja?: string;
    en?: string;
}

export interface PortraitStateAsset {
    closed: string;
    open: string;
}

export interface PortraitPackManifest {
    version: 'portrait_pack_v1';
    id: string;
    displayName: string | LocalizedLabel;
    roleHint?: PortraitRoleHint;
    thumbnail: string;
    referenceSheet: string;
    states: Partial<Record<PortraitState, PortraitStateAsset>>;
}

export interface LoadedPortraitPack extends PortraitPackManifest {
    source: SceneAssetSource;
    manifestPath: string;
}

export interface BackgroundPackManifest {
    version: 'background_pack_v1';
    id: string;
    displayName: string | LocalizedLabel;
    thumbnail: string;
    slots: Record<string, string>;
    overlays?: Record<string, string>;
}

export interface LoadedBackgroundPack extends BackgroundPackManifest {
    source: SceneAssetSource;
    manifestPath: string;
}

export interface PortraitPackOption {
    id: string;
    label: string;
    roleHint: PortraitRoleHint;
    source: SceneAssetSource;
    pack: LoadedPortraitPack;
}

export interface BackgroundPackOption {
    id: string;
    label: string;
    source: SceneAssetSource;
    pack: LoadedBackgroundPack;
}

export interface SceneCastSelection {
    heroPortraitPackId: string;
    enemyPortraitPackId: string;
    backgroundPackId: string;
}

export interface SceneCue {
    backgroundSlot?: BackgroundSlot;
    portraitState?: PortraitState;
    portraitMotion?: PortraitMotion;
    screenFilter?: ScreenFilter;
    screenImpulse?: ScreenImpulse;
    transition?: SceneTransition;
}

export interface RuntimeSceneState {
    backgroundPackId: string;
    backgroundSlot: BackgroundSlot;
    screenFilter: ScreenFilter;
    screenImpulse: ScreenImpulse;
    transition: SceneTransition;
    heroPortraitPackId: string;
    heroPortraitState: PortraitState;
    heroPortraitMotion: PortraitMotion;
    enemyPortraitPackId: string;
    enemyPortraitState: PortraitState;
    enemyPortraitMotion: PortraitMotion;
}

export const DEFAULT_SCENE_CAST_SELECTION: SceneCastSelection = {
    heroPortraitPackId: '__random__',
    enemyPortraitPackId: '__random__',
    backgroundPackId: 'default-court-interface'
};

export const DEFAULT_RUNTIME_SCENE_STATE: RuntimeSceneState = {
    backgroundPackId: DEFAULT_SCENE_CAST_SELECTION.backgroundPackId,
    backgroundSlot: 'cross_exam',
    screenFilter: 'none',
    screenImpulse: 'none',
    transition: 'cut',
    heroPortraitPackId: DEFAULT_SCENE_CAST_SELECTION.heroPortraitPackId,
    heroPortraitState: 'serious_focus',
    heroPortraitMotion: 'none',
    enemyPortraitPackId: DEFAULT_SCENE_CAST_SELECTION.enemyPortraitPackId,
    enemyPortraitState: 'neutral_idle',
    enemyPortraitMotion: 'none'
};

export const localizeSceneLabel = (
    value: string | LocalizedLabel,
    lang: 'zh' | 'ja' | 'en'
) => {
    if (typeof value === 'string') {
        return value;
    }

    return value[lang] || value.zh || value.ja || value.en || 'Unnamed';
};
