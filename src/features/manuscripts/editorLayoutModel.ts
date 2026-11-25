export const DEFAULT_PAPER_RATIO = 68
export const MIN_PAPER_RATIO = 40
export const MAX_PAPER_RATIO = 75
export const SPLIT_SPACE = 40
export function ratioBounds(width?: number) {
  const available = (width ?? 0) - SPLIT_SPACE
  return available >= 580
    ? { min: Math.max(MIN_PAPER_RATIO, 320 / available * 100), max: Math.min(MAX_PAPER_RATIO, (available - 260) / available * 100) }
    : { min: MIN_PAPER_RATIO, max: MAX_PAPER_RATIO }
}
export function paperRatio(value: number, width?: number) {
  const { min, max } = ratioBounds(width)
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : DEFAULT_PAPER_RATIO))
}
export function ratioAtPointer(x: number, left: number, width: number) {
  return paperRatio(width > SPLIT_SPACE ? (x - left - SPLIT_SPACE / 2) / (width - SPLIT_SPACE) * 100 : DEFAULT_PAPER_RATIO, width)
}
