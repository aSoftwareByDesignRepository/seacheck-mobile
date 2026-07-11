import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/ThemeContext';
import { InstrumentCell } from '../../ui/InstrumentCell';

export type PassageStatCell = {
  key: string;
  label: string;
  value: string;
  unit?: string;
  hero?: boolean;
  heroSize?: number;
};

type Props = {
  bearing: PassageStatCell;
  distance: PassageStatCell;
  eta?: PassageStatCell | null;
  xte?: PassageStatCell | null;
  heroSize: number;
};

/**
 * Consistent 2×2 passage readout grid — bearing & distance on top, ETA & XTE below when shown.
 * Avoids orphan rows and overlap on narrow screens across all layout presets.
 */
export function PassageStatGrid({ bearing, distance, eta, xte, heroSize }: Props) {
  const { spacing } = useTheme();
  const secondary = [eta, xte].filter((cell): cell is PassageStatCell => cell != null);
  const etaSize = Math.max(18, heroSize - 6);

  return (
    <View style={[styles.root, { gap: spacing.xs }]}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <InstrumentCell
          label={bearing.label}
          value={bearing.value}
          unit={bearing.unit}
          hero
          heroSize={heroSize}
          testID={bearing.key}
        />
        <InstrumentCell
          label={distance.label}
          value={distance.value}
          unit={distance.unit}
          hero
          heroSize={heroSize}
          testID={distance.key}
        />
      </View>
      {secondary.length > 0 ? (
        <View style={[styles.row, { gap: spacing.sm }]}>
          {secondary.map((cell) => (
            <InstrumentCell
              key={cell.key}
              label={cell.label}
              value={cell.value}
              unit={cell.unit}
              hero={cell.hero ?? cell.key === eta?.key}
              heroSize={cell.heroSize ?? (cell.key === eta?.key ? etaSize : undefined)}
              testID={cell.key}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minWidth: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch', minWidth: 0 },
});
