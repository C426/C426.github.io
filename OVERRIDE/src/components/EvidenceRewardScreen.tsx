import React, { useEffect, useRef, useState } from 'react';
import { EvidenceEntry, Language } from '../types';
import { playEvidenceHoverSfx } from '../utils/sfx';

interface EvidenceRewardScreenProps {
    lang: Language;
    evidences: EvidenceEntry[];
    onContinue: () => void;
    showTooltip: (e: React.MouseEvent, content: string) => void;
    hideTooltip: () => void;
}

const t = {
    en: {
        title: 'New evidence synchronized:',
        progressHint: (read: number, total: number) => `Hover over the evidence to inspect details (${read}/${total})`,
        continueHint: 'Evidence archive updated. Click anywhere to continue.'
    },
    zh: {
        title: '已获得新证据：',
        progressHint: (read: number, total: number) => `将鼠标悬停在证据上查看详情（已查看 ${read}/${total}）`,
        continueHint: '证据档案已更新，点击画面继续。'
    },
    ja: {
        title: '新しい証拠を取得：',
        progressHint: (read: number, total: number) => `証拠にカーソルを合わせて詳細確認（${read}/${total}）`,
        continueHint: '証拠ファイル更新完了。画面クリックで続行。'
    }
};

export const EvidenceRewardScreen: React.FC<EvidenceRewardScreenProps> = ({
    lang,
    evidences,
    onContinue,
    showTooltip,
    hideTooltip
}) => {
    const [readEvidences, setReadEvidences] = useState<Set<string>>(new Set());
    const hideTooltipRef = useRef(hideTooltip);

    useEffect(() => {
        setReadEvidences(new Set());
    }, [evidences]);

    useEffect(() => {
        hideTooltipRef.current = hideTooltip;
    }, [hideTooltip]);

    useEffect(() => () => hideTooltipRef.current(), []);

    const total = evidences.length;
    const canInspect = true;
    const canContinue = canInspect && (total === 0 || readEvidences.size === total);

    const handleInspect = (name: string) => {
        if (!readEvidences.has(name)) {
            setReadEvidences(prev => new Set(prev).add(name));
        }
        playEvidenceHoverSfx();
    };

    return (
        <div
            className={`evidence-reward-screen ${canContinue ? 'can-continue' : ''}`}
            onClick={() => {
                if (canContinue) {
                    hideTooltip();
                    onContinue();
                }
            }}
        >
            <div className="evidence-reward-panel">
                <div className="evidence-reward-title">{t[lang].title}</div>

                <div className="evidence-reward-list">
                    {evidences.map(evidence => {
                        const collected = readEvidences.has(evidence.name);
                        return (
                            <div key={`${evidence.name}-${evidence.detail}`} className="evidence-reward-row">
                                <span
                                    className={`intro-evidence-link evidence-reward-link ${collected ? 'collected' : ''} ${canInspect ? '' : 'disabled'}`}
                                    onMouseEnter={(e) => {
                                        if (!canInspect) return;
                                        handleInspect(evidence.name);
                                        showTooltip(e, `<strong>${evidence.name}</strong><br>${evidence.detail}`);
                                    }}
                                    onMouseMove={(e) => {
                                        if (!canInspect) return;
                                        showTooltip(e, `<strong>${evidence.name}</strong><br>${evidence.detail}`);
                                    }}
                                    onMouseLeave={() => {
                                        if (!canInspect) return;
                                        hideTooltip();
                                    }}
                                >
                                    {evidence.name}
                                </span>
                            </div>
                        );
                    })}
                </div>

                <div className={`evidence-reward-hint intro-progress-hint ${canContinue ? 'blink' : ''}`}>
                    {canContinue
                        ? t[lang].continueHint
                        : t[lang].progressHint(readEvidences.size, total)}
                </div>
            </div>
        </div>
    );
};
