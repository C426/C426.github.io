import React, { useRef, useState, useLayoutEffect } from 'react';
import { TooltipState } from '../types';

interface TooltipProps {
    tooltip: TooltipState;
}

export const Tooltip: React.FC<TooltipProps> = ({ tooltip }) => {
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [style, setStyle] = useState({ left: 0, top: 0, opacity: 0 });

    useLayoutEffect(() => {
        if (!tooltip.visible || !tooltipRef.current) {
            if (style.opacity !== 0) {
                setStyle(prev => ({ ...prev, opacity: 0 }));
            }
            return;
        }

        const rect = tooltipRef.current.getBoundingClientRect();
        const margin = 20;
        
        let left = tooltip.x + margin;
        let top = tooltip.y + margin;

        // Check right boundary
        if (left + rect.width > window.innerWidth - margin) {
            left = tooltip.x - rect.width - margin;
        }
        
        // Check left boundary
        if (left < margin) {
            left = margin;
        }

        // Check bottom boundary
        if (top + rect.height > window.innerHeight - margin) {
            top = tooltip.y - rect.height - margin;
        }
        
        // Check top boundary
        if (top < margin) {
            top = margin;
        }

        setStyle({ left, top, opacity: 1 });
    }, [tooltip]);

    if (!tooltip.visible) return null;

    return (
        <div 
            ref={tooltipRef}
            className={`evidence-tooltip ${tooltip.isLogicBreak ? 'logic-break' : ''}`}
            style={{ 
                display: 'block', 
                left: style.left, 
                top: style.top,
                opacity: style.opacity,
                visibility: style.opacity === 0 ? 'hidden' : 'visible'
            }}
            dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
    );
};
