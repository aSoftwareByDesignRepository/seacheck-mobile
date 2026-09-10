import { StyleSheet } from 'react-native';

/** Shared typography and spacing for the Downloads tab. */
export const downloadsStyles = StyleSheet.create({
  // lineHeight ≥ fontSize+6 + full-width title block — avoids vertical glyph wrap
  // when long StatusBadge siblings (Test pack + Ready…) formerly squeezed flex:1 Text.
  packName: { fontSize: 16, fontWeight: '700', lineHeight: 24, flexShrink: 0 },
  packDescription: { fontSize: 14, lineHeight: 20 },
  packMeta: { fontSize: 13, lineHeight: 18 },
  packError: { fontSize: 13, lineHeight: 18 },
  previewName: { fontWeight: '700', fontSize: 16, lineHeight: 24 },
  previewBody: { lineHeight: 20, fontSize: 14 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionTitle: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  optionBody: { fontSize: 14, lineHeight: 20 },
  listItem: { paddingVertical: 14, gap: 10 },
  listItemSelected: {
    marginHorizontal: -8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  listItemDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2, paddingTop: 16 },
  testPackCallout: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  /** Title full width, badges wrap on the next line — never squeeze name to 1-glyph column. */
  titleRow: { flexDirection: 'column', alignItems: 'stretch', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flexGrow: 1, flexBasis: '48%', minWidth: 132 },
});
