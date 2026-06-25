import { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { useFormFactor } from '../../hooks/useFormFactor';
import { useMapShellLayout } from '../../hooks/useMapShellLayout';
import { useSettingsStore } from '../../store/settingsStore';

type Props = PropsWithChildren<{
  map: React.ReactNode;
  panel: React.ReactNode;
}>;

export function ResponsiveMapShell({ map, panel }: Props) {
  const { isLandscape } = useFormFactor();
  const { layoutPreset, row } = useMapShellLayout();
  const panelSide = useSettingsStore((s) => s.panelSide);

  if (layoutPreset === 'minimal') {
    return <View style={styles.fill}>{map}</View>;
  }

  const panelFirst =
    panelSide === 'port' || (panelSide === 'auto' && !isLandscape && row === false && layoutPreset === 'instruments-forward');

  if (layoutPreset === 'coordinates' && row) {
    const rowStyle = panelSide === 'port' ? styles.rowReverse : styles.row;
    return (
      <View style={[styles.fill, rowStyle]}>
        <View style={styles.mapWide}>{map}</View>
        <View style={styles.panelNarrow}>{panel}</View>
      </View>
    );
  }

  if (row) {
    const rowStyle = panelSide === 'port' ? styles.rowReverse : styles.row;
    return (
      <View style={[styles.fill, rowStyle]}>
        <View style={styles.half}>{map}</View>
        <View style={styles.half}>{panel}</View>
      </View>
    );
  }

  if (layoutPreset === 'instruments-forward' && panelFirst) {
    return (
      <View style={styles.fill}>
        <View style={styles.panelStack}>{panel}</View>
        <View style={styles.mapRegion}>{map}</View>
      </View>
    );
  }

  if (layoutPreset === 'coordinates' && !row) {
    return (
      <View style={styles.fill}>
        <View style={styles.mapRegion}>{map}</View>
        <View style={styles.coordsPanel}>{panel}</View>
      </View>
    );
  }

  if (layoutPreset === 'split' && !row) {
    return (
      <View style={styles.fill}>
        <View style={styles.mapRegion}>{map}</View>
        <View style={styles.panelStack}>{panel}</View>
      </View>
    );
  }

  if (layoutPreset === 'map-forward' && !row) {
    return (
      <View style={styles.fill}>
        <View style={styles.mapRegion}>{map}</View>
        <View style={styles.panelStack}>{panel}</View>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <View style={styles.mapRegion}>{map}</View>
      {panel}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  rowReverse: { flexDirection: 'row-reverse' },
  half: { flex: 1, minHeight: 0 },
  mapRegion: { flex: 1, minHeight: 0 },
  mapWide: { flex: 0.55, minHeight: 0 },
  panelNarrow: { flex: 0.45, minHeight: 0 },
  coordsPanel: { flexShrink: 0, maxHeight: '56%', minHeight: 220 },
  panelStack: { flexShrink: 0, maxHeight: '56%', minHeight: 220 },
});
