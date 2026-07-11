import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '../../i18n';
import { usePassageMapPlanningStore } from '../../store/passageMapPlanningStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTheme } from '../../theme/ThemeContext';

type Props = {
  allowRouteEdits: boolean;
};

/** Dismissible how-to card while planning a passage on the chart. */
export function PassageMapPlanningGuideBanner({ allowRouteEdits }: Props) {
  const { colors, spacing, minTouch } = useTheme();
  const permanentlyDismissed = useSettingsStore((s) => s.passagePlanningGuideDismissed);
  const dismissPermanently = useSettingsStore((s) => s.dismissPassagePlanningGuide);
  const sessionDismissed = usePassageMapPlanningStore((s) => s.guideDismissedForSession);
  const dismissForSession = usePassageMapPlanningStore((s) => s.dismissGuideForSession);

  if (permanentlyDismissed || sessionDismissed) return null;

  const title = allowRouteEdits ? t('passage.mapPlanningGuideTitle') : t('passage.mapPlanningGuideViewTitle');
  const steps = allowRouteEdits
    ? [t('passage.mapPlanningGuideStepLongPress'), t('passage.mapPlanningGuideStepTapEdit')]
    : [t('passage.mapPlanningGuideViewStepTap')];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.primary,
          marginBottom: spacing.sm,
        },
      ]}
      testID="passage.mapPlanning.guide"
      accessibilityRole="alert"
      accessibilityLabel={[title, ...steps].join('. ')}
    >
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.steps} accessibilityRole="list">
        {steps.map((step, index) => (
          <View key={step} style={styles.stepRow} accessibilityRole="text">
            <View style={[styles.stepBadge, { backgroundColor: colors.primary }]} accessibilityElementsHidden>
              <Text style={[styles.stepBadgeText, { color: colors.primaryText }]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
          </View>
        ))}
      </View>
      <View style={[styles.actions, { gap: spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('passage.mapPlanningGuideDismiss')}
          onPress={() => dismissForSession()}
          style={[styles.actionBtn, { borderColor: colors.border, minHeight: minTouch, flex: 1 }]}
          testID="passage.mapPlanning.guide.dismiss"
        >
          <Text style={[styles.actionText, { color: colors.text }]}>{t('passage.mapPlanningGuideDismiss')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('passage.mapPlanningGuideDismissPermanent')}
          onPress={() => {
            dismissForSession();
            void dismissPermanently();
          }}
          style={[styles.actionBtn, { borderColor: colors.border, minHeight: minTouch, flex: 1 }]}
          testID="passage.mapPlanning.guide.dismissPermanent"
        >
          <Text style={[styles.actionTextMuted, { color: colors.textMuted }]}>
            {t('passage.mapPlanningGuideDismissPermanent')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 14, padding: 14, gap: 12 },
  title: { fontSize: 15, fontWeight: '800', lineHeight: 22 },
  steps: { gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  stepBadgeText: { fontSize: 13, fontWeight: '800', lineHeight: 16 },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '800', lineHeight: 20, textAlign: 'center' },
  actionTextMuted: { fontSize: 13, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
});
