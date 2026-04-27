import React, { useEffect, useMemo, useRef, useState } from 'react';

interface SystemStreamBackdropProps {
    columns?: number;
    className?: string;
}

const STREAM_LINE_COUNT = 320;

const streamTemplates = [
    'BOOT TRACE :: COURT NODE',
    'MEMORY MAP :: SEGMENT A0',
    'NETWORK LINK :: R-14',
    'SYNC LOGIC CORE :: LIVE',
    'WATCHDOG TIMER :: ACTIVE',
    'INPUT MATRIX :: ONLINE',
    'CACHE CLEANUP :: COMPLETE',
    'THREAD STACK :: INIT',
    'VECTOR STREAM :: CH-03',
    'EVIDENCE BUFFER :: READY',
    'JUDGEMENT ENGINE :: ARMED',
    'TRACE ROUTE :: PASS',
    'DIAGNOSTIC FRAME :: READY',
    'SIGNAL CHECKSUM :: VALID',
    'SECURITY POLICY :: L-2',
    'IO MONITOR :: ACTIVE',
    'SYNC CHANNEL :: OPEN'
];

const toHex = (value: number, length = 4) => {
    const unsigned = value >>> 0;
    return unsigned.toString(16).toUpperCase().padStart(length, '0').slice(-length);
};

const buildStreamLine = (seq: number): string => {
    const template = streamTemplates[seq % streamTemplates.length];
    const slot = (seq % 97).toString().padStart(2, '0');
    const load = ((seq * 37) % 100).toString().padStart(2, '0');
    const crc = toHex(seq * 2654435761, 4);
    return `${template} :: SLOT-${slot} :: CRC-${crc} :: LOAD-${load}%`;
};

const createInitialLines = () => {
    return Array.from({ length: STREAM_LINE_COUNT }, (_, idx) => buildStreamLine(idx));
};

export const SystemStreamBackdrop: React.FC<SystemStreamBackdropProps> = ({ columns = 4, className }) => {
    const [streamLines, setStreamLines] = useState<string[]>(() => createInitialLines());
    const sequenceRef = useRef(STREAM_LINE_COUNT);

    useEffect(() => {
        const timer = window.setInterval(() => {
            const nextLine = buildStreamLine(sequenceRef.current);
            sequenceRef.current += 1;
            setStreamLines(prev => {
                const trimmed = prev.length >= STREAM_LINE_COUNT ? prev.slice(1) : prev;
                return [...trimmed, nextLine];
            });
        }, 120);

        return () => window.clearInterval(timer);
    }, []);

    const columnLines = useMemo(() => {
        const cols: string[][] = Array.from({ length: Math.max(1, columns) }, () => []);
        streamLines.forEach((line, idx) => {
            cols[idx % cols.length].push(line);
        });
        return cols;
    }, [streamLines, columns]);

    return (
        <div
            className={`system-stream ${className || ''}`.trim()}
            style={{ ['--stream-cols' as string]: String(Math.max(1, columns)) }}
            aria-hidden="true"
        >
            {columnLines.map((lines, colIdx) => (
                <div className="system-stream-col" key={`col-${colIdx}`}>
                    {lines.map((line, lineIdx) => (
                        <div className="system-stream-line" key={`${colIdx}-${lineIdx}-${line}`}>
                            {line}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

