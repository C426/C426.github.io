import React from 'react';
import { getPortraitAsset } from '../services/sceneAssetLibrary';
import { PortraitMotion, PortraitRoleHint, PortraitState } from '../services/sceneAssetTypes';

interface ScenePortraitProps {
    role: PortraitRoleHint;
    packId: string;
    state: PortraitState;
    speaking?: boolean;
    motion?: PortraitMotion;
    className?: string;
}

export const ScenePortrait: React.FC<ScenePortraitProps> = ({
    role,
    packId,
    state,
    speaking = false,
    motion = 'none',
    className = ''
}) => {
    const portraitUrl = getPortraitAsset(packId, state, speaking, role);

    if (!portraitUrl) {
        return null;
    }

    return (
        <img
            className={['scene-portrait', className, `scene-portrait-motion-${motion}`].filter(Boolean).join(' ')}
            src={portraitUrl}
            alt=""
            draggable={false}
        />
    );
};
