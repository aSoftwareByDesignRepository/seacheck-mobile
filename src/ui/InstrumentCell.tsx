import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

type Props = {
  label: string;
  value: string;
  unit?: string;
  hero?: boolean;
  heroSize?: number;
  accessibilityLabel?: string;
  onPress?: () => void;
  testID?: string;
};

export function InstrumentCell({ label, value, unit, hero, heroSize = 28, accessibilityLabel, onPress, testID }: Props) {
  const { colors, minTouch } = useTheme();
  const content = (
    <View style={styles.cell} testID={testID}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text
          style={[hero ? styles.hero : styles.value, { color: colors.text, fontSize: hero ? heroSize : 20 }]}
          accessibilityLabel={accessibilityLabel ?? `${label} ${value}${unit ? ` ${unit}` : ''}`}
          numberOfLines={1}
          adjustsFontSizeToFit={hero}
          minimumFontScale={0.8}
        >
          {value}
        </Text>
        {unit ? <Text style={[styles.unit, { color: colors.textMuted }]}>{unit}</Text> : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={{ minHeight: minTouch, justifyContent: 'center' }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, flexBasis: 0, minWidth: 0, alignSelf: 'stretch', maxWidth: '100%' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 },
  hero: { fontWeight: '800', fontVariant: ['tabular-nums'] },
  value: { fontWeight: '700', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, fontWeight: '600' },
});
