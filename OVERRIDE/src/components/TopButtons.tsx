import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GamePhase, ScreenType } from '../types';

interface TopButtonsProps {
    screen: ScreenType;
    gamePhase: GamePhase;
    onHome: () => void;
    onRestart: () => void;
    isMuted: boolean;
    onToggleMute: () => void;
}

interface MenuAction {
    key: string;
    label: string;
    onClick: () => void;
}

export const TopButtons: React.FC<TopButtonsProps> = ({
    screen,
    gamePhase,
    onHome,
    onRestart,
    isMuted,
    onToggleMute
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsOpen(false);
    }, [screen, gamePhase]);

    useEffect(() => {
        const onPointerDown = (event: MouseEvent) => {
            if (!menuRef.current) return;
            if (!menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, []);

    const actions = useMemo<MenuAction[]>(() => {
        const list: MenuAction[] = [];

        if (screen === 'game') {
            list.push(
                { key: 'home', label: 'HOME', onClick: onHome },
                { key: 'restart', label: 'RESTART', onClick: onRestart }
            );
        }

        list.push({
            key: 'mute',
            label: isMuted ? 'UNMUTE' : 'MUTE',
            onClick: onToggleMute
        });

        return list;
    }, [screen, isMuted, onHome, onRestart, onToggleMute]);

    return (
        <div className="top-menu" ref={menuRef}>
            <button
                id="menu-toggle"
                title="Open Menu"
                onClick={() => setIsOpen(prev => !prev)}
                aria-expanded={isOpen}
                aria-label="Open menu"
            >
                ≡
            </button>
            {isOpen && (
                <div className="top-menu-panel">
                    {actions.map(action => (
                        <button
                            key={action.key}
                            className="top-menu-item"
                            onClick={() => {
                                action.onClick();
                                setIsOpen(false);
                            }}
                        >
                            {action.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
