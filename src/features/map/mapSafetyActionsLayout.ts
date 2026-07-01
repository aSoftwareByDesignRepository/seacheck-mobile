import type { FormFactor } from '../../hooks/useFormFactor';

/** Safety stack sits above bottom chrome with this gap (px). */
export const MAP_SAFETY_COLUMN_GAP = 8;

/** Extra lift while passage follow / MOB expands the instrument dock. */
export const MAP_SAFETY_COLUMN_EXPANDED_LIFT = 8;

export type SafetyActionsVariant = 'side' | 'inline';

export type SafetyActionsMetrics = {
  variant: SafetyActionsVariant;
  buttonSize: number;
  iconSize: number;
  gap: number;
  captionSize: number;
  borderRadius: number;
  paddingH: number;
  paddingV: number;
  /** Total vertical space of the stacked buttons (for compass / inset math). */
  stackHeight: number;
  /** Horizontal reserve so top chrome clears the column. */
  columnWidth: number;
};

export function safetyActionButtonCount(showAnchor: boolean): number {
  return showAnchor ? 3 : 2;
}

export function computeSafetyActionsMetrics(args: {
  minTouch: number;
  spacingSm: number;
  spacingMd: number;
  formFactor: FormFactor;
  variant: SafetyActionsVariant;
  showAnchor: boolean;
  chromeRight: number;
}): SafetyActionsMetrics {
  const { minTouch, spacingSm, spacingMd, formFactor, variant, showAnchor, chromeRight } = args;
  const count = safetyActionButtonCount(showAnchor);
  const isSide = variant === 'side';
  const expanded = formFactor === 'expanded';
  const medium = formFactor === 'medium';

  const buttonSize =
    isSide && expanded ? minTouch + 4 : isSide && medium ? minTouch + 2 : minTouch;
  const gap =
    variant === 'inline'
      ? spacingSm
      : expanded
        ? spacingMd
        : medium
          ? spacingSm + 2
          : spacingSm;
  const captionSize = variant === 'inline' ? 10 : expanded ? 12 : 11;
  const iconSize = Math.min(expanded ? 26 : 24, Math.round(buttonSize * 0.52));
  const paddingV = variant === 'inline' ? 6 : expanded ? 12 : 10;
  const paddingH = variant === 'inline' ? 10 : expanded ? 14 : 12;
  const borderRadius = isSide && expanded ? 16 : 14;

  const blockHeight =
    variant === 'inline'
      ? buttonSize
      : buttonSize + Math.round(captionSize * 0.85);
  const stackHeight = count * blockHeight + (count - 1) * gap;
  const btnOuterWidth = buttonSize + paddingH * 2;
  const columnWidth = isSide ? btnOuterWidth + chromeRight + spacingSm : btnOuterWidth;

  return {
    variant,
    buttonSize,
    iconSize,
    gap,
    captionSize,
    borderRadius,
    paddingH,
    paddingV,
    stackHeight,
    columnWidth,
  };
}

/** Max column width when anchor may be shown — used for top-chrome reserve. */
export function computeMaxSafetyColumnWidth(
  minTouch: number,
  spacingSm: number,
  spacingMd: number,
  formFactor: FormFactor,
  chromeRight: number,
): number {
  return computeSafetyActionsMetrics({
    minTouch,
    spacingSm,
    spacingMd,
    formFactor,
    variant: 'side',
    showAnchor: true,
    chromeRight,
  }).columnWidth;
}

/** Max stack height (lock + anchor + MOB) for compass clearance. */
export function computeMaxSafetyStackHeight(
  minTouch: number,
  spacingSm: number,
  spacingMd: number,
  formFactor: FormFactor,
): number {
  return computeSafetyActionsMetrics({
    minTouch,
    spacingSm,
    spacingMd,
    formFactor,
    variant: 'side',
    showAnchor: true,
    chromeRight: 0,
  }).stackHeight;
}
