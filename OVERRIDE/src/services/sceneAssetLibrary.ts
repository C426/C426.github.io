import { Language } from '../types';
import {
    BACKGROUND_SLOTS,
    PORTRAIT_STATES,
    BackgroundPackOption,
    LoadedBackgroundPack,
    LoadedPortraitPack,
    PortraitPackOption,
    PortraitRoleHint,
    PortraitState,
    RuntimeSceneState,
    SceneAssetSource,
    SceneCastSelection,
    localizeSceneLabel
} from './sceneAssetTypes';

const RANDOM_PACK_ID = '__random__';

const imageModules = import.meta.glob('../game-content/{builtin,custom}/{portrait-packs,background-packs}/*/*.{png,jpg,jpeg,webp,gif,svg}', {
    eager: true,
    import: 'default'
}) as Record<string, string>;

const portraitManifestModules = import.meta.glob('../game-content/{builtin,custom}/portrait-packs/*/manifest.json', {
    eager: true,
    import: 'default'
}) as Record<string, unknown>;

const backgroundManifestModules = import.meta.glob('../game-content/{builtin,custom}/background-packs/*/manifest.json', {
    eager: true,
    import: 'default'
}) as Record<string, unknown>;

const normalizePath = (path: string) => path.replace(/\\/g, '/');
const dirname = (path: string) => normalizePath(path).split('/').slice(0, -1).join('/');
const basename = (path: string) => normalizePath(path).split('/').pop() || '';
const stripExtension = (filename: string) => filename.replace(/\.[^/.]+$/, '');
const titleCase = (value: string) =>
    value
        .split(/[-_]+/)
        .filter(Boolean)
        .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');

const sourceFromPath = (path: string): SceneAssetSource =>
    normalizePath(path).includes('/custom/') ? 'custom' : 'builtin';

const resolveAssetPath = (manifestPath: string, relativePath: string) => {
    const resolved = normalizePath(`${dirname(manifestPath)}/${relativePath}`).replace(/\/+/g, '/');
    const url = imageModules[resolved];
    if (!url) {
        throw new Error(`Missing scene asset "${relativePath}" referenced by "${manifestPath}".`);
    }
    return url;
};

const normalizePortraitPack = (manifestPath: string, manifestValue: unknown): LoadedPortraitPack => {
    const manifest = manifestValue as LoadedPortraitPack;
    const states = Object.fromEntries(
        Object.entries(manifest.states || {}).map(([state, asset]) => [
            state,
            {
                closed: resolveAssetPath(manifestPath, asset.closed),
                open: resolveAssetPath(manifestPath, asset.open)
            }
        ])
    ) as LoadedPortraitPack['states'];

    return {
        ...manifest,
        manifestPath,
        source: sourceFromPath(manifestPath),
        thumbnail: resolveAssetPath(manifestPath, manifest.thumbnail),
        referenceSheet: resolveAssetPath(manifestPath, manifest.referenceSheet),
        roleHint: manifest.roleHint || 'generic',
        states
    };
};

const inferRoleHintFromPackId = (packId: string): PortraitRoleHint => {
    const lower = packId.toLowerCase();
    if (/(^|[-_])(hero|player|protagonist)([-_]|$)/.test(lower)) {
        return 'hero';
    }
    if (/(^|[-_])(enemy|suspect|villain|target)([-_]|$)/.test(lower)) {
        return 'enemy';
    }
    return 'generic';
};

const buildPackLabel = (packId: string) => {
    const label = titleCase(packId) || packId;
    return {
        zh: label,
        ja: label,
        en: label
    };
};

const collectAssetFilesByPackDir = (kind: 'portrait' | 'background') => {
    const filesByPackDir = new Map<string, Map<string, string>>();
    const marker = kind === 'portrait' ? '/portrait-packs/' : '/background-packs/';

    for (const [assetPath, url] of Object.entries(imageModules)) {
        const normalizedPath = normalizePath(assetPath);
        const markerIndex = normalizedPath.indexOf(marker);
        if (markerIndex < 0) continue;

        const packStart = markerIndex + marker.length;
        const slashAfterPack = normalizedPath.indexOf('/', packStart);
        if (slashAfterPack < 0) continue;

        const packDir = normalizedPath.slice(0, slashAfterPack);
        const fileBase = stripExtension(basename(normalizedPath));
        if (!fileBase) continue;

        const bucket = filesByPackDir.get(packDir) || new Map<string, string>();
        if (!filesByPackDir.has(packDir)) {
            filesByPackDir.set(packDir, bucket);
        }
        if (!bucket.has(fileBase)) {
            bucket.set(fileBase, url);
        }
    }

    return filesByPackDir;
};

const buildAutoPortraitPack = (
    packDir: string,
    files: Map<string, string>
): LoadedPortraitPack | null => {
    const id = basename(packDir);
    if (!id) return null;

    const states: LoadedPortraitPack['states'] = {};
    for (const state of PORTRAIT_STATES) {
        const closed = files.get(`${state}_closed`);
        const open = files.get(`${state}_open`);
        if (closed && open) {
            states[state] = { closed, open };
        }
    }

    if (!states.neutral_idle) {
        const firstState = Object.keys(states)[0] as PortraitState | undefined;
        if (firstState) {
            states.neutral_idle = states[firstState];
        }
    }

    if (!states.neutral_idle) {
        return null;
    }

    const thumbnail = files.get('thumbnail') || states.neutral_idle.closed;
    const referenceSheet = files.get('reference_sheet') || files.get('reference-sheet') || thumbnail;

    return {
        version: 'portrait_pack_v1',
        id,
        displayName: buildPackLabel(id),
        roleHint: inferRoleHintFromPackId(id),
        thumbnail,
        referenceSheet,
        states,
        source: sourceFromPath(packDir),
        manifestPath: `${packDir}/manifest.auto.json`
    };
};

const normalizeBackgroundPack = (manifestPath: string, manifestValue: unknown): LoadedBackgroundPack => {
    const manifest = manifestValue as LoadedBackgroundPack;
    const slots = Object.fromEntries(
        Object.entries(manifest.slots || {}).map(([slot, assetPath]) => [
            slot,
            resolveAssetPath(manifestPath, assetPath)
        ])
    );
    const overlays = Object.fromEntries(
        Object.entries(manifest.overlays || {}).map(([slot, assetPath]) => [
            slot,
            resolveAssetPath(manifestPath, assetPath)
        ])
    );

    return {
        ...manifest,
        manifestPath,
        source: sourceFromPath(manifestPath),
        thumbnail: resolveAssetPath(manifestPath, manifest.thumbnail),
        slots,
        overlays
    };
};

const buildAutoBackgroundPack = (
    packDir: string,
    files: Map<string, string>
): LoadedBackgroundPack | null => {
    const id = basename(packDir);
    if (!id) return null;

    const slots: Record<string, string> = {};
    for (const slot of BACKGROUND_SLOTS) {
        const assetUrl = files.get(slot);
        if (assetUrl) {
            slots[slot] = assetUrl;
        }
    }

    if (Object.keys(slots).length === 0) {
        const fallback = files.get('background') || files.get('main') || files.values().next().value;
        if (fallback) {
            slots.cross_exam = fallback;
        }
    }

    if (Object.keys(slots).length === 0) {
        return null;
    }

    const overlays: Record<string, string> = {};
    const sharedOverlay = files.get('overlay');
    if (sharedOverlay) {
        ['cross_exam', 'analysis', 'reveal', 'confession'].forEach(slot => {
            overlays[slot] = sharedOverlay;
        });
    }
    for (const slot of BACKGROUND_SLOTS) {
        const perSlotOverlay = files.get(`overlay_${slot}`) || files.get(`overlay-${slot}`);
        if (perSlotOverlay) {
            overlays[slot] = perSlotOverlay;
        }
    }

    const thumbnail = files.get('thumbnail') || slots.cross_exam || slots.hearing || Object.values(slots)[0];

    return {
        version: 'background_pack_v1',
        id,
        displayName: buildPackLabel(id),
        thumbnail,
        slots,
        overlays,
        source: sourceFromPath(packDir),
        manifestPath: `${packDir}/manifest.auto.json`
    };
};

const manifestPortraitPacks = Object.entries(portraitManifestModules)
    .map(([path, manifest]) => normalizePortraitPack(path, manifest));
const portraitPackIdsFromManifest = new Set(manifestPortraitPacks.map(pack => pack.id));
const autoPortraitPacks = Array.from(collectAssetFilesByPackDir('portrait').entries())
    .map(([packDir, files]) => buildAutoPortraitPack(packDir, files))
    .filter((pack): pack is LoadedPortraitPack => Boolean(pack))
    .filter(pack => !portraitPackIdsFromManifest.has(pack.id));

const portraitPacks = [...manifestPortraitPacks, ...autoPortraitPacks]
    .sort((left, right) => left.id.localeCompare(right.id, 'zh-Hans-CN'));

const manifestBackgroundPacks = Object.entries(backgroundManifestModules)
    .map(([path, manifest]) => normalizeBackgroundPack(path, manifest));
const backgroundPackIdsFromManifest = new Set(manifestBackgroundPacks.map(pack => pack.id));
const autoBackgroundPacks = Array.from(collectAssetFilesByPackDir('background').entries())
    .map(([packDir, files]) => buildAutoBackgroundPack(packDir, files))
    .filter((pack): pack is LoadedBackgroundPack => Boolean(pack))
    .filter(pack => !backgroundPackIdsFromManifest.has(pack.id));

const backgroundPacks = [...manifestBackgroundPacks, ...autoBackgroundPacks]
    .sort((left, right) => left.id.localeCompare(right.id, 'zh-Hans-CN'));

const portraitPackMap = new Map(portraitPacks.map(pack => [pack.id, pack]));
const backgroundPackMap = new Map(backgroundPacks.map(pack => [pack.id, pack]));

const toPortraitOption = (pack: LoadedPortraitPack, lang: Language): PortraitPackOption => ({
    id: pack.id,
    label: localizeSceneLabel(pack.displayName, lang),
    roleHint: pack.roleHint || 'generic',
    source: pack.source,
    pack
});

const toBackgroundOption = (pack: LoadedBackgroundPack, lang: Language): BackgroundPackOption => ({
    id: pack.id,
    label: localizeSceneLabel(pack.displayName, lang),
    source: pack.source,
    pack
});

const compatiblePortraitPacks = (role: PortraitRoleHint) =>
    portraitPacks.filter(pack => pack.roleHint === role || pack.roleHint === 'generic');

const fallbackPortraitPackId = (role: PortraitRoleHint) =>
    compatiblePortraitPacks(role)[0]?.id || portraitPacks[0]?.id || '';

const resolveRandomPortraitPackId = (role: PortraitRoleHint, seedText?: string) => {
    const candidates = compatiblePortraitPacks(role);
    if (candidates.length === 0) {
        return fallbackPortraitPackId(role);
    }

    if (!seedText) {
        return candidates[0].id;
    }

    const hash = Array.from(seedText).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return candidates[Math.abs(hash) % candidates.length].id;
};

const resolveRandomBackgroundPackId = (seedText?: string) => {
    if (backgroundPacks.length === 0) {
        return 'default-court-interface';
    }

    if (!seedText) {
        return backgroundPacks[0].id;
    }

    const hash = Array.from(seedText).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return backgroundPacks[Math.abs(hash) % backgroundPacks.length].id;
};

export const getPortraitPackOptions = (lang: Language, role?: PortraitRoleHint) => {
    const options = role ? compatiblePortraitPacks(role) : portraitPacks;
    return options.map(pack => toPortraitOption(pack, lang));
};

export const getBackgroundPackOptions = (lang: Language) =>
    backgroundPacks.map(pack => toBackgroundOption(pack, lang));

export const getPortraitPackById = (packId: string) => portraitPackMap.get(packId) || null;
export const getBackgroundPackById = (packId: string) => backgroundPackMap.get(packId) || null;

export const getPortraitAsset = (
    packId: string,
    state: PortraitState,
    speaking: boolean,
    role: PortraitRoleHint = 'generic'
) => {
    const pack = getPortraitPackById(packId) || getPortraitPackById(fallbackPortraitPackId(role));
    if (!pack) {
        return null;
    }

    const asset = pack.states[state] || pack.states.neutral_idle;
    if (!asset) {
        return null;
    }

    return speaking ? asset.open : asset.closed;
};

export const getBackgroundAsset = (packId: string, slot: string) => {
    const pack = getBackgroundPackById(packId) || backgroundPacks[0] || null;
    if (!pack) {
        return null;
    }

    return pack.slots[slot] || pack.slots.cross_exam || pack.slots.hearing || Object.values(pack.slots)[0] || null;
};

export const getBackgroundOverlayAsset = (packId: string, slot: string) => {
    const pack = getBackgroundPackById(packId) || backgroundPacks[0] || null;
    if (!pack) {
        return null;
    }

    return pack.overlays?.[slot] || pack.overlays?.cross_exam || null;
};

export const resolveSceneCastSelection = (
    selection: Partial<SceneCastSelection>,
    seedText?: string
): SceneCastSelection => {
    const requestedEnemyPackId = selection.enemyPortraitPackId && selection.enemyPortraitPackId !== RANDOM_PACK_ID
        ? selection.enemyPortraitPackId
        : null;
    const requestedHeroPackId = selection.heroPortraitPackId && selection.heroPortraitPackId !== RANDOM_PACK_ID
        ? selection.heroPortraitPackId
        : null;
    const requestedBackgroundPackId = selection.backgroundPackId && selection.backgroundPackId !== RANDOM_PACK_ID
        ? selection.backgroundPackId
        : null;

    const enemyPortraitPackId = requestedEnemyPackId && portraitPackMap.has(requestedEnemyPackId)
        ? requestedEnemyPackId
        : resolveRandomPortraitPackId('enemy', seedText ? `${seedText}:enemy` : undefined);
    const heroPortraitPackId = requestedHeroPackId && portraitPackMap.has(requestedHeroPackId)
        ? requestedHeroPackId
        : resolveRandomPortraitPackId('hero', seedText ? `${seedText}:hero` : undefined);
    const backgroundPackId = requestedBackgroundPackId && backgroundPackMap.has(requestedBackgroundPackId)
        ? requestedBackgroundPackId
        : resolveRandomBackgroundPackId(seedText ? `${seedText}:background` : undefined);

    return {
        heroPortraitPackId,
        enemyPortraitPackId,
        backgroundPackId
    };
};

export const buildInitialSceneState = (selection: SceneCastSelection): RuntimeSceneState => ({
    backgroundPackId: selection.backgroundPackId,
    backgroundSlot: 'cross_exam',
    screenFilter: 'none',
    screenImpulse: 'none',
    transition: 'cut',
    heroPortraitPackId: selection.heroPortraitPackId,
    heroPortraitState: 'serious_focus',
    heroPortraitMotion: 'none',
    enemyPortraitPackId: selection.enemyPortraitPackId,
    enemyPortraitState: 'neutral_idle',
    enemyPortraitMotion: 'none'
});

export const getSupportedBackgroundSlots = () => [...BACKGROUND_SLOTS];
export const getRandomPortraitPackIdToken = () => RANDOM_PACK_ID;
