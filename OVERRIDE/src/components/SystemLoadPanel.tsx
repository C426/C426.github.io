import React from 'react';

export interface SystemLoadRow {
    label: string;
    value: string;
}

interface SystemLoadPanelProps {
    title: string;
    stage: string;
    status: 'working' | 'error';
    rows: SystemLoadRow[];
    attempt?: number;
    maxAttempts?: number;
    error?: string | null;
    onRetry?: () => void;
    onCancel?: () => void;
    compact?: boolean;
    variant?: 'panel' | 'hud';
}

export const SystemLoadPanel: React.FC<SystemLoadPanelProps> = ({
    title,
    stage,
    status,
    rows,
    attempt,
    maxAttempts,
    error,
    onRetry,
    onCancel,
    compact = false,
    variant = 'panel'
}) => (
    <div className={`system-load-panel ${compact ? 'compact' : ''} ${variant} ${status}`}>
        <div className="system-load-header">
            <span>{title}</span>
            <span>{status === 'working' ? 'ACTIVE' : 'HALTED'}</span>
        </div>
        <div className="system-load-stage">{stage}</div>
        {typeof attempt === 'number' && typeof maxAttempts === 'number' && (
            <div className="system-load-attempt">{`ATTEMPT // ${attempt}/${maxAttempts}`}</div>
        )}
        <div className="system-load-grid">
            {rows.map(row => (
                <div key={`${row.label}-${row.value}`} className="system-load-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                </div>
            ))}
        </div>
        {error && <div className="system-load-error">{error}</div>}
        {status === 'error' && (onRetry || onCancel) && (
            <div className="system-load-actions">
                {onRetry && (
                    <button type="button" className="system-load-btn primary" onClick={onRetry}>
                        RETRY GENERATION
                    </button>
                )}
                {onCancel && (
                    <button type="button" className="system-load-btn" onClick={onCancel}>
                        CANCEL SESSION
                    </button>
                )}
            </div>
        )}
    </div>
);
