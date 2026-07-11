import { StyleSheet, Text, View } from 'react-native';

import { AMBIENT_CACHE_MAX_BYTES } from '../../lib/offline/ambientCache';
import { t } from '../../i18n';
import { useTheme } from '../../theme/ThemeContext';

function formatCacheSizeMb(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/** Explains short-term cache vs downloaded packs — shown at the top of Downloads. */
export function OfflineChartsGuide() {
  const { colors, spacing } = useTheme();
  const cacheMb = formatCacheSizeMb(AMBIENT_CACHE_MAX_BYTES);

  return (
    <View
      testID="downloads.offlineGuide"
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          marginBottom: spacing.lg,
        },
      ]}
      accessibilityRole="summary"
      accessibilityLabel={t('downloads.howChartsWorkTitle')}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {t('downloads.howChartsWorkTitle')}
      </Text>
      <Text style={[styles.lead, { color: colors.textMuted }]}>{t('downloads.howChartsWorkLead')}</Text>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={[styles.badge, { backgroundColor: colors.warningBg }]} accessibilityElementsHidden>
          <Text style={[styles.badgeText, { color: colors.primary }]}>1</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{t('downloads.howChartsRecentTitle')}</Text>
          <Text style={[styles.rowBodyText, { color: colors.textMuted }]}>
            {t('downloads.howChartsRecentBody', { size: cacheMb })}
          </Text>
        </View>
      </View>

      <View style={[styles.row, { borderColor: colors.border }]}>
        <View style={[styles.badge, { backgroundColor: colors.successBg }]} accessibilityElementsHidden>
          <Text style={[styles.badgeText, { color: colors.success }]}>2</Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowTitle, { color: colors.text }]}>{t('downloads.howChartsPackTitle')}</Text>
          <Text style={[styles.rowBodyText, { color: colors.textMuted }]}>{t('downloads.howChartsPackBody')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  title: { fontSize: 17, fontWeight: '800', lineHeight: 24 },
  lead: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  badgeText: { fontSize: 14, fontWeight: '800', lineHeight: 18 },
  rowBody: { flex: 1, gap: 4, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  rowBodyText: { fontSize: 14, lineHeight: 20 },
});
