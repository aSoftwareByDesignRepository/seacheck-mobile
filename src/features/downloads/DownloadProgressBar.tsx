import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';

type Props = {
  percentage: number;
  label: string;
  testID?: string;
};

/** WCAG-friendly progress: visible bar plus explicit percentage text (not color-only). */
export function DownloadProgressBar({ percentage, label, testID }: Props) {
  const { colors, spacing } = useTheme();
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <View style={{ gap: spacing.sm }} testID={testID} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: clamped }}>
      <View
        style={[styles.track, { backgroundColor: colors.border }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[styles.label, { color: colors.text }]} accessibilityLiveRegion="polite">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, minWidth: 2 },
  label: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
});
