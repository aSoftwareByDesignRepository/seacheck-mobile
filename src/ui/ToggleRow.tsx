import { StyleSheet, Switch, Text, View } from 'react-native';

type Props = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID: string;
  colors: { text: string; textMuted?: string };
  minTouch: number;
};

export function ToggleRow({ label, hint, value, onChange, testID, colors, minTouch }: Props) {
  return (
    <View style={styles.block}>
      <View style={[styles.row, { minHeight: minTouch }]} accessibilityLabel={label} accessibilityHint={hint}>
        <Text style={[styles.rowLabel, { color: colors.text }]} importantForAccessibility="no">{label}</Text>
        <Switch
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ checked: value }}
          value={value}
          onValueChange={onChange}
          testID={testID}
        />
      </View>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted ?? colors.text }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 15, flex: 1, marginRight: 12 },
  hint: { fontSize: 13, lineHeight: 18, marginTop: 2, opacity: 0.85 },
});
