import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'F:/Codex/ronpa/src/game-content';
const templatesRoot = path.join(root, 'builtin', 'templates');
const builtinPortraitRoot = path.join(root, 'builtin', 'portrait-packs');
const builtinBackgroundRoot = path.join(root, 'builtin', 'background-packs');

const portraitStates = [
    'neutral_idle',
    'polite_smile',
    'smug_tilt',
    'innocent_hand',
    'serious_focus',
    'thinking_hand_to_chin',
    'surprise_small',
    'shock_big',
    'defensive_frown',
    'angry_attack',
    'breakdown_unstable',
    'sad_confession'
];

const backgroundSlots = [
    'boot',
    'briefing',
    'hearing',
    'cross_exam',
    'analysis',
    'reveal',
    'confession',
    'ending'
];

const stateLabels = {
    neutral_idle: { zh: '平静待机', ja: '平常待機', en: 'NEUTRAL IDLE' },
    polite_smile: { zh: '礼貌微笑', ja: '穏やかな微笑み', en: 'POLITE SMILE' },
    smug_tilt: { zh: '得意挑衅', ja: '挑発的な笑み', en: 'SMUG TILT' },
    innocent_hand: { zh: '装作无辜', ja: '無実のふり', en: 'INNOCENT HAND' },
    serious_focus: { zh: '认真凝视', ja: '真剣な集中', en: 'SERIOUS FOCUS' },
    thinking_hand_to_chin: { zh: '托腮思考', ja: '思案ポーズ', en: 'THINKING HAND TO CHIN' },
    surprise_small: { zh: '轻微惊讶', ja: '小さな驚き', en: 'SMALL SURPRISE' },
    shock_big: { zh: '强烈震惊', ja: '大きな衝撃', en: 'BIG SHOCK' },
    defensive_frown: { zh: '防御皱眉', ja: '防御的なしかめ面', en: 'DEFENSIVE FROWN' },
    angry_attack: { zh: '愤怒反击', ja: '怒りの反撃', en: 'ANGRY ATTACK' },
    breakdown_unstable: { zh: '崩坏失控', ja: '崩壊寸前', en: 'BREAKDOWN UNSTABLE' },
    sad_confession: { zh: '低落自白', ja: '沈んだ告白', en: 'SAD CONFESSION' }
};

const slotLabels = {
    boot: { zh: '启动画面', ja: '起動画面', en: 'BOOT' },
    briefing: { zh: '案件导入', ja: '事件ブリーフィング', en: 'BRIEFING' },
    hearing: { zh: '听证阶段', ja: '審理段階', en: 'HEARING' },
    cross_exam: { zh: '交叉询问', ja: '反対尋問', en: 'CROSS EXAM' },
    analysis: { zh: '分析阶段', ja: '分析段階', en: 'ANALYSIS' },
    reveal: { zh: '真相揭示', ja: '真相開示', en: 'REVEAL' },
    confession: { zh: '自白阶段', ja: '自白段階', en: 'CONFESSION' },
    ending: { zh: '结束画面', ja: 'エンディング', en: 'ENDING' }
};

const portraitWidth = 1400;
const portraitHeight = 1800;
const backgroundWidth = 1920;
const backgroundHeight = 1080;
const thumbWidth = 640;
const thumbHeight = 360;
const referenceWidth = 1600;
const referenceHeight = 1100;

const ensureDir = async (dir) => {
    await mkdir(dir, { recursive: true });
};

const writeText = async (filePath, content) => {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, content, 'utf8');
};

const writeJson = async (filePath, value) => {
    await writeText(filePath, `${JSON.stringify(value, null, 2)}\n`);
};

const esc = (value) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

const portraitPlaceholderSvg = ({ roleLabel, roleName, packId, state, speaking, accent, bg, fileName }) => {
    const stateLabel = stateLabels[state];
    const mouthLabel = speaking
        ? { zh: '张嘴说话', ja: '口開き', en: 'OPEN' }
        : { zh: '闭嘴待机', ja: '口閉じ', en: 'CLOSED' };

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${portraitWidth}" height="${portraitHeight}" viewBox="0 0 ${portraitWidth} ${portraitHeight}">
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="2" y="2" width="${portraitWidth - 4}" height="${portraitHeight - 4}" fill="none" stroke="${accent}" stroke-width="4"/>
  <rect x="84" y="96" width="1232" height="1608" rx="28" fill="${bg}" stroke="${accent}" stroke-width="8"/>
  <rect x="124" y="136" width="1152" height="208" fill="none" stroke="${accent}" stroke-width="4"/>
  <rect x="124" y="392" width="1152" height="944" fill="none" stroke="${accent}" stroke-width="4"/>
  <rect x="124" y="1384" width="1152" height="280" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="152" y="172" font-family="monospace" font-size="28" fill="${accent}" opacity="0.82">FILE // ${esc(fileName)}</text>
  <text x="152" y="214" font-family="monospace" font-size="64" fill="${accent}">${esc(roleLabel.zh)} / ${esc(roleLabel.ja)} / ${esc(roleLabel.en)}</text>
  <text x="152" y="286" font-family="monospace" font-size="42" fill="${accent}" opacity="0.85">${esc(roleName.zh)} / ${esc(roleName.ja)} / ${esc(roleName.en)}</text>
  <text x="700" y="676" text-anchor="middle" font-family="monospace" font-size="78" fill="${accent}">${esc(stateLabel.zh)}</text>
  <text x="700" y="768" text-anchor="middle" font-family="monospace" font-size="72" fill="${accent}">${esc(stateLabel.ja)}</text>
  <text x="700" y="860" text-anchor="middle" font-family="monospace" font-size="76" fill="${accent}">${esc(stateLabel.en)}</text>
  <text x="700" y="1012" text-anchor="middle" font-family="monospace" font-size="46" fill="${accent}" opacity="0.82">${esc(mouthLabel.zh)} / ${esc(mouthLabel.ja)} / ${esc(mouthLabel.en)}</text>
  <text x="152" y="1466" font-family="monospace" font-size="42" fill="${accent}">PACK // ${esc(packId)}</text>
  <text x="152" y="1534" font-family="monospace" font-size="36" fill="${accent}" opacity="0.82">STATE // ${esc(state)}</text>
  <text x="152" y="1602" font-family="monospace" font-size="36" fill="${accent}" opacity="0.82">MOUTH // ${speaking ? 'open' : 'closed'}</text>
  <text x="152" y="1670" font-family="monospace" font-size="36" fill="${accent}" opacity="0.82">SIZE // ${portraitWidth} x ${portraitHeight}px</text>
</svg>
`;
};

const portraitThumbnailSvg = ({ roleLabel, packId, accent, bg, fileName }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${thumbHeight}" viewBox="0 0 ${thumbWidth} ${thumbHeight}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="2" y="2" width="${thumbWidth - 4}" height="${thumbHeight - 4}" fill="none" stroke="${accent}" stroke-width="4"/>
  <rect x="24" y="24" width="592" height="312" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="48" y="72" font-family="monospace" font-size="18" fill="${accent}" opacity="0.82">FILE // ${esc(fileName)}</text>
  <text x="48" y="114" font-family="monospace" font-size="38" fill="${accent}">${esc(roleLabel.zh)} / ${esc(roleLabel.ja)} / ${esc(roleLabel.en)}</text>
  <text x="48" y="176" font-family="monospace" font-size="30" fill="${accent}" opacity="0.82">PORTRAIT PACK</text>
  <text x="48" y="244" font-family="monospace" font-size="24" fill="${accent}" opacity="0.72">${esc(packId)}</text>
  <text x="48" y="294" font-family="monospace" font-size="20" fill="${accent}" opacity="0.72">SIZE // ${thumbWidth} x ${thumbHeight}px</text>
</svg>
`;

const portraitReferenceSvg = ({ roleLabel, roleName, packId, accent, bg, fileName }) => {
    const lines = portraitStates
        .map((state, index) => {
            const label = stateLabels[state];
            const y = 260 + index * 56;
            return `<text x="92" y="${y}" font-family="monospace" font-size="28" fill="${accent}" opacity="0.85">[${String(index + 1).padStart(2, '0')}] ${esc(label.zh)} / ${esc(label.ja)} / ${esc(label.en)}</text>`;
        })
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${referenceWidth}" height="${referenceHeight}" viewBox="0 0 ${referenceWidth} ${referenceHeight}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="2" y="2" width="${referenceWidth - 4}" height="${referenceHeight - 4}" fill="none" stroke="${accent}" stroke-width="4"/>
  <rect x="40" y="40" width="1520" height="1020" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="88" y="84" font-family="monospace" font-size="20" fill="${accent}" opacity="0.82">FILE // ${esc(fileName)} // ${referenceWidth} x ${referenceHeight}px</text>
  <text x="88" y="118" font-family="monospace" font-size="44" fill="${accent}">${esc(roleLabel.zh)} / ${esc(roleLabel.ja)} / ${esc(roleLabel.en)}</text>
  <text x="88" y="180" font-family="monospace" font-size="36" fill="${accent}" opacity="0.82">${esc(roleName.zh)} / ${esc(roleName.ja)} / ${esc(roleName.en)}</text>
  <text x="88" y="226" font-family="monospace" font-size="26" fill="${accent}" opacity="0.72">PACK // ${esc(packId)}</text>
  ${lines}
  <rect x="1048" y="124" width="432" height="792" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="1264" y="288" text-anchor="middle" font-family="monospace" font-size="34" fill="${accent}">24 RUNTIME FILES</text>
  <text x="1264" y="362" text-anchor="middle" font-family="monospace" font-size="28" fill="${accent}" opacity="0.84">12 STATES</text>
  <text x="1264" y="414" text-anchor="middle" font-family="monospace" font-size="28" fill="${accent}" opacity="0.84">closed / open</text>
  <text x="1264" y="540" text-anchor="middle" font-family="monospace" font-size="26" fill="${accent}" opacity="0.74">This is a debug reference sheet.</text>
  <text x="1264" y="590" text-anchor="middle" font-family="monospace" font-size="26" fill="${accent}" opacity="0.74">ZH / JA / EN labels are embedded.</text>
</svg>
`;
};

const backgroundSlotSvg = ({ packId, slot, accent, bg, overlay, fileName }) => {
    const label = slotLabels[slot];
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${backgroundWidth}" height="${backgroundHeight}" viewBox="0 0 ${backgroundWidth} ${backgroundHeight}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="2" y="2" width="${backgroundWidth - 4}" height="${backgroundHeight - 4}" fill="none" stroke="${accent}" stroke-width="4"/>
  <g opacity="0.18" stroke="${accent}" stroke-width="2">
    <path d="M0 120 H1920M0 240 H1920M0 360 H1920M0 480 H1920M0 600 H1920M0 720 H1920M0 840 H1920M0 960 H1920"/>
    <path d="M120 0 V1080M240 0 V1080M360 0 V1080M480 0 V1080M600 0 V1080M720 0 V1080M840 0 V1080M960 0 V1080M1080 0 V1080M1200 0 V1080M1320 0 V1080M1440 0 V1080M1560 0 V1080M1680 0 V1080M1800 0 V1080"/>
  </g>
  <rect x="124" y="104" width="1672" height="872" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="160" y="176" font-family="monospace" font-size="24" fill="${accent}" opacity="0.82">FILE // ${esc(fileName)}</text>
  <text x="160" y="236" font-family="monospace" font-size="72" fill="${accent}">${esc(label.zh)}</text>
  <text x="160" y="334" font-family="monospace" font-size="66" fill="${accent}">${esc(label.ja)}</text>
  <text x="160" y="432" font-family="monospace" font-size="70" fill="${accent}">${esc(label.en)}</text>
  <text x="160" y="560" font-family="monospace" font-size="34" fill="${accent}" opacity="0.82">PACK // ${esc(packId)}</text>
  <text x="160" y="620" font-family="monospace" font-size="34" fill="${accent}" opacity="0.82">SLOT // ${esc(slot)}</text>
  <text x="160" y="680" font-family="monospace" font-size="34" fill="${accent}" opacity="0.82">${overlay ? 'OVERLAY READY' : 'BACKGROUND READY'}</text>
  <text x="160" y="740" font-family="monospace" font-size="34" fill="${accent}" opacity="0.82">SIZE // ${backgroundWidth} x ${backgroundHeight}px</text>
</svg>
`;
};

const backgroundThumbnailSvg = ({ packId, accent, bg, fileName }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${thumbWidth}" height="${thumbHeight}" viewBox="0 0 ${thumbWidth} ${thumbHeight}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="2" y="2" width="${thumbWidth - 4}" height="${thumbHeight - 4}" fill="none" stroke="${accent}" stroke-width="4"/>
  <rect x="24" y="24" width="592" height="312" fill="none" stroke="${accent}" stroke-width="4"/>
  <text x="48" y="72" font-family="monospace" font-size="18" fill="${accent}" opacity="0.82">FILE // ${esc(fileName)}</text>
  <text x="48" y="112" font-family="monospace" font-size="38" fill="${accent}">背景 / 背景 / BACKGROUND</text>
  <text x="48" y="174" font-family="monospace" font-size="30" fill="${accent}" opacity="0.82">PACK</text>
  <text x="48" y="242" font-family="monospace" font-size="24" fill="${accent}" opacity="0.72">${esc(packId)}</text>
  <text x="48" y="294" font-family="monospace" font-size="20" fill="${accent}" opacity="0.72">SIZE // ${thumbWidth} x ${thumbHeight}px</text>
</svg>
`;

const backgroundOverlaySvg = ({ packId, accent, fileName }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${backgroundWidth}" height="${backgroundHeight}" viewBox="0 0 ${backgroundWidth} ${backgroundHeight}">
  <rect width="100%" height="100%" fill="transparent"/>
  <rect x="2" y="2" width="${backgroundWidth - 4}" height="${backgroundHeight - 4}" fill="none" stroke="${accent}" stroke-width="4"/>
  <g opacity="0.28" stroke="${accent}" stroke-width="2">
    <rect x="78" y="78" width="1764" height="924" fill="none"/>
    <rect x="106" y="106" width="1708" height="868" fill="none"/>
    <path d="M78 540 H1842M960 78 V1002"/>
  </g>
  <text x="132" y="146" font-family="monospace" font-size="24" fill="${accent}" opacity="0.82">FILE // ${esc(fileName)}</text>
  <text x="132" y="194" font-family="monospace" font-size="28" fill="${accent}" opacity="0.66">OVERLAY // ${esc(packId)} // ${backgroundWidth} x ${backgroundHeight}px</text>
</svg>
`;

const buildPortraitPack = async ({
    id,
    displayName,
    roleHint,
    roleLabel,
    accent,
    bg
}) => {
    const dir = path.join(builtinPortraitRoot, id);
    const states = Object.fromEntries(
        portraitStates.map((state) => [
            state,
            {
                closed: `${state}_closed.svg`,
                open: `${state}_open.svg`
            }
        ])
    );

    await writeJson(path.join(dir, 'manifest.json'), {
        version: 'portrait_pack_v1',
        id,
        displayName,
        roleHint,
        thumbnail: 'thumbnail.svg',
        referenceSheet: 'reference_sheet.svg',
        states
    });

    await writeText(path.join(dir, 'thumbnail.svg'), portraitThumbnailSvg({ roleLabel, packId: id, accent, bg, fileName: 'thumbnail.svg' }));
    await writeText(path.join(dir, 'reference_sheet.svg'), portraitReferenceSvg({ roleLabel, roleName: displayName, packId: id, accent, bg, fileName: 'reference_sheet.svg' }));

    for (const state of portraitStates) {
        const closedFile = `${state}_closed.svg`;
        const openFile = `${state}_open.svg`;
        await writeText(
            path.join(dir, closedFile),
            portraitPlaceholderSvg({
                roleLabel,
                roleName: displayName,
                packId: id,
                state,
                speaking: false,
                accent,
                bg,
                fileName: closedFile
            })
        );
        await writeText(
            path.join(dir, openFile),
            portraitPlaceholderSvg({
                roleLabel,
                roleName: displayName,
                packId: id,
                state,
                speaking: true,
                accent,
                bg,
                fileName: openFile
            })
        );
    }
};

const buildBackgroundPack = async ({ id, displayName, accent, bg }) => {
    const dir = path.join(builtinBackgroundRoot, id);
    const slots = Object.fromEntries(backgroundSlots.map((slot) => [slot, `${slot}.svg`]));

    await writeJson(path.join(dir, 'manifest.json'), {
        version: 'background_pack_v1',
        id,
        displayName,
        thumbnail: 'thumbnail.svg',
        slots,
        overlays: {
            cross_exam: 'overlay.svg',
            analysis: 'overlay.svg',
            reveal: 'overlay.svg',
            confession: 'overlay.svg'
        }
    });

    await writeText(path.join(dir, 'thumbnail.svg'), backgroundThumbnailSvg({ packId: id, accent, bg, fileName: 'thumbnail.svg' }));
    await writeText(path.join(dir, 'overlay.svg'), backgroundOverlaySvg({ packId: id, accent, fileName: 'overlay.svg' }));

    for (const slot of backgroundSlots) {
        await writeText(path.join(dir, `${slot}.svg`), backgroundSlotSvg({ packId: id, slot, accent, bg, overlay: false, fileName: `${slot}.svg` }));
    }
};

const writeTemplates = async () => {
    const portraitManifestTemplate = {
        version: 'portrait_pack_v1',
        id: 'your-portrait-pack-id',
        displayName: {
            zh: '你的角色包名称',
            ja: 'あなたのキャラクターパック名',
            en: 'Your Portrait Pack Name'
        },
        roleHint: 'generic',
        thumbnail: 'thumbnail.png',
        referenceSheet: 'reference_sheet.png',
        states: Object.fromEntries(
            portraitStates.map((state) => [
                state,
                {
                    closed: `${state}_closed.png`,
                    open: `${state}_open.png`
                }
            ])
        )
    };

    const backgroundManifestTemplate = {
        version: 'background_pack_v1',
        id: 'your-background-pack-id',
        displayName: {
            zh: '你的背景包名称',
            ja: 'あなたの背景パック名',
            en: 'Your Background Pack Name'
        },
        thumbnail: 'thumbnail.png',
        slots: Object.fromEntries(backgroundSlots.map((slot) => [slot, `${slot}.png`])),
        overlays: {
            cross_exam: 'overlay.png',
            analysis: 'overlay.png',
            reveal: 'overlay.png',
            confession: 'overlay.png'
        }
    };

    const portraitReadme = `# Portrait Pack Template

## Supported image formats

- png
- gif
- webp
- jpg / jpeg
- svg

## Required files

- manifest.json
- thumbnail.(png|gif|webp|jpg|jpeg|svg)
- reference_sheet.(png|gif|webp|jpg|jpeg|svg)
- 12 portrait states x 2 mouth variants

## Required portrait states

${portraitStates.map((state) => `- ${state}`).join('\n')}

Each state must provide:

- \`closed\`
- \`open\`

## Notes

- All runtime portraits should use the same canvas size.
- Keep character position stable across all files.
- \`open\` and \`closed\` should only change the mouth and minor expression details.
- Use ASCII filenames.
`;

    const backgroundReadme = `# Background Pack Template

## Supported image formats

- png
- gif
- webp
- jpg / jpeg
- svg

## Required files

- manifest.json
- thumbnail.(png|gif|webp|jpg|jpeg|svg)
- one asset for each background slot

## Standard slots

${backgroundSlots.map((slot) => `- ${slot}`).join('\n')}

## Optional overlays

You can provide overlay assets in \`overlays\` for slots such as:

- cross_exam
- analysis
- reveal
- confession

If a pack does not include overlays, the game will simply render the background image.
`;

    const spec = `# Asset Pack Specification

This project supports two runtime asset pack types:

1. portrait packs
2. background packs

## Portrait Pack

- version: \`portrait_pack_v1\`
- required fields:
  - \`id\`
  - \`displayName\`
  - \`thumbnail\`
  - \`referenceSheet\`
  - \`states\`
- optional field:
  - \`roleHint\` = \`hero\` | \`enemy\` | \`generic\`

Portrait states:

${portraitStates.map((state) => `- ${state}`).join('\n')}

Each portrait state contains:

\`\`\`json
{
  "closed": "state_closed.png",
  "open": "state_open.png"
}
\`\`\`

## Background Pack

- version: \`background_pack_v1\`
- required fields:
  - \`id\`
  - \`displayName\`
  - \`thumbnail\`
  - \`slots\`
- optional field:
  - \`overlays\`

Background slots:

${backgroundSlots.map((slot) => `- ${slot}`).join('\n')}

## File format support

- png
- gif
- webp
- jpg / jpeg
- svg

## Runtime notes

- Portrait packs are shared by video-window mode and AVG mode.
- Background packs are shared by AI mode and local scripted mode.
- SVG files are useful as debug placeholders because they can embed readable text.
- For production art, static files should usually use PNG; animated assets may use GIF.
`;

    await writeText(path.join(templatesRoot, 'ASSET_PACK_SPEC.md'), spec);
    await writeJson(path.join(templatesRoot, 'portrait-pack-template', 'manifest.json'), portraitManifestTemplate);
    await writeText(path.join(templatesRoot, 'portrait-pack-template', 'README.md'), portraitReadme);
    await writeJson(path.join(templatesRoot, 'background-pack-template', 'manifest.json'), backgroundManifestTemplate);
    await writeText(path.join(templatesRoot, 'background-pack-template', 'README.md'), backgroundReadme);
};

const rewriteBuiltinManifests = async () => {
    await writeJson(path.join(builtinPortraitRoot, 'hero-detective-default', 'manifest.json'), {
        version: 'portrait_pack_v1',
        id: 'hero-detective-default',
        displayName: {
            zh: '默认调查员',
            ja: 'デフォルト調査員',
            en: 'Detective Default'
        },
        roleHint: 'hero',
        thumbnail: 'thumbnail.svg',
        referenceSheet: 'reference_sheet.svg',
        states: Object.fromEntries(
            portraitStates.map((state) => [
                state,
                {
                    closed: `${state}_closed.svg`,
                    open: `${state}_open.svg`
                }
            ])
        )
    });

    await writeJson(path.join(builtinPortraitRoot, 'suspect-ribbon-default', 'manifest.json'), {
        version: 'portrait_pack_v1',
        id: 'suspect-ribbon-default',
        displayName: {
            zh: '默认蝴蝶结嫌犯',
            ja: 'デフォルト・リボン容疑者',
            en: 'Ribbon Suspect'
        },
        roleHint: 'enemy',
        thumbnail: 'thumbnail.svg',
        referenceSheet: 'reference_sheet.svg',
        states: Object.fromEntries(
            portraitStates.map((state) => [
                state,
                {
                    closed: `${state}_closed.svg`,
                    open: `${state}_open.svg`
                }
            ])
        )
    });

    await writeJson(path.join(builtinPortraitRoot, 'suspect-ribbon-noir', 'manifest.json'), {
        version: 'portrait_pack_v1',
        id: 'suspect-ribbon-noir',
        displayName: {
            zh: '暗调蝴蝶结嫌犯',
            ja: 'ノワール・リボン容疑者',
            en: 'Ribbon Suspect Noir'
        },
        roleHint: 'enemy',
        thumbnail: 'thumbnail.svg',
        referenceSheet: 'reference_sheet.svg',
        states: Object.fromEntries(
            portraitStates.map((state) => [
                state,
                {
                    closed: `${state}_closed.svg`,
                    open: `${state}_open.svg`
                }
            ])
        )
    });

    await writeJson(path.join(builtinBackgroundRoot, 'default-court-interface', 'manifest.json'), {
        version: 'background_pack_v1',
        id: 'default-court-interface',
        displayName: {
            zh: '默认法庭界面',
            ja: 'デフォルト法廷インターフェース',
            en: 'Default Court Interface'
        },
        thumbnail: 'thumbnail.svg',
        slots: Object.fromEntries(backgroundSlots.map((slot) => [slot, `${slot}.svg`])),
        overlays: {
            cross_exam: 'overlay.svg',
            analysis: 'overlay.svg',
            reveal: 'overlay.svg',
            confession: 'overlay.svg'
        }
    });
};

const main = async () => {
    await writeTemplates();
    await rewriteBuiltinManifests();

    await buildPortraitPack({
        id: 'debug-hero-readout',
        displayName: {
            zh: '调试玩家立绘包',
            ja: 'デバッグ主人公立ち絵パック',
            en: 'Debug Hero Portrait Pack'
        },
        roleHint: 'hero',
        roleLabel: {
            zh: '玩家立绘',
            ja: '主人公立ち絵',
            en: 'HERO PORTRAIT'
        },
        accent: '#d4ff27',
        bg: '#07111b'
    });

    await buildPortraitPack({
        id: 'debug-enemy-readout',
        displayName: {
            zh: '调试嫌犯立绘包',
            ja: 'デバッグ容疑者立ち絵パック',
            en: 'Debug Enemy Portrait Pack'
        },
        roleHint: 'enemy',
        roleLabel: {
            zh: '嫌犯立绘',
            ja: '容疑者立ち絵',
            en: 'ENEMY PORTRAIT'
        },
        accent: '#ffb84d',
        bg: '#131018'
    });

    await buildBackgroundPack({
        id: 'debug-scene-readout',
        displayName: {
            zh: '调试背景包',
            ja: 'デバッグ背景パック',
            en: 'Debug Background Pack'
        },
        accent: '#6be4ff',
        bg: '#08111a'
    });
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
