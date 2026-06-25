/** Shared layout tokens — spacing lives on ThemeContext. */
export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

export const sheet = {
  backdrop: 'rgba(0,0,0,0.52)',
  maxHeight: '88%',
  handleWidth: 40,
  handleHeight: 4,
} as const;

export const typography = {
  sheetTitle: { fontSize: 22, fontWeight: '800' as const, lineHeight: 28 },
  sheetSubtitle: { fontSize: 15, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 18 },
  overline: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
};
