import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';

interface LogViewerProps {
    logs: LogEntry[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
    const [windowState, setWindowState] = useState<'default' | 'minimized' | 'maximized'>('default');
    const contentRef = useRef<HTMLDivElement>(null);
    const visibleLogs = logs.filter(log => !log.hiddenInCaseLog);

    useEffect(() => {
        if (contentRef.current && windowState !== 'minimized') {
            contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
    }, [visibleLogs, windowState]);

    const handleMinimize = (e: React.MouseEvent) => {
        e.stopPropagation();
        setWindowState('minimized');
    };

    const handleMaximize = (e: React.MouseEvent) => {
        e.stopPropagation();
        setWindowState('maximized');
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setWindowState('default');
    };

    const handleBarClick = () => {
        if (windowState === 'minimized') {
            setWindowState('default');
        }
    };

    return (
        <div className={`log-viewer-window ${windowState}`}>
            <div className="log-title-bar" onClick={handleBarClick}>
                <div className="log-title">
                    <span className="win-icon">[LOG]</span> CASE_LOG.EXE
                </div>
                <div className="log-controls">
                    {windowState !== 'minimized' && (
                        <button className="win-btn" onClick={handleMinimize}>_</button>
                    )}
                    {windowState === 'default' && (
                        <button className="win-btn" onClick={handleMaximize}>[]</button>
                    )}
                    {windowState === 'maximized' && (
                        <button className="win-btn" onClick={handleClose}>X</button>
                    )}
                </div>
            </div>
            {windowState !== 'minimized' && (
                <div className="log-content" ref={contentRef}>
                    {visibleLogs.map(log => (
                        <div key={log.id} className={`log-entry-item ${log.type}`}>
                            {log.type === 'chat' && log.role === 'hero' && <span className="log-hero">[HERO] </span>}
                            {log.type === 'chat' && log.role === 'enemy' && <span className="log-enemy">[ENEMY] </span>}
                            {log.type === 'system' && <span className="log-system">[SYSTEM] </span>}
                            {log.type === 'narrative' && <span className="log-narrative">[NARRATIVE] </span>}
                            <span className="log-text">{log.text}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
