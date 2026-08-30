import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isAnchorWatchLimitedChrome } from '../../lib/anchor/anchorLimitedChrome';
import { getAnchorWatchStatus } from '../../lib/anchor/activateAnchorAlarm';
import { t } from '../../i18n';
import { useNavigationStore } from '../../store/navigationStore';
import { useTheme } from '../../theme/ThemeContext';

/**
 * Non-dismissible limited-watch banner — stays visible after cold start while
 * `armedLimited` (or live limited status) is true. Tap opens the fix sheet.
 */
export function AnchorLimitedBanner() {
  const { colors, minTouch } = useTheme();
  const anchorAlarm = useNavigationStore((s) => s.anchorAlarm);
  const setAnchorWatchPrompt = useNavigationStore((s) => s.setAnchorWatchPrompt);

  if (!isAnchorWatchLimitedChrome(anchorAlarm)) return null;

  async function openFixSheet() {
    const status = await getAnchorWatchStatus();
    if (status.limited) {
      setAnchorWatchPrompt(status);
    }
  }

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warningBg, borderColor: colors.warningBorder }]}
      accessibilityRole="alert"
      testID="map.anchorLimitedBanner"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.anchorLimitedBannerTitle')}
        accessibilityHint={t('map.anchorLimitedBannerHint')}
        onPress={() => void openFixSheet()}
        style={[styles.message, { minHeight: minTouch }]}
        testID="map.anchorLimitedBanner.open"
      >
        <Text style={[styles.title, { color: colors.warningText }]} numberOfLines={2}>
          {t('map.anchorLimitedBannerTitle')}
        </Text>
        <Text style={[styles.hint, { color: colors.warningText }]} numberOfLines={3}>
          {t('map.anchorLimitedBannerBody')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  message: { justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800', lineHeight: 20 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 2, fontWeight: '600' },
});
