let audioCtx: AudioContext | null = null;

const ensureAudioContext = (): AudioContext | null => {
    if (audioCtx) return audioCtx;
    try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        return audioCtx;
    } catch {
        return null;
    }
};

const resumeIfNeeded = (ctx: AudioContext) => {
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
    }
};

const playTypewriterClick = (volume = 0.05, duration = 0.015) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    resumeIfNeeded(ctx);

    const bufferSize = Math.max(32, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000 + Math.random() * 500;
    filter.Q.value = 1.0;

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + duration + 0.005);
};

export const primeSfxAudio = () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    resumeIfNeeded(ctx);
};

export const playTypingSfx = () => {
    playTypewriterClick(0.05, 0.015);
};

export const playEvidenceHoverSfx = () => {
    playTypewriterClick(0.044, 0.014);
};

export const playEvidenceSelectSfx = () => {
    playTypewriterClick(0.052, 0.016);
};
