import { StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { t } from '../../i18n';
import type { LegCoverage } from '../../lib/map/coverage';
import type { PassageWithLegs } from '../../store/passageStore';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';
import { SectionHeader } from '../../ui/SectionHeader';
import { PassageLegTable } from './PassageLegTable';
import { PassageMapPreview } from './PassageMapPreview';

type Props = {
  detail: PassageWithLegs;
  legCoverage: LegCoverage[];
  editorPane: 'table' | 'map';
  onEditorPaneChange: (pane: 'table' | 'map') => void;
  highlightedLegIndex: number | null;
  onHighlightLeg: (legIndex: number | null) => void;
  onLegSogChange: Parameters<typeof PassageLegTable>[0]['onLegSogChange'];
  onLegNoteChange: Parameters<typeof PassageLegTable>[0]['onLegNoteChange'];
};

export function PassageEditorPanel({
  detail,
  legCoverage,
  editorPane,
  onEditorPaneChange,
  highlightedLegIndex,
  onHighlightLeg,
  onLegSogChange,
  onLegNoteChange,
}: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const { formFactor } = useFormFactor();
  const split = formFactor !== 'compact';

  const table = (
    <PassageLegTable
      detail={detail}
      highlightedLegIndex={highlightedLegIndex}
      onHighlightLeg={onHighlightLeg}
      onLegSogChange={onLegSogChange}
      onLegNoteChange={onLegNoteChange}
    />
  );

  const map = (
    <PassageMapPreview
      detail={detail}
      legCoverage={legCoverage}
      highlightedLegIndex={highlightedLegIndex}
      onLegPress={(legIndex) => onHighlightLeg(legIndex)}
    />
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: spacing.lg, minHeight: minTouch }]} testID="passage.editor">
      <SectionHeader first title={t('passage.editorTitle')} description={t('passage.editorBody')} />
      {!split ? (
        <View style={styles.toggleRow}>
          <FilterChip label={t('passage.paneTable')} selected={editorPane === 'table'} onPress={() => onEditorPaneChange('table')} testID="passage.pane.table" />
          <FilterChip label={t('passage.paneMap')} selected={editorPane === 'map'} onPress={() => onEditorPaneChange('map')} testID="passage.pane.map" />
        </View>
      ) : null}
      {split ? (
        <View style={styles.split}>
          <View style={styles.splitCol}>{table}</View>
          <View style={[styles.splitCol, styles.mapCol]}>{map}</View>
        </View>
      ) : editorPane === 'table' ? (
        table
      ) : (
        map
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  split: { flexDirection: 'row', gap: 16 },
  splitCol: { flex: 1, minWidth: 0 },
  mapCol: { minWidth: 240 },
});
