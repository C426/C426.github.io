import React, { useEffect, useState } from 'react';
import { Language, AvgDialogueLine } from '../types';
import { TypingBlock } from './TypingBlock';
import { RuntimeSceneState } from '../services/sceneAssetTypes';
import { ScenePortrait } from './ScenePortrait';

interface AvgDialoguePanelProps {
    lang: Language;
    line: AvgDialogueLine;
    scene: RuntimeSceneState;
    onNext: () => void;
}

const speakerLabel: Record<Language, Record<AvgDialogueLine['speaker'], string>> = {
    zh: {
        hero: '调查员',
        enemy: '嫌疑人',
        system: '系统'
    },
    ja: {
        hero: '調査員',
        enemy: '容疑者',
        system: 'システム'
    },
    en: {
        hero: 'Detective',
        enemy: 'Suspect',
        system: 'System'
    }
};

const nextHint: Record<Language, string> = {
    zh: '点击继续',
    ja: 'クリックして続行',
    en: 'Click to Continue'
};

export const AvgDialoguePanel: React.FC<AvgDialoguePanelProps> = ({ lang, line, scene, onNext }) => {
    const [isTypingDone, setIsTypingDone] = useState(false);

    useEffect(() => {
        setIsTypingDone(false);
    }, [line]);

    return (
        <div
            className="avg-dialogue-overlay"
            onClick={() => {
                if (isTypingDone) {
                    onNext();
                }
            }}
        >
            {line.speaker !== 'system' && (
                <div className={`avg-portrait-stage ${line.speaker}`}>
                    <ScenePortrait
                        role={line.speaker === 'hero' ? 'hero' : 'enemy'}
                        packId={line.speaker === 'hero' ? scene.heroPortraitPackId : scene.enemyPortraitPackId}
                        state={line.speaker === 'hero' ? scene.heroPortraitState : scene.enemyPortraitState}
                        motion={line.speaker === 'hero' ? scene.heroPortraitMotion : scene.enemyPortraitMotion}
                        speaking={!isTypingDone}
                        className={`avg-focus-portrait ${line.speaker}`}
                    />
                </div>
            )}
            <div className="avg-dialogue-box">
                <div className={`avg-speaker ${line.speaker}`}>{speakerLabel[lang][line.speaker]}</div>
                <div className="avg-dialogue-text">
                    <TypingBlock
                        text={line.text}
                        speed={24}
                        onComplete={() => setIsTypingDone(true)}
                        renderToken={(_, visibleContent) => <span>{visibleContent}</span>}
                        showTypingCursor
                        typingCursorChar="_"
                    />
                </div>
                {isTypingDone && <div className="avg-next-hint blink">{nextHint[lang]}</div>}
            </div>
        </div>
    );
};
