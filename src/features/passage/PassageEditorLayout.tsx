import { PropsWithChildren, ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MasterDetailLayout } from '../responsive/MasterDetailLayout';
import { shouldUseMasterDetail } from '../../lib/responsive/splitLayout';
import { useFormFactor } from '../../hooks/useFormFactor';
import type { PassageDetailTab } from '../../lib/passage/passageEditorLayoutPolicy';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';
import { FilterChip } from '../../ui/FilterChip';

type Props = PropsWithChildren<{
  editor: ReactNode;
  mapPreview: ReactNode | null;
  defaultDetailTab?: PassageDetailTab;
}>;

/**
 * Passage editor — stacked with route/map toggle on phones and landscape; tablet + map split on medium+ portrait.
 */
export function PassageEditorLayout({ editor, mapPreview, defaultDetailTab = 'route' }: Props) {
  const { formFactor, isLandscape } = useFormFactor();
  const { spacing } = useTheme();
  const split = shouldUseMasterDetail(formFactor, isLandscape);
  const [compactTab, setCompactTab] = useState<PassageDetailTab>(defaultDetailTab);

  if (!mapPreview) {
    return <View style={styles.fill}>{editor}</View>;
  }

  if (!split) {
    return (
      <View style={styles.fill}>
        <View style={[styles.tabRow, { gap: spacing.sm, marginBottom: spacing.md }]} accessibilityRole="radiogroup" accessibilityLabel={t('passage.detailTitle')}>
          <FilterChip
            label={t('passage.detailTabRoute')}
            selected={compactTab === 'route'}
            onPress={() => setCompactTab('route')}
            testID="passage.detail.tab.route"
          />
          <FilterChip
            label={t('passage.detailTabMap')}
            selected={compactTab === 'map'}
            onPress={() => setCompactTab('map')}
            testID="passage.detail.tab.map"
          />
        </View>
        {compactTab === 'route' ? editor : mapPreview}
      </View>
    );
  }

  return <MasterDetailLayout master={editor} detail={mapPreview} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', alignSelf: 'stretch', minHeight: 0 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
