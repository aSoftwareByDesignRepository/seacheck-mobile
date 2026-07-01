import { Platform, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { compactChipMinHeight, heroChipMinHeight } from './instrumentLayout';

const fontPad = Platform.OS === 'android' ? { includeFontPadding: false } : null;

type Props = {
  label: string;
  value: string;
  unit?: string;
  /** Hero chips use larger value text — SOG/COG primary readouts. */
  hero?: boolean;
  heroSize?: number;
  flex?: number;
  accessibilityLabel?: string;
  testID?: string;
};

/** Compact bordered instrument readout — shared by map docks and instrument panels. */
export function InstrumentChip({
  label,
  value,
  unit,
  hero = false,
  heroSize = 28,
  flex = 1,
  accessibilityLabel,
  testID,
}: Props) {
  const { colors } = useTheme();

  const minHeight = hero ? heroChipMinHeight(heroSize, Boolean(unit)) : undefined;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          flex,
          minHeight,
        },
      ]}
      accessibilityLabel={accessibilityLabel ?? `${label} ${value}${unit ? ` ${unit}` : ''}`}
      testID={testID}
    >
      <Text style={[styles.label, { color: colors.textMuted }, fontPad]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          hero ? styles.heroValue : styles.value,
          { color: colors.text, fontSize: hero ? heroSize : 18 },
          fontPad,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit={hero}
        minimumFontScale={0.75}
      >
        {value}
      </Text>
      {unit ? (
        <Text style={[styles.unit, { color: colors.textMuted }, fontPad]} numberOfLines={1}>
          {unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 0,
  },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 16 },
  heroValue: { fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 4 },
  value: { fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 4 },
  unit: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
