import React from 'react';
import { Language } from '../types';

interface EndScreenProps {
    lang: Language;
    victory: boolean;
    summary: string;
    actions: Array<{
        key: string;
        label: string;
        description: string;
        onClick: () => void;
        disabled?: boolean;
    }>;
    canSaveAiCase?: boolean;
    onSaveAiCase?: () => void;
    saveAiCaseState?: 'idle' | 'saving' | 'saved' | 'error';
    saveAiCaseMessage?: string | null;
}

const texts = {
    zh: {
        victoryTitle: '\u6848\u4ef6\u7ec8\u7ed3',
        defeatTitle: '\u5ba1\u5224\u5931\u8d25',
        restart: '\u91cd\u65b0\u5f00\u59cb',
        home: '\u8fd4\u56de\u4e3b\u83dc\u5355',
        save: '\u4fdd\u5b58 AI \u5267\u672c',
        saving: '\u4fdd\u5b58\u4e2d...'
    },
    ja: {
        victoryTitle: '\u4e8b\u4ef6\u7d42\u7d50',
        defeatTitle: '\u88c1\u5224\u5931\u6557',
        restart: '\u3084\u308a\u76f4\u3059',
        home: '\u30e1\u30a4\u30f3\u30e1\u30cb\u30e5\u30fc',
        save: 'AI\u811a\u672c\u3092\u4fdd\u5b58',
        saving: '\u4fdd\u5b58\u4e2d...'
    },
    en: {
        victoryTitle: 'Case Closed',
        defeatTitle: 'Trial Failed',
        restart: 'Restart',
        home: 'Main Menu',
        save: 'Save AI Script',
        saving: 'Saving...'
    }
} satisfies Record<Language, {
    victoryTitle: string;
    defeatTitle: string;
    restart: string;
    home: string;
    save: string;
    saving: string;
}>;

export const EndScreen: React.FC<EndScreenProps> = ({
    lang,
    victory,
    summary,
    actions,
    canSaveAiCase = false,
    onSaveAiCase,
    saveAiCaseState = 'idle',
    saveAiCaseMessage = null
}) => {
    const t = texts[lang];
    const primaryActions = actions.filter(action => action.key !== 'home');
    const secondaryActions = actions.filter(action => action.key === 'home');

    return (
        <div id="end-screen" className="screen active end-screen">
            <div className="end-card">
                <div className="end-card-header">
                    <div className="end-card-heading">
                        <h2>{victory ? t.victoryTitle : t.defeatTitle}</h2>
                        <p>{summary}</p>
                    </div>
                    {canSaveAiCase && onSaveAiCase && (
                        <button
                            className="big-btn end-tool-btn"
                            onClick={onSaveAiCase}
                            disabled={saveAiCaseState === 'saving'}
                        >
                            {saveAiCaseState === 'saving' ? t.saving : t.save}
                        </button>
                    )}
                </div>
                {saveAiCaseMessage && <p className="end-note">{saveAiCaseMessage}</p>}
                <div className="end-actions-primary">
                    {primaryActions.map(action => (
                        <div key={action.key} className="end-action-stack">
                            <button
                                className="big-btn end-action-btn primary"
                                onClick={action.onClick}
                                disabled={action.disabled}
                            >
                                <span className="end-action-label">{action.label}</span>
                            </button>
                            <span className="end-action-description">{action.description}</span>
                        </div>
                    ))}
                </div>
                {secondaryActions.length > 0 && (
                    <div className="end-actions-secondary">
                        {secondaryActions.map(action => (
                            <div key={action.key} className="end-action-stack secondary">
                                <button
                                    className="big-btn end-action-btn secondary"
                                    onClick={action.onClick}
                                    disabled={action.disabled}
                                >
                                    <span className="end-action-label">{action.label}</span>
                                </button>
                                <span className="end-action-description">{action.description}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
