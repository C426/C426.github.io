import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Language } from '../types';
import {
    cloneLocalCaseData,
    createBlankAvgDialogueLine,
    createBlankLocalCaseData,
    createBlankLocalEvidence,
    createBlankLocalTurn,
    createBlankLocalizedText,
    ensureCaseFilename,
    normalizeLocalCaseText,
    serializeLocalCaseText
} from '../services/localCaseFormatter';
import {
    buildMarkedText,
    encodeWeakPointMarker,
    parseWeakPointMarkers,
    stripWeakPointMarkers,
    WeakPointMarker
} from '../services/localCaseMarkers';
import { LocalCaseOption } from '../services/localCaseLibrary';
import { textFor } from '../services/localCaseParser';
import { LocalCaseWorkspaceInfo, saveCaseFileAs, saveWorkspaceCaseFile } from '../services/localCaseWorkspace';
import { getBackgroundPackById, getBackgroundPackOptions, getPortraitPackOptions } from '../services/sceneAssetLibrary';
import {
    BACKGROUND_SLOTS,
    PORTRAIT_MOTIONS,
    PORTRAIT_STATES,
    SCENE_TRANSITIONS,
    SCREEN_FILTERS,
    SCREEN_IMPULSES,
    BackgroundSlot,
    PortraitMotion,
    PortraitState,
    SceneTransition,
    ScreenFilter,
    ScreenImpulse
} from '../services/sceneAssetTypes';
import {
    AvgLine,
    FailureReason,
    LocalCaseData,
    LocalDialogueCard,
    LocalWeakPoint,
    LocalizedText,
    UnlockMode
} from '../services/localCaseTypes';

type EditorView = 'case' | 'evidence' | 'turn' | 'victory' | 'import';
interface LocalCaseWorkshopProps {
    lang: Language;
    isOpen: boolean;
    localCases: LocalCaseOption[];
    selectedCase: LocalCaseOption | null;
    workspaceInfo: LocalCaseWorkspaceInfo;
    onClose: () => void;
    onLinkWorkspace: () => Promise<void>;
    onCasesSaved: (preferredCaseId?: string) => Promise<void>;
    onSelectCase: (caseId: string) => void;
}

interface WorkshopDraft {
    filename: string;
    caseData: LocalCaseData;
}

interface WeakPointContextMenuState {
    x: number;
    y: number;
    lineId: string;
    selectedText: string;
    weakPointId?: string;
    start?: number;
    end?: number;
    action: 'set' | 'unset';
}

const LANGS: Language[] = ['zh', 'ja', 'en'];
const LANG_LABELS: Record<Language, string> = {
    zh: '中文',
    ja: '日本語',
    en: 'English'
};
const FAIL_REASONS: FailureReason[] = ['wrongEvidence', 'wrongStatement', 'bothWrong'];
const VIEW_ORDER: EditorView[] = ['case', 'evidence', 'turn', 'victory', 'import'];

const displayText = (value: LocalizedText, lang: Language, fallback: Language) => textFor(value, lang, fallback);
const editValue = (value: LocalizedText, lang: Language) => value[lang] || '';
const editDialogueValue = (value: LocalizedText, lang: Language) => stripWeakPointMarkers(editValue(value, lang));

const blankDraft = (): WorkshopDraft => {
    const caseData = createBlankLocalCaseData();
    return {
        filename: ensureCaseFilename(caseData.caseId, caseData.caseId),
        caseData
    };
};

const draftFromOption = (option: LocalCaseOption): WorkshopDraft => ({
    filename: option.filename,
    caseData: cloneLocalCaseData(option.caseData)
});

const WORKSHOP_I18N = {
    zh: {
        title: '剧本工坊',
        subtitle: '在证词文本中选中要设为破绽的片段，然后点击鼠标右键。',
        newCase: '新建',
        save: '保存',
        saveCopy: '保存为本地副本',
        saveAs: '另存为',
        close: '关闭',
        caseLibrary: '剧本列表',
        noCases: '未找到剧本',
        tabs: {
            case: '案件',
            evidence: '证据',
            turn: '回合',
            victory: '结局',
            import: '导入'
        },
        fields: {
            filename: '文件名',
            sourceOrigin: '当前来源',
            sourceLocation: '文件位置',
            caseId: '案件 ID',
            defaultLang: '默认语言',
            caseTitle: '案件标题',
            suspectName: '嫌疑人名称',
            introNarrative: '案件介绍',
            systemMessage: '系统提示',
            evidenceId: '证据 ID',
            evidenceName: '证据名称',
            evidenceDetail: '证据详情',
            speaker: '发言方',
            text: '文本',
            linkedEvidence: '关联证据',
            successNarrative: '论破成功旁白',
            logicExplanation: '逻辑说明',
            endingSummary: '结案总结',
            confession: '自白',
            rawCaseTxt: '原始剧本文本'
        },
        speakers: {
            hero: '主角',
            enemy: '嫌疑人',
            system: '系统'
        },
        sourceLabels: {
            workspace: '自定义',
            builtin: '内置'
        },
        turn: {
            testimonyPage: '证词页',
            resolutionPage: '论破后对话',
            currentWeakPoint: '当前破绽',
            evidenceLinked: '已关联证据',
            fakeUnlinked: '虚假破绽 / 未关联',
            weakPointHelp: '提示：先在证词里选中文字，再右键把它设为本语言的破绽。',
            testimonyLines: '证词台词',
            queryFeedback: '调查反馈',
            successFlow: '成功分支',
            interferenceWindows: '干扰弹窗',
            endingAvg: '结局对话'
        },
        failures: {
            wrongEvidence: '证据错误',
            wrongStatement: '破绽错误',
            bothWrong: '证据与破绽都错误'
        },
        actions: {
            addLine: '新增文本',
            remove: '删除',
            addEvidence: '新增证据',
            removeEvidence: '删除证据',
            addTurn: '新增回合',
            removeTurn: '删除回合',
            setWeakPoint: '设置为破绽',
            unsetWeakPoint: '取消设定为破绽',
            buildTxt: '生成文本',
            normalizeTxt: '整理文本'
        },
        importHelp: '把完整的 .case.txt 剧本文本粘贴到这里。点击“整理文本”后，系统会检查格式并同步回可视化编辑器。',
        emptyWeakPoint: '尚未设置破绽',
        status: {
            caseLoaded: '已载入剧本',
            blankCaseReady: '空白剧本已就绪',
            weakPointUpdated: '破绽已更新',
            weakPointCleared: '已取消破绽设定',
            selectTextFirst: '请先在证词文本中选中一段内容，再点击鼠标右键。',
            txtNormalized: '剧本文本已整理完成',
            txtGenerated: '已根据可视化编辑器生成文本',
            chooseSaveFolder: '请先选择一个保存目录来写入剧本文件。',
            caseSaved: (filename: string) => `剧本已保存 // ${filename}`,
            caseSavedAsLocalCopy: (filename: string) => `已保存为本地副本 // ${filename}`,
            caseSavedAs: (filename: string) => `剧本已另存为 // ${filename}`
        },
        line: {
            turn: (index: number) => `第 ${index} 轮`,
            evidence: (index: number) => `证据 ${index}`,
            item: (index: number) => `文本 #${index}`,
            query: (index: number) => `反馈 #${index}`,
            interference: (index: number) => `干扰弹窗 #${index}`,
            avg: (speaker: string, index: number) => `${speaker} #${index}`
        }
    },
    ja: {
        title: 'シナリオ工房',
        subtitle: '証言テキスト内で弱点にしたい箇所を選択し、右クリックしてください。',
        newCase: '新規',
        save: '保存',
        saveCopy: 'ローカル複製として保存',
        saveAs: '別名で保存',
        close: '閉じる',
        caseLibrary: 'シナリオ一覧',
        noCases: 'シナリオが見つかりません',
        tabs: {
            case: '案件',
            evidence: '証拠',
            turn: 'ラウンド',
            victory: '結末',
            import: '取込'
        },
        fields: {
            filename: 'ファイル名',
            sourceOrigin: '現在のソース',
            sourceLocation: 'ファイル位置',
            caseId: '案件 ID',
            defaultLang: '既定言語',
            caseTitle: '案件タイトル',
            suspectName: '容疑者名',
            introNarrative: '導入ナレーション',
            systemMessage: 'システムメッセージ',
            evidenceId: '証拠 ID',
            evidenceName: '証拠名',
            evidenceDetail: '証拠詳細',
            speaker: '話者',
            text: '本文',
            linkedEvidence: '関連証拠',
            successNarrative: '成功ナレーション',
            logicExplanation: 'ロジック説明',
            endingSummary: 'エンディング概要',
            confession: '自白',
            rawCaseTxt: '元のシナリオテキスト'
        },
        speakers: {
            hero: '主人公',
            enemy: '容疑者',
            system: 'システム'
        },
        sourceLabels: {
            workspace: 'ローカル',
            builtin: '内蔵'
        },
        turn: {
            testimonyPage: '証言ページ',
            resolutionPage: '論破後会話',
            currentWeakPoint: '現在の弱点',
            evidenceLinked: '証拠リンク済み',
            fakeUnlinked: '偽の弱点 / 未リンク',
            weakPointHelp: 'ヒント：証言内の文字列を選択してから右クリックすると、この言語の弱点として設定できます。',
            testimonyLines: '証言テキスト',
            queryFeedback: '調査フィードバック',
            successFlow: '成功フロー',
            interferenceWindows: '妨害ウィンドウ',
            endingAvg: 'エンディング会話'
        },
        failures: {
            wrongEvidence: '証拠ミス',
            wrongStatement: '弱点ミス',
            bothWrong: '証拠と弱点の両方ミス'
        },
        actions: {
            addLine: '行を追加',
            remove: '削除',
            addEvidence: '証拠を追加',
            removeEvidence: '証拠を削除',
            addTurn: 'ラウンド追加',
            removeTurn: 'ラウンド削除',
            setWeakPoint: '弱点に設定',
            unsetWeakPoint: '弱点設定を解除',
            buildTxt: 'TXT 生成',
            normalizeTxt: 'TXT 整形'
        },
        importHelp: '完全な .case.txt シナリオをここに貼り付けてください。「TXT 整形」を押すと、形式を確認してビジュアルエディタへ反映します。',
        emptyWeakPoint: 'まだ弱点が設定されていません',
        status: {
            caseLoaded: 'シナリオを読み込みました',
            blankCaseReady: '空のシナリオを用意しました',
            weakPointUpdated: '弱点を更新しました',
            weakPointCleared: '弱点設定を解除しました',
            selectTextFirst: '先に証言テキストの一部を選択してから右クリックしてください。',
            txtNormalized: 'TXT を整形しました',
            txtGenerated: 'ビジュアルエディタから TXT を生成しました',
            chooseSaveFolder: '先に保存先フォルダを選択してください。',
            caseSaved: (filename: string) => `保存完了 // ${filename}`,
            caseSavedAsLocalCopy: (filename: string) => `ローカル複製を保存しました // ${filename}`,
            caseSavedAs: (filename: string) => `別名保存完了 // ${filename}`
        },
        line: {
            turn: (index: number) => `ラウンド ${index}`,
            evidence: (index: number) => `証拠 ${index}`,
            item: (index: number) => `行 #${index}`,
            query: (index: number) => `フィードバック #${index}`,
            interference: (index: number) => `妨害 #${index}`,
            avg: (speaker: string, index: number) => `${speaker} #${index}`
        }
    },
    en: {
        title: 'Script Workshop',
        subtitle: 'Select the testimony text you want to mark as a weak point, then right-click.',
        newCase: 'New',
        save: 'Save',
        saveCopy: 'Save Local Copy',
        saveAs: 'Save As',
        close: 'Close',
        caseLibrary: 'Case Library',
        noCases: 'No cases found',
        tabs: {
            case: 'Case',
            evidence: 'Evidence',
            turn: 'Turn',
            victory: 'Victory',
            import: 'Import'
        },
        fields: {
            filename: 'Filename',
            sourceOrigin: 'Current Source',
            sourceLocation: 'File Location',
            caseId: 'Case ID',
            defaultLang: 'Default Language',
            caseTitle: 'Case Title',
            suspectName: 'Suspect Name',
            introNarrative: 'Intro Narrative',
            systemMessage: 'System Message',
            evidenceId: 'Evidence ID',
            evidenceName: 'Evidence Name',
            evidenceDetail: 'Evidence Detail',
            speaker: 'Speaker',
            text: 'Text',
            linkedEvidence: 'Linked Evidence',
            successNarrative: 'Success Narrative',
            logicExplanation: 'Logic Explanation',
            endingSummary: 'Ending Summary',
            confession: 'Confession',
            rawCaseTxt: 'Raw Case TXT'
        },
        speakers: {
            hero: 'Hero',
            enemy: 'Enemy',
            system: 'System'
        },
        sourceLabels: {
            workspace: 'Local',
            builtin: 'Built-in'
        },
        turn: {
            testimonyPage: 'Testimony Page',
            resolutionPage: 'Resolution Page',
            currentWeakPoint: 'Current Weak Point',
            evidenceLinked: 'Evidence Linked',
            fakeUnlinked: 'Fake / Unlinked',
            weakPointHelp: 'Tip: select text inside the testimony, then right-click to mark that segment as the weak point for this language.',
            testimonyLines: 'Testimony Lines',
            queryFeedback: 'Query Feedback',
            successFlow: 'Success Flow',
            interferenceWindows: 'Interference Windows',
            endingAvg: 'Ending AVG'
        },
        failures: {
            wrongEvidence: 'Wrong Evidence',
            wrongStatement: 'Wrong Weak Point',
            bothWrong: 'Both Wrong'
        },
        actions: {
            addLine: 'Add Line',
            remove: 'Remove',
            addEvidence: 'Add Evidence',
            removeEvidence: 'Remove Evidence',
            addTurn: 'Add Turn',
            removeTurn: 'Remove Turn',
            setWeakPoint: 'Set As Weak Point',
            unsetWeakPoint: 'Clear Weak Point',
            buildTxt: 'Build TXT',
            normalizeTxt: 'Normalize TXT'
        },
        importHelp: 'Paste a full .case.txt script here. Choose Normalize TXT and the system will validate it and sync it back into the visual editor.',
        emptyWeakPoint: 'No weak point selected yet',
        status: {
            caseLoaded: 'Case loaded',
            blankCaseReady: 'Blank case ready',
            weakPointUpdated: 'Weak point updated',
            weakPointCleared: 'Weak point cleared',
            selectTextFirst: 'Select text inside a testimony card first, then right-click.',
            txtNormalized: 'TXT normalized',
            txtGenerated: 'TXT generated from the visual editor',
            chooseSaveFolder: 'Choose a save folder before writing this case file.',
            caseSaved: (filename: string) => `Case saved // ${filename}`,
            caseSavedAsLocalCopy: (filename: string) => `Local copy saved // ${filename}`,
            caseSavedAs: (filename: string) => `Case saved as // ${filename}`
        },
        line: {
            turn: (index: number) => `Turn ${index}`,
            evidence: (index: number) => `Evidence ${index}`,
            item: (index: number) => `Line #${index}`,
            query: (index: number) => `Query #${index}`,
            interference: (index: number) => `Interference #${index}`,
            avg: (speaker: string, index: number) => `${speaker} #${index}`
        }
    }
} as const;

type WorkshopText = typeof WORKSHOP_I18N.en;

const speakerLabel = (speaker: AvgLine['speaker'], labels: WorkshopText['speakers']) => labels[speaker];
const hasAnyLocalizedText = (value: LocalizedText | undefined) =>
    Boolean(value && LANGS.some(lang => (value[lang] || '').trim().length > 0));

const removeMarkerById = (value: string, weakPointId: string) => {
    const parsed = parseWeakPointMarkers(value);
    const remaining = parsed.markers.filter(marker => marker.id !== weakPointId);
    return buildMarkedText(parsed.plain, remaining);
};

interface HighlightedDialogueInputProps {
    rawValue: string;
    plainValue: string;
    placeholder: string;
    markerToneById: Record<string, 'linked' | 'fake'>;
    onChange: (value: string) => void;
    onContextMenu: (event: React.MouseEvent<HTMLTextAreaElement>) => void;
}

const HighlightedDialogueInput: React.FC<HighlightedDialogueInputProps> = ({
    rawValue,
    plainValue,
    placeholder,
    markerToneById,
    onChange,
    onContextMenu
}) => {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const selectionGuardRef = useRef(false);
    const parsed = parseWeakPointMarkers(rawValue);
    const markerRanges = parsed.markers
        .filter((marker): marker is WeakPointMarker & { id: string } => Boolean(marker.id))
        .sort((left, right) => left.start - right.start);

    const syncScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
        if (!overlayRef.current) {
            return;
        }

        overlayRef.current.scrollTop = event.currentTarget.scrollTop;
        overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
    };

    const sanitizeSelection = (textarea: HTMLTextAreaElement) => {
        if (selectionGuardRef.current) {
            selectionGuardRef.current = false;
            return;
        }

        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? start;
        if (start === end) {
            return;
        }

        const overlaps = markerRanges.filter(marker => start < marker.end && end > marker.start);
        if (overlaps.length === 0) {
            return;
        }

        const firstOverlap = overlaps[0];
        const lastOverlap = overlaps[overlaps.length - 1];

        let nextStart = start;
        let nextEnd = end;

        if (start < firstOverlap.start) {
            nextEnd = firstOverlap.start;
        } else if (end > lastOverlap.end) {
            nextStart = lastOverlap.end;
        } else {
            const collapseAt = Math.abs(start - firstOverlap.start) <= Math.abs(end - lastOverlap.end)
                ? firstOverlap.start
                : lastOverlap.end;
            nextStart = collapseAt;
            nextEnd = collapseAt;
        }

        if (nextStart === start && nextEnd === end) {
            return;
        }

        selectionGuardRef.current = true;
        requestAnimationFrame(() => {
            textarea.setSelectionRange(nextStart, nextEnd);
        });
    };

    return (
        <div className="workshop-dialogue-editor">
            <div
                ref={overlayRef}
                className={`workshop-dialogue-overlay ${plainValue ? '' : 'placeholder'}`.trim()}
                aria-hidden="true"
            >
                {plainValue ? (
                    (() => {
                        const nodes: React.ReactNode[] = [];
                        let cursor = 0;
                        parsed.markers.forEach((marker, index) => {
                            const previousMarker = parsed.markers[index - 1];
                            const nextMarker = parsed.markers[index + 1];
                            const tone = marker.id && markerToneById[marker.id] === 'linked' ? 'linked' : 'fake';
                            const markClasses = ['workshop-dialogue-mark', tone];
                            if (previousMarker && previousMarker.end === marker.start) {
                                markClasses.push('touch-left');
                            }
                            if (nextMarker && nextMarker.start === marker.end) {
                                markClasses.push('touch-right');
                            }

                            nodes.push(<React.Fragment key={`txt-${index}`}>{parsed.plain.slice(cursor, marker.start)}</React.Fragment>);
                            nodes.push(
                                <mark
                                    key={`mark-${marker.id || index}`}
                                    className={markClasses.join(' ')}
                                >
                                    {marker.text}
                                </mark>
                            );
                            cursor = marker.end;
                        });
                        nodes.push(<React.Fragment key="txt-tail">{parsed.plain.slice(cursor)}</React.Fragment>);
                        return <>{nodes}</>;
                    })()
                ) : (
                    placeholder
                )}
            </div>
            <textarea
                className="workshop-textarea workshop-dialogue-input"
                rows={4}
                value={plainValue}
                placeholder=""
                onChange={(event) => onChange(event.target.value)}
                onContextMenu={onContextMenu}
                onSelect={(event) => sanitizeSelection(event.currentTarget)}
                onScroll={syncScroll}
                spellCheck={false}
            />
        </div>
    );
};

export const LocalCaseWorkshop: React.FC<LocalCaseWorkshopProps> = ({
    lang,
    isOpen,
    localCases,
    selectedCase,
    workspaceInfo,
    onClose,
    onLinkWorkspace,
    onCasesSaved,
    onSelectCase
}) => {
    const [draft, setDraft] = useState<WorkshopDraft | null>(null);
    const [rawInput, setRawInput] = useState('');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<EditorView>('turn');
    const [activeLang, setActiveLang] = useState<Language>(lang);
    const [activeEvidenceIndex, setActiveEvidenceIndex] = useState(0);
    const [activeTurnIndex, setActiveTurnIndex] = useState(0);
    const [turnPageInput, setTurnPageInput] = useState('1');
    const [weakPointContextMenu, setWeakPointContextMenu] = useState<WeakPointContextMenuState | null>(null);
    const [isCaseMenuOpen, setIsCaseMenuOpen] = useState(false);
    const [activeDraftSourceId, setActiveDraftSourceId] = useState<string | null>(selectedCase?.id || null);
    const [expandedLineOutcomeIds, setExpandedLineOutcomeIds] = useState<Record<string, boolean>>({});
    const dialogueCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        setActiveLang(lang);
    }, [lang]);

    useEffect(() => {
        if (!isOpen) return;

        if (selectedCase) {
            setDraft(draftFromOption(selectedCase));
            setRawInput(selectedCase.sourceText);
        } else {
            const nextDraft = blankDraft();
            setDraft(nextDraft);
            setRawInput(serializeLocalCaseText(nextDraft.caseData));
        }

        setView('turn');
        setActiveEvidenceIndex(0);
        setActiveTurnIndex(0);
        setTurnPageInput('1');
        setStatus('');
        setWeakPointContextMenu(null);
        setIsCaseMenuOpen(false);
        setActiveDraftSourceId(selectedCase?.id || null);
        setExpandedLineOutcomeIds({});
    }, [isOpen, selectedCase]);

    useEffect(() => {
        if (!draft) {
            return;
        }

        const totalTurns = draft.caseData.turns.length;
        const clampedIndex = Math.max(0, Math.min(activeTurnIndex, totalTurns - 1));
        if (clampedIndex !== activeTurnIndex) {
            setActiveTurnIndex(clampedIndex);
            return;
        }

        setTurnPageInput(String(clampedIndex + 1));
    }, [activeTurnIndex, draft?.caseData.turns.length]);

    useEffect(() => {
        if (!weakPointContextMenu) {
            return;
        }

        const handlePointerDown = () => {
            setWeakPointContextMenu(null);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setWeakPointContextMenu(null);
            }
        };

        window.addEventListener('pointerdown', handlePointerDown);
        window.addEventListener('keydown', handleEscape);

        return () => {
            window.removeEventListener('pointerdown', handlePointerDown);
            window.removeEventListener('keydown', handleEscape);
        };
    }, [weakPointContextMenu]);

    const groupedCases = useMemo(() => ({
        workspace: localCases.filter(option => option.source === 'workspace'),
        builtin: localCases.filter(option => option.source === 'builtin')
    }), [localCases]);
    const portraitPackOptions = useMemo(
        () => getPortraitPackOptions(activeLang),
        [activeLang]
    );
    const heroPortraitPackOptions = portraitPackOptions;
    const enemyPortraitPackOptions = portraitPackOptions;
    const backgroundPackOptions = useMemo(
        () => getBackgroundPackOptions(activeLang),
        [activeLang]
    );

    const updateDraft = (mutator: (nextCaseData: LocalCaseData) => void) => {
        setDraft(current => {
            if (!current) {
                return current;
            }

            const nextCaseData = cloneLocalCaseData(current.caseData);
            mutator(nextCaseData);
            return { ...current, caseData: nextCaseData };
        });
    };

    if (!isOpen || !draft) {
        return null;
    }

    const t = WORKSHOP_I18N[lang];
    const fallbackLang = draft.caseData.defaultLang;
    const currentEvidence = draft.caseData.evidences[Math.min(activeEvidenceIndex, draft.caseData.evidences.length - 1)];
    const currentTurn = draft.caseData.turns[Math.min(activeTurnIndex, draft.caseData.turns.length - 1)];
    const weakPointOrderMap = new Map<string, number>(currentTurn.weakPoints.map((weakPoint, index) => [weakPoint.id, index]));
    const selectedBackgroundPack = getBackgroundPackById(draft.caseData.backgroundPackId || backgroundPackOptions[0]?.id || 'default-court-interface');
    const availableBackgroundSlots = Array.from(
        new Set([
            ...BACKGROUND_SLOTS,
            ...Object.keys(selectedBackgroundPack?.slots || {})
        ])
    );

    const setLocalized = (target: LocalizedText, value: string) => {
        target[activeLang] = value;
    };
    const defaultPortraitStateForSpeaker = (speaker: AvgLine['speaker']): PortraitState => {
        if (speaker === 'hero') return 'serious_focus';
        if (speaker === 'enemy') return 'neutral_idle';
        return 'neutral_idle';
    };
    const portraitStateLabel = (value: PortraitState) => {
        switch (value) {
            case 'neutral_idle': return activeLang === 'zh' ? '平静待机' : activeLang === 'ja' ? '平常待機' : 'Neutral Idle';
            case 'polite_smile': return activeLang === 'zh' ? '礼貌微笑' : activeLang === 'ja' ? '礼儀の笑み' : 'Polite Smile';
            case 'smug_tilt': return activeLang === 'zh' ? '轻蔑挑衅' : activeLang === 'ja' ? '挑発的な笑み' : 'Smug Tilt';
            case 'innocent_hand': return activeLang === 'zh' ? '装无辜' : activeLang === 'ja' ? '無実の演技' : 'Innocent Hand';
            case 'serious_focus': return activeLang === 'zh' ? '认真聚焦' : activeLang === 'ja' ? '真剣集中' : 'Serious Focus';
            case 'thinking_hand_to_chin': return activeLang === 'zh' ? '思考推理' : activeLang === 'ja' ? '思考ポーズ' : 'Thinking';
            case 'surprise_small': return activeLang === 'zh' ? '轻微惊讶' : activeLang === 'ja' ? '小さな驚き' : 'Small Surprise';
            case 'shock_big': return activeLang === 'zh' ? '大受震动' : activeLang === 'ja' ? '大きな動揺' : 'Big Shock';
            case 'defensive_frown': return activeLang === 'zh' ? '防御皱眉' : activeLang === 'ja' ? '防御の不機嫌' : 'Defensive Frown';
            case 'angry_attack': return activeLang === 'zh' ? '愤怒反击' : activeLang === 'ja' ? '怒りの反撃' : 'Angry Attack';
            case 'breakdown_unstable': return activeLang === 'zh' ? '崩坏失控' : activeLang === 'ja' ? '崩壊寸前' : 'Breakdown';
            case 'sad_confession': return activeLang === 'zh' ? '低落自白' : activeLang === 'ja' ? '沈んだ自白' : 'Sad Confession';
            default: return value;
        }
    };
    const portraitMotionLabel = (value: PortraitMotion) => {
        switch (value) {
            case 'none': return activeLang === 'zh' ? '无动作' : activeLang === 'ja' ? 'なし' : 'None';
            case 'pop': return activeLang === 'zh' ? '弹入' : activeLang === 'ja' ? 'ポップ' : 'Pop';
            case 'shake_small': return activeLang === 'zh' ? '轻微抖动' : activeLang === 'ja' ? '小さく揺れる' : 'Small Shake';
            case 'shake_big': return activeLang === 'zh' ? '强烈抖动' : activeLang === 'ja' ? '大きく揺れる' : 'Big Shake';
            case 'bounce': return activeLang === 'zh' ? '跳动' : activeLang === 'ja' ? 'バウンド' : 'Bounce';
            case 'slide_in': return activeLang === 'zh' ? '滑入' : activeLang === 'ja' ? 'スライドイン' : 'Slide In';
            case 'slide_out': return activeLang === 'zh' ? '滑出' : activeLang === 'ja' ? 'スライドアウト' : 'Slide Out';
            default: return value;
        }
    };
    const backgroundSlotLabel = (value: BackgroundSlot) => {
        switch (value) {
            case 'boot': return activeLang === 'zh' ? '启动界面' : activeLang === 'ja' ? '起動画面' : 'Boot';
            case 'briefing': return activeLang === 'zh' ? '案件简介' : activeLang === 'ja' ? 'ブリーフィング' : 'Briefing';
            case 'hearing': return activeLang === 'zh' ? '审讯准备' : activeLang === 'ja' ? '審理待機' : 'Hearing';
            case 'cross_exam': return activeLang === 'zh' ? '证词对峙' : activeLang === 'ja' ? '反対尋問' : 'Cross Exam';
            case 'analysis': return activeLang === 'zh' ? '分析画面' : activeLang === 'ja' ? '分析画面' : 'Analysis';
            case 'reveal': return activeLang === 'zh' ? '揭露时刻' : activeLang === 'ja' ? '暴露演出' : 'Reveal';
            case 'confession': return activeLang === 'zh' ? '自白阶段' : activeLang === 'ja' ? '自白フェーズ' : 'Confession';
            case 'ending': return activeLang === 'zh' ? '结局画面' : activeLang === 'ja' ? 'エンディング' : 'Ending';
            default: return value;
        }
    };
    const screenFilterLabel = (value: ScreenFilter) => {
        switch (value) {
            case 'none': return activeLang === 'zh' ? '无滤镜' : activeLang === 'ja' ? 'なし' : 'None';
            case 'dim': return activeLang === 'zh' ? '压暗' : activeLang === 'ja' ? '減光' : 'Dim';
            case 'scanline': return activeLang === 'zh' ? '扫描线' : activeLang === 'ja' ? '走査線' : 'Scanline';
            case 'noise': return activeLang === 'zh' ? '噪点' : activeLang === 'ja' ? 'ノイズ' : 'Noise';
            case 'glitch': return activeLang === 'zh' ? '故障' : activeLang === 'ja' ? 'グリッチ' : 'Glitch';
            case 'alert_red': return activeLang === 'zh' ? '警报红滤镜' : activeLang === 'ja' ? '警告レッド' : 'Alert Red';
            case 'monochrome': return activeLang === 'zh' ? '单色' : activeLang === 'ja' ? 'モノクロ' : 'Monochrome';
            default: return value;
        }
    };
    const screenImpulseLabel = (value: ScreenImpulse) => {
        switch (value) {
            case 'none': return activeLang === 'zh' ? '无冲击' : activeLang === 'ja' ? 'なし' : 'None';
            case 'camera_shake': return activeLang === 'zh' ? '镜头震动' : activeLang === 'ja' ? 'カメラ揺れ' : 'Camera Shake';
            case 'zoom_punch': return activeLang === 'zh' ? '突进放大' : activeLang === 'ja' ? 'ズームパンチ' : 'Zoom Punch';
            case 'flash': return activeLang === 'zh' ? '闪白' : activeLang === 'ja' ? 'フラッシュ' : 'Flash';
            default: return value;
        }
    };
    const sceneTransitionLabel = (value: SceneTransition) => {
        switch (value) {
            case 'cut': return activeLang === 'zh' ? '直接切换' : activeLang === 'ja' ? 'カット' : 'Cut';
            case 'fade': return activeLang === 'zh' ? '淡入淡出' : activeLang === 'ja' ? 'フェード' : 'Fade';
            case 'glitch': return activeLang === 'zh' ? '故障切换' : activeLang === 'ja' ? 'グリッチ切替' : 'Glitch';
            case 'white_flash': return activeLang === 'zh' ? '白闪切换' : activeLang === 'ja' ? '白フラッシュ' : 'White Flash';
            case 'wipe': return activeLang === 'zh' ? '擦除切换' : activeLang === 'ja' ? 'ワイプ' : 'Wipe';
            default: return value;
        }
    };

    const buildWeakPointLabel = (weakPoint: LocalWeakPoint, index: number) =>
        editValue(weakPoint.statement, activeLang)
        || displayText(weakPoint.statement, activeLang, fallbackLang)
        || `WP ${index + 1}`;
    const buildLineLabel = (dialogue: LocalDialogueCard, index: number) =>
        editDialogueValue(dialogue.text, activeLang).trim()
        || displayText(dialogue.text, activeLang, fallbackLang).trim()
        || t.line.item(index + 1);
    const isOwnedByOther = (ownerMap: Map<string, string>, resourceId: string, currentOwnerId: string) => {
        const owner = ownerMap.get(resourceId);
        return Boolean(owner && owner !== currentOwnerId);
    };

    const weakPointSortMeta = (weakPoint: LocalWeakPoint) => {
        const lineIndex = currentTurn.loopDialogues.findIndex(dialogue => dialogue.id === weakPoint.lineId);
        const dialogue = lineIndex >= 0 ? currentTurn.loopDialogues[lineIndex] : null;
        const candidateLangs: Language[] = [activeLang, fallbackLang, ...LANGS.filter(item => item !== activeLang && item !== fallbackLang)];
        let markerStart = Number.MAX_SAFE_INTEGER;

        if (dialogue) {
            for (const item of candidateLangs) {
                const rawValue = dialogue.text[item] || '';
                if (!rawValue) continue;
                const marker = parseWeakPointMarkers(rawValue).markers.find(marker => marker.id === weakPoint.id);
                if (marker) {
                    markerStart = marker.start;
                    break;
                }
            }
        }

        return {
            lineIndex: lineIndex >= 0 ? lineIndex : Number.MAX_SAFE_INTEGER,
            markerStart,
            originalIndex: weakPointOrderMap.get(weakPoint.id) ?? Number.MAX_SAFE_INTEGER
        };
    };

    const compareWeakPoints = (left: LocalWeakPoint, right: LocalWeakPoint) => {
        const leftMeta = weakPointSortMeta(left);
        const rightMeta = weakPointSortMeta(right);
        if (leftMeta.lineIndex !== rightMeta.lineIndex) {
            return leftMeta.lineIndex - rightMeta.lineIndex;
        }
        if (leftMeta.markerStart !== rightMeta.markerStart) {
            return leftMeta.markerStart - rightMeta.markerStart;
        }
        return leftMeta.originalIndex - rightMeta.originalIndex;
    };

    const currentWeakPoints = [...currentTurn.weakPoints].sort(compareWeakPoints);
    const lineWeakPoints = (lineId: string) =>
        currentTurn.weakPoints
            .filter(weakPoint => weakPoint.lineId === lineId)
            .sort(compareWeakPoints);
    const specificUnlockOwnerByWeakPointId = new Map<string, string>();
    currentTurn.loopDialogues.forEach(line => {
        if (!line.hidden || (line.unlockMode || 'none') !== 'specificWeakPoints') {
            return;
        }
        (line.unlockWeakPointIds || []).forEach(weakPointId => {
            if (!specificUnlockOwnerByWeakPointId.has(weakPointId)) {
                specificUnlockOwnerByWeakPointId.set(weakPointId, line.id);
            }
        });
    });
    const evidenceGrantOwnerByEvidenceId = new Map<string, string>();
    currentTurn.loopDialogues.forEach(line => {
        (line.grantEvidenceIds || []).forEach(evidenceId => {
            if (!evidenceGrantOwnerByEvidenceId.has(evidenceId)) {
                evidenceGrantOwnerByEvidenceId.set(evidenceId, `line:${line.id}`);
            }
        });
    });
    (currentTurn.inspectOverrides || []).forEach(override => {
        (override.grantEvidenceIds || []).forEach(evidenceId => {
            if (!evidenceGrantOwnerByEvidenceId.has(evidenceId)) {
                evidenceGrantOwnerByEvidenceId.set(evidenceId, `inspect:${override.weakPointId}`);
            }
        });
    });
    const inspectRevealOwnerByLineId = new Map<string, string>();
    (currentTurn.inspectOverrides || []).forEach(override => {
        (override.revealLineIds || []).forEach(lineId => {
            if (!inspectRevealOwnerByLineId.has(lineId)) {
                inspectRevealOwnerByLineId.set(lineId, override.weakPointId);
            }
        });
    });

    const nextWeakPointId = () => `t${activeTurnIndex + 1}-weak-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const syncDialogueMarkers = (dialogue: LocalDialogueCard, weakPoints: LocalWeakPoint[], nextPlainValue: string) => {
        const existingMarkers = parseWeakPointMarkers(dialogue.text[activeLang] || '').markers.filter(marker => marker.id);
        let cursor = 0;
        const nextMarkers: WeakPointMarker[] = [];

        existingMarkers.forEach(marker => {
            const searchText = marker.text;
            const foundAt = nextPlainValue.indexOf(searchText, cursor);
            if (foundAt < 0) {
                return;
            }
            const weakPoint = weakPoints.find(item => item.id === marker.id);
            if (!weakPoint) {
                return;
            }
            weakPoint.statement = {
                ...weakPoint.statement,
                [activeLang]: searchText
            };
            nextMarkers.push({
                id: marker.id,
                text: searchText,
                start: foundAt,
                end: foundAt + searchText.length
            });
            cursor = foundAt + searchText.length;
        });

        return buildMarkedText(nextPlainValue, nextMarkers);
    };

    const revealModes: Array<{ value: UnlockMode; label: string }> = [
        { value: 'none', label: activeLang === 'zh' ? '始终显示' : activeLang === 'ja' ? '常に表示' : 'Always Visible' },
        { value: 'allTrueWeakPoints', label: activeLang === 'zh' ? '击破本回合全部真破绽后显示' : activeLang === 'ja' ? 'このラウンドの真の弱点を全て突破後に表示' : 'Show After All Real Weak Points' },
        { value: 'specificWeakPoints', label: activeLang === 'zh' ? '击破指定破绽后显示' : activeLang === 'ja' ? '指定した弱点を突破後に表示' : 'Show After Specific Weak Points' }
    ];
    const uiText = {
        turnWeakPoints: activeLang === 'zh' ? '本回合破绽' : activeLang === 'ja' ? 'このラウンドの弱点' : 'Turn Weak Points',
        noWeakPoints: activeLang === 'zh' ? '当前回合还没有破绽。请在台词里滑选文本后右键添加。' : activeLang === 'ja' ? 'このラウンドにはまだ弱点がありません。証言テキストを選択して右クリックしてください。' : 'No weak points yet. Select text inside a testimony line and right-click to create one.',
        lineWeakPoints: activeLang === 'zh' ? '本台词的破绽' : activeLang === 'ja' ? 'この行の弱点' : 'Weak Points In This Line',
        noLineWeakPoints: activeLang === 'zh' ? '这条台词还没有设置破绽。' : activeLang === 'ja' ? 'この行にはまだ弱点がありません。' : 'No weak points set for this line yet.',
        hiddenLine: activeLang === 'zh' ? '隐藏台词' : activeLang === 'ja' ? '隠し台詞' : 'Hidden Line',
        unlockMode: activeLang === 'zh' ? '解锁条件' : activeLang === 'ja' ? '解放条件' : 'Unlock Condition',
        unlockWeakPoints: activeLang === 'zh' ? '指定破绽' : activeLang === 'ja' ? '指定弱点' : 'Specific Weak Points',
        grantedEvidence: activeLang === 'zh' ? '解锁时掉落的证据' : activeLang === 'ja' ? '解放時に獲得する証拠' : 'Evidence Granted On Unlock',
        inventoryStart: activeLang === 'zh' ? '开局持有' : activeLang === 'ja' ? '初期所持' : 'Start In Inventory',
        previousTurn: activeLang === 'zh' ? '上一页' : activeLang === 'ja' ? '前へ' : 'Prev',
        nextTurn: activeLang === 'zh' ? '下一页' : activeLang === 'ja' ? '次へ' : 'Next',
        turnPager: activeLang === 'zh' ? '回合页' : activeLang === 'ja' ? 'ラウンド' : 'Turn',
        filenameSuffix: '.case.txt',
        filenameStem: activeLang === 'zh' ? '文件名主体' : activeLang === 'ja' ? 'ファイル名本体' : 'Filename Stem',
        jumpToWeakPoint: activeLang === 'zh' ? '点击标签跳转到对应台词' : activeLang === 'ja' ? 'タグを押すと対応する台詞へ移動' : 'Click a tag to jump to that line',
        addLineAfter: activeLang === 'zh' ? '在下方新增台词' : activeLang === 'ja' ? 'この下に台詞を追加' : 'Add Line Below',
        genericFailureFlow: activeLang === 'zh' ? '通用失败处理' : activeLang === 'ja' ? '共通の失敗処理' : 'Generic Failure Flow',
        specificFailureFlow: activeLang === 'zh' ? '指定破绽失败处理' : activeLang === 'ja' ? '弱点指定の失敗処理' : 'Weak Point Specific Failure',
        addFailureOverride: activeLang === 'zh' ? '新增指定破绽失败分支' : activeLang === 'ja' ? '弱点指定の失敗分岐を追加' : 'Add Weak Point Override',
        noFailureOverride: activeLang === 'zh' ? '当前还没有指定破绽的失败分支。' : activeLang === 'ja' ? 'この理由にはまだ弱点指定の失敗分岐がありません。' : 'No weak-point-specific failure branches yet.',
        targetWeakPoint: activeLang === 'zh' ? '对应破绽' : activeLang === 'ja' ? '対象弱点' : 'Target Weak Point',
        overrideNarrative: activeLang === 'zh' ? '该破绽的失败旁白' : activeLang === 'ja' ? 'この弱点用の失敗ナレーション' : 'Override Failure Narrative',
        lineDirectory: activeLang === 'zh' ? '台词目录' : activeLang === 'ja' ? '台詞ディレクトリ' : 'Line Directory',
        weakPointDirectory: activeLang === 'zh' ? '破绽目录' : activeLang === 'ja' ? '弱点ディレクトリ' : 'Weak Point Directory',
        resultDirectory: activeLang === 'zh' ? '结果台词目录' : activeLang === 'ja' ? '結果台詞ディレクトリ' : 'Result Directory',
        caseSwitcher: activeLang === 'zh' ? '当前剧本' : activeLang === 'ja' ? '現在のシナリオ' : 'Current Case',
        assetPacks: activeLang === 'zh' ? '资源包' : activeLang === 'ja' ? 'アセットパック' : 'Asset Packs',
        unsavedCase: activeLang === 'zh' ? '未保存新剧本' : activeLang === 'ja' ? '未保存の新規シナリオ' : 'Unsaved New Case',
        builtinLocationHint: activeLang === 'zh' ? '这是项目内置剧本的固定路径。' : activeLang === 'ja' ? 'これはプロジェクト内蔵シナリオの固定パスです。' : 'This is the fixed path for a built-in project case.',
        workspaceLocationHint: activeLang === 'zh' ? '浏览器权限限制下，工作区只能显示已链接目录名和文件名，无法读取绝对路径。' : activeLang === 'ja' ? 'ブラウザ権限の制限により、ワークスペースはリンク済みフォルダ名とファイル名のみ表示でき、絶対パスは取得できません。' : 'Browser permissions only expose the linked folder name and filename for workspace cases, not an absolute path.',
        unsavedLocationHint: activeLang === 'zh' ? '这是当前草稿的目标文件名。保存后会写入已链接工作区。' : activeLang === 'ja' ? 'これは現在の下書きの保存先ファイル名です。保存後はリンク済みワークスペースへ書き込まれます。' : 'This is the target filename for the current draft. Saving writes it into the linked workspace.',
        genericSuccessFlow: activeLang === 'zh' ? '通用成功论破处理' : activeLang === 'ja' ? '共通の成功論破処理' : 'Generic Success Flow',
        turnClearFlow: activeLang === 'zh' ? '本回合全部击破后的对话' : activeLang === 'ja' ? 'このラウンドを突破後の対話' : 'Turn Clear Flow',
        genericResolutionFlow: activeLang === 'zh' ? '通用论破处理' : activeLang === 'ja' ? '共通の論破処理' : 'Generic Resolution Flow',
        separateTurnClear: activeLang === 'zh' ? '本回合全部击破后使用独立对话' : activeLang === 'ja' ? 'ラウンド突破後は独立した対話を使う' : 'Use Separate Turn-Clear Dialogue',
        separateFailureReasons: activeLang === 'zh' ? '区分错误类型' : activeLang === 'ja' ? '失敗タイプを分ける' : 'Split Failure Types',
        genericFailureFlowSingle: activeLang === 'zh' ? '失败处理' : activeLang === 'ja' ? '失敗処理' : 'Failure Flow',
        overrideSuccessNarrative: activeLang === 'zh' ? '该破绽的成功旁白' : activeLang === 'ja' ? 'この弱点用の成功ナレーション' : 'Override Success Narrative',
        enableSuccessOverride: activeLang === 'zh' ? '定制成功处理' : activeLang === 'ja' ? '成功処理を個別設定' : 'Custom Success Handling',
        enableInspectOverride: activeLang === 'zh' ? '定制调查处理' : activeLang === 'ja' ? '調査処理を個別設定' : 'Custom Inspect Handling',
        enableFailureOverride: activeLang === 'zh' ? '定制失败处理' : activeLang === 'ja' ? '失敗処理を個別設定' : 'Custom Failure Handling',
        inspectFlow: activeLang === 'zh' ? '调查处理' : activeLang === 'ja' ? '調査処理' : 'Inspect Flow',
        overrideInspectNarrative: activeLang === 'zh' ? '该破绽的调查旁白' : activeLang === 'ja' ? 'この弱点用の調査ナレーション' : 'Override Inspect Narrative',
        genericInspectAvg: activeLang === 'zh' ? '通用调查对话' : activeLang === 'ja' ? '共通の調査対話' : 'Generic Inspect AVG',
        inspectGrantedEvidence: activeLang === 'zh' ? '调查后获得的证据' : activeLang === 'ja' ? '調査後に獲得する証拠' : 'Evidence Granted On Inspect',
        inspectRevealLines: activeLang === 'zh' ? '调查后解锁的隐藏台词' : activeLang === 'ja' ? '調査後に解放する隠し台詞' : 'Hidden Lines Revealed On Inspect',
        noRevealLines: activeLang === 'zh' ? '当前没有可通过调查解锁的其他隐藏台词。' : activeLang === 'ja' ? '現在、この調査で解放できる他の隠し台詞はありません。' : 'There are no additional hidden lines available to reveal from this inspect branch.',
        inspectFallbackHelp: activeLang === 'zh' ? '未定制调查处理时，游戏会使用下方的通用调查反馈与调查对话。' : activeLang === 'ja' ? '個別の調査処理を設定しない場合、下の共通調査フィードバックと調査対話を使います。' : 'If no inspect override is set, the game falls back to the generic query feedback and inspect dialogue below.',
        consumeEvidenceOnUse: activeLang === 'zh' ? '击破后销毁该证据' : activeLang === 'ja' ? '突破後にこの証拠を消費する' : 'Consume This Evidence On Hit',
        choiceLocked: activeLang === 'zh' ? '已被其他设置占用' : activeLang === 'ja' ? '他の設定で使用中' : 'Already Used Elsewhere',
        lineOutcomeSettings: activeLang === 'zh' ? '台词结果设定' : activeLang === 'ja' ? '台詞ごとの結果設定' : 'Line Outcome Settings',
        showLineOutcomeSettings: activeLang === 'zh' ? '展开本台词的定向结果设定' : activeLang === 'ja' ? 'この台詞の個別結果設定を開く' : 'Show Line Outcome Settings',
        hideLineOutcomeSettings: activeLang === 'zh' ? '收起本台词的定向结果设定' : activeLang === 'ja' ? 'この台詞の個別結果設定を閉じる' : 'Hide Line Outcome Settings',
        clickToSwitchCase: activeLang === 'zh' ? '点击切换剧本' : activeLang === 'ja' ? 'クリックしてシナリオを切替' : 'Click To Switch Case',
        useLaunchSelection: activeLang === 'zh' ? '跟随启动时选择' : activeLang === 'ja' ? '起動時の選択に従う' : 'Use Launch Selection',
        heroPortraitPack: activeLang === 'zh' ? '玩家角色包' : activeLang === 'ja' ? 'プレイヤー立ち絵パック' : 'Hero Portrait Pack',
        enemyPortraitPack: activeLang === 'zh' ? '嫌犯角色包' : activeLang === 'ja' ? '容疑者立ち絵パック' : 'Enemy Portrait Pack',
        backgroundPack: activeLang === 'zh' ? '背景包' : activeLang === 'ja' ? '背景パック' : 'Background Pack',
        introScene: activeLang === 'zh' ? '案件开场演出' : activeLang === 'ja' ? '導入シーン' : 'Intro Scene',
        turnSceneDefaults: activeLang === 'zh' ? '本回合默认演出' : activeLang === 'ja' ? 'このラウンドの既定演出' : 'Turn Scene Defaults',
        victoryScene: activeLang === 'zh' ? '结局演出' : activeLang === 'ja' ? '結末演出' : 'Victory Scene',
        backgroundSlot: activeLang === 'zh' ? '背景场景' : activeLang === 'ja' ? '背景スロット' : 'Background Slot',
        portraitState: activeLang === 'zh' ? '立绘状态' : activeLang === 'ja' ? '立ち絵状態' : 'Portrait State',
        portraitMotion: activeLang === 'zh' ? '立绘动作' : activeLang === 'ja' ? '立ち絵モーション' : 'Portrait Motion',
        screenFilter: activeLang === 'zh' ? '全屏滤镜' : activeLang === 'ja' ? 'スクリーンフィルター' : 'Screen Filter',
        screenImpulse: activeLang === 'zh' ? '画面冲击' : activeLang === 'ja' ? '画面インパルス' : 'Screen Impulse',
        sceneTransition: activeLang === 'zh' ? '切换方式' : activeLang === 'ja' ? '切替演出' : 'Transition',
        enemyIntroPortrait: activeLang === 'zh' ? '开场嫌犯立绘' : activeLang === 'ja' ? '導入時の容疑者立ち絵' : 'Intro Enemy Portrait',
        avgSceneControls: activeLang === 'zh' ? '本句演出控制' : activeLang === 'ja' ? 'この台詞の演出制御' : 'Line Scene Controls',
        testimonySceneControls: activeLang === 'zh' ? '本条证词立绘控制' : activeLang === 'ja' ? 'この証言行の立ち絵制御' : 'Testimony Portrait Controls'
    };

    const totalTurns = draft.caseData.turns.length;
    const jumpToTurn = (nextIndex: number) => {
        const clampedIndex = Math.max(0, Math.min(nextIndex, totalTurns - 1));
        setActiveTurnIndex(clampedIndex);
        setTurnPageInput(String(clampedIndex + 1));
    };

    const commitTurnPageInput = () => {
        const parsed = Number(turnPageInput);
        if (!Number.isFinite(parsed)) {
            setTurnPageInput(String(activeTurnIndex + 1));
            return;
        }
        jumpToTurn(parsed - 1);
    };

    const filenameStem = draft.filename.replace(/\.case\.txt$/i, '');

    const purgeWeakPointIdsFromTurn = (turn: LocalCaseData['turns'][number], removedWeakPointIds: string[]) => {
        if (removedWeakPointIds.length === 0) {
            return;
        }

        const removed = new Set(removedWeakPointIds);
        turn.weakPoints = turn.weakPoints.filter(weakPoint => !removed.has(weakPoint.id));
        turn.inspectOverrides = (turn.inspectOverrides || []).filter(override => !removed.has(override.weakPointId));
        turn.loopDialogues.forEach(line => {
            line.unlockWeakPointIds = (line.unlockWeakPointIds || []).filter(id => !removed.has(id));
        });
        FAIL_REASONS.forEach(reason => {
            turn.failOverrides[reason] = (turn.failOverrides[reason] || []).filter(override => !removed.has(override.weakPointId));
        });
    };

    const purgeLineIdsFromTurn = (turn: LocalCaseData['turns'][number], removedLineIds: string[]) => {
        if (removedLineIds.length === 0) {
            return;
        }

        const removed = new Set(removedLineIds);
        turn.inspectOverrides = (turn.inspectOverrides || []).map(override => ({
            ...override,
            revealLineIds: (override.revealLineIds || []).filter(lineId => !removed.has(lineId))
        }));
    };

    const createDialogueCard = (): LocalDialogueCard => ({
        id: `t${activeTurnIndex + 1}-line-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
        text: createBlankLocalizedText(),
        hidden: false,
        unlockMode: 'none',
        unlockWeakPointIds: [],
        grantEvidenceIds: [],
        portraitState: currentTurn.enemyPortraitState || 'neutral_idle',
        portraitMotion: 'none'
    });

    const insertDialogueCard = (afterIndex?: number) => {
        updateDraft(nextCaseData => {
            const lines = nextCaseData.turns[activeTurnIndex].loopDialogues;
            const nextCard = createDialogueCard();
            if (typeof afterIndex === 'number') {
                lines.splice(afterIndex + 1, 0, nextCard);
            } else {
                lines.push(nextCard);
            }
        });
    };

    const scrollToDialogueCard = (lineId: string) => {
        const target = dialogueCardRefs.current[lineId];
        if (!target) {
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const failureOverridesFor = (reason: FailureReason) => currentTurn.failOverrides[reason] || [];
    const successOverrideFor = (weakPointId: string) =>
        currentTurn.successOverrides.find(override => override.weakPointId === weakPointId) || null;
    const inspectOverrideFor = (weakPointId: string) =>
        currentTurn.inspectOverrides.find(override => override.weakPointId === weakPointId) || null;
    const failureOverrideFor = (reason: FailureReason, weakPointId: string) =>
        failureOverridesFor(reason).find(override => override.weakPointId === weakPointId) || null;
    const activeDraftOption = activeDraftSourceId
        ? localCases.find(option => option.id === activeDraftSourceId) || null
        : null;
    const activeDraftIsWorkspace = activeDraftOption?.source === 'workspace';
    const activeDraftIsBuiltin = activeDraftOption?.source === 'builtin';
    const caseDisplayLabel = displayText(draft.caseData.caseTitle, activeLang, fallbackLang)
        || filenameStem
        || uiText.unsavedCase;
    const activeSourceLabel = activeDraftOption
        ? (activeDraftOption.source === 'workspace' ? t.sourceLabels.workspace : t.sourceLabels.builtin)
        : uiText.unsavedCase;
    const sourceLocation = activeDraftOption
        ? (activeDraftOption.source === 'workspace'
            ? `${workspaceInfo.directoryName || 'linked-workspace'}/${activeDraftOption.filename}`
            : `src/game-content/builtin/cases/${activeDraftOption.filename}`)
        : `${workspaceInfo.directoryName || 'linked-workspace'}/${draft.filename}`;
    const sourceLocationHint = activeDraftOption
        ? (activeDraftOption.source === 'workspace' ? uiText.workspaceLocationHint : uiText.builtinLocationHint)
        : uiText.unsavedLocationHint;

    const setSectionRef = (key: string, node: HTMLDivElement | null) => {
        sectionRefs.current[key] = node;
    };

    const scrollToSection = (key: string) => {
        const target = sectionRefs.current[key];
        if (!target) {
            return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const toggleLineOutcome = (lineId: string) => {
        setExpandedLineOutcomeIds(prev => ({
            ...prev,
            [lineId]: !prev[lineId]
        }));
    };

    const setAllFailNarratives = (turn: LocalCaseData['turns'][number], nextValue: LocalizedText) => {
        FAIL_REASONS.forEach(reason => {
            turn.failNarrative[reason] = { ...nextValue };
        });
    };

    const setAllFailAvg = (turn: LocalCaseData['turns'][number], nextLines: AvgLine[]) => {
        FAIL_REASONS.forEach(reason => {
            turn.failAvg[reason] = nextLines.map(line => ({
                ...line,
                text: { ...line.text }
            }));
        });
    };

    const renderField = (
        label: string,
        value: LocalizedText,
        onChange: (value: string) => void,
        multiline = false,
        rows = 3
    ) => (
        <label className="workshop-field">
            <span>{label}</span>
            {multiline ? (
                <textarea
                    className="workshop-textarea"
                    rows={rows}
                    value={editValue(value, activeLang)}
                    placeholder={displayText(value, activeLang, fallbackLang)}
                    onChange={(event) => onChange(event.target.value)}
                />
            ) : (
                <input
                    className="workshop-input"
                    value={editValue(value, activeLang)}
                    placeholder={displayText(value, activeLang, fallbackLang)}
                    onChange={(event) => onChange(event.target.value)}
                />
            )}
        </label>
    );

    const renderAvgList = (lines: AvgLine[], onChange: (nextLines: AvgLine[]) => void) => (
        <div className="workshop-stack">
            {lines.map((line, index) => {
                const currentSpeakerLabel = speakerLabel(line.speaker, t.speakers);
                return (
                    <div key={`${line.speaker}-${index}`} className="workshop-card">
                        <div className="workshop-card-header">
                            <span>{t.line.avg(currentSpeakerLabel, index + 1)}</span>
                            {lines.length > 1 && (
                                <button
                                    type="button"
                                    className="workshop-text-btn danger"
                                    onClick={() => onChange(lines.filter((_, itemIndex) => itemIndex !== index))}
                                >
                                    {t.actions.remove}
                                </button>
                            )}
                        </div>

                        <label className="workshop-field">
                            <span>{t.fields.speaker}</span>
                            <select
                                className="workshop-select"
                                value={line.speaker}
                                onChange={(event) => {
                                    const nextSpeaker = event.target.value as AvgLine['speaker'];
                                    const nextLines = lines.slice();
                                    nextLines[index] = {
                                        ...line,
                                        speaker: nextSpeaker,
                                        portraitState: nextSpeaker === 'system'
                                            ? line.portraitState || 'neutral_idle'
                                            : line.portraitState || defaultPortraitStateForSpeaker(nextSpeaker)
                                    };
                                    onChange(nextLines);
                                }}
                            >
                                <option value="hero">{t.speakers.hero}</option>
                                <option value="enemy">{t.speakers.enemy}</option>
                                <option value="system">{t.speakers.system}</option>
                            </select>
                        </label>

                        <div className="workshop-card">
                            <div className="workshop-mini-label">{uiText.avgSceneControls}</div>
                            <div className="workshop-grid two">
                                {line.speaker !== 'system' && (
                                    <label className="workshop-field">
                                        <span>{uiText.portraitState}</span>
                                        <select
                                            className="workshop-select"
                                            value={line.portraitState || defaultPortraitStateForSpeaker(line.speaker)}
                                            onChange={(event) => {
                                                const nextLines = lines.slice();
                                                nextLines[index] = {
                                                    ...line,
                                                    portraitState: event.target.value as PortraitState
                                                };
                                                onChange(nextLines);
                                            }}
                                        >
                                            {PORTRAIT_STATES.map(item => (
                                                <option key={item} value={item}>
                                                    {portraitStateLabel(item)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                {line.speaker !== 'system' && (
                                    <label className="workshop-field">
                                        <span>{uiText.portraitMotion}</span>
                                        <select
                                            className="workshop-select"
                                            value={line.portraitMotion || 'none'}
                                            onChange={(event) => {
                                                const nextLines = lines.slice();
                                                nextLines[index] = {
                                                    ...line,
                                                    portraitMotion: event.target.value as PortraitMotion
                                                };
                                                onChange(nextLines);
                                            }}
                                        >
                                            {PORTRAIT_MOTIONS.map(item => (
                                                <option key={item} value={item}>
                                                    {portraitMotionLabel(item)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )}

                                <label className="workshop-field">
                                    <span>{uiText.backgroundSlot}</span>
                                    <select
                                        className="workshop-select"
                                        value={line.backgroundSlot || currentTurn.sceneBackgroundSlot || 'cross_exam'}
                                        onChange={(event) => {
                                            const nextLines = lines.slice();
                                            nextLines[index] = {
                                                ...line,
                                                backgroundSlot: event.target.value
                                            };
                                            onChange(nextLines);
                                        }}
                                    >
                                        {availableBackgroundSlots.map(item => (
                                            <option key={item} value={item}>
                                                {backgroundSlotLabel(item)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="workshop-field">
                                    <span>{uiText.screenFilter}</span>
                                    <select
                                        className="workshop-select"
                                        value={line.screenFilter || 'none'}
                                        onChange={(event) => {
                                            const nextLines = lines.slice();
                                            nextLines[index] = {
                                                ...line,
                                                screenFilter: event.target.value as ScreenFilter
                                            };
                                            onChange(nextLines);
                                        }}
                                    >
                                        {SCREEN_FILTERS.map(item => (
                                            <option key={item} value={item}>
                                                {screenFilterLabel(item)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="workshop-field">
                                    <span>{uiText.screenImpulse}</span>
                                    <select
                                        className="workshop-select"
                                        value={line.screenImpulse || 'none'}
                                        onChange={(event) => {
                                            const nextLines = lines.slice();
                                            nextLines[index] = {
                                                ...line,
                                                screenImpulse: event.target.value as ScreenImpulse
                                            };
                                            onChange(nextLines);
                                        }}
                                    >
                                        {SCREEN_IMPULSES.map(item => (
                                            <option key={item} value={item}>
                                                {screenImpulseLabel(item)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="workshop-field">
                                    <span>{uiText.sceneTransition}</span>
                                    <select
                                        className="workshop-select"
                                        value={line.transition || 'cut'}
                                        onChange={(event) => {
                                            const nextLines = lines.slice();
                                            nextLines[index] = {
                                                ...line,
                                                transition: event.target.value as SceneTransition
                                            };
                                            onChange(nextLines);
                                        }}
                                    >
                                        {SCENE_TRANSITIONS.map(item => (
                                            <option key={item} value={item}>
                                                {sceneTransitionLabel(item)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>

                        {renderField(t.fields.text, line.text, (nextValue) => {
                            const nextLines = lines.slice();
                            const nextText = { ...line.text };
                            setLocalized(nextText, nextValue);
                            nextLines[index] = { ...line, text: nextText };
                            onChange(nextLines);
                        }, true, 3)}
                    </div>
                );
            })}

            <button
                type="button"
                className="workshop-text-btn"
                onClick={() => onChange([...lines, createBlankAvgDialogueLine('enemy', createBlankLocalizedText())])}
            >
                {t.actions.addLine}
            </button>
        </div>
    );

    const renderFailureOverrideList = (reason: FailureReason) => {
        const overrides = failureOverridesFor(reason);
        const usedWeakPointIds = new Set(overrides.map(override => override.weakPointId));

        return (
            <div className="workshop-stack">
                <div className="workshop-subsection-header">
                    <span>{uiText.specificFailureFlow}</span>
                    <button
                        type="button"
                        className="workshop-text-btn"
                        onClick={() => updateDraft(nextCaseData => {
                            const turn = nextCaseData.turns[activeTurnIndex];
                            const takenIds = new Set((turn.failOverrides[reason] || []).map(override => override.weakPointId));
                            const nextWeakPoint = turn.weakPoints.find(weakPoint => !takenIds.has(weakPoint.id));
                            if (!nextWeakPoint) {
                                return;
                            }
                            turn.failOverrides[reason].push({
                                weakPointId: nextWeakPoint.id,
                                narrative: {},
                                avg: [createBlankAvgDialogueLine('enemy', createBlankLocalizedText())]
                            });
                        })}
                    >
                        {uiText.addFailureOverride}
                    </button>
                </div>

                {overrides.length === 0 ? (
                    <p className="workshop-help">{uiText.noFailureOverride}</p>
                ) : (
                    overrides.map((override, overrideIndex) => {
                        const availableWeakPoints = currentWeakPoints.filter(weakPoint =>
                            weakPoint.id === override.weakPointId || !usedWeakPointIds.has(weakPoint.id)
                        );

                        return (
                            <div key={`${reason}-${override.weakPointId}-${overrideIndex}`} className="workshop-card">
                                <div className="workshop-card-header">
                                    <span>{uiText.specificFailureFlow}</span>
                                    <button
                                        type="button"
                                        className="workshop-text-btn danger"
                                        onClick={() => updateDraft(nextCaseData => {
                                            nextCaseData.turns[activeTurnIndex].failOverrides[reason] =
                                                nextCaseData.turns[activeTurnIndex].failOverrides[reason]
                                                    .filter((_, index) => index !== overrideIndex);
                                        })}
                                    >
                                        {t.actions.remove}
                                    </button>
                                </div>

                                <label className="workshop-field">
                                    <span>{uiText.targetWeakPoint}</span>
                                    <select
                                        className="workshop-select"
                                        value={override.weakPointId}
                                        onChange={(event) => updateDraft(nextCaseData => {
                                            const target = nextCaseData.turns[activeTurnIndex].failOverrides[reason][overrideIndex];
                                            target.weakPointId = event.target.value;
                                        })}
                                    >
                                        {availableWeakPoints.map((weakPoint, weakIndex) => (
                                            <option key={weakPoint.id} value={weakPoint.id}>
                                                {buildWeakPointLabel(weakPoint, weakIndex)}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                {renderField(uiText.overrideNarrative, override.narrative, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.turns[activeTurnIndex].failOverrides[reason][overrideIndex].narrative };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.turns[activeTurnIndex].failOverrides[reason][overrideIndex].narrative = nextText;
                                }), true, 3)}

                                {renderAvgList(override.avg, (nextLines) => updateDraft(nextCaseData => {
                                    nextCaseData.turns[activeTurnIndex].failOverrides[reason][overrideIndex].avg = nextLines;
                                }))}
                            </div>
                        );
                    })
                )}
            </div>
        );
    };

    const renderWeakPointOutcomeSettings = (dialogue: LocalDialogueCard) => {
        const weakPoints = lineWeakPoints(dialogue.id);

        if (weakPoints.length === 0) {
            return null;
        }

        return (
            <div className="workshop-stack">
                {weakPoints.map((weakPoint, weakIndex) => {
                    const inspectOverride = inspectOverrideFor(weakPoint.id);
                    const successOverride = successOverrideFor(weakPoint.id);
                    const inspectRewardIds = new Set(inspectOverride?.grantEvidenceIds || []);
                    const inspectRevealIds = new Set(inspectOverride?.revealLineIds || []);
                    const revealableLines = currentTurn.loopDialogues
                        .map((line, lineIndex) => ({ line, lineIndex }))
                        .filter(({ line }) =>
                            line.id !== dialogue.id
                            && (line.hidden || inspectRevealIds.has(line.id))
                        );
                    return (
                        <div key={`outcome-${weakPoint.id}`} className="workshop-card">
                            <div className="workshop-card-header">
                                <span>{buildWeakPointLabel(weakPoint, weakIndex)}</span>
                                <span className={`workshop-badge ${weakPoint.evidenceId ? 'linked' : 'warning'}`}>
                                    {weakPoint.evidenceId ? t.turn.evidenceLinked : t.turn.fakeUnlinked}
                                </span>
                            </div>

                            <div className="workshop-card">
                                <div className="workshop-card-header">
                                    <span>{uiText.inspectFlow}</span>
                                    <label className="workshop-check-field">
                                        <span>{uiText.enableInspectOverride}</span>
                                        <input
                                            className="workshop-checkbox"
                                            type="checkbox"
                                            checked={Boolean(inspectOverride)}
                                            onChange={(event) => updateDraft(nextCaseData => {
                                                const turn = nextCaseData.turns[activeTurnIndex];
                                                if (event.target.checked) {
                                                    if (!turn.inspectOverrides.some(override => override.weakPointId === weakPoint.id)) {
                                                        turn.inspectOverrides.push({
                                                            weakPointId: weakPoint.id,
                                                            narrative: {},
                                                            avg: [createBlankAvgDialogueLine('enemy', createBlankLocalizedText())],
                                                            grantEvidenceIds: [],
                                                            revealLineIds: []
                                                        });
                                                    }
                                                } else {
                                                    turn.inspectOverrides = turn.inspectOverrides.filter(override => override.weakPointId !== weakPoint.id);
                                                }
                                            })}
                                        />
                                    </label>
                                </div>

                                {inspectOverride ? (
                                    <>
                                        {renderField(uiText.overrideInspectNarrative, inspectOverride.narrative, (nextValue) => updateDraft(nextCaseData => {
                                            const target = nextCaseData.turns[activeTurnIndex].inspectOverrides.find(override => override.weakPointId === weakPoint.id);
                                            if (!target) return;
                                            const nextText = { ...target.narrative };
                                            setLocalized(nextText, nextValue);
                                            target.narrative = nextText;
                                        }), true, 3)}

                                        {renderAvgList(inspectOverride.avg, (nextLines) => updateDraft(nextCaseData => {
                                            const target = nextCaseData.turns[activeTurnIndex].inspectOverrides.find(override => override.weakPointId === weakPoint.id);
                                            if (target) {
                                                target.avg = nextLines;
                                            }
                                        }))}

                                        <div className="workshop-stack">
                                            <div className="workshop-mini-label">{uiText.inspectGrantedEvidence}</div>
                                            <div className="workshop-chip-grid">
                                                {draft.caseData.evidences
                                                    .filter(evidence => evidence.startsInInventory === false || inspectRewardIds.has(evidence.id))
                                                    .map((evidence) => {
                                                        const selected = inspectRewardIds.has(evidence.id);
                                                        const disabled = !selected && isOwnedByOther(evidenceGrantOwnerByEvidenceId, evidence.id, `inspect:${weakPoint.id}`);
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={`${weakPoint.id}-inspect-evidence-${evidence.id}`}
                                                                className={`workshop-chip ${selected ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                                disabled={disabled}
                                                                title={disabled ? uiText.choiceLocked : undefined}
                                                                onClick={() => updateDraft(nextCaseData => {
                                                                    const target = nextCaseData.turns[activeTurnIndex].inspectOverrides.find(override => override.weakPointId === weakPoint.id);
                                                                    if (!target) return;
                                                                    const currentIds = new Set(target.grantEvidenceIds || []);
                                                                    if (currentIds.has(evidence.id)) {
                                                                        currentIds.delete(evidence.id);
                                                                    } else {
                                                                        currentIds.add(evidence.id);
                                                                    }
                                                                    target.grantEvidenceIds = Array.from(currentIds);
                                                                })}
                                                            >
                                                                {displayText(evidence.name, activeLang, fallbackLang)}
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>

                                            <div className="workshop-stack">
                                                <div className="workshop-mini-label">{uiText.inspectRevealLines}</div>
                                            {revealableLines.length === 0 ? (
                                                <p className="workshop-help">{uiText.noRevealLines}</p>
                                            ) : (
                                                <div className="workshop-chip-grid">
                                                    {revealableLines.map(({ line, lineIndex }) => {
                                                        const selected = inspectRevealIds.has(line.id);
                                                        const disabled = !selected && isOwnedByOther(inspectRevealOwnerByLineId, line.id, weakPoint.id);
                                                        return (
                                                            <button
                                                                type="button"
                                                                key={`${weakPoint.id}-inspect-line-${line.id}`}
                                                                className={`workshop-chip ${selected ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                                disabled={disabled}
                                                                title={disabled ? uiText.choiceLocked : undefined}
                                                                onClick={() => updateDraft(nextCaseData => {
                                                                    const target = nextCaseData.turns[activeTurnIndex].inspectOverrides.find(override => override.weakPointId === weakPoint.id);
                                                                    if (!target) return;
                                                                    const currentIds = new Set(target.revealLineIds || []);
                                                                    if (currentIds.has(line.id)) {
                                                                        currentIds.delete(line.id);
                                                                    } else {
                                                                        currentIds.add(line.id);
                                                                    }
                                                                    target.revealLineIds = Array.from(currentIds);
                                                                })}
                                                            >
                                                                {buildLineLabel(line, lineIndex)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="workshop-help">{uiText.inspectFallbackHelp}</p>
                                )}
                            </div>

                            <label className="workshop-check-field">
                                <span>{uiText.enableSuccessOverride}</span>
                                <input
                                    className="workshop-checkbox"
                                    type="checkbox"
                                    checked={Boolean(successOverride)}
                                    onChange={(event) => updateDraft(nextCaseData => {
                                        const turn = nextCaseData.turns[activeTurnIndex];
                                        if (event.target.checked) {
                                            if (!turn.successOverrides.some(override => override.weakPointId === weakPoint.id)) {
                                                turn.successOverrides.push({
                                                    weakPointId: weakPoint.id,
                                                    narrative: {},
                                                    avg: [createBlankAvgDialogueLine('hero', createBlankLocalizedText())]
                                                });
                                            }
                                        } else {
                                            turn.successOverrides = turn.successOverrides.filter(override => override.weakPointId !== weakPoint.id);
                                        }
                                    })}
                                />
                            </label>

                            {successOverride && (
                                <>
                                    {renderField(uiText.overrideSuccessNarrative, successOverride.narrative, (nextValue) => updateDraft(nextCaseData => {
                                        const target = nextCaseData.turns[activeTurnIndex].successOverrides.find(override => override.weakPointId === weakPoint.id);
                                        if (!target) return;
                                        const nextText = { ...target.narrative };
                                        setLocalized(nextText, nextValue);
                                        target.narrative = nextText;
                                    }), true, 3)}

                                    {renderAvgList(successOverride.avg, (nextLines) => updateDraft(nextCaseData => {
                                        const target = nextCaseData.turns[activeTurnIndex].successOverrides.find(override => override.weakPointId === weakPoint.id);
                                        if (target) {
                                            target.avg = nextLines;
                                        }
                                    }))}
                                </>
                            )}

                            {currentTurn.useSeparateFailureReasons ? FAIL_REASONS.map(reason => {
                                const override = failureOverrideFor(reason, weakPoint.id);
                                return (
                                    <div key={`${weakPoint.id}-${reason}`} className="workshop-card">
                                        <div className="workshop-card-header">
                                            <span>{t.failures[reason]}</span>
                                            <label className="workshop-check-field">
                                                <span>{uiText.enableFailureOverride}</span>
                                                <input
                                                    className="workshop-checkbox"
                                                    type="checkbox"
                                                    checked={Boolean(override)}
                                                    onChange={(event) => updateDraft(nextCaseData => {
                                                        const turn = nextCaseData.turns[activeTurnIndex];
                                                        if (event.target.checked) {
                                                            if (!turn.failOverrides[reason].some(item => item.weakPointId === weakPoint.id)) {
                                                                turn.failOverrides[reason].push({
                                                                    weakPointId: weakPoint.id,
                                                                    narrative: {},
                                                                    avg: [createBlankAvgDialogueLine('enemy', createBlankLocalizedText())]
                                                                });
                                                            }
                                                        } else {
                                                            turn.failOverrides[reason] = turn.failOverrides[reason].filter(item => item.weakPointId !== weakPoint.id);
                                                        }
                                                    })}
                                                />
                                            </label>
                                        </div>

                                        {override && (
                                            <>
                                                {renderField(uiText.overrideNarrative, override.narrative, (nextValue) => updateDraft(nextCaseData => {
                                                    const target = nextCaseData.turns[activeTurnIndex].failOverrides[reason].find(item => item.weakPointId === weakPoint.id);
                                                    if (!target) return;
                                                    const nextText = { ...target.narrative };
                                                    setLocalized(nextText, nextValue);
                                                    target.narrative = nextText;
                                                }), true, 3)}

                                                {renderAvgList(override.avg, (nextLines) => updateDraft(nextCaseData => {
                                                    const target = nextCaseData.turns[activeTurnIndex].failOverrides[reason].find(item => item.weakPointId === weakPoint.id);
                                                    if (target) {
                                                        target.avg = nextLines;
                                                    }
                                                }))}
                                            </>
                                        )}
                                    </div>
                                );
                            }) : (() => {
                                const override = failureOverrideFor('wrongEvidence', weakPoint.id);
                                return (
                                    <div key={`${weakPoint.id}-generic-failure`} className="workshop-card">
                                        <div className="workshop-card-header">
                                            <span>{uiText.genericFailureFlowSingle}</span>
                                            <label className="workshop-check-field">
                                                <span>{uiText.enableFailureOverride}</span>
                                                <input
                                                    className="workshop-checkbox"
                                                    type="checkbox"
                                                    checked={Boolean(override)}
                                                    onChange={(event) => updateDraft(nextCaseData => {
                                                        const turn = nextCaseData.turns[activeTurnIndex];
                                                        if (event.target.checked) {
                                                            const template = {
                                                                weakPointId: weakPoint.id,
                                                                narrative: {},
                                                                avg: [createBlankAvgDialogueLine('enemy', createBlankLocalizedText())]
                                                            };
                                                            FAIL_REASONS.forEach(reason => {
                                                                if (!turn.failOverrides[reason].some(item => item.weakPointId === weakPoint.id)) {
                                                                    turn.failOverrides[reason].push({
                                                                        ...template,
                                                                        narrative: { ...template.narrative },
                                                                        avg: template.avg.map(line => ({ ...line, text: { ...line.text } }))
                                                                    });
                                                                }
                                                            });
                                                        } else {
                                                            FAIL_REASONS.forEach(reason => {
                                                                turn.failOverrides[reason] = turn.failOverrides[reason].filter(item => item.weakPointId !== weakPoint.id);
                                                            });
                                                        }
                                                    })}
                                                />
                                            </label>
                                        </div>

                                        {override && (
                                            <>
                                                {renderField(uiText.overrideNarrative, override.narrative, (nextValue) => updateDraft(nextCaseData => {
                                                    FAIL_REASONS.forEach(reason => {
                                                        const target = nextCaseData.turns[activeTurnIndex].failOverrides[reason].find(item => item.weakPointId === weakPoint.id);
                                                        if (!target) return;
                                                        const nextText = { ...target.narrative };
                                                        setLocalized(nextText, nextValue);
                                                        target.narrative = nextText;
                                                    });
                                                }), true, 3)}

                                                {renderAvgList(override.avg, (nextLines) => updateDraft(nextCaseData => {
                                                    FAIL_REASONS.forEach(reason => {
                                                        const target = nextCaseData.turns[activeTurnIndex].failOverrides[reason].find(item => item.weakPointId === weakPoint.id);
                                                        if (target) {
                                                            target.avg = nextLines.map(line => ({ ...line, text: { ...line.text } }));
                                                        }
                                                    });
                                                }))}
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderGenericResolutionSections = () => (
        <>
            <div ref={(node) => setSectionRef('generic-resolution', node)} className="workshop-stack">
                <div className="workshop-section-title">{uiText.genericResolutionFlow}</div>
                {renderField(t.fields.successNarrative, currentTurn.successNarrative, (nextValue) => updateDraft(nextCaseData => {
                    const turn = nextCaseData.turns[activeTurnIndex];
                    const nextText = { ...turn.successNarrative };
                    setLocalized(nextText, nextValue);
                    turn.successNarrative = nextText;
                    if (!turn.useSeparateTurnClear) {
                        turn.turnClearNarrative = { ...nextText };
                    }
                }), true, 4)}

                {renderField(t.fields.logicExplanation, currentTurn.logicExplanation, (nextValue) => updateDraft(nextCaseData => {
                    const nextText = { ...nextCaseData.turns[activeTurnIndex].logicExplanation };
                    setLocalized(nextText, nextValue);
                    nextCaseData.turns[activeTurnIndex].logicExplanation = nextText;
                }), true, 4)}

                {renderAvgList(currentTurn.successAvg, (nextLines) => updateDraft(nextCaseData => {
                    const turn = nextCaseData.turns[activeTurnIndex];
                    turn.successAvg = nextLines;
                    if (!turn.useSeparateTurnClear) {
                        turn.turnClearAvg = nextLines.map(line => ({ ...line, text: { ...line.text } }));
                    }
                }))}

                <label className="workshop-check-field">
                    <span>{uiText.separateTurnClear}</span>
                    <input
                        className="workshop-checkbox"
                        type="checkbox"
                        checked={Boolean(currentTurn.useSeparateTurnClear)}
                        onChange={(event) => updateDraft(nextCaseData => {
                            const turn = nextCaseData.turns[activeTurnIndex];
                            if (event.target.checked) {
                                turn.turnClearNarrative = { ...turn.successNarrative };
                                turn.turnClearAvg = turn.successAvg.map(line => ({ ...line, text: { ...line.text } }));
                            } else {
                                turn.turnClearNarrative = { ...turn.successNarrative };
                                turn.turnClearAvg = turn.successAvg.map(line => ({ ...line, text: { ...line.text } }));
                            }
                            turn.useSeparateTurnClear = event.target.checked;
                        })}
                    />
                </label>

                {currentTurn.useSeparateTurnClear && (
                    <div className="workshop-card">
                        <div className="workshop-mini-label">{uiText.turnClearFlow}</div>
                        {renderField(uiText.turnClearFlow, currentTurn.turnClearNarrative, (nextValue) => updateDraft(nextCaseData => {
                            const nextText = { ...nextCaseData.turns[activeTurnIndex].turnClearNarrative };
                            setLocalized(nextText, nextValue);
                            nextCaseData.turns[activeTurnIndex].turnClearNarrative = nextText;
                        }), true, 4)}

                        {renderAvgList(currentTurn.turnClearAvg, (nextLines) => updateDraft(nextCaseData => {
                            nextCaseData.turns[activeTurnIndex].turnClearAvg = nextLines;
                        }))}
                    </div>
                )}
            </div>

            <div ref={(node) => setSectionRef('failure-flow', node)} className="workshop-stack">
                <div className="workshop-section-title">{uiText.genericFailureFlowSingle}</div>

                <label className="workshop-check-field">
                    <span>{uiText.separateFailureReasons}</span>
                    <input
                        className="workshop-checkbox"
                        type="checkbox"
                        checked={Boolean(currentTurn.useSeparateFailureReasons)}
                        onChange={(event) => updateDraft(nextCaseData => {
                            const turn = nextCaseData.turns[activeTurnIndex];
                            turn.useSeparateFailureReasons = event.target.checked;
                            if (!event.target.checked) {
                                setAllFailNarratives(turn, turn.failNarrative.wrongEvidence);
                                setAllFailAvg(turn, turn.failAvg.wrongEvidence);
                            }
                        })}
                    />
                </label>

                {currentTurn.useSeparateFailureReasons ? (
                    FAIL_REASONS.map(reason => (
                        <div key={reason} className="workshop-card">
                            <div className="workshop-mini-label">{t.failures[reason]}</div>
                            {renderField(t.failures[reason], currentTurn.failNarrative[reason], (nextValue) => updateDraft(nextCaseData => {
                                const nextText = { ...nextCaseData.turns[activeTurnIndex].failNarrative[reason] };
                                setLocalized(nextText, nextValue);
                                nextCaseData.turns[activeTurnIndex].failNarrative[reason] = nextText;
                            }), true, 3)}
                            {renderAvgList(currentTurn.failAvg[reason], (nextLines) => updateDraft(nextCaseData => {
                                nextCaseData.turns[activeTurnIndex].failAvg[reason] = nextLines;
                            }))}
                        </div>
                    ))
                ) : (
                    <div className="workshop-card">
                        {renderField(uiText.genericFailureFlowSingle, currentTurn.failNarrative.wrongEvidence, (nextValue) => updateDraft(nextCaseData => {
                            const turn = nextCaseData.turns[activeTurnIndex];
                            const nextText = { ...turn.failNarrative.wrongEvidence };
                            setLocalized(nextText, nextValue);
                            setAllFailNarratives(turn, nextText);
                        }), true, 3)}
                        {renderAvgList(currentTurn.failAvg.wrongEvidence, (nextLines) => updateDraft(nextCaseData => {
                            setAllFailAvg(nextCaseData.turns[activeTurnIndex], nextLines);
                        }))}
                    </div>
                )}
            </div>
        </>
    );

    const loadCase = (option: LocalCaseOption) => {
        setDraft(draftFromOption(option));
        setRawInput(option.sourceText);
        setView('turn');
        setActiveEvidenceIndex(0);
        setActiveTurnIndex(0);
        setTurnPageInput('1');
        setActiveDraftSourceId(option.id);
        setExpandedLineOutcomeIds({});
        setIsCaseMenuOpen(false);
        setStatus(t.status.caseLoaded);
        onSelectCase(option.id);
    };

    const handleNewCase = () => {
        const nextDraft = blankDraft();
        setDraft(nextDraft);
        setRawInput(serializeLocalCaseText(nextDraft.caseData));
        setView('turn');
        setActiveEvidenceIndex(0);
        setActiveTurnIndex(0);
        setTurnPageInput('1');
        setActiveDraftSourceId(null);
        setExpandedLineOutcomeIds({});
        setIsCaseMenuOpen(false);
        setStatus(t.status.blankCaseReady);
    };

    const handleNormalizeImport = () => {
        try {
            const normalized = normalizeLocalCaseText(rawInput);
            setDraft({
                filename: ensureCaseFilename(draft.filename, normalized.caseData.caseId),
                caseData: normalized.caseData
            });
            setRawInput(normalized.normalizedText);
            setView('turn');
            setStatus(t.status.txtNormalized);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
        }
    };

    const handleBuildRaw = () => {
        setRawInput(serializeLocalCaseText(draft.caseData));
        setView('import');
        setStatus(t.status.txtGenerated);
    };

    const handleSave = async () => {
        setBusy(true);

        try {
            if (!workspaceInfo.linked) {
                setStatus(t.status.chooseSaveFolder);
                await onLinkWorkspace();
            }

            const normalized = normalizeLocalCaseText(serializeLocalCaseText(draft.caseData));
            const filename = ensureCaseFilename(draft.filename, normalized.caseData.caseId);
            await saveWorkspaceCaseFile(filename, normalized.normalizedText);
            setDraft({ filename, caseData: normalized.caseData });
            setRawInput(normalized.normalizedText);
            setActiveDraftSourceId(normalized.caseData.caseId);
            setIsCaseMenuOpen(false);
            await onCasesSaved(normalized.caseData.caseId);
            onSelectCase(normalized.caseData.caseId);
            setStatus(
                activeDraftIsBuiltin
                    ? t.status.caseSavedAsLocalCopy(filename)
                    : t.status.caseSaved(filename)
            );
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    const handleSaveAs = async () => {
        setBusy(true);

        try {
            const normalized = normalizeLocalCaseText(serializeLocalCaseText(draft.caseData));
            const filename = ensureCaseFilename(draft.filename, normalized.caseData.caseId);
            const savedFilename = await saveCaseFileAs(filename, normalized.normalizedText);
            setRawInput(normalized.normalizedText);
            setStatus(t.status.caseSavedAs(savedFilename));
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    };

    const updateDialogueText = (dialogueIndex: number, nextPlainValue: string) => {
        updateDraft(nextCaseData => {
            const turn = nextCaseData.turns[activeTurnIndex];
            const dialogue = turn.loopDialogues[dialogueIndex];
            if (!nextPlainValue.trim()) {
                const removedWeakPointIds = turn.weakPoints
                    .filter(weakPoint => weakPoint.lineId === dialogue.id)
                    .map(weakPoint => weakPoint.id);

                turn.loopDialogues[dialogueIndex] = {
                    ...dialogue,
                    text: {
                        zh: '',
                        ja: '',
                        en: ''
                    }
                };
                purgeWeakPointIdsFromTurn(turn, removedWeakPointIds);
                return;
            }
            const previousMarkers = parseWeakPointMarkers(dialogue.text[activeLang] || '').markers
                .filter((marker): marker is WeakPointMarker & { id: string } => Boolean(marker.id));
            const nextDialogue = {
                ...dialogue,
                text: {
                    ...dialogue.text,
                    [activeLang]: syncDialogueMarkers(dialogue, turn.weakPoints, nextPlainValue)
                }
            };

            const remainingMarkerIds = new Set(
                parseWeakPointMarkers(nextDialogue.text[activeLang] || '').markers
                    .map(marker => marker.id)
                    .filter((value): value is string => Boolean(value))
            );
            const previousMarkerIds = new Set(previousMarkers.map(marker => marker.id));

            turn.loopDialogues[dialogueIndex] = nextDialogue;

            const removedWeakPointIds: string[] = [];
            turn.weakPoints = turn.weakPoints.filter(weakPoint => {
                if (weakPoint.lineId !== dialogue.id || !previousMarkerIds.has(weakPoint.id)) {
                    return true;
                }

                if (!remainingMarkerIds.has(weakPoint.id)) {
                    const nextStatement = { ...weakPoint.statement };
                    delete nextStatement[activeLang];
                    weakPoint.statement = nextStatement;
                }

                if (!hasAnyLocalizedText(weakPoint.statement)) {
                    removedWeakPointIds.push(weakPoint.id);
                    return false;
                }

                return true;
            });

            purgeWeakPointIdsFromTurn(turn, removedWeakPointIds);
        });
    };

    const applyWeakPointSelection = (selectedText: string, lineId: string, start: number, end: number) => {
        const dialogue = currentTurn.loopDialogues.find(item => item.id === lineId);
        if (!dialogue) {
            setWeakPointContextMenu(null);
            return;
        }

        const rawValue = dialogue.text[activeLang] || '';
        const existingMarkers = parseWeakPointMarkers(rawValue).markers.filter(marker => marker.id);
        const overlapsExisting = existingMarkers.some(marker => !(end <= marker.start || start >= marker.end));
        if (overlapsExisting) {
            setWeakPointContextMenu(null);
            return;
        }

        updateDraft(nextCaseData => {
            const turn = nextCaseData.turns[activeTurnIndex];
            const targetDialogue = turn.loopDialogues.find(item => item.id === lineId);
            if (!targetDialogue) {
                return;
            }

            const weakPointId = nextWeakPointId();
            const targetRawValue = targetDialogue.text[activeLang] || '';
            const plain = stripWeakPointMarkers(targetRawValue);
            const targetMarkers = parseWeakPointMarkers(targetRawValue).markers.filter(marker => marker.id);

            targetMarkers.push({
                id: weakPointId,
                text: selectedText,
                start,
                end
            });

            targetDialogue.text = {
                ...targetDialogue.text,
                [activeLang]: buildMarkedText(plain, targetMarkers)
            };
            turn.weakPoints.push({
                id: weakPointId,
                lineId,
                evidenceId: '',
                consumeEvidenceOnUse: true,
                statement: {
                    [activeLang]: selectedText
                }
            });
        });

        setWeakPointContextMenu(null);
        setStatus(t.status.weakPointUpdated);
    };

    const clearWeakPointSelection = (weakPointId: string) => {
        updateDraft(nextCaseData => {
            const turn = nextCaseData.turns[activeTurnIndex];
            const weakPoint = turn.weakPoints.find(item => item.id === weakPointId);
            if (!weakPoint) {
                return;
            }

            turn.loopDialogues.forEach(dialogue => {
                const nextText = { ...dialogue.text };
                LANGS.forEach(item => {
                    const currentValue = nextText[item];
                    if (!currentValue || !currentValue.includes(`[[${weakPointId}::`)) {
                        return;
                    }
                    nextText[item] = removeMarkerById(currentValue, weakPointId);
                });
                dialogue.text = nextText;
            });

            purgeWeakPointIdsFromTurn(turn, [weakPointId]);
        });

        setWeakPointContextMenu(null);
        setStatus(t.status.weakPointCleared);
    };

    const openWeakPointContextMenu = (dialogue: LocalDialogueCard, event: React.MouseEvent<HTMLTextAreaElement>) => {
        const textarea = event.currentTarget;
        const rawValue = dialogue.text[activeLang] || '';
        const weakPointRanges = parseWeakPointMarkers(rawValue).markers.filter((marker): marker is WeakPointMarker & { id: string } => Boolean(marker.id));
        const selectionStart = textarea.selectionStart ?? 0;
        const selectionEnd = textarea.selectionEnd ?? selectionStart;
        const intersectedWeakPoint = weakPointRanges.find(marker =>
            (selectionStart === selectionEnd && selectionStart >= marker.start && selectionStart <= marker.end)
            || (selectionStart < marker.end && selectionEnd > marker.start)
        );

        if (intersectedWeakPoint) {
            event.preventDefault();
            setWeakPointContextMenu({
                x: event.clientX,
                y: event.clientY,
                lineId: dialogue.id,
                selectedText: intersectedWeakPoint.text,
                weakPointId: intersectedWeakPoint.id,
                action: 'unset'
            });
            return;
        }

        const selectedText = stripWeakPointMarkers(textarea.value.slice(selectionStart, selectionEnd)).trim();

        if (!selectedText) {
            setStatus(t.status.selectTextFirst);
            setWeakPointContextMenu(null);
            return;
        }

        event.preventDefault();

        setWeakPointContextMenu({
            x: event.clientX,
            y: event.clientY,
            lineId: dialogue.id,
            selectedText,
            start: selectionStart,
            end: selectionEnd,
            action: 'set'
        });
    };

    return (
        <div className="workshop-overlay">
            <div className="workshop-panel">
                <div className="workshop-header">
                    <div>
                        <div className="workshop-title">{t.title}</div>
                        <div className="workshop-subtitle">{status || t.subtitle}</div>
                    </div>

                    <div className="workshop-header-actions">
                        <button type="button" className="workshop-text-btn" onClick={handleNewCase}>
                            {t.newCase}
                        </button>
                        <button type="button" className="workshop-text-btn" onClick={handleSaveAs} disabled={busy}>
                            {t.saveAs}
                        </button>
                        <button type="button" className="workshop-text-btn primary" onClick={handleSave} disabled={busy}>
                            {activeDraftIsBuiltin ? t.saveCopy : t.save}
                        </button>
                        <button type="button" className="workshop-text-btn" onClick={onClose}>
                            {t.close}
                        </button>
                    </div>
                </div>

                <div className="workshop-body">
                    <aside className="workshop-sidebar">
                        <div className="workshop-sidebar-title">{uiText.caseSwitcher}</div>
                        <div className="workshop-case-switcher">
                            <button
                                type="button"
                                className="workshop-case-current"
                                onClick={() => setIsCaseMenuOpen(prev => !prev)}
                            >
                                <div className="workshop-case-current-main">
                                    <span>{caseDisplayLabel}</span>
                                    <strong>{isCaseMenuOpen ? '[-]' : '[+]'}</strong>
                                </div>
                                <div className="workshop-case-current-meta">
                                    <small>
                                        {activeDraftOption
                                            ? (activeDraftOption.source === 'workspace' ? t.sourceLabels.workspace : t.sourceLabels.builtin)
                                            : uiText.unsavedCase}
                                    </small>
                                    <small>{uiText.clickToSwitchCase}</small>
                                </div>
                            </button>

                            {isCaseMenuOpen && (
                                <div className="workshop-case-list workshop-case-menu">
                                    {!activeDraftOption && (
                                        <div className="workshop-case-item active current-draft" role="status">
                                            <span>{caseDisplayLabel}</span>
                                            <small>{uiText.unsavedCase}</small>
                                        </div>
                                    )}

                                    {groupedCases.workspace.map(option => (
                                        <button
                                            key={`workspace-${option.id}`}
                                            type="button"
                                            className={`workshop-case-item ${activeDraftSourceId === option.id ? 'active' : ''}`}
                                            onClick={() => loadCase(option)}
                                        >
                                            <span>{option.label}</span>
                                            <small>{t.sourceLabels.workspace}</small>
                                        </button>
                                    ))}

                                    {groupedCases.builtin.map(option => (
                                        <button
                                            key={`builtin-${option.id}`}
                                            type="button"
                                            className={`workshop-case-item ${activeDraftSourceId === option.id ? 'active' : ''}`}
                                            onClick={() => loadCase(option)}
                                        >
                                            <span>{option.label}</span>
                                            <small>{t.sourceLabels.builtin}</small>
                                        </button>
                                    ))}

                                    {localCases.length === 0 && <div className="workshop-empty">{t.noCases}</div>}
                                </div>
                            )}
                        </div>

                        <div className="workshop-sidebar-title">{uiText.lineDirectory}</div>
                        <div className="workshop-directory-grid">
                            {currentTurn.loopDialogues.map((dialogue, index) => (
                                <button
                                    key={`nav-line-${dialogue.id}`}
                                    type="button"
                                    className="workshop-dir-chip"
                                    onClick={() => scrollToDialogueCard(dialogue.id)}
                                >
                                    <span>{t.line.item(index + 1)}</span>
                                </button>
                            ))}
                        </div>

                        <div className="workshop-sidebar-title">{uiText.weakPointDirectory}</div>
                        <div className="workshop-directory-grid">
                            {currentWeakPoints.length === 0 ? (
                                <div className="workshop-empty">{uiText.noWeakPoints}</div>
                            ) : currentWeakPoints.map((weakPoint, weakIndex) => (
                                <button
                                    key={`nav-weak-${weakPoint.id}`}
                                    type="button"
                                    className={`workshop-dir-chip ${weakPoint.evidenceId ? 'linked' : 'warning'}`}
                                    onClick={() => scrollToDialogueCard(weakPoint.lineId)}
                                >
                                    <span>{buildWeakPointLabel(weakPoint, weakIndex)}</span>
                                </button>
                            ))}
                        </div>

                        <div className="workshop-sidebar-title">{uiText.resultDirectory}</div>
                        <div className="workshop-directory-grid">
                            <button type="button" className="workshop-dir-chip" onClick={() => scrollToSection('query-feedback')}>
                                <span>{t.turn.queryFeedback}</span>
                            </button>
                            <button type="button" className="workshop-dir-chip" onClick={() => scrollToSection('generic-resolution')}>
                                <span>{uiText.genericResolutionFlow}</span>
                            </button>
                            <button type="button" className="workshop-dir-chip" onClick={() => scrollToSection('failure-flow')}>
                                <span>{uiText.genericFailureFlowSingle}</span>
                            </button>
                            <button type="button" className="workshop-dir-chip" onClick={() => scrollToSection('interference')}>
                                <span>{t.turn.interferenceWindows}</span>
                            </button>
                        </div>
                    </aside>

                    <section className="workshop-main">
                        <div className="workshop-tab-row">
                            {VIEW_ORDER.map(item => (
                                <button
                                    key={item}
                                    type="button"
                                    className={`workshop-tab ${view === item ? 'active' : ''}`}
                                    onClick={() => setView(item)}
                                >
                                    {t.tabs[item]}
                                </button>
                            ))}
                        </div>

                        <div className="workshop-lang-switch">
                            {LANGS.map(item => (
                                <button
                                    key={item}
                                    type="button"
                                    className={`workshop-tab ${activeLang === item ? 'active' : ''}`}
                                    onClick={() => setActiveLang(item)}
                                >
                                    {LANG_LABELS[item]}
                                </button>
                            ))}
                        </div>

                        {view === 'case' && (
                            <div className="workshop-editor-scroll">
                                <div className="workshop-grid two">
                                    <label className="workshop-field">
                                        <span>{t.fields.filename}</span>
                                        <div className="workshop-filename-row">
                                            <input
                                                className="workshop-input"
                                                value={filenameStem}
                                                onChange={(event) => setDraft(current => current ? ({ ...current, filename: ensureCaseFilename(event.target.value, current.caseData.caseId) }) : current)}
                                            />
                                            <span className="workshop-filename-suffix">{uiText.filenameSuffix}</span>
                                        </div>
                                    </label>

                                    <label className="workshop-field">
                                        <span>{t.fields.sourceOrigin}</span>
                                        <input
                                            className="workshop-input"
                                            value={activeSourceLabel}
                                            readOnly
                                        />
                                    </label>

                                    <label className="workshop-field workshop-field-span-two">
                                        <span>{t.fields.sourceLocation}</span>
                                        <div className="workshop-readout" title={sourceLocation}>
                                            {sourceLocation}
                                        </div>
                                        <p className="workshop-help">{sourceLocationHint}</p>
                                    </label>

                                    <label className="workshop-field">
                                        <span>{t.fields.caseId}</span>
                                        <input
                                            className="workshop-input"
                                            value={draft.caseData.caseId}
                                            onChange={(event) => updateDraft(nextCaseData => {
                                                nextCaseData.caseId = event.target.value;
                                            })}
                                        />
                                    </label>

                                    <label className="workshop-field">
                                        <span>{t.fields.defaultLang}</span>
                                        <select
                                            className="workshop-select"
                                            value={draft.caseData.defaultLang}
                                            onChange={(event) => updateDraft(nextCaseData => {
                                                nextCaseData.defaultLang = event.target.value as Language;
                                            })}
                                        >
                                            {LANGS.map(item => (
                                                <option key={item} value={item}>
                                                    {LANG_LABELS[item]}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="workshop-section">
                                    <div className="workshop-section-title">{uiText.assetPacks}</div>
                                    <div className="workshop-grid two">
                                        <label className="workshop-field">
                                            <span>{uiText.heroPortraitPack}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.heroPortraitPackId || ''}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.heroPortraitPackId = event.target.value || undefined;
                                                })}
                                            >
                                                <option value="">{uiText.useLaunchSelection}</option>
                                                {heroPortraitPackOptions.map(option => (
                                                    <option key={option.id} value={option.id}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.enemyPortraitPack}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.enemyPortraitPackId || ''}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.enemyPortraitPackId = event.target.value || undefined;
                                                })}
                                            >
                                                <option value="">{uiText.useLaunchSelection}</option>
                                                {enemyPortraitPackOptions.map(option => (
                                                    <option key={option.id} value={option.id}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.backgroundPack}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.backgroundPackId || ''}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.backgroundPackId = event.target.value || undefined;
                                                })}
                                            >
                                                <option value="">{uiText.useLaunchSelection}</option>
                                                {backgroundPackOptions.map(option => (
                                                    <option key={option.id} value={option.id}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>

                                {renderField(t.fields.caseTitle, draft.caseData.caseTitle, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.caseTitle };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.caseTitle = nextText;
                                }))}

                                {renderField(t.fields.suspectName, draft.caseData.suspectName, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.suspectName };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.suspectName = nextText;
                                }))}

                                {renderField(t.fields.introNarrative, draft.caseData.intro.narrative, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.intro.narrative };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.intro.narrative = nextText;
                                }), true, 6)}

                                {renderField(t.fields.systemMessage, draft.caseData.intro.systemMsg, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.intro.systemMsg };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.intro.systemMsg = nextText;
                                }), true, 3)}

                                <div className="workshop-section">
                                    <div className="workshop-section-title">{uiText.introScene}</div>
                                    <div className="workshop-grid two">
                                        <label className="workshop-field">
                                            <span>{uiText.backgroundSlot}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.intro.backgroundSlot || 'briefing'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.intro.backgroundSlot = event.target.value;
                                                })}
                                            >
                                                {availableBackgroundSlots.map(item => (
                                                    <option key={item} value={item}>
                                                        {backgroundSlotLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.enemyIntroPortrait}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.intro.enemyPortraitState || 'neutral_idle'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.intro.enemyPortraitState = event.target.value as PortraitState;
                                                })}
                                            >
                                                {PORTRAIT_STATES.map(item => (
                                                    <option key={item} value={item}>
                                                        {portraitStateLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.screenFilter}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.intro.screenFilter || 'none'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.intro.screenFilter = event.target.value as ScreenFilter;
                                                })}
                                            >
                                                {SCREEN_FILTERS.map(item => (
                                                    <option key={item} value={item}>
                                                        {screenFilterLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.sceneTransition}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.intro.transition || 'cut'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.intro.transition = event.target.value as SceneTransition;
                                                })}
                                            >
                                                {SCENE_TRANSITIONS.map(item => (
                                                    <option key={item} value={item}>
                                                        {sceneTransitionLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {view === 'evidence' && currentEvidence && (
                            <div className="workshop-editor-scroll">
                                <div className="workshop-turn-tabs">
                                    {draft.caseData.evidences.map((evidence, index) => (
                                        <button
                                            key={evidence.id || `evidence-${index}`}
                                            type="button"
                                            className={`workshop-turn-tab ${activeEvidenceIndex === index ? 'active' : ''}`}
                                            onClick={() => setActiveEvidenceIndex(index)}
                                        >
                                            {displayText(evidence.name, activeLang, fallbackLang) || t.line.evidence(index + 1)}
                                        </button>
                                    ))}
                                </div>

                                <div className="workshop-inline-actions">
                                    <button
                                        type="button"
                                        className="workshop-text-btn"
                                        onClick={() => updateDraft(nextCaseData => {
                                            nextCaseData.evidences.push(createBlankLocalEvidence(nextCaseData.evidences.length + 1));
                                            setActiveEvidenceIndex(nextCaseData.evidences.length - 1);
                                        })}
                                    >
                                        {t.actions.addEvidence}
                                    </button>

                                    <button
                                        type="button"
                                        className="workshop-text-btn danger"
                                        onClick={() => updateDraft(nextCaseData => {
                                            if (nextCaseData.evidences.length <= 1) {
                                                return;
                                            }

                                            const removed = nextCaseData.evidences.splice(activeEvidenceIndex, 1)[0];
                                            nextCaseData.turns.forEach(turn => {
                                                turn.weakPoints.forEach(weakPoint => {
                                                    if (weakPoint.evidenceId === removed.id) {
                                                        weakPoint.evidenceId = '';
                                                    }
                                                });
                                                turn.loopDialogues.forEach(line => {
                                                    line.grantEvidenceIds = (line.grantEvidenceIds || []).filter(id => id !== removed.id);
                                                });
                                                turn.inspectOverrides = (turn.inspectOverrides || []).map(override => ({
                                                    ...override,
                                                    grantEvidenceIds: (override.grantEvidenceIds || []).filter(id => id !== removed.id)
                                                }));
                                            });
                                        })}
                                    >
                                        {t.actions.removeEvidence}
                                    </button>
                                </div>

                                <div className="workshop-grid two">
                                    <label className="workshop-field">
                                        <span>{t.fields.evidenceId}</span>
                                        <input
                                            className="workshop-input"
                                            value={currentEvidence.id}
                                            onChange={(event) => updateDraft(nextCaseData => {
                                                const prevId = nextCaseData.evidences[activeEvidenceIndex].id;
                                                nextCaseData.evidences[activeEvidenceIndex].id = event.target.value;
                                                nextCaseData.turns.forEach(turn => {
                                                    turn.weakPoints.forEach(weakPoint => {
                                                        if (weakPoint.evidenceId === prevId) {
                                                            weakPoint.evidenceId = event.target.value;
                                                        }
                                                    });
                                                    turn.loopDialogues.forEach(line => {
                                                        line.grantEvidenceIds = (line.grantEvidenceIds || []).map(id => id === prevId ? event.target.value : id);
                                                    });
                                                    turn.inspectOverrides = (turn.inspectOverrides || []).map(override => ({
                                                        ...override,
                                                        grantEvidenceIds: (override.grantEvidenceIds || []).map(id => id === prevId ? event.target.value : id)
                                                    }));
                                                });
                                            })}
                                        />
                                    </label>
                                    <label className="workshop-check-field">
                                        <span>{uiText.inventoryStart}</span>
                                        <input
                                            className="workshop-checkbox"
                                            type="checkbox"
                                            checked={currentEvidence.startsInInventory !== false}
                                            onChange={(event) => updateDraft(nextCaseData => {
                                                nextCaseData.evidences[activeEvidenceIndex].startsInInventory = event.target.checked;
                                                if (event.target.checked) {
                                                    const evidenceId = nextCaseData.evidences[activeEvidenceIndex].id;
                                                    nextCaseData.turns.forEach(turn => {
                                                        turn.loopDialogues.forEach(line => {
                                                            line.grantEvidenceIds = (line.grantEvidenceIds || []).filter(id => id !== evidenceId);
                                                        });
                                                        turn.inspectOverrides = (turn.inspectOverrides || []).map(override => ({
                                                            ...override,
                                                            grantEvidenceIds: (override.grantEvidenceIds || []).filter(id => id !== evidenceId)
                                                        }));
                                                    });
                                                }
                                            })}
                                        />
                                    </label>
                                </div>

                                {renderField(t.fields.evidenceName, currentEvidence.name, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.evidences[activeEvidenceIndex].name };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.evidences[activeEvidenceIndex].name = nextText;
                                }))}

                                {renderField(t.fields.evidenceDetail, currentEvidence.detail, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.evidences[activeEvidenceIndex].detail };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.evidences[activeEvidenceIndex].detail = nextText;
                                }), true, 5)}
                            </div>
                        )}

                        {view === 'turn' && currentTurn && (
                            <div className="workshop-editor-scroll">
                                <div className="workshop-turn-pager">
                                    <button
                                        type="button"
                                        className="workshop-turn-nav"
                                        onClick={() => jumpToTurn(activeTurnIndex - 1)}
                                        disabled={activeTurnIndex <= 0}
                                    >
                                        {uiText.previousTurn}
                                    </button>

                                    <div className="workshop-turn-page-readout">
                                        <span className="workshop-turn-page-label">{uiText.turnPager}</span>
                                        <div className="workshop-turn-page-frame">
                                            <input
                                                className="workshop-turn-page-input"
                                                value={turnPageInput}
                                                inputMode="numeric"
                                                onChange={(event) => {
                                                    const digits = event.target.value.replace(/[^\d]/g, '');
                                                    setTurnPageInput(digits);
                                                }}
                                                onBlur={commitTurnPageInput}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter') {
                                                        event.preventDefault();
                                                        commitTurnPageInput();
                                                    }
                                                }}
                                            />
                                            <span className="workshop-turn-page-total">/ {totalTurns}</span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="workshop-turn-nav"
                                        onClick={() => jumpToTurn(activeTurnIndex + 1)}
                                        disabled={activeTurnIndex >= totalTurns - 1}
                                    >
                                        {uiText.nextTurn}
                                    </button>
                                </div>

                                <div className="workshop-toolbar-row">
                                    <div className="workshop-inline-actions">
                                        <button
                                            type="button"
                                            className="workshop-text-btn"
                                            onClick={() => updateDraft(nextCaseData => {
                                                const fallbackEvidenceId = nextCaseData.evidences[0]?.id || '';
                                                nextCaseData.turns.push(createBlankLocalTurn(nextCaseData.turns.length + 1, fallbackEvidenceId));
                                                setActiveTurnIndex(nextCaseData.turns.length - 1);
                                            })}
                                        >
                                            {t.actions.addTurn}
                                        </button>

                                        <button
                                            type="button"
                                            className="workshop-text-btn danger"
                                            onClick={() => updateDraft(nextCaseData => {
                                                if (nextCaseData.turns.length <= 1) {
                                                    return;
                                                }

                                                nextCaseData.turns.splice(activeTurnIndex, 1);
                                            })}
                                        >
                                            {t.actions.removeTurn}
                                        </button>
                                    </div>
                                </div>

                                <>
                                        <div className="workshop-section">
                                            <div className="workshop-section-title">{uiText.turnSceneDefaults}</div>
                                            <div className="workshop-grid two">
                                                <label className="workshop-field">
                                                    <span>{uiText.backgroundSlot}</span>
                                                    <select
                                                        className="workshop-select"
                                                        value={currentTurn.sceneBackgroundSlot || 'cross_exam'}
                                                        onChange={(event) => updateDraft(nextCaseData => {
                                                            nextCaseData.turns[activeTurnIndex].sceneBackgroundSlot = event.target.value;
                                                        })}
                                                    >
                                                        {availableBackgroundSlots.map(item => (
                                                            <option key={item} value={item}>
                                                                {backgroundSlotLabel(item)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workshop-field">
                                                    <span>{uiText.portraitState}</span>
                                                    <select
                                                        className="workshop-select"
                                                        value={currentTurn.enemyPortraitState || 'neutral_idle'}
                                                        onChange={(event) => updateDraft(nextCaseData => {
                                                            nextCaseData.turns[activeTurnIndex].enemyPortraitState = event.target.value as PortraitState;
                                                        })}
                                                    >
                                                        {PORTRAIT_STATES.map(item => (
                                                            <option key={item} value={item}>
                                                                {portraitStateLabel(item)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workshop-field">
                                                    <span>{uiText.portraitMotion}</span>
                                                    <select
                                                        className="workshop-select"
                                                        value={currentTurn.enemyPortraitMotion || 'none'}
                                                        onChange={(event) => updateDraft(nextCaseData => {
                                                            nextCaseData.turns[activeTurnIndex].enemyPortraitMotion = event.target.value as PortraitMotion;
                                                        })}
                                                    >
                                                        {PORTRAIT_MOTIONS.map(item => (
                                                            <option key={item} value={item}>
                                                                {portraitMotionLabel(item)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workshop-field">
                                                    <span>{uiText.screenFilter}</span>
                                                    <select
                                                        className="workshop-select"
                                                        value={currentTurn.screenFilter || 'none'}
                                                        onChange={(event) => updateDraft(nextCaseData => {
                                                            nextCaseData.turns[activeTurnIndex].screenFilter = event.target.value as ScreenFilter;
                                                        })}
                                                    >
                                                        {SCREEN_FILTERS.map(item => (
                                                            <option key={item} value={item}>
                                                                {screenFilterLabel(item)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workshop-field">
                                                    <span>{uiText.screenImpulse}</span>
                                                    <select
                                                        className="workshop-select"
                                                        value={currentTurn.screenImpulse || 'none'}
                                                        onChange={(event) => updateDraft(nextCaseData => {
                                                            nextCaseData.turns[activeTurnIndex].screenImpulse = event.target.value as ScreenImpulse;
                                                        })}
                                                    >
                                                        {SCREEN_IMPULSES.map(item => (
                                                            <option key={item} value={item}>
                                                                {screenImpulseLabel(item)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label className="workshop-field">
                                                    <span>{uiText.sceneTransition}</span>
                                                    <select
                                                        className="workshop-select"
                                                        value={currentTurn.transition || 'cut'}
                                                        onChange={(event) => updateDraft(nextCaseData => {
                                                            nextCaseData.turns[activeTurnIndex].transition = event.target.value as SceneTransition;
                                                        })}
                                                    >
                                                        {SCENE_TRANSITIONS.map(item => (
                                                            <option key={item} value={item}>
                                                                {sceneTransitionLabel(item)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="workshop-subsection-header">
                                            <span>{t.turn.testimonyLines}</span>
                                            <button
                                                type="button"
                                                className="workshop-text-btn"
                                                onClick={() => insertDialogueCard()}
                                            >
                                                {t.actions.addLine}
                                            </button>
                                        </div>

                                        <div className="workshop-stack">
                                            {currentTurn.loopDialogues.map((dialogue, dialogueIndex) => {
                                                const dialogueWeakPoints = lineWeakPoints(dialogue.id);
                                                const lineOutcomeExpanded = Boolean(expandedLineOutcomeIds[dialogue.id]);

                                                return (
                                                <div
                                                    key={`loop-${dialogueIndex}`}
                                                    className="workshop-card"
                                                    ref={(node) => {
                                                        dialogueCardRefs.current[dialogue.id] = node;
                                                    }}
                                                >
                                                    <div className="workshop-card-header">
                                                        <span>{t.line.item(dialogueIndex + 1)}</span>
                                                        <div className="workshop-inline-actions">
                                                            <button
                                                                type="button"
                                                                className="workshop-text-btn"
                                                                onClick={() => insertDialogueCard(dialogueIndex)}
                                                            >
                                                                {uiText.addLineAfter}
                                                            </button>
                                                            {currentTurn.loopDialogues.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    className="workshop-text-btn danger"
                                                                    onClick={() => updateDraft(nextCaseData => {
                                                                        const removedLine = nextCaseData.turns[activeTurnIndex].loopDialogues[dialogueIndex];
                                                                        const removedWeakPointIds = nextCaseData.turns[activeTurnIndex].weakPoints
                                                                            .filter(item => item.lineId === removedLine.id)
                                                                            .map(item => item.id);
                                                                        nextCaseData.turns[activeTurnIndex].loopDialogues = nextCaseData.turns[activeTurnIndex].loopDialogues
                                                                            .filter((_, index) => index !== dialogueIndex);
                                                                        purgeLineIdsFromTurn(nextCaseData.turns[activeTurnIndex], [removedLine.id]);
                                                                        purgeWeakPointIdsFromTurn(nextCaseData.turns[activeTurnIndex], removedWeakPointIds);
                                                                    })}
                                                                >
                                                                    {t.actions.remove}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <HighlightedDialogueInput
                                                        rawValue={dialogue.text[activeLang] || ''}
                                                        plainValue={editDialogueValue(dialogue.text, activeLang)}
                                                        placeholder={stripWeakPointMarkers(displayText(dialogue.text, activeLang, fallbackLang))}
                                                        markerToneById={Object.fromEntries(
                                                            dialogueWeakPoints.map(weakPoint => [
                                                                weakPoint.id,
                                                                weakPoint.evidenceId ? 'linked' : 'fake'
                                                            ])
                                                        )}
                                                        onChange={(nextValue) => updateDialogueText(dialogueIndex, nextValue)}
                                                        onContextMenu={(event) => openWeakPointContextMenu(dialogue, event)}
                                                    />

                                                    <div className="workshop-card">
                                                        <div className="workshop-mini-label">{uiText.testimonySceneControls}</div>
                                                        <div className="workshop-grid two">
                                                            <label className="workshop-field">
                                                                <span>{uiText.portraitState}</span>
                                                                <select
                                                                    className="workshop-select"
                                                                    value={dialogue.portraitState || currentTurn.enemyPortraitState || 'neutral_idle'}
                                                                    onChange={(event) => updateDraft(nextCaseData => {
                                                                        nextCaseData.turns[activeTurnIndex].loopDialogues[dialogueIndex].portraitState =
                                                                            event.target.value as PortraitState;
                                                                    })}
                                                                >
                                                                    {PORTRAIT_STATES.map(item => (
                                                                        <option key={item} value={item}>
                                                                            {portraitStateLabel(item)}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>

                                                            <label className="workshop-field">
                                                                <span>{uiText.portraitMotion}</span>
                                                                <select
                                                                    className="workshop-select"
                                                                    value={dialogue.portraitMotion || 'none'}
                                                                    onChange={(event) => updateDraft(nextCaseData => {
                                                                        nextCaseData.turns[activeTurnIndex].loopDialogues[dialogueIndex].portraitMotion =
                                                                            event.target.value as PortraitMotion;
                                                                    })}
                                                                >
                                                                    {PORTRAIT_MOTIONS.map(item => (
                                                                        <option key={item} value={item}>
                                                                            {portraitMotionLabel(item)}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    <div className="workshop-grid two">
                                                        <label className="workshop-check-field">
                                                            <span>{uiText.hiddenLine}</span>
                                                            <input
                                                                className="workshop-checkbox"
                                                                type="checkbox"
                                                                checked={Boolean(dialogue.hidden)}
                                                                onChange={(event) => updateDraft(nextCaseData => {
                                                                    const turn = nextCaseData.turns[activeTurnIndex];
                                                                    const line = turn.loopDialogues[dialogueIndex];
                                                                    line.hidden = event.target.checked;
                                                                    if (event.target.checked) {
                                                                        if ((line.unlockMode || 'none') === 'none') {
                                                                            line.unlockMode = 'allTrueWeakPoints';
                                                                        }
                                                                    } else {
                                                                        line.unlockMode = 'none';
                                                                        line.unlockWeakPointIds = [];
                                                                        purgeLineIdsFromTurn(turn, [line.id]);
                                                                    }
                                                                })}
                                                            />
                                                        </label>

                                                        <label className="workshop-field workshop-inline-setting">
                                                            <span>{uiText.unlockMode}</span>
                                                            <select
                                                                className="workshop-select workshop-select-inline"
                                                                value={dialogue.unlockMode || 'none'}
                                                                disabled={!dialogue.hidden}
                                                                onChange={(event) => updateDraft(nextCaseData => {
                                                                    const line = nextCaseData.turns[activeTurnIndex].loopDialogues[dialogueIndex];
                                                                    line.unlockMode = event.target.value as UnlockMode;
                                                                    if (line.unlockMode !== 'specificWeakPoints') {
                                                                        line.unlockWeakPointIds = [];
                                                                    }
                                                                })}
                                                            >
                                                                {revealModes.map(mode => (
                                                                    <option key={mode.value} value={mode.value}>{mode.label}</option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>

                                                    {dialogue.hidden && (dialogue.unlockMode || 'none') === 'specificWeakPoints' && (
                                                        <div className="workshop-stack">
                                                            <div className="workshop-mini-label">{uiText.unlockWeakPoints}</div>
                                                            <div className="workshop-chip-grid">
                                                                {currentWeakPoints.map((weakPoint, weakIndex) => {
                                                                    const selected = (dialogue.unlockWeakPointIds || []).includes(weakPoint.id);
                                                                    const disabled = !selected && isOwnedByOther(specificUnlockOwnerByWeakPointId, weakPoint.id, dialogue.id);
                                                                    return (
                                                                        <button
                                                                            key={weakPoint.id}
                                                                            type="button"
                                                                            className={`workshop-chip ${selected ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                                            disabled={disabled}
                                                                            title={disabled ? uiText.choiceLocked : undefined}
                                                                            onClick={() => updateDraft(nextCaseData => {
                                                                                const line = nextCaseData.turns[activeTurnIndex].loopDialogues[dialogueIndex];
                                                                                const currentIds = new Set(line.unlockWeakPointIds || []);
                                                                                if (currentIds.has(weakPoint.id)) {
                                                                                    currentIds.delete(weakPoint.id);
                                                                                } else {
                                                                                    currentIds.add(weakPoint.id);
                                                                                }
                                                                                line.unlockWeakPointIds = Array.from(currentIds);
                                                                            })}
                                                                        >
                                                                            {buildWeakPointLabel(weakPoint, weakIndex)}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="workshop-stack">
                                                        <div className="workshop-mini-label">{uiText.grantedEvidence}</div>
                                                        <div className="workshop-chip-grid">
                                                            {draft.caseData.evidences
                                                                .filter(evidence => evidence.startsInInventory === false || (dialogue.grantEvidenceIds || []).includes(evidence.id))
                                                                .map(evidence => {
                                                                const selected = (dialogue.grantEvidenceIds || []).includes(evidence.id);
                                                                const disabled = !selected && isOwnedByOther(evidenceGrantOwnerByEvidenceId, evidence.id, `line:${dialogue.id}`);
                                                                return (
                                                                    <button
                                                                        key={`${dialogue.id}-${evidence.id}`}
                                                                        type="button"
                                                                        className={`workshop-chip ${selected ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                                                                        disabled={disabled}
                                                                        title={disabled ? uiText.choiceLocked : undefined}
                                                                        onClick={() => updateDraft(nextCaseData => {
                                                                            const line = nextCaseData.turns[activeTurnIndex].loopDialogues[dialogueIndex];
                                                                            const currentIds = new Set(line.grantEvidenceIds || []);
                                                                            if (currentIds.has(evidence.id)) {
                                                                                currentIds.delete(evidence.id);
                                                                            } else {
                                                                                currentIds.add(evidence.id);
                                                                                const targetEvidence = nextCaseData.evidences.find(item => item.id === evidence.id);
                                                                                if (targetEvidence) {
                                                                                    targetEvidence.startsInInventory = false;
                                                                                }
                                                                            }
                                                                            line.grantEvidenceIds = Array.from(currentIds);
                                                                        })}
                                                                    >
                                                                        {displayText(evidence.name, activeLang, fallbackLang)}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    <div className="workshop-stack">
                                                        <div className="workshop-mini-label">{uiText.lineWeakPoints}</div>
                                                        {dialogueWeakPoints.length === 0 ? (
                                                            <p className="workshop-help">{uiText.noLineWeakPoints}</p>
                                                        ) : (
                                                            dialogueWeakPoints.map((weakPoint, weakIndex) => (
                                                                <div key={weakPoint.id} className="workshop-card">
                                                                    <div className="workshop-card-header">
                                                                        <span>{buildWeakPointLabel(weakPoint, weakIndex)}</span>
                                                                        <button
                                                                            type="button"
                                                                            className="workshop-text-btn danger"
                                                                            onClick={() => clearWeakPointSelection(weakPoint.id)}
                                                                        >
                                                                            {t.actions.unsetWeakPoint}
                                                                        </button>
                                                                    </div>
                                                                    <label className="workshop-field">
                                                                        <span>{t.fields.linkedEvidence}</span>
                                                                        <select
                                                                            className="workshop-select"
                                                                            value={weakPoint.evidenceId || ''}
                                                                            onChange={(event) => updateDraft(nextCaseData => {
                                                                                const target = nextCaseData.turns[activeTurnIndex].weakPoints.find(item => item.id === weakPoint.id);
                                                                                if (target) {
                                                                                    const nextEvidenceId = event.target.value;
                                                                                    target.evidenceId = nextEvidenceId;
                                                                                    target.consumeEvidenceOnUse = true;
                                                                                }
                                                                            })}
                                                                        >
                                                                            <option value="">{t.turn.fakeUnlinked}</option>
                                                                            {draft.caseData.evidences.map(evidence => (
                                                                                <option key={evidence.id} value={evidence.id}>
                                                                                    {displayText(evidence.name, activeLang, fallbackLang)}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                    <label className="workshop-check-field">
                                                                        <span>{uiText.consumeEvidenceOnUse}</span>
                                                                        <input
                                                                            className="workshop-checkbox"
                                                                            type="checkbox"
                                                                            disabled={!weakPoint.evidenceId}
                                                                            checked={weakPoint.evidenceId ? weakPoint.consumeEvidenceOnUse !== false : false}
                                                                            onChange={(event) => updateDraft(nextCaseData => {
                                                                                const target = nextCaseData.turns[activeTurnIndex].weakPoints.find(item => item.id === weakPoint.id);
                                                                                if (target) {
                                                                                    target.consumeEvidenceOnUse = event.target.checked;
                                                                                }
                                                                            })}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    {dialogueWeakPoints.length > 0 && (
                                                        <div className="workshop-stack">
                                                            <button
                                                                type="button"
                                                                className={`workshop-toggle-btn ${lineOutcomeExpanded ? 'active' : ''}`}
                                                                onClick={() => toggleLineOutcome(dialogue.id)}
                                                            >
                                                                {lineOutcomeExpanded ? uiText.hideLineOutcomeSettings : uiText.showLineOutcomeSettings}
                                                            </button>

                                                            {lineOutcomeExpanded && renderWeakPointOutcomeSettings(dialogue)}
                                                        </div>
                                                    )}
                                                </div>
                                                );
                                            })}
                                        </div>

                                        <div className="workshop-inline-actions">
                                            <button
                                                type="button"
                                                className="workshop-text-btn"
                                                onClick={() => insertDialogueCard(currentTurn.loopDialogues.length - 1)}
                                            >
                                                {uiText.addLineAfter}
                                            </button>
                                        </div>

                                        <div ref={(node) => setSectionRef('query-feedback', node)} className="workshop-stack">
                                            <div className="workshop-subsection-header">
                                                <span>{t.turn.queryFeedback}</span>
                                                <button
                                                    type="button"
                                                    className="workshop-text-btn"
                                                    onClick={() => updateDraft(nextCaseData => {
                                                        nextCaseData.turns[activeTurnIndex].queryNarratives.push(createBlankLocalizedText());
                                                    })}
                                                >
                                                    {t.actions.addLine}
                                                </button>
                                            </div>

                                            <div className="workshop-stack">
                                                {currentTurn.queryNarratives.map((entry, index) => (
                                                    <div key={`query-${index}`} className="workshop-card">
                                                        <div className="workshop-card-header">
                                                            <span>{t.line.query(index + 1)}</span>
                                                            {currentTurn.queryNarratives.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    className="workshop-text-btn danger"
                                                                    onClick={() => updateDraft(nextCaseData => {
                                                                        nextCaseData.turns[activeTurnIndex].queryNarratives = nextCaseData.turns[activeTurnIndex].queryNarratives
                                                                            .filter((_, itemIndex) => itemIndex !== index);
                                                                    })}
                                                                >
                                                                    {t.actions.remove}
                                                                </button>
                                                            )}
                                                        </div>

                                                        <textarea
                                                            className="workshop-textarea"
                                                            rows={3}
                                                            value={editValue(entry, activeLang)}
                                                            placeholder={displayText(entry, activeLang, fallbackLang)}
                                                            onChange={(event) => updateDraft(nextCaseData => {
                                                                const nextValue = { ...nextCaseData.turns[activeTurnIndex].queryNarratives[index] };
                                                                setLocalized(nextValue, event.target.value);
                                                                nextCaseData.turns[activeTurnIndex].queryNarratives[index] = nextValue;
                                                            })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="workshop-card">
                                                <div className="workshop-mini-label">{uiText.genericInspectAvg}</div>
                                                {renderAvgList(currentTurn.queryAvg, (nextLines) => updateDraft(nextCaseData => {
                                                    nextCaseData.turns[activeTurnIndex].queryAvg = nextLines;
                                                }))}
                                            </div>
                                        </div>

                                        {renderGenericResolutionSections()}

                                        <div ref={(node) => setSectionRef('interference', node)} className="workshop-stack">
                                            <div className="workshop-subsection-header">
                                                <span>{t.turn.interferenceWindows}</span>
                                                <button
                                                    type="button"
                                                    className="workshop-text-btn"
                                                    onClick={() => updateDraft(nextCaseData => {
                                                        nextCaseData.turns[activeTurnIndex].interferenceLines = [
                                                            ...(nextCaseData.turns[activeTurnIndex].interferenceLines || []),
                                                            createBlankLocalizedText()
                                                        ];
                                                    })}
                                                >
                                                    {t.actions.addLine}
                                                </button>
                                            </div>

                                            <div className="workshop-stack">
                                                {(currentTurn.interferenceLines || []).map((entry, index) => (
                                                    <div key={`interference-${index}`} className="workshop-card">
                                                        <div className="workshop-card-header">
                                                            <span>{t.line.interference(index + 1)}</span>
                                                            <button
                                                                type="button"
                                                                className="workshop-text-btn danger"
                                                                onClick={() => updateDraft(nextCaseData => {
                                                                    nextCaseData.turns[activeTurnIndex].interferenceLines = (nextCaseData.turns[activeTurnIndex].interferenceLines || [])
                                                                        .filter((_, itemIndex) => itemIndex !== index);
                                                                })}
                                                            >
                                                                {t.actions.remove}
                                                            </button>
                                                        </div>

                                                        <textarea
                                                            className="workshop-textarea"
                                                            rows={2}
                                                            value={editValue(entry, activeLang)}
                                                            placeholder={displayText(entry, activeLang, fallbackLang)}
                                                            onChange={(event) => updateDraft(nextCaseData => {
                                                                const list = [...(nextCaseData.turns[activeTurnIndex].interferenceLines || [])];
                                                                const nextValue = { ...list[index] };
                                                                setLocalized(nextValue, event.target.value);
                                                                list[index] = nextValue;
                                                                nextCaseData.turns[activeTurnIndex].interferenceLines = list;
                                                            })}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                            </div>
                        )}

                        {view === 'victory' && (
                            <div className="workshop-editor-scroll">
                                <div className="workshop-section">
                                    <div className="workshop-section-title">{uiText.victoryScene}</div>
                                    <div className="workshop-grid two">
                                        <label className="workshop-field">
                                            <span>{uiText.backgroundSlot}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.victory.backgroundSlot || 'ending'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.victory.backgroundSlot = event.target.value;
                                                })}
                                            >
                                                {availableBackgroundSlots.map(item => (
                                                    <option key={item} value={item}>
                                                        {backgroundSlotLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.screenFilter}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.victory.screenFilter || 'none'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.victory.screenFilter = event.target.value as ScreenFilter;
                                                })}
                                            >
                                                {SCREEN_FILTERS.map(item => (
                                                    <option key={item} value={item}>
                                                        {screenFilterLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="workshop-field">
                                            <span>{uiText.sceneTransition}</span>
                                            <select
                                                className="workshop-select"
                                                value={draft.caseData.victory.transition || 'cut'}
                                                onChange={(event) => updateDraft(nextCaseData => {
                                                    nextCaseData.victory.transition = event.target.value as SceneTransition;
                                                })}
                                            >
                                                {SCENE_TRANSITIONS.map(item => (
                                                    <option key={item} value={item}>
                                                        {sceneTransitionLabel(item)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>
                                </div>

                                {renderField(t.fields.endingSummary, draft.caseData.victory.narrative, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.victory.narrative };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.victory.narrative = nextText;
                                }), true, 5)}

                                {renderField(t.fields.confession, draft.caseData.victory.confession, (nextValue) => updateDraft(nextCaseData => {
                                    const nextText = { ...nextCaseData.victory.confession };
                                    setLocalized(nextText, nextValue);
                                    nextCaseData.victory.confession = nextText;
                                }), true, 4)}

                                <div className="workshop-section-title">{t.turn.endingAvg}</div>
                                {renderAvgList(draft.caseData.victory.avg, (nextLines) => updateDraft(nextCaseData => {
                                    nextCaseData.victory.avg = nextLines;
                                }))}
                            </div>
                        )}

                        {view === 'import' && (
                            <div className="workshop-editor-scroll">
                                <p className="workshop-help">{t.importHelp}</p>
                                <label className="workshop-field workshop-field-grow">
                                    <span>{t.fields.rawCaseTxt}</span>
                                    <textarea
                                        className="workshop-raw"
                                        value={rawInput}
                                        onChange={(event) => setRawInput(event.target.value)}
                                    />
                                </label>
                                <div className="workshop-footer">
                                    <button type="button" className="workshop-text-btn" onClick={handleBuildRaw}>
                                        {t.actions.buildTxt}
                                    </button>
                                    <button type="button" className="workshop-text-btn primary" onClick={handleNormalizeImport}>
                                        {t.actions.normalizeTxt}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {weakPointContextMenu && (
                <div
                    className="workshop-context-menu"
                    style={{ left: weakPointContextMenu.x, top: weakPointContextMenu.y }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onContextMenu={(event) => event.preventDefault()}
                >
                    <button
                        type="button"
                        className="workshop-context-action"
                        onClick={() => {
                            if (weakPointContextMenu.action === 'unset' && weakPointContextMenu.weakPointId) {
                                clearWeakPointSelection(weakPointContextMenu.weakPointId);
                            } else {
                                applyWeakPointSelection(
                                    weakPointContextMenu.selectedText,
                                    weakPointContextMenu.lineId,
                                    weakPointContextMenu.start || 0,
                                    weakPointContextMenu.end || 0
                                );
                            }
                        }}
                    >
                        {weakPointContextMenu.action === 'unset' ? t.actions.unsetWeakPoint : t.actions.setWeakPoint}
                    </button>
                </div>
            )}
        </div>
    );
};

