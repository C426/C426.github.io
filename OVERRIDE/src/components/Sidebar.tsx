import React from 'react';
import { Language } from '../types';
import { i18n } from '../i18n';
import { playEvidenceHoverSfx, playEvidenceSelectSfx } from '../utils/sfx';

interface SidebarProps {
    evidenceMap: Map<string, string>;
    lang: Language;
    selectedEvidence: string | null;
    onSelectEvidence: (name: string | null) => void;
    showTooltip: (e: React.MouseEvent, content: string) => void;
    hideTooltip: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ evidenceMap, lang, selectedEvidence, onSelectEvidence, showTooltip, hideTooltip }) => {
    const t = i18n[lang];

    return (
        <div className="sidebar">
            <div className="sidebar-title">EVIDENCE FILE</div>
            <div className="sidebar-subtitle">MAX: 7</div>
            <div id="evidence-list">
                {evidenceMap.size === 0 ? (
                    <div style={{ textAlign: 'center', color: '#666', fontSize: '0.8em', marginTop: '20px' }}>
                        {t.emptyEvidence}
                    </div>
                ) : (
                    Array.from(evidenceMap.entries()).map(([name, detail]) => (
                        <div 
                            key={name} 
                            className={`evidence-item ${selectedEvidence === name ? 'selected' : ''}`}
                            onClick={() => {
                                playEvidenceSelectSfx();
                                onSelectEvidence(selectedEvidence === name ? null : name);
                            }}
                            onMouseEnter={(e) => {
                                playEvidenceHoverSfx();
                                showTooltip(e, `<strong>${name}</strong><br>${detail}`);
                            }}
                            onMouseMove={(e) => showTooltip(e, `<strong>${name}</strong><br>${detail}`)}
                            onMouseLeave={hideTooltip}
                        >
                            {name}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
