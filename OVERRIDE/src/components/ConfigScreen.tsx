import React, { useEffect, useMemo, useState } from 'react';
import { ConnectionRequest, Language } from '../types';
import { i18n } from '../i18n';
import { SystemStreamBackdrop } from './SystemStreamBackdrop';
import { LocalCaseOption } from '../services/localCaseLibrary';
import { LocalCaseWorkspaceInfo } from '../services/localCaseWorkspace';
import { LocalCaseWorkshop } from './LocalCaseWorkshop';
import { BackgroundPackOption, PortraitPackOption } from '../services/sceneAssetTypes';
import { getRandomPortraitPackIdToken } from '../services/sceneAssetLibrary';

const PREFERRED_GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-flash-latest',
    'gemini-pro-latest',
    'gemini-2.5-flash-lite',
    'gemini-flash-lite-latest'
];

const EXCLUDED_GEMINI_MODEL_PATTERNS = [
    /image/i,
    /nano-banana/i,
    /computer-use/i,
    /research/i,
    /robotics/i,
    /customtools/i,
    /tts/i,
    /embedding/i,
    /aqa/i
];

const filterGameplayGeminiModels = (models: string[]) => {
    const cleaned = Array.from(new Set(
        models
            .map(model => model.trim())
            .filter(Boolean)
            .filter(model => !EXCLUDED_GEMINI_MODEL_PATTERNS.some(pattern => pattern.test(model)))
    ));

    const preferred = PREFERRED_GEMINI_MODELS.filter(model => cleaned.includes(model));
    const fallback = cleaned.filter(model => /(flash|pro|lite)/i.test(model) && !/preview/i.test(model));

    return preferred.length > 0 ? preferred : fallback;
};

interface ConfigScreenProps {
    lang: Language;
    availableModels: string[];
    localCases: LocalCaseOption[];
    portraitPacks: PortraitPackOption[];
    backgroundPacks: BackgroundPackOption[];
    localWorkspaceInfo: LocalCaseWorkspaceInfo;
    onConnect: (request: ConnectionRequest) => Promise<void>;
    onLinkLocalWorkspace: () => Promise<void>;
    onRefreshLocalCases: (preferredCaseId?: string) => Promise<void>;
}

export const ConfigScreen: React.FC<ConfigScreenProps> = ({
    lang,
    availableModels,
    localCases,
    portraitPacks,
    backgroundPacks,
    localWorkspaceInfo,
    onConnect,
    onLinkLocalWorkspace,
    onRefreshLocalCases
}) => {
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState('');
    const [statusColor, setStatusColor] = useState('');
    const [selectedOption, setSelectedOption] = useState('');
    const [dynamicModels, setDynamicModels] = useState<string[]>([]);
    const [selectedLocalCaseId, setSelectedLocalCaseId] = useState('');
    const [selectedHeroPortraitPackId, setSelectedHeroPortraitPackId] = useState(getRandomPortraitPackIdToken());
    const [selectedEnemyPortraitPackId, setSelectedEnemyPortraitPackId] = useState(getRandomPortraitPackIdToken());
    const [selectedBackgroundPackId, setSelectedBackgroundPackId] = useState('');
    const [isVisualResourcesOpen, setIsVisualResourcesOpen] = useState(false);
    const [isWorkshopOpen, setIsWorkshopOpen] = useState(false);
    const randomPortraitToken = getRandomPortraitPackIdToken();

    const t = i18n[lang];
    const currentModels = dynamicModels.length > 0 ? dynamicModels : availableModels;

    const options = [
        ...currentModels.map(model => ({ value: `gemini|${model}`, label: `Google Gemini (${model})` })),
        { value: 'siliconflow-deepseek|deepseek-ai/DeepSeek-V3', label: 'SiliconFlow (DeepSeek V3)' },
        { value: 'siliconflow-qwen|Qwen/Qwen2.5-72B-Instruct', label: 'SiliconFlow (Qwen 2.5)' },
        { value: 'local|builtin', label: t.localTestMode }
    ];

    useEffect(() => {
        if (currentModels.length > 0 && !selectedOption) {
            const defaultModel = currentModels.find(model => model.includes('flash')) || currentModels[0];
            setSelectedOption(`gemini|${defaultModel}`);
        }
    }, [currentModels, selectedOption]);

    useEffect(() => {
        if (localCases.length > 0 && !selectedLocalCaseId) {
            setSelectedLocalCaseId(localCases[0].id);
        }
    }, [localCases, selectedLocalCaseId]);

    useEffect(() => {
        const fetchUserModels = async () => {
            const key = apiKey.trim();
            if (key.startsWith('AIza') && key.length > 30) {
                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
                    if (response.ok) {
                    const data = await response.json();
                        const models = filterGameplayGeminiModels(data.models
                            .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
                            .map((model: any) => model.name.replace('models/', '')));

                        if (models.length > 0) {
                            setDynamicModels(models);
                            if (selectedOption.startsWith('gemini|')) {
                                const currentModelName = selectedOption.split('|')[1];
                                if (!models.includes(currentModelName)) {
                                    const defaultModel = models.find((model: string) => model.includes('flash')) || models[0];
                                    setSelectedOption(`gemini|${defaultModel}`);
                                }
                            }
                        }
                    }
                } catch {
                    // Keep fallback models silently.
                }
            } else {
                setDynamicModels([]);
            }
        };

        const timeoutId = setTimeout(fetchUserModels, 800);
        return () => clearTimeout(timeoutId);
    }, [apiKey, selectedOption]);

    const isLocal = selectedOption.startsWith('local|');
    const selectedLocalCase = localCases.find(caseOption => caseOption.id === selectedLocalCaseId) || localCases[0];
    const workspaceCases = useMemo(
        () => localCases.filter(caseOption => caseOption.source === 'workspace'),
        [localCases]
    );
    const builtinCases = useMemo(
        () => localCases.filter(caseOption => caseOption.source === 'builtin'),
        [localCases]
    );
    const heroPortraitOptions = useMemo(
        () => portraitPacks.filter(option => option.roleHint !== 'enemy'),
        [portraitPacks]
    );
    const enemyPortraitOptions = useMemo(
        () => portraitPacks.filter(option => option.roleHint !== 'hero'),
        [portraitPacks]
    );
    const builtinPortraitOptions = useMemo(
        () => portraitPacks.filter(option => option.source === 'builtin'),
        [portraitPacks]
    );
    const customPortraitOptions = useMemo(
        () => portraitPacks.filter(option => option.source === 'custom'),
        [portraitPacks]
    );
    const builtinBackgroundOptions = useMemo(
        () => backgroundPacks.filter(option => option.source === 'builtin'),
        [backgroundPacks]
    );
    const customBackgroundOptions = useMemo(
        () => backgroundPacks.filter(option => option.source === 'custom'),
        [backgroundPacks]
    );

    useEffect(() => {
        if (!selectedBackgroundPackId && backgroundPacks.length > 0) {
            setSelectedBackgroundPackId(backgroundPacks[0].id);
        }
    }, [backgroundPacks, selectedBackgroundPackId]);

    const selectedHeroPortraitLabel = useMemo(() => {
        if (selectedHeroPortraitPackId === randomPortraitToken) {
            return t.randomPortraitPack;
        }
        return heroPortraitOptions.find(option => option.id === selectedHeroPortraitPackId)?.label || t.randomPortraitPack;
    }, [heroPortraitOptions, randomPortraitToken, selectedHeroPortraitPackId, t.randomPortraitPack]);

    const selectedEnemyPortraitLabel = useMemo(() => {
        if (selectedEnemyPortraitPackId === randomPortraitToken) {
            return t.randomPortraitPack;
        }
        return enemyPortraitOptions.find(option => option.id === selectedEnemyPortraitPackId)?.label || t.randomPortraitPack;
    }, [enemyPortraitOptions, randomPortraitToken, selectedEnemyPortraitPackId, t.randomPortraitPack]);

    const selectedBackgroundLabel = useMemo(
        () => backgroundPacks.find(option => option.id === selectedBackgroundPackId)?.label || backgroundPacks[0]?.label || '-',
        [backgroundPacks, selectedBackgroundPackId]
    );

    useEffect(() => {
        if (
            selectedHeroPortraitPackId !== randomPortraitToken
            && heroPortraitOptions.length > 0
            && !heroPortraitOptions.some(option => option.id === selectedHeroPortraitPackId)
        ) {
            setSelectedHeroPortraitPackId(randomPortraitToken);
        }
    }, [heroPortraitOptions, randomPortraitToken, selectedHeroPortraitPackId]);

    useEffect(() => {
        if (
            selectedEnemyPortraitPackId !== randomPortraitToken
            && enemyPortraitOptions.length > 0
            && !enemyPortraitOptions.some(option => option.id === selectedEnemyPortraitPackId)
        ) {
            setSelectedEnemyPortraitPackId(randomPortraitToken);
        }
    }, [enemyPortraitOptions, randomPortraitToken, selectedEnemyPortraitPackId]);

    const handleConnect = async () => {
        if (!isLocal && !apiKey.trim()) {
            setStatus('KEY REQUIRED');
            setStatusColor('var(--amber)');
            return;
        }

        if (isLocal && !selectedLocalCase) {
            setStatus('NO LOCAL CASE FOUND');
            setStatusColor('var(--danger)');
            return;
        }

        setStatus('CONNECTING...');
        setStatusColor('var(--acid)');

        try {
            const [provider, modelName] = selectedOption.split('|');
            const remoteCastSelection = {
                heroPortraitPackId: selectedHeroPortraitPackId,
                enemyPortraitPackId: selectedEnemyPortraitPackId,
                backgroundPackId: selectedBackgroundPackId || backgroundPacks[0]?.id || 'default-court-interface'
            };
            await onConnect({
                provider,
                apiKey: isLocal ? 'local-key' : apiKey.trim(),
                modelName: isLocal ? undefined : modelName,
                localCaseId: isLocal ? selectedLocalCase?.id : undefined,
                castSelection: isLocal
                    ? {
                        heroPortraitPackId: getRandomPortraitPackIdToken(),
                        enemyPortraitPackId: getRandomPortraitPackIdToken(),
                        backgroundPackId: 'default-court-interface'
                    }
                    : remoteCastSelection
            });
            setStatus('LINK ESTABLISHED');
            setStatusColor('var(--acid)');
        } catch (error: any) {
            setStatus(`ERROR: ${error.message}`);
            setStatusColor('var(--danger)');
        }
    };

    const getPlaceholder = () => {
        if (isLocal) return 'No API Key Required';
        if (selectedOption.startsWith('gemini')) return 'Google Gemini API Key';
        if (selectedOption.startsWith('siliconflow')) return 'SiliconFlow API Key';
        return 'API Key';
    };

    return (
        <div id="config-screen" className="screen active">
            <SystemStreamBackdrop columns={4} className="config-bg-console" />

            <div className="config-shell">
                <div className="config-meta-row">
                    <span>[ CONNECTION PANEL ]</span>
                    <span>{isLocal ? 'LOCAL MODE' : 'REMOTE MODE'}</span>
                </div>

                <div className="config-heading-block">
                    <h2 className="config-heading">MODEL LINK</h2>
                    <div className="config-rule-row">
                        <span className="config-rule-line" />
                        <span className="config-hint">SELECT PROVIDER PROFILE</span>
                    </div>
                </div>

                <p className="config-kicker">{t.apiTitle} // INITIALIZE AI CHANNEL</p>

                <div className="config-form-stack">
                    <label className="config-label" htmlFor="provider-select">PROVIDER</label>
                    <select
                        id="provider-select"
                        className="cyber-input config-control"
                        value={selectedOption}
                        onChange={(event) => setSelectedOption(event.target.value)}
                    >
                        {options.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>

                    <label className="config-label" htmlFor="api-key-input">
                        {isLocal ? 'CASE SOURCE' : 'API KEY'}
                    </label>

                    <div className="config-dynamic-slot">
                        {!isLocal ? (
                            <>
                                <input
                                    type="password"
                                    id="api-key-input"
                                    className="cyber-input config-control"
                                    placeholder={getPlaceholder()}
                                    value={apiKey}
                                    onChange={(event) => setApiKey(event.target.value)}
                                />
                                <p className="config-local-note config-local-note-placeholder">SCRIPT // NONE</p>
                            </>
                        ) : (
                            <>
                                <select
                                    id="local-case-select"
                                    className="cyber-input config-control"
                                    value={selectedLocalCase?.id || ''}
                                    onChange={(event) => setSelectedLocalCaseId(event.target.value)}
                                >
                                    {workspaceCases.length > 0 && (
                                        <optgroup label="LOCAL FILES">
                                            {workspaceCases.map(caseOption => (
                                                <option key={caseOption.id} value={caseOption.id}>
                                                    {caseOption.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {builtinCases.length > 0 && (
                                        <optgroup label="BUILT-IN">
                                            {builtinCases.map(caseOption => (
                                                <option key={caseOption.id} value={caseOption.id}>
                                                    {caseOption.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <p className="config-local-note">
                                    {selectedLocalCase ? `SCRIPT // ${selectedLocalCase.filename}` : 'SCRIPT // NONE'}
                                </p>
                                <div className="config-local-actions">
                                    <button
                                        type="button"
                                        className="config-connect-btn"
                                        onClick={() => setIsWorkshopOpen(true)}
                                    >
                                        {t.scriptWorkshopBtn}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {!isLocal && (
                        <div className="config-foldout">
                            <button
                                type="button"
                                className="config-foldout-toggle"
                                aria-expanded={isVisualResourcesOpen}
                                onClick={() => setIsVisualResourcesOpen(prev => !prev)}
                            >
                                <span className="config-foldout-copy">
                                    <span className="config-foldout-title">{t.visualResources}</span>
                                    <span className="config-foldout-summary">
                                        {selectedHeroPortraitLabel} / {selectedEnemyPortraitLabel} / {selectedBackgroundLabel}
                                    </span>
                                </span>
                                <span className="config-foldout-icon">{isVisualResourcesOpen ? '-' : '+'}</span>
                            </button>

                            {isVisualResourcesOpen && (
                                <div className="config-foldout-body">
                                    <div className="config-resource-grid">
                                        <div className="config-resource-field">
                                            <label className="config-label" htmlFor="hero-portrait-select">{t.heroPortraitPack}</label>
                                            <select
                                                id="hero-portrait-select"
                                                className="cyber-input config-control"
                                                value={selectedHeroPortraitPackId}
                                                onChange={(event) => setSelectedHeroPortraitPackId(event.target.value)}
                                            >
                                                <option value={randomPortraitToken}>{t.randomPortraitPack}</option>
                                                {builtinPortraitOptions.length > 0 && (
                                                    <optgroup label={t.builtinContent}>
                                                        {heroPortraitOptions
                                                            .filter(option => option.source === 'builtin')
                                                            .map(option => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                                {customPortraitOptions.length > 0 && (
                                                    <optgroup label={t.customContent}>
                                                        {heroPortraitOptions
                                                            .filter(option => option.source === 'custom')
                                                            .map(option => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>

                                        <div className="config-resource-field">
                                            <label className="config-label" htmlFor="enemy-portrait-select">{t.enemyPortraitPack}</label>
                                            <select
                                                id="enemy-portrait-select"
                                                className="cyber-input config-control"
                                                value={selectedEnemyPortraitPackId}
                                                onChange={(event) => setSelectedEnemyPortraitPackId(event.target.value)}
                                            >
                                                <option value={randomPortraitToken}>{t.randomPortraitPack}</option>
                                                {builtinPortraitOptions.length > 0 && (
                                                    <optgroup label={t.builtinContent}>
                                                        {enemyPortraitOptions
                                                            .filter(option => option.source === 'builtin')
                                                            .map(option => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                                {customPortraitOptions.length > 0 && (
                                                    <optgroup label={t.customContent}>
                                                        {enemyPortraitOptions
                                                            .filter(option => option.source === 'custom')
                                                            .map(option => (
                                                                <option key={option.id} value={option.id}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>

                                        <div className="config-resource-field config-resource-field-wide">
                                            <label className="config-label" htmlFor="background-pack-select">{t.backgroundPack}</label>
                                            <select
                                                id="background-pack-select"
                                                className="cyber-input config-control"
                                                value={selectedBackgroundPackId}
                                                onChange={(event) => setSelectedBackgroundPackId(event.target.value)}
                                            >
                                                {builtinBackgroundOptions.length > 0 && (
                                                    <optgroup label={t.builtinContent}>
                                                        {builtinBackgroundOptions.map(option => (
                                                            <option key={option.id} value={option.id}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {customBackgroundOptions.length > 0 && (
                                                    <optgroup label={t.customContent}>
                                                        {customBackgroundOptions.map(option => (
                                                            <option key={option.id} value={option.id}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <p id="api-status" className="config-status" style={{ color: statusColor || 'var(--muted)' }}>
                    {status || (isLocal ? 'LOCAL READY' : 'STANDBY')}
                </p>

                <button className="config-connect-btn" onClick={handleConnect}>
                    {t.connectBtn}
                </button>
            </div>

            <LocalCaseWorkshop
                lang={lang}
                isOpen={isWorkshopOpen}
                localCases={localCases}
                selectedCase={selectedLocalCase || null}
                workspaceInfo={localWorkspaceInfo}
                onClose={() => setIsWorkshopOpen(false)}
                onLinkWorkspace={onLinkLocalWorkspace}
                onCasesSaved={async (preferredCaseId?: string) => {
                    await onRefreshLocalCases(preferredCaseId);
                    if (preferredCaseId) {
                        setSelectedLocalCaseId(preferredCaseId);
                    }
                }}
                onSelectCase={setSelectedLocalCaseId}
            />
        </div>
    );
};
