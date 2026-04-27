import React, { useMemo, useState } from 'react';
import type { Language } from '../types';

interface DevConsoleRoundSpoilerEntry {
    id: string;
    statement: string;
    kind: 'real' | 'inspect' | 'fake' | 'hidden';
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

interface DevConsoleRoundSpoilerData {
    available: boolean;
    roundIndex?: number;
    isFinalRound?: boolean;
    inventoryNames: string[];
    usedEvidenceNames: string[];
    entries: DevConsoleRoundSpoilerEntry[];
    remainingRealWeakPointIds: string[];
    grantedEvidencePool: Array<{
        name: string;
        sourceWeakPointId: string;
        sourceKind: 'real' | 'inspect' | 'fake' | 'hidden';
        obtained: boolean;
        currentlyHeld: boolean;
    }>;
}

interface DevConsoleAiProgressData {
    sourceTurnIndex: number | null;
    targetTurnIndex: number | null;
    status: 'idle' | 'working' | 'ready' | 'consumed' | 'discarded' | 'failed';
    stage: 'seed' | 'core' | 'outcomes' | null;
    phase: 'request' | 'validate' | 'accepted' | null;
    stageLabel: string | null;
    attempt: number | null;
    maxAttempts: number | null;
    inventoryNames: string[];
    error: string | null;
    updatedAt: number | null;
}

interface DevConsoleRecoveryData {
    hasTurnCheckpoint: boolean;
    turnCheckpointTurnIndex: number | null;
    hasCaseCheckpoint: boolean;
    caseCheckpointTurnIndex: number | null;
    compiledTurnCount: number;
    totalTurnCount: number | null;
    prefetchStatus: 'idle' | 'working' | 'ready';
    prefetchTargetTurnIndex: number | null;
    cacheRetentionMode: 'preserved' | 'fresh_only';
}

interface DevConsoleProps {
    isOpen: boolean;
    lang: Language;
    logs: string[];
    roundSpoiler: DevConsoleRoundSpoilerData;
    aiProgress: DevConsoleAiProgressData;
    recovery: DevConsoleRecoveryData;
    onClose: () => void;
    onClear: () => void;
    onDownload: () => void;
}

interface ParsedDevLog {
    raw: string;
    type: string;
    time: string;
    body: string;
    parsedJson: unknown | null;
}

type DevTab = 'round' | 'events';

const IMPORTANT_LOG_TYPES = new Set([
    'ERROR',
    'AI-VALIDATION',
    'AI-STAGE',
    'ROUND-DRAFT',
    'ACTION-RESOLVE',
    'ROUND-PROGRESS',
    'TURN-RESULT',
    'OUTCOME-NORMALIZE'
]);

const DEV_UI = {
    zh: {
        title: '>> 开发者模式 <<',
        tabs: {
            round: '透题',
            events: '日志'
        },
        buttons: {
            collapse: '收起',
            expand: '展开',
            download: '下载',
            clear: '清空',
            close: '关闭'
        },
        summary: {
            currentStage: '当前阶段',
            lastError: '最近错误',
            lastAction: '最近操作',
            turnResult: '本次结算',
            draftCache: '草稿缓存',
            roundMap: '当前轮透题'
        },
        values: {
            idle: '空闲',
            none: '无',
            unavailable: '暂无',
            allCleared: '已全部解决',
            empty: '空',
            held: '当前持有',
            obtained: '已获得',
            missing: '未获得',
            finalRound: '终局',
            notInspectable: '不可调查',
            alreadyInspected: '已调查',
            notInspectedYet: '未调查',
            jsonPayload: 'JSON 数据'
        },
        round: {
            currentRound: '当前轮次',
            remainingRealWeakPoints: '剩余真破绽',
            currentInventory: '当前证据',
            usedEvidence: '已消耗证据',
            nextSteps: '建议下一步',
            unresolvedTargets: '还没击破的真破绽',
            inspectQueue: '还可调查的点',
            missingDiscoveries: '还没拿到的掉落证据',
            weakPointMap: '破绽总览',
            discoverableEvidences: '调查掉落证据',
            expectedEvidence: '对应证据',
            inspectStatus: '调查状态',
            grantedEvidences: '可掉落证据',
            noRoundData: '当前还没有可用的回合剧本包。等 AI / 本地剧本把这一轮装载完成后，这里会直接显示破绽映射和调查链。',
            noDiscoverableEvidence: '当前轮没有额外调查掉落证据。',
            noPendingTargets: '当前没有剩余真破绽。',
            noInspectTargets: '当前没有可调查点，下一步应直接论破真破绽。',
            noMissingDiscoveries: '当前轮所有调查掉落证据都已经拿到。',
            from: '来源',
            recommendedTarget: '建议打',
            recommendedInspect: '建议查'
        },
        tags: {
            real: '真破绽',
            inspect: '调查点',
            fake: '假点',
            hidden: '隐藏点',
            revealed: '已揭示',
            unrevealed: '未揭示',
            canInspect: '可调查',
            inspected: '已调查',
            resolved: '已击破'
        }
    },
    ja: {
        title: '>> DEV CONSOLE <<',
        tabs: {
            round: 'ネタバレ',
            events: 'ログ'
        },
        buttons: {
            collapse: '折りたたむ',
            expand: '展開',
            download: '保存',
            clear: '消去',
            close: '閉じる'
        },
        summary: {
            currentStage: '現在段階',
            lastError: '最新エラー',
            lastAction: '最新操作',
            turnResult: '今回結果',
            draftCache: 'ドラフト',
            roundMap: '現在ラウンド'
        },
        values: {
            idle: '待機中',
            none: 'なし',
            unavailable: '未生成',
            allCleared: 'すべて解決済み',
            empty: '空',
            held: '所持中',
            obtained: '取得済み',
            missing: '未取得',
            finalRound: '最終ラウンド',
            notInspectable: '調査不可',
            alreadyInspected: '調査済み',
            notInspectedYet: '未調査',
            jsonPayload: 'JSON データ'
        },
        round: {
            currentRound: '現在ラウンド',
            remainingRealWeakPoints: '残り真破綻',
            currentInventory: '現在証拠',
            usedEvidence: '消費済み証拠',
            nextSteps: '次の候補',
            unresolvedTargets: '未解決の真破綻',
            inspectQueue: 'まだ調査できる点',
            missingDiscoveries: '未取得の追加証拠',
            weakPointMap: '破綻一覧',
            discoverableEvidences: '調査で得られる証拠',
            expectedEvidence: '対応証拠',
            inspectStatus: '調査状態',
            grantedEvidences: '獲得候補証拠',
            noRoundData: 'まだ利用可能なラウンドパッケージがありません。AI / ローカル台本の読み込み完了後、ここに破綻対応表が表示されます。',
            noDiscoverableEvidence: 'このラウンドには追加の調査証拠がありません。',
            noPendingTargets: '残っている真破綻はありません。',
            noInspectTargets: '調査可能な点は残っていません。次は真破綻を撃つ段階です。',
            noMissingDiscoveries: 'このラウンドの追加証拠はすべて取得済みです。',
            from: '出所',
            recommendedTarget: '次に撃つ候補',
            recommendedInspect: '次に調査する候補'
        },
        tags: {
            real: '真破綻',
            inspect: '調査点',
            fake: 'ダミー',
            hidden: '隠し',
            revealed: '表示済み',
            unrevealed: '未表示',
            canInspect: '調査可',
            inspected: '調査済み',
            resolved: '論破済み'
        }
    },
    en: {
        title: '>> DEV CONSOLE <<',
        tabs: {
            round: 'MAP',
            events: 'LOG'
        },
        buttons: {
            collapse: 'MIN',
            expand: 'EXPAND',
            download: 'DL',
            clear: 'CLR',
            close: 'X'
        },
        summary: {
            currentStage: 'Current Stage',
            lastError: 'Last Error',
            lastAction: 'Last Action',
            turnResult: 'Turn Result',
            draftCache: 'Draft Cache',
            roundMap: 'Round Map'
        },
        values: {
            idle: 'Idle',
            none: 'None',
            unavailable: 'Unavailable',
            allCleared: 'All cleared',
            empty: 'Empty',
            held: 'Held',
            obtained: 'Obtained',
            missing: 'Missing',
            finalRound: 'FINAL',
            notInspectable: 'Not inspectable',
            alreadyInspected: 'Already inspected',
            notInspectedYet: 'Not inspected yet',
            jsonPayload: 'JSON payload'
        },
        round: {
            currentRound: 'Current Round',
            remainingRealWeakPoints: 'Remaining Real Weak Points',
            currentInventory: 'Current Inventory',
            usedEvidence: 'Used Evidence',
            nextSteps: 'Suggested Next Steps',
            unresolvedTargets: 'Remaining solvable weak points',
            inspectQueue: 'Inspectable points left',
            missingDiscoveries: 'Still-missing dropped evidence',
            weakPointMap: 'Weak Point Map',
            discoverableEvidences: 'Discoverable Evidences',
            expectedEvidence: 'Expected Evidence',
            inspectStatus: 'Inspect Status',
            grantedEvidences: 'Granted Evidences',
            noRoundData: 'No active round package is available yet. Once AI / local parsing finishes loading the current round, the weak-point mapping will appear here.',
            noDiscoverableEvidence: 'No extra inspect-drop evidences exist in this round.',
            noPendingTargets: 'There are no remaining real weak points.',
            noInspectTargets: 'No inspectable points remain. The next step should be solving a real weak point.',
            noMissingDiscoveries: 'All discoverable evidences for this round have already been obtained.',
            from: 'from',
            recommendedTarget: 'Recommended hit',
            recommendedInspect: 'Recommended inspect'
        },
        tags: {
            real: 'REAL',
            inspect: 'INSPECT',
            fake: 'FAKE',
            hidden: 'HIDDEN',
            revealed: 'REVEALED',
            unrevealed: 'UNREVEALED',
            canInspect: 'CAN INSPECT',
            inspected: 'INSPECTED',
            resolved: 'RESOLVED'
        }
    }
} as const;

const parseDevLog = (raw: string): ParsedDevLog => {
    const match = raw.match(/^\[([^\]]+)\]\s+([0-9:]+)\s+-\s+([\s\S]*)$/);
    const type = match?.[1] || 'LOG';
    const time = match?.[2] || '--:--:--';
    const body = match?.[3] || raw;
    const trimmed = body.trim();

    let parsedJson: unknown | null = null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            parsedJson = JSON.parse(trimmed);
        } catch {
            parsedJson = null;
        }
    }

    return { raw, type, time, body, parsedJson };
};

const formatSummaryValue = (value: unknown, noneText: string) => {
    if (value === null || value === undefined || value === '') {
        return noneText;
    }
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : noneText;
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
};

const getExpectedEvidenceStatusLabel = (
    status: DevConsoleRoundSpoilerEntry['expectedEvidenceState'],
    lang: Language
) => {
    switch (status) {
        case 'held':
            return lang === 'zh'
                ? '\u5f53\u524d\u6301\u6709'
                : lang === 'ja'
                    ? '\u6240\u6301\u4e2d'
                    : 'Held';
        case 'consumed':
            return lang === 'zh'
                ? '\u5df2\u6d88\u8017'
                : lang === 'ja'
                    ? '\u6d88\u8cbb\u6e08\u307f'
                    : 'Consumed';
        case 'discoverable':
            return lang === 'zh'
                ? '\u53ef\u8c03\u67e5\u83b7\u5f97'
                : lang === 'ja'
                    ? '\u8abf\u67fb\u3067\u53d6\u5f97\u53ef'
                    : 'Discoverable';
        case 'missing':
            return lang === 'zh'
                ? '\u4e0d\u53ef\u8fbe'
                : lang === 'ja'
                    ? '\u5230\u9054\u4e0d\u53ef'
                    : 'Unavailable';
        default:
            return lang === 'zh'
                ? '\u6682\u65e0'
                : lang === 'ja'
                    ? '\u306a\u3057'
                    : 'N/A';
    }
};

const getKindSort = (kind: DevConsoleRoundSpoilerEntry['kind']) => {
    switch (kind) {
        case 'real':
            return 0;
        case 'inspect':
            return 1;
        case 'hidden':
            return 2;
        case 'fake':
        default:
            return 3;
    }
};

const buildLogPreview = (entry: ParsedDevLog, jsonPayloadLabel: string) => {
    if (entry.parsedJson && typeof entry.parsedJson === 'object') {
        const payload = entry.parsedJson as Record<string, unknown>;
        if (payload.stage) {
            return String(payload.stage);
        }
        if (payload.error) {
            return String(payload.error);
        }
        if (payload.actionType) {
            return `${String(payload.actionType)} :: ${String(payload.matchedWeakPointId || 'no-match')}`;
        }
        return jsonPayloadLabel;
    }

    return entry.body.split('\n')[0];
};

const buildSummaryRows = (
    entries: ParsedDevLog[],
    roundSpoiler: DevConsoleRoundSpoilerData,
    aiProgress: DevConsoleAiProgressData,
    lang: Language
) => {
    const ui = DEV_UI[lang];
    const latestError = entries.find(entry => entry.type === 'ERROR');
    const latestStage = entries.find(entry => entry.type === 'AI-STAGE' && entry.parsedJson && typeof entry.parsedJson === 'object');
    const latestTurnResult = entries.find(entry => entry.type === 'TURN-RESULT' && entry.parsedJson && typeof entry.parsedJson === 'object');
    const latestActionResolve = entries.find(entry => entry.type === 'ACTION-RESOLVE' && entry.parsedJson && typeof entry.parsedJson === 'object');
    const latestDraft = entries.find(entry => entry.type === 'ROUND-DRAFT' && entry.parsedJson && typeof entry.parsedJson === 'object');

    const stageData = latestStage?.parsedJson && typeof latestStage.parsedJson === 'object' ? latestStage.parsedJson as Record<string, unknown> : null;
    const turnData = latestTurnResult?.parsedJson && typeof latestTurnResult.parsedJson === 'object' ? latestTurnResult.parsedJson as Record<string, unknown> : null;
    const actionData = latestActionResolve?.parsedJson && typeof latestActionResolve.parsedJson === 'object' ? latestActionResolve.parsedJson as Record<string, unknown> : null;
    const draftData = latestDraft?.parsedJson && typeof latestDraft.parsedJson === 'object' ? latestDraft.parsedJson as Record<string, unknown> : null;

    return [
        {
            label: ui.summary.currentStage,
            value: stageData?.stage || latestError?.body || ui.values.idle
        },
        {
            label: ui.summary.lastError,
            value: latestError?.body || ui.values.none
        },
        {
            label: ui.summary.lastAction,
            value: actionData
                ? `${formatSummaryValue(actionData.actionType, ui.values.none)} / ${formatSummaryValue(actionData.matchedWeakPointId, ui.values.none)} / correct=${formatSummaryValue(actionData.isCorrectHit, ui.values.none)}`
                : ui.values.none
        },
        {
            label: ui.summary.turnResult,
            value: turnData
                ? `${formatSummaryValue(turnData.attackType, ui.values.none)} / enemy -${formatSummaryValue(turnData.enemyDamageTaken, ui.values.none)} / round=${formatSummaryValue(turnData.roundStatus, ui.values.none)}`
                : ui.values.none
        },
        {
            label: ui.summary.draftCache,
            value: draftData
                ? `${formatSummaryValue(draftData.action, ui.values.none)} / failed=${formatSummaryValue(draftData.failedStage, ui.values.none)} / seed=${formatSummaryValue(draftData.hasSeed, ui.values.none)} / core=${formatSummaryValue(draftData.hasBlueprint, ui.values.none)}`
                : ui.values.none
        },
        {
            label: 'AI',
            value: aiProgress.targetTurnIndex
                ? `R${aiProgress.targetTurnIndex} / ${aiProgress.status} / ${aiProgress.stageLabel || aiProgress.stage || ui.values.none}`
                : ui.values.none
        },
        {
            label: ui.summary.roundMap,
            value: roundSpoiler.available
                ? `R${roundSpoiler.roundIndex || '?'} / remaining=${roundSpoiler.remainingRealWeakPointIds.length}`
                : ui.values.unavailable
        }
    ];
};

const AI_PROGRESS_UI = {
    zh: {
        title: 'AI 剧本加载进度',
        status: '当前状态',
        stage: '当前阶段',
        target: '目标回合',
        snapshot: '证据快照',
        error: '最近错误',
        idle: '未开始',
        working: '生成中',
        ready: '已缓存',
        consumed: '已接管',
        discarded: '已丢弃',
        failed: '失败'
    },
    ja: {
        title: 'AI 生成進度',
        status: '状態',
        stage: '段階',
        target: '目標ラウンド',
        snapshot: '証拠スナップショット',
        error: '直近エラー',
        idle: '未開始',
        working: '生成中',
        ready: 'キャッシュ済み',
        consumed: '引き継ぎ済み',
        discarded: '破棄済み',
        failed: '失敗'
    },
    en: {
        title: 'AI Generation Progress',
        status: 'Status',
        stage: 'Stage',
        target: 'Target Round',
        snapshot: 'Evidence Snapshot',
        error: 'Last Error',
        idle: 'Idle',
        working: 'Working',
        ready: 'Ready',
        consumed: 'Consumed',
        discarded: 'Discarded',
        failed: 'Failed'
    }
} as const;

const RECOVERY_UI = {
    zh: {
        title: '\u91cd\u542f/\u7f13\u5b58\u72b6\u6001',
        turnCheckpoint: '\u5f53\u524d\u8f6e\u5b58\u6863',
        caseCheckpoint: '\u672c\u5c40\u8d77\u70b9',
        compiledCase: '\u5df2\u751f\u6210\u8f6e\u6b21',
        prefetchCache: '\u540e\u7eed\u8f6e\u7f13\u5b58',
        cacheRetention: '\u7f13\u5b58\u4fdd\u7559',
        available: '\u53ef\u7528',
        missing: '\u65e0',
        preserved: '\u91cd\u5f00\u4fdd\u7559',
        freshOnly: '\u65b0\u6e38\u620f\u624d\u6e05\u7a7a',
        idle: '\u672a\u5f00\u59cb',
        working: '\u751f\u6210\u4e2d',
        ready: '\u5df2\u7f13\u5b58'
    },
    ja: {
        title: '\u30ea\u30b9\u30bf\u30fc\u30c8/\u30ad\u30e3\u30c3\u30b7\u30e5\u72b6\u614b',
        turnCheckpoint: '\u73fe\u5728\u30e9\u30a6\u30f3\u30c9\u4fdd\u5b58',
        caseCheckpoint: '\u30b1\u30fc\u30b9\u958b\u59cb\u70b9',
        compiledCase: '\u751f\u6210\u6e08\u307f\u30e9\u30a6\u30f3\u30c9',
        prefetchCache: '\u6b21\u30e9\u30a6\u30f3\u30c9\u30ad\u30e3\u30c3\u30b7\u30e5',
        cacheRetention: '\u30ad\u30e3\u30c3\u30b7\u30e5\u4fdd\u6301',
        available: '\u5229\u7528\u53ef',
        missing: '\u306a\u3057',
        preserved: '\u518d\u958b\u6642\u3082\u4fdd\u6301',
        freshOnly: '\u65b0\u30b2\u30fc\u30e0\u3067\u306e\u307f\u6d88\u53bb',
        idle: '\u672a\u958b\u59cb',
        working: '\u751f\u6210\u4e2d',
        ready: '\u6e96\u5099\u5b8c\u4e86'
    },
    en: {
        title: 'Restart / Cache State',
        turnCheckpoint: 'Turn Checkpoint',
        caseCheckpoint: 'Case Start',
        compiledCase: 'Compiled Turns',
        prefetchCache: 'Prefetch Cache',
        cacheRetention: 'Cache Retention',
        available: 'Available',
        missing: 'None',
        preserved: 'Kept on restart',
        freshOnly: 'Cleared on fresh game',
        idle: 'Idle',
        working: 'Working',
        ready: 'Ready'
    }
} as const;

const renderAiProgress = (
    aiProgress: DevConsoleAiProgressData,
    recovery: DevConsoleRecoveryData,
    lang: Language
) => {
    const ui = AI_PROGRESS_UI[lang];
    const recoveryUi = RECOVERY_UI[lang];
    const statusLabel = ui[aiProgress.status];
    const stageLabel = aiProgress.stageLabel
        || (aiProgress.stage === 'seed'
            ? '1/3 Seed'
            : aiProgress.stage === 'core'
                ? '2/3 Core'
                : aiProgress.stage === 'outcomes'
                    ? '3/3 Outcomes'
                    : ui.idle);
    const targetLabel = aiProgress.targetTurnIndex
        ? `R${aiProgress.targetTurnIndex}${aiProgress.sourceTurnIndex ? ` <= R${aiProgress.sourceTurnIndex}` : ''}`
        : ui.idle;
    const snapshotLabel = aiProgress.inventoryNames.length > 0
        ? aiProgress.inventoryNames.join(', ')
        : ui.idle;
    const attemptLabel = aiProgress.attempt && aiProgress.maxAttempts
        ? `${statusLabel} (${aiProgress.attempt}/${aiProgress.maxAttempts})`
        : statusLabel;
    const turnCheckpointLabel = recovery.hasTurnCheckpoint
        ? `R${recovery.turnCheckpointTurnIndex ?? '?'} / ${recoveryUi.available}`
        : recoveryUi.missing;
    const caseCheckpointLabel = recovery.hasCaseCheckpoint
        ? `R${recovery.caseCheckpointTurnIndex ?? '?'} / ${recoveryUi.available}`
        : recoveryUi.missing;
    const compiledTurnsLabel = recovery.totalTurnCount
        ? `${recovery.compiledTurnCount}/${recovery.totalTurnCount}`
        : String(recovery.compiledTurnCount);
    const prefetchStatusLabel = recoveryUi[recovery.prefetchStatus];
    const prefetchLabel = recovery.prefetchTargetTurnIndex
        ? `R${recovery.prefetchTargetTurnIndex} / ${prefetchStatusLabel}`
        : recoveryUi.idle;
    const retentionLabel = recovery.cacheRetentionMode === 'preserved'
        ? recoveryUi.preserved
        : recoveryUi.freshOnly;

    return (
        <section className="dev-round-section">
            <div className="dev-round-section-title">{ui.title}</div>
            <div className="dev-round-overview dev-ai-progress-grid">
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.status}</div>
                    <div className="dev-summary-value">{attemptLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.stage}</div>
                    <div className="dev-summary-value">{stageLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.target}</div>
                    <div className="dev-summary-value">{targetLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.snapshot}</div>
                    <div className="dev-summary-value">{snapshotLabel}</div>
                </div>
                {aiProgress.error ? (
                    <div className="dev-round-overview-card wide">
                        <div className="dev-summary-label">{ui.error}</div>
                        <div className="dev-summary-value">{aiProgress.error}</div>
                    </div>
                ) : null}
            </div>
            <div className="dev-round-section-title">{recoveryUi.title}</div>
            <div className="dev-round-overview dev-ai-progress-grid">
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{recoveryUi.turnCheckpoint}</div>
                    <div className="dev-summary-value">{turnCheckpointLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{recoveryUi.caseCheckpoint}</div>
                    <div className="dev-summary-value">{caseCheckpointLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{recoveryUi.compiledCase}</div>
                    <div className="dev-summary-value">{compiledTurnsLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{recoveryUi.prefetchCache}</div>
                    <div className="dev-summary-value">{prefetchLabel}</div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{recoveryUi.cacheRetention}</div>
                    <div className="dev-summary-value">{retentionLabel}</div>
                </div>
            </div>
        </section>
    );
};

const renderRoundSpoiler = (
    roundSpoiler: DevConsoleRoundSpoilerData,
    aiProgress: DevConsoleAiProgressData,
    recovery: DevConsoleRecoveryData,
    lang: Language
) => {
    const ui = DEV_UI[lang];

    if (!roundSpoiler.available) {
        return (
            <div className="dev-round-map">
                {renderAiProgress(aiProgress, recovery, lang)}
                <div className="dev-panel-empty">{ui.round.noRoundData}</div>
            </div>
        );
    }

    const sortedEntries = [...roundSpoiler.entries].sort((a, b) => {
        if (a.resolved !== b.resolved) {
            return a.resolved ? 1 : -1;
        }
        if (a.revealed !== b.revealed) {
            return a.revealed ? -1 : 1;
        }
        return getKindSort(a.kind) - getKindSort(b.kind);
    });

    const unresolvedTargets = sortedEntries.filter(entry => (entry.kind === 'real' || entry.kind === 'hidden') && !entry.resolved);
    const inspectQueue = sortedEntries.filter(entry => entry.canInspect && entry.revealed && !entry.inspected);
    const missingDiscoveries = roundSpoiler.grantedEvidencePool.filter(entry => !entry.obtained);

    return (
        <div className="dev-round-map">
            {renderAiProgress(aiProgress, recovery, lang)}
            <div className="dev-round-overview">
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.round.currentRound}</div>
                    <div className="dev-summary-value">
                        第 {roundSpoiler.roundIndex || '?'} 轮
                        {roundSpoiler.isFinalRound ? ` / ${ui.values.finalRound}` : ''}
                    </div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.round.remainingRealWeakPoints}</div>
                    <div className="dev-summary-value">
                        {roundSpoiler.remainingRealWeakPointIds.length > 0
                            ? roundSpoiler.remainingRealWeakPointIds.join(', ')
                            : ui.values.allCleared}
                    </div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.round.currentInventory}</div>
                    <div className="dev-summary-value">
                        {roundSpoiler.inventoryNames.length > 0 ? roundSpoiler.inventoryNames.join(', ') : ui.values.empty}
                    </div>
                </div>
                <div className="dev-round-overview-card">
                    <div className="dev-summary-label">{ui.round.usedEvidence}</div>
                    <div className="dev-summary-value">
                        {roundSpoiler.usedEvidenceNames.length > 0 ? roundSpoiler.usedEvidenceNames.join(', ') : ui.values.none}
                    </div>
                </div>
            </div>

            <section className="dev-round-section">
                <div className="dev-round-section-title">{ui.round.nextSteps}</div>
                <div className="dev-round-next-grid">
                    <div className="dev-round-overview-card">
                        <div className="dev-summary-label">{ui.round.unresolvedTargets}</div>
                        <div className="dev-summary-value">
                            {unresolvedTargets.length > 0
                                ? unresolvedTargets
                                    .map(entry => `${entry.id} -> ${entry.expectedEvidenceName || ui.values.none} / ${getExpectedEvidenceStatusLabel(entry.expectedEvidenceState, lang)}`)
                                    .join('\n')
                                : ui.round.noPendingTargets}
                        </div>
                    </div>
                    <div className="dev-round-overview-card">
                        <div className="dev-summary-label">{ui.round.inspectQueue}</div>
                        <div className="dev-summary-value">
                            {inspectQueue.length > 0
                                ? inspectQueue.map(entry => `${entry.id}`).join(', ')
                                : ui.round.noInspectTargets}
                        </div>
                    </div>
                    <div className="dev-round-overview-card">
                        <div className="dev-summary-label">{ui.round.missingDiscoveries}</div>
                        <div className="dev-summary-value">
                            {missingDiscoveries.length > 0
                                ? missingDiscoveries
                                    .map(entry => `${entry.name} (${ui.round.from} ${entry.sourceWeakPointId})`)
                                    .join('\n')
                                : ui.round.noMissingDiscoveries}
                        </div>
                    </div>
                </div>
            </section>

            <section className="dev-round-section">
                <div className="dev-round-section-title">{ui.round.weakPointMap}</div>
                <div className="dev-round-entry-list">
                    {sortedEntries.map(entry => (
                        <article key={entry.id} className={`dev-round-entry kind-${entry.kind}${entry.resolved ? ' resolved' : ''}${entry.revealed ? '' : ' hidden-entry'}`}>
                            <div className="dev-round-entry-header">
                                <div className="dev-round-entry-id">{entry.id}</div>
                                <div className="dev-round-entry-tags">
                                    <span className={`dev-round-tag kind-${entry.kind}`}>{ui.tags[entry.kind]}</span>
                                    {entry.revealed ? (
                                        <span className="dev-round-tag status-revealed">{ui.tags.revealed}</span>
                                    ) : (
                                        <span className="dev-round-tag status-hidden">{ui.tags.unrevealed}</span>
                                    )}
                                    {entry.canInspect ? (
                                        <span className={`dev-round-tag ${entry.inspected ? 'status-done' : 'status-pending'}`}>
                                            {entry.inspected ? ui.tags.inspected : ui.tags.canInspect}
                                        </span>
                                    ) : null}
                                    {entry.resolved ? (
                                        <span className="dev-round-tag status-done">{ui.tags.resolved}</span>
                                    ) : null}
                                </div>
                            </div>
                            <div className="dev-round-statement">{entry.statement}</div>
                            <div className="dev-round-meta-grid">
                                <div className="dev-round-meta-card">
                                    <div className="dev-summary-label">{ui.round.expectedEvidence}</div>
                                    <div className="dev-summary-value">
                                        {entry.expectedEvidenceName
                                            ? `${entry.expectedEvidenceName} / ${getExpectedEvidenceStatusLabel(entry.expectedEvidenceState, lang)}`
                                            : ui.values.none}
                                    </div>
                                </div>
                                <div className="dev-round-meta-card">
                                    <div className="dev-summary-label">{ui.round.inspectStatus}</div>
                                    <div className="dev-summary-value">
                                        {entry.canInspect ? (entry.inspected ? ui.values.alreadyInspected : ui.values.notInspectedYet) : ui.values.notInspectable}
                                    </div>
                                </div>
                            </div>
                            {entry.grantedEvidences.length > 0 ? (
                                <div className="dev-round-grants">
                                    <div className="dev-summary-label">{ui.round.grantedEvidences}</div>
                                    <div className="dev-round-grant-list">
                                        {entry.grantedEvidences.map(evidence => (
                                            <div key={`${entry.id}-${evidence.name}`} className="dev-round-grant-item">
                                                <span>{evidence.name}</span>
                                                <span className="dev-round-grant-state">
                                                    {evidence.currentlyHeld
                                                        ? ui.values.held
                                                        : evidence.obtained
                                                            ? ui.values.obtained
                                                            : ui.values.missing}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </article>
                    ))}
                </div>
            </section>

            <section className="dev-round-section">
                <div className="dev-round-section-title">{ui.round.discoverableEvidences}</div>
                {roundSpoiler.grantedEvidencePool.length > 0 ? (
                    <div className="dev-round-grant-pool">
                        {roundSpoiler.grantedEvidencePool.map(entry => (
                            <div key={`${entry.sourceWeakPointId}-${entry.name}`} className="dev-round-grant-pool-item">
                                <div>
                                    <div className="dev-round-grant-name">{entry.name}</div>
                                    <div className="dev-round-grant-source">
                                        {ui.round.from} {entry.sourceWeakPointId} / {ui.tags[entry.sourceKind]}
                                    </div>
                                </div>
                                <div className="dev-round-grant-state">
                                    {entry.currentlyHeld ? ui.values.held : entry.obtained ? ui.values.obtained : ui.values.missing}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="dev-panel-empty">{ui.round.noDiscoverableEvidence}</div>
                )}
            </section>
        </div>
    );
};

export const DevConsole: React.FC<DevConsoleProps> = ({
    isOpen,
    lang,
    logs,
    roundSpoiler,
    aiProgress,
    recovery,
    onClose,
    onClear,
    onDownload
}) => {
    const [activeTab, setActiveTab] = useState<DevTab>('round');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const ui = DEV_UI[lang];
    const parsedLogs = useMemo(() => logs.map(parseDevLog), [logs]);
    const summaryRows = useMemo(() => buildSummaryRows(parsedLogs, roundSpoiler, aiProgress, lang), [parsedLogs, roundSpoiler, aiProgress, lang]);

    if (!isOpen) return null;

    return (
        <div id="dev-console" className={`open${isCollapsed ? ' collapsed' : ''}`}>
            <div className="dev-console-header">
                <strong>{ui.title}</strong>
                <div className="dev-console-actions">
                    {!isCollapsed && (
                        <>
                            <button
                                onClick={() => setActiveTab('round')}
                                className={`dev-btn dev-tab-btn${activeTab === 'round' ? ' active' : ''}`}
                            >
                                {ui.tabs.round}
                            </button>
                            <button
                                onClick={() => setActiveTab('events')}
                                className={`dev-btn dev-tab-btn${activeTab === 'events' ? ' active' : ''}`}
                            >
                                {ui.tabs.events}
                            </button>
                            <button onClick={onDownload} className="dev-btn">{ui.buttons.download}</button>
                            <button onClick={onClear} className="dev-btn">{ui.buttons.clear}</button>
                        </>
                    )}
                    <button onClick={() => setIsCollapsed(prev => !prev)} className="dev-btn">
                        {isCollapsed ? ui.buttons.expand : ui.buttons.collapse}
                    </button>
                    <button onClick={onClose} className="dev-btn">{ui.buttons.close}</button>
                </div>
            </div>

            {isCollapsed ? (
                <div className="dev-collapsed-bar">
                    <span>{summaryRows[0]?.label}: {formatSummaryValue(summaryRows[0]?.value, ui.values.none)}</span>
                    <span>{summaryRows[5]?.label}: {formatSummaryValue(summaryRows[5]?.value, ui.values.none)}</span>
                    <span>{summaryRows[6]?.label}: {formatSummaryValue(summaryRows[6]?.value, ui.values.none)}</span>
                </div>
            ) : (
                <>
                    <div className="dev-summary-grid">
                        {summaryRows.map(row => (
                            <div key={row.label} className="dev-summary-card">
                                <div className="dev-summary-label">{row.label}</div>
                                <div className="dev-summary-value">{formatSummaryValue(row.value, ui.values.none)}</div>
                            </div>
                        ))}
                    </div>

                    <div id="dev-content">
                        {activeTab === 'round' ? renderRoundSpoiler(roundSpoiler, aiProgress, recovery, lang) : parsedLogs.map((entry, index) => {
                            const isJson = entry.parsedJson !== null;
                            const isImportant = IMPORTANT_LOG_TYPES.has(entry.type);
                            const defaultOpen = entry.type === 'ERROR' || entry.type === 'AI-VALIDATION' || entry.type === 'TURN-RESULT' || entry.type === 'ACTION-RESOLVE';

                            return (
                                <details
                                    key={`${entry.time}-${entry.type}-${index}`}
                                    className={`dev-log-card${isImportant ? ' important' : ''}`}
                                    open={defaultOpen}
                                >
                                    <summary className="dev-log-summary">
                                        <span className={`dev-log-type dev-log-type-${entry.type.toLowerCase()}`}>{entry.type}</span>
                                        <span className="dev-log-time">{entry.time}</span>
                                        <span className="dev-log-preview">{buildLogPreview(entry, ui.values.jsonPayload)}</span>
                                    </summary>
                                    <div className="dev-log-body">
                                        {isJson ? (
                                            <pre>{JSON.stringify(entry.parsedJson, null, 2)}</pre>
                                        ) : (
                                            <pre>{entry.body}</pre>
                                        )}
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
};
