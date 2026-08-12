export type HeaderLayout = 'full' | 'compact';
export type FlowLayout = 'row' | 'stack';

const LARGE_TEXT_SCALE = 1.25;

export function getHeaderLayout(width: number, fontScale: number): HeaderLayout {
  return width <= 340 || fontScale >= LARGE_TEXT_SCALE ? 'compact' : 'full';
}

export function getInputToolbarLayout(fontScale: number): FlowLayout {
  return fontScale >= LARGE_TEXT_SCALE ? 'stack' : 'row';
}

export function getOperatingStateLayout(fontScale: number): FlowLayout {
  return fontScale >= LARGE_TEXT_SCALE ? 'stack' : 'row';
}
