import React from 'react';
import { getBackgroundAsset, getBackgroundOverlayAsset } from '../services/sceneAssetLibrary';
import { RuntimeSceneState } from '../services/sceneAssetTypes';

interface SceneBackdropProps {
    scene: RuntimeSceneState;
    className?: string;
}

export const SceneBackdrop: React.FC<SceneBackdropProps> = ({ scene, className = '' }) => {
    const backgroundUrl = getBackgroundAsset(scene.backgroundPackId, scene.backgroundSlot);
    const overlayUrl = getBackgroundOverlayAsset(scene.backgroundPackId, scene.backgroundSlot);

    return (
        <div
            className={[
                'scene-backdrop',
                className,
                `scene-filter-${scene.screenFilter}`,
                `scene-transition-${scene.transition}`,
                `scene-impulse-${scene.screenImpulse}`
            ].filter(Boolean).join(' ')}
        >
            {backgroundUrl && (
                <img
                    className="scene-backdrop-image"
                    src={backgroundUrl}
                    alt=""
                    draggable={false}
                />
            )}
            <div
                className={[
                    'scene-monitor-fx',
                    `scene-monitor-fx-${scene.screenFilter}`
                ].join(' ')}
                aria-hidden="true"
            />
            {overlayUrl && (
                <img
                    className="scene-backdrop-overlay"
                    src={overlayUrl}
                    alt=""
                    draggable={false}
                />
            )}
        </div>
    );
};
