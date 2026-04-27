import React, { useState } from 'react';
import { Language } from '../types';
import { SystemStreamBackdrop } from './SystemStreamBackdrop';

interface StartScreenProps {
    onSelectLanguage: (lang: Language) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ onSelectLanguage }) => {
    const [isActivated, setIsActivated] = useState(false);
    const clock = new Date().toLocaleTimeString('en-GB', { hour12: false });

    return (
        <div
            id="start-screen"
            className={`screen active ${isActivated ? 'start-activated' : 'start-awaiting'}`}
            onClick={() => {
                if (!isActivated) {
                    setIsActivated(true);
                }
            }}
        >
            <SystemStreamBackdrop columns={4} className="start-bg-console" />

            <div className="start-menu-shell">
                <div className="start-meta-row">
                    <span>[ COURT INTERFACE NODE ]</span>
                    <span>{clock}</span>
                </div>

                <div className="start-heading-block">
                    <h1 className="start-title">OVERRIDE</h1>
                    <div className="start-rule-row">
                        <span className="start-rule-line" />
                        {!isActivated ? (
                            <span className="start-click-hint blink">CLICK TO START</span>
                        ) : (
                            <span className="start-click-hint ready">LANGUAGE MENU READY</span>
                        )}
                    </div>
                </div>

                <p className="start-kicker">TRIAL SYSTEM READY // SELECT LANGUAGE</p>

                <div className="start-lang-slot">
                    {isActivated ? (
                        <div className="start-lang-list">
                            <button
                                className="start-lang-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLanguage('zh');
                                }}
                            >
                                中文
                            </button>
                            <button
                                className="start-lang-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLanguage('ja');
                                }}
                            >
                                日本語
                            </button>
                            <button
                                className="start-lang-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectLanguage('en');
                                }}
                            >
                                ENGLISH
                            </button>
                        </div>
                    ) : (
                        <div className="start-lang-placeholder">LANGUAGE OPTIONS LOCKED</div>
                    )}
                </div>

                <div className="start-footnote">PRESS INPUT TO START SESSION</div>
            </div>
        </div>
    );
};
