import type { FormFactor } from '../hooks/useFormFactor';

/** Hero instrument value size per form factor — matches useFormFactor. */
export function instrumentHeroSizeForFormFactor(formFactor: FormFactor): number {
  return formFactor === 'expanded' ? 36 : formFactor === 'medium' ? 32 : 28;
}

/** Minimum tile height for hero instrument chips (SOG/COG). */
export function heroChipMinHeight(heroSize: number, hasUnit: boolean): number {
  return Math.ceil(10 + 16 + 4 + heroSize + (hasUnit ? 16 : 0) + 10);
}

/** Compact instrument chip — secondary readouts (passage brg/dist in minimal dock). */
export function compactChipMinHeight(): number {
  return Math.ceil(10 + 16 + 4 + 18 + 16 + 10);
}

/** Minimal layout bottom dock — SOG/COG hero row only. */
export function computeMinimalInstrumentDockHeight(spacingSm: number, heroSize: number): number {
  return spacingSm * 2 + heroChipMinHeight(heroSize, true);
}

/** Extra clearance below SOG/COG when passage follow is shown in the minimal dock. */
export const MINIMAL_PASSAGE_DOCK_EXTRA = 10;

/** Minimal layout bottom dock — passage meta + brg/dist + SOG/COG, no scroll. */
export function computeMinimalPassageInstrumentDockHeight(spacingSm: number, heroSize: number): number {
  const passageMetaLine = 16;
  const passageBlockPadding = 16;
  const passageMetaGap = 4;
  const passageRow = compactChipMinHeight();
  const passageBlock = passageBlockPadding + passageMetaLine + passageMetaGap + passageRow;
  const sogRow = heroChipMinHeight(heroSize, true);
  return spacingSm * 2 + passageBlock + spacingSm + sogRow + MINIMAL_PASSAGE_DOCK_EXTRA;
}
