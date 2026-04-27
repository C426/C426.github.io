import React, { useEffect, useRef } from 'react';
import { LogEntry, ResolvedStatement } from '../types';
import { normalizeText } from '../utils';
import { TypingBlock, Token, parseTokens } from './TypingBlock';

interface ChatLogProps {
    logs: LogEntry[];
    evidenceMap: Map<string, string>;
    usedEvidenceSet: Set<string>;
    resolvedStatementsMap: Map<string, ResolvedStatement>;
    onCollectEvidence: (name: string, detail: string) => void;
    onTypingComplete: (id: string) => void;
    showTooltip: (e: React.MouseEvent, content: string, isLogicBreak?: boolean) => void;
    hideTooltip: () => void;
}

export const ChatLog: React.FC<ChatLogProps> = ({ 
    logs, 
    evidenceMap, 
    usedEvidenceSet, 
    resolvedStatementsMap, 
    onCollectEvidence, 
    onTypingComplete,
    showTooltip, 
    hideTooltip 
}) => {
    const logRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = logRef.current;
        if (!el) return;

        const observer = new MutationObserver(() => {
            el.scrollTop = el.scrollHeight;
        });

        observer.observe(el, { childList: true, subtree: true, characterData: true });

        return () => observer.disconnect();
    }, []);

    const renderToken = (token: Token, visibleContent: string) => {
        if (token.type === 'text') {
            return <span>{visibleContent}</span>;
        }
        
        if (token.type === 'evidence') {
            let statusClass = '';
            let onClick = undefined;
            
            if (usedEvidenceSet.has(token.name)) {
                statusClass = 'used';
            } else if (evidenceMap.has(token.name)) {
                statusClass = 'collected';
            } else {
                onClick = () => onCollectEvidence(token.name, token.detail);
            }

            return (
                <span 
                    className={`highlight-evidence ${statusClass}`}
                    onClick={onClick}
                    onMouseMove={(e) => showTooltip(e, `<strong>${token.name}</strong><br>${token.detail}`)}
                    onMouseLeave={hideTooltip}
                >
                    {visibleContent}
                </span>
            );
        }

        if (token.type === 'statement') {
            const contentClean = normalizeText(token.content);
            let historyData: ResolvedStatement | null = null;
            
            for (let [resolvedText, data] of resolvedStatementsMap.entries()) {
                if (contentClean.includes(resolvedText) || resolvedText.includes(contentClean)) {
                    historyData = data;
                    break;
                }
            }
            
            const isResolved = !!historyData;
            
            const handleMouseMove = (e: React.MouseEvent) => {
                if (isResolved && historyData) {
                    const tooltipContent = `
<strong style="color:var(--neon-yellow)">LOGIC BREAK</strong>
${historyData.logic}
<hr style="border-color:#333; margin:8px 0;">
<strong style="color:var(--neon-blue)">USED EVIDENCE</strong>
[${historyData.evName}]
<span style="color:#aaa; font-size:0.9em">${historyData.evDetail}</span>
`;
                    showTooltip(e, tooltipContent, true);
                }
            };

            return (
                <span 
                    className={`highlight-statement ${isResolved ? 'resolved' : ''}`}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={hideTooltip}
                >
                    {visibleContent}
                </span>
            );
        }
        return null;
    };

    const renderEvidencePrompt = (evidences: Token[]) => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {evidences.map((ev, i) => {
                    if (ev.type !== 'evidence') return null;
                    
                    let statusClass = '';
                    let onClick = undefined;
                    
                    if (usedEvidenceSet.has(ev.name)) {
                        statusClass = 'used';
                    } else if (evidenceMap.has(ev.name)) {
                        statusClass = 'collected';
                    } else {
                        onClick = () => onCollectEvidence(ev.name, ev.detail);
                    }

                    return (
                        <div 
                            key={i} 
                            className={`evidence-prompt-item ${statusClass}`}
                            onClick={onClick}
                            style={{ 
                                padding: '8px', 
                                border: '1px solid var(--neon-cyan)', 
                                cursor: onClick ? 'pointer' : 'default',
                                opacity: onClick ? 1 : 0.5,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px'
                            }}
                        >
                            <div style={{ fontWeight: 'bold', color: 'var(--neon-yellow)' }}>
                                {ev.name} {onClick ? '⬇️ (Click to Collect)' : '✔️ (Collected)'}
                            </div>
                            <div style={{ fontSize: '0.9em', color: '#ccc' }}>
                                {ev.detail}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderNarrative = (entry: LogEntry) => {
        const tokens = parseTokens(entry.text || '');
        const evidences = tokens.filter(t => t.type === 'evidence');

        return (
            <div key={entry.id} className={`narrative-box ${entry.isFinal ? 'final' : ''}`}>
                <span className="narrative-label">{entry.isFinal ? "CASE VERDICT / 结案报告" : "COURT RECORD"}</span>
                {entry.isTyping ? (
                    <TypingBlock 
                        text={entry.text || ''} 
                        onComplete={() => onTypingComplete(entry.id)}
                        renderToken={renderToken}
                        renderEvidencePrompt={renderEvidencePrompt}
                    />
                ) : (
                    <div>
                        {tokens.map((token, i) => (
                            <React.Fragment key={i}>
                                {renderToken(token, token.type === 'evidence' ? token.name : token.content)}
                            </React.Fragment>
                        ))}
                        {evidences.length > 0 && (
                            <div className="evidence-prompt-block" style={{ marginTop: '10px', padding: '10px', border: '1px dashed var(--neon-cyan)', backgroundColor: 'rgba(0, 255, 255, 0.05)' }}>
                                <div style={{ color: 'var(--neon-cyan)', marginBottom: '5px', fontSize: '0.9em' }}>[EVIDENCE LOG]</div>
                                {renderEvidencePrompt(evidences)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    const renderChat = (entry: LogEntry) => {
        const speakerName = entry.role === 'enemy' ? 'Suspect' : 'Detective';
        const nameColor = entry.role === 'enemy' ? 'var(--neon-pink)' : 'var(--neon-cyan)';

        return (
            <div key={entry.id} className={`bubble-row ${entry.role}`}>
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <div style={{ color: nameColor, fontWeight: 'bold', fontSize: '0.9em', marginBottom: '4px', textTransform: 'uppercase' }}>
                        {speakerName}
                    </div>
                    <div className="chat-bubble">
                        {entry.role === 'enemy' ? (
                            entry.isTyping ? (
                                <TypingBlock 
                                    text={entry.text || ''} 
                                    onComplete={() => onTypingComplete(entry.id)}
                                    renderToken={renderToken}
                                />
                            ) : (
                                parseTokens(entry.text || '').map((token, i) => (
                                    <React.Fragment key={i}>
                                        {renderToken(token, token.type === 'evidence' ? token.name : token.content)}
                                    </React.Fragment>
                                ))
                            )
                        ) : entry.text}
                    </div>
                </div>
            </div>
        );
    };

    const renderSystem = (entry: LogEntry) => {
        return (
            <div key={entry.id} className="system-msg">
                {entry.text}
            </div>
        );
    };

    return (
        <div id="chat-log" ref={logRef}>
            {logs.map(entry => {
                if (entry.type === 'narrative') return renderNarrative(entry);
                if (entry.type === 'chat') return renderChat(entry);
                if (entry.type === 'system') return renderSystem(entry);
                return null;
            })}
        </div>
    );
};
