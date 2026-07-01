import { StyleSheet, View } from 'react-native';

import { useEffectiveLayoutPreset } from '../../hooks/useEffectiveLayoutPreset';

type Props = {
  map: React.ReactNode;
};

/** Full-screen map host — instrument docks render as overlays from NavigationMap. */
export function ResponsiveMapShell({ map }: Props) {
  const layoutPreset = useEffectiveLayoutPreset();

  if (layoutPreset === 'instruments-only') {
    return null;
  }

  return <View style={styles.fill}>{map}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
});
