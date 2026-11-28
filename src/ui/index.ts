// src/ui/index.ts – öffentliche API der HTML-Overlays (die Szene importiert nur von hier).
import './styles';

export { CatchCard, type CatchCardCallbacks } from './catchCard';
export { Bucket, type BucketCallbacks, type BucketData } from './bucket';
export { Lexicon, type LexiconCallbacks, type LexiconData } from './lexicon';
export { DebugMenu, type DebugMenuCallbacks, type DebugMenuData, type DebugMenuOptions, type DebugTime } from './debugMenu';
export { HudOverlay, type HudCallbacks, type HudData } from './hudOverlay';
export { TouchControls, type TouchControlsData } from './touchControls';
export { createInput, focusGame, type InputController } from './input';
export { Feedback, FEEDBACK_PATTERNS, canVibrate, type FeedbackKind, type FeedbackOptions } from './feedback';
export { LoadingScreen } from './loadingScreen';
export { Intro, type IntroInput } from './intro';
export {
  ACTION_TYPES, INPUT_MODES, KEY_BINDINGS, InputMapper, GestureTracker,
  type ActionType, type InputAction, type InputMode, type InputSource,
} from './inputMap';
export { Dialog, isModalOpen, onModalChange, type DialogOptions } from './dialog';
export { enableFrameImages, probeFrameImages, type FrameImageOptions } from './frames';
export { renderSprite, spriteFromAtlas, spriteFromTexture, loadImage, type TextureLike } from './sprite';
export { computeStars, worldProgress } from './stars';
export { formatCoins, formatLength, formatWeight, formatDepthRange, formatList, formatNumber } from './format';
export { RARITY_STYLE, SIZE_TIER_STYLE, needsSellConfirm } from './rarity';
export { canFullscreen, isFullscreen, toggleFullscreen, mountFullscreenButton } from './fullscreen';
export * from './types';
