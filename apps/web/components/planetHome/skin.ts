import type { HomeWork, PlanetHomeConfig, PlanetHomeView } from '@obolo/shared';
import type { ComponentType } from 'react';
import type { Stage, StageItem } from '@/lib/planetHome/model';

/**
 * 星のホーム: the swappable look. PlanetHome draws the frame (title, 推し list, the sheets that open a work, the long-press
 * menu, your works inside, the far work up close, the words while it sings); a skin draws only the scene — the backdrop,
 * your place, what floats around it and the far scenery — and calls back. Every planet's art and motion plugs in here
 * (skins.ts); the placeholder shapes in PlaceholderScenes.tsx stand in until the story team's art arrives.
 */
export interface SceneProps {
  cfg: PlanetHomeConfig;
  view: PlanetHomeView;
  stage: Stage;
  /** the one playing now (Saturn: under the needle) */
  playingId: string | null;
  /** Saturn: the record is turning */
  spinning: boolean;
  /** your place tapped: go inside (Saturn: the play button on the rim does onPlay instead) */
  onPlace: () => void;
  onPlay: () => void;
  /** your works in a list (Saturn: 並べかえ・外す, since its inside is the record itself) */
  onArrange: () => void;
  /** a work tapped: it comes forward and plays / opens */
  onItem: (w: StageItem) => void;
  /** a work held: 推す / 外す / 通報 */
  onHold: (w: StageItem) => void;
  /** the far scenery tapped: one stranger's work up close */
  onFar: (w: HomeWork) => void;
}

export interface PlanetHomeSkin {
  Scene: ComponentType<SceneProps>;
}
