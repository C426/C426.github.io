import React, { useState, useEffect, useMemo } from 'react';
import { TypingBlock, Token } from './TypingBlock';
import { GamePhase, Language } from '../types';
import { playEvidenceHoverSfx } from '../utils/sfx';

interface IntroScreenProps {
    phase: 'intro_narrative';
    narrative: string;
    evidences: Token[];
    collectedEvidences: Set<string>;
    onContinue: (nextPhase: GamePhase) => void;
    onCollect: (name: string, detail: string) => void;
    showTooltip: (e: React.MouseEvent, content: string) => void;
    hideTooltip: () => void;
    lang: Language;
}

const t = {
    en: {
        evidencePrompt: 'Initial evidence:',
        progressHint: (read: number, total: number) => `Hover over glowing evidence to inspect details (${read}/${total})`,
        continueHint: 'Evidence synchronized. Click anywhere to continue.'
    },
    zh: {
        evidencePrompt: '你的初始证物：',
        progressHint: (read: number, total: number) => `将鼠标悬停在发光证据上查看详情（已查看 ${read}/${total}）`,
        continueHint: '证据同步完成，点击画面继续游戏。'
    },
    ja: {
        evidencePrompt: '初期証拠：',
        progressHint: (read: number, total: number) => `光る証拠にカーソルを合わせて詳細確認（${read}/${total}）`,
        continueHint: '証拠同期完了。画面クリックで続行。'
    }
};

const stripEvidenceMarkup = (text: string) => text.replace(/\{\{(.*?)\|(.*?)\}\}/g, '$1');

export const IntroScreen: React.FC<IntroScreenProps> = ({
    phase,
    narrative,
    evidences,
    collectedEvidences,
    onContinue,
    onCollect,
    showTooltip,
    hideTooltip,
    lang
}) => {
    const [isNarrativeTypingDone, setIsNarrativeTypingDone] = useState(false);
    const [isEvidenceTypingDone, setIsEvidenceTypingDone] = useState(false);
    const [readEvidences, setReadEvidences] = useState<Set<string>>(new Set());

    const cleanNarrative = useMemo(() => stripEvidenceMarkup(narrative), [narrative]);
    const evidenceTokens = useMemo(
        () => evidences.filter((token): token is Extract<Token, { type: 'evidence' }> => token.type === 'evidence'),
        [evidences]
    );

    const evidenceTypingText = useMemo(() => {
        const evidenceLines = evidenceTokens.map(token => `{{${token.name}|${token.detail}}}`).join('\n');
        return evidenceLines ? `${t[lang].evidencePrompt}\n${evidenceLines}` : t[lang].evidencePrompt;
    }, [evidenceTokens, lang]);

    useEffect(() => {
        setIsNarrativeTypingDone(false);
        setIsEvidenceTypingDone(false);
        setReadEvidences(new Set(collectedEvidences));
    }, [narrative]);

    const handleCollectEvidence = (name: string, detail: string) => {
        if (readEvidences.has(name)) return;
        const next = new Set(readEvidences);
        next.add(name);
        setReadEvidences(next);
        onCollect(name, detail);
    };

    const handleHoverEvidence = (e: React.MouseEvent, name: string, detail: string) => {
        showTooltip(e, `<strong>${name}</strong><br>${detail}`);
    };

    if (phase !== 'intro_narrative') {
        return null;
    }

    const allRead = evidenceTokens.length === 0 || readEvidences.size === evidenceTokens.length;
    const canContinue = isNarrativeTypingDone && isEvidenceTypingDone && allRead;
    const canInspectEvidence = isNarrativeTypingDone && isEvidenceTypingDone;

    return (
        <div
            className={`intro-screen ${canContinue ? 'can-continue' : ''}`}
            onClick={() => {
                if (canContinue) {
                    onContinue('playing');
                }
            }}
        >
            <div className="intro-narrative-container">
                <TypingBlock
                    text={cleanNarrative}
                    speed={65}
                    onComplete={() => setIsNarrativeTypingDone(true)}
                    renderToken={(_, visibleContent) => <span>{visibleContent}</span>}
                    showTypingCursor
                    typingCursorChar="_"
                />
            </div>

            {isNarrativeTypingDone && (
                <div className="intro-evidence-panel">
                    <div className="intro-evidence-typing-block">
                        <TypingBlock
                            text={evidenceTypingText}
                            speed={58}
                            onComplete={() => setIsEvidenceTypingDone(true)}
                            showTypingCursor
                            typingCursorChar="_"
                            renderToken={(token, visibleContent) => {
                                if (token.type !== 'evidence') {
                                    return <span>{visibleContent}</span>;
                                }

                                const collected = readEvidences.has(token.name);
                                return (
                                    <span
                                        className={`intro-evidence-link ${collected ? 'collected' : ''} ${canInspectEvidence ? '' : 'disabled'}`}
                                        onMouseEnter={(e) => {
                                            if (!canInspectEvidence) return;
                                            playEvidenceHoverSfx();
                                            handleCollectEvidence(token.name, token.detail);
                                            handleHoverEvidence(e, token.name, token.detail);
                                        }}
                                        onMouseMove={(e) => {
                                            if (!canInspectEvidence) return;
                                            handleHoverEvidence(e, token.name, token.detail);
                                        }}
                                        onMouseLeave={() => {
                                            if (!canInspectEvidence) return;
                                            hideTooltip();
                                        }}
                                    >
                                        {visibleContent}
                                    </span>
                                );
                            }}
                        />
                    </div>

                    <div className={`intro-progress-hint ${canContinue ? 'blink' : ''}`}>
                        {canContinue
                            ? t[lang].continueHint
                            : t[lang].progressHint(readEvidences.size, evidenceTokens.length)}
                    </div>
                </div>
            )}
        </div>
    );
};


