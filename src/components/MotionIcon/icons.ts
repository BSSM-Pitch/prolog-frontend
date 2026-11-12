import { DRAW, SLIDE, type DrawAnim, type SlideAnim } from './motion';
import type { PathKey } from './paths';

/** Figma 벡터 1개. x/y/w/h는 프레임(212:804) 기준 바운딩 박스 */
export interface IconVector {
  nodeId: string;
  path: PathKey;
  x: number;
  y: number;
  draw: DrawAnim;
  slide?: SlideAnim;
  /** stroke 패딩이 기본값(0.675)과 다른 경우 */
  padTop?: number;
}

export interface IconDef {
  nodeId: string;
  /** 프레임 기준 그룹 위치/크기 */
  x: number;
  y: number;
  width: number;
  height: number;
  vectors: IconVector[];
}

export const STROKE_PAD = 0.675; // stroke-width 1.35 / 2

export const ICONS = {
  book: {
    nodeId: '212:491', x: 0, y: 1, width: 11, height: 13,
    vectors: [
      { nodeId: '211:457', path: 'a7703', x: 0, y: 1, draw: DRAW.intro },
      { nodeId: '211:460', path: '364ec', x: 0, y: 11, draw: DRAW.intro },
      { nodeId: '211:461', path: 'fd612', x: 11, y: 1, draw: DRAW.late },
      { nodeId: '211:462', path: '205f5', x: 3, y: 4.5, draw: DRAW.late },
    ],
  },
  home: {
    nodeId: '212:533', x: 39, y: 0, width: 14, height: 14,
    vectors: [
      // 212:521 (Vector 14)은 Figma에서 숨김 처리되어 제외
      { nodeId: '212:965', path: '81278', x: 39, y: 0, draw: DRAW.intro, padTop: 0.6545 },
      { nodeId: '212:547', path: 'eccac', x: 39, y: 7, draw: DRAW.intro },
      { nodeId: '212:523', path: 'b4592', x: 43.5, y: 7.5, draw: DRAW.late },
    ],
  },
  notebook: {
    nodeId: '212:567', x: 83, y: 1, width: 11, height: 14.5,
    vectors: [
      { nodeId: '212:560', path: '33a5f', x: 84, y: 1, draw: DRAW.intro },
      { nodeId: '212:561', path: '73c9d', x: 83, y: 1, draw: DRAW.intro },
      { nodeId: '212:562', path: '555c6', x: 86, y: 1, draw: DRAW.late },
      { nodeId: '212:565', path: 'fcdeb', x: 89, y: 4.5, draw: DRAW.late },
      { nodeId: '212:563', path: 'fcdeb', x: 89, y: 7.5, draw: DRAW.late2 },
    ],
  },
  route: {
    nodeId: '212:634', x: 125, y: 1, width: 14, height: 14,
    vectors: [
      { nodeId: '212:632', path: '3a4bc', x: 125, y: 12, draw: DRAW.intro },
      { nodeId: '212:630', path: '0fdd9', x: 126.5, y: 2.5, draw: DRAW.early },
      { nodeId: '212:633', path: '95c5a', x: 136, y: 1, draw: DRAW.delay10 },
    ],
  },
  user: {
    nodeId: '212:666', x: 170, y: 1, width: 9, height: 14,
    vectors: [
      { nodeId: '212:664', path: '6bfc7', x: 170, y: 10.5, draw: DRAW.intro },
      { nodeId: '212:667', path: 'e7fa6', x: 171.5, y: 1, draw: DRAW.intro },
    ],
  },
  world: {
    nodeId: '212:689', x: 210, y: 1, width: 14, height: 14,
    vectors: [
      { nodeId: '212:684', path: '3423e', x: 210, y: 1, draw: DRAW.intro },
      { nodeId: '212:685', path: 'b69c2', x: 210.5, y: 5.5, draw: DRAW.late },
      { nodeId: '212:686', path: 'b69c2', x: 210.5, y: 10.5, draw: DRAW.late2 },
      { nodeId: '212:687', path: '86681', x: 214.571, y: 1, draw: DRAW.late2 },
      { nodeId: '212:688', path: 'c7168', x: 217, y: 1, draw: DRAW.late3 },
    ],
  },
  usersGroup: {
    nodeId: '212:750', x: 253.5, y: 1, width: 14, height: 14,
    vectors: [
      { nodeId: '212:740', path: 'ba16b', x: 255, y: 1, draw: DRAW.intro },
      { nodeId: '212:749', path: 'e6796', x: 253.5, y: 6.5, draw: DRAW.earlyOut },
      { nodeId: '212:743', path: '5309c', x: 259, y: 7.5, draw: DRAW.twoStep },
      { nodeId: '212:746', path: 'cfa71', x: 257.5, y: 13, draw: DRAW.usersBase },
      { nodeId: '212:747', path: '0282e', x: 263, y: 1, draw: DRAW.usersRightHead },
      { nodeId: '212:748', path: '91fb6', x: 264.5, y: 6.5, draw: DRAW.usersRightBody },
    ],
  },
  bell: {
    nodeId: '212:784', x: 297, y: 0, width: 13, height: 14,
    vectors: [
      { nodeId: '212:781', path: 'b92ec', x: 297, y: 0, draw: DRAW.intro },
      { nodeId: '212:782', path: 'b69c2', x: 297, y: 11, draw: DRAW.intro },
      { nodeId: '212:783', path: '5f9f8', x: 301, y: 11.5, draw: DRAW.late },
    ],
  },
  logout: {
    nodeId: '212:3543', x: 340, y: 1, width: 14, height: 13,
    vectors: [
      // 245:753(Vector 53)·245:755(Rectangle 1)은 Figma에서 숨김 처리되어 제외
      { nodeId: '212:3539', path: '7d5ff', x: 340, y: 1, draw: DRAW.intro },
      { nodeId: '212:3540', path: '2cf47', x: 344.5, y: 7.5, draw: DRAW.logoutShaft },
      { nodeId: '212:3781', path: 'f4f49', x: 351.5, y: 5, draw: DRAW.arrowHead, slide: SLIDE.arrowHead },
      { nodeId: '212:3782', path: '7ba58', x: 351.5, y: 7.5, draw: DRAW.arrowHead, slide: SLIDE.arrowHead },
    ],
  },
} satisfies Record<string, IconDef>;

export type IconName = keyof typeof ICONS;

export const ICON_ORDER = Object.keys(ICONS) as IconName[];

/** 원본 Figma 프레임(212:804) 크기 */
export const FRAME = { width: 354, height: 15.5 } as const;
