import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useSettingsStore } from '../../store/settingsStore';

type Props = PropsWithChildren<{
  map: React.ReactNode;
  panel: React.ReactNode;
}>;

export function ResponsiveMapShell({ map, panel }: Props) {
  const { formFactor, isLandscape } = useFormFactor();
  const layoutPreset = useSettingsStore((s) => s.layoutPreset);

  const split =
    layoutPreset === 'split' ||
    (layoutPreset === 'map-forward' && formFactor === 'expanded') ||
    (layoutPreset === 'instruments-forward' && formFactor !== 'compact' && isLandscape);

  const row = split && (formFactor !== 'compact' || isLandscape);

  if (layoutPreset === 'minimal') {
    return <View style={styles.fill}>{map}</View>;
  }

  if (row) {
    return (
      <View style={[styles.fill, styles.row]}>
        <View style={styles.half}>{map}</View>
        <View style={styles.half}>{panel}</View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {map}
      {layoutPreset !== 'map-forward' ? panel : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
});
