import { StyleSheet, Text, View } from 'react-native';

import { EXTERNAL_LINKS } from '../../lib/constants/externalLinks';
import { t } from '../../i18n';
import { useOnlineLayersAllowed } from '../../lib/network/connectivity';
import { confirmEnableDepthOverlay } from '../../lib/settings/depthOverlayEnableConfirm';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';
import { ExternalLinkRow } from '../../ui/ExternalLinkRow';
import { SettingsGroup } from '../../ui/Screen';
import { ToggleRow } from '../../ui/ToggleRow';

type Props = {
  first?: boolean;
};

/**
 * Chart data — what offline packs include, plus the optional online-only depth overlay.
 */
export function ChartDataSettingsGroup({ first }: Props) {
  const { colors, minTouch, spacing } = useTheme();
  const mapShowDepthOverlay = useSettingsStore((s) => s.mapShowDepthOverlay);
  const patchSettings = useSettingsStore((s) => s.patchSettings);
  const onlineLayersAllowed = useOnlineLayersAllowed();
  const isOffline = !onlineLayersAllowed;

  const onToggleDepth = async (next: boolean) => {
    if (!next) {
      await patchSettings({ mapShowDepthOverlay: false });
      return;
    }
    const ok = await confirmEnableDepthOverlay();
    if (!ok) return;
    await patchSettings({ mapShowDepthOverlay: true });
  };

  const depthHint = isOffline
    ? t('settings.mapShowDepthOverlayHintOffline')
    : t('settings.mapShowDepthOverlayHint');

  return (
    <SettingsGroup title={t('settings.chartDataTitle')} hint={t('settings.chartDataSummary')} first={first}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.chartDataLayersBody')}</Text>

      <View
        style={[
          styles.depthPanel,
          {
            marginTop: spacing.md,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            padding: spacing.md,
            gap: spacing.sm,
          },
        ]}
        accessibilityLabel={t('settings.depthOverlaySection')}
        testID="settings.depthOverlayPanel"
      >
        <Text style={[styles.sectionLabel, { color: colors.text }]} accessibilityRole="header">
          {t('settings.depthOverlaySection')}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>{t('settings.depthOverlayIntro')}</Text>

        <ToggleRow
          label={t('settings.mapShowDepthOverlay')}
          hint={depthHint}
          value={mapShowDepthOverlay}
          onChange={(v) => void onToggleDepth(v)}
          testID="settings.mapShowDepthOverlay"
          colors={colors}
          minTouch={minTouch}
        />

        {mapShowDepthOverlay && isOffline ? (
          <Text
            style={[
              styles.pauseNote,
              {
                color: colors.warningText,
                backgroundColor: colors.warningBg,
                borderColor: colors.warningBorder,
              },
            ]}
            accessibilityRole="text"
            accessibilityLiveRegion="polite"
            testID="settings.depthOverlayPausedOffline"
          >
            {t('settings.depthOverlayPausedOffline')}
          </Text>
        ) : null}

        <Text
          style={[
            styles.warning,
            {
              color: colors.warningText,
              backgroundColor: colors.warningBg,
              borderColor: colors.warningBorder,
            },
          ]}
          accessibilityRole="text"
          accessibilityLiveRegion={mapShowDepthOverlay ? 'polite' : 'none'}
          testID="settings.depthOverlayWarning"
        >
          {t('settings.depthOverlayWarning')}
        </Text>

        <ExternalLinkRow
          label={t('legal.gebcoAttribution')}
          url={EXTERNAL_LINKS.gebco}
          testID="settings.depthOverlay.gebcoLink"
        />
      </View>
    </SettingsGroup>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21 },
  depthPanel: {
    borderWidth: 1,
    borderRadius: 12,
    width: '100%',
  },
  sectionLabel: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  warning: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pauseNote: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
