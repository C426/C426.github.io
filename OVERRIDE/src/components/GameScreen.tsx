import React, { useEffect, useState } from 'react';
import { StatusBar } from './StatusBar';
import { PortraitArea } from './PortraitArea';
import { LogViewer } from './LogViewer';
import { Sidebar } from './Sidebar';
import { AvgDialogueLine, GameState, Language, LogEntry, ResolvedStatement, RoundIntroRequest } from '../types';
import { AvgDialoguePanel } from './AvgDialoguePanel';
import { RuntimeSceneState, SceneCastSelection } from '../services/sceneAssetTypes';
import { buildSceneStateFromAvgLine } from '../services/sceneRuntime';
import { SceneBackdrop } from './SceneBackdrop';
import { SystemLoadPanel, SystemLoadRow } from './SystemLoadPanel';

interface GameScreenProps {
    gameState: GameState;
    lang: Language;
    logs: LogEntry[];
    activeEnemyLog: LogEntry | null;
    openingRoundIntro?: RoundIntroRequest | null;
    focusDialogue: { lines: AvgDialogueLine[]; index: number } | null;
    scene: RuntimeSceneState;
    castSelection: SceneCastSelection;
    evidenceMap: Map<string, string>;
    usedEvidenceSet: Set<string>;
    resolvedStatementsMap: Map<string, ResolvedStatement>;
    activeResolvedWeakPointIds: Set<string>;
    activeInspectedWeakPointIds: Set<string>;
    isLoading: boolean;
    loadPanelStatus?: {
        title: string;
        stage: string;
        status: 'working' | 'error';
        rows: SystemLoadRow[];
        attempt?: number;
        maxAttempts?: number;
        error?: string | null;
    } | null;
    prefetchNotice?: {
        title: string;
        message: string;
        buttonLabel: string;
    } | null;
    onRetryPrefetch?: () => void;
    onRetryLoad?: () => void;
    onCancelLoad?: () => void;
    onAdvanceFocusDialogue: () => void;
    onSend: (text: string) => void;
    onCollectEvidence: (name: string, detail: string) => void;
    onUseEvidence: (name: string, statement: string, weakPointId?: string) => void;
    onInspectWeakPoint: (statement: string, weakPointId?: string) => void;
    onOpeningRoundIntroComplete?: () => void;
    canInspectWeakPoints: boolean;
    showTooltip: (e: React.MouseEvent, content: string, isLogicBreak?: boolean) => void;
    hideTooltip: () => void;
}

export const GameScreen: React.FC<GameScreenProps> = ({
    gameState,
    lang,
    logs,
    activeEnemyLog,
    openingRoundIntro = null,
    focusDialogue,
    scene,
    castSelection,
    evidenceMap,
    activeResolvedWeakPointIds,
    activeInspectedWeakPointIds,
    isLoading,
    loadPanelStatus = null,
    prefetchNotice = null,
    onRetryPrefetch,
    onRetryLoad,
    onCancelLoad,
    onAdvanceFocusDialogue,
    onUseEvidence,
    onInspectWeakPoint,
    onOpeningRoundIntroComplete,
    canInspectWeakPoints,
    showTooltip,
    hideTooltip
}) => {
    const [selectedEvidence, setSelectedEvidence] = useState<string | null>(null);
    const [isDeferredLoadVisible, setIsDeferredLoadVisible] = useState(false);
    const isFocusMode = !!focusDialogue;
    const shouldShowLoadPanel = loadPanelStatus?.status === 'error'
        ? true
        : isDeferredLoadVisible && Boolean(loadPanelStatus);
    const activeScene = isFocusMode && focusDialogue
        ? buildSceneStateFromAvgLine(castSelection, focusDialogue.lines[focusDialogue.index])
        : scene;

    useEffect(() => {
        if (loadPanelStatus?.status === 'error') {
            setIsDeferredLoadVisible(true);
            return;
        }

        if (!isLoading) {
            setIsDeferredLoadVisible(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setIsDeferredLoadVisible(true);
        }, 2000);

        return () => window.clearTimeout(timer);
    }, [isLoading, loadPanelStatus?.status]);

    useEffect(() => {
        if (!selectedEvidence) {
            return;
        }
        if (!evidenceMap.has(selectedEvidence)) {
            setSelectedEvidence(null);
        }
    }, [selectedEvidence, evidenceMap]);

    useEffect(() => {
        if (isFocusMode) {
            setSelectedEvidence(null);
        }
    }, [isFocusMode]);

    return (
        <div id="game-screen" className="screen active">
            <div className="main-area">
                {shouldShowLoadPanel && loadPanelStatus && (
                    <div id="loading-overlay" style={{ display: 'flex' }}>
                        <SystemLoadPanel
                            compact
                            variant="hud"
                            title={loadPanelStatus.title}
                            stage={loadPanelStatus.stage}
                            status={loadPanelStatus.status}
                            rows={loadPanelStatus.rows}
                            attempt={loadPanelStatus.attempt}
                            maxAttempts={loadPanelStatus.maxAttempts}
                            error={loadPanelStatus.error}
                            onRetry={loadPanelStatus.status === 'error' ? onRetryLoad : undefined}
                            onCancel={loadPanelStatus.status === 'error' ? onCancelLoad : undefined}
                        />
                    </div>
                )}

                <StatusBar gameState={gameState} lang={lang} />

                <div className="vn-scene vn-scene-layout">
                    <SceneBackdrop scene={activeScene} />
                    {!isFocusMode && (
                        <PortraitArea
                            lang={lang}
                            scene={activeScene}
                            latestEnemyLog={activeEnemyLog || undefined}
                            resolvedWeakPointIds={activeResolvedWeakPointIds}
                            inspectedWeakPointIds={activeInspectedWeakPointIds}
                            forcedRoundIntro={openingRoundIntro}
                            onForcedRoundIntroComplete={onOpeningRoundIntroComplete}
                            selectedEvidence={selectedEvidence}
                            onInspect={canInspectWeakPoints ? onInspectWeakPoint : undefined}
                            onObjection={(statement, weakPointId) => {
                                if (selectedEvidence) {
                                    const evidenceToUse = selectedEvidence;
                                    setSelectedEvidence(null);
                                    onUseEvidence(evidenceToUse, statement, weakPointId);
                                }
                            }}
                        />
                    )}

                    {isFocusMode && focusDialogue && (
                        <AvgDialoguePanel
                            lang={lang}
                            line={focusDialogue.lines[focusDialogue.index]}
                            scene={activeScene}
                            onNext={onAdvanceFocusDialogue}
                        />
                    )}

                    {!shouldShowLoadPanel && prefetchNotice && onRetryPrefetch && (
                        <div className="prefetch-recovery-panel">
                            <div className="prefetch-recovery-title">{prefetchNotice.title}</div>
                            <div className="prefetch-recovery-message">{prefetchNotice.message}</div>
                            <button
                                type="button"
                                className="prefetch-recovery-btn"
                                onClick={onRetryPrefetch}
                            >
                                {prefetchNotice.buttonLabel}
                            </button>
                        </div>
                    )}
                </div>

                {!isFocusMode && <LogViewer logs={logs} />}
            </div>

            {!isFocusMode && (
                <Sidebar
                    evidenceMap={evidenceMap}
                    lang={lang}
                    selectedEvidence={selectedEvidence}
                    onSelectEvidence={setSelectedEvidence}
                    showTooltip={showTooltip}
                    hideTooltip={hideTooltip}
                />
            )}
        </div>
    );
};
