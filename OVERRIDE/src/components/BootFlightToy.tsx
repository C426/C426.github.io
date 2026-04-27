import React, { useEffect, useMemo, useRef, useState } from 'react';

type ControlMode = 'auto' | 'manual';

interface PipeState {
    x: number;
    gapY: number;
    scored: boolean;
}

interface BootFlightToyProps {
    enabled?: boolean;
    stageLabel?: string;
}

const CANVAS_WIDTH = 360;
const CANVAS_HEIGHT = 220;
const PIPE_WIDTH = 30;
const PIPE_GAP = 112;
const PIPE_SPEED = 1.85;
const PIPE_INTERVAL = 118;
const GRAVITY = 0.22;
const JUMP_VELOCITY = -4.2;
const MANUAL_TIMEOUT_MS = 5000;
const AUTO_JUMP_COOLDOWN_MS = 230;

export const BootFlightToy: React.FC<BootFlightToyProps> = ({
    enabled = true,
    stageLabel = 'SIGNAL FLIGHT'
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [score, setScore] = useState(0);
    const [controlMode, setControlMode] = useState<ControlMode>('auto');

    const scoreRef = useRef(0);
    const controlModeRef = useRef<ControlMode>('auto');
    const lastManualInputRef = useRef(0);
    const lastAutoJumpAtRef = useRef(0);
    const manualJumpRequestedRef = useRef(false);

    const stageText = useMemo(
        () => (stageLabel?.trim() ? stageLabel.trim().toUpperCase() : 'SIGNAL FLIGHT'),
        [stageLabel]
    );

    const requestManualControl = () => {
        controlModeRef.current = 'manual';
        setControlMode('manual');
        lastManualInputRef.current = performance.now();
        manualJumpRequestedRef.current = true;
    };

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        let animationId = 0;
        let frame = 0;

        const bird = {
            x: 84,
            y: CANVAS_HEIGHT * 0.5,
            size: 12,
            velocity: 0
        };

        let pipes: PipeState[] = [];

        const resetRun = () => {
            controlModeRef.current = 'auto';
            setControlMode('auto');
            bird.y = CANVAS_HEIGHT * 0.5;
            bird.velocity = 0;
            pipes = [];
            frame = 0;
            scoreRef.current = 0;
            setScore(0);
            manualJumpRequestedRef.current = false;
        };

        const jump = (manual = false) => {
            bird.velocity = JUMP_VELOCITY;
            if (manual) {
                controlModeRef.current = 'manual';
                setControlMode('manual');
                lastManualInputRef.current = performance.now();
            } else {
                lastAutoJumpAtRef.current = performance.now();
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code !== 'Space') return;
            event.preventDefault();
            requestManualControl();
        };

        const handleMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest('button, [role="button"], a, input, select, textarea, label')) {
                return;
            }
            requestManualControl();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousedown', handleMouseDown);

        const updateControlMode = (now: number) => {
            if (controlModeRef.current === 'manual' && now - lastManualInputRef.current > MANUAL_TIMEOUT_MS) {
                controlModeRef.current = 'auto';
                setControlMode('auto');
            }
        };

        const updateAutoPilot = (now: number) => {
            if (controlModeRef.current !== 'auto') return;

            const nextPipe = pipes.find(pipe => pipe.x + PIPE_WIDTH >= bird.x - 8);
            const fallbackY = CANVAS_HEIGHT * 0.5;
            const targetY = nextPipe ? nextPipe.gapY : fallbackY;
            const pipeDistance = nextPipe ? nextPipe.x - bird.x : CANVAS_WIDTH;
            const lowerThreshold = targetY + 16;
            const dangerThreshold = targetY + 6;
            const nearGroundThreshold = CANVAS_HEIGHT - 20;
            const urgentThreshold = pipeDistance < 64 && bird.y > targetY + 2;
            const risingTooSlow = bird.velocity > 1.8;

            if (now - lastAutoJumpAtRef.current < AUTO_JUMP_COOLDOWN_MS) {
                return;
            }

            if (
                bird.y > lowerThreshold ||
                bird.y > nearGroundThreshold ||
                (bird.y > dangerThreshold && risingTooSlow) ||
                urgentThreshold
            ) {
                jump(false);
            }
        };

        const drawGrid = () => {
            ctx.strokeStyle = 'rgba(117, 140, 52, 0.18)';
            ctx.lineWidth = 1;
            for (let x = 0; x <= CANVAS_WIDTH; x += 30) {
                ctx.beginPath();
                ctx.moveTo(x + 0.5, 0);
                ctx.lineTo(x + 0.5, CANVAS_HEIGHT);
                ctx.stroke();
            }
            for (let y = 0; y <= CANVAS_HEIGHT; y += 30) {
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(CANVAS_WIDTH, y + 0.5);
                ctx.stroke();
            }
        };

        const drawHud = () => {
            ctx.strokeStyle = 'rgba(212, 255, 39, 0.38)';
            ctx.lineWidth = 1;
            ctx.strokeRect(0.5, 0.5, CANVAS_WIDTH - 1, CANVAS_HEIGHT - 1);

            ctx.fillStyle = '#d4ff27';
            ctx.font = '700 10px FusionPixel, monospace';
            ctx.fillText(stageText, 12, 18);

            ctx.fillStyle = controlModeRef.current === 'auto' ? '#d4ff27' : '#f5c94d';
            ctx.fillText(controlModeRef.current === 'auto' ? 'AUTO PILOT' : 'MANUAL LINK', 12, 34);

            ctx.fillStyle = 'rgba(237, 244, 200, 0.92)';
            ctx.textAlign = 'right';
            ctx.fillText(`SYNC // ${scoreRef.current}`, CANVAS_WIDTH - 12, 18);
            ctx.textAlign = 'left';
        };

          const drawBird = () => {
              ctx.save();
              ctx.translate(bird.x, bird.y);
              ctx.rotate(Math.min(Math.PI / 7, Math.max(-Math.PI / 7, bird.velocity * 0.08)));

              ctx.strokeStyle = '#d4ff27';
              ctx.lineWidth = 3;
              ctx.strokeRect(-bird.size / 2, -bird.size / 2, bird.size, bird.size);

              ctx.restore();
          };

        const drawPipes = () => {
            pipes.forEach(pipe => {
                const topHeight = pipe.gapY - PIPE_GAP / 2;
                const bottomY = pipe.gapY + PIPE_GAP / 2;

                ctx.fillStyle = 'rgba(7, 17, 27, 0.88)';
                ctx.strokeStyle = 'rgba(212, 255, 39, 0.72)';
                ctx.lineWidth = 1.5;

                ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topHeight);
                ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_HEIGHT - bottomY);
                ctx.strokeRect(pipe.x + 0.5, 0.5, PIPE_WIDTH - 1, Math.max(0, topHeight - 1));
                ctx.strokeRect(pipe.x + 0.5, bottomY + 0.5, PIPE_WIDTH - 1, Math.max(0, CANVAS_HEIGHT - bottomY - 1));

                ctx.strokeStyle = 'rgba(113, 162, 207, 0.28)';
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(pipe.x, pipe.gapY);
                ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.gapY);
                ctx.stroke();
                ctx.setLineDash([]);
            });
        };

        const draw = () => {
            ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = 'rgba(3, 7, 12, 0.84)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            drawGrid();
            drawPipes();
            drawBird();
            drawHud();
        };

        const update = (now: number) => {
            updateControlMode(now);
            if (manualJumpRequestedRef.current) {
                manualJumpRequestedRef.current = false;
                jump(true);
            }
            updateAutoPilot(now);

            bird.velocity += GRAVITY;
            bird.y += bird.velocity;

            if (bird.y - bird.size / 2 < 0) {
                bird.y = bird.size / 2;
                bird.velocity = Math.max(0, bird.velocity);
            }

            if (frame % PIPE_INTERVAL === 0) {
                const gapY = Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 54) + PIPE_GAP / 2 + 24;
                pipes.push({
                    x: CANVAS_WIDTH + 8,
                    gapY,
                    scored: false
                });
            }

            pipes = pipes.filter(pipe => pipe.x + PIPE_WIDTH > -10);
            pipes.forEach(pipe => {
                pipe.x -= PIPE_SPEED;
                if (!pipe.scored && pipe.x + PIPE_WIDTH < bird.x) {
                    pipe.scored = true;
                    scoreRef.current += 1;
                    setScore(scoreRef.current);
                }
            });

            const collided =
                bird.y + bird.size / 2 >= CANVAS_HEIGHT ||
                pipes.some(pipe => {
                    const topHeight = pipe.gapY - PIPE_GAP / 2;
                    const bottomY = pipe.gapY + PIPE_GAP / 2;
                    const overlapsX = bird.x + bird.size / 2 > pipe.x && bird.x - bird.size / 2 < pipe.x + PIPE_WIDTH;
                    const overlapsY = bird.y - bird.size / 2 < topHeight || bird.y + bird.size / 2 > bottomY;
                    return overlapsX && overlapsY;
                });

            if (collided) {
                resetRun();
            }

            frame += 1;
        };

        const loop = (now: number) => {
            update(now);
            draw();
            animationId = window.requestAnimationFrame(loop);
        };

        resetRun();
        draw();
        animationId = window.requestAnimationFrame(loop);

        return () => {
            window.cancelAnimationFrame(animationId);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, [enabled, stageText]);

    return (
        <div className="boot-flight-shell">
            <div className="boot-flight-frame">
                <div className="boot-flight-heading">
                    <span>BOOT TOY</span>
                    <strong>{stageText}</strong>
                </div>
                <div className="boot-flight-meta">
                    <span>{controlMode === 'auto' ? 'AUTO PILOT ENGAGED' : 'MANUAL LINK ACTIVE'}</span>
                    <span>{`SYNC // ${score}`}</span>
                </div>
                <canvas
                    ref={canvasRef}
                    className="boot-flight-canvas"
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                />
                <div className="boot-flight-hint">
                    <span>SPACE / LEFT CLICK TO TAKE OVER</span>
                    <span>NO INPUT FOR 5S // AUTO PILOT RESUMES</span>
                </div>
            </div>
        </div>
    );
};
