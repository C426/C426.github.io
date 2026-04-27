import React, { useState, useEffect, useMemo } from 'react';
import { playTypingSfx } from '../utils/sfx';

export type Token = 
    | { type: 'text', content: string }
    | { type: 'evidence', name: string, detail: string, raw: string }
    | { type: 'statement', content: string, raw: string };

export const parseTokens = (text: string): Token[] => {
    const tokens: Token[] = [];
    // Match {{Evidence|Detail}} or [[Statement]]
    const regex = /(\{\{.*?\}\}|\[\[.*?\]\])/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        const raw = match[0];
        if (raw.startsWith('{{')) {
            const inner = raw.slice(2, -2);
            const splitIdx = inner.indexOf('|');
            if (splitIdx > -1) {
                tokens.push({ type: 'evidence', name: inner.substring(0, splitIdx), detail: inner.substring(splitIdx + 1), raw });
            } else {
                tokens.push({ type: 'evidence', name: inner, detail: 'No details available.', raw });
            }
        } else if (raw.startsWith('[[')) {
            tokens.push({ type: 'statement', content: raw.slice(2, -2), raw });
        }
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) {
        tokens.push({ type: 'text', content: text.substring(lastIndex) });
    }
    return tokens;
};

interface TypingBlockProps {
    text: string;
    speed?: number;
    onComplete?: () => void;
    renderToken: (token: Token, visibleContent: string) => React.ReactNode;
    renderEvidencePrompt?: (evidences: Token[]) => React.ReactNode;
    showTypingCursor?: boolean;
    typingCursorChar?: string;
    typingCursorClassName?: string;
}

export const TypingBlock: React.FC<TypingBlockProps> = ({
    text,
    speed = 20,
    onComplete,
    renderToken,
    renderEvidencePrompt,
    showTypingCursor = false,
    typingCursorChar = '_',
    typingCursorClassName = 'typing-cursor-inline'
}) => {
    const [visibleChars, setVisibleChars] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    
    const tokens = useMemo(() => parseTokens(text), [text]);
    
    const totalChars = tokens.reduce((sum, token) => {
        if (token.type === 'text') return sum + Array.from(token.content).length;
        if (token.type === 'evidence') return sum + Array.from(token.name).length;
        if (token.type === 'statement') return sum + Array.from(token.content).length;
        return sum;
    }, 0);

    useEffect(() => {
        setVisibleChars(0);
        setIsComplete(false);
    }, [text]);

    useEffect(() => {
        if (visibleChars >= totalChars) {
            if (!isComplete) {
                setIsComplete(true);
                if (onComplete) onComplete();
            }
            return;
        }

        const timer = setTimeout(() => {
            setVisibleChars(prev => prev + 1);
            if (visibleChars % 2 === 0) {
                playTypingSfx();
            }
        }, speed);

        return () => clearTimeout(timer);
    }, [visibleChars, totalChars, isComplete, onComplete, speed]);

    const handleSkip = () => {
        if (!isComplete) {
            setVisibleChars(totalChars);
        }
    };

    let remainingChars = visibleChars;
    const renderedTokens = [];
    const collectedEvidences: Token[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        let tokenLength = 0;
        let visibleContent = '';

        if (token.type === 'text') {
            const chars = Array.from(token.content);
            tokenLength = chars.length;
            visibleContent = chars.slice(0, remainingChars).join('');
        } else if (token.type === 'evidence') {
            const chars = Array.from(token.name);
            tokenLength = chars.length;
            visibleContent = chars.slice(0, remainingChars).join('');
            collectedEvidences.push(token);
        } else if (token.type === 'statement') {
            const chars = Array.from(token.content);
            tokenLength = chars.length;
            visibleContent = chars.slice(0, remainingChars).join('');
        }

        if (remainingChars > 0) {
            renderedTokens.push(<React.Fragment key={i}>{renderToken(token, visibleContent)}</React.Fragment>);
        }
        
        remainingChars -= tokenLength;
        if (remainingChars <= 0) break;
    }

    return (
        <div onClick={handleSkip} style={{ cursor: isComplete ? 'default' : 'pointer' }}>
            {renderedTokens}
            {showTypingCursor && !isComplete && (
                <span className={typingCursorClassName}>{typingCursorChar}</span>
            )}
            {isComplete && renderEvidencePrompt && collectedEvidences.length > 0 && (
                <div className="evidence-prompt-block" style={{ marginTop: '10px', padding: '10px', border: '1px dashed var(--neon-cyan)', backgroundColor: 'rgba(0, 255, 255, 0.05)' }}>
                    <div style={{ color: 'var(--neon-cyan)', marginBottom: '5px', fontSize: '0.9em' }}>[NEW EVIDENCE DISCOVERED]</div>
                    {renderEvidencePrompt(collectedEvidences)}
                </div>
            )}
        </div>
    );
};
