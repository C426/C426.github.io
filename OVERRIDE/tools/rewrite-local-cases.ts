import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeWeakPointMarker } from '../src/services/localCaseMarkers';
import { serializeLocalCaseText } from '../src/services/localCaseFormatter';
import { parseLocalCaseText } from '../src/services/localCaseParser';
import {
    AvgLine,
    FailureReason,
    LocalCaseData,
    LocalDialogueCard,
    LocalizedText
} from '../src/services/localCaseTypes';

const outDir = join(process.cwd(), 'src', 'game-content', 'builtin', 'cases');
const FAIL_REASONS: FailureReason[] = ['wrongEvidence', 'wrongStatement', 'bothWrong'];

const t = (zh: string, ja: string, en: string): LocalizedText => ({ zh, ja, en });
const avg = (speaker: AvgLine['speaker'], zh: string, ja: string, en: string): AvgLine => ({ speaker, text: t(zh, ja, en) });
const avgCue = (
    speaker: AvgLine['speaker'],
    zh: string,
    ja: string,
    en: string,
    cue: Partial<Omit<AvgLine, 'speaker' | 'text'>>
): AvgLine => ({
    ...avg(speaker, zh, ja, en),
    ...cue
});

const line = (
    id: string,
    text: LocalizedText,
    options?: Partial<Pick<LocalDialogueCard, 'hidden' | 'unlockMode' | 'unlockWeakPointIds' | 'grantEvidenceIds' | 'portraitState' | 'portraitMotion'>>
): LocalDialogueCard => ({
    id,
    text,
    hidden: options?.hidden ?? false,
    unlockMode: options?.unlockMode ?? 'none',
    unlockWeakPointIds: options?.unlockWeakPointIds ?? [],
    grantEvidenceIds: options?.grantEvidenceIds ?? [],
    portraitState: options?.portraitState,
    portraitMotion: options?.portraitMotion
});

const failNarratives = (shared: LocalizedText) => ({
    wrongEvidence: { ...shared },
    wrongStatement: { ...shared },
    bothWrong: { ...shared }
});

const failAvg = (shared: AvgLine[]) => ({
    wrongEvidence: shared.map(lineItem => ({ ...lineItem, text: { ...lineItem.text } })),
    wrongStatement: shared.map(lineItem => ({ ...lineItem, text: { ...lineItem.text } })),
    bothWrong: shared.map(lineItem => ({ ...lineItem, text: { ...lineItem.text } }))
});

const emptyFailOverrides = () => ({
    wrongEvidence: [],
    wrongStatement: [],
    bothWrong: []
});

const starfallForgery: LocalCaseData = {
    caseId: 'starfall-forgery',
    caseTitle: t('星陨赝作', 'スターフォール贋作事件', 'Starfall Forgery'),
    defaultLang: 'zh',
    suspectName: t('艺术商里奥', '美術商レオ', 'Art Dealer Leo'),
    suspectEmoji: '',
    heroEmoji: '',
    intro: {
        narrative: t(
            '雨夜法庭，名画《星陨》被判定为赝品。艺术商里奥是最后碰过装框的人，也是第一个急着把自己包装成无辜目击者的人。你要从时间、接触痕迹与分成动机三层壳里，把他的漂亮话一层层剥开。',
            '雨の法廷で名画『スターフォール』は贋作と断定された。最後に額装へ触れたのは美術商レオであり、彼は真っ先に自分を無垢な目撃者として飾り始めた。時間、接触痕跡、取り分の動機。その三層を順番に剥がしていく。',
            'In a rain-soaked court, the masterpiece Starfall has been declared a forgery. Art dealer Leo was the last person to touch the framing and the first to dress himself up as an innocent witness. We need to peel away his timeline, his contact traces, and his motive over the split.'
        ),
        systemMsg: t(
            '未选择证据时点击破绽可进行调查；选择证据后再点击破绽，才会正式论破。',
            '証拠を選ばずに弱点を押すと調査、証拠を選んでから押すと論破になる。',
            'Click a weak point without evidence to inspect it. Select evidence first if you want to rebut it.'
        )
    },
    evidences: [
        {
            id: 'ev-city-scan',
            aliases: ['城门扫描', 'gate scan'],
            startsInInventory: true,
            name: t('城门扫描记录', '市門スキャン記録', 'City Gate Scan'),
            detail: t(
                '昨晚 21:17，里奥的访客通行码在东城门被刷入。系统附带的人脸抓拍与里奥本人完全一致。',
                '昨夜 21:17、レオの訪問者パスが東門で読み取られた。顔認証の静止画も本人と一致している。',
                'At 21:17 last night, Leo\'s visitor pass was scanned at the east gate. The linked face capture matches him exactly.'
            )
        },
        {
            id: 'ev-frame-print',
            aliases: ['画框指纹', 'frame print'],
            startsInInventory: true,
            name: t('外框指纹采样', '額縁の指紋採取', 'Frame Fingerprint Sample'),
            detail: t(
                '法务鉴定在外框右下角提取到里奥的半枚指纹，覆盖在新鲜封蜡之上，形成时间不会早于案发前一小时。',
                '法務鑑定は額縁右下からレオの半指紋を採取した。新しい封蝋の上に重なっており、形成時刻は事件一時間前より古くならない。',
                'Forensics recovered half of Leo’s fingerprint from the lower-right corner of the frame. It sits on top of fresh sealing wax and could not have been left earlier than one hour before the incident.'
            )
        },
        {
            id: 'ev-chauffeur-call',
            aliases: ['司机通话', 'call log'],
            startsInInventory: false,
            name: t('司机加密通话记录', '運転手の暗号通話記録', 'Chauffeur Encrypted Call'),
            detail: t(
                '21:22 到 21:26，里奥的私人终端与司机连通四分钟。录音里反复出现“北门”“样框”“不要走正门监控”三组关键词。',
                '21:22 から 21:26 まで、レオの個人端末は運転手と四分間接続していた。録音には「北門」「サンプル額」「正面監視を避けろ」が繰り返し出る。',
                'From 21:22 to 21:26, Leo’s personal terminal connected to his driver for four minutes. The recording repeatedly mentions “north gate,” “sample frame,” and “avoid the front-door cameras.”'
            )
        },
        {
            id: 'ev-solvent-report',
            aliases: ['溶剂报告', 'solvent report'],
            startsInInventory: false,
            name: t('星陨溶剂鉴定报告', 'スターフォール溶剤鑑定書', 'Starfall Solvent Report'),
            detail: t(
                '仓库边角采样出高浓度“星陨”溶剂残留。该溶剂只有里奥代理的修复工作室才会调配，而且挥发窗口不超过两小时。',
                '倉庫の隅から高濃度の「スターフォール」溶剤残留が検出された。この溶剤を調合できるのはレオが代理する修復工房だけで、揮発時間は二時間以内だ。',
                'A heavy residue of Starfall solvent was found near the storage corner. Only the restoration studio represented by Leo mixes this solvent, and its active window lasts less than two hours.'
            )
        },
        {
            id: 'ev-betrayal-mail',
            aliases: ['分成邮件', 'draft mail'],
            startsInInventory: false,
            name: t('分成协议草稿邮件', '取り分契約の下書きメール', 'Profit Split Draft Mail'),
            detail: t(
                '馆长未发送的邮件草稿显示，他准备在发布会后单独和保险方签约，并把里奥的分成从四成压到一成。',
                '館長の未送信メール草稿には、公開後に保険会社と単独契約し、レオの取り分を四割から一割へ落とす計画が記されていた。',
                'An unsent draft from the curator shows he planned to sign alone with the insurer after the unveiling and cut Leo\'s share from forty percent to ten.'
            )
        }
    ],
    turns: [
        {
            weakPoints: [
                { id: 't1-wp-a', lineId: 't1-line-1', statement: t('昨天一整天都不在城里', '昨日一日じゅう市内にいなかった', 'I was out of the city all day yesterday'), evidenceId: 'ev-city-scan', consumeEvidenceOnUse: true },
                { id: 't1-wp-b', lineId: 't1-line-2', statement: t('那通电话不可能和我有关', 'あの電話は私と無関係だ', 'That call had nothing to do with me'), evidenceId: 'ev-chauffeur-call', consumeEvidenceOnUse: true },
                { id: 't1-fake-c', lineId: 't1-line-3', statement: t('运输单的鬼画符什么也证明不了', 'あの走り書きは何の証明にもならない', 'That scribble on the shipping slip proves nothing'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t1-line-1', {
                    zh: `先说清楚，我${encodeWeakPointMarker('t1-wp-a', '昨天一整天都不在城里')}。那场私人沙龙从午后一直拖到夜里，谁都能替我作证。`,
                    ja: `先に言っておくが、私は${encodeWeakPointMarker('t1-wp-a', '昨日一日じゅう市内にいなかった')}。あの招待制サロンは午後から夜まで続いていた。`,
                    en: `Let me be clear: ${encodeWeakPointMarker('t1-wp-a', 'I was out of the city all day yesterday')}. That invitation-only salon ran from afternoon until late night.`
                }),
                line('t1-line-2', {
                    zh: `馆长昨晚那通通讯我根本没接；${encodeWeakPointMarker('t1-wp-b', '那通电话不可能和我有关')}，我连终端都关了。`,
                    ja: `昨夜キュレーターからの通信には出ていない。${encodeWeakPointMarker('t1-wp-b', 'あの電話は私と無関係だ')}。端末ごと切っていた。`,
                    en: `I never answered the curator's call last night; ${encodeWeakPointMarker('t1-wp-b', 'that call had nothing to do with me')}. I had even shut my terminal down.`
                }),
                line('t1-line-3', {
                    zh: `真要说怪，只能怪运输单写得丑。${encodeWeakPointMarker('t1-fake-c', '运输单的鬼画符什么也证明不了')}。`,
                    ja: `気になるなら運送票の字が汚いことくらいだ。${encodeWeakPointMarker('t1-fake-c', 'あの走り書きは何の証明にもならない')}。`,
                    en: `If anything is odd, it is only the ugly shipping slip. ${encodeWeakPointMarker('t1-fake-c', 'That scribble on the shipping slip proves nothing')}.`
                }),
                line('t1-line-4', t(
                    '被你追问运输单后，值班保安补充说：司机确实在北门卸过样框，箱角还沾着一股甜到发腻的化学味。',
                    '運送票を追及すると、当直警備員は「運転手は北門で試作品の額を降ろした。箱の角には甘ったるい薬品臭が残っていた」と補足した。',
                    'Once pressed about the slip, the night guard adds that the driver did unload a sample frame at the north gate, and the crate corner carried an unusually sweet chemical smell.'
                ), { hidden: true, grantEvidenceIds: ['ev-solvent-report'] })
            ],
            queryNarratives: [
                t('先别急着信他那句“整天都不在城里”。绝对化的不在场最怕本地刷卡记录。', 'まず「一日じゅう市内にいなかった」という絶対表現を疑え。こういう言い切りは入退場ログに弱い。', 'Do not buy the “out of the city all day” claim yet. Absolute alibis crack first against local access logs.'),
                t('他主动把运输单贬得一文不值，反而像在提醒你那张纸背后还有别的信息。', '彼は運送票をわざと軽く扱っている。むしろその紙の裏に別の情報があると示しているようだ。', 'He is too eager to dismiss the shipping slip. That usually means the paper hides something else worth checking.')
            ],
            queryAvg: [
                avg('system', '审判庭回显：先核时间，再拆通讯。', '審判ログ：まず時間線、その次に通信だ。', 'Court log: pin down the timeline first, then break the call.'),
                avg('hero', '他把两个谎话挤在同一口气里，是想让我们只盯其中一个。', '嘘を一息で二つ重ねている。片方だけ見せたいのだろう。', 'He stacked two lies into one breath. He wants us to look at only one of them.')
            ],
            inspectOverrides: [
                {
                    weakPointId: 't1-fake-c',
                    narrative: t('你没有立刻出示证据，而是顺着运输单往下摸。里奥的语气第一次轻微发虚，像是担心你注意到北门那条回呼备注。', '証拠を出さずに運送票を追うと、レオの声色が初めて揺れた。北門への折り返しメモを見られたくないらしい。', 'Instead of firing back with evidence, you follow the shipping slip itself. Leo’s voice wavers for the first time, as if he does not want you seeing the callback note to the north gate.'),
                    avg: [
                        avg('enemy', '别盯着那张废纸看了，真正的贵客从不靠运送单做生意。', 'そんな紙切れを見るな。本当の客は運送票なんかで商売しない。', 'Stop staring at that scrap. Real clients do not conduct business through shipping slips.'),
                        avg('hero', '正因为你想把它说成废纸，我才更想知道它记录了谁的名字。', '紙切れだと言い張るからこそ、そこに誰の名前があるのか知りたくなる。', 'Exactly because you want to call it trash, I want to know whose name is on it.')
                    ],
                    grantEvidenceIds: ['ev-chauffeur-call'],
                    revealLineIds: ['t1-line-4']
                }
            ],
            successNarrative: t('你撬开了里奥在第一轮外壳上的一道缝。', 'レオの第一層の外殻に亀裂が入った。', 'You cracked open the first shell of Leo\'s story.'),
            successOverrides: [
                {
                    weakPointId: 't1-wp-a',
                    narrative: t('城门扫描把“整天都不在场”的包装当场撕碎。里奥昨夜不仅回了城，还回得相当从容。', '市門スキャンが「一日不在」という包装をその場で引き裂いた。レオは昨夜、余裕を持って戻ってきていた。', 'The city gate scan tears apart the “out all day” wrapper on the spot. Leo did return last night, and with plenty of margin.'),
                    avg: [
                        avg('hero', '21:17，你刷脸回城。你的不在场证明不是疏漏，是伪造。', '21:17、あなたは顔認証で市内へ戻った。不在証明は穴ではなく偽装だ。', 'At 21:17 you passed facial scan back into the city. Your alibi is not sloppy. It is fabricated.'),
                        avg('enemy', '回城不等于杀人。我有一百种理由回来。', '戻ったからといって殺したことにはならない。戻る理由なら百通りある。', 'Coming back does not equal murder. I had a hundred reasons to return.')
                    ]
                },
                {
                    weakPointId: 't1-wp-b',
                    narrative: t('通讯记录把“与我无关”钉死成笑话。里奥不仅接了电话，还亲自指挥司机绕过正门监控。', '通信記録は「無関係」という言葉を笑い話に変えた。レオは通話に出ただけでなく、運転手へ正面監視を避けろと指示している。', 'The call log turns “nothing to do with me” into a joke. Leo not only took the call, he told the driver to avoid the front-door cameras.'),
                    avg: [
                        avg('hero', '你在录音里亲口说“不要走正门监控”。这不是无关，这是调度。', '録音であなたは「正面監視を避けろ」と自分で言っている。無関係ではなく、采配だ。', 'On the recording you personally say, “Avoid the front-door cameras.” That is not unrelated. That is coordination.'),
                        avg('enemy', '……我只是怕贵客被拍到。', '……上客が撮られるのを嫌っただけだ。', '...I only did not want a premium client on camera.')
                    ]
                }
            ],
            useSeparateTurnClear: true,
            turnClearNarrative: t('时间线与电话线一起绞紧，里奥被迫从“完全不在场”退到“只是回来处理小事”。第一层保护壳已经碎了。', '時間線と通信線が同時に締まり、レオは「完全な不在」から「少し戻っただけ」へ後退した。第一の殻は砕けた。', 'The timeline and the call log tighten together, forcing Leo to retreat from “complete absence” to “I only came back briefly.” The first shell is gone.'),
            turnClearAvg: [
                avg('enemy', '好吧，我是回来过。但那只代表我想保住发布会。', 'いいだろう、戻りはした。だがそれは発表会を守りたかっただけだ。', 'Fine. I came back. That only means I wanted to protect the unveiling.'),
                avg('hero', '你越强调“保护”，越像是在替自己预留一个能碰画框的理由。', '守ると強調するほど、自分が額に触れた理由を先回りして用意しているように見える。', 'The more you stress “protection,” the more it sounds like you are preloading an excuse for touching the frame.'),
                avg('system', '系统提示：第二轮将转入接触痕迹与作案手法。', 'システム提示：第二ラウンドは接触痕跡と手口へ移行する。', 'System prompt: Round two will shift to contact traces and method.')
            ],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('里奥抓住你攻势里的空档，继续把自己包装成只会谈生意的旁观者。', 'レオは攻勢の隙を拾い、自分を商売人の傍観者として塗り直した。', 'Leo catches the gap in your push and repaints himself as a detached businessman.')),
            logicExplanation: t('先拆时间，再拆通讯。只要证明里奥昨夜回城且主动调度司机，他“整天都不在场”的说法就整段站不住。', '時間線と通信を連結すれば十分だ。昨夜戻ってきて運転手を自ら動かしたと示せば、「一日不在」は全体ごと崩れる。', 'The logic is simple: break the timeline and the call chain together. Once Leo is shown returning to the city and directing the driver, his all-day alibi collapses as one block.'),
            successAvg: [
                avg('hero', '漂亮的证词不值钱，能对上记录才值钱。', '綺麗な証言は価値がない。記録と噛み合う証言だけが価値を持つ。', 'A polished statement is worthless. Only one that matches the record has value.'),
                avg('enemy', '你只是拆掉了门面。里头的骨架还没碰到。', '壊したのは表面だけだ。中の骨格にはまだ触れていない。', 'You\'ve only cracked the storefront. You haven\'t touched the frame beneath it yet.')
            ],
            failAvg: failAvg([avg('enemy', '这点火花不足以烧穿我的外壳。', 'その程度の火花で私の殻は焼けない。', 'That spark is not enough to burn through my shell.')]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            weakPoints: [
                { id: 't2-wp-c', lineId: 't2-line-1', statement: t('我根本没碰过画框', '私は額縁に触れていない', 'I never touched the frame'), evidenceId: 'ev-frame-print', consumeEvidenceOnUse: true },
                { id: 't2-wp-d', lineId: 't2-line-2', statement: t('昨晚根本没人动过那瓶星陨溶剂', '昨夜は誰もあのスターフォール溶剤に触れていない', 'No one touched that bottle of Starfall solvent last night'), evidenceId: 'ev-solvent-report', consumeEvidenceOnUse: false },
                { id: 't2-fake-e', lineId: 't2-line-3', statement: t('货梯的模糊影子说明不了任何人', '貨物リフトのぼやけた影では誰も特定できない', 'That blurry freight-lift shadow identifies no one'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t2-line-1', {
                    zh: `我承认回过城，但${encodeWeakPointMarker('t2-wp-c', '我根本没碰过画框')}。真正接触外框的人只会是修复师。`,
                    ja: `戻ったことは認める。だが${encodeWeakPointMarker('t2-wp-c', '私は額縁に触れていない')}。外枠に触れたのは修復師だけだ。`,
                    en: `I admit I came back, but ${encodeWeakPointMarker('t2-wp-c', 'I never touched the frame')}. The only person handling the outer frame would have been the restorer.`
                }),
                line('t2-line-2', {
                    zh: `就算外框上有我的东西，那也是白天布展时留下的。${encodeWeakPointMarker('t2-wp-d', '昨晚根本没人动过那瓶星陨溶剂')}。`,
                    ja: `仮に私の痕跡が残っていても、昼の設営時だ。${encodeWeakPointMarker('t2-wp-d', '昨夜は誰もあのスターフォール溶剤に触れていない')}。`,
                    en: `Even if something of mine is on the frame, it would be from the daytime setup. ${encodeWeakPointMarker('t2-wp-d', 'No one touched that bottle of Starfall solvent last night')}.`
                }),
                line('t2-line-3', {
                    zh: `你们别把货梯监控想得太神。${encodeWeakPointMarker('t2-fake-e', '货梯的模糊影子说明不了任何人')}。`,
                    ja: `貨物リフトの監視を神格化するな。${encodeWeakPointMarker('t2-fake-e', '貨物リフトのぼやけた影では誰も特定できない')}。`,
                    en: `Do not deify the freight-lift footage. ${encodeWeakPointMarker('t2-fake-e', 'That blurry freight-lift shadow identifies no one')}.`
                }),
                line('t2-line-4', t(
                    '当两条真破绽都被击碎后，仓库抽屉里的未发送草稿被法警取出：馆长准备在发布会后把里奥的分成砍到只剩一成。',
                    '二つの真の弱点が崩れると、倉庫の引き出しから未送信の草稿が押収される。館長は公開後、レオの取り分を一割まで削るつもりだった。',
                    'Once both true weak points are broken, the bailiff retrieves an unsent draft from the storage drawer: the curator planned to cut Leo down to ten percent after the unveiling.'
                ), { hidden: true, unlockMode: 'allTrueWeakPoints', grantEvidenceIds: ['ev-betrayal-mail'] })
            ],
            queryNarratives: [
                t('这一轮真正要拆的是“有没有亲手操作”。指纹和溶剂，一个锁动作，一个锁时间。', 'このラウンドの焦点は「自分で手を出したか」だ。指紋は動作を、溶剤は時刻を固定する。', 'This round is about whether he physically handled it. The fingerprint locks the action. The solvent locks the time.'),
                t('他拿模糊监控转移视线，说明真正让他紧张的并不是影像，而是被影像掩住的化学痕迹。', '彼がぼやけた映像へ視線を逸らすのは、本当に怖いのが映像ではなく、その背後の化学痕跡だからだ。', 'He keeps pointing you at the blurry footage because what scares him is not the image. It is the chemical trace hidden behind it.')
            ],
            queryAvg: [avg('system', '系统提示：动作证据与时间证据要一起闭合。', 'システム提示：動作証拠と時間証拠を同時に閉じろ。', 'System prompt: close the action evidence and the timing evidence together.')],
            inspectOverrides: [],
            successNarrative: t('第二层防线裂了，里奥不得不承认自己不只是回来过，还亲手碰了那件赝作。', '第二の防壁が割れ、レオは「戻っただけ」では済まなくなった。彼自身が贋作へ手を出したと認めざるを得ない。', 'The second wall splits. Leo can no longer pretend he merely came back; he is forced toward admitting he touched the forgery himself.'),
            successOverrides: [
                {
                    weakPointId: 't2-wp-d',
                    narrative: t('溶剂报告让“昨晚没人碰过”这句证词瞬间老化。那股甜腻气味不是故事气氛，而是刚刚操作过赝作的化学回声。', '溶剤鑑定が「昨夜は誰も触れていない」を一気に劣化させた。あの甘い匂いは雰囲気ではなく、さっきまで贋作をいじっていた化学の残響だ。', 'The solvent report ages that line to dust. The sweet smell is not atmosphere; it is the chemical echo of recent work on the forgery.'),
                    avg: [
                        avg('hero', '只有你代理的修复工房会调这批溶剂，而且挥发窗口不到两小时。', 'この溶剤を調合できるのは、あなたが抱える修復工房だけだ。しかも揮発時間は二時間もない。', 'Only the restoration studio under your control mixes this solvent, and the active window is under two hours.'),
                        avg('enemy', '……那也只说明我让人处理过。', '……それでも私が誰かに触らせた可能性は残る。', '...At best that proves I had someone else handle it.')
                    ]
                }
            ],
            useSeparateTurnClear: false,
            turnClearNarrative: t('第二层防线裂了，里奥不得不承认自己不只是回来过，还亲手碰了那件赝作。', '第二の防壁が割れ、レオは「戻っただけ」では済まなくなった。彼自身が贋作へ手を出したと認めざるを得ない。', 'The second wall splits. Leo can no longer pretend he merely came back; he is forced toward admitting he touched the forgery himself.'),
            turnClearAvg: [
                avg('enemy', '你们只是在堆细节。没有动机，细节只是一地碎片。', '細部を積んでいるだけだ。動機がなければ、細部はただの破片にすぎない。', 'You are only stacking details. Without motive, details are just shards on the floor.'),
                avg('hero', '谢谢提醒。下一轮我正好要拆你的动机。', '忠告どうも。次のラウンドで、その動機を剥がす。', 'Thanks for the reminder. The next round is exactly where your motive comes apart.')
            ],
            useSeparateFailureReasons: true,
            failNarrative: {
                wrongEvidence: t('里奥冷笑着把错误证据推开，提醒全庭你还没有真正碰到他的动作链。', 'レオは誤った証拠を鼻で笑って退け、自分の動作連鎖にはまだ触れていないと全庭に示した。', 'Leo pushes the wrong exhibit aside with a cold laugh, reminding the court that you still have not touched his action chain.'),
                wrongStatement: t('他抓住你点错的句子，把本来已经危险的气氛重新缝回成“只是误会”。', '彼は選び違えた文を掴み、危うくなっていた空気を「ただの誤解」に縫い戻した。', 'He seizes on the wrong sentence and stitches the dangerous mood back into “just a misunderstanding.”'),
                bothWrong: t('这次节奏完全被里奥拿回去，他甚至开始替你总结什么叫“真正的鉴定流程”。', '今回は完全に主導権を奪い返され、レオは本物の鑑定手順とは何かまで講釈し始めた。', 'Leo takes the rhythm back completely and even starts lecturing you on what “real authentication procedure” is supposed to mean.')
            },
            logicExplanation: t('这轮要同时钉死“接触”与“时效”。指纹说明他亲手碰过外框，溶剂报告说明那次接触就发生在案发窗口。', 'このラウンドは「接触」と「時間効力」を同時に固定する。指紋が接触を示し、溶剤鑑定がその接触が事件時間帯であることを示す。', 'This round fixes both contact and timing. The fingerprint proves Leo touched the frame, and the solvent report proves that touch happened inside the incident window.'),
            successAvg: [
                avg('hero', '你不是站在一旁看热闹，你是亲手把赝作推进了最后一步。', 'あなたは見物人ではない。贋作を最後の一歩まで押し込んだ当人だ。', 'You were not watching from the side. You personally pushed the forgery through its final step.'),
                avg('enemy', '证据会说话，不代表故事只有一种写法。', '証拠が喋るからといって、物語の書き方が一つとは限らない。', 'Evidence may speak, but that does not mean there is only one way to write the story.')
            ],
            failAvg: {
                wrongEvidence: [avg('enemy', '证据不咬证据，它只会咬住使用它的人。', '証拠は証拠を噛まない。噛まれるのは使い手だ。', 'Evidence does not bite evidence. It bites the hand that uses it.')],
                wrongStatement: [avg('enemy', '先找准主句，再谈所谓的真相。', 'まず主文を見つけろ。それから真実を語れ。', 'Find the core sentence before you talk about truth.')],
                bothWrong: [avg('enemy', '这不是审判，是你在替我整理宣传词。', 'これは裁判ではない。君が私の宣伝文句を整理しているだけだ。', 'This is not a trial. You\'re just polishing my publicity copy.')]
            },
            failOverrides: {
                wrongEvidence: [
                    {
                        weakPointId: 't2-wp-d',
                        narrative: t('里奥顺势把无关证据贬成情绪化表演，试图把化学问题重新拖回口水仗。', 'レオは無関係な証拠を感情的な演出だと切り捨て、化学の争点を口喧嘩へ引き戻そうとした。', 'Leo dismisses the irrelevant exhibit as emotional theater, trying to drag the chemistry issue back into pure argument.'),
                        avg: [avg('enemy', '你拿错了东西，就别碰实验室的语言。', '物を取り違えたなら、実験室の言葉に触れるな。', 'If you brought the wrong item, stay out of laboratory language.')]
                    }
                ],
                wrongStatement: [],
                bothWrong: []
            },
            interferenceLines: []
        },
        {
            weakPoints: [
                { id: 't3-wp-f', lineId: 't3-line-1', statement: t('那份分成合同本来就是我们共同签的', 'あの分配契約はもともと共同署名だった', 'That split contract was always meant to be signed by both of us'), evidenceId: 'ev-betrayal-mail', consumeEvidenceOnUse: true },
                { id: 't3-wp-g', lineId: 't3-line-2', statement: t('我今天才第一次见那瓶星陨溶剂', '私は今日初めてそのスターフォール溶剤を見た', 'Today was the first time I ever saw that bottle of Starfall solvent'), evidenceId: 'ev-solvent-report', consumeEvidenceOnUse: false },
                { id: 't3-fake-h', lineId: 't3-line-3', statement: t('账本里的数字波动只是正常营销成本', '帳簿の数字の揺れは普通の宣伝費だ', 'The fluctuations in the ledger are just ordinary marketing costs'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t3-line-1', {
                    zh: `馆长从没想过甩开我。${encodeWeakPointMarker('t3-wp-f', '那份分成合同本来就是我们共同签的')}，我没有理由现在翻脸。`,
                    ja: `館長が私を切るはずがない。${encodeWeakPointMarker('t3-wp-f', 'あの分配契約はもともと共同署名だった')}。今さら裏切る理由はない。`,
                    en: `The curator was never going to cut me out. ${encodeWeakPointMarker('t3-wp-f', 'That split contract was always meant to be signed by both of us')}, so I had no reason to turn on him now.`
                }),
                line('t3-line-2', {
                    zh: `至于赝作表层的快速老化，${encodeWeakPointMarker('t3-wp-g', '我今天才第一次见那瓶星陨溶剂')}。你们不能把每一种味道都算到我头上。`,
                    ja: `贋作表面の急速老化については、${encodeWeakPointMarker('t3-wp-g', '私は今日初めてそのスターフォール溶剤を見た')}。匂いがあるたび私のせいにするな。`,
                    en: `As for the rapid aging on the forgery's surface, ${encodeWeakPointMarker('t3-wp-g', 'today was the first time I ever saw that bottle of Starfall solvent')}. You cannot pin every chemical scent in this city on me.`
                }),
                line('t3-line-3', {
                    zh: `账本上那些抖动的数字只是成本波动。${encodeWeakPointMarker('t3-fake-h', '账本里的数字波动只是正常营销成本')}。`,
                    ja: `帳簿の数字の揺れはただのコスト変動だ。${encodeWeakPointMarker('t3-fake-h', '帳簿の数字の揺れは普通の宣伝費だ')}。`,
                    en: `Those jumps in the ledger are only cost swings. ${encodeWeakPointMarker('t3-fake-h', 'The fluctuations in the ledger are just ordinary marketing costs')}.`
                })
            ],
            queryNarratives: [
                t('终局不再是“他可不可疑”，而是“动机与手法能否在同一时间闭合”。', '終局の問いは「怪しいか」ではなく、「動機と手口が同じ時間に閉じるか」だ。', 'The final question is no longer whether he looks suspicious. It is whether motive and method close at the same moment.'),
                t('如果分成草稿能证明他被踢出局，而溶剂报告又证明他亲手处理过赝作，那自白只剩一层皮。', '取り分草稿が切り捨てを示し、溶剤報告が贋作への直接処理を示せば、自白まで皮一枚だ。', 'If the draft proves he was being pushed out, and the solvent proves he handled the forgery himself, only a thin skin remains before confession.')
            ],
            queryAvg: [avg('system', '执行核心：闭合动机、手法与时间。', '実行コア：動機・手口・時間を閉じろ。', 'Execution core: close motive, method, and timing.')],
            inspectOverrides: [],
            successNarrative: t('最后一层话术开始塌陷。', '最後の話術が崩れ始めた。', 'The last layer of rhetoric starts to collapse.'),
            successOverrides: [],
            useSeparateTurnClear: false,
            turnClearNarrative: t('最后一层话术开始塌陷。', '最後の話術が崩れ始めた。', 'The last layer of rhetoric starts to collapse.'),
            turnClearAvg: [
                avg('hero', '时间、接触、动机，三条链终于闭上了。', '時間、接触、動機。三本の鎖がようやく閉じた。', 'Timeline, contact, motive. The three chains finally close.'),
                avg('enemy', '……', '……', '...')
            ],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('里奥仍在用腔调拖延时间，试图把真正的终局晚一点降临。', 'レオはまだ口調で時間を稼ぎ、本当の終幕を少しでも遅らせようとしている。', 'Leo is still buying time with style, trying to delay the real ending a little longer.')),
            logicExplanation: t('终局要闭合三件事：馆长要砍他的分成，所以他有动机；星陨溶剂说明他亲手处理过赝作，所以他有手法；前两轮的时间线则说明他有机会。', '終局では三つを閉じる。館長が取り分を削る予定だったから動機があり、スターフォール溶剤が本人の手口を示し、前二ラウンドの時間線が機会を示す。', 'The ending closes three links: the curator planned to cut his share, so he had motive; the Starfall solvent proves his method; and the first two rounds already proved his opportunity.'),
            successAvg: [
                avg('hero', '你不是被冤枉，而是被拆穿。', '君は冤罪ではない。見抜かれたのだ。', 'You were not framed. You were uncovered.'),
                avg('enemy', '……你们总算把那幅画看懂了。', '……ようやく君たちはあの絵を理解した。', '...So you finally learned how to read that painting.')
            ],
            failAvg: failAvg([avg('enemy', '终局最怕的不是沉默，是提前宣判。', '終局で怖いのは沈黙ではない。早すぎる断定だ。', 'The final phase fears not silence, but a verdict delivered too early.')]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: [
                t('错误警报：估值线程被污染。', 'エラー警報：評価スレッド汚染。', 'Error alert: valuation thread contaminated.'),
                t('弹窗噪声：来源伪装成保险端口。', 'ポップアップノイズ：保険ポートを装った発信源。', 'Popup noise: source masquerading as insurance port.'),
                t('视觉干扰：赝作纹理缓存溢出。', '視覚妨害：贋作テクスチャキャッシュ飽和。', 'Visual interference: forged texture cache overflow.')
            ]
        }
    ],
    victory: {
        narrative: t('分成邮件切开了动机，溶剂报告钉死了手法，时间线证明了机会。里奥终于承认，他先把真迹调包为赝作，再杀死馆长，试图把所有责任推给修复团队与保险流程。', '取り分メールが動機を裂き、溶剤鑑定が手口を固定し、時間線が機会を示した。レオはついに、本物を贋作へすり替えた後に館長を殺し、責任を修復班と保険手続きへ押しつけようとしたと認める。', 'The draft mail cut open the motive, the solvent report fixed the method, and the timeline proved the opportunity. Leo finally admits he swapped the original for a forgery, then killed the curator and tried to dump the blame onto the restoration team and the insurance process.'),
        confession: t('是，我回城了。我碰过画框，也碰过那瓶溶剂。馆长想把我从局里踢出去，连最后那点分成都不肯留给我。我先把真迹换掉，再让他死在以为自己赢定了的那个夜晚。这样一来，赝作和死人都会替我守口如瓶。', 'ああ、戻ったよ。額にも触ったし、あの溶剤にも触った。館長は私を局から追い出し、最後の取り分さえ残す気がなかった。だから先に本物をすり替え、勝った気でいたあの夜に奴を殺した。贋作と死人なら、私の秘密を守ってくれると思ったんだ。', 'Yes, I came back. I touched the frame, and I touched that solvent. The curator meant to cut me out and leave me nothing worth keeping. So I replaced the original first, and then I killed him on the night he believed he had already won. A forgery and a corpse keep secrets better than partners do.'),
        avg: [
            avg('enemy', '我以为只要把画换掉，所有人都会继续崇拜那个价格。', '絵さえ入れ替えれば、皆が価格そのものを崇拝し続けると思った。', 'I thought that if I replaced the painting, everyone would go on worshipping the price tag.'),
            avg('hero', '可你忘了，价格不会说谎，痕迹会。', 'だが忘れたな。値札は嘘をつかなくても、痕跡はもっと雄弁だ。', 'But you forgot something. Price tags do not testify. Traces do.'),
            avg('system', '判定完成：有罪。案件归档至《星陨赝作》。', '判定完了：有罪。案件は『スターフォール贋作事件』として保管される。', 'Judgment complete: Guilty. Case archived as Starfall Forgery.')
        ]
    }
};

const midnightAuction: LocalCaseData = {
    caseId: 'midnight-auction',
    caseTitle: t('午夜密拍', 'ミッドナイト・オークション', 'Midnight Auction'),
    defaultLang: 'zh',
    suspectName: t('档案经理卡伊', 'アーカイブ管理者カイ', 'Archive Manager Kai'),
    suspectEmoji: '',
    heroEmoji: '',
    intro: {
        narrative: t('卫星档案馆的密级目录在拍卖前夜被提前泄露。档案经理卡伊嘴上说自己只是在“守护流程”，可黑市买家的报价已经先一步流进城里。你要拆开他接触终端、传递情报与最终交付三段动作链。', '衛星アーカイブ館の機密目録は競売前夜に漏洩した。管理者カイは「手続きの保護」を口にするが、闇市場の買い手の見積もりは先に街へ流れ込んでいた。端末接触、情報伝達、最終受け渡しの三段連鎖を解体していく。', 'The classified catalog of the satellite archive leaked the night before auction. Archive manager Kai insists he was only “protecting procedure,” yet black-market bids were already flowing into the city. We need to tear apart his chain of terminal access, information transfer, and final delivery.'),
        systemMsg: t('调查分支更适合用来逼出隐藏台词和掉落证据；真正推进回合，仍要靠出示证据论破真破绽。', '調査分岐は隠し台詞や証拠の回収に向く。本当にラウンドを進めるのは、証拠を出して真の弱点を論破する時だ。', 'Use inspection branches to pry out hidden lines and bonus evidence. To truly advance the round, you still need to rebut real weak points with evidence.')
    },
    evidences: [
        { id: 'ev-terminal-log', aliases: ['终端日志', 'terminal'], startsInInventory: true, name: t('密档终端日志', '機密端末ログ', 'Secure Terminal Log'), detail: t('23:11，卡伊使用管理员身份打开了拍卖目录的最高级权限页，并下载了两份加密打包文件。', '23:11、カイは管理者権限で競売目録の最上位ページを開き、暗号化パックを二つ取得した。', 'At 23:11, Kai opened the top-level auction catalog page under administrator authority and downloaded two encrypted bundles.') },
        { id: 'ev-admin-badge', aliases: ['门禁卡', 'badge'], startsInInventory: true, name: t('冷库门禁刷卡记录', '冷蔵庫バッジ記録', 'Cold Vault Badge Log'), detail: t('00:18，只有卡伊的管理员胸卡刷开过冷库内门。访客与保洁卡在同一分钟全部失效。', '00:18、冷蔵庫の内扉を開いたのはカイの管理者バッジだけだった。訪問者と清掃カードは同時刻すべて無効化されている。', 'At 00:18, only Kai\'s administrator badge opened the inner vault door. Visitor and maintenance cards were all disabled at that minute.') },
        { id: 'ev-call-record', aliases: ['通话录音', 'call'], startsInInventory: false, name: t('屋外加密通话录音', '屋外暗号通話録音', 'Outdoor Encrypted Call'), detail: t('录音里，卡伊把两项密档编号逐个念给买家，并要求对方准备“零点三十分的屋顶接驳灯”。', '録音では、カイが二つの機密番号を順に読み上げ、相手へ「零時三十分の屋上受け渡し灯」を準備しろと告げている。', 'In the recording, Kai reads out two classified lot numbers and tells the buyer to prepare the rooftop relay light for 00:30.') },
        { id: 'ev-carbon-fiber', aliases: ['碳纤维粉', 'fiber'], startsInInventory: false, name: t('数据匣碳纤维碎屑', 'データカセット炭素繊維片', 'Data Cassette Carbon Fiber'), detail: t('数据匣边缘掉落的碳纤维碎屑，和卡伊外套袖口缝线使用的是同一批稀有织材。', 'データカセット端部の炭素繊維片は、カイのコート袖口の縫い糸と同じ希少素材だ。', 'The carbon-fiber flakes from the data cassette edge match the rare weave used in the seam at Kai’s coat cuff.') },
        { id: 'ev-bid-copy', aliases: ['竞价副本', 'bid copy'], startsInInventory: false, name: t('买家竞价副本', '買い手の入札副本', 'Buyer Bid Copy'), detail: t('黑市买家的报价副本里直接写着两件尚未公开的密档编号，底注注明“来源：K”。', '闇市場の買い手の入札副本には未公開の密档番号が二つ直書きされ、脚注に「Source: K」と残っている。', 'The buyer’s bid copy lists two unpublished archive numbers in plain text, with a note beneath them reading “Source: K.”') },
        { id: 'ev-rooftop-photo', aliases: ['屋顶照片', 'rooftop'], startsInInventory: false, name: t('屋顶接驳照片', '屋上受け渡し写真', 'Rooftop Relay Photo'), detail: t('屋顶长焦照片拍到卡伊在 00:31 抱着黑色数据匣站在信号灯旁，镜头边缘还能看到他胸牌的反光条。', '屋上の望遠写真には、00:31 に黒いデータカセットを抱えて信号灯の横に立つカイが写っている。端には彼のバッジ反射帯も映る。', 'A long-lens rooftop shot shows Kai at 00:31 holding a black data cassette beside the relay lamp. The reflective strip on his badge is visible at the edge.') }
    ],
    turns: [
        {
            weakPoints: [
                { id: 't1-wp-a', lineId: 't1-line-1', statement: t('我根本没碰过密档终端', '私は機密端末に触れていない', 'I never touched the secure terminal'), evidenceId: 'ev-terminal-log', consumeEvidenceOnUse: true },
                { id: 't1-wp-b', lineId: 't1-line-2', statement: t('那通电话只是问晚餐', 'あの電話は夕食の相談だ', 'That call was only about dinner'), evidenceId: 'ev-call-record', consumeEvidenceOnUse: true },
                { id: 't1-fake-c', lineId: 't1-line-3', statement: t('拍卖清单上的编号差错只是秘书手滑', '目録番号のズレは秘書の入力ミスだ', 'The numbering mismatch on the auction list was just a secretary typo'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t1-line-1', { zh: `我昨晚只是在巡检机房。${encodeWeakPointMarker('t1-wp-a', '我根本没碰过密档终端')}。`, ja: `昨夜は機械室を巡回していただけだ。${encodeWeakPointMarker('t1-wp-a', '私は機密端末に触れていない')}。`, en: `I was only patrolling the server room last night. ${encodeWeakPointMarker('t1-wp-a', 'I never touched the secure terminal')}.` }),
                line('t1-line-2', { zh: `你们抓到的那通加密电话不值一提，${encodeWeakPointMarker('t1-wp-b', '那通电话只是问晚餐')}。`, ja: `拾われた暗号通話など大したことはない。${encodeWeakPointMarker('t1-wp-b', 'あの電話は夕食の相談だ')}。`, en: `That encrypted phone call you found is meaningless; ${encodeWeakPointMarker('t1-wp-b', 'that call was only about dinner')}.` }),
                line('t1-line-3', { zh: `要是目録编号对不上，那也是秘书手滑。${encodeWeakPointMarker('t1-fake-c', '拍卖清单上的编号差错只是秘书手滑')}。`, ja: `目録番号がずれていたなら秘書の入力ミスだ。${encodeWeakPointMarker('t1-fake-c', '目録番号のズレは秘書の入力ミスだ')}。`, en: `If the auction numbers do not line up, that is a secretary typo. ${encodeWeakPointMarker('t1-fake-c', 'The numbering mismatch on the auction list was just a secretary typo')}.` }),
                line('t1-line-4', t('你追着编号往下查，监听记录随之浮出水面，连同一段被卡伊删过又恢复的屋外通话。', '番号を追うと傍受ログが浮かび上がり、カイが削除していた屋外通話も復元された。', 'Following the number trail surfaces the intercept logs, along with an outdoor call Kai deleted and later restored.'), { hidden: true, grantEvidenceIds: ['ev-carbon-fiber'] })
            ],
            queryNarratives: [
                t('第一轮先锁定“接触终端”这件事。只要这层否认破了，电话就不再是闲聊。', '第一ラウンドは「端末接触」を固定する。そこが割れれば、電話は世間話では済まない。', 'Round one is about terminal contact. Once that denial breaks, the call is no longer casual chatter.'),
                t('他故意把编号问题说成秘书手滑，像是在引你去翻那份被动过的清单。', '彼は番号問題を秘書のミスに矮小化している。むしろ触られた目録を見ろという合図だ。', 'He keeps shrinking the numbering issue into a clerical slip. That usually means you should look harder at the tampered list.')
            ],
            queryAvg: [avg('hero', '一旦终端接触成立，后面的“只是路过”都会一起掉价。', '端末接触が確定した瞬間、その先の「ただ通りかかっただけ」は全部安くなる。', 'Once terminal access is proven, every later “I was only passing by” becomes cheap.')],
            inspectOverrides: [{ weakPointId: 't1-fake-c', narrative: t('你没有急着论破，而是顺着编号差错继续摸排。结果不是秘书，而是卡伊自己留下的删除痕迹。', 'すぐに論破せず番号のズレを追うと、出てきたのは秘書ではなくカイ本人の削除痕跡だった。', 'Instead of rebutting at once, you keep following the numbering mismatch. What surfaces is not a secretary mistake but Kai’s own deletion trail.'), avg: [avg('system', '审讯附记：恢复屋外加密通话。', '尋問付記：屋外暗号通話を復元。', 'Interrogation note: restoring outdoor encrypted call.'), avg('enemy', '……你们连那条都捞出来了？', '……あれまで掘り出したのか？', '...You dragged even that one back out?')], grantEvidenceIds: ['ev-call-record'], revealLineIds: ['t1-line-4'] }],
            successNarrative: t('卡伊的第一层镇定被撬开了。', 'カイの第一層の平静がこじ開けられた。', 'Kai’s first layer of composure is pried open.'),
            successOverrides: [],
            useSeparateTurnClear: false,
            turnClearNarrative: t('卡伊的第一层镇定被撬开了。', 'カイの第一層の平静がこじ開けられた。', 'Kai’s first layer of composure is pried open.'),
            turnClearAvg: [avg('enemy', '就算我看过终端，也不代表我卖过任何东西。', '端末を見たからといって、何かを売った証明にはならない。', 'Even if I checked the terminal, that proves I sold nothing.')],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('卡伊把错误的进攻轻轻拨开，像是在提醒你他真正害怕的不是气势，而是链条。', 'カイは誤った攻めを軽く払う。彼が恐れるのは勢いではなく、鎖の完成だと示すように。', 'Kai brushes off the wrong attack lightly, as if reminding you that what he fears is not force but a completed chain.')),
            logicExplanation: t('第一轮先证明卡伊亲手打开过密档终端，再用恢复出来的通话说明他把目录编号主动传了出去。', '第一ラウンドでは、まずカイが機密端末を自分で開いたことを示し、その後復元通話で目録番号を外へ流したと示す。', 'Round one proves Kai personally opened the secure terminal, then uses the restored call to show he actively sent the catalog numbers out.'),
            successAvg: [avg('hero', '终端和电话都开过口了，你的“只是巡检”已经不值钱。', '端末も電話も口を開いた。君の「巡回していただけ」はもう値を持たない。', 'The terminal and the call have both spoken. Your “routine patrol” story has no value left.')],
            failAvg: failAvg([avg('enemy', '你要的不是答案，你要的是顺序。可你还没排好。', '欲しいのは答えではなく順序だろう。だが君はまだ並べ替えられていない。', 'What you need is not merely an answer. You need the right order, and you do not have it yet.')]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            weakPoints: [
                { id: 't2-wp-d', lineId: 't2-line-1', statement: t('我没有踏进冷库', '私は冷蔵庫に入っていない', 'I never stepped into the cold vault'), evidenceId: 'ev-admin-badge', consumeEvidenceOnUse: false },
                { id: 't2-wp-e', lineId: 't2-line-2', statement: t('那些碳纤维碎屑到处都是', 'あの炭素繊維片はどこにでもある', 'Those carbon-fiber flakes are everywhere'), evidenceId: 'ev-carbon-fiber', consumeEvidenceOnUse: true },
                { id: 't2-fake-f', lineId: 't2-line-3', statement: t('屋顶中继灯昨晚压根没亮', '屋上中継灯は昨夜そもそも点いていない', 'The rooftop relay light never even came on last night'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t2-line-1', { zh: `冷库那边昨晚封得死死的，${encodeWeakPointMarker('t2-wp-d', '我没有踏进冷库')}。`, ja: `冷蔵庫側は昨夜完全封鎖だった。${encodeWeakPointMarker('t2-wp-d', '私は冷蔵庫に入っていない')}。`, en: `The cold vault side was fully sealed last night. ${encodeWeakPointMarker('t2-wp-d', 'I never stepped into the cold vault')}.` }),
                line('t2-line-2', { zh: `至于数据匣边缘那点碳纤维，${encodeWeakPointMarker('t2-wp-e', '那些碳纤维碎屑到处都是')}。`, ja: `データカセットの端の炭素繊維なんて、${encodeWeakPointMarker('t2-wp-e', 'あの炭素繊維片はどこにでもある')}。`, en: `As for the carbon-fiber residue on the cassette edge, ${encodeWeakPointMarker('t2-wp-e', 'those carbon-fiber flakes are everywhere')}.` }),
                line('t2-line-3', { zh: `你们若想扯屋顶中继灯，那也是白费力气。${encodeWeakPointMarker('t2-fake-f', '屋顶中继灯昨晚压根没亮')}。`, ja: `屋上中継灯の話をしたいなら、それこそ無駄だ。${encodeWeakPointMarker('t2-fake-f', '屋上中継灯は昨夜そもそも点いていない')}。`, en: `If you want to talk about the rooftop relay light, that is wasted effort. ${encodeWeakPointMarker('t2-fake-f', 'The rooftop relay light never even came on last night')}.` }),
                line('t2-line-4', t('当两条真破绽都被击碎后，搜查员从卡伊的私人抽屉里找到一份黑市买家的竞价副本。', '二つの真の弱点が砕けると、捜査員はカイの私物引き出しから闇市場の買い手の入札副本を見つける。', 'Once both true weak points break, investigators recover a buyer bid copy from Kai’s private drawer.'), { hidden: true, unlockMode: 'allTrueWeakPoints', grantEvidenceIds: ['ev-bid-copy'] })
            ],
            queryNarratives: [t('第二轮要把“拿过密档”和“把密档带离冷库”连起来。门禁固定路线，纤维固定接触。', '第二ラウンドは「密档を触った」から「冷蔵庫外へ持ち出した」まで繋ぐ。バッジが経路を、繊維が接触を固定する。', 'Round two connects touching the archive to carrying it out of the vault. The badge fixes the route, and the carbon fiber fixes the contact.'), t('如果他主动提起屋顶灯，大概率是因为真正能致命的不是灯，而是灯下的交付动作。', '彼が自分から屋上灯を口にするなら、恐れているのは灯そのものではなく、灯の下の受け渡し動作だ。', 'If he brings up the rooftop light on his own, what frightens him is not the lamp itself but the handoff under it.')],
            queryAvg: [avg('hero', '路线、接触、交付，三节链条一旦接起来，他就没有退路。', '経路、接触、受け渡し。この三節が繋がれば逃げ場はない。', 'Route, contact, handoff. Once those three links connect, he has nowhere left to retreat.')],
            inspectOverrides: [{ weakPointId: 't2-fake-f', narrative: t('你顺着中继灯去查，屋顶维护相册果然补上了那一分钟的空白。', '中継灯を追うと、屋上保守アルバムがその一分の空白を埋めた。', 'Following the relay light leads you to the rooftop maintenance album, which fills in the missing minute.'), avg: [avg('system', '系统回收：屋顶长焦照片一张。', 'システム回収：屋上望遠写真を一枚確保。', 'System recovery: one rooftop long-lens photo secured.')], grantEvidenceIds: ['ev-rooftop-photo'], revealLineIds: [] }],
            successNarrative: t('卡伊开始从“只是看过目录”后退到“只是被流程推着走”。', 'カイは「目録を見ただけ」から「手続きに流された」へ後退し始める。', 'Kai begins retreating from “I only saw the catalog” to “I was merely pushed by the procedure.”'),
            successOverrides: [],
            useSeparateTurnClear: false,
            turnClearNarrative: t('卡伊开始从“只是看过目录”后退到“只是被流程推着走”。', 'カイは「目録を見ただけ」から「手続きに流された」へ後退し始める。', 'Kai begins retreating from “I only saw the catalog” to “I was merely pushed by the procedure.”'),
            turnClearAvg: [avg('enemy', '你们还缺最后一步。谁说我真的把东西交出去了？', 'まだ最後の一歩が欠けている。私が本当に渡したと誰が言える？', 'You\'re still missing the last step. Who says I actually handed anything over?')],
            useSeparateFailureReasons: true,
            failNarrative: {
                wrongEvidence: t('卡伊把错误证据轻轻拨开，继续强调“流程”二字。', 'カイは誤った証拠を退け、「手続き」を繰り返し強調した。', 'Kai pushes away the wrong exhibit and goes right back to chanting “procedure.”'),
                wrongStatement: t('他抓住你点错的句子，重新把自己包回管理者的制服里。', '選び違えた文を掴み、彼は再び管理者の制服へ身を包み直した。', 'He seizes on the wrong sentence and wraps himself back into his manager uniform.'),
                bothWrong: t('这一击打空后，卡伊甚至替你解释起什么叫“标准保密流程”。', 'この一撃が空振りすると、カイは標準秘匿手順まで講義し始めた。', 'After that miss, Kai starts lecturing you on what “standard confidentiality procedure” means.')
            },
            logicExplanation: t('要闭合第二轮，就必须证明卡伊既能打开冷库，也亲手碰过数据匣。门禁给出路径，纤维给出手部接触。', '第二ラウンドを閉じるには、カイが冷蔵庫を開けられ、かつデータカセットへ自分で触れたことを示す必要がある。バッジが経路を、繊維が手の接触を示す。', 'To close round two, we must prove Kai both accessed the cold vault and physically handled the cassette. The badge log gives the route. The carbon fiber gives the hand contact.'),
            successAvg: [avg('hero', '你不是被流程推着走，你是在借流程遮住自己的手。', '手続きに流されたのではない。手続きを盾にして自分の手を隠しただけだ。', 'You were not pushed by procedure. You used procedure as a shield to hide your own hands.')],
            failAvg: {
                wrongEvidence: [avg('enemy', '拿错钥匙就别抱怨门打不开。', '鍵を取り違えておいて、扉が開かないと文句を言うな。', 'Do not complain that the door will not open if you brought the wrong key.')],
                wrongStatement: [avg('enemy', '连主句都没抓住，就别奢望抓住我。', '主文すら掴めないなら、私を掴めるわけがない。', 'If you cannot catch the main sentence, you will not catch me.')],
                bothWrong: [avg('enemy', '漂亮的气势抵不上一次正确的接入。', '綺麗な勢いは、一度の正しい接続にも勝てない。', 'A dramatic push is worth less than a single correct connection.')]
            },
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            weakPoints: [
                { id: 't3-wp-g', lineId: 't3-line-1', statement: t('那份竞价副本不是我泄露出去的', 'あの入札副本を漏らしたのは私ではない', 'I was not the one who leaked that bid copy'), evidenceId: 'ev-bid-copy', consumeEvidenceOnUse: true },
                { id: 't3-wp-h', lineId: 't3-line-2', statement: t('屋顶照片里的人影不可能是我', '屋上写真の影は私ではあり得ない', 'The figure in the rooftop photo cannot be me'), evidenceId: 'ev-rooftop-photo', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t3-line-1', { zh: `黑市买家的报价副本是别人伪造来栽我的，${encodeWeakPointMarker('t3-wp-g', '那份竞价副本不是我泄露出去的')}。`, ja: `闇市場の入札副本は誰かが私を嵌めるために作った偽物だ。${encodeWeakPointMarker('t3-wp-g', 'あの入札副本を漏らしたのは私ではない')}。`, en: `That buyer bid copy was forged by someone trying to frame me; ${encodeWeakPointMarker('t3-wp-g', 'I was not the one who leaked that bid copy')}.` }),
                line('t3-line-2', { zh: `就算屋顶灯真的亮过，${encodeWeakPointMarker('t3-wp-h', '屋顶照片里的人影不可能是我')}。`, ja: `仮に屋上灯が点いていたとしても、${encodeWeakPointMarker('t3-wp-h', '屋上写真の影は私ではあり得ない')}。`, en: `Even if the rooftop light really came on, ${encodeWeakPointMarker('t3-wp-h', 'the figure in the rooftop photo cannot be me')}.` })
            ],
            queryNarratives: [t('终局要把“传出去”和“亲手交出去”接成同一条线。', '終局では「漏らした」と「自分で渡した」を一本の線へ繋ぐ。', 'The endgame joins “leaked it” and “handed it over personally” into the same line.'), t('他想把泄密变成抽象概念，你要把它重新拉回到他的身体动作上。', '彼は漏洩を抽象概念にしたがる。こちらはそれを身体動作へ引き戻す。', 'He wants the leak to remain abstract. We need to drag it back into a concrete physical act.')],
            queryAvg: [avg('system', '终局校验：锁定交付动作。', '終局検証：受け渡し動作を固定。', 'Final verification: lock the handoff action.')],
            inspectOverrides: [],
            successNarrative: t('卡伊嘴上的“流程”终于裂成了交易。', 'カイの口にあった「手続き」は、ついに取引へ裂けた。', 'Kai\'s talk of “procedure” finally tears open into a transaction.'),
            successOverrides: [],
            useSeparateTurnClear: false,
            turnClearNarrative: t('卡伊嘴上的“流程”终于裂成了交易。', 'カイの口にあった「手続き」は、ついに取引へ裂けた。', 'Kai\'s talk of “procedure” finally tears open into a transaction.'),
            turnClearAvg: [avg('hero', '目录是你看见的，价格是你念出去的，数据匣也是你抱上屋顶的。', '目録を見たのは君で、価格を読み上げたのも君で、カセットを屋上へ運んだのも君だ。', 'You saw the catalog, you read out the prices, and you carried the cassette to the roof.')],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('终局近在眼前，卡伊却还试着把自己的动作洗成“流程的惯性”。', '終局は目の前だが、カイはまだ自分の動作を「手続きの慣性」に洗い替えようとしている。', 'The ending is within reach, yet Kai still tries to wash his acts into “procedural inertia.”')),
            logicExplanation: t('竞价副本证明目录编号是他泄出去的，屋顶照片证明他亲自把数据匣带到了交付点。信息外流与实体交付在他身上闭合。', '入札副本が番号漏洩を示し、屋上写真がカセット搬送を示す。情報流出と物理受け渡しがカイの上で閉じる。', 'The bid copy proves he leaked the numbers, and the rooftop photo proves he personally carried the cassette to the handoff point. The information leak and physical delivery close on Kai.'),
            successAvg: [avg('enemy', '……我只是比他们先承认，档案本来就会被卖掉。', '……私はただ、あの档案がいずれ売られると誰より先に認めただけだ。', '...I merely admitted before anyone else that those archives were always going to be sold.'), avg('hero', '不，你不是承认现实。你是在提前兑现它。', '違う。現実を認めたのではない。先に換金しただけだ。', 'No. You did not admit reality. You cashed it in early.')],
            failAvg: failAvg([avg('enemy', '最后一步最怕的不是压力，是急躁。', '最後の一歩で怖いのは圧力ではなく焦りだ。', 'The final step fears impatience more than pressure.')]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: [t('信号噪声：屋顶端口重复握手。', '信号ノイズ：屋上ポートが再ハンドシェイク。', 'Signal noise: rooftop port repeating handshake.'), t('系统抖动：竞价缓存重放。', 'システム揺れ：入札キャッシュ再生。', 'System jitter: bid cache replay.'), t('警告：非法中继设备尝试覆写画面。', '警告：不正中継装置が画面の上書きを試行。', 'Warning: illegal relay device attempting screen overwrite.')]
        }
    ],
    victory: {
        narrative: t('终端日志、加密通话、门禁记录、屋顶照片，四段链条前后扣死。卡伊承认自己提前把密级目录卖给买家，再趁夜把数据匣带到屋顶，准备以“流程事故”做掩护。', '端末ログ、暗号通話、バッジ記録、屋上写真。四つの鎖が前後から噛み合った。カイは機密目録を事前に売り、夜のうちにデータカセットを屋上へ運び、「手続き事故」で隠すつもりだったと認める。', 'The terminal log, encrypted call, badge record, and rooftop photo lock together from both ends. Kai admits he sold the classified catalog in advance, then carried the cassette to the roof at night and planned to hide it under the cover of a “procedural accident.”'),
        confession: t('是，我卖了目录。那些档案迟早会被更有钱的人拿走，我只是抢在制度开口前先开价。等屋顶灯亮起，数据匣一交出去，谁都会把责任推给一场失误。我差一点就成功了。', 'ああ、目録は売った。あの档案は遅かれ早かれ、もっと金を持つ誰かに奪われる。私は制度が値札をつける前に先に値をつけただけだ。屋上灯が点けば、カセットを渡した瞬間に責任は事故へ押しつけられた。あと少しだった。', 'Yes, I sold the catalog. Those archives would have been taken by someone richer sooner or later. I merely named the price before the institution could. Once the rooftop light came on and the cassette changed hands, everyone would have called it an accident. I was almost there.'),
        avg: [avg('enemy', '档案不是历史，它们只是还没被标价的商品。', '档案は歴史ではない。まだ値札のついていない商品だ。', 'Archives are not history. They are only goods that have not been priced yet.'), avg('hero', '而你把保管变成了拍卖，把职责变成了通道。', '君は保管を競売に変え、職責を通路に変えた。', 'And you turned custody into auction, and duty into a corridor.'), avg('system', '判定完成：有罪。案件归档至《午夜密拍》。', '判定完了：有罪。案件は『ミッドナイト・オークション』として保管される。', 'Judgment complete: Guilty. Case archived as Midnight Auction.')]
    }
};

const hollowWard: LocalCaseData = {
    caseId: 'hollow-ward-protocol',
    caseTitle: t('空病区协议', 'ホロウ・ワード・プロトコル', 'Hollow Ward Protocol'),
    defaultLang: 'zh',
    suspectName: t('临床主任薇恩', '臨床主任ヴェイン', 'Clinical Director Vane'),
    suspectEmoji: '',
    heroEmoji: '',
    intro: {
        narrative: t('封闭病区的主治研究员死在低温药柜前，所有监控都被剪成了“正常值班”的模样。临床主任薇恩面无表情地站在证词中央，声称自己一整夜都在遵守流程。你要拆开她的值班动线、接触痕迹，以及她替试验项目伪造过的每一枚签字。', '閉鎖病棟の主任研究員は低温薬庫の前で死亡し、監視映像はすべて「通常当直」に見えるよう切られていた。臨床主任ヴェインは無表情のまま、自分は一晩中手順を守っていただけだと語る。勤務動線、接触痕跡、そして試験計画の偽造署名を剥がしていく。', 'The lead researcher of the sealed ward died in front of the cryogenic medicine cabinet, and every camera feed was cut to look like routine duty. Clinical Director Vane claims she spent the entire night following protocol. We need to break apart her route, her contact traces, and the signatures she forged for the trial.'),
        systemMsg: t('调查分支既可以逼出隐藏台词，也可以掉落新证据。真正的推进仍然依赖把证据对准正确的破绽。', '調査分岐は隠し台詞も新証拠も引き出せる。ただし前進そのものは、証拠を正しい弱点へ合わせた時に起こる。', 'Inspection branches can pull out hidden lines and new evidence. Progress still depends on matching the right evidence to the right weak point.')
    },
    evidences: [
        { id: 'ev-shift-roster', aliases: ['值班表', 'roster'], startsInInventory: true, name: t('夜班排班表', '夜勤シフト表', 'Night Shift Roster'), detail: t('值班表显示薇恩在 22:40 至 23:10 之间应在四层隔离站签字巡查，但她的签名栏是空白。', 'シフト表では、ヴェインは 22:40 から 23:10 まで四階隔離ステーションを巡回署名するはずだったが、その署名欄は空白だ。', 'The shift roster shows Vane was supposed to sign her rounds on the fourth-floor isolation station from 22:40 to 23:10, but that signature field is blank.') },
        { id: 'ev-elevator-thermal', aliases: ['电梯热图', 'thermal'], startsInInventory: true, name: t('隔离电梯热成像', '隔離エレベーター熱画像', 'Isolation Lift Thermal Log'), detail: t('23:02，隔离电梯里留下单人热影，体型与薇恩一致，目的楼层为低温药柜所在的二层。', '23:02、隔離エレベーターに単独の熱影が残り、体格はヴェインと一致する。目的階は低温薬庫のある二階だった。', 'At 23:02, the isolation lift captured a single thermal silhouette matching Vane’s build. The destination floor was level two, where the cryogenic cabinet sits.') },
        { id: 'ev-voice-memo', aliases: ['语音备忘', 'memo'], startsInInventory: false, name: t('被删除的语音备忘', '削除された音声メモ', 'Deleted Voice Memo'), detail: t('恢复出的语音里，薇恩说：“把试验批次提到今晚之前，签字我来补。”死者在背景里明确反对。', '復元された音声でヴェインは「試験ロットを今夜前倒しにして。署名は私が埋める」と言っており、被害者は背景で明確に反対している。', 'In the recovered voice memo, Vane says, “Move the trial batch up to tonight. I’ll fill in the signature myself.” The victim objects clearly in the background.') },
        { id: 'ev-glove-trace', aliases: ['手套痕', 'glove'], startsInInventory: false, name: t('无菌手套树脂痕', '滅菌手袋の樹脂痕', 'Sterile Glove Resin Trace'), detail: t('药柜把手上的透明树脂与薇恩办公室专用无菌手套完全同批。树脂仍处在未完全固化状态，接触时间不超过一小时。', '薬庫の取っ手に残る透明樹脂は、ヴェインの執務室専用の滅菌手袋と同ロットだった。樹脂はまだ完全硬化しておらず、接触は一時間以内だ。', 'The clear resin on the cabinet handle comes from the same lot as the sterile gloves reserved for Vane’s office. The resin was still curing, placing the contact within one hour.') },
        { id: 'ev-trial-order', aliases: ['试验单', 'order'], startsInInventory: false, name: t('伪造试验指令单', '偽造試験指令書', 'Forged Trial Order'), detail: t('指令单把原本定在下周的试验批次提前到案发当晚，签名栏里死者的笔迹存在明显叠描。', '指令書は来週予定だった試験ロットを事件当夜へ前倒ししており、被害者の署名欄には明らかななぞり書きがある。', 'The order advances a trial batch originally scheduled for next week to the night of the incident, and the victim’s signature field shows obvious tracing.') },
        { id: 'ev-sponsor-transfer', aliases: ['转账单', 'transfer'], startsInInventory: false, name: t('赞助方转账回执', 'スポンサー送金控え', 'Sponsor Transfer Receipt'), detail: t('赞助方在案发前两小时向薇恩个人账户打入一笔“紧急推进费”，备注为“批次提前确认”。', 'スポンサーは事件二時間前、ヴェイン個人口座へ「緊急前倒し費」を送金していた。備考は「ロット前倒し確認」。', 'Two hours before the incident, the sponsor wired Vane’s personal account an “urgent acceleration fee,” annotated as “batch advancement confirmed.”') }
    ],
    turns: [
        {
            weakPoints: [
                { id: 't1-wp-a', lineId: 't1-line-1', statement: t('我整晚都在三层护士站', '私は一晩中三階ナースステーションにいた', 'I spent the whole night at the third-floor nurse station'), evidenceId: 'ev-shift-roster', consumeEvidenceOnUse: true },
                { id: 't1-wp-b', lineId: 't1-line-2', statement: t('那段语音里的签字和我无关', 'あの音声の署名の話は私と無関係だ', 'The signature mentioned in that audio has nothing to do with me'), evidenceId: 'ev-voice-memo', consumeEvidenceOnUse: true },
                { id: 't1-fake-c', lineId: 't1-line-3', statement: t('低温药柜今晚不会有人碰', '今夜は誰も低温薬庫に触れない', 'No one would touch the cryogenic cabinet tonight'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t1-line-1', { zh: `值班记录很清楚，${encodeWeakPointMarker('t1-wp-a', '我整晚都在三层护士站')}。`, ja: `当直記録は明白だ。${encodeWeakPointMarker('t1-wp-a', '私は一晩中三階ナースステーションにいた')}。`, en: `The duty record is perfectly clear: ${encodeWeakPointMarker('t1-wp-a', 'I spent the whole night at the third-floor nurse station')}.` }),
                line('t1-line-2', { zh: `至于你们说的那段恢复语音，${encodeWeakPointMarker('t1-wp-b', '那段语音里的签字和我无关')}。`, ja: `復元された音声については、${encodeWeakPointMarker('t1-wp-b', 'あの音声の署名の話は私と無関係だ')}。`, en: `As for that recovered audio, ${encodeWeakPointMarker('t1-wp-b', 'the signature mentioned in that audio has nothing to do with me')}.` }),
                line('t1-line-3', { zh: `而且药柜区域今晚根本不会有人靠近。${encodeWeakPointMarker('t1-fake-c', '低温药柜今晚不会有人碰')}。`, ja: `それに今夜、薬庫区域へ誰も近づかない。${encodeWeakPointMarker('t1-fake-c', '今夜は誰も低温薬庫に触れない')}。`, en: `And no one was even supposed to approach the cabinet zone tonight. ${encodeWeakPointMarker('t1-fake-c', 'No one would touch the cryogenic cabinet tonight')}.` }),
                line('t1-line-4', t('你顺着药柜问题往下查，恢复出的执勤语音和一袋被她偷偷丢掉的无菌手套同时浮出水面。', '薬庫の話を追うと、復元された当直音声と、彼女が密かに捨てた滅菌手袋の袋が同時に浮上した。', 'Following the cabinet angle surfaces both the recovered duty memo and a sterile glove pouch she tried to discard.'), { hidden: true, grantEvidenceIds: ['ev-glove-trace'] })
            ],
            queryNarratives: [t('第一轮先打破她“整晚都在岗位上”的外壳。只要位置和语音同时脱轨，她的流程脸就会裂开。', '第一ラウンドは「一晩中定位置にいた」という殻を破る。位置と音声が同時に外れれば、手順の顔は割れる。', 'Round one breaks the shell of her “I stayed at my station all night” claim. Once location and audio drift apart together, her procedural mask cracks.'), t('她主动提“药柜不会有人碰”，像是在提前封你通往接触证据的路。', '彼女が自分から「薬庫には誰も触れない」と言うのは、接触証拠への道を先回りで塞ぎたいからだ。', 'The fact that she volunteers “no one would touch the cabinet” sounds like a preemptive wall against contact evidence.')],
            queryAvg: [avg('hero', '她说话像写病历，每一句都想把风险埋成术语。', '彼女の話し方はカルテみたいだ。危険を全部用語に埋めようとしている。', 'She speaks like she writes charts, burying risk under terminology.')],
            inspectOverrides: [{ weakPointId: 't1-fake-c', narrative: t('你把“不会有人碰药柜”这句话往下追，果然摸出一段被删除的工作语音。', '「誰も薬庫に触れない」を追うと、削除された業務音声が出てきた。', 'You push on “no one would touch the cabinet,” and a deleted work memo surfaces exactly where it should.'), avg: [avg('system', '系统回收：删除语音已恢复。', 'システム回収：削除音声を復元。', 'System recovery: deleted voice memo restored.')], grantEvidenceIds: ['ev-voice-memo'], revealLineIds: ['t1-line-4'] }],
            successNarrative: t('薇恩“整夜守规”的第一层面具被掀开。', 'ヴェインの「一晩中手順通り」の仮面、その第一層が剥がれた。', 'The first layer of Vane’s “I followed protocol all night” mask comes off.'),
            successOverrides: [],
            useSeparateTurnClear: true,
            turnClearNarrative: t('位置与语音双双脱轨，薇恩不得不从“完全守规”退到“只是替项目补洞”。', '位置も音声も外れ、ヴェインは「完全に手順通り」から「プロジェクトの穴埋めをしただけ」へ後退するしかなくなった。', 'Both location and audio slip at once, forcing Vane to retreat from “perfect compliance” to “I merely patched a project gap.”'),
            turnClearAvg: [avg('enemy', '就算我补过签字，那也是为了不让项目停摆。', '仮に私が署名を埋めたとしても、プロジェクト停止を防ぐためだ。', 'Even if I did fill a signature, that was only to stop the project from stalling.'), avg('hero', '很好，既然你承认“补”，下一轮就来看你补到了什么程度。', 'いいだろう。「埋めた」と認めたなら、次はどこまで手を出したかを見る。', 'Good. Since you admit to “filling in,” the next round will show how far your hand actually went.')],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('薇恩把你的失误重新压回术语堆里，让一切看上去仍像规章内的正常波动。', 'ヴェインは君の失敗を用語の山へ押し戻し、すべてを規程内の揺れに見せかけた。', 'Vane presses your mistake back into a pile of terminology, making everything look like a routine variance inside protocol.')),
            logicExplanation: t('只要值班表证明她不在原岗位，语音又证明她主动补签，第一轮就能把“我整夜都守规”的说法拆成谎话。', 'シフト表で定位置不在を示し、音声で署名補填を示せば、「一晩中手順通り」は嘘に分解できる。', 'If the roster shows she was away from her station and the audio shows she filled the signature herself, then “I followed protocol all night” breaks into a lie.'),
            successAvg: [avg('hero', '流程不会自己走路，签字也不会自己长出来。', '手順は自分で歩かないし、署名も勝手には生えない。', 'Procedure does not walk on its own, and signatures do not grow by themselves.')],
            failAvg: failAvg([avg('enemy', '如果你连术语都没拆开，就别想拆开我。', '用語すら解けないなら、私を解体できるはずがない。', 'If you cannot unpack the terminology, you will not unpack me.')]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            weakPoints: [
                { id: 't2-wp-d', lineId: 't2-line-1', statement: t('我没碰过那只低温药盒', '私はあの低温薬箱に触れていない', 'I never touched that cryogenic medicine case'), evidenceId: 'ev-glove-trace', consumeEvidenceOnUse: true },
                { id: 't2-wp-e', lineId: 't2-line-2', statement: t('隔离电梯昨晚没有载过我', '隔離エレベーターは昨夜私を運んでいない', 'The isolation lift did not carry me last night'), evidenceId: 'ev-elevator-thermal', consumeEvidenceOnUse: false },
                { id: 't2-fake-f', lineId: 't2-line-3', statement: t('赞助方今晚没有和我联系', 'スポンサーは今夜私に接触していない', 'The sponsor did not contact me tonight'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t2-line-1', { zh: `你们现在想把我钉在药柜上？可笑。${encodeWeakPointMarker('t2-wp-d', '我没碰过那只低温药盒')}。`, ja: `私を薬庫に縫い付けたいの？滑稽ね。${encodeWeakPointMarker('t2-wp-d', '私はあの低温薬箱に触れていない')}。`, en: `You want to nail me to that cabinet now? Ridiculous. ${encodeWeakPointMarker('t2-wp-d', 'I never touched that cryogenic medicine case')}.` }),
                line('t2-line-2', { zh: `况且昨夜的隔离电梯根本没载过我。${encodeWeakPointMarker('t2-wp-e', '隔离电梯昨晚没有载过我')}。`, ja: `それに昨夜の隔離エレベーターは私を運んでいない。${encodeWeakPointMarker('t2-wp-e', '隔離エレベーターは昨夜私を運んでいない')}。`, en: `Besides, the isolation lift did not carry me last night. ${encodeWeakPointMarker('t2-wp-e', 'The isolation lift did not carry me last night')}.` }),
                line('t2-line-3', { zh: `你们若想把项目资金扯进来，那就更远了。${encodeWeakPointMarker('t2-fake-f', '赞助方今晚没有和我联系')}。`, ja: `資金の話まで持ち出すなら、なおさら見当違いよ。${encodeWeakPointMarker('t2-fake-f', 'スポンサーは今夜私に接触していない')}。`, en: `If you want to drag funding into this, you are even further off. ${encodeWeakPointMarker('t2-fake-f', 'The sponsor did not contact me tonight')}.` }),
                line('t2-line-4', t('两条真破绽被击碎后，检方当庭出示了她提前改写的试验指令单。', '二つの真の弱点が砕けると、検方は彼女が前倒しで書き換えた試験指令書を提示した。', 'After both true weak points are broken, the prosecution produces the trial order she rewrote in advance.'), { hidden: true, unlockMode: 'allTrueWeakPoints', grantEvidenceIds: ['ev-trial-order'] })
            ],
            queryNarratives: [t('第二轮要闭合“她到过现场”与“她亲手接触过药盒”。电梯热图给出路线，树脂痕给出接触。', '第二ラウンドは「現場へ行った」と「薬箱へ触れた」を閉じる。熱画像が経路を、樹脂痕が接触を示す。', 'Round two closes “she went to the scene” and “she physically handled the case.” The thermal log gives the route, and the resin trace gives the contact.'), t('她自己提起赞助方，反而像是在替真正的金流预先消毒。', '彼女が自分からスポンサーを持ち出すのは、本当の資金流を先に消毒したいからだ。', 'The fact that she brings up the sponsor on her own sounds like pre-emptive sterilization of the real money trail.')],
            queryAvg: [avg('hero', '她越像医生，越把谎话写成“必要处理”。', '医師らしく見えるほど、嘘を「必要処置」に書き換えている。', 'The more she sounds like a doctor, the more she rewrites lies into “necessary interventions.”')],
            inspectOverrides: [{ weakPointId: 't2-fake-f', narrative: t('你顺着赞助方追下去，很快摸到了那笔时间戳过于漂亮的私人转账。', 'スポンサーを追うと、タイムスタンプが出来すぎている個人口座送金に行き当たった。', 'Following the sponsor leads you quickly to a personal transfer whose timestamp is a little too perfect.'), avg: [avg('system', '系统回收：赞助方转账回执。', 'システム回収：スポンサー送金控え。', 'System recovery: sponsor transfer receipt.')], grantEvidenceIds: ['ev-sponsor-transfer'], revealLineIds: [] }],
            successNarrative: t('她“只是补流程”的借口开始露出真正的项目意图。', '「手続きを補っただけ」という言い訳から、本当のプロジェクト意図が覗き始める。', 'Her excuse of “merely patching procedure” begins revealing the true intention behind the project.'),
            successOverrides: [],
            useSeparateTurnClear: false,
            turnClearNarrative: t('她“只是补流程”的借口开始露出真正的项目意图。', '「手続きを補っただけ」という言い訳から、本当のプロジェクト意図が覗き始める。', 'Her excuse of “merely patching procedure” begins revealing the true intention behind the project.'),
            turnClearAvg: [avg('enemy', '研究总要有人做脏事，我只是比死者更早承认这一点。', '研究には誰かが汚れ役をやるしかない。私は被害者より先にそれを認めただけ。', 'Research always requires someone to do the dirty work. I simply admitted that sooner than the victim did.')],
            useSeparateFailureReasons: true,
            failNarrative: {
                wrongEvidence: t('薇恩把不相干的证据当场切回“情绪推理”，并重新夺回话语节奏。', 'ヴェインは無関係な証拠を「感情推理」へ切り戻し、発話の主導権を取り返した。', 'Vane cuts the irrelevant exhibit down as emotional reasoning and seizes back the rhythm of speech.'),
                wrongStatement: t('你点偏了主句，她便趁机把真正危险的接触证据藏回专业术语里。', '主文を外した隙に、彼女は危険な接触証拠を再び専門用語へ隠した。', 'You picked the wrong sentence, and she slips the dangerous contact evidence back into clinical jargon.'),
                bothWrong: t('这一轮完全被她重写成病例讨论，你的指控反而像不懂规程的外行插话。', 'このラウンドは完全に症例検討へ書き換えられ、君の追及は規程を知らない外野の口出しに見えた。', 'She rewrites the whole round into a case conference, making your accusation sound like an outsider interrupting protocol.')
            },
            logicExplanation: t('第二轮靠两条硬证据闭合：电梯热图证明她确实去了二层，手套树脂证明她亲手碰过药盒。', '第二ラウンドは二本の硬証拠で閉じる。熱画像が二階移動を示し、手袋樹脂が薬箱への接触を示す。', 'Round two closes on two hard proofs: the lift thermal log puts her on level two, and the glove resin proves she touched the medicine case herself.'),
            successAvg: [avg('hero', '你不是替流程缝补裂口，你是在把流程改写成凶器。', '手順の裂け目を縫ったのではない。手順そのものを凶器へ書き換えたんだ。', 'You were not repairing a tear in procedure. You were rewriting procedure itself into a weapon.')],
            failAvg: {
                wrongEvidence: [avg('enemy', '如果你连器械都认错，就别碰临床。', '器具すら取り違えるなら臨床に触るな。', 'If you cannot even identify the instrument, stay out of the clinic.')],
                wrongStatement: [avg('enemy', '先抓住句子的脉，再来谈病灶。', '文の脈を掴んでから病巣を語れ。', 'Catch the pulse of the sentence before you diagnose the lesion.')],
                bothWrong: [avg('enemy', '你想救人，却连病例都读不准。', '人を救いたいなら、まず症例を読み違えるな。', 'If you want to save anyone, start by reading the case correctly.')]
            },
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            weakPoints: [
                { id: 't3-wp-g', lineId: 't3-line-1', statement: t('试验指令不是我伪造的', '試験指令書を偽造したのは私ではない', 'I did not forge the trial order'), evidenceId: 'ev-trial-order', consumeEvidenceOnUse: true },
                { id: 't3-wp-h', lineId: 't3-line-2', statement: t('赞助方转账只是常规咨询费', 'スポンサー送金は通常の相談料だ', 'The sponsor transfer was only a routine consulting fee'), evidenceId: 'ev-sponsor-transfer', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t3-line-1', { zh: `你们拿到的那张试验指令单有太多复写痕。${encodeWeakPointMarker('t3-wp-g', '试验指令不是我伪造的')}。`, ja: `君たちの持つ試験指令書は写し跡だらけだ。${encodeWeakPointMarker('t3-wp-g', '試験指令書を偽造したのは私ではない')}。`, en: `The trial order you recovered is full of overwriting marks. ${encodeWeakPointMarker('t3-wp-g', 'I did not forge the trial order')}.` }),
                line('t3-line-2', { zh: `至于赞助方给我的那笔钱，不过是常规顾问费。${encodeWeakPointMarker('t3-wp-h', '赞助方转账只是常规咨询费')}。`, ja: `スポンサーからの送金は、ただの通常顧問料よ。${encodeWeakPointMarker('t3-wp-h', 'スポンサー送金は通常の相談料だ')}。`, en: `As for the money the sponsor sent me, it was only routine consulting pay. ${encodeWeakPointMarker('t3-wp-h', 'The sponsor transfer was only a routine consulting fee')}.` })
            ],
            queryNarratives: [t('终局要把“伪造签字”与“提前收钱”钉成同一个决定。', '終局では「署名偽造」と「先払い受領」を同じ決断として固定する。', 'The final round must pin forged authorization and advance payment into the same decision.'), t('如果指令单说明她动过排程，转账回执又说明她拿过钱，那死亡就不再是流程事故。', '指令書が予定改変を示し、送金控えが対価受領を示せば、死は手続き事故ではいられない。', 'If the order proves she altered the schedule and the transfer proves she took payment, then the death can no longer hide inside protocol.')],
            queryAvg: [avg('system', '终局监控：财务流与指令流同步比对。', '終局監視：資金流と指令流を同期照合。', 'Final monitor: syncing financial flow against command flow.')],
            inspectOverrides: [],
            successNarrative: t('薇恩的“必要处理”终于露出价码。', 'ヴェインの「必要処置」が、ついに値札を見せた。', 'Vane\'s “necessary intervention” finally reveals its price tag.'),
            successOverrides: [],
            useSeparateTurnClear: false,
            turnClearNarrative: t('薇恩的“必要处理”终于露出价码。', 'ヴェインの「必要処置」が、ついに値札を見せた。', 'Vane\'s “necessary intervention” finally reveals its price tag.'),
            turnClearAvg: [avg('hero', '你不是为了救项目签字，你是为了拿钱把人从项目里划掉。', 'プロジェクトを救うための署名じゃない。金のために、人を計画から消したんだ。', 'You did not sign to save the project. You signed to erase a person from it for money.')],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('离自白只差一步，薇恩却还在努力把金流和签字拆成两件互不相干的事。', '自白まであと一歩なのに、ヴェインはなお資金流と署名を別件へ切り離そうとしている。', 'Confession is one step away, yet Vane still tries to split the money trail from the signature as if they were unrelated.')),
            logicExplanation: t('指令单证明她亲手提前了危险批次，转账回执证明她因此收钱。手法和利益在她身上闭合后，整起死亡不再可能是意外。', '指令書が危険ロットの前倒しを示し、送金控えがその対価を示す。手口と利益が彼女の上で閉じれば、死はもはや事故ではない。', 'The order proves she advanced the dangerous batch by hand, and the transfer proves she was paid for it. Once method and profit close on her, the death can no longer be an accident.'),
            successAvg: [avg('enemy', '……如果那个项目停了，整栋楼都会失去资助。', '……あのプロジェクトが止まれば、この棟全体が資金を失う。', '...If that project stopped, this entire building would have lost funding.'), avg('hero', '所以你先让一个人失去明天。', 'だから先に、一人から明日を奪った。', 'So you took tomorrow away from one person first.'), avg('system', '终局确认：有罪路线已闭合。', '終局確認：有罪ルート閉鎖。', 'Final confirmation: guilty route closed.')],
            failAvg: failAvg([avg('enemy', '终局最怕的从来不是审判，而是审判来得太慢。', '終局で怖いのは裁きではない。裁きが遅すぎることだ。', 'The endgame does not fear judgment. It fears judgment arriving too late.')]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: [t('监护警报：生理曲线缓存回放。', '監護警報：生体曲線キャッシュ再生。', 'Care alarm: vital-curve cache replay.'), t('权限噪声：临床终端尝试覆盖签名层。', '権限ノイズ：臨床端末が署名レイヤーを上書きしようとしている。', 'Privilege noise: clinical terminal attempting to overwrite signature layer.'), t('记忆漂移：药柜门锁日志闪断。', '記憶ドリフト：薬庫ロックログが断続。', 'Memory drift: cabinet lock log flickering.')]
        }
    ],
    victory: {
        narrative: t('值班表、语音备忘、手套树脂、伪造指令与赞助转账，五条链条在薇恩身上闭合。她承认自己为了让试验项目提前出结果，伪造指令、提前批次，并在争执中亲手把死者逼到药柜前再夺走了他的生路。', 'シフト表、音声メモ、手袋樹脂、偽造指令、スポンサー送金。その五本の鎖がヴェインの上で閉じた。彼女は試験結果を前倒しするため、指令を偽造し、ロットを前倒しし、口論の末に被害者を薬庫前へ追い込み、その生路を奪ったと認める。', 'The roster, voice memo, glove resin, forged order, and sponsor transfer all close on Vane. She admits that to force early trial results, she forged the order, moved the batch up, and during the confrontation drove the victim to the cabinet and took away his way out.'),
        confession: t('是，我改了排程，也补了签字。赞助方只在乎结果，院方只在乎经费，死者却还想按原来的伦理程序拖下去。我不能让项目停，所以我把一切往前推，直到他倒在药柜前。那一刻我告诉自己，这只是一次必要处理。', 'ああ、私が予定を変え、署名も埋めた。スポンサーは結果しか見ず、病院は資金しか見ない。なのに被害者は古い倫理手順のまま止めようとした。プロジェクトを止められなかった。だからすべてを前へ押し出し、彼が薬庫前で倒れるまで進めた。その瞬間、自分に言い聞かせた。これは必要処置だと。', 'Yes, I changed the schedule, and I filled the signature. The sponsor cared only about results, the hospital only about funding, and the victim still wanted to slow everything down under the old ethics procedure. I could not let the project stop. So I pushed everything forward until he fell in front of the cabinet. In that moment, I told myself it was only a necessary intervention.'),
        avg: [avg('enemy', '必要处理。多么干净的词。', '必要処置。なんて綺麗な言葉。', 'Necessary intervention. Such a clean phrase.'), avg('hero', '干净的从来不是词，而是你想拿它洗掉的血。', '綺麗なのは言葉じゃない。その言葉で洗い流したい血の方だ。', 'It was never the phrase that was clean. It was the blood you wanted the phrase to wash away.'), avg('system', '判定完成：有罪。案件归档至《空病区协议》。', '判定完了：有罪。案件は『ホロウ・ワード・プロトコル』として保管される。', 'Judgment complete: Guilty. Case archived as Hollow Ward Protocol.')]
    }
};

const regressionCase: LocalCaseData = {
    caseId: 'ceshi',
    caseTitle: t('功能回归测试', '機能回帰テスト', 'Feature Regression Test'),
    defaultLang: 'zh',
    suspectName: t('测试嫌疑人', 'テスト容疑者', 'Test Suspect'),
    suspectEmoji: '',
    heroEmoji: '',
    heroPortraitPackId: 'debug-hero-readout',
    enemyPortraitPackId: 'debug-enemy-readout',
    backgroundPackId: 'debug-scene-readout',
    intro: {
        narrative: t('这是一份强化本地模式回归剧本：会依次覆盖调查分支、隐藏台词、掉证据、可复用证据、多回合滤镜与立绘动作、以及终局干扰弹窗。', 'これは強化された本地モード回帰シナリオで、調査分岐、隠し台詞、証拠ドロップ、再利用証拠、複数ラウンドのフィルターと立ち絵モーション、終局妨害ポップアップを順に検証する。', 'This is an expanded local-mode regression script that verifies inspect branches, hidden lines, evidence drops, reusable evidence, multi-round filters and portrait motions, and final interference popups.'),
        systemMsg: t(
            '推荐顺序：主控台离席缺口 → 调查“恢复日志只是系统抖动” → 最终校验覆写痕 → 机柜门内侧汗印 / 指令签发回执 → 调查“外联报码只是例行测试” → 暗网确认回执 → 竞价副本外发记录 → 旧签章吊销时间 → 调查“备用口令只是留给值班组的保险” → 封存镜像签名页 → 最终授权附带批注。会依次看到 scanline / noise / glitch / monochrome / alert_red。',
            '推奨順：主制御台離席ログの欠落 → 「復元ログはただのシステム揺れだ」を調査 → 最終検証の上書き痕 → ラック扉内側の汗跡 / 指令発行控え → 「外部連絡コードは定例テストに過ぎない」を調査 → 闇回線の確認受領書 → 入札副本の送信記録 → 旧署名の失効時刻 → 「予備コードは当直班の保険だ」を調査 → 封印ミラーの署名ページ → 最終認可の添付注記。scanline / noise / glitch / monochrome / alert_red を順に確認できる。',
            'Recommended order: Main desk leave gap -> inspect "the restored log is only system jitter" -> final verification overwrite trace -> sweat print inside the rack door / command issuance receipt -> inspect "the outbound relay code was just a routine test" -> dark-net confirmation receipt -> bid copy forwarding record -> old seal revocation time -> inspect "the backup code was only a safety net for the duty team" -> sealed mirror signature page -> final authorization annotation. You will see scanline / noise / glitch / monochrome / alert_red in sequence.'
        ),
        backgroundSlot: 'briefing',
        enemyPortraitState: 'neutral_idle',
        screenFilter: 'scanline',
        transition: 'fade'
    },
    evidences: [
        { id: 'evidence-a', aliases: ['A'], startsInInventory: true, name: t('主控台离席缺口', '主制御台離席ログの欠落', 'Main Desk Leave Gap'), detail: t('值守登记里缺失的七分钟空档，能证明她昨晚离开过主控台。', '当直記録に欠けた七分間の空白。昨夜、彼女が主制御台を離れた証拠。', 'A seven-minute gap in the duty log proving she left the main control desk that night.') },
        { id: 'evidence-d', aliases: ['D'], startsInInventory: false, name: t('最终校验覆写痕', '最終検証の上書き痕', 'Final Verification Overwrite Trace'), detail: t('顺着恢复日志剥出来的强制覆写痕，能直接反驳“最后一道校验不是我覆写的”。', '復元ログを剥がして露出した強制上書き痕。「最後の検証は私ではない」を直接崩せる。', 'A forced-overwrite trace peeled out of the restored log that directly rebuts the claim about the final verification.') },
        { id: 'evidence-e', aliases: ['E'], startsInInventory: false, name: t('机柜门内侧汗印', 'ラック扉の内側の汗跡', 'Sweat Print Inside the Rack Door'), detail: t('隐藏台词出现后拿到的门内侧汗印，能证明机柜门就是她亲手打开的。', '隠し台詞の出現後に得られる扉内側の汗跡。ラック扉を彼女自身が開けたと示す。', 'A sweat mark from the inner side of the rack door, proving she opened it herself.') },
        { id: 'evidence-f', aliases: ['F'], startsInInventory: true, name: t('指令签发回执', '指令発行控え', 'Command Issuance Receipt'), detail: t('开局持有的签发回执，能对照那条命令究竟是不是她发出的；本证据可复用。', '初期所持の発行控え。あの命令が本当に彼女から出たか照合できる。再利用可。', 'A starting issuance receipt used to verify whether the command was actually issued by her. This evidence is reusable.') },
        { id: 'evidence-h', aliases: ['H'], startsInInventory: false, name: t('暗网确认回执', '闇回線の確認受領書', 'Dark-Net Confirmation Receipt'), detail: t('顺着外联报码追出来的暗线回执，里面的确认码能把发送者和她绑死。', '外部連絡コードから引きずり出した闇回線の受領記録。確認コードが送信者を彼女へ結び付ける。', 'A dark-line receipt pulled from the outbound relay code; its confirmation code ties the sender directly to her.') },
        { id: 'evidence-i', aliases: ['I'], startsInInventory: false, name: t('竞价副本外发记录', '入札副本の送信記録', 'Bid Copy Forwarding Record'), detail: t('第二轮全部真破绽击破后掉落，记录了竞价副本被外发的具体路径。', '第二ラウンドの真弱点をすべて崩した後に落ちる記録。入札副本の流出経路を示す。', 'Unlocked after clearing all true weak points in round two; records the exact route the bid copy took when it was forwarded.') },
        { id: 'evidence-j', aliases: ['J'], startsInInventory: true, name: t('旧签章吊销时间', '旧署名の失効時刻', 'Old Seal Revocation Time'), detail: t('开局持有，能证明旧签章在关键时刻其实还没作废，别人无法随便伪造她的口令。', '初期所持。肝心の時刻に旧署名がまだ失効していなかったと示し、誰でも偽装できた説を崩す。', 'Available from the start; proves the old seal had not yet been revoked at the crucial moment, so not just anyone could forge her code.') },
        { id: 'evidence-k', aliases: ['K'], startsInInventory: false, name: t('封存镜像签名页', '封印ミラーの署名ページ', 'Sealed Mirror Signature Page'), detail: t('调查备用口令后拿到的镜像签名页，能确认那次重写就是她的口令留下的。', '予備コードの調査後に得られる署名ページ。あの再書き込みが彼女のコードで行われたと示す。', 'A signature page obtained after tracing the backup code, confirming the rewrite was performed under her own credentials.') },
        { id: 'evidence-l', aliases: ['L'], startsInInventory: false, name: t('最终授权附带批注', '最終認可の添付注記', 'Final Authorization Annotation'), detail: t('第四轮真破绽全部击破后掉落，批注写明这道授权是为了把事故继续压下去。', '第四ラウンドの真弱点をすべて崩した後に落ちる添付注記。この認可が事故を押し潰して継続させるためのものだと明記している。', 'Dropped after all true weak points in round four are solved; the attached note states the authorization was meant to keep the incident buried.') }
    ],
    turns: [
        {
            sceneBackgroundSlot: 'cross_exam',
            enemyPortraitState: 'neutral_idle',
            enemyPortraitMotion: 'pop',
            screenFilter: 'scanline',
            screenImpulse: 'none',
            transition: 'fade',
            weakPoints: [
                { id: 't1-wp-a', lineId: 't1-line-1', statement: t('我昨晚根本没离开主控台', '昨夜、私は主制御台を離れていない', 'I never left the main control desk last night'), evidenceId: 'evidence-a', consumeEvidenceOnUse: true },
                { id: 't1-fake-b', lineId: 't1-line-2', statement: t('恢复日志只是系统抖动', '復元ログはただのシステム揺れだ', 'The restored log is only system jitter'), evidenceId: '', consumeEvidenceOnUse: true },
                { id: 't1-fake-c', lineId: 't1-line-3', statement: t('备份区的越权记录与我无关', 'バックアップ区画の権限逸脱は私と無関係だ', 'The unauthorized backup-sector access has nothing to do with me'), evidenceId: '', consumeEvidenceOnUse: true },
                { id: 't1-wp-d', lineId: 't1-line-4', statement: t('最后一道校验不是我覆写的', '最後の検証を書き換えたのは私ではない', 'I did not overwrite the final verification'), evidenceId: 'evidence-d', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t1-line-1', {
                    zh: `先把话记清楚，${encodeWeakPointMarker('t1-wp-a', '我昨晚根本没离开主控台')}。我整晚都盯着那块屏幕，连离席登记都没有空缺。`,
                    ja: `まず確認して。${encodeWeakPointMarker('t1-wp-a', '昨夜、私は主制御台を離れていない')}。一晩中あの画面を見ていて、離席記録にも穴はない。`,
                    en: `Get this straight first: ${encodeWeakPointMarker('t1-wp-a', 'I never left the main control desk last night')}. I watched that screen all night, and even the desk-leave log has no gap.`
                }, { portraitState: 'neutral_idle', portraitMotion: 'none' }),
                line('t1-line-2', {
                    zh: `你们现在拿一段恢复日志就想吓我？${encodeWeakPointMarker('t1-fake-b', '恢复日志只是系统抖动')}。这种老机器半夜自己抽搐又不是第一次。`,
                    ja: `復元ログ一本で私を揺さぶるつもり？${encodeWeakPointMarker('t1-fake-b', '復元ログはただのシステム揺れだ')}。こんな旧式機が夜中に痙攣するのは今さら初めてじゃない。`,
                    en: `You think one restored log is enough to rattle me? ${encodeWeakPointMarker('t1-fake-b', 'The restored log is only system jitter')}. These old machines twitch at midnight all the time.`
                }, { portraitState: 'polite_smile', portraitMotion: 'pop' }),
                line('t1-line-3', {
                    zh: `至于备份区那条越权记录，${encodeWeakPointMarker('t1-fake-c', '备份区的越权记录与我无关')}。真要说漏洞，也是系统先烂给你们看的。`,
                    ja: `バックアップ区画の権限逸脱ログなら、${encodeWeakPointMarker('t1-fake-c', 'バックアップ区画の権限逸脱は私と無関係だ')}。穴があるなら、まず壊れていたのはシステムの方よ。`,
                    en: `As for that unauthorized backup-sector access, ${encodeWeakPointMarker('t1-fake-c', 'the unauthorized backup-sector access has nothing to do with me')}. If there is a breach, the system rotted before I ever did.`
                }, { portraitState: 'thinking_hand_to_chin', portraitMotion: 'shake_small' }),
                line('t1-line-4', {
                    zh: `可你把恢复日志往后一帧一帧掰开时，还是抖出了另一道被强行压过去的记录: ${encodeWeakPointMarker('t1-wp-d', '最后一道校验不是我覆写的')}。`,
                    ja: `だが復元ログを一フレームずつ剥がしていくと、別の上書き痕が浮いてくる。${encodeWeakPointMarker('t1-wp-d', '最後の検証を書き換えたのは私ではない')}。`,
                    en: `But when the restored log is peeled back frame by frame, another forced-overwrite trace rises out of it: ${encodeWeakPointMarker('t1-wp-d', 'I did not overwrite the final verification')}.`
                }, { hidden: true, grantEvidenceIds: ['evidence-e'], portraitState: 'surprise_small', portraitMotion: 'slide_in' })
            ],
            queryNarratives: [
                t('第一轮通用调查反馈1。', '第一ラウンド共通調査フィードバック1。', 'Round-one generic inspect feedback 1.'),
                t('第一轮通用调查反馈2。', '第一ラウンド共通調査フィードバック2。', 'Round-one generic inspect feedback 2.')
            ],
            queryAvg: [
                avgCue('system', '第一轮通用调查 AVG。', '第一ラウンド共通調査AVG。', 'Round-one generic inspect AVG.', { backgroundSlot: 'cross_exam', screenFilter: 'scanline' }),
                avgCue('hero', '先确认回退分支，再进入论破。', 'まず fallback 分岐を確認し、その後で論破へ。', 'Confirm fallback branch first, then rebut.', { portraitState: 'serious_focus', portraitMotion: 'slide_in' })
            ],
            inspectOverrides: [{
                weakPointId: 't1-fake-b',
                narrative: t('顺着“系统抖动”的说法追进去，你会拿到《最终校验覆写痕》，并揭出隐藏的第四句证词。', '「システム揺れだ」という言い逃れを追うと、《最終検証の上書き痕》を回収し、隠れた四つ目の証言が現れる。', 'Follow the "system jitter" excuse and you will recover the Final Verification Overwrite Trace, revealing the hidden fourth testimony.'),
                avg: [avgCue('system', '恢复日志被一层层剥开，覆写痕终于露出来了。', '復元ログが一枚ずつ剥がれ、上書き痕がやっと顔を出した。', 'The restored log peels open layer by layer until the overwrite trace finally surfaces.', { transition: 'wipe' })],
                grantEvidenceIds: ['evidence-d'],
                revealLineIds: ['t1-line-4']
            }],
            successNarrative: t('第一轮通用成功旁白。', '第一ラウンド共通成功ナレーション。', 'Round-one generic success narrative.'),
            successOverrides: [
                { weakPointId: 't1-wp-a', narrative: t('离席缺口一摆出来，“整晚没离开主控台”这句话就站不住了。', '離席ログの欠落を突き付けた瞬間、「主制御台を離れていない」は崩れる。', 'The moment the leave gap is laid out, the claim that she never left the main desk collapses.'), avg: [avgCue('hero', '主控台离席的谎话，已经拆掉。', '主制御台離席の嘘は、もう崩した。', 'The lie about never leaving the main desk is gone.', { portraitState: 'angry_attack', portraitMotion: 'pop', screenImpulse: 'zoom_punch' })] },
                { weakPointId: 't1-wp-d', narrative: t('强制覆写痕一露，“最后一道校验不是我改的”也一起塌了。', '強制上書き痕が露出した瞬間、「最後の検証は私ではない」も一緒に崩れる。', 'Once the forced-overwrite trace is exposed, the claim about the final verification falls with it.'), avg: [avgCue('system', '检查点：《最终校验覆写痕》已消耗。', '確認点：《最終検証の上書き痕》は消費済み。', 'Checkpoint: Final Verification Overwrite Trace has been consumed.', { screenFilter: 'noise' })] }
            ],
            useSeparateTurnClear: true,
            turnClearNarrative: t('第一轮独立回合结尾。', '第一ラウンド独立ターンクリア。', 'Round-one separate turn clear.'),
            turnClearAvg: [avgCue('enemy', '第一轮真破绽已清空。', '第一ラウンド真弱点クリア。', 'All true weak points in round one are cleared.', { portraitState: 'defensive_frown', portraitMotion: 'slide_out' })],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('第一轮通用失败旁白。', '第一ラウンド共通失敗ナレーション。', 'Round-one generic failure narrative.')),
            logicExplanation: t('第一轮验证调查分支、隐藏线、掉证据与基础动作。', '第一ラウンドは調査分岐、隠し行、証拠ドロップ、基本モーションを検証する。', 'Round one verifies inspect branches, hidden lines, evidence drops, and baseline motions.'),
            successAvg: [avgCue('hero', '第一轮通用成功 AVG。', '第一ラウンド共通成功AVG。', 'Round-one generic success AVG.', { portraitState: 'serious_focus', portraitMotion: 'bounce', screenFilter: 'scanline' })],
            failAvg: failAvg([avgCue('enemy', '第一轮通用失败 AVG。', '第一ラウンド共通失敗AVG。', 'Round-one generic failure AVG.', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenFilter: 'scanline' })]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            sceneBackgroundSlot: 'analysis',
            enemyPortraitState: 'serious_focus',
            enemyPortraitMotion: 'slide_in',
            screenFilter: 'noise',
            screenImpulse: 'zoom_punch',
            transition: 'wipe',
            weakPoints: [
                { id: 't2-wp-e', lineId: 't2-line-1', statement: t('机柜门不是我开的', 'ラック扉を開けたのは私ではない', 'I was not the one who opened the rack door'), evidenceId: 'evidence-e', consumeEvidenceOnUse: true },
                { id: 't2-wp-f', lineId: 't2-line-1', statement: t('那条指令不是我签发的', 'あの指令を発行したのは私ではない', 'I did not issue that command'), evidenceId: 'evidence-f', consumeEvidenceOnUse: false },
                { id: 't2-fake-g', lineId: 't2-line-2', statement: t('外联报码只是例行测试', '外部連絡コードは定例テストに過ぎない', 'The outbound relay code was just a routine test'), evidenceId: '', consumeEvidenceOnUse: true },
                { id: 't2-wp-h', lineId: 't2-line-3', statement: t('暗网回执里的确认码不是我发的', '闇回線の確認コードを送ったのは私ではない', 'I did not send the confirmation code in the dark-net receipt'), evidenceId: 'evidence-h', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t2-line-1', {
                    zh: `你们想把机柜门和指令一起扣到我头上？${encodeWeakPointMarker('t2-wp-e', '机柜门不是我开的')}，而且${encodeWeakPointMarker('t2-wp-f', '那条指令不是我签发的')}。别拿两件事硬焊成一件。`,
                    ja: `ラック扉も指令もまとめて私に被せるつもり？${encodeWeakPointMarker('t2-wp-e', 'ラック扉を開けたのは私ではない')}、それに${encodeWeakPointMarker('t2-wp-f', 'あの指令を発行したのは私ではない')}。二つを無理やり一つに溶接しないで。`,
                    en: `You want to pin both the rack door and the command on me at once? ${encodeWeakPointMarker('t2-wp-e', 'I was not the one who opened the rack door')}, and ${encodeWeakPointMarker('t2-wp-f', 'I did not issue that command')}. Do not weld two different things into one accusation.`
                }, { portraitState: 'serious_focus', portraitMotion: 'pop' }),
                line('t2-line-2', {
                    zh: `至于那串外联报码，${encodeWeakPointMarker('t2-fake-g', '外联报码只是例行测试')}。你们把例行自检想得太像犯罪彩排了。`,
                    ja: `あの外部連絡コードについては、${encodeWeakPointMarker('t2-fake-g', '外部連絡コードは定例テストに過ぎない')}。定例自己診断を事件のリハーサルみたいに扱いすぎよ。`,
                    en: `As for that outbound relay code, ${encodeWeakPointMarker('t2-fake-g', 'the outbound relay code was just a routine test')}. You are mistaking a routine self-check for a rehearsal of a crime.`
                }, { portraitState: 'innocent_hand', portraitMotion: 'bounce' }),
                line('t2-line-3', {
                    zh: `可当你把两条硬证都钉实，另一份回执也被从暗线上拖了出来: ${encodeWeakPointMarker('t2-wp-h', '暗网回执里的确认码不是我发的')}。`,
                    ja: `だが二本の硬証拠が固まった瞬間、別の受領記録まで闇回線から引きずり出される。${encodeWeakPointMarker('t2-wp-h', '闇回線の確認コードを送ったのは私ではない')}。`,
                    en: `But the moment both hard proofs lock in, another receipt is dragged out of the dark line itself: ${encodeWeakPointMarker('t2-wp-h', 'I did not send the confirmation code in the dark-net receipt')}.`
                }, { hidden: true, unlockMode: 'allTrueWeakPoints', grantEvidenceIds: ['evidence-i'], portraitState: 'defensive_frown', portraitMotion: 'shake_small' })
            ],
            queryNarratives: [
                t('第二轮测试同一行多真破绽与错误类型分离。', '第二ラウンドは同一行の複数真弱点と失敗タイプ分離を検証する。', 'Round two tests multiple true weak points on one line and split failure reasons.'),
                t('第二轮通用调查反馈不应剧透奖励。', '第二ラウンド共通調査フィードバックは報酬ネタバレを避ける。', 'Round-two shared inspect feedback should avoid reward spoilers.')
            ],
            queryAvg: [
                avgCue('system', '第二轮通用调查 AVG。', '第二ラウンド共通調査AVG。', 'Round-two generic inspect AVG.', { backgroundSlot: 'analysis', screenFilter: 'noise', screenImpulse: 'zoom_punch' }),
                avgCue('hero', '这轮优先验证多目标论破。', 'このラウンドは多目標論破の確認を優先。', 'Prioritize multi-target rebuttal checks in this round.', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'slide_in' })
            ],
            inspectOverrides: [{
                weakPointId: 't2-fake-g',
                narrative: t('顺着外联报码往暗线回查，你会拿到《暗网确认回执》。', '外部連絡コードを闇回線側へ追うと、《闇回線の確認受領書》が引き上がる。', 'Trace the outbound relay code into the dark line and you recover the Dark-Net Confirmation Receipt.'),
                avg: [avgCue('system', '外联报码的下游回执，已经被从暗线里拖出来了。', '外部連絡コードの下流受領書が、闇回線から引きずり出された。', 'The downstream receipt behind the outbound relay code has been dragged out of the dark line.', { screenFilter: 'noise', transition: 'wipe' })],
                grantEvidenceIds: ['evidence-h'],
                revealLineIds: []
            }],
            successNarrative: t('第二轮通用成功旁白。', '第二ラウンド共通成功ナレーション。', 'Round-two generic success narrative.'),
            successOverrides: [
                { weakPointId: 't2-wp-e', narrative: t('机柜门内侧那道汗印，把“不是我开的”这句话直接钉死了。', 'ラック扉の内側に残った汗跡が、「私が開けたわけではない」を直撃する。', 'The sweat mark inside the rack door directly nails the claim that she never opened it.'), avg: [avgCue('hero', '机柜门这句谎话，已经论破。', 'ラック扉に関する嘘は、これで論破だ。', 'The lie about the rack door is broken.', { portraitState: 'angry_attack', portraitMotion: 'shake_small', screenImpulse: 'camera_shake' })] },
                { weakPointId: 't2-wp-f', narrative: t('签发回执对上了那条命令，但它还得留在证据栏里继续复用。', '発行控えは命令と一致したが、この証拠はまだ手元に残して再利用する。', 'The issuance receipt lines up with the command, but it stays in inventory for reuse.'), avg: [avgCue('system', '检查点：《指令签发回执》仍保留在证据栏。', '確認点：《指令発行控え》は証拠欄に残っている。', 'Checkpoint: Command Issuance Receipt remains in inventory.', { screenFilter: 'noise' })] }
            ],
            useSeparateTurnClear: false,
            turnClearNarrative: t('第二轮回合结尾。', '第二ラウンドターンクリア。', 'Round-two turn clear.'),
            turnClearAvg: [avgCue('enemy', '你们只是把门和命令缠到了我身上，价码还没被你们真正扯出来。', '扉と指令を私へ巻きつけただけ。対価まではまだ暴けていない。', 'You have only wrapped the door and the command around me. You still have not dragged out the price tag.', { backgroundSlot: 'reveal', portraitState: 'defensive_frown', portraitMotion: 'shake_small', transition: 'glitch' })],
            useSeparateFailureReasons: true,
            failNarrative: {
                wrongEvidence: t('第二轮 wrongEvidence 失败旁白。', '第二ラウンド wrongEvidence 失敗ナレーション。', 'Round-two wrongEvidence failure narrative.'),
                wrongStatement: t('第二轮 wrongStatement 失败旁白。', '第二ラウンド wrongStatement 失敗ナレーション。', 'Round-two wrongStatement failure narrative.'),
                bothWrong: t('第二轮 bothWrong 失败旁白。', '第二ラウンド bothWrong 失敗ナレーション。', 'Round-two bothWrong failure narrative.')
            },
            logicExplanation: t('第二轮验证“机柜门内侧汗印 / 指令签发回执 / 暗网确认回执”全部解决后才能推进，并检查前者消耗、后者复用。', '第二ラウンドは「ラック扉内側の汗跡 / 指令発行控え / 闇回線の確認受領書」をすべて解決して初めて進み、前者の消費と後者の再利用も確認する。', 'Round two advances only after the rack-door sweat print, the command issuance receipt, and the dark-net confirmation receipt are all resolved, while also checking evidence consumption and reuse.'),
            successAvg: [avgCue('hero', '第二轮通用成功 AVG。', '第二ラウンド共通成功AVG。', 'Round-two generic success AVG.', { portraitState: 'serious_focus', portraitMotion: 'bounce', screenFilter: 'noise' })],
            failAvg: {
                wrongEvidence: [avgCue('enemy', '第二轮 wrongEvidence AVG。', '第二ラウンド wrongEvidence AVG。', 'Round-two wrongEvidence AVG.', { portraitState: 'shock_big', portraitMotion: 'shake_big', screenFilter: 'noise' })],
                wrongStatement: [avgCue('enemy', '第二轮 wrongStatement AVG。', '第二ラウンド wrongStatement AVG。', 'Round-two wrongStatement AVG.', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenFilter: 'noise' })],
                bothWrong: [avgCue('enemy', '第二轮 bothWrong AVG。', '第二ラウンド bothWrong AVG。', 'Round-two bothWrong AVG.', { portraitState: 'angry_attack', portraitMotion: 'shake_big', screenFilter: 'glitch', screenImpulse: 'flash' })]
            },
            failOverrides: {
                wrongEvidence: [{ weakPointId: 't2-wp-e', narrative: t('你拿出的东西对不上机柜门内侧那道汗印。', '差し出した証拠は、ラック扉内側の汗跡と噛み合っていない。', 'What you presented does not line up with the sweat mark inside the rack door.'), avg: [avgCue('system', '这一下没有打中机柜门那条线索。', '今の一手はラック扉の手掛かりを撃ち抜けていない。', 'That move did not hit the rack-door clue.', { screenFilter: 'noise' })] }],
                wrongStatement: [],
                bothWrong: []
            },
            interferenceLines: []
        },
        {
            sceneBackgroundSlot: 'reveal',
            enemyPortraitState: 'defensive_frown',
            enemyPortraitMotion: 'shake_small',
            screenFilter: 'glitch',
            screenImpulse: 'camera_shake',
            transition: 'glitch',
            weakPoints: [
                { id: 't3-wp-i', lineId: 't3-line-1', statement: t('那份竞价副本不是我泄露出去的', 'あの入札副本を漏らしたのは私ではない', 'I was not the one who leaked that bid copy'), evidenceId: 'evidence-i', consumeEvidenceOnUse: true },
                { id: 't3-fake-j', lineId: 't3-line-2', statement: t('屋顶照片里的人影不可能是我', '屋上写真の人影は私ではあり得ない', 'The figure in the rooftop photo cannot be me'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t3-line-1', {
                    zh: `那份竞价副本不过是有人顺着我的字迹仿了一层，${encodeWeakPointMarker('t3-wp-i', '那份竞价副本不是我泄露出去的')}。`,
                    ja: `あの入札副本は、誰かが私の筆跡をなぞって重ねただけ。${encodeWeakPointMarker('t3-wp-i', 'あの入札副本を漏らしたのは私ではない')}。`,
                    en: `That bid copy is only a forged layer laid over my handwriting; ${encodeWeakPointMarker('t3-wp-i', 'I was not the one who leaked that bid copy')}.`
                }, { portraitState: 'smug_tilt', portraitMotion: 'pop' }),
                line('t3-line-2', {
                    zh: `就算屋顶灯真的亮过，${encodeWeakPointMarker('t3-fake-j', '屋顶照片里的人影不可能是我')}。隔着风雨和噪点，你们连脸都看不清。`,
                    ja: `仮に屋上灯が点いていたとしても、${encodeWeakPointMarker('t3-fake-j', '屋上写真の人影は私ではあり得ない')}。風雨とノイズ越しに、君たちは顔ひとつ見えていない。`,
                    en: `Even if the rooftop light really came on, ${encodeWeakPointMarker('t3-fake-j', 'the figure in the rooftop photo cannot be me')}. Through rain and noise, you cannot even see a face.`
                }, { portraitState: 'defensive_frown', portraitMotion: 'shake_small' }),
                line('t3-line-3', t(
                    '可你们每念一次时间戳，我脑子里就会再响一遍那晚的门锁声。',
                    'だが君たちがタイムスタンプを読むたび、あの夜の電子錠の音が頭の中で鳴り直す。',
                    'But every time you read that timestamp aloud, I hear the lock from that night all over again.'
                ), { portraitState: 'shock_big', portraitMotion: 'bounce' })
            ],
            queryNarratives: [
                t('第三轮测试 glitch + camera_shake 的高压演出。', '第三ラウンドは glitch + camera_shake の高圧演出を検証する。', 'Round three tests high-pressure glitch + camera_shake presentation.'),
                t('第三轮通用调查反馈应继续与失败分支分离。', '第三ラウンド共通調査は失敗分岐と分離を維持する。', 'Round-three inspect feedback should remain separate from failure branches.')
            ],
            queryAvg: [
                avgCue('hero', '第三轮通用调查 AVG。', '第三ラウンド共通調査AVG。', 'Round-three generic inspect AVG.', { portraitState: 'serious_focus', portraitMotion: 'slide_in', screenFilter: 'glitch' }),
                avgCue('system', '请确认镜头冲击与读字稳定性。', '画面インパルス中の可読性を確認せよ。', 'Check readability under screen impulse.', { screenImpulse: 'camera_shake' })
            ],
            inspectOverrides: [],
            successNarrative: t('第三轮通用成功旁白。', '第三ラウンド共通成功ナレーション。', 'Round-three generic success narrative.'),
            successOverrides: [{ weakPointId: 't3-wp-i', narrative: t('竞价副本的外发记录把泄露路径彻底钉实了。', '入札副本の送信記録が、流出経路を完全に固定した。', 'The forwarding record for the bid copy locks the leak path in place.'), avg: [avgCue('system', '竞价副本外发链路，已经论破。', '入札副本の流出チェーンは、これで論破だ。', 'The bid-copy leak chain has been rebutted.', { screenFilter: 'glitch', transition: 'fade' })] }],
            useSeparateTurnClear: false,
            turnClearNarrative: t('第三轮回合结尾，准备进入第四轮隐藏链路测试。', '第三ラウンドターンクリア。第四ラウンドの隠しチェーン検証へ。', 'Round-three clear. Prepare for round-four hidden-chain tests.'),
            turnClearAvg: [avgCue('enemy', '……别再念那张照片的时间戳了。', '……あの写真のタイムスタンプを、これ以上読むな。', '...Stop reading the timestamp on that photograph.', { backgroundSlot: 'hearing', portraitState: 'shock_big', portraitMotion: 'slide_out', transition: 'fade' })],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('第三轮通用失败旁白。', '第三ラウンド共通失敗ナレーション。', 'Round-three generic failure narrative.')),
            logicExplanation: t('第三轮聚焦高压滤镜下的操作稳定性。', '第三ラウンドは高圧フィルター下での操作安定性に焦点を当てる。', 'Round three focuses on interaction stability under heavy visual pressure.'),
            successAvg: [avgCue('hero', '第三轮通用成功 AVG。', '第三ラウンド共通成功AVG。', 'Round-three generic success AVG.', { portraitState: 'angry_attack', portraitMotion: 'shake_small', screenFilter: 'glitch' })],
            failAvg: failAvg([avgCue('enemy', '第三轮通用失败 AVG。', '第三ラウンド共通失敗AVG。', 'Round-three generic failure AVG.', { portraitState: 'shock_big', portraitMotion: 'shake_big', screenFilter: 'glitch', screenImpulse: 'flash' })]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: []
        },
        {
            sceneBackgroundSlot: 'hearing',
            enemyPortraitState: 'polite_smile',
            enemyPortraitMotion: 'slide_in',
            screenFilter: 'monochrome',
            screenImpulse: 'none',
            transition: 'fade',
            weakPoints: [
                { id: 't4-wp-j', lineId: 't4-line-1', statement: t('旧签章作废后谁都能伪造我的口令', '旧い署名が失効した後なら誰でも私のコードを偽装できる', 'Once the old seal was void, anyone could forge my code'), evidenceId: 'evidence-j', consumeEvidenceOnUse: true },
                { id: 't4-fake-k', lineId: 't4-line-2', statement: t('备用口令只是留给值班组的保险', '予備コードは当直班に残した保険に過ぎない', 'The backup code was only a safety net left for the duty team'), evidenceId: '', consumeEvidenceOnUse: true },
                { id: 't4-wp-k', lineId: 't4-line-3', statement: t('封存镜像里的重写时间不是我的', '封印ミラーの書き換え時刻は私のものではない', 'The rewrite timestamp in the sealed mirror is not mine'), evidenceId: 'evidence-k', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t4-line-1', {
                    zh: `你们现在拿一枚旧签章就想把最后一道口令也套给我？${encodeWeakPointMarker('t4-wp-j', '旧签章作废后谁都能伪造我的口令')}。`,
                    ja: `古い署名ひとつで最後のコードまで私に被せるつもり？${encodeWeakPointMarker('t4-wp-j', '旧い署名が失効した後なら誰でも私のコードを偽装できる')}。`,
                    en: `You want to use one obsolete seal to pin the final code on me too? ${encodeWeakPointMarker('t4-wp-j', 'Once the old seal was void, anyone could forge my code')}.`
                }, { portraitState: 'polite_smile', portraitMotion: 'slide_in' }),
                line('t4-line-2', {
                    zh: `那条备用口令本来就是留给值班组的保险，${encodeWeakPointMarker('t4-fake-k', '备用口令只是留给值班组的保险')}。你们别把每一层缓冲都念成阴谋。`,
                    ja: `あの予備コードは当直班へ残した保険にすぎない。${encodeWeakPointMarker('t4-fake-k', '予備コードは当直班に残した保険に過ぎない')}。すべての緩衝層を陰謀みたいに読むのはやめて。`,
                    en: `That backup code was only a safeguard left for the duty team; ${encodeWeakPointMarker('t4-fake-k', 'the backup code was only a safety net left for the duty team')}. Stop reading every layer of redundancy as a conspiracy.`
                }, { portraitState: 'innocent_hand', portraitMotion: 'pop' }),
                line('t4-line-3', {
                    zh: `可你顺着备用口令往封存镜像里一钻，新的重写时间还是自己浮了出来: ${encodeWeakPointMarker('t4-wp-k', '封存镜像里的重写时间不是我的')}。`,
                    ja: `だが予備コードを辿って封印ミラーへ潜ると、新しい書き換え時刻が自分で浮いてくる。${encodeWeakPointMarker('t4-wp-k', '封印ミラーの書き換え時刻は私のものではない')}。`,
                    en: `But the moment you tunnel through the backup code into the sealed mirror, a fresh rewrite timestamp rises by itself: ${encodeWeakPointMarker('t4-wp-k', 'The rewrite timestamp in the sealed mirror is not mine')}.`
                }, { hidden: true, portraitState: 'surprise_small', portraitMotion: 'shake_small' }),
                line('t4-line-4', t(
                    '等第四轮真破绽全部被击穿后，最后那份授权附带批注也跟着掉了出来，像是连我最后那层缓冲都一起碎掉。',
                    '第四ラウンドの真の弱点がすべて砕けた瞬間、最後の認可に添付された注記まで零れ落ちた。まるで私の最後の緩衝層まで一緒に割れたみたいに。',
                    'The instant every true weak point in round four shatters, the annotation attached to the final authorization drops out too, as if my final layer of cushioning cracked with it.'
                ), { hidden: true, unlockMode: 'allTrueWeakPoints', grantEvidenceIds: ['evidence-l'], portraitState: 'breakdown_unstable', portraitMotion: 'shake_big' })
            ],
            queryNarratives: [
                t('第四轮测试两段隐藏链：先调查“备用口令只是留给值班组的保险”，再用《封存镜像签名页》击穿隐藏真破绽，最后掉出《最终授权附带批注》。', '第四ラウンドは二段隠しチェーンの検証。先に「予備コードは当直班の保険だ」を調査し、次に《封印ミラーの署名ページ》で隠し真弱点を砕き、最後に《最終認可の添付注記》が落ちる。', 'Round four tests a two-step hidden chain: inspect "the backup code was only a safety net for the duty team," use the Sealed Mirror Signature Page to break the hidden real weak point, and then drop the Final Authorization Annotation.'),
                t('不先调查备用口令，就拿不到《封存镜像签名页》，隐藏真破绽也不会出现。', '予備コードを先に調査しなければ、《封印ミラーの署名ページ》は手に入らず、隠し真弱点も現れない。', 'Without inspecting the backup code first, you cannot obtain the Sealed Mirror Signature Page and the hidden real weak point never appears.')
            ],
            queryAvg: [
                avgCue('system', '第四轮通用调查 AVG。', '第四ラウンド共通調査AVG。', 'Round-four generic inspect AVG.', { screenFilter: 'monochrome', backgroundSlot: 'hearing' }),
                avgCue('hero', '检查隐藏线展开顺序。', '隠し行展開順を確認。', 'Verify hidden-line expansion order.', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'slide_in' })
            ],
            inspectOverrides: [{
                weakPointId: 't4-fake-k',
                narrative: t('顺着备用口令钻进封存镜像后，你会拿到《封存镜像签名页》，隐藏真破绽也会一起浮出来。', '予備コードを辿って封印ミラーへ潜ると、《封印ミラーの署名ページ》を回収でき、隠し真弱点も浮上する。', 'Follow the backup code into the sealed mirror and you recover the Sealed Mirror Signature Page while the hidden real weak point surfaces.'),
                avg: [avgCue('system', '封存镜像的签名页，已经从镜像底层浮出来了。', '封印ミラーの署名ページが、底層から浮かび上がってきた。', 'The signature page from the sealed mirror has floated up from the deepest layer.', { transition: 'wipe', screenFilter: 'monochrome' })],
                grantEvidenceIds: ['evidence-k'],
                revealLineIds: ['t4-line-3']
            }],
            successNarrative: t('第四轮通用成功旁白。', '第四ラウンド共通成功ナレーション。', 'Round-four generic success narrative.'),
            successOverrides: [
                { weakPointId: 't4-wp-j', narrative: t('旧签章吊销时间一摆出来，“谁都能伪造口令”的说法立刻站不住。', '旧署名の失効時刻を突き付けた瞬間、「誰でもコードを偽装できた」は崩れる。', 'The moment the revocation time of the old seal is shown, the claim that anyone could forge her code falls apart.'), avg: [avgCue('hero', '旧签章作废时间线，已经钉死。', '旧署名の失効タイムラインは、これで固定だ。', 'The revocation timeline of the old seal is pinned down.', { portraitState: 'serious_focus', portraitMotion: 'pop' })] },
                { weakPointId: 't4-wp-k', narrative: t('封存镜像签名页落地后，最后那份《最终授权附带批注》也被一起拖了出来。', '封印ミラーの署名ページが着地した瞬間、最後の《最終認可の添付注記》まで引きずり出された。', 'Once the Sealed Mirror Signature Page lands, the final authorization annotation is dragged out with it.'), avg: [avgCue('system', '检查点：《最终授权附带批注》已发放。', '確認点：《最終認可の添付注記》は付与済み。', 'Checkpoint: Final Authorization Annotation has been granted.', { screenFilter: 'monochrome' })] }
            ],
            useSeparateTurnClear: true,
            turnClearNarrative: t('第四轮独立回合结尾。下一轮进入终局压力测试。', '第四ラウンド独立ターンクリア。次は終局圧力テスト。', 'Round-four separate clear. Next is final pressure test.'),
            turnClearAvg: [avgCue('enemy', '你们已经把我逼到只剩最后一道门了。', '君たちはもう、私を最後の一枚扉の前まで追い込んでいる。', 'You have already driven me back to the final door.', { portraitState: 'breakdown_unstable', portraitMotion: 'slide_out', transition: 'glitch' })],
            useSeparateFailureReasons: true,
            failNarrative: {
                wrongEvidence: t('第四轮 wrongEvidence 失败旁白。', '第四ラウンド wrongEvidence 失敗ナレーション。', 'Round-four wrongEvidence failure narrative.'),
                wrongStatement: t('第四轮 wrongStatement 失败旁白。', '第四ラウンド wrongStatement 失敗ナレーション。', 'Round-four wrongStatement failure narrative.'),
                bothWrong: t('第四轮 bothWrong 失败旁白。', '第四ラウンド bothWrong 失敗ナレーション。', 'Round-four bothWrong failure narrative.')
            },
            logicExplanation: t('第四轮验证“调查备用口令 → 揭示封存镜像签名页 → 击穿隐藏真破绽 → 自动掉出最终授权附带批注”这条组合链路。', '第四ラウンドは「予備コードを調査 → 封印ミラーの署名ページを露出 → 隠し真弱点を撃破 → 最終認可の添付注記を自動ドロップ」という複合チェーンを検証する。', 'Round four verifies the combined chain of inspecting the backup code, revealing the Sealed Mirror Signature Page, breaking the hidden real weak point, and auto-dropping the Final Authorization Annotation.'),
            successAvg: [avgCue('hero', '第四轮通用成功 AVG。', '第四ラウンド共通成功AVG。', 'Round-four generic success AVG.', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'bounce', screenFilter: 'monochrome' })],
            failAvg: {
                wrongEvidence: [avgCue('enemy', '第四轮 wrongEvidence AVG。', '第四ラウンド wrongEvidence AVG。', 'Round-four wrongEvidence AVG.', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenFilter: 'monochrome' })],
                wrongStatement: [avgCue('enemy', '第四轮 wrongStatement AVG。', '第四ラウンド wrongStatement AVG。', 'Round-four wrongStatement AVG.', { portraitState: 'shock_big', portraitMotion: 'shake_big', screenFilter: 'monochrome' })],
                bothWrong: [avgCue('enemy', '第四轮 bothWrong AVG。', '第四ラウンド bothWrong AVG。', 'Round-four bothWrong AVG.', { portraitState: 'angry_attack', portraitMotion: 'shake_big', screenFilter: 'glitch', screenImpulse: 'flash' })]
            },
            failOverrides: {
                wrongEvidence: [{ weakPointId: 't4-wp-k', narrative: t('你拿出的东西对不上封存镜像签名页，隐藏真破绽还没有被真正击穿。', '差し出した証拠は封印ミラーの署名ページと噛み合っておらず、隠し真弱点はまだ砕けていない。', 'What you presented does not match the Sealed Mirror Signature Page, so the hidden real weak point still stands.'), avg: [avgCue('system', '封存镜像这一层，还没有被正确拆开。', '封印ミラーの層は、まだ正しく剥がれていない。', 'The sealed-mirror layer has not been peeled open correctly yet.', { screenFilter: 'monochrome' })] }],
                wrongStatement: [],
                bothWrong: []
            },
            interferenceLines: []
        },
        {
            sceneBackgroundSlot: 'confession',
            enemyPortraitState: 'breakdown_unstable',
            enemyPortraitMotion: 'shake_big',
            screenFilter: 'alert_red',
            screenImpulse: 'flash',
            transition: 'white_flash',
            weakPoints: [
                { id: 't5-wp-l', lineId: 't5-line-1', statement: t('最终授权不是为了掩盖事故', '最終認可は事故を隠すためではない', 'The final authorization was not meant to bury the incident'), evidenceId: 'evidence-l', consumeEvidenceOnUse: true },
                { id: 't5-fake-m', lineId: 't5-line-2', statement: t('我改写记录只是为了保住项目', '記録を書き換えたのは計画を守るためだけだ', 'I rewrote the records only to keep the project alive'), evidenceId: '', consumeEvidenceOnUse: true }
            ],
            loopDialogues: [
                line('t5-line-1', {
                    zh: `你们拿着最终授权就想把一切都钉死？${encodeWeakPointMarker('t5-wp-l', '最终授权不是为了掩盖事故')}。那不过是我替系统争来的最后一点时间。`,
                    ja: `最終認可を掲げて全部を固定するつもり？${encodeWeakPointMarker('t5-wp-l', '最終認可は事故を隠すためではない')}。あれはシステムへ最後の時間を買っただけよ。`,
                    en: `You think holding up the final authorization pins down everything? ${encodeWeakPointMarker('t5-wp-l', 'The final authorization was not meant to bury the incident')}. It was only the last sliver of time I bought for the system.`
                }, { portraitState: 'angry_attack', portraitMotion: 'shake_big' }),
                line('t5-line-2', {
                    zh: `至于那些被我改写的记录，${encodeWeakPointMarker('t5-fake-m', '我改写记录只是为了保住项目')}。项目一旦停下，整栋楼的人都得陪葬。`,
                    ja: `書き換えた記録については、${encodeWeakPointMarker('t5-fake-m', '記録を書き換えたのは計画を守るためだけだ')}。計画が止まれば、この棟全体が道連れになる。`,
                    en: `As for the records I altered, ${encodeWeakPointMarker('t5-fake-m', 'I rewrote the records only to keep the project alive')}. If the project stopped, this whole tower would have gone down with it.`
                }, { portraitState: 'breakdown_unstable', portraitMotion: 'bounce' }),
                line('t5-line-3', t(
                    '……可你们为什么非要把那一晚的警报声，一遍一遍放给我听。',
                    '……どうしてあの夜の警報音を、何度も何度も私に聞かせるの。',
                    '...Why do you insist on playing that alarm from that night for me over and over again?'
                ), { portraitState: 'sad_confession', portraitMotion: 'slide_in' })
            ],
            queryNarratives: [
                t('第五轮为终局压力测试：alert_red + flash + white_flash + 干扰弹窗。', '第五ラウンドは終局圧力テスト：alert_red + flash + white_flash + 妨害ポップアップ。', 'Round five is the final pressure test: alert_red + flash + white_flash + interference popups.'),
                t('请确认强特效下的可读性和交互仍稳定。', '強演出下でも可読性と操作安定性を確認せよ。', 'Confirm readability and interaction stability under heavy effects.')
            ],
            queryAvg: [
                avgCue('hero', '第五轮通用调查 AVG。', '第五ラウンド共通調査AVG。', 'Round-five generic inspect AVG.', { portraitState: 'angry_attack', portraitMotion: 'shake_big', screenFilter: 'alert_red', screenImpulse: 'flash' }),
                avgCue('system', '终局监控：维持可读性。', '終局監視：可読性を維持せよ。', 'Final monitor: maintain readability.', { transition: 'white_flash' })
            ],
            inspectOverrides: [],
            successNarrative: t('第五轮通用成功旁白。', '第五ラウンド共通成功ナレーション。', 'Round-five generic success narrative.'),
            successOverrides: [{ weakPointId: 't5-wp-l', narrative: t('《最终授权附带批注》把她签下这道授权时的真实目的彻底钉死了。', '《最終認可の添付注記》が、この認可に署名した本当の目的を完全に固定した。', 'The Final Authorization Annotation locks in her true motive for signing that authorization.'), avg: [avgCue('system', '最终授权的真实意图，已经论破。', '最終認可の本当の意図は、これで論破だ。', 'The true intent behind the final authorization has been rebutted.', { screenFilter: 'alert_red', transition: 'fade' })] }],
            useSeparateTurnClear: false,
            turnClearNarrative: t('第五轮回合结尾，进入 victory。', '第五ラウンドターンクリア。victory へ。', 'Round-five clear. Entering victory.'),
            turnClearAvg: [avgCue('enemy', '……好，我知道你们下一句要我承认什么。', '……いい。次に何を認めさせたいのか、もう分かっている。', '...Fine. I already know what you want me to admit next.', { backgroundSlot: 'ending', portraitState: 'sad_confession', portraitMotion: 'none', transition: 'fade' })],
            useSeparateFailureReasons: false,
            failNarrative: failNarratives(t('第五轮通用失败旁白。', '第五ラウンド共通失敗ナレーション。', 'Round-five generic failure narrative.')),
            logicExplanation: t('第五轮验证强滤镜、冲击、弹窗干扰共存时判定链路是否稳定。', '第五ラウンドは強フィルター、インパルス、妨害ポップアップ共存時の判定安定性を検証する。', 'Round five verifies judgment stability under combined heavy filters, impulses, and popup interference.'),
            successAvg: [avgCue('hero', '第五轮通用成功 AVG。', '第五ラウンド共通成功AVG。', 'Round-five generic success AVG.', { portraitState: 'serious_focus', portraitMotion: 'slide_in', screenFilter: 'alert_red' })],
            failAvg: failAvg([avgCue('enemy', '第五轮通用失败 AVG。', '第五ラウンド共通失敗AVG。', 'Round-five generic failure AVG.', { portraitState: 'breakdown_unstable', portraitMotion: 'shake_big', screenFilter: 'alert_red', screenImpulse: 'flash' })]),
            failOverrides: emptyFailOverrides(),
            interferenceLines: [
                t('终局干扰弹窗 1：SCANLINE JITTER', '終局妨害ポップアップ1：SCANLINE JITTER', 'Final interference popup 1: SCANLINE JITTER'),
                t('终局干扰弹窗 2：SIGNAL ECHO', '終局妨害ポップアップ2：SIGNAL ECHO', 'Final interference popup 2: SIGNAL ECHO'),
                t('终局干扰弹窗 3：FRAME DESYNC', '終局妨害ポップアップ3：FRAME DESYNC', 'Final interference popup 3: FRAME DESYNC'),
                t('终局干扰弹窗 4：NOISE BURST', '終局妨害ポップアップ4：NOISE BURST', 'Final interference popup 4: NOISE BURST')
            ]
        }
    ],
    victory: {
        backgroundSlot: 'ending',
        screenFilter: 'dim',
        transition: 'fade',
        narrative: t('从最初的值守缺口、恢复日志里的覆写痕，到最后附在授权上的那段批注，整条证据链终于全部扣回她身上。测试嫌疑人承认自己为了让项目继续滚动，篡改记录、伪造授权，并把本该中止的事故硬生生推了下去。', '最初の離席ログ欠落、復元ログの上書き痕、そして認可に添付された最後の注記まで、証拠の鎖はついに彼女の上で閉じた。テスト容疑者は、計画を転がし続けるために記録を改ざんし、認可を偽造し、本来止めるべき事故を無理やり押し進めたと認める。', 'From the opening leave-gap, through the overwrite trace in the restored log, to the annotation attached to the final authorization, the evidence chain finally closes on her. The test suspect admits she altered records, forged authorization, and forced an incident to continue when it should have been stopped, all to keep the project moving.'),
        confession: t('是，我改了那串记录，也签了最后一道授权。我以为只要把一切埋进系统噪声里，倒下去的就只会是一个“可以被项目替换的人”。可你们把离席缺口、覆写痕、镜像签名页，还有那份附带批注，全都一段段接回来了，已经没有任何东西肯替我继续说谎。', 'そうよ。私はあの記録列を書き換え、最後の認可にも署名した。全部をシステムノイズへ埋めてしまえば、倒れるのは「計画で置き換えられる一人」だけで済むと思っていた。でも君たちは、離席ログの欠落も、上書き痕も、ミラーの署名ページも、あの添付注記までも、一つずつ繋ぎ直した。もうどの断片も私の代わりに嘘をついてくれない。', 'Yes. I rewrote that chain of records, and I signed the final authorization. I thought that if I buried everything under system noise, the only thing to fall would be one person the project could afford to replace. But you stitched back the leave-gap, the overwrite trace, the mirror signature page, and even that attached annotation, piece by piece. Nothing is willing to lie for me anymore.'),
        avg: [
            avgCue('enemy', '够了……别再把那些记录和批注一条条念给我听了。每念一次，我都像又把那道门亲手关上一遍。', 'もういい……あの記録や注記を、これ以上ひとつずつ読み上げないで。読まれるたびに、私がまたあの扉を閉め直しているみたいになる。', 'Enough... stop reading those records and annotations back to me one by one. Every time you do, it feels like I am closing that door with my own hands again.', { portraitState: 'breakdown_unstable', portraitMotion: 'shake_small', screenFilter: 'dim' }),
            avgCue('enemy', '是我签的，也是我推的。不是因为系统逼我，是因为我先决定让一个人替项目让路。', '署名したのも、押し進めたのも私。システムに追われたからじゃない。私が先に、一人を計画のために退かせると決めたの。', 'I signed it, and I pushed it through. Not because the system forced me, but because I chose first to move one person out of the project\'s way.', { portraitState: 'sad_confession', portraitMotion: 'slide_out', screenFilter: 'dim' }),
            avgCue('hero', '现在你终于不是在测试系统，而是在对自己的决定作证。', 'これでようやく、君はシステムではなく自分の選択へ証言している。', 'Now you are finally testifying not about the system, but about your own decision.', { portraitState: 'serious_focus' }),
            avgCue('system', '扩展功能测试完成：调查、隐藏线、掉证据、复用证据、具体物证链与终局自白流程全部闭合。', '拡張機能テスト完了：調査、隠し行、証拠ドロップ、再利用証拠、具体的な物証チェーン、終局自白フローまで全閉合。', 'Expanded feature test complete: inspect branches, hidden lines, evidence drops, reusable evidence, concrete evidence-chain logic, and the final-confession flow all closed.', { screenFilter: 'dim' })
        ]
    }
};

const expectById = <T extends { id: string }>(items: T[], id: string): T => {
    const item = items.find(entry => entry.id === id);
    if (!item) {
        throw new Error(`Missing regression-case item "${id}".`);
    }
    return item;
};

const applyPureRegressionTestText = (caseData: LocalCaseData) => {
    const tt = (zh: string): LocalizedText => t(zh, zh, zh);
    const avgZh = (
        speaker: AvgLine['speaker'],
        zh: string,
        cue: Partial<Omit<AvgLine, 'speaker' | 'text'>> = {}
    ) => avgCue(speaker, zh, zh, zh, cue);
    const evidence = (id: string) => expectById(caseData.evidences, id);
    const dialogue = (turnIndex: number, id: string) => expectById(caseData.turns[turnIndex].loopDialogues, id);
    const weakPoint = (turnIndex: number, id: string) => expectById(caseData.turns[turnIndex].weakPoints, id);

    caseData.caseTitle = tt('纯测试回归剧本');
    caseData.suspectName = tt('测试嫌疑人');
    caseData.enemyPortraitPackId = 'debug-enemy-readout';
    caseData.intro.narrative = tt('这是一份纯测试文案剧本：所有证据与破绽按字母一一对应，用来验证调查、隐藏台词、掉证据、复用证据、AVG 表情推进和终局自白。');
    caseData.intro.systemMsg = tt('推荐顺序：证据A → 调查项B → 隐藏破绽D → 证据E / 证据F → 调查项G → 隐藏破绽H → 证据I → 证据J → 调查项K → 隐藏破绽K → 证据L。');

    Object.assign(evidence('evidence-a'), { name: tt('证据A'), detail: tt('对应破绽A：我昨晚根本没离开主控台。') });
    Object.assign(evidence('evidence-d'), { name: tt('证据D'), detail: tt('调查项B成功后掉落，对应隐藏破绽D。') });
    Object.assign(evidence('evidence-e'), { name: tt('证据E'), detail: tt('对应破绽E：机柜门不是我开的。') });
    Object.assign(evidence('evidence-f'), { name: tt('证据F'), detail: tt('对应破绽F：那条指令不是我签发的。本证据会保留。') });
    Object.assign(evidence('evidence-h'), { name: tt('证据H'), detail: tt('调查项G成功后掉落，对应隐藏破绽H。') });
    Object.assign(evidence('evidence-i'), { name: tt('证据I'), detail: tt('第二轮真破绽全部击破后掉落，对应第三轮破绽I。') });
    Object.assign(evidence('evidence-j'), { name: tt('证据J'), detail: tt('对应破绽J：旧签章作废后谁都能伪造我的口令。') });
    Object.assign(evidence('evidence-k'), { name: tt('证据K'), detail: tt('调查项K成功后掉落，对应隐藏破绽K。') });
    Object.assign(evidence('evidence-l'), { name: tt('证据L'), detail: tt('第四轮真破绽全部击破后掉落，对应终局破绽L。') });

    Object.assign(weakPoint(0, 't1-wp-a'), { statement: tt('破绽A：我昨晚根本没离开主控台') });
    Object.assign(weakPoint(0, 't1-fake-b'), { statement: tt('调查项B：恢复日志只是系统抖动') });
    Object.assign(weakPoint(0, 't1-fake-c'), { statement: tt('调查项C：备份区的越权记录与我无关') });
    Object.assign(weakPoint(0, 't1-wp-d'), { statement: tt('隐藏破绽D：最后一道校验不是我覆写的') });
    Object.assign(dialogue(0, 't1-line-1'), { text: tt(`测试台词A：${encodeWeakPointMarker('t1-wp-a', '破绽A：我昨晚根本没离开主控台')}。`) });
    Object.assign(dialogue(0, 't1-line-2'), { text: tt(`测试台词B：${encodeWeakPointMarker('t1-fake-b', '调查项B：恢复日志只是系统抖动')}。调查成功后应掉落证据D并揭示隐藏台词D。`) });
    Object.assign(dialogue(0, 't1-line-3'), { text: tt(`测试台词C：${encodeWeakPointMarker('t1-fake-c', '调查项C：备份区的越权记录与我无关')}。这是额外调查用假破绽。`) });
    Object.assign(dialogue(0, 't1-line-4'), { text: tt(`隐藏台词D：${encodeWeakPointMarker('t1-wp-d', '隐藏破绽D：最后一道校验不是我覆写的')}。`) });
    caseData.turns[0].queryNarratives = [tt('第一轮调查反馈：优先调查 B，确认能否掉落证据D。'), tt('第一轮调查反馈：A 与隐藏 D 都应能独立击破。')];
    caseData.turns[0].queryAvg = [avgZh('hero', '第一轮 AVG：先打 A，再调查 B，最后打 D。', { portraitState: 'serious_focus', portraitMotion: 'slide_in' }), avgZh('enemy', '第一轮 AVG 表情：冷静到轻微警惕。', { portraitState: 'polite_smile', portraitMotion: 'pop' })];
    caseData.turns[0].inspectOverrides[0].narrative = tt('测试结果：调查项B成功，证据D掉落，隐藏台词D已揭示。');
    caseData.turns[0].inspectOverrides[0].avg = [avgZh('enemy', '调查项B已命中，隐藏台词D现在应可见。', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'shake_small' })];
    caseData.turns[0].successNarrative = tt('第一轮成功反馈：本轮真破绽击破正常。');
    caseData.turns[0].successOverrides[0].narrative = tt('测试结果：证据A对应破绽A，命中成功。');
    caseData.turns[0].successOverrides[0].avg = [avgZh('hero', '证据A → 破绽A：成功。', { portraitState: 'angry_attack', portraitMotion: 'pop', screenImpulse: 'zoom_punch' })];
    caseData.turns[0].successOverrides[1].narrative = tt('测试结果：证据D对应隐藏破绽D，且证据D被消耗。');
    caseData.turns[0].successOverrides[1].avg = [avgZh('enemy', '隐藏破绽D被击穿，表情应切到惊讶。', { portraitState: 'surprise_small', portraitMotion: 'shake_small', screenFilter: 'noise' })];
    caseData.turns[0].turnClearNarrative = tt('第一轮回合结尾：进入第二轮双真破绽测试。');
    caseData.turns[0].turnClearAvg = [avgZh('enemy', '第一轮结束：表情开始转为防御。', { portraitState: 'defensive_frown', portraitMotion: 'slide_out' })];
    caseData.turns[0].failNarrative = failNarratives(tt('第一轮失败反馈：请检查 A、B、D 的对应关系。'));
    caseData.turns[0].logicExplanation = tt('第一轮测试点：基础论破 A、调查掉落 D、隐藏台词 D。');
    caseData.turns[0].successAvg = [avgZh('hero', '第一轮成功 AVG：基础动作与表情切换正常。', { portraitState: 'serious_focus', portraitMotion: 'bounce', screenFilter: 'scanline' })];
    caseData.turns[0].failAvg = failAvg([avgZh('enemy', '第一轮失败 AVG：保持基础防御表情。', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenFilter: 'scanline' })]);

    Object.assign(weakPoint(1, 't2-wp-e'), { statement: tt('破绽E：机柜门不是我开的') });
    Object.assign(weakPoint(1, 't2-wp-f'), { statement: tt('破绽F：那条指令不是我签发的') });
    Object.assign(weakPoint(1, 't2-fake-g'), { statement: tt('调查项G：外联报码只是例行测试') });
    Object.assign(weakPoint(1, 't2-wp-h'), { statement: tt('隐藏破绽H：暗网回执里的确认码不是我发的') });
    Object.assign(dialogue(1, 't2-line-1'), { text: tt(`测试台词E/F：${encodeWeakPointMarker('t2-wp-e', '破绽E：机柜门不是我开的')}，并且${encodeWeakPointMarker('t2-wp-f', '破绽F：那条指令不是我签发的')}。`) });
    Object.assign(dialogue(1, 't2-line-2'), { text: tt(`测试台词G：${encodeWeakPointMarker('t2-fake-g', '调查项G：外联报码只是例行测试')}。调查成功后应掉落证据H。`) });
    Object.assign(dialogue(1, 't2-line-3'), { text: tt(`隐藏台词H：${encodeWeakPointMarker('t2-wp-h', '隐藏破绽H：暗网回执里的确认码不是我发的')}。`) });
    caseData.turns[1].queryNarratives = [tt('第二轮调查反馈：E 与 F 同行并存，需分别击破。'), tt('第二轮调查反馈：先调查 G，再击破隐藏 H。')];
    caseData.turns[1].queryAvg = [avgZh('hero', '第二轮 AVG：验证 E/F 双真破绽和 H 的掉证据链。', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'slide_in' }), avgZh('enemy', '第二轮 AVG 表情：开始从严肃转向防御。', { portraitState: 'serious_focus', portraitMotion: 'pop' })];
    caseData.turns[1].inspectOverrides[0].narrative = tt('测试结果：调查项G成功，证据H掉落。');
    caseData.turns[1].inspectOverrides[0].avg = [avgZh('enemy', '调查项G已命中，接下来应能击破隐藏 H。', { portraitState: 'innocent_hand', portraitMotion: 'bounce', screenFilter: 'noise' })];
    caseData.turns[1].successNarrative = tt('第二轮成功反馈：E、F、H 的链路判定正常。');
    caseData.turns[1].successOverrides[0].narrative = tt('测试结果：证据E对应破绽E，命中成功。');
    caseData.turns[1].successOverrides[0].avg = [avgZh('hero', '证据E → 破绽E：成功。', { portraitState: 'angry_attack', portraitMotion: 'shake_small', screenImpulse: 'camera_shake' })];
    caseData.turns[1].successOverrides[1].narrative = tt('测试结果：证据F对应破绽F，且证据F不被消耗。');
    caseData.turns[1].successOverrides[1].avg = [avgZh('hero', '证据F → 破绽F：成功，证据保留。', { portraitState: 'serious_focus', portraitMotion: 'bounce', screenFilter: 'noise' })];
    caseData.turns[1].turnClearNarrative = tt('第二轮回合结尾：掉落证据I，进入第三轮高压测试。');
    caseData.turns[1].turnClearAvg = [avgZh('enemy', '第二轮结束：表情进入明显防御阶段。', { backgroundSlot: 'reveal', portraitState: 'defensive_frown', portraitMotion: 'shake_small', transition: 'glitch' })];
    caseData.turns[1].failNarrative = { wrongEvidence: tt('第二轮失败反馈：你选错了证据，请重新核对 E/F/H。'), wrongStatement: tt('第二轮失败反馈：你点错了台词，请重新核对 E/F/H。'), bothWrong: tt('第二轮失败反馈：证据和台词都不对。') };
    caseData.turns[1].logicExplanation = tt('第二轮测试点：同一行双真破绽 E/F、调查项 G 掉落 H、证据F复用。');
    caseData.turns[1].successAvg = [avgZh('hero', '第二轮成功 AVG：双真破绽与复用证据测试正常。', { portraitState: 'serious_focus', portraitMotion: 'bounce', screenFilter: 'noise' })];
    caseData.turns[1].failAvg = {
        wrongEvidence: [avgZh('enemy', '第二轮 wrongEvidence AVG：表情应切到惊愕。', { portraitState: 'shock_big', portraitMotion: 'shake_big', screenFilter: 'noise' })],
        wrongStatement: [avgZh('enemy', '第二轮 wrongStatement AVG：保持防御表情。', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenFilter: 'noise' })],
        bothWrong: [avgZh('enemy', '第二轮 bothWrong AVG：进入更强的攻击反应。', { portraitState: 'angry_attack', portraitMotion: 'shake_big', screenFilter: 'glitch', screenImpulse: 'flash' })]
    };
    caseData.turns[1].failOverrides = { wrongEvidence: [{ weakPointId: 't2-wp-e', narrative: tt('测试结果：你给破绽E用了错误证据。'), avg: [avgZh('enemy', '破绽E wrongEvidence：请重新选择证据E。', { portraitState: 'shock_big', portraitMotion: 'shake_small', screenFilter: 'noise' })] }], wrongStatement: [], bothWrong: [] };

    Object.assign(weakPoint(2, 't3-wp-i'), { statement: tt('破绽I：那份竞价副本不是我泄露出去的') });
    Object.assign(weakPoint(2, 't3-fake-j'), { statement: tt('调查项X：屋顶照片里的人影不可能是我') });
    Object.assign(dialogue(2, 't3-line-1'), { text: tt(`测试台词I：${encodeWeakPointMarker('t3-wp-i', '破绽I：那份竞价副本不是我泄露出去的')}。`) });
    Object.assign(dialogue(2, 't3-line-2'), { text: tt(`测试台词X：${encodeWeakPointMarker('t3-fake-j', '调查项X：屋顶照片里的人影不可能是我')}。这是第三轮干扰调查项。`) });
    Object.assign(dialogue(2, 't3-line-3'), { text: tt('第三轮压力台词：用于测试 glitch、camera_shake 与高压表情。') });
    caseData.turns[2].queryNarratives = [tt('第三轮调查反馈：证据I应直接对应破绽I。'), tt('第三轮调查反馈：调查项X仅用于干扰，不会掉新证据。')];
    caseData.turns[2].queryAvg = [avgZh('hero', '第三轮 AVG：检查高压特效下的点击稳定性。', { portraitState: 'serious_focus', portraitMotion: 'slide_in', screenFilter: 'glitch' }), avgZh('enemy', '第三轮 AVG 表情：从防御进入明显受压。', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenImpulse: 'camera_shake' })];
    caseData.turns[2].successNarrative = tt('第三轮成功反馈：证据I对应破绽I，判定正常。');
    caseData.turns[2].successOverrides = [{ weakPointId: 't3-wp-i', narrative: tt('测试结果：证据I对应破绽I，命中成功。'), avg: [avgZh('enemy', '证据I命中后，表情应明显转向惊愕。', { portraitState: 'shock_big', portraitMotion: 'bounce', screenFilter: 'glitch' })] }];
    caseData.turns[2].turnClearNarrative = tt('第三轮回合结尾：进入第四轮隐藏链测试。');
    caseData.turns[2].turnClearAvg = [avgZh('enemy', '第三轮结束：高压阶段已触发表情失稳。', { backgroundSlot: 'hearing', portraitState: 'shock_big', portraitMotion: 'slide_out', transition: 'fade' })];
    caseData.turns[2].failNarrative = failNarratives(tt('第三轮失败反馈：请重新核对证据I与破绽I。'));
    caseData.turns[2].logicExplanation = tt('第三轮测试点：证据I直打破绽I，同时观察高压滤镜和惊愕表情。');
    caseData.turns[2].successAvg = [avgZh('hero', '第三轮成功 AVG：高压阶段操作和表情切换正常。', { portraitState: 'angry_attack', portraitMotion: 'shake_small', screenFilter: 'glitch' })];
    caseData.turns[2].failAvg = failAvg([avgZh('enemy', '第三轮失败 AVG：维持惊愕并加强抖动。', { portraitState: 'shock_big', portraitMotion: 'shake_big', screenFilter: 'glitch', screenImpulse: 'flash' })]);

    Object.assign(weakPoint(3, 't4-wp-j'), { statement: tt('破绽J：旧签章作废后谁都能伪造我的口令') });
    Object.assign(weakPoint(3, 't4-fake-k'), { statement: tt('调查项K：备用口令只是留给值班组的保险') });
    Object.assign(weakPoint(3, 't4-wp-k'), { statement: tt('隐藏破绽K：封存镜像里的重写时间不是我的') });
    Object.assign(dialogue(3, 't4-line-1'), { text: tt(`测试台词J：${encodeWeakPointMarker('t4-wp-j', '破绽J：旧签章作废后谁都能伪造我的口令')}。`) });
    Object.assign(dialogue(3, 't4-line-2'), { text: tt(`测试台词K：${encodeWeakPointMarker('t4-fake-k', '调查项K：备用口令只是留给值班组的保险')}。调查成功后应掉落证据K并揭示隐藏台词K。`) });
    Object.assign(dialogue(3, 't4-line-3'), { text: tt(`隐藏台词K：${encodeWeakPointMarker('t4-wp-k', '隐藏破绽K：封存镜像里的重写时间不是我的')}。`) });
    Object.assign(dialogue(3, 't4-line-4'), { text: tt('第四轮自动掉落提示：真破绽全部击破后应自动掉落证据L。') });
    caseData.turns[3].queryNarratives = [tt('第四轮调查反馈：先调查 K，再用证据K击破隐藏破绽K。'), tt('第四轮调查反馈：J 与隐藏 K 全部完成后，自动掉落证据L。')];
    caseData.turns[3].queryAvg = [avgZh('hero', '第四轮 AVG：这是隐藏链路测试。', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'slide_in' }), avgZh('enemy', '第四轮 AVG 表情：伪装平静开始出现裂缝。', { portraitState: 'polite_smile', portraitMotion: 'slide_in' })];
    caseData.turns[3].inspectOverrides[0].narrative = tt('测试结果：调查项K成功，证据K掉落，隐藏台词K已揭示。');
    caseData.turns[3].inspectOverrides[0].avg = [avgZh('enemy', '调查项K已命中，表情应转入明显动摇。', { portraitState: 'surprise_small', portraitMotion: 'shake_small', screenFilter: 'monochrome' })];
    caseData.turns[3].successNarrative = tt('第四轮成功反馈：J、隐藏K、自动掉L 的链路判定正常。');
    caseData.turns[3].successOverrides[0].narrative = tt('测试结果：证据J对应破绽J，命中成功。');
    caseData.turns[3].successOverrides[0].avg = [avgZh('hero', '证据J → 破绽J：成功。', { portraitState: 'serious_focus', portraitMotion: 'pop' })];
    caseData.turns[3].successOverrides[1].narrative = tt('测试结果：证据K对应隐藏破绽K，且证据L应自动掉落。');
    caseData.turns[3].successOverrides[1].avg = [avgZh('enemy', '隐藏破绽K被击穿后，表情应进入破防阶段。', { portraitState: 'breakdown_unstable', portraitMotion: 'shake_big', screenFilter: 'monochrome' })];
    caseData.turns[3].turnClearNarrative = tt('第四轮回合结尾：证据L已就位，进入终局。');
    caseData.turns[3].turnClearAvg = [avgZh('enemy', '第四轮结束：正式进入破防表情段。', { portraitState: 'breakdown_unstable', portraitMotion: 'slide_out', transition: 'glitch' })];
    caseData.turns[3].failNarrative = { wrongEvidence: tt('第四轮失败反馈：你选错了证据，请重新核对 J / K / L 链。'), wrongStatement: tt('第四轮失败反馈：你点错了台词，请重新核对 J / K / L 链。'), bothWrong: tt('第四轮失败反馈：证据和台词都不对。') };
    caseData.turns[3].logicExplanation = tt('第四轮测试点：调查项K掉证据K、隐藏破绽K、自动掉证据L。');
    caseData.turns[3].successAvg = [avgZh('hero', '第四轮成功 AVG：隐藏链路与破防表情切换正常。', { portraitState: 'thinking_hand_to_chin', portraitMotion: 'bounce', screenFilter: 'monochrome' })];
    caseData.turns[3].failAvg = { wrongEvidence: [avgZh('enemy', '第四轮 wrongEvidence AVG：仍处在防御到动摇之间。', { portraitState: 'defensive_frown', portraitMotion: 'shake_small', screenFilter: 'monochrome' })], wrongStatement: [avgZh('enemy', '第四轮 wrongStatement AVG：切到惊愕表情。', { portraitState: 'shock_big', portraitMotion: 'shake_big', screenFilter: 'monochrome' })], bothWrong: [avgZh('enemy', '第四轮 bothWrong AVG：进入激烈崩坏反应。', { portraitState: 'angry_attack', portraitMotion: 'shake_big', screenFilter: 'glitch', screenImpulse: 'flash' })] };
    caseData.turns[3].failOverrides = { wrongEvidence: [{ weakPointId: 't4-wp-k', narrative: tt('测试结果：隐藏破绽K使用了错误证据。'), avg: [avgZh('enemy', '隐藏破绽K wrongEvidence：请重新选择证据K。', { portraitState: 'shock_big', portraitMotion: 'shake_small', screenFilter: 'monochrome' })] }], wrongStatement: [], bothWrong: [] };

    Object.assign(weakPoint(4, 't5-wp-l'), { statement: tt('破绽L：最终授权不是为了掩盖事故') });
    Object.assign(weakPoint(4, 't5-fake-m'), { statement: tt('调查项M：我改写记录只是为了保住项目') });
    Object.assign(dialogue(4, 't5-line-1'), { text: tt(`测试台词L：${encodeWeakPointMarker('t5-wp-l', '破绽L：最终授权不是为了掩盖事故')}。`) });
    Object.assign(dialogue(4, 't5-line-2'), { text: tt(`测试台词M：${encodeWeakPointMarker('t5-fake-m', '调查项M：我改写记录只是为了保住项目')}。这是终局前的最后干扰项。`) });
    Object.assign(dialogue(4, 't5-line-3'), { text: tt('终局前置台词：下一次命中应直接进入自白。') });
    caseData.turns[4].queryNarratives = [tt('第五轮调查反馈：证据L应直接对应破绽L。'), tt('第五轮调查反馈：调查项M仅用于终局前干扰。')];
    caseData.turns[4].queryAvg = [avgZh('hero', '第五轮 AVG：只验证 L 与终局自白。', { portraitState: 'angry_attack', portraitMotion: 'shake_big', screenFilter: 'alert_red', screenImpulse: 'flash' }), avgZh('enemy', '第五轮 AVG 表情：从崩坏进入认罪前夕。', { portraitState: 'breakdown_unstable', portraitMotion: 'bounce' })];
    caseData.turns[4].successNarrative = tt('第五轮成功反馈：证据L对应破绽L，终局闭合。');
    caseData.turns[4].successOverrides = [{ weakPointId: 't5-wp-l', narrative: tt('测试结果：证据L对应破绽L，接下来应直接进入自白。'), avg: [avgZh('enemy', '证据L命中后，表情应从崩坏收束到认罪。', { portraitState: 'sad_confession', portraitMotion: 'slide_out', screenFilter: 'alert_red', transition: 'fade' })] }];
    caseData.turns[4].turnClearNarrative = tt('第五轮回合结尾：进入 victory。');
    caseData.turns[4].turnClearAvg = [avgZh('enemy', '第五轮结束：表情已进入认罪前静止。', { backgroundSlot: 'ending', portraitState: 'sad_confession', portraitMotion: 'none', transition: 'fade' })];
    caseData.turns[4].failNarrative = failNarratives(tt('第五轮失败反馈：请重新核对证据L与破绽L。'));
    caseData.turns[4].logicExplanation = tt('第五轮测试点：证据L直打破绽L，并直接进入终局自白。');
    caseData.turns[4].successAvg = [avgZh('hero', '第五轮成功 AVG：终局前的最后一次判定正常。', { portraitState: 'serious_focus', portraitMotion: 'slide_in', screenFilter: 'alert_red' })];
    caseData.turns[4].failAvg = failAvg([avgZh('enemy', '第五轮失败 AVG：保持崩坏表情并加强压迫。', { portraitState: 'breakdown_unstable', portraitMotion: 'shake_big', screenFilter: 'alert_red', screenImpulse: 'flash' })]);

    caseData.victory.narrative = tt('纯测试结果：证据A 到 证据L 的链路全部闭合，所有测试回合通过。');
    caseData.victory.confession = tt('测试自白：我承认，A 到 L 的全部链路都已经被你们完整跑通。现在应播放终局自白表情与收束演出。');
    caseData.victory.avg = [
        avgZh('enemy', '终局 AVG 1：破防表情保持。', { portraitState: 'breakdown_unstable', portraitMotion: 'shake_small', screenFilter: 'dim' }),
        avgZh('enemy', '终局 AVG 2：切换到认罪表情。', { portraitState: 'sad_confession', portraitMotion: 'slide_out', screenFilter: 'dim' }),
        avgZh('hero', '终局 AVG 3：主角表情回到严肃确认。', { portraitState: 'serious_focus' }),
        avgZh('system', '纯测试闭合：调查、隐藏线、掉证据、复用证据、AVG 表情推进、终局自白全部通过。', { screenFilter: 'dim' })
    ];
};

applyPureRegressionTestText(regressionCase);

const cases: Array<{ filename: string; data: LocalCaseData }> = [
    { filename: 'starfall-forgery.case.txt', data: starfallForgery },
    { filename: 'midnight-auction.case.txt', data: midnightAuction },
    { filename: 'gemini.case.txt', data: hollowWard },
    { filename: 'ceshi.case.txt', data: regressionCase }
];

for (const entry of cases) {
    const serialized = serializeLocalCaseText(entry.data);
    parseLocalCaseText(serialized);
    writeFileSync(join(outDir, entry.filename), serialized, 'utf8');
    console.log(`rewrote ${entry.filename}`);
}

