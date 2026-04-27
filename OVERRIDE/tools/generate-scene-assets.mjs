import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = 'F:/Codex/ronpa/src/game-content';

const ensureDir = async (dir) => {
    await mkdir(dir, { recursive: true });
};

const writeJson = async (filePath, value) => {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const writeSvg = async (filePath, content) => {
    await ensureDir(path.dirname(filePath));
    await writeFile(filePath, content, 'utf8');
};

const portraitCanvas = { width: 1400, height: 1800 };

const portraitSvg = ({
    name,
    palette,
    expression,
    speaking,
    accessory = 'bow',
    role = 'enemy'
}) => {
    const mouth = speaking
        ? `<path d="M640 900 Q700 960 760 900" stroke="${palette.line}" stroke-width="16" fill="none" stroke-linecap="round" />`
        : `<path d="M655 900 Q700 920 745 900" stroke="${palette.line}" stroke-width="10" fill="none" stroke-linecap="round" />`;

    const eyeY = expression === 'shock_big' || expression === 'surprise_small' ? 685 : 705;
    const eyeHeight = expression === 'shock_big' ? 86 : expression === 'surprise_small' ? 70 : expression === 'breakdown_unstable' ? 64 : 54;
    const browTilt = expression === 'angry_attack' || expression === 'defensive_frown' ? -22 : expression === 'sad_confession' ? 18 : 0;
    const blush = expression === 'innocent_hand' || expression === 'shock_big' || expression === 'sad_confession';
    const shadowTone = expression === 'breakdown_unstable' ? '#a8b0d8' : palette.shadow;
    const hand = expression === 'thinking_hand_to_chin' || expression === 'innocent_hand' || expression === 'shock_big';
    const stress = expression === 'breakdown_unstable' || expression === 'shock_big';
    const frown = expression === 'defensive_frown' || expression === 'angry_attack';
    const smile = expression === 'polite_smile' || expression === 'smug_tilt' || expression === 'breakdown_unstable';
    const bodyAccent = role === 'hero' ? palette.heroAccent : palette.enemyAccent;

    const eyebrowLeft = 540;
    const eyebrowRight = 760;
    const browY = 625;

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${portraitCanvas.width}" height="${portraitCanvas.height}" viewBox="0 0 ${portraitCanvas.width} ${portraitCanvas.height}">
  <rect width="100%" height="100%" fill="transparent"/>
  <g opacity="0.18">
    <circle cx="700" cy="900" r="500" fill="${palette.glow}"/>
  </g>
  <g>
    <path d="M320 1480 C370 1180 1030 1180 1080 1480 L1080 1800 L320 1800 Z" fill="${palette.coat}"/>
    <path d="M550 1180 L700 1450 L850 1180" fill="${bodyAccent}"/>
    <path d="M470 1160 C540 1080 860 1080 930 1160 L890 1235 C820 1180 580 1180 510 1235 Z" fill="${palette.collar}"/>
  </g>
  <g>
    <ellipse cx="700" cy="780" rx="275" ry="315" fill="${palette.skin}"/>
    <path d="M445 740 C460 470 930 430 970 790 C960 560 900 330 700 320 C520 330 440 480 445 740 Z" fill="${palette.hair}"/>
    <path d="M455 765 C430 610 480 520 565 475 C520 520 500 590 510 665 C620 585 770 570 900 610 C878 540 842 490 790 448 C865 490 930 575 944 720 C946 860 865 968 700 1010 C535 968 450 880 455 765 Z" fill="${palette.hair}"/>
    <path d="M495 565 C565 505 640 485 730 500 C670 530 640 560 620 640 C575 650 535 660 490 690 Z" fill="${palette.hairShade}"/>
    <path d="M815 520 C865 540 905 590 925 650 C880 635 835 625 785 630 C782 580 795 548 815 520 Z" fill="${palette.hairShade}"/>
    <path d="M535 ${browY} Q590 ${browY + browTilt} 635 ${browY + 8}" stroke="${palette.line}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <path d="M765 ${browY + 8} Q810 ${browY + browTilt} 865 ${browY}" stroke="${palette.line}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <ellipse cx="585" cy="${eyeY}" rx="58" ry="${eyeHeight}" fill="#ffffff"/>
    <ellipse cx="815" cy="${eyeY}" rx="58" ry="${eyeHeight}" fill="#ffffff"/>
    <ellipse cx="585" cy="${eyeY + 6}" rx="30" ry="${Math.max(24, eyeHeight - 24)}" fill="${palette.iris}"/>
    <ellipse cx="815" cy="${eyeY + 6}" rx="30" ry="${Math.max(24, eyeHeight - 24)}" fill="${palette.iris}"/>
    <ellipse cx="592" cy="${eyeY + 8}" rx="12" ry="${Math.max(10, eyeHeight - 44)}" fill="${palette.pupil}"/>
    <ellipse cx="822" cy="${eyeY + 8}" rx="12" ry="${Math.max(10, eyeHeight - 44)}" fill="${palette.pupil}"/>
    <circle cx="602" cy="${eyeY - 14}" r="8" fill="#ffffff" opacity="0.9"/>
    <circle cx="832" cy="${eyeY - 14}" r="8" fill="#ffffff" opacity="0.9"/>
    <path d="M525 ${eyeY - eyeHeight + 12} Q585 ${eyeY - eyeHeight - 20} 645 ${eyeY - eyeHeight + 12}" stroke="${palette.line}" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M755 ${eyeY - eyeHeight + 12} Q815 ${eyeY - eyeHeight - 20} 875 ${eyeY - eyeHeight + 12}" stroke="${palette.line}" stroke-width="10" fill="none" stroke-linecap="round"/>
    ${blush ? `<ellipse cx="520" cy="835" rx="55" ry="22" fill="${palette.blush}" opacity="0.34"/><ellipse cx="880" cy="835" rx="55" ry="22" fill="${palette.blush}" opacity="0.34"/>` : ''}
    <path d="M690 760 C705 800 708 838 700 870" stroke="${shadowTone}" stroke-width="8" fill="none" stroke-linecap="round"/>
    ${mouth}
    ${frown ? `<path d="M652 896 Q700 860 748 896" stroke="${palette.line}" stroke-width="10" fill="none" stroke-linecap="round"/>` : ''}
    ${smile ? `<path d="M646 902 Q700 940 754 902" stroke="${palette.line}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.4"/>` : ''}
    <path d="M982 802 C1058 682 1050 498 930 415 C960 505 952 650 915 770 Z" fill="${palette.hairBack}" opacity="0.95"/>
    ${accessory === 'bow'
        ? `<path d="M900 312 C980 260 1078 282 1110 352 C1040 380 972 388 910 360 Z" fill="${palette.ribbon}"/>
           <path d="M840 312 C760 260 662 282 630 352 C700 380 768 388 830 360 Z" fill="${palette.ribbon}"/>
           <rect x="836" y="314" width="68" height="54" rx="12" fill="${palette.ribbonCenter}"/>`
        : `<circle cx="944" cy="336" r="44" fill="${palette.ribbonCenter}" /><path d="M900 336 L988 336" stroke="${palette.ribbon}" stroke-width="22" stroke-linecap="round"/>`}
    <path d="M880 525 L958 476" stroke="${palette.clip}" stroke-width="18" stroke-linecap="round"/>
    <path d="M890 551 L968 502" stroke="${palette.clip}" stroke-width="8" stroke-linecap="round"/>
    <rect x="492" y="1044" width="62" height="142" rx="14" fill="${palette.earring}"/>
    <rect x="846" y="1044" width="62" height="142" rx="14" fill="${palette.earring}"/>
    ${hand ? `<path d="M1030 1030 C1110 1018 1172 1064 1196 1168 C1160 1164 1124 1174 1092 1198 C1058 1220 1028 1258 1010 1302 C948 1250 926 1178 958 1112 C978 1070 998 1046 1030 1030 Z" fill="${palette.skin}"/>
    <path d="M1045 1035 C1066 1000 1092 980 1122 976" stroke="${palette.line}" stroke-width="8" fill="none" stroke-linecap="round"/>` : ''}
    ${stress ? `<path d="M460 516 L500 448" stroke="${palette.stress}" stroke-width="10"/><path d="M944 470 L1008 426" stroke="${palette.stress}" stroke-width="10"/><path d="M1018 588 L1096 560" stroke="${palette.stress}" stroke-width="10"/>` : ''}
  </g>
  <text x="700" y="1670" text-anchor="middle" font-family="monospace" font-size="54" fill="${palette.text}" opacity="0.28">${name} // ${expression}${speaking ? ' OPEN' : ' CLOSED'}</text>
</svg>`;
};

const referenceSheetSvg = ({ name, palette }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1100" viewBox="0 0 1600 1100">
  <rect width="100%" height="100%" fill="#f4f5ef"/>
  <rect x="40" y="40" width="1520" height="1020" rx="24" fill="#ffffff" stroke="${palette.line}" stroke-width="4"/>
  <text x="90" y="120" font-family="monospace" font-size="42" fill="${palette.line}">${name.toUpperCase()} // REFERENCE SHEET</text>
  <image href="./neutral_idle_closed.svg" x="80" y="160" width="360" height="500"/>
  <image href="./polite_smile_closed.svg" x="420" y="160" width="360" height="500"/>
  <image href="./smug_tilt_closed.svg" x="760" y="160" width="360" height="500"/>
  <image href="./shock_big_open.svg" x="1100" y="160" width="360" height="500"/>
  <image href="./serious_focus_closed.svg" x="80" y="580" width="360" height="420"/>
  <image href="./angry_attack_open.svg" x="420" y="580" width="360" height="420"/>
  <image href="./breakdown_unstable_open.svg" x="760" y="580" width="360" height="420"/>
  <image href="./sad_confession_closed.svg" x="1100" y="580" width="360" height="420"/>
</svg>`;

const backgroundSvg = ({ title, accent, subAccent, mode }) => {
    const overlay = mode === 'glitch'
        ? `<g opacity="0.18">
            <rect x="0" y="0" width="1920" height="120" fill="${accent}"/>
            <rect x="420" y="310" width="420" height="18" fill="${subAccent}"/>
            <rect x="1040" y="626" width="560" height="16" fill="${accent}"/>
          </g>`
        : '';

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="100%" height="100%" fill="#070b12"/>
  <g stroke="#1b2734" stroke-width="1">
    <path d="M0 120 H1920M0 240 H1920M0 360 H1920M0 480 H1920M0 600 H1920M0 720 H1920M0 840 H1920M0 960 H1920"/>
    <path d="M120 0 V1080M240 0 V1080M360 0 V1080M480 0 V1080M600 0 V1080M720 0 V1080M840 0 V1080M960 0 V1080M1080 0 V1080M1200 0 V1080M1320 0 V1080M1440 0 V1080M1560 0 V1080M1680 0 V1080M1800 0 V1080"/>
  </g>
  <rect x="140" y="140" width="1040" height="620" fill="#0c1320" stroke="${accent}" stroke-width="4"/>
  <rect x="1240" y="140" width="540" height="260" fill="#0c1320" stroke="${accent}" stroke-width="4"/>
  <rect x="1240" y="440" width="540" height="320" fill="#0c1320" stroke="${accent}" stroke-width="4"/>
  <rect x="140" y="810" width="1640" height="140" fill="#0c1320" stroke="${accent}" stroke-width="4"/>
  <text x="184" y="220" font-family="monospace" font-size="52" fill="${accent}">${title}</text>
  <text x="184" y="280" font-family="monospace" font-size="28" fill="${subAccent}">COURT VISUAL CHANNEL // LIVE</text>
  <circle cx="664" cy="450" r="220" fill="none" stroke="${subAccent}" stroke-width="6"/>
  <circle cx="664" cy="450" r="118" fill="none" stroke="${accent}" stroke-width="10"/>
  <path d="M444 450 H884M664 230 V670" stroke="${accent}" stroke-width="6"/>
  <text x="1284" y="220" font-family="monospace" font-size="28" fill="${subAccent}">SYSTEM FEED</text>
  <text x="1284" y="520" font-family="monospace" font-size="28" fill="${subAccent}">EVIDENCE CHANNEL</text>
  <text x="184" y="890" font-family="monospace" font-size="30" fill="${subAccent}">LOG STREAM // DECISION CORE READY</text>
  ${overlay}
</svg>`;
};

const overlaySvg = ({ accent }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <rect width="100%" height="100%" fill="transparent"/>
  <g stroke="${accent}" stroke-width="2" opacity="0.18">
    <rect x="90" y="90" width="1740" height="900" fill="none"/>
    <rect x="120" y="120" width="1680" height="840" fill="none"/>
    <path d="M90 540 H1830M960 90 V990"/>
  </g>
</svg>`;

const portraitPacks = [
    {
        id: 'hero-detective-default',
        name: 'Detective Default',
        roleHint: 'hero',
        palette: {
            skin: '#f5d8cc',
            hair: '#22304d',
            hairShade: '#18233a',
            hairBack: '#1e2d49',
            ribbon: '#24385a',
            ribbonCenter: '#cfd9ef',
            clip: '#d0f127',
            earring: '#d4ff27',
            coat: '#0b1220',
            collar: '#dde6f5',
            heroAccent: '#d4ff27',
            enemyAccent: '#f0b84d',
            iris: '#d4ff27',
            pupil: '#111111',
            line: '#111827',
            blush: '#ff9f9f',
            stress: '#d4ff27',
            glow: '#d4ff27',
            text: '#d4ff27',
            shadow: '#8a6f68'
        },
        accessory: 'clip'
    },
    {
        id: 'suspect-ribbon-default',
        name: 'Ribbon Suspect',
        roleHint: 'enemy',
        palette: {
            skin: '#f7d5ca',
            hair: '#c88f63',
            hairShade: '#b17649',
            hairBack: '#b8784a',
            ribbon: '#1f233f',
            ribbonCenter: '#32406d',
            clip: '#af7a46',
            earring: '#b17f52',
            coat: '#1c2340',
            collar: '#d8deed',
            heroAccent: '#d4ff27',
            enemyAccent: '#8b2646',
            iris: '#7d84d8',
            pupil: '#1a2035',
            line: '#171a29',
            blush: '#ff8da8',
            stress: '#b14f4f',
            glow: '#7d84d8',
            text: '#7d84d8',
            shadow: '#8f6a60'
        },
        accessory: 'bow'
    },
    {
        id: 'suspect-ribbon-noir',
        name: 'Ribbon Suspect Noir',
        roleHint: 'enemy',
        palette: {
            skin: '#f3d2ca',
            hair: '#43314f',
            hairShade: '#35253f',
            hairBack: '#392948',
            ribbon: '#7a113a',
            ribbonCenter: '#d4ff27',
            clip: '#d4ff27',
            earring: '#f0b84d',
            coat: '#181323',
            collar: '#e9e1f4',
            heroAccent: '#d4ff27',
            enemyAccent: '#7a113a',
            iris: '#d86ea3',
            pupil: '#111111',
            line: '#16151d',
            blush: '#d98faa',
            stress: '#d4ff27',
            glow: '#d86ea3',
            text: '#d86ea3',
            shadow: '#8b6870'
        },
        accessory: 'bow'
    }
];

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

const buildPortraitPack = async ({ id, name, roleHint, palette, accessory }) => {
    const dir = path.join(root, 'builtin', 'portrait-packs', id);
    await ensureDir(dir);

    for (const state of portraitStates) {
        await writeSvg(path.join(dir, `${state}_closed.svg`), portraitSvg({ name, palette, expression: state, speaking: false, accessory, role: roleHint === 'hero' ? 'hero' : 'enemy' }));
        await writeSvg(path.join(dir, `${state}_open.svg`), portraitSvg({ name, palette, expression: state, speaking: true, accessory, role: roleHint === 'hero' ? 'hero' : 'enemy' }));
    }

    await writeSvg(path.join(dir, 'thumbnail.svg'), portraitSvg({ name, palette, expression: 'neutral_idle', speaking: false, accessory, role: roleHint === 'hero' ? 'hero' : 'enemy' }));
    await writeSvg(path.join(dir, 'reference_sheet.svg'), referenceSheetSvg({ name, palette }));

    const manifest = {
        version: 'portrait_pack_v1',
        id,
        displayName: {
            zh: name,
            ja: name,
            en: name
        },
        roleHint,
        thumbnail: 'thumbnail.svg',
        referenceSheet: 'reference_sheet.svg',
        states: Object.fromEntries(
            portraitStates.map(state => [
                state,
                {
                    closed: `${state}_closed.svg`,
                    open: `${state}_open.svg`
                }
            ])
        )
    };

    await writeJson(path.join(dir, 'manifest.json'), manifest);
};

const buildBackgroundPack = async () => {
    const dir = path.join(root, 'builtin', 'background-packs', 'default-court-interface');
    await ensureDir(dir);

    const files = {
        'boot.svg': backgroundSvg({ title: 'BOOT CHANNEL', accent: '#d4ff27', subAccent: '#96a66c', mode: 'glitch' }),
        'briefing.svg': backgroundSvg({ title: 'CASE BRIEFING', accent: '#d4ff27', subAccent: '#96a66c', mode: 'grid' }),
        'hearing.svg': backgroundSvg({ title: 'HEARING WINDOW', accent: '#d4ff27', subAccent: '#96a66c', mode: 'grid' }),
        'cross_exam.svg': backgroundSvg({ title: 'CROSS EXAM FEED', accent: '#d4ff27', subAccent: '#96a66c', mode: 'grid' }),
        'analysis.svg': backgroundSvg({ title: 'ANALYSIS VIEW', accent: '#44d8ff', subAccent: '#87c6d2', mode: 'glitch' }),
        'reveal.svg': backgroundSvg({ title: 'REVEAL THREAD', accent: '#f0b84d', subAccent: '#caa66a', mode: 'glitch' }),
        'confession.svg': backgroundSvg({ title: 'CONFESSION CHANNEL', accent: '#ff6464', subAccent: '#d79292', mode: 'glitch' }),
        'ending.svg': backgroundSvg({ title: 'CASE ARCHIVE', accent: '#d4ff27', subAccent: '#96a66c', mode: 'grid' }),
        'overlay.svg': overlaySvg({ accent: '#d4ff27' }),
        'thumbnail.svg': backgroundSvg({ title: 'COURT INTERFACE', accent: '#d4ff27', subAccent: '#96a66c', mode: 'grid' })
    };

    for (const [filename, svg] of Object.entries(files)) {
        await writeSvg(path.join(dir, filename), svg);
    }

    const manifest = {
        version: 'background_pack_v1',
        id: 'default-court-interface',
        displayName: {
            zh: '默认法庭界面',
            ja: 'デフォルト法廷インターフェース',
            en: 'Default Court Interface'
        },
        thumbnail: 'thumbnail.svg',
        slots: {
            boot: 'boot.svg',
            briefing: 'briefing.svg',
            hearing: 'hearing.svg',
            cross_exam: 'cross_exam.svg',
            analysis: 'analysis.svg',
            reveal: 'reveal.svg',
            confession: 'confession.svg',
            ending: 'ending.svg'
        },
        overlays: {
            cross_exam: 'overlay.svg',
            analysis: 'overlay.svg',
            reveal: 'overlay.svg',
            confession: 'overlay.svg'
        }
    };

    await writeJson(path.join(dir, 'manifest.json'), manifest);
};

const ensureCustomDirs = async () => {
    await ensureDir(path.join(root, 'custom', 'portrait-packs'));
    await ensureDir(path.join(root, 'custom', 'background-packs'));
    await ensureDir(path.join(root, 'builtin', 'cases'));
    await ensureDir(path.join(root, 'builtin', 'templates'));
};

await ensureCustomDirs();
for (const pack of portraitPacks) {
    await buildPortraitPack(pack);
}
await buildBackgroundPack();
