import type { HomeWork, PlanetHomeConfig, PlanetHomeView } from '@obolo/shared';
import type { ComponentType } from 'react';
import type { At } from '@/lib/planetHome/useHold';
import type { Stage, StageItem } from '@/lib/planetHome/model';

/**
 * 星のホーム: the swappable scene. PlanetHome draws the frame every planet shares (title, 〔？〕 and the explainer strip,
 * 〔♡ 推し〕, the dock, the bottom sheet, the long-press menu, the inside shelf, the toast); a skin draws only the scene —
 * the backdrop with your place, what floats around it, the far scenery — and calls back. Data and callbacks in, so a
 * planet's art and motion can change without touching the rules (lib/planetHome) or the feed.
 */
export interface SceneProps {
  cfg: PlanetHomeConfig;
  view: PlanetHomeView;
  stage: Stage;
  /** the one playing now (Saturn: it comes to the needle) */
  playingId: string | null;
  /** Saturn: the record is turning */
  spinning: boolean;
  /** the words of the one playing are showing (in the CAPTION band): works floating there move out of it */
  caption: boolean;
  /** your place tapped (Saturn: plays; elsewhere: goes inside) */
  onPlace: () => void;
  /** the name plate tapped: your works (Saturn's way to 並べかえ・外す) */
  onPlate: () => void;
  /** a work tapped: the sheet opens */
  onItem: (w: StageItem) => void;
  /** a work held: the menu at that point */
  onHold: (w: StageItem, at: At) => void;
}

export interface PlanetHomeSkin {
  Scene: ComponentType<SceneProps>;
}

/**
 * where the words of the one playing show (percent of the height): over your place, below the floating works and the
 * needle, above the name plate — so they never cover a work or a name tag
 */
export const CAPTION = { top: 64, bottom: 72 };
