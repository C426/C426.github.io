import { Language } from './types';

type LocalizedText = { [key in Language]: string };

interface LegacyEvidence {
    id: string;
    name: LocalizedText;
    detail: LocalizedText;
    icon: string;
}

interface LegacyTurn {
    correctEvidenceId: string;
    correctLogicText: LocalizedText;
    successSysMsg: LocalizedText;
    nextSuspectMsg: LocalizedText;
}

interface LegacyCase {
    evidences: LegacyEvidence[];
    intro: {
        systemMsg: LocalizedText;
        suspectMsg: LocalizedText;
    };
    turns: LegacyTurn[];
}

const textFor = (text: LocalizedText, lang: Language): string => text[lang] || text.en;

export const LOCAL_CASE: LegacyCase = {
    evidences: [
        {
            id: 'muddy-ball',
            name: { zh: 'Muddy Baseball', ja: 'Muddy Baseball', en: 'Muddy Baseball' },
            detail: {
                zh: 'Found near the broken vase and covered in mud.',
                ja: 'Found near the broken vase and covered in mud.',
                en: 'Found near the broken vase and covered in mud.'
            },
            icon: '⚾'
        },
        {
            id: 'wet-shoes',
            name: { zh: 'Wet Shoes', ja: 'Wet Shoes', en: 'Wet Shoes' },
            detail: {
                zh: "The suspect's shoes are wet and muddy.",
                ja: "The suspect's shoes are wet and muddy.",
                en: "The suspect's shoes are wet and muddy."
            },
            icon: '👟'
        },
        {
            id: 'weather',
            name: { zh: 'Weather Report', ja: 'Weather Report', en: 'Weather Report' },
            detail: {
                zh: 'Rain started at noon, but morning ground was dry.',
                ja: 'Rain started at noon, but morning ground was dry.',
                en: 'Rain started at noon, but morning ground was dry.'
            },
            icon: '🌧️'
        }
    ],
    intro: {
        systemMsg: {
            zh: 'Interrogation starts now.',
            ja: 'Interrogation starts now.',
            en: 'Interrogation starts now.'
        },
        suspectMsg: {
            zh: 'I never went outside and I did not break the vase.',
            ja: 'I never went outside and I did not break the vase.',
            en: 'I never went outside and I did not break the vase.'
        }
    },
    turns: [
        {
            correctEvidenceId: 'wet-shoes',
            correctLogicText: { zh: 'never went outside', ja: 'never went outside', en: 'never went outside' },
            successSysMsg: {
                zh: 'Contradiction found: your shoes are wet and muddy.',
                ja: 'Contradiction found: your shoes are wet and muddy.',
                en: 'Contradiction found: your shoes are wet and muddy.'
            },
            nextSuspectMsg: {
                zh: 'Fine, I went out for a walk, but did not play sports.',
                ja: 'Fine, I went out for a walk, but did not play sports.',
                en: 'Fine, I went out for a walk, but did not play sports.'
            }
        },
        {
            correctEvidenceId: 'muddy-ball',
            correctLogicText: { zh: 'did not play sports', ja: 'did not play sports', en: 'did not play sports' },
            successSysMsg: {
                zh: 'Contradiction found: a muddy baseball was at the scene.',
                ja: 'Contradiction found: a muddy baseball was at the scene.',
                en: 'Contradiction found: a muddy baseball was at the scene.'
            },
            nextSuspectMsg: {
                zh: 'I played in the morning, and someone else broke it later.',
                ja: 'I played in the morning, and someone else broke it later.',
                en: 'I played in the morning, and someone else broke it later.'
            }
        },
        {
            correctEvidenceId: 'weather',
            correctLogicText: { zh: 'played in the morning', ja: 'played in the morning', en: 'played in the morning' },
            successSysMsg: {
                zh: 'Final contradiction: mud could not be there before noon rain.',
                ja: 'Final contradiction: mud could not be there before noon rain.',
                en: 'Final contradiction: mud could not be there before noon rain.'
            },
            nextSuspectMsg: {
                zh: 'Alright, I broke the vase. I confess.',
                ja: 'Alright, I broke the vase. I confess.',
                en: 'Alright, I broke the vase. I confess.'
            }
        }
    ]
};

export class LocalGameEngine {
    private turnIndex = 0;
    private lang: Language;

    constructor(lang: Language) {
        this.lang = lang;
    }

    getIntroData() {
        return {
            systemMsg: textFor(LOCAL_CASE.intro.systemMsg, this.lang),
            suspectMsg: textFor(LOCAL_CASE.intro.suspectMsg, this.lang),
            evidences: LOCAL_CASE.evidences.map(ev => ({
                name: textFor(ev.name, this.lang),
                detail: textFor(ev.detail, this.lang),
                icon: ev.icon
            }))
        };
    }

    processObjection(evidenceName: string, statement: string): {
        success: boolean;
        systemMsg: string;
        suspectMsg?: string;
        isGameOver?: boolean;
    } {
        const currentTurn = LOCAL_CASE.turns[this.turnIndex];
        const expectedEvidenceName = textFor(
            LOCAL_CASE.evidences.find(ev => ev.id === currentTurn.correctEvidenceId)!.name,
            this.lang
        );
        const expectedLogic = textFor(currentTurn.correctLogicText, this.lang).toLowerCase();

        const evidenceOk = evidenceName.trim().toLowerCase() === expectedEvidenceName.toLowerCase();
        const logicOk = statement.toLowerCase().includes(expectedLogic);

        if (evidenceOk && logicOk) {
            this.turnIndex += 1;
            const isGameOver = this.turnIndex >= LOCAL_CASE.turns.length;
            return {
                success: true,
                systemMsg: textFor(currentTurn.successSysMsg, this.lang),
                suspectMsg: textFor(currentTurn.nextSuspectMsg, this.lang),
                isGameOver
            };
        }

        return {
            success: false,
            systemMsg: 'This evidence does not contradict the selected statement.'
        };
    }
}
