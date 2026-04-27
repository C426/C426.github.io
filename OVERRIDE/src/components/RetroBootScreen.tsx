import React, { useEffect, useRef, useState } from 'react';
import { BootFlightToy } from './BootFlightToy';

interface RetroBootScreenProps {
    onComplete?: () => void;
    bootLines?: string[];
    panelTitle?: string;
    panelStage?: string;
    panelStatus?: 'working' | 'error';
    panelAttempt?: number;
    panelMaxAttempts?: number;
    panelError?: string | null;
    onRetry?: () => void;
    onCancel?: () => void;
    showFlightToy?: boolean;
}

const defaultBootLines = [
    'NEURO-OS v9.0.1 BOOT SEQUENCE INITIATED...',
    'RAM: 1024 PB [OK]',
    'MOUNTING VIRTUAL DRIVE... [OK]',
    'BYPASSING FIREWALL... [OK]',
    'ESTABLISHING SECURE CONNECTION...',
    'DECRYPTING CASE FILES...',
    'AWAITING NEURAL LINK RESPONSE...'
];

export const RetroBootScreen: React.FC<RetroBootScreenProps> = ({
    onComplete,
    bootLines = defaultBootLines,
    panelTitle = 'SYSTEM BOOT',
    panelStage = 'Preparing session context...',
    panelStatus = 'working',
    panelAttempt,
    panelMaxAttempts,
    panelError,
    onRetry,
    onCancel,
    showFlightToy = false
}) => {
    const [lines, setLines] = useState<string[]>([]);
    const [isDone, setIsDone] = useState(false);
    const [dots, setDots] = useState('');
    const notifiedRef = useRef(false);

    useEffect(() => {
        setLines([]);
        setIsDone(false);
        setDots('');
        notifiedRef.current = false;

        let currentLine = 0;
        const lineTimer = window.setInterval(() => {
            if (currentLine < bootLines.length) {
                setLines(prev => [...prev, bootLines[currentLine]]);
                currentLine += 1;
                return;
            }
            setIsDone(true);
            window.clearInterval(lineTimer);
        }, 320);

        return () => window.clearInterval(lineTimer);
    }, [bootLines]);

    useEffect(() => {
        if (!isDone || panelStatus === 'error') return;

        const dotTimer = window.setInterval(() => {
            setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
        }, 260);

        const completeTimer = window.setTimeout(() => {
            if (!notifiedRef.current) {
                notifiedRef.current = true;
                onComplete?.();
            }
        }, 1400);

        return () => {
            window.clearInterval(dotTimer);
            window.clearTimeout(completeTimer);
        };
    }, [isDone, onComplete, panelStatus]);

    return (
        <div className="boot-screen" aria-label="boot-sequence">
            <div className="scanline" />
            <div className={`boot-content${showFlightToy ? ' has-flight-toy' : ''}`}>
                <div className={`boot-line-cluster${showFlightToy ? ' with-flight-toy' : ''}`}>
                    {lines.map((line, i) => (
                        <div key={`${line}-${i}`} className="boot-line">{line}</div>
                    ))}
                    <div className="boot-status-block">
                        <div className="boot-line">{`TASK // ${panelTitle}`}</div>
                        <div className="boot-line">{`STATUS // ${panelStatus === 'error' ? 'HALTED' : 'ACTIVE'}`}</div>
                        <div className="boot-line">{`STAGE // ${panelStage}`}</div>
                        {typeof panelAttempt === 'number' && typeof panelMaxAttempts === 'number' && (
                            <div className="boot-line">{`ATTEMPT // ${panelAttempt}/${panelMaxAttempts}`}</div>
                        )}
                        {panelError && (
                            <div className="boot-line boot-line-error">{`FAILURE // ${panelError}`}</div>
                        )}
                    </div>
                    {isDone && (
                        <div className="boot-line">
                            {panelStatus === 'error' ? 'SESSION HALTED' : `LOADING${dots}`}
                        </div>
                    )}
                    {panelStatus === 'error' && (onRetry || onCancel) && (
                        <div className="boot-actions">
                            {onRetry && (
                                <button type="button" className="boot-action-btn" onClick={onRetry}>
                                    RETRY GENERATION
                                </button>
                            )}
                            {onCancel && (
                                <button type="button" className="boot-action-btn secondary" onClick={onCancel}>
                                    CANCEL SESSION
                                </button>
                            )}
                        </div>
                    )}
                    <div className="boot-cursor" />
                </div>
                {showFlightToy && (
                    <BootFlightToy enabled={showFlightToy} />
                )}
            </div>
        </div>
    );
};
