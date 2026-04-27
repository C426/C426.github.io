import React from 'react';
import { GameState, Language } from '../types';
import { i18n } from '../i18n';

interface StatusBarProps {
    gameState: GameState;
    lang: Language;
}

const INVALID_STATUS_NAME_KEYS = new Set([
    '',
    'unknown',
    'unknownsuspect',
    'suspect',
    'target',
    'enemy',
    '未知嫌犯',
    '未知容疑者',
    '嫌疑人',
    '嫌犯',
    '容疑者'
]);

const normalizeStatusName = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[\s_\-]+/g, '')
        .replace(/[.,!?。！？、，"'`]/g, '');

export const StatusBar: React.FC<StatusBarProps> = ({ gameState, lang }) => {
    const t = i18n[lang];
    const enemyPercent = Math.round(gameState.enemyHp);
    const heroPercent = Math.round(gameState.heroHp);
    const suspectName = gameState.suspectName && !INVALID_STATUS_NAME_KEYS.has(normalizeStatusName(gameState.suspectName))
        ? gameState.suspectName
        : null;

    return (
        <div id="status-bar">
            <div className="hp-box enemy-theme">
                <div className="status-head">
                    <span className="status-id">[01] TARGET</span>
                    <span id="enemy-name-ui" className="status-name">{suspectName || t.enemy}</span>
                </div>
                <div className="hp-bar-bg compact">
                    <div id="enemy-hp-bar" className="hp-bar-fill" style={{ width: `${gameState.enemyHp}%` }} />
                </div>
                <div className="meter-caption dual">
                    <span>MENTAL SHIELD</span>
                    <span>{enemyPercent}%</span>
                </div>
            </div>

            <div className="hp-box hero-theme">
                <div className="status-head">
                    <span className="status-id">[02] PLAYER</span>
                    <span id="hero-name-ui" className="status-name">{t.hero}</span>
                </div>
                <div className="hp-bar-bg compact">
                    <div id="hero-hp-bar" className="hp-bar-fill" style={{ width: `${gameState.heroHp}%` }} />
                </div>
                <div className="meter-caption dual">
                    <span>LOGIC DRIVE</span>
                    <span>{heroPercent}%</span>
                </div>
            </div>
        </div>
    );
};
